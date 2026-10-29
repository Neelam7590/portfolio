#!/usr/bin/env node
/*
  Zero-dependency seed generator for the portfolio admin.

  Reads the current project data from script.js and the current copy from
  index.html, then writes tools/seed.sql. It never executes script.js as a
  whole: only the projects/words array literals are extracted and evaluated
  inside an empty node:vm context.
*/
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const SCRIPT_PATH = path.join(ROOT, "script.js");
const INDEX_PATH = path.join(ROOT, "index.html");
const OUTPUT_PATH = path.join(__dirname, "seed.sql");
const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const BUTTON_LABELS = new Set(["Visit Website", "Try Now", "View on GitHub"]);

function fail(message) {
  console.error("Seed error: " + message);
  process.exit(1);
}

function read(file) {
  try {
    return fs.readFileSync(file, "utf8");
  } catch (error) {
    fail("could not read " + path.relative(ROOT, file) + ": " + error.message);
  }
}

function decodeEntities(value) {
  return String(value)
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;/g, "'")
    .replace(/&#x0*27;/gi, "'")
    .replace(/&nbsp;/g, " ");
}

function text(value) {
  return decodeEntities(String(value).replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function extractArrayLiteral(source, name) {
  const declaration = new RegExp("(?:const|let|var)\\s+" + name + "\\s*=\\s*\\[");
  const match = declaration.exec(source);
  if (!match) fail("could not find the " + name + " array in script.js");

  const start = match.index + match[0].lastIndexOf("[");
  let depth = 0;
  let quote = "";
  let escaped = false;
  let lineComment = false;
  let blockComment = false;

  for (let i = start; i < source.length; i += 1) {
    const char = source[i];
    const next = source[i + 1];

    if (lineComment) {
      if (char === "\n") lineComment = false;
      continue;
    }
    if (blockComment) {
      if (char === "*" && next === "/") {
        blockComment = false;
        i += 1;
      }
      continue;
    }
    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === quote) {
        quote = "";
      }
      continue;
    }
    if (char === "/" && next === "/") {
      lineComment = true;
      i += 1;
      continue;
    }
    if (char === "/" && next === "*") {
      blockComment = true;
      i += 1;
      continue;
    }
    if (char === '"' || char === "'" || char === "`") {
      quote = char;
      continue;
    }
    if (char === "[" || char === "{") {
      depth += 1;
      continue;
    }
    if (char === "]" || char === "}") {
      depth -= 1;
      if (depth === 0) {
        if (char !== "]") fail(name + " literal did not end with ]");
        return source.slice(start, i + 1);
      }
    }
  }

  fail("could not find the end of the " + name + " array");
}

function evaluateLiteral(source, name) {
  const literal = extractArrayLiteral(source, name);
  const sandbox = Object.create(null);
  const context = vm.createContext(sandbox, {
    codeGeneration: { strings: false, wasm: false },
  });
  let value;
  try {
    value = vm.runInContext("(" + literal + ")", context, { timeout: 1000 });
  } catch (error) {
    fail("could not evaluate the " + name + " array: " + error.message);
  }
  if (!Array.isArray(value)) fail(name + " is not an array");
  return value;
}

function extractClassText(html, tag, className) {
  const pattern = new RegExp(
    "<" + tag + "\\b[^>]*class=\"" + className + "[^\"]*\"[^>]*>([\\s\\S]*?)</" + tag + ">",
    "i"
  );
  const match = pattern.exec(html);
  if (!match) fail("could not find ." + className + " in index.html");
  return text(match[1]);
}

