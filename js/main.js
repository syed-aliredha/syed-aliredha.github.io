// ---------------------------------------------------------------------------
// Theme toggle
// ---------------------------------------------------------------------------

const themeToggle = document.getElementById("theme-toggle");

function applyTheme(next) {
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem("theme", next);
}

themeToggle.addEventListener("click", () => {
  const current = document.documentElement.getAttribute("data-theme");
  const next = current === "dark" ? "light" : "dark";

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!document.startViewTransition || reducedMotion) {
    applyTheme(next);
    return;
  }

  // Circular reveal: the new theme expands from the toggle button.
  document.documentElement.classList.add("theme-switching");
  const transition = document.startViewTransition(() => applyTheme(next));

  transition.ready.then(() => {
    const rect = themeToggle.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const radius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y)
    );
    document.documentElement.animate(
      {
        clipPath: [
          `circle(0px at ${x}px ${y}px)`,
          `circle(${radius}px at ${x}px ${y}px)`,
        ],
      },
      {
        duration: 550,
        easing: "cubic-bezier(0.4, 0, 0.2, 1)",
        pseudoElement: "::view-transition-new(root)",
      }
    );
  });

  transition.finished.finally(() => {
    document.documentElement.classList.remove("theme-switching");
  });
});

// ---------------------------------------------------------------------------
// Publications
// ---------------------------------------------------------------------------

const SELF = "Syed Ali Redha Alsagoff";

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function renderPublications() {
  const list = document.getElementById("publication-list");
  if (!list || typeof PUBLICATIONS === "undefined") return;

  list.innerHTML = PUBLICATIONS.map((pub) => {
    const authors = escapeHtml(pub.authors).replace(
      SELF,
      `<strong>${SELF}</strong>`
    );

    const note = pub.note
      ? `<span class="publication-note">${escapeHtml(pub.note)}</span>`
      : "";

    const body = `
      <p class="publication-title">${escapeHtml(pub.title)}</p>
      <p class="publication-authors">${authors}</p>
      <div class="publication-meta">
        <span class="venue-tag">${escapeHtml(pub.venue)}</span>
        ${note}
      </div>
    `;

    // With a paper link, the whole highlighted block is the click target
    const paper = pub.links && pub.links.paper;
    const wrapped = paper
      ? `<a class="publication-body" href="${escapeHtml(paper)}" target="_blank" rel="noopener">${body}</a>`
      : `<div class="publication-body">${body}</div>`;

    return `<li class="publication">${wrapped}</li>`;
  }).join("");
}

renderPublications();

// ---------------------------------------------------------------------------
// Experience timeline
// ---------------------------------------------------------------------------

function renderExperience() {
  const list = document.getElementById("experience-list");
  if (!list || typeof EXPERIENCE === "undefined") return;

  list.innerHTML = EXPERIENCE.map((item) => {
    const org = item.url
      ? `<a href="${escapeHtml(item.url)}" target="_blank" rel="noopener">${escapeHtml(item.org)}</a>`
      : escapeHtml(item.org);

    const tag = item.tag
      ? `<span class="timeline-tag">${escapeHtml(item.tag)}</span>`
      : "";

    const desc = item.desc
      ? `<p class="timeline-desc">${escapeHtml(item.desc)}</p>`
      : "";

    return `
      <li class="timeline-item">
        <div class="timeline-header">
          <p class="timeline-role">${escapeHtml(item.role)}</p>
          ${tag}
        </div>
        <p class="timeline-org">${org}</p>
        <span class="timeline-period">${escapeHtml(item.period)}</span>
        ${desc}
      </li>
    `;
  }).join("");
}

renderExperience();

// ---------------------------------------------------------------------------
// Blog posts — full list on /blog/, latest three on the home page
// ---------------------------------------------------------------------------

// How long items keep their "new" pill, counted from the item's date.
// Blog posts use the publishing date only — later edits don't refresh it.
const POST_NEW_DAYS = 7;
const NEWS_NEW_DAYS = 14;

function isNew(iso, windowDays) {
  const ageDays = (Date.now() - new Date(iso + "T00:00:00")) / 86400000;
  return ageDays >= 0 && ageDays <= windowDays;
}

function newBadge(iso, windowDays) {
  return isNew(iso, windowDays) ? `<span class="new-badge">new</span>` : "";
}

