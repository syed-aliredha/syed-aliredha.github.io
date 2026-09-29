// Comments backend for syed-aliredha.github.io — a tiny, self-hosted stand-in
// for Cusdis. Cloudflare Worker + D1 (SQLite).
//
// Public API (CORS-limited to ALLOWED_ORIGINS):
//   GET  /api/comments?page=<pageId>     comments for a page (+ image ids)
//   POST /api/comments                   new comment, JSON or multipart with `images`
//                                        → { id, editKey }; published straight away,
//                                        or held for approval if AUTO_APPROVE = "false"
//   POST /api/comments/:id/edit          commenter edits their own comment (editKey)
//   POST /api/comments/:id/delete        commenter deletes their own comment (editKey)
//   GET  /api/images/:id                 an image attached to a visible comment
//
// Moderation (Bearer ADMIN_TOKEN, same-origin only):
//   GET    /admin                        moderation page
//   GET    /api/admin/comments?status=approved|pending
//   GET    /api/admin/comments/:id/history
//   POST   /api/admin/comments/:id/approve
//   POST   /api/admin/comments/:id/reply    { content }  (also approves :id)
//   POST   /api/admin/comments/:id/edit     { content }
//   POST   /api/admin/comments/:id/restore  (undo a commenter's delete)
//   DELETE /api/admin/comments/:id          permanently, with replies, images and history
//   GET    /api/admin/images/:id            any image, including removed ones
//   DELETE /api/admin/images/:id            permanently

import ADMIN_HTML from "./admin.html";

const LIMITS = { nickname: 60, email: 200, content: 5000, pageId: 200, pageTitle: 200 };
const MAX_IMAGES = 4;                  // per comment
const MAX_IMAGE_BYTES = 1_800_000;     // D1 rows top out at 2 MB
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX = 5;                    // new comments per IP per window
const RATE_MAX_IMAGES = 12;            // image uploads per IP per window
const FLOOD_WINDOW_MS = 60 * 60 * 1000;
const FLOOD_MAX = 60;                  // comments per hour across the whole site
const FLOOD_MAX_IMAGE_BYTES = 100_000_000; // image bytes per hour across the whole site

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

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

      if (url.pathname.startsWith("/api/admin/")) {
        if (!(await isAdmin(request, env))) return json({ error: "Unauthorized" }, 401);
        return await handleAdmin(request, url, env);
      }

      const image = url.pathname.match(/^\/api\/images\/([\w-]+)$/);
      if (image && request.method === "GET") {
        const row = await env.DB.prepare(
          `SELECT i.mime, i.data FROM images i JOIN comments c ON c.id = i.comment_id
            WHERE i.id = ? AND i.removed_at IS NULL AND c.deleted_at IS NULL AND c.approved = 1`
        ).bind(image[1]).first();
        return row ? imageResponse(row, "public, max-age=86400") : json({ error: "Not found" }, 404);
      }

      if (url.pathname === "/api/comments" && request.method === "GET") {
        return withCors(await listComments(url, env), cors);
      }

      if (url.pathname.startsWith("/api/comments") && request.method === "POST") {
        if (!cors) return json({ error: "Origin not allowed" }, 403);
        if (url.pathname === "/api/comments") return withCors(await createComment(request, env), cors);
        const own = url.pathname.match(/^\/api\/comments\/([\w-]+)\/(edit|delete)$/);
        if (own) return withCors(await changeOwnComment(request, env, own[1], own[2]), cors);
      }

      return json({ error: "Not found" }, 404);
    } catch (err) {
      if (err instanceof HttpError) return withCors(json({ error: err.message }, err.status), cors);
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

  const [{ results: comments }, { results: images }] = await env.DB.batch([
    env.DB.prepare(
      `SELECT id, parent_id, nickname, content, by_owner, created_at, edited_at, deleted_at
         FROM comments WHERE page_id = ? AND approved = 1
         ORDER BY created_at ASC`
    ).bind(pageId),
    env.DB.prepare(
      `SELECT i.id, i.comment_id FROM images i JOIN comments c ON c.id = i.comment_id
        WHERE c.page_id = ? AND c.approved = 1 AND c.deleted_at IS NULL AND i.removed_at IS NULL
        ORDER BY i.position`
    ).bind(pageId),
  ]);

  const imagesByComment = groupImages(images);

  return json({
    comments: comments.map((c) =>
      // Deleted comments stay as bare placeholders so their replies keep a parent.
      c.deleted_at
        ? { id: c.id, parentId: c.parent_id, deleted: true, createdAt: c.created_at }
        : {
            id: c.id,
            parentId: c.parent_id,
            nickname: c.nickname,
            content: c.content,
            images: imagesByComment.get(c.id) || [],
            byOwner: !!c.by_owner,
            createdAt: c.created_at,
            editedAt: c.edited_at,
          }
    ),
  });
}

