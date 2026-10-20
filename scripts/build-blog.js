#!/usr/bin/env node
/* build-blog.js — Zero-dependency static blog generator */

const fs = require('fs');
const path = require('path');

const SITE_URL = 'https://neelamdhiman.vercel.app';
const BLOG_SRC = path.join(__dirname, '../blog/src');
const BLOG_OUT = path.join(__dirname, '../blog');
const TEMPLATE_DIR = path.join(__dirname, '../blog');
const SITEMAP_PATH = path.join(__dirname, '../sitemap.xml');
const INDEX_HTML = path.join(__dirname, '../index.html');

const NOW = new Date();
const TODAY = NOW.toISOString().split('T')[0];

// Markdown to HTML (subset, safe)
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c => {
    if (c === '&') return '&';
    if (c === '<') return '<';
    if (c === '>') return '>';
    if (c === '"') return '"';
    if (c === "'") return "'";
    return c;
  });
}

function slugify(str) {
  return String(str).toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

function parseFrontMatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return { data: {}, body: content };
  const yaml = match[1];
  const body = content.slice(match[0].length).trim();
  const data = {};
  yaml.split('\n').forEach(line => {
    const i = line.indexOf(':');
    if (i === -1) return;
    const key = line.slice(0, i).trim();
    let val = line.slice(i + 1).trim();
    if (val.startsWith('[') && val.endsWith(']')) {
      val = val.slice(1, -1).split(',').map(s => s.trim()).filter(Boolean);
    } else if (val === 'true' || val === 'false') {
      val = val === 'true';
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
      // keep as string
    }
    data[key] = val;
  });
  return { data, body };
}

function mdToHtml(md) {
  let html = escapeHtml(md);
  html = html.replace(/^---$/gm, '<hr>');
  html = html.replace(/^##\s+(.+)$/gm, (_, text) => {
    const id = slugify(text);
    return '<h2 id="' + id + '">' + escapeHtml(text) + '</h2>';
  });
  html = html.replace(/^###\s+(.+)$/gm, (_, text) => {
    const id = slugify(text);
    return '<h3 id="' + id + '">' + escapeHtml(text) + '</h3>';
  });
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    const cls = lang ? ' class="language-' + lang + '"' : '';
    return '<pre><code' + cls + '>' + code.trim() + '</code></pre>';
  });
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  html = html.replace(/!\[([^\]]*)\]\(([^)]+?)(?:\s+"([^"]+)")?\)/g, (_, alt, src, caption) => {
    const cap = caption ? '<figcaption>' + escapeHtml(caption) + '</figcaption>' : '';
    return '<figure><img src="' + escapeHtml(src) + '" alt="' + escapeHtml(alt) + '" loading="lazy">' + cap + '</figure>';
  });
  html = html.replace(/^>\s+(.+)$/gm, '<blockquote>$1</blockquote>');
  html = html.replace(/^\|(.+)\|\n\|[\s\-:|]+\|\n((?:\|.+\|\n?)+)/gm, (_, headerRow, bodyRows) => {
    const headers = headerRow.split('|').slice(1, -1).map(h => '<th>' + escapeHtml(h.trim()) + '</th>').join('');
    const rows = bodyRows.trim().split('\n').map(row => {
      const cells = row.split('|').slice(1, -1).map(c => '<td>' + escapeHtml(c.trim()) + '</td>').join('');
      return '<tr>' + cells + '</tr>';
    }).join('');
    return '<div class="table-wrapper"><table><thead><tr>' + headers + '</tr></thead><tbody>' + rows + '</tbody></table></div>';
  });
  html = html.replace(/^\*\s+(.+)$/gm, '<li>$1</li>');
  html = html.replace(/^\d\.\s+(.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>\n?)+/g, m => '<ul>' + m + '</ul>');
  const lines = html.split('\n');
  const out = [];
  let inPara = false;
  for (const line of lines) {
    const isBlock = /^<(h[23]|ul|ol|li|pre|blockquote|div|table|hr|figure)/.test(line.trim());
    if (line.trim() === '') {
      if (inPara) { out.push('</p>'); inPara = false; }
      out.push('');
    } else if (isBlock) {
      if (inPara) { out.push('</p>'); inPara = false; }
      out.push(line);
    } else {
      if (!inPara) { out.push('<p>'); inPara = true; }
      out.push(line);
    }
  }
  if (inPara) out.push('</p>');
  return out.join('\n');
}

function readingTime(text) {
  const words = text.trim().split(/\s+/).length;
  const mins = Math.max(1, Math.round(words / 200));
  return mins + ' min read';
}

