# syed-aliredha.github.io

Personal academic site — hand-written HTML/CSS/JS, no framework, no build step.
Live at **https://syed-aliredha.github.io**.

## TODO
- [ ] **Tag search/filter on the blog** — once there are enough posts to warrant it, add click-to-filter on the card tags (all data is already in `js/posts.js`).

## Where everything lives

| Content | File | Format |
|---|---|---|
| Bio / about text, subtitle | `index.html` (the `<section id="about">` block) | HTML |
| Experience timeline | `js/experience.js` | JS objects |
| Publications | `js/publications.js` | JS objects |
| Blog post list (cards) | `js/posts.js` | JS objects |
| Blog post pages | `blog/<slug>.html` | HTML |
| Profile photo | `assets/photo.jpg` (≈square, ≥400×400) | image |
| Colors, fonts, spacing | `css/style.css` (token block at the top) | CSS |

## Add a blog post

1. Copy the template: `cp blog/_post-template.html blog/my-post.html`
2. Edit it — replace every `EDIT:` marker (title, date, tags, content). Plain HTML;
   headings (`<h2>`/`<h3>`), lists, images, and blockquotes are pre-styled.
   A table of contents appears automatically once a post has 2+ headings.
3. Optional cover image: drop it at `assets/blog/my-post.jpg`
4. Add an entry to the top of the array in `js/posts.js`:

   ```js
   {
     title: "My post title",
     date: "2026-08-01",                 // ISO date — used for sorting
     url: "/blog/my-post.html",
     image: "/assets/blog/my-post.jpg",  // omit for a plant placeholder
     tags: ["LLM"],
     summary: "One-line teaser shown on the card.",
   },
   ```

The blog page and the home "Writing" section update themselves.

## Add / edit experience

Add an object to the top of the array in `js/experience.js` (newest first):

```js
{
  role: "Research Intern",
  org: "Some Lab",
  url: "https://somelab.example",        // optional — makes the org a link
  period: "Jan 2027 — Jun 2027",
  tag: "Internship",                     // pill label: Research / Internship / Education…
  desc: "One or two sentences on what you did.",  // optional
},
```

## Add / edit publications

Same idea in `js/publications.js`:

```js
{
  title: "Paper title",
  authors: "A. Author, Syed Ali Redha Alsagoff, B. Author",  // your name is auto-bolded
  venue: "ACL 2027",                     // shown as the accent pill
  note: "Main conference",               // optional smaller text next to it
  year: 2027,
  links: { paper: "https://arxiv.org/…", code: "https://github.com/…" },  // each optional
},
```

## Comments

Blog comments are self-hosted: a small Cloudflare Worker + D1 database in
`comments-worker/` (free tier), with a Cusdis-style widget rendered by `js/main.js`.
Comments appear immediately; delete unwanted ones at `<worker-url>/admin`
(set `AUTO_APPROVE = "false"` in `comments-worker/wrangler.toml` to hold them for approval instead).
The comments section stays hidden until `COMMENTS_API` in `js/main.js` is set.

Each post needs a unique `data-page-id` on its `<div id="comments">` (use the file slug).

**One-time setup** (needs Node 22+ — `node -v`; on older Node, prefix the wrangler
commands with `npx -p node@22`):

```bash
cd comments-worker
npm install
npx wrangler login                    # free Cloudflare account
npx wrangler d1 create site-comments  # paste the printed database_id into wrangler.toml
npm run db:init                       # create the table
npx wrangler secret put ADMIN_TOKEN   # paste a long random string, e.g. from: openssl rand -hex 24
npm run deploy                        # prints https://site-comments.<you>.workers.dev
```

Then set `COMMENTS_API` in `js/main.js` to that URL, bump `main.js?v=` in the pages,
and push. Sign in to `<worker-url>/admin` with your `ADMIN_TOKEN`.

**Local dev:** put `ADMIN_TOKEN=anything` in `comments-worker/.dev.vars`, run
`npm run db:init:local && npm run dev`, and temporarily point `COMMENTS_API` at
`http://127.0.0.1:8787`.

## Preview and publish

```bash
# preview locally
python3 -m http.server 4173     # then open http://localhost:4173

# publish
git add -A && git commit -m "…" && git push
```

The site deploys automatically on push (1–2 min). If the Actions run fails with
"Deployment failed, try again later", it's a GitHub-side flake — hit *Re-run failed
jobs* on the run, or push again; the site keeps serving the last good deploy meanwhile.

**Cache rule:** after editing `css/style.css` or any `js/*.js`, bump that file's
`?v=` number in the HTML pages that reference it (e.g. `style.css?v=5` → `?v=6`)
so browsers fetch the new copy. HTML-only edits don't need this.