function formatDate(iso) {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-SG", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// A few botanical variants so card placeholders don't all look the same
const SPRIG_SVGS = [
  // fern
  `<svg class="sprig" viewBox="0 0 100 140" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M50 134 C 48 100 52 62 50 10"/>
    <path d="M50 28 C 38 24 30 14 29 4"/><path d="M50 28 C 62 24 70 14 71 4"/>
    <path d="M50 56 C 36 52 27 42 25 30"/><path d="M50 56 C 64 52 73 42 75 30"/>
    <path d="M50 86 C 36 82 26 72 23 58"/><path d="M50 86 C 64 82 74 72 77 58"/>
    <path d="M50 116 C 36 112 25 102 21 86"/><path d="M50 116 C 64 112 75 102 79 86"/>
  </svg>`,
  // leafy branch
  `<svg class="sprig" viewBox="0 0 120 150" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M60 145 C 55 110 68 70 57 8"/>
    <path d="M59 32 C 47 30 39 21 40 10 C 51 12 58 21 59 32 Z"/>
    <path d="M61 54 C 73 52 81 43 81 32 C 70 34 63 43 61 54 Z"/>
    <path d="M60 78 C 47 76 38 67 38 55 C 50 57 58 66 60 78 Z"/>
    <path d="M62 102 C 74 100 83 91 84 79 C 72 81 64 90 62 102 Z"/>
    <path d="M60 126 C 47 124 38 114 37 101 C 49 104 58 113 60 126 Z"/>
  </svg>`,
  // seedling
  `<svg class="sprig" viewBox="0 0 110 120" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M55 116 C 55 92 55 72 55 52"/>
    <path d="M55 52 C 38 50 26 38 25 20 C 44 22 55 34 55 52 Z"/>
    <path d="M55 62 C 70 60 81 50 82 34 C 66 36 56 46 55 62 Z"/>
  </svg>`,
];

function postTags(post) {
  return (post.tags || [])
    .map((t) => `<span class="post-tag">${escapeHtml(t)}</span>`)
    .join("");
}

// Compact row — used for the home page's recent list. The whole row is the
// click target; rows are separated by hairlines.
function postItem(post) {
  return `
    <li class="post-item">
      <a class="post-item-link" href="${escapeHtml(post.url)}">
        <span class="post-date">${formatDate(post.date)}</span>
        <span class="post-title">${escapeHtml(post.title)}${newBadge(post.date, POST_NEW_DAYS)}</span>
        <span class="post-tags">${postTags(post)}</span>
      </a>
    </li>
  `;
}

// Card with image preview — used on the blog index
function postCard(post, index) {
  const sprig = SPRIG_SVGS[index % SPRIG_SVGS.length];
  const visual = post.image
    ? `<img class="post-card-image" src="${escapeHtml(post.image)}" alt="" loading="lazy" />`
    : `<div class="post-card-placeholder">${sprig}</div>`;

  const summary = post.summary
    ? `<p class="post-card-summary">${escapeHtml(post.summary)}</p>`
    : "";

  return `
    <li class="post-card">
      <a href="${escapeHtml(post.url)}">
        ${visual}
        <div class="post-card-body">
          <div class="post-card-meta">
            <span>${formatDate(post.date)}</span>
            <span class="post-minutes" data-url="${escapeHtml(post.url)}"></span>
            ${newBadge(post.date, POST_NEW_DAYS)}
          </div>
          <div class="post-card-tags">${postTags(post)}</div>
          <p class="post-card-title">${escapeHtml(post.title)}</p>
          ${summary}
        </div>
      </a>
    </li>
  `;
}

// Estimated reading time, computed from each post's actual text (~200 wpm)
async function fillReadingTimes() {
  for (const span of document.querySelectorAll(".post-minutes[data-url]")) {
    try {
      const res = await fetch(span.dataset.url);
      const doc = new DOMParser().parseFromString(await res.text(), "text/html");
      const text = doc.querySelector(".post-content")?.textContent || "";
      const words = text.trim().split(/\s+/).length;
      span.textContent = `· ${Math.max(1, Math.round(words / 200))} min read`;
    } catch {
      // leave blank if the post can't be fetched
    }
  }
}

function renderPosts() {
  if (typeof POSTS === "undefined") return;
  const sorted = [...POSTS].sort((a, b) => b.date.localeCompare(a.date));

  // Home page: show the three most recent, un-hide the Writing section.
  const recent = document.getElementById("recent-posts");
  if (recent && sorted.length > 0) {
    recent.innerHTML = sorted.slice(0, 3).map(postItem).join("");
    document.getElementById("writing").hidden = false;
  }

  // Blog page: card grid, or a friendly empty state.
  const all = document.getElementById("all-posts");
  if (all) {
    all.innerHTML =
      sorted.length > 0
        ? sorted.map(postCard).join("")
        : `<li class="empty-note">Nothing here yet — first post coming soon.</li>`;
    fillReadingTimes();
  }
}

renderPosts();

// ---------------------------------------------------------------------------
// News — personal updates on the home page (data lives in js/news.js).
// Hidden while the NEWS array is empty, same pattern as the Writing section.
// ---------------------------------------------------------------------------

// Escapes the text, then turns [label](url) into links.
function linkify(text) {
  return escapeHtml(text).replace(
    /\[([^\]]+)\]\(([^)\s]+)\)/g,
    (_, label, url) =>
      /^(https?:\/\/|\/|#)/.test(url) ? `<a href="${url}">${label}</a>` : label
  );
}

