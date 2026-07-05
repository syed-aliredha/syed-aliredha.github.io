// Blog posts — newest first. To publish a post:
//   1. Copy blog/_post-template.html to blog/<slug>.html and write your post
//      (the template has step-by-step instructions at the top).
//   2. Optional: drop a cover image at assets/blog/<slug>.jpg
//   3. Add an entry here. The blog page shows a card grid (image, title,
//      summary); the home page shows the three most recent. The home
//      "Writing" section stays hidden while this array is empty.
//
// Example:
// {
//   title: "What creativity benchmarks miss about LLMs",
//   date: "2026-08-01",                          // ISO date, used for sorting
//   url: "/blog/creativity-benchmarks.html",
//   image: "/assets/blog/creativity-benchmarks.jpg", // omit → sprig placeholder
//   tags: ["LLM", "Evaluation"],
//   summary: "One-line teaser shown on the card.",
// },

const POSTS = [
  {
    title: "Hello, World",
    date: "2026-07-04",
    url: "/blog/hello-world.html",
    image: "/assets/blog/hello-world.jpg",
    tags: ["meta"],
    summary: "What this blog is for, and the kinds of posts to expect.",
  },
];