async function createComment(request, env) {
  const { fields, files } = await readInput(request);
  const autoApprove = env.AUTO_APPROVE !== "false";

  // Honeypot: real visitors never see this field. Pretend it worked.
  if (fields.website) return json({ ok: true, pending: !autoApprove }, 201);

  const pageId = str(fields.pageId);
  const nickname = str(fields.nickname);
  const email = str(fields.email);
  const content = str(fields.content);
  const parentId = str(fields.parentId) || null;

  if (!validPageId(pageId)) throw new HttpError(400, "Invalid page");
  if (!nickname || nickname.length > LIMITS.nickname) {
    throw new HttpError(400, `Nickname is required (max ${LIMITS.nickname} characters).`);
  }
  if (email && (email.length > LIMITS.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
    throw new HttpError(400, "That email address doesn't look right.");
  }
  checkContent(content);
  const images = await readImages(files);
  if (!content && !images.length) throw new HttpError(400, "Write something or add an image.");

  if (parentId) {
    const parent = await env.DB.prepare(
      "SELECT 1 FROM comments WHERE id = ? AND page_id = ? AND approved = 1 AND deleted_at IS NULL"
    ).bind(parentId, pageId).first();
    if (!parent) throw new HttpError(400, "The comment you're replying to no longer exists.");
  }

  const now = Date.now();
  const ipHash = await hashIp(request, env);
  await checkLimits(env, ipHash, now, { newComment: true, images });

  // Only keep page URLs that point back at an allowed site.
  const pageUrl = str(fields.pageUrl);
  const safeUrl = allowedOrigins(env).some((o) => pageUrl.startsWith(o + "/")) ? pageUrl.slice(0, 500) : null;

  const id = crypto.randomUUID();
  const editKey = randomHex(32);

  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO comments (id, page_id, page_url, page_title, parent_id, nickname, email, content,
                             by_owner, approved, ip_hash, created_at, edit_key_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)`
    ).bind(
      id, pageId, safeUrl, str(fields.pageTitle).slice(0, LIMITS.pageTitle) || null, parentId,
      nickname, email || null, content, autoApprove ? 1 : 0, ipHash, now, await sha256(editKey)
    ),
    ...insertImages(env, id, images, 0, ipHash, now),
  ]);

  return json({ ok: true, pending: !autoApprove, id, editKey }, 201);
}

// Commenters prove a comment is theirs with the edit key their browser got
// when they posted it. Every change snapshots the old version for /admin.
async function changeOwnComment(request, env, id, action) {
  const input = await readInput(request);
  const comment = await env.DB.prepare("SELECT * FROM comments WHERE id = ?").bind(id).first();
  const key = str(input.fields.editKey);
  if (!comment || comment.deleted_at) throw new HttpError(404, "That comment no longer exists.");
  if (!key || !comment.edit_key_hash || (await sha256(key)) !== comment.edit_key_hash) {
    throw new HttpError(403, "You can only change comments posted from this browser.");
  }

  const now = Date.now();
  const current = await currentImageIds(env, id);
  const snapshot = revision(env, id, action, "author", comment.content, current, now);

  if (action === "delete") {
    await env.DB.batch([
      snapshot,
      env.DB.prepare("UPDATE comments SET deleted_at = ?, deleted_by = 'author' WHERE id = ?").bind(now, id),
    ]);
    return json({ ok: true });
  }

  const content = str(input.fields.content);
  checkContent(content);
  const keep = current.filter((imageId) => input.keepImages.includes(imageId));
  const added = await readImages(input.files);
  if (keep.length + added.length > MAX_IMAGES) throw new HttpError(400, `Up to ${MAX_IMAGES} images per comment.`);
  if (!content && !keep.length && !added.length) throw new HttpError(400, "Write something or add an image.");

  const ipHash = await hashIp(request, env);
  if (added.length) await checkLimits(env, ipHash, now, { images: added });

  const lastPosition = await env.DB.prepare(
    "SELECT COALESCE(MAX(position), -1) AS p FROM images WHERE comment_id = ?"
  ).bind(id).first();

  await env.DB.batch([
    snapshot,
    env.DB.prepare("UPDATE comments SET content = ?, edited_at = ? WHERE id = ?").bind(content, now, id),
    ...current
      .filter((imageId) => !keep.includes(imageId))
      .map((imageId) => env.DB.prepare("UPDATE images SET removed_at = ? WHERE id = ?").bind(now, imageId)),
    ...insertImages(env, id, added, lastPosition.p + 1, ipHash, now),
  ]);
  return json({ ok: true });
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

async function handleAdmin(request, url, env) {
  if (url.pathname === "/api/admin/comments" && request.method === "GET") {
    const approved = url.searchParams.get("status") === "pending" ? 0 : 1;
    const [{ results: comments }, { results: images }, { results: [counts] }] = await env.DB.batch([
      env.DB.prepare(
        `SELECT c.id, c.page_id, c.page_url, c.page_title, c.parent_id, c.nickname, c.email,
                c.content, c.by_owner, c.created_at, c.edited_at, c.deleted_at,
                c.edit_key_hash IS NOT NULL AS has_key,
                p.nickname AS parent_nickname,
                (SELECT COUNT(*) FROM revisions r WHERE r.comment_id = c.id) AS revision_count
           FROM comments c LEFT JOIN comments p ON p.id = c.parent_id
          WHERE c.approved = ?
          ORDER BY c.created_at DESC LIMIT 200`
      ).bind(approved),
      env.DB.prepare(
        `SELECT i.id, i.comment_id FROM images i JOIN comments c ON c.id = i.comment_id
          WHERE c.approved = ? AND i.removed_at IS NULL ORDER BY i.position`
      ).bind(approved),
      env.DB.prepare(
        "SELECT SUM(approved = 0) AS pending, SUM(approved = 1) AS approved FROM comments"
      ),
    ]);
    const imagesByComment = groupImages(images);
    return json({
      comments: comments.map((c) => ({ ...c, images: imagesByComment.get(c.id) || [] })),
      counts: { pending: counts.pending || 0, approved: counts.approved || 0 },
      autoApprove: env.AUTO_APPROVE !== "false",
    });
  }

  const image = url.pathname.match(/^\/api\/admin\/images\/([\w-]+)$/);
  if (image) {
    if (request.method === "GET") {
      const row = await env.DB.prepare("SELECT mime, data FROM images WHERE id = ?").bind(image[1]).first();
      return row ? imageResponse(row, "private, max-age=3600") : json({ error: "Not found" }, 404);
    }
    if (request.method === "DELETE") {
      await env.DB.prepare("DELETE FROM images WHERE id = ?").bind(image[1]).run();
      return json({ ok: true });
    }
  }

  const match = url.pathname.match(/^\/api\/admin\/comments\/([\w-]+)(?:\/(approve|reply|edit|restore|history))?$/);
  if (!match) return json({ error: "Not found" }, 404);
  const [, id, action] = match;

  const target = await env.DB.prepare("SELECT * FROM comments WHERE id = ?").bind(id).first();
  if (!target) return json({ error: "Comment not found" }, 404);
  const now = Date.now();

  if (action === "history" && request.method === "GET") {
    const { results } = await env.DB.prepare(
      "SELECT action, actor, content, image_ids, created_at FROM revisions WHERE comment_id = ? ORDER BY created_at DESC"
    ).bind(id).all();
    return json({
      revisions: results.map((r) => ({ ...r, image_ids: JSON.parse(r.image_ids) })),
    });
  }

  if (action === "approve" && request.method === "POST") {
    await env.DB.prepare("UPDATE comments SET approved = 1 WHERE id = ?").bind(id).run();
    return json({ ok: true });
  }

  if (action === "reply" && request.method === "POST") {
    const { fields } = await readInput(request);
    const content = str(fields.content);
    if (!content) throw new HttpError(400, "Reply is empty.");
    checkContent(content);
    await env.DB.batch([
      env.DB.prepare("UPDATE comments SET approved = 1 WHERE id = ?").bind(id),
      env.DB.prepare(
        `INSERT INTO comments (id, page_id, page_url, page_title, parent_id, nickname, content,
                               by_owner, approved, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, 1, ?)`
      ).bind(
        crypto.randomUUID(), target.page_id, target.page_url, target.page_title, id,
        env.OWNER_NAME || "Author", content, now
      ),
    ]);
    return json({ ok: true });
  }

  if (action === "edit" && request.method === "POST") {
    const { fields } = await readInput(request);
    const content = str(fields.content);
    checkContent(content);
    const current = await currentImageIds(env, id);
    if (!content && !current.length) throw new HttpError(400, "A comment needs some text or an image.");
    await env.DB.batch([
      revision(env, id, "edit", "owner", target.content, current, now),
      env.DB.prepare("UPDATE comments SET content = ?, edited_at = ? WHERE id = ?").bind(content, now, id),
    ]);
    return json({ ok: true });
  }

  if (action === "restore" && request.method === "POST") {
    await env.DB.batch([
      revision(env, id, "restore", "owner", target.content, await currentImageIds(env, id), now),
      env.DB.prepare("UPDATE comments SET deleted_at = NULL, deleted_by = NULL WHERE id = ?").bind(id),
    ]);
    return json({ ok: true });
  }

  if (!action && request.method === "DELETE") {
    const thread = `WITH RECURSIVE thread(id) AS (
                      SELECT ?1
                      UNION ALL
                      SELECT c.id FROM comments c JOIN thread t ON c.parent_id = t.id
                    )`;
    await env.DB.batch([
      env.DB.prepare(`${thread} DELETE FROM images WHERE comment_id IN (SELECT id FROM thread)`).bind(id),
      env.DB.prepare(`${thread} DELETE FROM revisions WHERE comment_id IN (SELECT id FROM thread)`).bind(id),
      env.DB.prepare(`${thread} DELETE FROM comments WHERE id IN (SELECT id FROM thread)`).bind(id),
    ]);
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
// Images & limits
// ---------------------------------------------------------------------------

async function readImages(files) {
  if (files.length > MAX_IMAGES) throw new HttpError(400, `Up to ${MAX_IMAGES} images per comment.`);
  const images = [];
  for (const file of files) {
    if (file.size > MAX_IMAGE_BYTES) {
      throw new HttpError(400, `Images must be under ${MAX_IMAGE_BYTES / 1e6} MB.`);
    }
    const data = new Uint8Array(await file.arrayBuffer());
    const mime = sniffImage(data); // trust the bytes, not the browser's label
    if (!mime) throw new HttpError(400, "Only JPEG, PNG, WebP and GIF images are supported.");
    images.push({ data, mime });
  }
  return images;
}

function sniffImage(b) {
  const ascii = (start, end) => String.fromCharCode(...b.subarray(start, end));
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x89 && ascii(1, 4) === "PNG") return "image/png";
  if (ascii(0, 6) === "GIF87a" || ascii(0, 6) === "GIF89a") return "image/gif";
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  return null;
}

function insertImages(env, commentId, images, firstPosition, ipHash, now) {
  return images.map((image, i) =>
    env.DB.prepare(
      `INSERT INTO images (id, comment_id, position, mime, size, data, ip_hash, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      crypto.randomUUID(), commentId, firstPosition + i, image.mime, image.data.byteLength,
      image.data, ipHash, now
    )
  );
}