function parseProjects(projects) {
  if (projects.length !== 7) fail("expected 7 projects, found " + projects.length);

  return projects.map((project, index) => {
    if (!project || typeof project !== "object") fail("project " + (index + 1) + " is not an object");
    const slug = String(project.slug || "").trim();
    if (!SLUG_RE.test(slug)) fail("invalid project slug: " + slug);
    if (!String(project.title || "").trim()) fail("project " + slug + " has no title");
    if (!String(project.description || "").trim()) fail("project " + slug + " has no description");

    const images = (project.images || []).map((source, imageIndex) => {
      const url = "/" + String(source).replace(/^\/+/, "");
      return { url, alt: project.title + " screenshot " + (imageIndex + 1) };
    });
    if (!images.length) fail("project " + slug + " has no screenshots");

    const buttons = Array.isArray(project.buttons) ? project.buttons : [];
    const primary = buttons.find((button) => button.style === "primary") || buttons[0] || {};
    const buttonLabel = String(primary.label || "");
    if (!BUTTON_LABELS.has(buttonLabel)) fail("unexpected button label for " + slug + ": " + buttonLabel);
    if (!/^https:\/\//i.test(String(primary.url || ""))) {
      fail("primary button URL for " + slug + " must start with https://");
    }

    let liveUrl = "";
    let codeUrl = "";
    buttons.forEach((button) => {
      const url = String(button.url || "").trim();
      const label = String(button.label || "");
      if (!/^https:\/\//i.test(url)) fail("button URL for " + slug + " must start with https://");
      if (/github|code/i.test(label)) codeUrl = codeUrl || url;
      else liveUrl = liveUrl || url;
    });
    if (!liveUrl && buttonLabel !== "View on GitHub") liveUrl = String(primary.url || "");
    if (!codeUrl && buttonLabel === "View on GitHub") codeUrl = String(primary.url || "");

    return {
      slug,
      title: String(project.title),
      description: String(project.description),
      seo_description: String(project.description),
      live_url: liveUrl,
      code_url: codeUrl,
      button_label: buttonLabel,
      tags: (project.stack || []).map(String),
      images,
      sort_order: (index + 1) * 10,
    };
  });
}

function parseTools(html) {
  const tools = [];
  const itemRe = /<li\b[^>]*class="skill-item[^"]*"[^>]*>([\s\S]*?)<\/li>/gi;
  let match;
  while ((match = itemRe.exec(html))) {
    const block = match[1];
    const nameMatch = /<span[^>]*class="skill-item__name"[^>]*>([\s\S]*?)<\/span>/i.exec(block);
    if (!nameMatch) continue;
    const iconMatch = /<span[^>]*class="skill-item__icon"[^>]*>([\s\S]*?)<\/span>/i.exec(block);
    const imageMatch = iconMatch ? /<img\b[^>]*\bsrc="([^"]+)"/i.exec(iconMatch[1]) : null;
    tools.push({
      name: text(nameMatch[1]),
      logo_url: imageMatch ? imageMatch[1] : null,
      sort_order: (tools.length + 1) * 10,
    });
  }
  if (tools.length !== 9) fail("expected 9 tools, found " + tools.length);
  return tools;
}

function parseStats(html) {
  const stats = [];
  const statRe = /<div\b[^>]*class="skill-stat[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;
  let match;
  while ((match = statRe.exec(html))) {
    const block = match[1];
    const valueMatch = /<span[^>]*class="skill-stat__number"[^>]*>([\s\S]*?)<\/span>/i.exec(block);
    const labelMatch = /<span[^>]*class="skill-stat__label"[^>]*>([\s\S]*?)<\/span>/i.exec(block);
    if (!valueMatch || !labelMatch) continue;
    stats.push({
      value: text(valueMatch[1]),
      label: text(labelMatch[1]),
      sort_order: (stats.length + 1) * 10,
    });
  }
  if (stats.length !== 3) fail("expected 3 stats, found " + stats.length);
  return stats;
}

function parseHero(html, roles) {
  return {
    subtitle: roles[0],
    paragraph: extractClassText(html, "p", "hero-about"),
    skills_line: extractClassText(html, "p", "hero-skills"),
    roles: roles.slice(),
  };
}

function parseSocial(html) {
  const social = {};
  const linkRe = /<a\b([^>]*)>/gi;
  let match;
  while ((match = linkRe.exec(html))) {
    const attrs = match[1];
    if (!/\bclass="[^"]*\bsocial-link\b/i.test(attrs)) continue;
    const hrefMatch = /\bhref="([^"]+)"/i.exec(attrs);
    if (!hrefMatch) continue;
    const href = hrefMatch[1];
    if (/github\.com/i.test(href) && !social.github) social.github = href;
    else if (/linkedin\.com/i.test(href) && !social.linkedin) social.linkedin = href;
  }
  if (!social.github || !social.linkedin) fail("could not find both social links");
  return social;
}

function parseProfileImages(html) {
  const avatarMatch = /<div\b[^>]*class="hero-avatar"[^>]*>([\s\S]*?)<\/div>/i.exec(html);
  if (!avatarMatch) fail("could not find the hero avatar");
  const block = avatarMatch[1];
  const altMatch = /<img\b[^>]*\balt="([^"]*)"/i.exec(block);
  if (!altMatch) fail("could not read the hero image alt text");

  const webp400 = /\/assets\/[A-Za-z0-9._/-]+-400\.webp/i.exec(block);
  const webp800 = /\/assets\/[A-Za-z0-9._/-]+-800\.webp/i.exec(block);
  const jpg800 = /\/assets\/[A-Za-z0-9._/-]+-800\.jpg/i.exec(block);
  if (!webp400 || !webp800 || !jpg800) fail("could not read the profile image paths");

  return {
    profile: {
      webp400: webp400[0],
      webp800: webp800[0],
      jpg800: jpg800[0],
      alt: decodeEntities(altMatch[1]),
    },
  };
}

function makeDollarQuoter() {
  let index = 0;
  return function quote(value) {
    const string = String(value);
    let tag;
    do {
      index += 1;
      tag = "$seed_" + String(index).padStart(4, "0") + "$";
    } while (string.includes(tag));
    return tag + string + tag;
  };
}

