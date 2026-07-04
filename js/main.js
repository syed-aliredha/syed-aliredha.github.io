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

    const links = Object.entries(pub.links || {})
      .map(
        ([label, url]) =>
          `<a href="${escapeHtml(url)}" target="_blank" rel="noopener">${escapeHtml(label)}</a>`
      )
      .join("");

    return `
      <li class="publication">
        <p class="publication-title">${escapeHtml(pub.title)}</p>
        <p class="publication-authors">${authors}</p>
        <div class="publication-meta">
          <span class="venue-tag">${escapeHtml(pub.venue)}</span>
          ${note}
          <span class="publication-links">${links}</span>
        </div>
      </li>
    `;
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

// Compact row — used for the home page's recent list
function postItem(post) {
  return `
    <li class="post-item">
      <span class="post-date">${formatDate(post.date)}</span>
      <a class="post-title" href="${escapeHtml(post.url)}">${escapeHtml(post.title)}</a>
      <span class="post-tags">${postTags(post)}</span>
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

  const hashtags = (post.tags || [])
    .map((t) => `<span class="post-hash">#${escapeHtml(t.toLowerCase())}</span>`)
    .join("");

  return `
    <li class="post-card">
      <a href="${escapeHtml(post.url)}">
        ${visual}
        <div class="post-card-body">
          <div class="post-card-meta">
            <span>${formatDate(post.date)}</span>
            <span class="post-minutes" data-url="${escapeHtml(post.url)}"></span>
            ${hashtags}
          </div>
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
// Comments (Cusdis) — hidden until a real App ID is configured; theme follows
// the site's light/dark toggle.
// ---------------------------------------------------------------------------

function initComments() {
  const thread = document.getElementById("cusdis_thread");
  if (!thread) return;

  if (thread.dataset.appId === "YOUR_CUSDIS_APP_ID") {
    thread.closest(".comments-section").hidden = true;
    return;
  }

  const currentTheme = () => document.documentElement.getAttribute("data-theme");
  thread.dataset.theme = currentTheme();

  new MutationObserver(() => {
    if (window.CUSDIS) window.CUSDIS.setTheme(currentTheme());
  }).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
}

initComments();
