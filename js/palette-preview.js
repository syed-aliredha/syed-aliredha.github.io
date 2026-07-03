// TEMP: floating accent-palette switcher for previewing color options.
// Delete this file (and its <script> tag in index.html, plus the TEMP block
// in css/style.css) once a palette is chosen.

(function () {
  const PALETTES = [
    { id: "teal", label: "Deep teal", swatch: "#0f766e" },
    { id: "indigo", label: "Indigo", swatch: "#4f46e5" },
    { id: "amber", label: "Burnt amber", swatch: "#b45309" },
    { id: "crimson", label: "Crimson", swatch: "#be123c" },
    { id: "clay", label: "Clay (Anthropic)", swatch: "#cc785c" },
  ];

  const root = document.documentElement;
  const saved = localStorage.getItem("accent-preview") || "teal";
  if (saved !== "teal") root.setAttribute("data-accent", saved);

  const bar = document.createElement("div");
  bar.className = "palette-preview";

  const label = document.createElement("span");
  bar.appendChild(label);

  PALETTES.forEach((p) => {
    const btn = document.createElement("button");
    btn.style.background = p.swatch;
    btn.title = p.label;
    btn.dataset.palette = p.id;
    btn.addEventListener("click", () => select(p.id));
    bar.appendChild(btn);
  });

  function select(id) {
    if (id === "teal") {
      root.removeAttribute("data-accent");
    } else {
      root.setAttribute("data-accent", id);
    }
    localStorage.setItem("accent-preview", id);
    const active = PALETTES.find((p) => p.id === id);
    label.textContent = active.label;
    bar.querySelectorAll("button").forEach((b) => {
      b.classList.toggle("active", b.dataset.palette === id);
    });
  }

  document.body.appendChild(bar);
  select(saved);
})();
