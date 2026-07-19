// News / personal updates — newest first. Shown on the home page between
// About and Experience; the section stays hidden while this array is empty.
//
// Each entry: { date: "YYYY-MM-DD", text: "..." }
//   - date  ISO date, used for sorting and the "new" pill (items younger than
//     NEWS_NEW_DAYS in main.js get the pill, then it disappears on its own).
//   - text  Plain text; [label](url) becomes a link.
//
// Examples:
// { date: "2026-09-01", text: "Paper accepted at [EMNLP 2026](https://2026.emnlp.org/)!" },
// { date: "2026-08-15", text: "Started my final year at NTU." },

const NEWS = [
  {
    date: "2026-07-04",
    text: "Launched this site, along with my [blog](/blog/).",
  },
];
