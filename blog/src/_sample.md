---
title: "Sample Post — Delete or Replace Me"
description: "This is a sample post documenting the front matter and supported Markdown. Set draft: true to hide it from the live site."
date: 2026-10-19
updated: 2026-10-19
tags: [Documentation, Markdown]
featured: false
draft: true
cover: /assets/blog/sample/cover.jpg
---

# Front Matter Fields

| Field | Required | Description |
|-------|----------|-------------|
| `title` | Yes | Post title (shown in listings and on the post page). |
| `description` | Yes | ~150-character summary for SEO and listings. |
| `date` | Yes | Publication date in `YYYY-MM-DD` format. |
| `updated` | No | Last modified date. If omitted, `date` is used. |
| `tags` | No | Array of tags for filtering and related posts. |
| `featured` | No | Set `true` to make this the featured post on the listing page. |
| `draft` | No | Set `true` to exclude from the live site (default: `false`). |
| `cover` | No | Path to a cover image (relative to site root). |

# Supported Markdown

The build script converts a **safe subset** of Markdown to clean HTML:

## Headings

```markdown
# H1 — used only once per post (auto-generated from front matter title)
## H2 — major section
### H3 — subsection
```

Auto-generated `id` attributes from heading text (lowercased, spaces→hyphens).

## Paragraphs & Inline

- **Bold** with `**text**`
- *Italic* with `*text*`
- `Inline code` with backticks
- [Links](https://example.com "optional title")
- `![Alt text](src "caption")` → rendered as `<figure><img…><figcaption>caption</figcaption></figure>` with `loading="lazy"`

## Lists

- Bullet lists with `-` or `*`
- Numbered lists with `1.`
- Nested lists are **not** supported (keep it flat)

## Code Blocks

````markdown
```js
// fenced code block with language class
const hello = "world";
console.log(hello);
```
````

Renders as `<pre><code class="language-js">…</code></pre>` with a **Copy** button.

## Blockquotes

```markdown
> A quoted passage that stands out visually.
```

## Horizontal Rules

```markdown
---
```

## Tables (simple, pipe-separated)

```markdown
| Header 1 | Header 2 |
|----------|----------|
| Cell A   | Cell B   |
| Cell C   | Cell D   |
```

Renders as a horizontally-scrollable table inside its own container.

## What Is NOT Supported

- HTML inside Markdown (escaped for safety)
- Footnotes, definition lists, task lists
- Nested lists
- Math, diagrams, custom containers

# Writing a New Post

1. Create `blog/src/your-slug.md` (slug = filename without `.md`).
2. Fill in the front matter (see table above).
3. Write your content using the supported Markdown above.
4. If you have a cover image, place it at `blog/assets/your-slug/cover.jpg` (or png/webp) and set `cover: /assets/blog/your-slug/cover.jpg`.
5. Run the build: `node scripts/build-blog.js`
6. Commit and push — Vercel will deploy automatically.

# Publishing Checklist

- [ ] `draft: false`
- [ ] `date` is today or in the past
- [ ] `description` is ~150 chars
- [ ] `tags` are relevant (used for filtering & related posts)
- [ ] Cover image exists (if `cover` is set)
- [ ] No future-dated posts (they stay hidden until their date arrives)