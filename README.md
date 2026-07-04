# syed-aliredha.github.io

Personal academic site — hand-written HTML/CSS/JS, no framework, no build step.
Live at **https://syed-aliredha.github.io**.

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
