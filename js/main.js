// ---------------------------------------------------------------------------
// Theme toggle
// ---------------------------------------------------------------------------

const themeToggle = document.getElementById("theme-toggle");

themeToggle.addEventListener("click", () => {
  const current = document.documentElement.getAttribute("data-theme");
  const next = current === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem("theme", next);
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

const SPRIG_SVG = `
  <svg class="sprig" viewBox="0 0 100 140" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M50 134 C 48 100 52 62 50 10"/>
    <path d="M50 28 C 38 24 30 14 29 4"/><path d="M50 28 C 62 24 70 14 71 4"/>
    <path d="M50 56 C 36 52 27 42 25 30"/><path d="M50 56 C 64 52 73 42 75 30"/>
    <path d="M50 86 C 36 82 26 72 23 58"/><path d="M50 86 C 64 82 74 72 77 58"/>
    <path d="M50 116 C 36 112 25 102 21 86"/><path d="M50 116 C 64 112 75 102 79 86"/>
  </svg>
`;

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
function postCard(post) {
  const visual = post.image
    ? `<img class="post-card-image" src="${escapeHtml(post.image)}" alt="" loading="lazy" />`
    : `<div class="post-card-placeholder">${SPRIG_SVG}</div>`;

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
            ${postTags(post)}
          </div>
          <p class="post-card-title">${escapeHtml(post.title)}</p>
          ${summary}
        </div>
      </a>
    </li>
  `;
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
  }
}

renderPosts();