function renderNews() {
  const list = document.getElementById("news-list");
  if (!list || typeof NEWS === "undefined" || NEWS.length === 0) return;

  const sorted = [...NEWS].sort((a, b) => b.date.localeCompare(a.date));
  list.innerHTML = sorted
    .slice(0, 5)
    .map(
      (item) => `
        <li class="news-item">
          <span class="news-date">${formatDate(item.date)}</span>
          <span class="news-text">${linkify(item.text)}${newBadge(item.date, NEWS_NEW_DAYS)}</span>
        </li>
      `
    )
    .join("");
  document.getElementById("news").hidden = false;
}

renderNews();

// ---------------------------------------------------------------------------
// Blog post pages: auto table of contents, built from h2/h3 in .post-content.
// Appears only when a post has 2+ headings — nothing to maintain by hand.
// ---------------------------------------------------------------------------

function buildToc() {
  const content = document.querySelector(".post-content");
  if (!content) return;
  const headings = content.querySelectorAll("h2, h3");
  if (headings.length < 2) return;

  const toc = document.createElement("details");
  toc.className = "toc";
  toc.open = true;
  const summary = document.createElement("summary");
  summary.textContent = "Contents";
  toc.appendChild(summary);

  const list = document.createElement("ul");
  headings.forEach((h) => {
    if (!h.id) {
      h.id = h.textContent
        .trim()
        .toLowerCase()
        .replace(/[^\w]+/g, "-")
        .replace(/(^-|-$)/g, "");
    }
    const li = document.createElement("li");
    if (h.tagName === "H3") li.className = "toc-sub";
    const a = document.createElement("a");
    a.href = "#" + h.id;
    a.textContent = h.textContent;
    li.appendChild(a);
    list.appendChild(li);
  });

  toc.appendChild(list);
  content.parentElement.insertBefore(toc, content);
}

buildToc();

// ---------------------------------------------------------------------------
// Comments — a Cusdis-style thread backed by our own Cloudflare Worker
// (see comments-worker/; moderate at <API>/admin). Commenters can attach
// images/GIFs, and edit or delete their own comments from the same browser.
// The section stays hidden until COMMENTS_API is set.
// ---------------------------------------------------------------------------

const COMMENTS_API = "https://site-comments.syed-aliredha.workers.dev";
const MAX_COMMENT_IMAGES = 4;
const MAX_IMAGE_BYTES = 1800000;
const MAX_IMAGE_SIDE = 1600;

function formatCommentDate(ms) {
  const d = new Date(ms);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function textButton(label, onClick) {
  const button = el("button", "comment-text-button", label);
  button.type = "button";
  button.addEventListener("click", onClick);
  return button;
}

// "commenter" remembers nickname/email; "comment-keys" maps comment id → the
// edit key that lets this browser edit or delete that comment.
const commentStorage = {
  read(key) {
    try { return JSON.parse(localStorage.getItem(key)) || {}; } catch { return {}; }
  },
  write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  },
};

function commentImageUrl(id) {
  return `${COMMENTS_API}/api/images/${id}`;
}