function sqlValue(value, quote, cast) {
  return value === null || value === undefined || value === ""
    ? "null" + (cast || "")
    : quote(value) + (cast || "");
}

const scriptSource = read(SCRIPT_PATH);
const indexSource = read(INDEX_PATH);

const rawProjects = evaluateLiteral(scriptSource, "projects");
const roles = evaluateLiteral(scriptSource, "words").map(String);
const projects = parseProjects(rawProjects);
const tools = parseTools(indexSource);
const stats = parseStats(indexSource);
const hero = parseHero(indexSource, roles);
const social = parseSocial(indexSource);
const vision = { paragraph: extractClassText(indexSource, "p", "vision-text") };
const images = parseProfileImages(indexSource);

if (JSON.stringify(social).toLowerCase().includes("mailto:")) fail("email link must not be seeded");

const quote = makeDollarQuoter();
const screenshotCount = projects.reduce((total, project) => total + project.images.length, 0);

const projectRows = projects
  .map((project) => {
    const tags = project.tags.map((tag) => quote(tag)).join(", ");
    return (
      "  (" +
      [
        quote(project.slug),
        quote(project.title),
        quote(project.description),
        quote(project.seo_description),
        sqlValue(project.live_url, quote, "::text"),
        sqlValue(project.code_url, quote, "::text"),
        quote(project.button_label),
        "array[" + tags + "]::text[]",
        quote(JSON.stringify(project.images)) + "::jsonb",
        String(project.sort_order),
        "true",
      ].join(", ") +
      ")"
    );
  })
  .join(",\n");

const toolRows = tools
  .map((tool) => {
    return (
      "  (" +
      [
        quote(tool.name),
        sqlValue(tool.logo_url, quote, "::text"),
        String(tool.sort_order),
      ].join(", ") +
      ")"
    );
  })
  .join(",\n");

const statRows = stats
  .map((stat) => {
    return "  (" + [quote(stat.value), quote(stat.label), String(stat.sort_order)].join(", ") + ")";
  })
  .join(",\n");

const settings = [
  ["hero", hero],
  ["social", social],
  ["vision", vision],
  ["images", images],
];

const settingRows = settings
  .map(([key, value]) => {
    return "  (" + quote(key) + ", " + quote(JSON.stringify(value)) + "::jsonb)";
  })
  .join(",\n");

const sql = `-- Generated by tools/make-seed.js from the current site content.
-- Safe to run more than once: each table insert only runs while that table is
-- empty, and each settings key is inserted only while that key is missing.
-- Contains no email address, phone number, secret key or deploy hook URL.
begin;

insert into public.projects
  (slug, title, description, seo_description, live_url, code_url, button_label, tags, images, sort_order, is_visible)
select
  v.slug, v.title, v.description, v.seo_description, v.live_url, v.code_url,
  v.button_label, v.tags, v.images, v.sort_order, true
from (values
${projectRows}
) as v(slug, title, description, seo_description, live_url, code_url, button_label, tags, images, sort_order)
where not exists (select 1 from public.projects);

insert into public.tools (name, logo_url, sort_order)
select v.name, v.logo_url, v.sort_order
from (values
${toolRows}
) as v(name, logo_url, sort_order)
where not exists (select 1 from public.tools);

insert into public.stats (value, label, sort_order)
select v.value, v.label, v.sort_order
from (values
${statRows}
) as v(value, label, sort_order)
where not exists (select 1 from public.stats);

insert into public.site_settings (key, value, updated_at)
select v.key, v.value, now()
from (values
${settingRows}
) as v(key, value)
where not exists (
  select 1 from public.site_settings existing_setting where existing_setting.key = v.key
);

commit;
`;

const forbiddenPatterns = [
  ["email address", /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/],
  ["mailto link", /mailto:/i],
  ["telephone link", /\btel:/i],
  ["phone number", /(?:\+?\d[\d\s().-]{8,}\d)/],
  ["service role key", /service_role|sb_secret/i],
  ["deploy hook URL", /api\.vercel\.com\/v1\/deploy|deploy[-_ ]?hook\.[a-z]/i],
];

for (const [label, pattern] of forbiddenPatterns) {
  if (pattern.test(sql)) fail("generated seed contains a forbidden " + label);
}

fs.writeFileSync(OUTPUT_PATH, sql, "utf8");

console.log("Wrote " + path.relative(ROOT, OUTPUT_PATH));
console.log("Projects: " + projects.length);
console.log("Screenshots: " + screenshotCount);
console.log("Tools: " + tools.length);
console.log("Stats: " + stats.length);
console.log("Settings keys: " + settings.length + " (" + settings.map(([key]) => key).join(", ") + ")");
console.log("\nFirst 40 lines of seed.sql:\n");
console.log(sql.split(/\r?\n/).slice(0, 40).join("\n"));