function imageResponse(row, cacheControl) {
  return new Response(new Uint8Array(row.data), {
    headers: {
      "Content-Type": row.mime,
      "Cache-Control": cacheControl,
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'",
      "Cross-Origin-Resource-Policy": "cross-origin",
    },
  });
}

async function currentImageIds(env, commentId) {
  const { results } = await env.DB.prepare(
    "SELECT id FROM images WHERE comment_id = ? AND removed_at IS NULL ORDER BY position"
  ).bind(commentId).all();
  return results.map((r) => r.id);
}

function groupImages(rows) {
  const byComment = new Map();
  for (const row of rows) {
    if (!byComment.has(row.comment_id)) byComment.set(row.comment_id, []);
    byComment.get(row.comment_id).push(row.id);
  }
  return byComment;
}

function revision(env, commentId, action, actor, content, imageIds, now) {
  return env.DB.prepare(
    `INSERT INTO revisions (comment_id, action, actor, content, image_ids, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(commentId, action, actor, content, JSON.stringify(imageIds), now);
}

async function checkLimits(env, ipHash, now, { newComment = false, images = [] }) {
  const since = now - RATE_WINDOW_MS;
  const hourAgo = now - FLOOD_WINDOW_MS;
  const [{ results: [mine] }, { results: [site] }] = await env.DB.batch([
    env.DB.prepare(
      `SELECT (SELECT COUNT(*) FROM comments WHERE ip_hash = ?1 AND created_at > ?2) AS comments,
              (SELECT COUNT(*) FROM images WHERE ip_hash = ?1 AND created_at > ?2) AS images`
    ).bind(ipHash, since),
    env.DB.prepare(
      `SELECT (SELECT COUNT(*) FROM comments WHERE created_at > ?1 AND by_owner = 0) AS comments,
              (SELECT COALESCE(SUM(size), 0) FROM images WHERE created_at > ?1) AS image_bytes`
    ).bind(hourAgo),
  ]);

  const bytes = images.reduce((sum, image) => sum + image.data.byteLength, 0);
  if ((newComment && mine.comments >= RATE_MAX) || mine.images + images.length > RATE_MAX_IMAGES) {
    throw new HttpError(429, "You're commenting a lot — please try again in a few minutes.");
  }
  if ((newComment && site.comments >= FLOOD_MAX) || site.image_bytes + bytes > FLOOD_MAX_IMAGE_BYTES) {
    throw new HttpError(503, "Comments are temporarily paused. Please try again later.");
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function readInput(request) {
  const type = request.headers.get("Content-Type") || "";
  const maxBytes = MAX_IMAGES * MAX_IMAGE_BYTES + 100_000;
  if (Number(request.headers.get("Content-Length") || 0) > maxBytes) {
    throw new HttpError(413, "That upload is too large.");
  }
  try {
    if (type.includes("multipart/form-data")) {
      const form = await request.formData();
      const fields = {};
      for (const [key, value] of form.entries()) {
        if (typeof value === "string" && !(key in fields)) fields[key] = value;
      }
      return {
        fields,
        files: form.getAll("images").filter((f) => typeof f !== "string" && f.size > 0),
        keepImages: form.getAll("keepImages").filter((v) => typeof v === "string"),
      };
    }
    const body = await request.json();
    if (!body || typeof body !== "object") throw new Error();
    const keep = Array.isArray(body.keepImages) ? body.keepImages.filter((v) => typeof v === "string") : [];
    return { fields: body, files: [], keepImages: keep };
  } catch {
    throw new HttpError(400, "Invalid request body");
  }
}

function checkContent(content) {
  if (content.length > LIMITS.content) {
    throw new HttpError(400, `Comments can be at most ${LIMITS.content} characters.`);
  }
}

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

function str(value) {
  return typeof value === "string" ? value.trim() : "";
}

function validPageId(id) {
  return !!id && id.length <= LIMITS.pageId && /^[\w./-]+$/.test(id);
}

async function hashIp(request, env) {
  return sha256((request.headers.get("CF-Connecting-IP") || "unknown") + "|" + (env.ADMIN_TOKEN || ""));
}

function randomHex(bytes) {
  return [...crypto.getRandomValues(new Uint8Array(bytes))]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function sha256(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
