// Comments backend for syed-aliredha.github.io — a tiny, self-hosted stand-in
// for Cusdis. Cloudflare Worker + D1 (SQLite).
//
// Public API (CORS-limited to ALLOWED_ORIGINS):
//   GET  /api/comments?page=<pageId>     approved comments for a page
//   POST /api/comments                   new comment (published straight away, or
//                                        held for approval if AUTO_APPROVE = "false")
//
// Moderation (Bearer ADMIN_TOKEN, same-origin only):
//   GET    /admin                        moderation page
//   GET    /api/admin/comments?status=pending|approved
//   POST   /api/admin/comments/:id/approve
//   POST   /api/admin/comments/:id/reply  { content }  (also approves :id)
//   DELETE /api/admin/comments/:id        (and all replies under it)

import ADMIN_HTML from "./admin.html";

const LIMITS = { nickname: 60, email: 200, content: 5000, pageId: 200, pageTitle: 200 };
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX = 5;          // comments per IP per window
const FLOOD_WINDOW_MS = 60 * 60 * 1000;
const FLOOD_MAX = 60;        // comments per hour across the whole site (spam flood)

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cors = corsHeaders(request, env);

    try {
      if (request.method === "OPTIONS") {
        return new Response(null, { status: cors ? 204 : 403, headers: cors || {} });
      }

      if (url.pathname === "/admin" && request.method === "GET") {
        return new Response(ADMIN_HTML, {
          headers: { "Content-Type": "text/html; charset=utf-8", "X-Frame-Options": "DENY" },
        });
      }

      if (url.pathname === "/api/comments") {
        if (request.method === "GET") return withCors(await listComments(url, env), cors);
        if (request.method === "POST") {
          if (!cors) return json({ error: "Origin not allowed" }, 403);
          return withCors(await createComment(request, env), cors);
        }
      }

      if (url.pathname.startsWith("/api/admin/")) {
        if (!(await isAdmin(request, env))) return json({ error: "Unauthorized" }, 401);
        return await handleAdmin(request, url, env);
      }

      return json({ error: "Not found" }, 404);
    } catch (err) {
      console.error(err);
      return withCors(json({ error: "Server error" }, 500), cors);
    }
  },
};

// ---------------------------------------------------------------------------
// Public
// ---------------------------------------------------------------------------

async function listComments(url, env) {
  const pageId = url.searchParams.get("page") || "";
  if (!validPageId(pageId)) return json({ error: "Invalid page" }, 400);

  const { results } = await env.DB.prepare(
    `SELECT id, parent_id, nickname, content, by_owner, created_at
       FROM comments WHERE page_id = ? AND approved = 1
       ORDER BY created_at ASC`
  ).bind(pageId).all();

  return json({
    comments: results.map((c) => ({
      id: c.id,
      parentId: c.parent_id,
      nickname: c.nickname,
      content: c.content,
      byOwner: !!c.by_owner,
      createdAt: c.created_at,
    })),
  });
}

async function createComment(request, env) {
  const body = await readJson(request);
  if (!body) return json({ error: "Invalid JSON" }, 400);

  const autoApprove = env.AUTO_APPROVE !== "false";

  // Honeypot: real visitors never see this field. Pretend it worked.
  if (body.website) return json({ ok: true, pending: !autoApprove }, 201);

  const pageId = str(body.pageId);
  const nickname = str(body.nickname);
  const email = str(body.email);
  const content = str(body.content);
  const parentId = str(body.parentId) || null;

  if (!validPageId(pageId)) return json({ error: "Invalid page" }, 400);
  if (!nickname || nickname.length > LIMITS.nickname) {
    return json({ error: `Nickname is required (max ${LIMITS.nickname} characters).` }, 400);
  }
  if (!content || content.length > LIMITS.content) {
    return json({ error: `Comment is required (max ${LIMITS.content} characters).` }, 400);
  }
  if (email && (email.length > LIMITS.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
    return json({ error: "That email address doesn't look right." }, 400);
  }

  if (parentId) {
    const parent = await env.DB.prepare(
      "SELECT 1 FROM comments WHERE id = ? AND page_id = ? AND approved = 1"
    ).bind(parentId, pageId).first();
    if (!parent) return json({ error: "The comment you're replying to no longer exists." }, 400);
  }

  const now = Date.now();
  const ipHash = await sha256(
    (request.headers.get("CF-Connecting-IP") || "unknown") + "|" + (env.ADMIN_TOKEN || "")
  );

  const recent = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM comments WHERE ip_hash = ? AND created_at > ?"
  ).bind(ipHash, now - RATE_WINDOW_MS).first();
  if (recent.n >= RATE_MAX) {
    return json({ error: "You're commenting a lot — please try again in a few minutes." }, 429);
  }

  const lastHour = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM comments WHERE created_at > ? AND by_owner = 0"
  ).bind(now - FLOOD_WINDOW_MS).first();
  if (lastHour.n >= FLOOD_MAX) {
    return json({ error: "Comments are temporarily paused. Please try again later." }, 503);
  }

  // Only keep page URLs that point back at an allowed site.
  const pageUrl = str(body.pageUrl);
  const origins = allowedOrigins(env);
  const safeUrl = origins.some((o) => pageUrl.startsWith(o + "/")) ? pageUrl.slice(0, 500) : null;

  await env.DB.prepare(
    `INSERT INTO comments (id, page_id, page_url, page_title, parent_id, nickname, email,
                           content, by_owner, approved, ip_hash, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`
  ).bind(
    crypto.randomUUID(), pageId, safeUrl, str(body.pageTitle).slice(0, LIMITS.pageTitle) || null,
    parentId, nickname, email || null, content, autoApprove ? 1 : 0, ipHash, now
  ).run();

  return json({ ok: true, pending: !autoApprove }, 201);
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

