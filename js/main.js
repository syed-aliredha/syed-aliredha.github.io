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

function postItem(post) {
  const tags = (post.tags || [])
    .map((t) => `<span class="post-tag">${escapeHtml(t)}</span>`)
    .join("");
  return `
    <li class="post-item">
      <span class="post-date">${formatDate(post.date)}</span>
      <a class="post-title" href="${escapeHtml(post.url)}">${escapeHtml(post.title)}</a>
      <span class="post-tags">${tags}</span>
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

  // Blog page: show everything, or a friendly empty state.
  const all = document.getElementById("all-posts");
  if (all) {
    all.innerHTML =
      sorted.length > 0
        ? sorted.map(postItem).join("")
        : `<li class="empty-note">Nothing here yet — first post coming soon.</li>`;
  }
}

renderPosts();