function formatDate(dateStr, locale) {
  locale = locale || 'en-IN';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDateTime(dateStr) {
  return new Date(dateStr + 'T00:00:00').toISOString();
}

// Load posts
function loadPosts() {
  if (!fs.existsSync(BLOG_SRC)) {
    fs.mkdirSync(BLOG_SRC, { recursive: true });
    return [];
  }
  const files = fs.readdirSync(BLOG_SRC).filter(f => f.endsWith('.md') && !f.startsWith('_'));
  const posts = [];
  for (const file of files) {
    const content = fs.readFileSync(path.join(BLOG_SRC, file), 'utf8');
    const { data, body } = parseFrontMatter(content);
    const slug = file.replace(/\.md$/, '');
    if (data.draft === true) continue;
    const postDate = data.date ? new Date(data.date + 'T00:00:00') : null;
    if (postDate && postDate > NOW) continue;
    const html = mdToHtml(body);
    const updated = data.updated || data.date;
    posts.push({
      slug: slug,
      title: data.title || slug,
      description: data.description || '',
      date: data.date,
      updated: updated,
      tags: Array.isArray(data.tags) ? data.tags : [],
      featured: data.featured === true,
      cover: data.cover || null,
      html: html,
      readingTime: readingTime(body),
      dateObj: postDate,
      updatedObj: updated ? new Date(updated + 'T00:00:00') : postDate,
    });
    // Warn if cover file doesn't exist
    if (data.cover) {
      const coverPath = path.join(__dirname, '..', data.cover.replace(/^\//, ''));
      if (!fs.existsSync(coverPath)) {
        console.warn(`  ⚠ Cover file not found: ${data.cover} (expected at ${coverPath})`);
      }
    }
  }
  posts.sort((a, b) => (b.dateObj || 0) - (a.dateObj || 0));
  return posts;
}

// Generate listing page
function generateListing(posts) {
  const featured = posts.find(p => p.featured) || posts[0] || null;
  const latest = posts.slice(0, 3);
  const allTags = [...new Set(posts.flatMap(p => p.tags))].sort();

  let tpl = fs.readFileSync(path.join(TEMPLATE_DIR, 'index.html'), 'utf8');

  let featuredHtml = '';
  if (featured) {
    featuredHtml = '' +
      '<article class="blog-featured reveal">' +
        (featured.cover ? '<div class="blog-featured__cover"><img src="' + featured.cover + '" alt="" loading="lazy"></div>' :
          '<div class="blog-featured__cover blog-featured__cover--placeholder" style="--tag-color: var(--accent)">' + (featured.tags[0] || 'Blog') + '</div>') +
        '<div class="blog-featured__content">' +
          '<span class="blog-featured__tag">' + featured.tags.map(t => '<a href="/blog/?tag=' + encodeURIComponent(t) + '">' + t + '</a>').join(', ') + '</span>' +
          '<h2><a href="/blog/' + featured.slug + '/">' + escapeHtml(featured.title) + '</a></h2>' +
          '<p class="blog-featured__excerpt">' + escapeHtml(featured.description) + '</p>' +
          '<div class="blog-featured__meta">' +
            '<time datetime="' + formatDateTime(featured.date) + '">' + formatDate(featured.date) + '</time>' +
            '<span>' + featured.readingTime + '</span>' +
          '</div>' +
          '<a href="/blog/' + featured.slug + '/" class="btn">Read more</a>' +
        '</div>' +
      '</article>';
  }

  const cardsHtml = posts.map(p => '' +
    '<article class="blog-card reveal reveal-scale">' +
      (p.cover ? '<div class="blog-card__cover"><img src="' + p.cover + '" alt="" loading="lazy"></div>' :
        '<div class="blog-card__cover blog-card__cover--placeholder" style="--tag-color: var(--accent)">' + (p.tags[0] || 'Blog') + '</div>') +
      '<div class="blog-card__content">' +
        '<span class="blog-card__tag">' + p.tags.map(t => '<a href="/blog/?tag=' + encodeURIComponent(t) + '">' + t + '</a>').join(', ') + '</span>' +
        '<h3><a href="/blog/' + p.slug + '/">' + escapeHtml(p.title) + '</a></h3>' +
        '<p class="blog-card__excerpt">' + escapeHtml(p.description) + '</p>' +
        '<div class="blog-card__meta">' +
          '<time datetime="' + formatDateTime(p.date) + '">' + formatDate(p.date) + '</time>' +
          '<span>' + p.readingTime + '</span>' +
        '</div>' +
        '<a href="/blog/' + p.slug + '/" class="blog-card__link" aria-label="Read ' + escapeHtml(p.title) + '"><i data-lucide="arrow-right"></i></a>' +
      '</div>' +
    '</article>').join('');

  const tagChipsHtml = '' +
    '<button class="blog-tag-chip is-active" data-tag="all">All</button>' +
    allTags.map(t => '<button class="blog-tag-chip" data-tag="' + escapeHtml(t) + '">' + escapeHtml(t) + '</button>').join('');

  const toolbarHtml = '' +
    '<div class="blog-toolbar" hidden>' +
      '<label class="blog-search" for="blog-search">' +
        '<i data-lucide="search" aria-hidden="true"></i>' +
        '<input type="search" id="blog-search" placeholder="Search posts…" aria-label="Search posts">' +
      '</label>' +
      '<div class="blog-tags" role="group" aria-label="Filter by tag">' + tagChipsHtml + '</div>' +
    '</div>';

  tpl = tpl.replace('{{FEATURED}}', featuredHtml)
    .replace('{{CARDS}}', cardsHtml)
    .replace('{{TOOLBAR}}', toolbarHtml)
    .replace('{{POST_COUNT}}', String(posts.length))
    .replace('{{LATEST_POSTS}}', latest.map(p => '' +
      '<article class="blog-latest__item">' +
        '<h4><a href="/blog/' + p.slug + '/">' + escapeHtml(p.title) + '</a></h4>' +
        '<time datetime="' + formatDateTime(p.date) + '">' + formatDate(p.date) + '</time>' +
      '</article>').join(''));

  if (posts.length === 0) {
    tpl = tpl.replace('<meta name="robots" content="index, follow">', '<meta name="robots" content="noindex">');
  }

  fs.writeFileSync(path.join(BLOG_OUT, 'index.html'), tpl);
  console.log('  ✓ blog/index.html');
}

// Generate post pages
function generatePosts(posts) {
  const postTpl = fs.readFileSync(path.join(TEMPLATE_DIR, 'post.html'), 'utf8');

  for (const post of posts) {
    const headings = [...post.html.matchAll(/<h([23]) id="([^"]+)">([^<]+)<\/h[23]>/g)].map(m => ({
      level: parseInt(m[1]),
      id: m[2],
      text: m[3]
    }));

    const tocHtml = headings.length >= 3 ? '' +
      '<nav class="blog-toc" aria-label="Table of contents">' +
        '<details open>' +
          '<summary>Table of Contents</summary>' +
          '<ul>' + headings.map(h => '<li><a href="#' + h.id + '" data-level="' + h.level + '">' + escapeHtml(h.text) + '</a></li>').join('') + '</ul>' +
        '</details>' +
      '</nav>' : '';

    const related = posts
      .filter(p => p.slug !== post.slug)
      .sort((a, b) => {
        const aShared = a.tags.filter(t => post.tags.includes(t)).length;
        const bShared = b.tags.filter(t => post.tags.includes(t)).length;
        return bShared - aShared || (b.dateObj || 0) - (a.dateObj || 0);
      })
      .slice(0, 3);

    const idx = posts.indexOf(post);
    const prev = posts[idx + 1] || null;
    const next = posts[idx - 1] || null;

    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: post.title,
      description: post.description,
      image: post.cover || SITE_URL + '/assets/og-image.png',
      datePublished: formatDateTime(post.date),
      dateModified: formatDateTime(post.updated),
      author: { '@type': 'Person', name: 'Neelam Dhiman', url: SITE_URL },
      publisher: { '@type': 'Organization', name: 'Neelam Dhiman', logo: { '@type': 'ImageObject', url: SITE_URL + '/assets/og-image.png' } },
      mainEntityOfPage: { '@type': 'WebPage', '@id': SITE_URL + '/blog/' + post.slug + '/' }
    };

    const breadcrumbLd = {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL + '/' },
        { '@type': 'ListItem', position: 2, name: 'Blog', item: SITE_URL + '/blog/' },
        { '@type': 'ListItem', position: 3, name: post.title, item: SITE_URL + '/blog/' + post.slug + '/' }
      ]
    };

    const outDir = path.join(BLOG_OUT, post.slug);
    fs.mkdirSync(outDir, { recursive: true });

    let html = postTpl
      .replace('{{TITLE}}', escapeHtml(post.title))
      .replace('{{DESCRIPTION}}', escapeHtml(post.description))
      .replace('{{CANONICAL}}', SITE_URL + '/blog/' + post.slug + '/')
      .replace('{{OG_IMAGE}}', post.cover || SITE_URL + '/assets/og-image.png')
      .replace('{{OG_URL}}', SITE_URL + '/blog/' + post.slug + '/')
      .replace('{{DATE}}', formatDate(post.date))
      .replace('{{DATE_ISO}}', formatDateTime(post.date))
      .replace('{{UPDATED}}', post.updated !== post.date ? formatDate(post.updated) : '')
      .replace('{{UPDATED_ISO}}', formatDateTime(post.updated))
      .replace('{{READING_TIME}}', post.readingTime)
      .replace('{{TAGS}}', post.tags.map(t => '<a href="/blog/?tag=' + encodeURIComponent(t) + '">' + escapeHtml(t) + '</a>').join(''))
      .replace('{{COVER}}', post.cover ? '<img src="' + post.cover + '" alt="" class="blog-cover" loading="lazy">' : '')
      .replace('{{TOC}}', tocHtml)
      .replace('{{CONTENT}}', post.html)
      .replace('{{RELATED}}', related.map(r => '' +
        '<article class="blog-related__item">' +
          '<a href="/blog/' + r.slug + '/">' + escapeHtml(r.title) + '</a>' +
          '<time datetime="' + formatDateTime(r.date) + '">' + formatDate(r.date) + '</time>' +
        '</article>').join(''))
      .replace('{{PREV}}', prev ? '<a href="/blog/' + prev.slug + '/" class="blog-nav__link"><i data-lucide="chevron-left"></i> ' + escapeHtml(prev.title) + '</a>' : '')
      .replace('{{NEXT}}', next ? '<a href="/blog/' + next.slug + '/" class="blog-nav__link">' + escapeHtml(next.title) + ' <i data-lucide="chevron-right"></i></a>' : '')
      .replace('{{JSON_LD}}', JSON.stringify(jsonLd))
      .replace('{{BREADCRUMB_LD}}', JSON.stringify(breadcrumbLd))
      .replace('{{SITE_URL}}', SITE_URL);

    fs.writeFileSync(path.join(outDir, 'index.html'), html);
    console.log('  ✓ blog/' + post.slug + '/index.html');
  }
}

