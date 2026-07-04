// TEMP: favicon variant switcher — click the swatches (bottom-right) and watch
// the browser tab icon change. Delete this file and its <script> tags once a
// variant is chosen, then bake the winner into assets/favicon.svg.

(function () {
  const A = (fill) =>
    `<path ${fill} fill-rule="evenodd" d="M43.3 13 L56.7 13 L92 92 L60.1 92 L50 70.2 L39.9 92 L8 92 Z M50 39.9 L61.8 76.9 L38.2 76.9 Z"/>`;

  const wrap = (inner, vb) =>
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb || "0 0 100 100"}">${inner}</svg>`;

  const adaptive = (light, dark) =>
    wrap(`<style>.a{fill:${light}}@media(prefers-color-scheme:dark){.a{fill:${dark}}}</style>${A('class="a"')}`);

  const adaptiveDot = (aL, dL, aD, dD) =>
    wrap(
      `<style>.a{fill:${aL}}.d{fill:${dL}}@media(prefers-color-scheme:dark){.a{fill:${aD}}.d{fill:${dD}}}</style>` +
        `${A('class="a"')}<circle class="d" cx="106" cy="83" r="9"/>`,
      "0 0 118 100"
    );

  const tile = wrap(
    `<rect width="100" height="100" rx="22" fill="#b45309"/><g transform="translate(50 52) scale(0.74) translate(-50 -52.5)">${A('fill="#faf6ee"')}</g>`
  );

  const VARIANTS = [
    { id: "mono",  label: "Warm mono",   svg: adaptive("#17140f", "#f4efe4"), chip: "#17140f" },
    { id: "split", label: "Split accent", svg: adaptive("#b45309", "#2fbdb0"), chip: "#b45309" },
    { id: "amber", label: "Always amber", svg: wrap(A('fill="#c2620f"')), chip: "#c2620f" },
    { id: "teal",  label: "Always teal",  svg: wrap(A('fill="#0f766e"')), chip: "#0f766e" },
    { id: "dot",   label: "Ink + dot",    svg: adaptiveDot("#17140f", "#b45309", "#f4efe4", "#2fbdb0"), chip: "#17140f" },
    { id: "tile",  label: "Amber tile",   svg: tile, chip: "#b45309" },
  ];

  const link = document.getElementById("favicon");
  if (!link) return;

  function apply(id) {
    const v = VARIANTS.find((x) => x.id === id) || VARIANTS[0];
    link.href = "data:image/svg+xml," + encodeURIComponent(v.svg);
    localStorage.setItem("favicon-preview", v.id);
    label.textContent = v.label;
    bar.querySelectorAll("button").forEach((b) => {
      b.style.outline = b.dataset.id === v.id ? "2px solid currentColor" : "none";
    });
  }

  const bar = document.createElement("div");
  bar.style.cssText =
    "position:fixed;bottom:1.25rem;right:1.25rem;z-index:20;display:flex;align-items:center;gap:.5rem;" +
    "padding:.5rem .85rem;border:1px solid var(--border);border-radius:999px;background:var(--bg-subtle);" +
    "box-shadow:0 4px 16px rgba(0,0,0,.12);font-size:.78rem;color:var(--text-muted)";

  const label = document.createElement("span");
  bar.appendChild(label);

  VARIANTS.forEach((v) => {
    const btn = document.createElement("button");
    btn.dataset.id = v.id;
    btn.title = v.label;
    btn.style.cssText =
      "width:1.6rem;height:1.6rem;border-radius:6px;border:1px solid var(--border);cursor:pointer;" +
      "padding:2px;background:#faf9f6;display:flex;align-items:center;justify-content:center";
    btn.innerHTML = v.svg.replace("<svg ", '<svg width="16" height="16" ');
    btn.addEventListener("click", () => apply(v.id));
    bar.appendChild(btn);
  });

  document.body.appendChild(bar);
  apply(localStorage.getItem("favicon-preview") || "mono");
})();