async function handleAdmin(request, url, env) {
  if (url.pathname === "/api/admin/comments" && request.method === "GET") {
    const approved = url.searchParams.get("status") === "approved" ? 1 : 0;
    const { results } = await env.DB.prepare(
      `SELECT c.id, c.page_id, c.page_url, c.page_title, c.parent_id, c.nickname, c.email,
              c.content, c.by_owner, c.created_at,
              p.nickname AS parent_nickname
         FROM comments c LEFT JOIN comments p ON p.id = c.parent_id
        WHERE c.approved = ?
        ORDER BY c.created_at DESC LIMIT 200`
    ).bind(approved).all();
    const counts = await env.DB.prepare(
      "SELECT SUM(approved = 0) AS pending, SUM(approved = 1) AS approved FROM comments"
    ).first();
    return json({
      comments: results,
      counts: { pending: counts.pending || 0, approved: counts.approved || 0 },
      autoApprove: env.AUTO_APPROVE !== "false",
    });
  }

  const match = url.pathname.match(/^\/api\/admin\/comments\/([\w-]+)(?:\/(approve|reply))?$/);
  if (!match) return json({ error: "Not found" }, 404);
  const [, id, action] = match;

  const target = await env.DB.prepare("SELECT * FROM comments WHERE id = ?").bind(id).first();
  if (!target) return json({ error: "Comment not found" }, 404);

  if (action === "approve" && request.method === "POST") {
    await env.DB.prepare("UPDATE comments SET approved = 1 WHERE id = ?").bind(id).run();
    return json({ ok: true });
  }

  if (action === "reply" && request.method === "POST") {
    const body = await readJson(request);
    const content = str(body && body.content);
    if (!content || content.length > LIMITS.content) return json({ error: "Reply is empty or too long." }, 400);
    await env.DB.batch([
      env.DB.prepare("UPDATE comments SET approved = 1 WHERE id = ?").bind(id),
      env.DB.prepare(
        `INSERT INTO comments (id, page_id, page_url, page_title, parent_id, nickname, content,
                               by_owner, approved, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, 1, ?)`
      ).bind(
        crypto.randomUUID(), target.page_id, target.page_url, target.page_title, id,
        env.OWNER_NAME || "Author", content, Date.now()
      ),
    ]);
    return json({ ok: true });
  }

  if (!action && request.method === "DELETE") {
    await env.DB.prepare(
      `WITH RECURSIVE thread(id) AS (
         SELECT ?1
         UNION ALL
         SELECT c.id FROM comments c JOIN thread t ON c.parent_id = t.id
       )
       DELETE FROM comments WHERE id IN (SELECT id FROM thread)`
    ).bind(id).run();
    return json({ ok: true });
  }

  return json({ error: "Not found" }, 404);
}

async function isAdmin(request, env) {
  if (!env.ADMIN_TOKEN) return false;
  const auth = request.headers.get("Authorization") || "";
  const given = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!given) return false;
  // Compare digests so the check is constant-time and length-independent.
  const enc = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(given)),
    crypto.subtle.digest("SHA-256", enc.encode(env.ADMIN_TOKEN)),
  ]);
  return crypto.subtle.timingSafeEqual(a, b);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function allowedOrigins(env) {
  return (env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
}

function corsHeaders(request, env) {
  const origin = request.headers.get("Origin");
  if (!origin || !allowedOrigins(env).includes(origin)) return null;
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function withCors(response, cors) {
  if (cors) for (const [k, v] of Object.entries(cors)) response.headers.set(k, v);
  return response;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function str(value) {
  return typeof value === "string" ? value.trim() : "";
}

function validPageId(id) {
  return !!id && id.length <= LIMITS.pageId && /^[\w./-]+$/.test(id);
}

async function sha256(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