// Generate RSS
function generateRss(posts) {
  const items = posts.slice(0, 20).map(p => '' +
    '<item>' +
      '<title>' + escapeHtml(p.title) + '</title>' +
      '<link>' + SITE_URL + '/blog/' + p.slug + '/</link>' +
      '<guid isPermaLink="true">' + SITE_URL + '/blog/' + p.slug + '/</guid>' +
      '<description>' + escapeHtml(p.description) + '</description>' +
      '<pubDate>' + new Date(p.date + 'T00:00:00').toUTCString() + '</pubDate>' +
      p.tags.map(t => '<category>' + escapeHtml(t) + '</category>').join('') +
    '</item>').join('');

  const rss = '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">\n' +
      '<channel>\n' +
        '<title>Neelam Dhiman — Blog</title>\n' +
        '<link>' + SITE_URL + '/blog/</link>\n' +
        '<description>Notes on Web Development, SEO and Building with AI</description>\n' +
        '<language>en-IN</language>\n' +
        '<atom:link href="' + SITE_URL + '/blog/rss.xml" rel="self" type="application/rss+xml" />\n' +
        items +
      '</channel>\n' +
    '</rss>';
  fs.writeFileSync(path.join(BLOG_OUT, 'rss.xml'), rss);
  console.log('  ✓ blog/rss.xml');
}

