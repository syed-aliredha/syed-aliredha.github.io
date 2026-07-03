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
