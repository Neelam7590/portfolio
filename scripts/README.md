# Blog Build Script — Publishing Guide

## Overview

The blog is generated from Markdown files in `blog/src/` using a zero-dependency Node.js script (`scripts/build-blog.js`). The script outputs:

- `blog/index.html` — listing page with featured post, grid, search & tag filters
- `blog/<slug>/index.html` — individual post pages (clean URLs)
- `blog/rss.xml` — RSS 2.0 feed
- Updates `sitemap.xml` with blog URLs
- Injects latest 3 posts into homepage between `<!-- BLOG:LATEST:START -->` and `<!-- BLOG:LATEST:END -->`

---

## Writing a New Post

### 1. Create the Markdown file

```
blog/src/your-post-slug.md
```

The filename (without `.md`) becomes the URL slug: `/blog/your-post-slug/`

### 2. Add front matter (required fields marked *)

```yaml
---
title: "Your Post Title"           # *
description: "~150 chars for SEO"  # *
date: 2026-10-20                   # * (YYYY-MM-DD)
updated: 2026-10-21                # optional; last modified date
tags: [SEO, Web Development]       # optional; used for filtering & related posts
featured: false                    # optional; true = featured on listing page
draft: false                       # optional; true = hidden from live site
cover: /assets/blog/your-post-slug/cover.jpg  # optional; cover image path
---
```

### 3. Write content using supported Markdown

See `blog/src/_sample.md` for full documentation. Supported:

- `## H2`, `### H3` headings (auto IDs)
- Paragraphs, **bold**, *italic*, `inline code`
- Bullet (`-`) and numbered (`1.`) lists
- Fenced code blocks with language: ````js ... ````
- Links `[text](url)` and images `![alt](src "caption")` → `<figure>`
- Blockquotes `> quote`
- Horizontal rules `---`
- Simple tables (pipe-separated)

### 4. Add cover image (optional)

Place at `blog/assets/your-post-slug/cover.jpg` (or `.png`, `.webp`) and reference in front matter:

```yaml
cover: /assets/blog/your-post-slug/cover.jpg
```

---

## Building & Publishing

### Local build

```bash
node scripts/build-blog.js
```

Output:
```
📝 Building blog…
  Found 3 published post(s)
  ✓ blog/index.html
  ✓ blog/your-post-slug/index.html
  ✓ blog/rss.xml
  ✓ sitemap.xml updated
  ✓ index.html updated with latest posts
  ✓ index.html nav updated
  ✓ faq.html nav updated
  ✓ sync-footer.js executed
✅ Blog build complete!
```

### Publish

```bash
git add blog/ scripts/ index.html faq.html sitemap.xml
git commit -m "blog: add 'your-post-title' post"
git push
```

Vercel auto-deploys on push to `main`.

---

## How It Works

### Draft & Future Posts

- `draft: true` → excluded from build entirely
- `date` in the future → excluded until that date arrives (scheduled publishing)

### Featured Post

- The post with `featured: true` becomes the large hero card on `/blog/`
- If none, the newest post is used

### Related Posts

- Up to 3 shown at bottom of each post
- Prioritized by shared tags, then by recency

### Previous / Next Links

- Automatically generated from chronological order

### SEO

Each post page includes:
- Unique `<title>`, meta description, canonical
- Open Graph + Twitter cards
- `article:published_time`, `article:modified_time`
- `og:image` = cover or fallback to `/assets/og-image.png`
- JSON-LD `BlogPosting` + `BreadcrumbList`
- RSS autodiscovery `<link rel="alternate">`

Listing page includes:
- JSON-LD `Blog` + `BreadcrumbList`

### Sitemap

- `/blog/` added only when ≥1 published post exists
- Each post uses `updated` (or `date`) for `<lastmod>`
- Existing non-blog URLs preserved exactly

---

## Updating an Existing Post

1. Edit `blog/src/your-post-slug.md`
2. Update `updated:` field in front matter to today
3. Run `node scripts/build-blog.js`
4. Commit & push

---

## Deleting a Post

1. Delete `blog/src/your-post-slug.md`
2. Optionally delete `blog/assets/your-post-slug/`
3. Run build, commit, push

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Post not appearing | Check `draft: false`, `date` ≤ today, front matter YAML valid |
| Cover not showing | Verify file exists at `blog/assets/slug/cover.jpg` and path matches front matter |
| Build errors | Run `node --check scripts/build-blog.js` to validate syntax |
| Styles not loading | Ensure `blog/blog.css` and `blog/blog.js` exist and are linked in templates |
| Search/filter not working | Verify `blog/blog.js` loads after DOM ready; check console for errors |

---

## File Structure

```
blog/
├── src/
│   ├── _sample.md          # documentation (draft: true)
│   └── your-post.md        # your posts
├── assets/
│   └── your-post/          # cover images
│       └── cover.jpg
├── index.html              # listing page (generated)
├── post.html               # post template (used by build script)
├── blog.css                # blog-only styles
├── blog.js                 # blog-only JS
├── rss.xml                 # generated
└── <slug>/
    └── index.html          # generated post pages

scripts/
├── build-blog.js           # build script
├── README.md               # this file
└── sync-footer.js          # optional footer sync (if used)
```