// Update sitemap.xml - preserve existing non-blog URLs, add blog URLs only when posts exist
function updateSitemap(posts) {
  // Read existing sitemap and extract non-blog URLs to preserve them exactly
  let existingSitemap = '';
  let existingUrls = [];
  if (fs.existsSync(SITEMAP_PATH)) {
    existingSitemap = fs.readFileSync(SITEMAP_PATH, 'utf8');
    // Extract existing URLs with their lastmod, changefreq, priority
    const urlMatches = existingSitemap.matchAll(/<url>\s*<loc>([^<]+)<\/loc>\s*<lastmod>([^<]+)<\/lastmod>\s*<changefreq>([^<]+)<\/changefreq>\s*<priority>([^<]+)<\/priority>\s*<\/url>/g);
    for (const match of urlMatches) {
      const loc = match[1];
      // Keep only non-blog URLs (preserve them exactly as they are)
      if (!loc.includes('/blog/')) {
        existingUrls.push({
          loc: loc,
          lastmod: match[2],
          changefreq: match[3],
          priority: match[4]
        });
      }
    }
  }

  // Build blog URLs only when posts exist
  const blogUrls = [];
  if (posts.length > 0) {
    // Add /blog/ listing page
    blogUrls.push({
      loc: SITE_URL + '/blog/',
      lastmod: TODAY,
      changefreq: 'weekly',
      priority: '0.8'
    });
    // Add each published post
    for (const p of posts) {
      blogUrls.push({
        loc: SITE_URL + '/blog/' + p.slug + '/',
        lastmod: p.updated || p.date,
        changefreq: 'monthly',
        priority: '0.7'
      });
    }
  }

  // Combine: existing non-blog URLs first (preserve order), then blog URLs
  const allUrls = [...existingUrls, ...blogUrls];

  // Build sitemap XML
  let sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n';
  sitemap += '<!--\n';
  sitemap += '  Neelam Dhiman - sitemap\n';
  sitemap += '  Keep <loc> in step with the canonical URL in index.html and the Sitemap:\n';
  sitemap += '  line in robots.txt. All three must name the same origin: the personal\n';
  sitemap += '  Vercel subdomain, never Vercel\'s bare corporate domain, which does not\n';
  sitemap += '  serve this site.\n';
  sitemap += '-->\n';
  sitemap += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
  for (const u of allUrls) {
    sitemap += '  <url>\n';
    sitemap += '    <loc>' + escapeHtml(u.loc) + '</loc>\n';
    sitemap += '    <lastmod>' + u.lastmod + '</lastmod>\n';
    sitemap += '    <changefreq>' + u.changefreq + '</changefreq>\n';
    sitemap += '    <priority>' + u.priority + '</priority>\n';
    sitemap += '  </url>\n';
  }
  sitemap += '</urlset>\n';
  fs.writeFileSync(SITEMAP_PATH, sitemap);
  console.log('  ✓ sitemap.xml updated (idempotent)');
}