async function postComment(path, body) {
  let res;
  try {
    res = await fetch(`${COMMENTS_API}${path}`, body instanceof FormData
      ? { method: "POST", body }
      : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  } catch {
    throw new Error("Couldn't reach the comment server.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || "Something went wrong. Please try again."), { status: res.status });
  return data;
}

// Photos are downscaled and re-encoded in the browser (which also strips
// location metadata); GIFs are sent untouched so they keep animating.
async function prepareCommentImage(file) {
  if (!file.type.startsWith("image/")) throw new Error("Only images can be attached.");
  if (file.type === "image/gif") {
    if (file.size > MAX_IMAGE_BYTES) throw new Error("GIFs must be under 1.8 MB.");
    return file;
  }

  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("That image format isn't supported — try a JPEG, PNG or GIF.");
  }
  const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const encode = (type) => new Promise((resolve) => canvas.toBlob(resolve, type, 0.85));
  let blob = await encode("image/webp");
  if (!blob || blob.type !== "image/webp") {
    // No WebP encoder (older Safari): JPEG on white, since JPEG has no transparency.
    ctx.globalCompositeOperation = "destination-over";
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    blob = await encode("image/jpeg");
  }
  if (!blob || blob.size > MAX_IMAGE_BYTES) throw new Error("That image is too large.");
  return blob;
}

// Thumbnails + "Add image" for a form: images already on the comment (when
// editing) plus newly picked, pasted or dropped files.
function buildImagePicker(existingIds, report) {
  let kept = [...existingIds];
  let added = [];
  let work = Promise.resolve();

  const previews = el("div", "comment-image-previews");
  const input = Object.assign(document.createElement("input"), {
    type: "file", accept: "image/png,image/jpeg,image/webp,image/gif", multiple: true, hidden: true,
  });
  const addButton = textButton("Add image", () => input.click());

  const thumb = (src, onRemove) => {
    const item = el("div", "comment-image-preview");
    const img = el("img");
    img.src = src;
    img.alt = "";
    const remove = el("button", "comment-image-remove", "×");
    remove.type = "button";
    remove.setAttribute("aria-label", "Remove image");
    remove.addEventListener("click", onRemove);
    item.append(img, remove);
    return item;
  };

  const render = () => {
    previews.replaceChildren(
      ...kept.map((id) => thumb(commentImageUrl(id), () => { kept = kept.filter((k) => k !== id); render(); })),
      ...added.map((a) => thumb(a.url, () => {
        URL.revokeObjectURL(a.url);
        added = added.filter((x) => x !== a);
        render();
      }))
    );
    addButton.hidden = kept.length + added.length >= MAX_COMMENT_IMAGES;
  };

  const add = (files) => {
    work = work.then(async () => {
      for (const file of files) {
        if (kept.length + added.length >= MAX_COMMENT_IMAGES) {
          report(`Up to ${MAX_COMMENT_IMAGES} images per comment.`);
          break;
        }
        try {
          const blob = await prepareCommentImage(file);
          added.push({ blob, url: URL.createObjectURL(blob) });
          render();
        } catch (err) {
          report(err.message);
        }
      }
    });
    return work;
  };

  input.addEventListener("change", () => {
    add([...input.files]);
    input.value = "";
  });

  render();
  return {
    previews,
    addButton,
    input,
    add,
    settled: () => work,
    keptIds: () => kept,
    appendTo(form) {
      added.forEach((a, i) => {
        const ext = a.blob.type.split("/")[1] || "img";
        form.append("images", a.blob, `image-${i + 1}.${ext}`);
      });
      kept.forEach((id) => form.append("keepImages", id));
    },
    isEmpty: () => kept.length + added.length === 0,
    reset() {
      added.forEach((a) => URL.revokeObjectURL(a.url));
      kept = [];
      added = [];
      render();
    },
  };
}

// Paste or drop images straight into a form.
function acceptImageDrops(form, textarea, picker) {
  const imagesIn = (list) => [...(list || [])].filter((f) => f.type.startsWith("image/"));
  textarea.addEventListener("paste", (event) => {
    const files = imagesIn(event.clipboardData && event.clipboardData.files);
    if (files.length) {
      event.preventDefault();
      picker.add(files);
    }
  });
  form.addEventListener("dragover", (event) => {
    if ([...event.dataTransfer.types].includes("Files")) {
      event.preventDefault();
      form.classList.add("is-dropping");
    }
  });
  form.addEventListener("dragleave", (event) => {
    if (!form.contains(event.relatedTarget)) form.classList.remove("is-dropping");
  });
  form.addEventListener("drop", (event) => {
    form.classList.remove("is-dropping");
    const files = imagesIn(event.dataTransfer && event.dataTransfer.files);
    if (files.length) {
      event.preventDefault();
      picker.add(files);
    }
  });
}

function statusLine() {
  const status = el("p", "comment-status");
  status.setAttribute("role", "status");
  status.show = (message, isError) => {
    status.textContent = message;
    status.classList.toggle("is-error", !!isError);
  };
  return status;
}

let commentFieldId = 0;

function createCommentThread(thread) {
  const list = el("div", "comment-list");

  function buildCommentForm(parentId) {
    const saved = commentStorage.read("commenter");
    const uid = ++commentFieldId;
    const form = el("form", "comment-form");
    form.noValidate = true;

    const field = (label, control) => {
      const wrap = el("div", "comment-field");
      const lab = el("label", "", label);
      control.id = `comment-${control.name}-${uid}`;
      lab.htmlFor = control.id;
      wrap.append(lab, control);
      return wrap;
    };

    const nickname = Object.assign(document.createElement("input"), {
      name: "nickname", type: "text", maxLength: 60, autocomplete: "nickname", value: saved.nickname || "",
    });
    const email = Object.assign(document.createElement("input"), {
      name: "email", type: "email", maxLength: 200, autocomplete: "email", value: saved.email || "",
    });
    const content = Object.assign(document.createElement("textarea"), {
      name: "content", maxLength: 5000,
    });
    // Honeypot — hidden from people, filled in by naive spam bots.
    const website = Object.assign(document.createElement("input"), {
      name: "website", type: "text", tabIndex: -1, autocomplete: "off", className: "comment-hp",
    });
    website.setAttribute("aria-hidden", "true");

    const status = statusLine();
    const picker = buildImagePicker([], (message) => status.show(message, true));
    acceptImageDrops(form, content, picker);

    const names = el("div", "comment-form-names");
    names.append(field("Nickname", nickname), field("Email (optional)", email));

    const button = el("button", "comment-submit", "Comment");
    button.type = "submit";
    const actions = el("div", "comment-form-actions");
    actions.append(button, picker.addButton);

    form.append(names, field("Reply...", content), picker.previews, picker.input, website, actions, status);

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      button.disabled = true;
      await picker.settled();
      if (!nickname.value.trim() || (!content.value.trim() && picker.isEmpty())) {
        status.show("Please add a nickname and a comment or image.", true);
        button.disabled = false;
        return;
      }

      button.textContent = "Sending...";
      status.show("");
      commentStorage.write("commenter", { nickname: nickname.value.trim(), email: email.value.trim() });

      const body = new FormData();
      Object.entries({
        pageId: thread.dataset.pageId,
        pageUrl: location.origin + location.pathname,
        pageTitle: thread.dataset.pageTitle || document.title,
        parentId: parentId || "",
        nickname: nickname.value,
        email: email.value,
        content: content.value,
        website: website.value,
      }).forEach(([key, value]) => body.append(key, value));
      picker.appendTo(body);

      try {
        const data = await postComment("/api/comments", body);
        if (data.id && data.editKey) {
          const keys = commentStorage.read("comment-keys");
          keys[data.id] = data.editKey;
          commentStorage.write("comment-keys", keys);
        }
        content.value = "";
        picker.reset();
        if (data.pending) {
          status.show("Your comment has been sent. Please wait for approval.");
        } else {
          status.show(parentId ? "" : "Your comment has been posted.");
          await load();
        }
      } catch (err) {
        status.show(err.message, true);
      } finally {
        button.disabled = false;
        button.textContent = "Comment";
      }
    });

    return form;
  }

  function buildEditForm(comment, editKey, onCancel) {
    const form = el("form", "comment-form comment-edit-form");
    form.noValidate = true;
    const content = Object.assign(document.createElement("textarea"), {
      name: "content", maxLength: 5000, value: comment.content,
    });
    content.setAttribute("aria-label", "Edit your comment");
    const status = statusLine();
    const picker = buildImagePicker(comment.images, (message) => status.show(message, true));
    acceptImageDrops(form, content, picker);

    const save = el("button", "comment-submit", "Save");
    save.type = "submit";
    const actions = el("div", "comment-form-actions");
    actions.append(save, picker.addButton, textButton("Cancel", onCancel));

    const wrap = el("div", "comment-field");
    wrap.append(content);
    form.append(wrap, picker.previews, picker.input, actions, status);

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      save.disabled = true;
      await picker.settled();
      if (!content.value.trim() && picker.isEmpty()) {
        status.show("A comment needs some text or an image.", true);
        save.disabled = false;
        return;
      }
      save.textContent = "Saving...";
      const body = new FormData();
      body.append("editKey", editKey);
      body.append("content", content.value);
      picker.appendTo(body);
      try {
        await postComment(`/api/comments/${comment.id}/edit`, body);
        await load();
      } catch (err) {
        status.show(err.message, true);
        save.disabled = false;
        save.textContent = "Save";
      }
    });

    return form;
  }

  function buildComment(comment) {
    const node = el("div", "comment");
    const replies = comment.replies.map(buildComment).filter(Boolean);

    // A deleted comment only stays (as a placeholder) if replies hang off it.
    if (comment.deleted) {
      if (!replies.length) return null;
      node.append(el("p", "comment-deleted", "This comment was deleted."), ...replies);
      return node;
    }

    const head = el("div", "comment-head");
    head.append(el("span", "comment-author", comment.nickname));
    if (comment.byOwner) head.append(el("span", "comment-badge", "Author"));

    const meta = el("div", "comment-date");
    const time = el("time", "", formatCommentDate(comment.createdAt));
    time.dateTime = new Date(comment.createdAt).toISOString();
    meta.append(time);
    if (comment.editedAt) {
      const edited = el("span", "comment-edited", " · edited");
      edited.title = `Edited ${formatCommentDate(comment.editedAt)}`;
      meta.append(edited);
    }

    const content = el("div", "comment-content");
    if (comment.content) content.append(el("div", "comment-body", comment.content));
    if (comment.images.length) {
      const gallery = el("div", "comment-images");
      comment.images.forEach((id) => {
        const link = el("a", "comment-image");
        link.href = commentImageUrl(id);
        link.target = "_blank";
        link.rel = "noopener";
        const img = el("img");
        img.src = commentImageUrl(id);
        img.alt = `Image from ${comment.nickname}`;
        img.loading = "lazy";
        link.append(img);
        gallery.append(link);
      });
      content.append(gallery);
    }

    const actions = el("div", "comment-actions");
    let replyForm = null;
    actions.append(textButton("Reply", () => {
      if (replyForm) {
        replyForm.remove();
        replyForm = null;
        return;
      }
      replyForm = el("div", "comment-reply-form");
      replyForm.append(buildCommentForm(comment.id));
      actions.after(replyForm);
      replyForm.querySelector("input").focus();
    }));

    const editKey = commentStorage.read("comment-keys")[comment.id];
    if (editKey) {
      actions.append(
        textButton("Edit", () => {
          const form = buildEditForm(comment, editKey, () => {
            form.replaceWith(content);
            actions.hidden = false;
          });
          content.replaceWith(form);
          actions.hidden = true;
          form.querySelector("textarea").focus();
        }),
        textButton("Delete", async () => {
          if (!confirm("Delete your comment?")) return;
          try {
            await postComment(`/api/comments/${comment.id}/delete`, { editKey });
          } catch (err) {
            if (err.status !== 404) return alert(err.message);
          }
          const keys = commentStorage.read("comment-keys");
          delete keys[comment.id];
          commentStorage.write("comment-keys", keys);
          await load();
        })
      );
    }

    node.append(head, meta, content, ...replies, actions);
    return node;
  }

  async function load() {
    if (!list.querySelector(".comment")) list.replaceChildren(el("p", "comment-empty", "Loading..."));
    try {
      const page = encodeURIComponent(thread.dataset.pageId);
      const res = await fetch(`${COMMENTS_API}/api/comments?page=${page}`);
      if (!res.ok) throw new Error();
      const { comments } = await res.json();

      // Oldest first, so the conversation reads down towards the form.
      const byId = new Map(comments.map((c) => [c.id, { images: [], ...c, replies: [] }]));
      const roots = [];
      byId.forEach((c) => {
        if (!c.parentId) roots.push(c);
        else if (byId.has(c.parentId)) byId.get(c.parentId).replies.push(c);
      });

      list.replaceChildren(...roots.map(buildComment).filter(Boolean));
    } catch {
      list.replaceChildren(el("p", "comment-empty", "Couldn't load comments right now."));
    }
  }

  thread.replaceChildren(list, buildCommentForm(null));
  load();
}

function initComments() {
  const thread = document.getElementById("comments");
  if (!thread) return;

  if (!COMMENTS_API) {
    thread.closest(".comments-section").hidden = true;
    return;
  }

  createCommentThread(thread);
}

initComments();