// Update index.html with latest posts - validate markers
function updateHomepageLatest(posts) {
  let index = fs.readFileSync(INDEX_HTML, 'utf8');
  const startMarker = '<!-- BLOG:LATEST:START -->';
  const endMarker = '<!-- BLOG:LATEST:END -->';
  const start = index.indexOf(startMarker);
  const end = index.indexOf(endMarker);

  if (start === -1) throw new Error('Missing BLOG:LATEST:START marker in index.html');
  if (end === -1) throw new Error('Missing BLOG:LATEST:END marker in index.html');
  if (start > end) throw new Error('BLOG:LATEST markers out of order in index.html');
  // Check for duplicates
  if (index.indexOf(startMarker, start + 1) !== -1) throw new Error('Duplicate BLOG:LATEST:START marker in index.html');
  if (index.indexOf(endMarker, end + 1) !== -1) throw new Error('Duplicate BLOG:LATEST:END marker in index.html');

  const latest = posts.slice(0, 3);
  let strip = '';
  if (latest.length > 0) {
    strip = '' +
      '<section class="section blog-latest" aria-labelledby="h-blog-latest">\n' +
        '<div class="container">\n' +
          '<span class="journey-eyebrow reveal">Blog</span>\n' +
          '<h2 class="journey-heading reveal reveal-delay-1" id="h-blog-latest">Latest from the Blog</h2>\n' +
          '<div class="blog-latest__grid">\n' +
            latest.map(p => '' +
              '<article class="blog-latest__item reveal reveal-scale">\n' +
                '<h4><a href="/blog/' + p.slug + '/">' + escapeHtml(p.title) + '</a></h4>\n' +
                '<p>' + escapeHtml(p.description) + '</p>\n' +
                '<div class="blog-latest__meta">\n' +
                  '<time datetime="' + formatDateTime(p.date) + '">' + formatDate(p.date) + '</time>\n' +
                  '<span>' + p.readingTime + '</span>\n' +
                '</div>\n' +
              '</article>').join('') +
          '</div>\n' +
          '<p class="blog-latest__cta reveal reveal-delay-2"><a href="/blog/" class="btn">View all posts</a></p>\n' +
        '</div>\n' +
      '</section>';
  }
  index = index.slice(0, start + startMarker.length) + strip + index.slice(end);
  fs.writeFileSync(INDEX_HTML, index);
  console.log('  ✓ index.html updated with latest posts');
}

// Main
async function main() {
  console.log('Building blog...');
  const posts = loadPosts();
  console.log('  Found ' + posts.length + ' published post(s)');

  generateListing(posts);
  generatePosts(posts);
  generateRss(posts);
  updateSitemap(posts);
  updateHomepageLatest(posts);

  console.log('\nBlog build complete!');
}

main().catch(err => {
  console.error('Build failed:', err);
  process.exit(1);
});