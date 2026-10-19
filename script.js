/* ==========================================================================
   Neelam Dhiman | Portfolio
   script.js  —  vanilla JS, no libraries
   --------------------------------------------------------------------------
   01. Small helpers
   02. Footer year
   02b. Scroll progress bar
   03. Navbar scroll effect
   04. Smooth scroll for nav links
   05. Mobile menu (hamburger + full-screen overlay)
   06. Active nav link based on section in view
   07. Reveal on scroll (.in-view)
   08. (removed) Animated background particles (canvas)
   09. Custom cursor (desktop only)
   10. About photo fallback
   11. Lucide icons
   12. Skills grid stagger
   13. Stat count-up
   14. Projects (render + carousel)
   15. Vision rings & mouse parallax
   16. Contact form (validation + mailto)
   17. Back to top button
   18. Lightbox (full-screen screenshot viewer)
   ========================================================================== */

"use strict";

/* ==========================================================================
   PROJECTS DATA  —  EDIT THIS BLOCK TO CHANGE YOUR PROJECTS
   --------------------------------------------------------------------------
   Each object:
     title      → heading on the card
     slug       → folder name used for its screenshots (see below)
     tag        → small outlined badge, top-right
     description→ paragraph under the title
     features   → array of strings, shown as the "Key Features" list
     stack      → array of strings, shown as pill chips
     images     → array of screenshot paths. Empty for now, so every card
                   shows the "Screenshots coming soon" placeholder.
     buttons    → array of { label, url, style }.
                   style is "primary" (filled) or "secondary" (outlined).

   ADDING SCREENSHOTS LATER
     Put files in assets/projects/<slug>/ and list them in images[], e.g.

       assets/projects/tagore-global-school/1.png
       assets/projects/tagore-global-school/2.png
       assets/projects/tagore-global-school/3.png

     The slugs in use are:
       tagore-global-school   tic-tac-toe   calc-notebook
       socratic-math-mentor   rasoi-mitra   telegram-bot   blog-agent

     Any path listed that does not exist is skipped automatically, so you can
     add screenshots one at a time. With none of them present you get the
     placeholder instead. Any leftover thumbnail column at 1440px shows up as a
     near-blank strip in the middle of the page, so prefer to add them in
     batches of 3 or more.

   Optional, only needed once a project has screenshots:
     aspect     → CSS aspect-ratio for the screenshot box, e.g. "16 / 9".
                  Match it to your screenshots so nothing gets cropped.
                  Defaults to 16 / 10 when omitted.
     fit        → "cover" (default, fills the box and crops) or "contain"
                  (shows the whole screenshot, with thin bars if the
                  ratios differ). Use "contain" for website screenshots.

   BUTTON RULES
     • Website            → primary "Visit Website"
     • Game / tool / app  → primary "Try Now"
     • No live link       → primary "View on GitHub" only
     • Anything with a live link also gets a secondary "View Code" button.
     • Only use URLs you have verified. Never invent one.

   HOW MANY SHOW FIRST
     Only the first PROJECTS_PREVIEW projects are visible when the page
     loads. The rest are still rendered, but hidden behind the "Show More"
     button below the list. Change PROJECTS_PREVIEW to show more or fewer.
   ========================================================================== */
const PROJECTS_PREVIEW = 3;

const projects = [
  {
    title: "Tagore Global School",
    slug: "tagore-global-school",
    tag: "Website",
    description:
      "A complete school website with a clean, easy-to-use layout, built for Tagore Global School.",
    features: [
      "Clean, easy-to-use layout",
      "Responsive on phone, tablet and desktop",
      "Multiple sections for school information",
    ],
    stack: ["HTML", "CSS", "JavaScript"],
    images: [
      "assets/projects/tagore-global-school/1.jpg",
      "assets/projects/tagore-global-school/2.jpg",
      "assets/projects/tagore-global-school/3.jpg",
      "assets/projects/tagore-global-school/4.jpg",
      "assets/projects/tagore-global-school/5.jpg",
    ],
    aspect: "16 / 9",
    fit: "contain",
    buttons: [
      { label: "Visit Website", url: "https://tagore-global-school.vercel.app/", style: "primary" },
      { label: "View Code", url: "https://github.com/Neelam7590/Tagore-Global-School", style: "secondary" },
    ],
  },
  {
    title: "Tic Tac Toe",
    slug: "tic-tac-toe",
    tag: "Game",
    description:
      "The classic Tic Tac Toe game with a simple, interactive board you can play right in your browser.",
    features: ["Two-player gameplay", "Win and draw detection", "Restart option"],
    stack: ["HTML", "CSS", "JavaScript"],
    images: [
      "assets/projects/tic-tac-toe/1.jpg",
      "assets/projects/tic-tac-toe/2.jpg",
      "assets/projects/tic-tac-toe/3.jpg",
      "assets/projects/tic-tac-toe/4.jpg",
    ],
    aspect: "16 / 9",
    fit: "contain",
    buttons: [
      { label: "Try Now", url: "https://tic-tac-toe-game-pearl-chi.vercel.app", style: "primary" },
      { label: "View Code", url: "https://github.com/Neelam7590/Tic-Tac-Toe-Game", style: "secondary" },
    ],
  },
  {
    title: "Calc Notebook",
    slug: "calc-notebook",
    tag: "Web Tool",
    description:
      "An all-in-one calculator website for EMI, Age, Percentage, BMI and GST, in a notebook-style design.",
    features: [
      "Five calculators in one place",
      "Notebook-style design",
      "Works on phone and desktop",
    ],
    stack: ["HTML", "CSS", "JavaScript"],
    images: [
      "assets/projects/calc-notebook/1.jpg",
      "assets/projects/calc-notebook/2.jpg",
      "assets/projects/calc-notebook/3.jpg",
    ],
    aspect: "16 / 9",
    fit: "contain",
    buttons: [
      { label: "Try Now", url: "https://calcnotebook.vercel.app", style: "primary" },
      { label: "View Code", url: "https://github.com/Neelam7590/Calc-Notebook", style: "secondary" },
    ],
  },
  {
    title: "Socratic Math Mentor",
    slug: "socratic-math-mentor",
    tag: "AI App",
    description:
      "An AI math mentor that helps you learn by guiding you with questions instead of just giving answers.",
    features: [
      "Guides step by step with questions",
      "Built in Google AI Studio",
      "Deployed on Vercel through GitHub",
    ],
    stack: ["Google AI Studio", "GitHub", "Vercel"],
    images: [
      "assets/projects/socratic-math-mentor/1.jpg",
      "assets/projects/socratic-math-mentor/2.jpg",
      "assets/projects/socratic-math-mentor/3.jpg",
    ],
    aspect: "16 / 9",
    fit: "contain",
    buttons: [
      { label: "Try Now", url: "https://socratic-math-mentor.vercel.app", style: "primary" },
      { label: "View Code", url: "https://github.com/Neelam7590/Socratic-Math-Mentor", style: "secondary" },
    ],
  },
  {
    title: "Rasoi Mitra",
    slug: "rasoi-mitra",
    tag: "AI App",
    description:
      "A recipe assistant app that helps you decide what to cook and how to make it.",
    features: [
      "Recipe suggestions and cooking help",
      "Built on Replit",
      "Live on Render",
    ],
    stack: ["Replit", "Render"],
    images: [
      "assets/projects/rasoi-mitra/1.jpg",
      "assets/projects/rasoi-mitra/2.jpg",
      "assets/projects/rasoi-mitra/3.jpg",
    ],
    aspect: "16 / 9",
    fit: "contain",
    buttons: [
      { label: "Try Now", url: "https://rasoi-mitra-recipe.onrender.com/", style: "primary" },
      { label: "View Code", url: "https://github.com/Neelam7590/Rasoi-Mitra-Recipe", style: "secondary" },
    ],
  },
  {
    title: "Telegram Bot",
    slug: "telegram-bot",
    tag: "Automation",
    description:
      "A Python Telegram bot with AI replies, scheduled messages and news updates.",
    features: [
      "Automatic and AI-powered replies",
      "Memory using Supabase",
      "Scheduled messages and news updates",
    ],
    stack: ["Python", "python-telegram-bot", "Groq", "Supabase"],
    images: [
      "assets/projects/telegram-bot/1.jpg",
      "assets/projects/telegram-bot/2.jpg",
    ],
    aspect: "16 / 9",
    fit: "contain",
    // No live link for this one, so it gets a single button.
    buttons: [
      { label: "View on GitHub", url: "https://github.com/Neelam7590/Telegram-Bot", style: "primary" },
    ],
  },
  {
    title: "CalcNotebook Blog Agent",
    slug: "blog-agent",
    tag: "Automation",
    description:
      "An auto-blogging agent that writes and publishes posts to the CalcNotebook blog by itself.",
    features: [
      "Writes and publishes blog posts automatically",
      "Runs on a schedule with GitHub Actions",
      "Uses Groq AI and SerpApi for research",
    ],
    stack: ["Python", "Groq", "SerpApi", "GitHub Actions"],
    images: [
      "assets/projects/blog-agent/1.jpg",
      "assets/projects/blog-agent/2.jpg",
    ],
    aspect: "16 / 9",
    fit: "contain",
    // No live link for this one, so it gets a single button.
    buttons: [
      { label: "View on GitHub", url: "https://github.com/Neelam7590/Calcnotebook-Blog-Agent", style: "primary" },
    ],
  },
];


   /* ==========================================================================
   01. SMALL HELPERS
   ========================================================================== */
const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];

/* True when the user asked for reduced motion in their OS settings. */
const prefersReducedMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)"
).matches;

/* Height of the fixed navbar — used to offset smooth scrolling.
   Must stay in sync with .section { scroll-margin-top } in style.css, which
   is calc(var(--nav-height) + 2px) = 80px. The 2px covers the navbar's 1px
   bottom border, which sits outside the --nav-height box. */
const NAV_OFFSET = 80;


/* ==========================================================================
   18. LIGHTBOX — FULL-SCREEN SCREENSHOT VIEWER
   --------------------------------------------------------------------------
   Clicking a screenshot in a project carousel opens it here, edge to edge.
   Escape / the X / the arrow keys / a click on the backdrop all work, and
   focus returns to whatever was clicked once it closes.

   Declared down here rather than at the top of the file because it uses the
   $() helper defined just above.
   ========================================================================== */
function initLightbox() {
  const box = $("#lightbox");
  const img = $("#lightbox-img");
  const closeBtn = $("#lightbox-close");
  const prevBtn = $("#lightbox-prev");
  const nextBtn = $("#lightbox-next");
  const counter = $("#lightbox-counter");
  if (!box || !img || !closeBtn || !prevBtn || !nextBtn || !counter) return null;

  let list = [];
  let index = 0;
  let lastFocused = null;

  function render() {
    const total = list.length;
    img.src = list[index];
    img.alt = `Screenshot ${index + 1} of ${total}`;

    // With a single screenshot there is nothing to page through.
    const many = total > 1;
    counter.textContent = `${index + 1} / ${total}`;
    counter.hidden = !many;
    prevBtn.hidden = !many;
    nextBtn.hidden = !many;
  }

  function step(direction) {
    index = (index + direction + list.length) % list.length;
    render();
  }

  function open(urls, startIndex) {
    if (!urls || !urls.length) return;
    list = urls;
    index = startIndex || 0;
    lastFocused = document.activeElement;

    render();
    box.hidden = false;
    document.body.classList.add("lightbox-open");
    closeBtn.focus();
  }

  function close() {
    box.hidden = true;
    document.body.classList.remove("lightbox-open");
    img.removeAttribute("src");       // release the full-size file
    if (lastFocused && lastFocused.focus) lastFocused.focus();
  }

  prevBtn.addEventListener("click", () => step(-1));
  nextBtn.addEventListener("click", () => step(1));
  closeBtn.addEventListener("click", close);

  // Only a click on the backdrop itself closes — not the image, not the arrows.
  box.addEventListener("click", (event) => {
    if (event.target === box) close();
  });

  document.addEventListener("keydown", (event) => {
    if (box.hidden) return;
    if (event.key === "Escape") { event.preventDefault(); close(); }
    else if (event.key === "ArrowLeft") { event.preventDefault(); step(-1); }
    else if (event.key === "ArrowRight") { event.preventDefault(); step(1); }
  });

  return { open, close };
}

const lightbox = initLightbox();


/* ==========================================================================
   02. FOOTER YEAR
   ========================================================================== */
const yearEl = $("#year");
if (yearEl) {
  yearEl.textContent = new Date().getFullYear();
}


/* ==========================================================================
   02b. SCROLL PROGRESS BAR
   A thin bar across the very top that fills as you scroll.
   Uses scaleX on a transform (no layout, no repaint of the page) and is
   throttled to one update per animation frame.
   ========================================================================== */
function initScrollProgress() {
  const bar = $("#scroll-progress");
  if (!bar) return;

  let ticking = false;

  function update() {
    const scrollable = document.documentElement.scrollHeight - window.innerHeight;

    // Guard against a zero/negative height (short pages, zoomed-out views).
    const progress = scrollable > 0 ? Math.min(1, Math.max(0, window.scrollY / scrollable)) : 0;

    bar.style.transform = `scaleX(${progress.toFixed(4)})`;
    ticking = false;
  }

  function handleScroll() {
    if (ticking) return;          // already waiting for the next frame
    ticking = true;
    window.requestAnimationFrame(update);
  }

  window.addEventListener("scroll", handleScroll, { passive: true });
  window.addEventListener("resize", handleScroll);
  update();
}

initScrollProgress();


/* ==========================================================================
   03. NAVBAR SCROLL EFFECT
   Transparent at the top → blurred cream once scrolled past 50px.
   ========================================================================== */
const navbar = $("#navbar");

function handleNavbarScroll() {
  if (!navbar) return;
  navbar.classList.toggle("scrolled", window.scrollY > 50);
}

window.addEventListener("scroll", handleNavbarScroll, { passive: true });
handleNavbarScroll();


/* ==========================================================================
   04. SMOOTH SCROLL FOR NAV LINKS
   Clicks any in-page link (#about, #journey, ...) and eases to the section,
   accounting for the fixed navbar height.
   ========================================================================== */
$$('a[href^="#"]').forEach((link) => {
  link.addEventListener("click", (event) => {
    const id = link.getAttribute("href");
    if (!id || id === "#") return;               // ignore empty / plain "#" links

    const target = document.querySelector(id);
    if (!target) return;                          // section doesn't exist yet

    event.preventDefault();
    closeMobileMenu();

    // Math.max(0, ...) stops a negative target for #home, which the browser
    // would clamp anyway.
    const top = Math.max(
      0,
      target.getBoundingClientRect().top + window.scrollY - NAV_OFFSET
    );
    window.scrollTo({ top, behavior: prefersReducedMotion ? "auto" : "smooth" });

    // Keep the URL clean without the browser's instant jump.
    // Wrapped in try/catch because some browsers block it on file:// pages.
    try {
      history.replaceState(null, "", id);
    } catch (error) {
      /* ignore — scrolling still works */
    }
  });
});


/* ==========================================================================
   05. MOBILE MENU (HAMBURGER + FULL-SCREEN OVERLAY)
   ========================================================================== */
const hamburger = $("#hamburger");
const mobileMenu = $("#mobile-menu");

function openMobileMenu() {
  if (!hamburger || !mobileMenu) return;
  hamburger.classList.add("open");
  mobileMenu.classList.add("open");
  hamburger.setAttribute("aria-expanded", "true");
  hamburger.setAttribute("aria-label", "Close menu");
  document.body.style.overflow = "hidden";      // stop background scroll

  // Move focus into the menu so keyboard users land on the first link
  // instead of being left behind at the top of the page.
  const firstLink = $(".mobile-link", mobileMenu);
  if (firstLink) firstLink.focus();
}

function closeMobileMenu() {
  if (!hamburger || !mobileMenu) return;
  hamburger.classList.remove("open");
  mobileMenu.classList.remove("open");
  hamburger.setAttribute("aria-expanded", "false");
  hamburger.setAttribute("aria-label", "Open menu");
  document.body.style.overflow = "";

  // Send focus back to the button that opened the menu.
  if (hamburger) hamburger.focus();
}

if (hamburger) {
  hamburger.addEventListener("click", () => {
    mobileMenu.classList.contains("open") ? closeMobileMenu() : openMobileMenu();
  });
}

// Keep Tab inside the open menu (simple focus trap for the overlay).
mobileMenu?.addEventListener("keydown", (event) => {
  if (event.key !== "Tab") return;

  const links = $$(".mobile-link", mobileMenu);
  if (!links.length) return;

  const first = links[0];
  const last = links[links.length - 1];

  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
});

// Close the overlay with the Escape key.
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && mobileMenu?.classList.contains("open")) {
    closeMobileMenu();
  }
});


/* ==========================================================================
   06. ACTIVE NAV LINK BASED ON SECTION IN VIEW
   Highlights the nav link of the section currently in the middle of the screen.
   ========================================================================== */
const navLinks = $$(".nav-link");
const sectionsForNav = navLinks
  .map((link) => document.querySelector(link.getAttribute("href")))
  .filter(Boolean);

function setActiveLink(id) {
  navLinks.forEach((link) => {
    link.classList.toggle("active", link.getAttribute("href") === `#${id}`);
  });
}

if (sectionsForNav.length) {
  const navObserver = new IntersectionObserver(
    (entries) => {
      // Pick the entry closest to the top of the viewport (i.e. the visible one).
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => Math.abs(a.boundingClientRect.top) - Math.abs(b.boundingClientRect.top));

      if (visible.length) {
        setActiveLink(visible[0].target.id);
      }
    },
    {
      rootMargin: "-40% 0px -50% 0px",   // thin band in the middle of the screen
      threshold: 0,
    }
  );

  sectionsForNav.forEach((section) => navObserver.observe(section));
}


/* ==========================================================================
   07. REVEAL ON SCROLL
   Adds .in-view to every .reveal / .slide-in element once it enters the
   viewport. observeRevealElements() is reused later for the project cards,
   which are rendered after this first pass has already run.
   ========================================================================== */
let revealObserver = null;

/* Starts observing any .reveal / .slide-in inside scope (default: whole page). */
function observeRevealElements(scope = document) {
  const elements = $$(".reveal, .slide-in", scope);
  if (!elements.length) return;

  // Reduced motion (or no IntersectionObserver) → just show everything.
  if (prefersReducedMotion || !("IntersectionObserver" in window)) {
    elements.forEach((el) => el.classList.add("in-view"));
    return;
  }

  // Create the observer once and reuse it.
  if (!revealObserver) {
    revealObserver = new IntersectionObserver(
      (entries, observer) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("in-view");
          observer.unobserve(entry.target);       // animate once only
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -60px 0px" }
    );
  }

  elements.forEach((el) => revealObserver.observe(el));
}

function initReveal() {
  observeRevealElements(document);
}

initReveal();


/* ==========================================================================
   08. (REMOVED) ANIMATED BACKGROUND PARTICLES (CANVAS)
   --------------------------------------------------------------------------
   The drifting background dots were not wanted, so the whole canvas particle
   system was deleted: the <canvas id="bg-canvas"> element, its #bg-canvas CSS
   rule, initParticles() and its call site. Nothing else referenced any of it.

   To bring it back, restore the block from git history and re-add the canvas
   element plus the #bg-canvas rule.

   ========================================================================== */


/* ==========================================================================
   09. CUSTOM CURSOR (DESKTOP ONLY)
   6px dot follows instantly · 32px ring follows with smooth lag.
   ========================================================================== */
function initCursor() {
  const dot = $(".cursor-dot");
  const ring = $(".cursor-ring");

  // Touch devices keep their native behaviour.
  const isTouchDevice = window.matchMedia("(hover: none), (pointer: coarse)").matches;
  if (!dot || !ring || isTouchDevice) return;

  dot.style.display = "block";
  ring.style.display = "block";
  document.body.classList.add("has-custom-cursor");

  // Current mouse position and the lagging ring position.
  let mouseX = window.innerWidth / 2;
  let mouseY = window.innerHeight / 2;
  let ringX = mouseX;
  let ringY = mouseY;

  document.addEventListener("mousemove", (event) => {
    mouseX = event.clientX;
    mouseY = event.clientY;

    // The dot tracks the mouse instantly.
    dot.style.transform = `translate(${mouseX}px, ${mouseY}px)`;
  });

  // The ring eases toward the pointer every frame for a smooth lag.
  function ringLoop() {
    ringX += (mouseX - ringX) * 0.15;
    ringY += (mouseY - ringY) * 0.15;
    ring.style.transform = `translate(${ringX}px, ${ringY}px)`;
    window.requestAnimationFrame(ringLoop);
  }
  ringLoop();

  // Grow the ring over links, buttons, cards — and over the two things that open
// the lightbox, so the pointer still reads as clickable while the real cursor
// is hidden by the body.has-custom-cursor rule.
  const HOVER_SELECTOR =
    "a, button, .btn, .card, input, textarea, .project-card, .carousel-slide img, .lightbox__img";
  document.addEventListener("mouseover", (event) => {
    if (event.target.closest(HOVER_SELECTOR)) ring.classList.add("hovering");
  });
  document.addEventListener("mouseout", (event) => {
    if (event.target.closest(HOVER_SELECTOR)) ring.classList.remove("hovering");
  });

  // Hide the custom cursor when the pointer leaves the window.
  document.addEventListener("mouseleave", () => {
    dot.style.opacity = "0";
    ring.style.opacity = "0";
  });
  document.addEventListener("mouseenter", () => {
    dot.style.opacity = "1";
    ring.style.opacity = "";
  });
}

initCursor();


/* ==========================================================================
   10. ABOUT PHOTO FALLBACK
   If assets/neelam.jpg is missing or fails to load, show a teal "ND"
   monogram instead of a broken-image icon.
   ========================================================================== */
function initAboutPhoto() {
  const photo = $(".about-photo");
  const img = photo ? $("img", photo) : null;
  if (!photo || !img) return;

  const showFallback = () => photo.classList.add("is-empty");

  // Already loaded and still empty → the file is missing.
  if (img.complete && img.naturalWidth === 0) {
    showFallback();
    return;
  }

  img.addEventListener("error", showFallback);
}

initAboutPhoto();


/* ==========================================================================
   11. LUCIDE ICONS
   Replaces every <i data-lucide="..."> with an inline SVG line icon.
   Lucide is loaded from a CDN just above this file in index.html.
   ========================================================================== */
function initIcons() {
  if (!window.lucide || typeof window.lucide.createIcons !== "function") {
    return;
  }
  window.lucide.createIcons({
    attrs: { "aria-hidden": "true", "focusable": "false" },
  });
}

initIcons();

// Re-run on DOMContentLoaded in case CDN loads after script execution
document.addEventListener("DOMContentLoaded", initIcons);


/* ==========================================================================
   12. SKILLS GRID STAGGER
   Gives each card a slightly longer fade + scale-in than the one before it,
   so the grid fills in one after another. Add or remove a card freely —
   the delay is recalculated automatically from its position.
   ========================================================================== */
function initSkillsStagger() {
  $$(".skills-cards > *").forEach((item, index) => {
    item.style.transitionDelay = `${(index * 0.07).toFixed(2)}s`;
  });
}

initSkillsStagger();


/* ==========================================================================
   13. STAT COUNT-UP
   Counts any element with data-target from 0 up to its target over ~2s with
   an ease-out curve, the first time it scrolls into view.
     <span data-target="20" data-suffix="+">0</span>
   ========================================================================== */
/* Keep the "Projects Built" counter in step with the projects array, so adding
   or removing a project never leaves the number lying on the page. The
   element opts in with data-from-projects in index.html. */
(function syncProjectsStat() {
  const el = $("[data-from-projects]");
  if (!el) return;
  el.dataset.target = String(projects.length);
  el.textContent = "0" + (el.dataset.suffix || "");
})();

function initStatCounters() {
  const counters = $$("[data-target]");
  if (!counters.length) return;

  const DURATION = 2000;                       // milliseconds
  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

  /* Writes the final value immediately (reduced motion / no observer). */
  function setFinal(el) {
    const target = parseFloat(el.dataset.target) || 0;
    el.textContent = target + (el.dataset.suffix || "");
  }

  /* Animates 0 → target over DURATION. */
  function countTo(el) {
    const target = parseFloat(el.dataset.target) || 0;
    const suffix = el.dataset.suffix || "";
    const start = performance.now();

    function frame(now) {
      const progress = Math.min((now - start) / DURATION, 1);
      el.textContent = Math.round(easeOutCubic(progress) * target) + suffix;

      if (progress < 1) {
        window.requestAnimationFrame(frame);
      }
    }

    window.requestAnimationFrame(frame);
  }

  if (prefersReducedMotion || !("IntersectionObserver" in window)) {
    counters.forEach(setFinal);
    return;
  }

  const counterObserver = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        countTo(entry.target);
        observer.unobserve(entry.target);      // count once only
      });
    },
    { threshold: 0.6 }                        // wait until it is mostly on screen
  );

  counters.forEach((el) => counterObserver.observe(el));
}

initStatCounters();


/* ==========================================================================
   14. PROJECTS
   Builds the project cards from the `projects` array declared at the top
   of this file, then wires up each screenshot carousel.
   ========================================================================== */

/* Escapes text so a stray "&" or "<" in your data can never break the HTML. */
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[char]);
}

/* Checks which screenshot files actually exist.
   Missing files are dropped, so you can add 1.png, 2.png, 3.png at your
   own pace. Returns an empty array when nothing is there yet. */
function resolveImages(urls) {
  const list = Array.isArray(urls) ? urls : [];

  return Promise.all(
    list.map(
      (url) =>
        new Promise((resolve) => {
          const probe = new Image();
          probe.onload = () => resolve(url);
          probe.onerror = () => resolve(null);   // file not added yet
          probe.src = url;
        })
    )
  ).then((results) => results.filter(Boolean));
}

/* --- IMAGE SIDE: carousel, or the placeholder when there are no images --- */
function mediaMarkup(project, images) {
  if (!images.length) {
    return `
      <div class="carousel">
        <div class="project-placeholder">
          <i data-lucide="image" class="project-placeholder__icon"></i>
          <span class="project-placeholder__title">${escapeHtml(project.title)}</span>
          <span class="project-placeholder__note">Screenshots coming soon</span>
        </div>
      </div>`;
  }

  const total = images.length;

  /* Alt text describes the image and names the local context once, rather than
     repeating a keyword list. Screen readers announce this verbatim, so a pile
     of city names here would be read out loud before every screenshot. Kept to
     one accurate mention of Kaithal, Haryana. */
  const slideAlt = (project, n) =>
    `${project.title} screenshot ${n} by Neelam Dhiman, web developer in Kaithal, Haryana`;

  const slides = images
    .map(
      (src, i) => `
        <div class="carousel-slide${i === 0 ? " is-active" : ""}">
          <img src="${escapeHtml(src)}" alt="${escapeHtml(slideAlt(project, i + 1))}" loading="lazy" />
        </div>`
    )
    .join("");

  const dots = images
    .map(
      (_, i) => `
        <button type="button" class="carousel-dot${i === 0 ? " is-active" : ""}" data-index="${i}" aria-label="Show screenshot ${i + 1}" aria-pressed="${i === 0}"></button>`
    )
    .join("");

  const thumbs = images
    .map(
      (src, i) => `
        <button type="button" class="carousel-thumb${i === 0 ? " is-active" : ""}" data-index="${i}" aria-label="Show screenshot ${i + 1}" aria-pressed="${i === 0}">
          <img src="${escapeHtml(src)}" alt="" loading="lazy" />
        </button>`
    )
    .join("");

  return `
    <div class="carousel${total < 2 ? " is-single" : ""}" data-autoplay="4000" role="group" aria-roledescription="carousel" aria-label="${escapeHtml(project.title)} screenshots" style="--stage-aspect:${escapeHtml(project.aspect || "16 / 10")};${project.fit ? `--stage-fit:${escapeHtml(project.fit)};` : ""}">
      <div class="carousel-stage">
        <div class="carousel-slides">${slides}</div>

        <!-- Hover badge: tells the visitor a screenshot opens full screen.
             pointer-events:none, so clicks fall through to the image. -->
        <span class="carousel-zoom" aria-hidden="true"><i data-lucide="maximize-2"></i></span>

        <button type="button" class="carousel-btn carousel-btn--prev" data-dir="-1" aria-label="Previous screenshot">
          <i data-lucide="chevron-left"></i>
        </button>
        <button type="button" class="carousel-btn carousel-btn--next" data-dir="1" aria-label="Next screenshot">
          <i data-lucide="chevron-right"></i>
        </button>

        <span class="carousel-counter" aria-live="polite" aria-atomic="true">
          <span class="carousel-counter__current">1</span> / ${total}
        </span>

        <div class="carousel-dots">${dots}</div>
      </div>

      <div class="carousel-thumbs">${thumbs}</div>
    </div>`;
}

/* --- Buttons: primary is filled with the accent, secondary is outlined --- */
function buttonMarkup(button) {
  // Anything that is not explicitly "secondary" renders as primary, so a
  // typo can never silently produce an invisible button.
  const style = button.style === "secondary" ? "btn-secondary" : "btn-primary";
  return `<a class="btn ${style} project-link" href="${escapeHtml(button.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(button.label)}</a>`;
}

/* --- DETAILS SIDE: title, badge, features, stack, buttons --- */
function detailsMarkup(project) {
  const features = (project.features || [])
    .map((feature) => `<li class="project-feature">${escapeHtml(feature)}</li>`)
    .join("");

  const chips = (project.stack || [])
    .map((tech) => `<span class="project-chip">${escapeHtml(tech)}</span>`)
    .join("");

  const buttons = (project.buttons || []).map(buttonMarkup).join("");

  return `
    <div class="project-info slide-in slide-in--right">
      <!-- decorative corner lines, drawn in on scroll -->
      <span class="project-corner project-corner--tl" aria-hidden="true"></span>
      <span class="project-corner project-corner--br" aria-hidden="true"></span>

      <div class="project-head">
        <h3 class="project-title">${escapeHtml(project.title)}</h3>
        <span class="project-tag">${escapeHtml(project.tag)}</span>
      </div>

      <p class="project-desc">${escapeHtml(project.description)}</p>

      <h4 class="project-subtitle">Key Features</h4>
      <ul class="project-features">${features}</ul>

      <h4 class="project-subtitle">Technology Stack</h4>
      <div class="project-chips">${chips}</div>

      ${buttons ? `<div class="project-links">${buttons}</div>` : ""}
    </div>`;
}

/* --- One full project block --- */
function projectMarkup(project, images, index) {
  // Odd rows: image on the right, so the card slides in from the left.
  const side = index % 2 === 0 ? "slide-in--right" : "slide-in--left";
  const info = detailsMarkup(project).replace("slide-in--right", side);

  // Anything past the preview window gets .project--extra, which CSS keeps at
  // display:none until the "Show More" button adds .is-expanded to the list.
  const extra = index >= PROJECTS_PREVIEW ? " project--extra" : "";

  return `
    <article class="project${extra}">
      <div class="project-media reveal">${mediaMarkup(project, images)}</div>
      ${info}
    </article>`;
}

/* --- Show More / Show Less button ---
   Unhides the projects past PROJECTS_PREVIEW, and hides them again on a
   second press. The hidden cards are re-observed each time they appear so
   their slide-in animation replays instead of staying stuck invisible. */
function initProjectsToggle() {
  const list = $("#projects-list");
  const wrap = $("#projects-toggle");
  const button = $("#projects-more-btn");
  const label = $("#projects-more-label");
  if (!list || !wrap || !button || !label) return;

  // The toggle button is static markup in index.html, so it survives a
  // re-render. Without this guard a second renderProjects() would attach a
  // second click listener and every click would toggle twice, leaving the
  // section looking unchanged.
  if (wrap.dataset.toggleReady) return;
  wrap.dataset.toggleReady = "true";

  // Every project already fits in the preview — no button needed.
  if (projects.length <= PROJECTS_PREVIEW) {
    wrap.remove();
    return;
  }

  const hiddenCount = projects.length - PROJECTS_PREVIEW;

  wrap.hidden = false;
  label.textContent = "Show More";
  button.setAttribute(
    "aria-label",
    `Show ${hiddenCount} more project${hiddenCount === 1 ? "" : "s"}`
  );

  // Now that [hidden] is off the element has a box, so it can be observed.
  observeRevealElements(wrap);

  // Where the page was scrolled to at the moment "Show More" was pressed.
  // "Show Less" puts the visitor back here, rather than leaving them stranded
  // near the bottom of a page that just lost four whole cards above them.
  let anchorY = null;

  button.addEventListener("click", () => {
    const wasExpanded = list.classList.contains("is-expanded");
    const expanded = list.classList.toggle("is-expanded");

    button.setAttribute("aria-expanded", String(expanded));
    label.textContent = expanded ? "Show Less" : "Show More";
    button.setAttribute(
      "aria-label",
      expanded
        ? `Hide ${hiddenCount} extra project${hiddenCount === 1 ? "" : "s"}`
        : `Show ${hiddenCount} more project${hiddenCount === 1 ? "" : "s"}`
    );

    if (expanded) {
      // Opening deliberately does NOT scroll. The cards appear below the fold
      // and the visitor stays exactly where they were, so the page under them
      // never appears to jump. Remember this spot so Show Less can return here.
      anchorY = window.scrollY;
      observeRevealElements(list);
    } else if (anchorY !== null) {
      // Collapsing removes four cards that sat above the button, so the
      // document shrinks by a couple of thousand pixels while scrollY stays
      // put. Restore the remembered position instead.
      window.scrollTo(0, anchorY);
    }

    // Hand focus back to the button (now labelled "Show More" again) so it
    // stays keyboard-reachable and Enter/Space keeps working. preventScroll
    // stops the browser fighting the correction above.
    button.focus({ preventScroll: true });
  });
}

/* --- Carousel behaviour: arrows, dots, thumbnails, auto-slide --- */
function initCarousel(carousel) {
  const slides = $$(".carousel-slide", carousel);
  if (!slides.length) return;

  let current = 0;
  let timer = null;

  // data-autoplay is in milliseconds (4000 = every 4 seconds).
  const interval = parseInt(carousel.dataset.autoplay, 10) || 4000;
  const canAnimate = slides.length > 1 && !prefersReducedMotion;

  function show(index) {
    clearDrag();

    // Wraps around in both directions.
    current = (index + slides.length) % slides.length;

    slides.forEach((slide, i) => slide.classList.toggle("is-active", i === current));

    // Keep the visual highlight and the exposed accessibility state in sync.
    $$(".carousel-dot", carousel).forEach((dot, i) => {
      dot.classList.toggle("is-active", i === current);
      dot.setAttribute("aria-pressed", String(i === current));
    });
    $$(".carousel-thumb", carousel).forEach((thumb, i) => {
      thumb.classList.toggle("is-active", i === current);
      thumb.setAttribute("aria-pressed", String(i === current));
    });

    const label = $(".carousel-counter__current", carousel);
    if (label) label.textContent = current + 1;
  }

  function stop() {
    if (timer === null) return;
    window.clearInterval(timer);
    timer = null;
  }

  function start() {
    stop();
    if (!canAnimate) return;
    timer = window.setInterval(() => show(current + 1), interval);
  }

  carousel.addEventListener("click", (event) => {
    const button = event.target.closest(".carousel-btn");
    const dot = event.target.closest(".carousel-dot");
    const thumb = event.target.closest(".carousel-thumb");

    if (button) {
      show(current + Number(button.dataset.dir));
      start();                       // restart the timer after a manual change
    } else if (dot) {
      show(Number(dot.dataset.index));
      start();
    } else if (thumb) {
      show(Number(thumb.dataset.index));
      start();
    } else if (event.target.closest(".carousel-stage")) {
      // A tap on the screenshot opens it full screen.
      //
      // Note: this matches .carousel-stage, NOT .carousel-slide. Once a drag
      // has started, stage.setPointerCapture() retargets every later event —
      // including the click — at the stage itself, so a click on the image
      // arrives with the stage as its target. The buttons and dots are tested
      // above, so anything else landing on the stage is a tap on the image.
      //
      // `current` is used rather than the clicked element's index, so auto-play
      // rotating underneath cannot make the viewer open the wrong image.
      if (lightbox && urls.length && !wasDrag) lightbox.open(urls, current);
    }
  });

  // Pause auto-slide while the pointer is anywhere over the carousel.
  carousel.addEventListener("mouseenter", stop);
  carousel.addEventListener("mouseleave", start);

  // Also pause while a control inside it has keyboard focus, so the images
  // stop moving under someone using arrow keys.
  carousel.addEventListener("focusin", stop);
  carousel.addEventListener("focusout", (event) => {
    if (!carousel.contains(event.relatedTarget)) start();
  });

  // Keyboard support once a control has focus (events bubble up from the
  // buttons). preventDefault stops the page from scrolling sideways too.
  carousel.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") { event.preventDefault(); show(current - 1); start(); }
    if (event.key === "ArrowRight") { event.preventDefault(); show(current + 1); start(); }
  });

  // Stop entirely when the tab is hidden so we don't churn in the background.
  document.addEventListener("visibilitychange", () => {
    document.hidden ? stop() : start();
  });

  /* --- Drag / swipe left and right to move between screenshots ---
     The three slides around the current one (previous, current, next) are
     made visible and follow the pointer 1:1. On release, crossing 18% of the
     box width commits the move, otherwise it snaps back to where it started. */
  const stage = $(".carousel-stage", carousel);
  const draggable = slides.length > 1 && !!stage && !!window.PointerEvent;

  let dragging = false;
  let startX = 0;
  let delta = 0;

  // True when the last pointer sequence was a drag rather than a tap. A drag
  // ends with a click event too, and we must not open the viewer for those.
  let wasDrag = false;

  // Screenshots in display order, used to feed the lightbox.
  const urls = $$(".carousel-slide img", carousel).map((image) => image.currentSrc || image.src);

  // Must stay a function declaration: show() calls clearDrag() and is itself
  // invoked before this point, so hoisting is what makes that safe.
  function clearDrag() {
    if (!stage) return;
    slides.forEach((slide) => {
      slide.style.transform = "";
      slide.classList.remove("is-dragging");
    });
  }

  function paintDrag(offset) {
    const width = stage.getBoundingClientRect().width || 1;
    const active = slides[current];
    const next = slides[(current + 1) % slides.length];
    const prev = slides[(current - 1 + slides.length) % slides.length];

    active.style.transform = `translate3d(${offset}px, 0, 0)`;
    next.style.transform = `translate3d(${width + offset}px, 0, 0)`;
    prev.style.transform = `translate3d(${-width + offset}px, 0, 0)`;

    [active, next, prev].forEach((slide) => slide.classList.add("is-dragging"));
  }

  if (draggable) {
    stage.addEventListener("pointerdown", (event) => {
      // Arrows and dots are real controls — let them click normally.
      if (event.target.closest(".carousel-btn, .carousel-dot")) return;
      if (event.pointerType === "mouse" && event.button !== 0) return;

      dragging = true;
      startX = event.clientX;
      delta = 0;
      wasDrag = false;

      stage.classList.add("is-grabbing");
      stage.setPointerCapture(event.pointerId);
      stop();
    });

    stage.addEventListener("pointermove", (event) => {
      if (!dragging) return;
      delta = event.clientX - startX;
      paintDrag(delta);
    });

    const endDrag = () => {
      if (!dragging) return;
      dragging = false;
      stage.classList.remove("is-grabbing");

      const threshold = (stage.getBoundingClientRect().width || 1) * 0.18;

      // A few pixels of movement still counts as a drag for the purpose of
      // suppressing the click, even though it will not change the slide.
      wasDrag = Math.abs(delta) > 5;

      if (delta > threshold) show(current - 1);
      else if (delta < -threshold) show(current + 1);
      else show(current);          // under the threshold: snap back

      start();
    };

    stage.addEventListener("pointerup", endDrag);
    stage.addEventListener("pointercancel", endDrag);

    // Trackpad swipe, or shift + mouse wheel. A plain vertical wheel is left
    // alone so the page keeps scrolling as the visitor expects.
    stage.addEventListener(
      "wheel",
      (event) => {
        const horizontal =
          Math.abs(event.deltaX) > Math.abs(event.deltaY)
            ? event.deltaX
            : event.shiftKey
              ? event.deltaY
              : 0;
        if (!horizontal) return;

        event.preventDefault();
        show(current + (horizontal > 0 ? 1 : -1));
        start();
      },
      { passive: false }
    );
  }

  show(0);
  start();
}

/* --- Render the whole section --- */
async function renderProjects() {
  const list = $("#projects-list");
  if (!list) return;

  // Wait until we know which screenshot files really exist.
  const resolved = await Promise.all(projects.map((project) => resolveImages(project.images)));

  list.innerHTML = projects
    .map((project, index) => projectMarkup(project, resolved[index], index))
    .join("");

  $$(".carousel", list).forEach(initCarousel);

  // Show More / Show Less button (no-op when everything already fits).
  initProjectsToggle();

  // The project cards are added after the first reveal pass, so observe
  // them now — otherwise they would stay invisible.
  observeRevealElements(list);

  // Lucide needs re-running for the arrows and placeholder icons.
  if (window.lucide && typeof window.lucide.createIcons === "function") {
    window.lucide.createIcons({
      attrs: { "aria-hidden": "true", "focusable": "false" },
    });
  }
}

/* Deferred render.
   resolveImages() probes every screenshot with `new Image()`, which starts a
   network request immediately. Calling renderProjects() straight away would
   fetch all 18 files on page load and defeat the loading="lazy" on the <img>
   tags inside. So we wait until the section is within 600px of the viewport
   — by then the markup is already there before the user can see it, so there
   is no visible layout shift. Clicking a "Projects" nav link also triggers it. */
function initProjectsRender() {
  const section = $("#projects");

  if (!section || !("IntersectionObserver" in window)) {
    renderProjects();
    return;
  }

  const sectionObserver = new IntersectionObserver(
    (entries, observer) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      renderProjects();
    },
    { rootMargin: "600px 0px" }
  );

  sectionObserver.observe(section);
}

initProjectsRender();


/* ==========================================================================
   15. VISION — RINGS & MOUSE PARALLAX
   Builds the concentric organic ring outlines as SVG, then drifts them
   gently against the cursor on desktop.
   ========================================================================== */
const SVG_NS = "http://www.w3.org/2000/svg";

/* Turns one circle into a wobbly, organic-looking closed path. */
function organicRingPath(cx, cy, radius, points, wobble, phase) {
  let path = "";

  for (let i = 0; i < points; i++) {
    const angle = (i / points) * Math.PI * 2;

    // Two sine harmonics layered together = an organic outline rather than
    // a perfect circle. Tweak `wobble` for more or less irregularity.
    const r =
      radius *
      (1 + wobble * Math.sin(3 * angle + phase) + wobble * 0.6 * Math.sin(5 * angle + phase * 2));

    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);

    path += `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)} `;
  }

  return path + "Z";   // close the loop
}

/* Draws the rings into #vision-ring-group.
   To change the look, edit the `rings` array below:
     r        → ring radius (bigger = further out)
     wobble   → how irregular the outline is
     spin     → which rotation animation it uses
     duration → seconds for one full rotation
     depth    → parallax strength (outer rings move most) */
function buildVisionRings() {
  const group = $("#vision-ring-group");
  if (!group) return;

  const centre = 600;   // centre of the 1200 × 1200 viewBox

  const rings = [
    { r: 478, wobble: 0.028, spin: "vision-ring--a", duration: 118, depth: 0.95 },
    { r: 392, wobble: 0.038, spin: "vision-ring--b", duration: 92,  depth: 0.95 },
    { r: 312, wobble: 0.030, spin: "vision-ring--c", duration: 134, depth: 0.60 },
    { r: 228, wobble: 0.045, spin: "vision-ring--a", duration: 84,  depth: 0.60 },
    { r: 146, wobble: 0.035, spin: "vision-ring--b", duration: 70,  depth: 0.32 },
  ];

  const POINTS = 72;     // points per ring — higher = smoother

  // Rings that share a depth are wrapped in one parallax layer.
  const depths = [...new Set(rings.map((ring) => ring.depth))];

  depths.forEach((depth) => {
    const layer = document.createElementNS(SVG_NS, "g");
    layer.setAttribute("class", "vision-parallax");
    layer.style.setProperty("--depth", depth);

    rings
      .filter((ring) => ring.depth === depth)
      .forEach((ring, position) => {
        const ringGroup = document.createElementNS(SVG_NS, "g");
        ringGroup.setAttribute("class", `vision-ring ${ring.spin}`);
        ringGroup.style.animationDuration = `${ring.duration}s`;

        const path = document.createElementNS(SVG_NS, "path");
        path.setAttribute(
          "d",
          organicRingPath(centre, centre, ring.r, POINTS, ring.wobble, position * 1.7 + depth)
        );

        ringGroup.appendChild(path);
        layer.appendChild(ringGroup);
      });

    group.appendChild(layer);
  });
}

buildVisionRings();


/* Drifts the rings slightly against the cursor. Desktop pointers only. */
function initVisionParallax() {
  const layers = $$(".vision-parallax");
  if (!layers.length) return;

  const isTouchDevice = window.matchMedia("(hover: none), (pointer: coarse)").matches;
  if (isTouchDevice || prefersReducedMotion) return;

  const STRENGTH = 26;   // px of travel for the outermost ring
  const EASE = 0.06;

  let targetX = 0;
  let targetY = 0;
  let currentX = 0;
  let currentY = 0;
  let frame = null;

  function render() {
    currentX += (targetX - currentX) * EASE;
    currentY += (targetY - currentY) * EASE;

    layers.forEach((layer) => {
      const depth = parseFloat(layer.style.getPropertyValue("--depth")) || 0.4;
      // Negated so the rings move opposite to the cursor.
      const x = -currentX * STRENGTH * depth;
      const y = -currentY * STRENGTH * depth;
      layer.style.transform = `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px)`;
    });

    // Once the rings have caught up, stop the loop until the next move.
    const settled =
      Math.abs(targetX - currentX) < 0.0005 && Math.abs(targetY - currentY) < 0.0005;

    frame = settled ? null : window.requestAnimationFrame(render);
  }

  window.addEventListener(
    "mousemove",
    (event) => {
      targetX = event.clientX / window.innerWidth - 0.5;
      targetY = event.clientY / window.innerHeight - 0.5;
      if (frame === null) frame = window.requestAnimationFrame(render);
    },
    { passive: true }
  );

  // Don't burn CPU while the tab is in the background.
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden || frame === null) return;
    window.cancelAnimationFrame(frame);
    frame = null;
  });
}

initVisionParallax();


/* ==========================================================================
   16. CONTACT FORM
   The message is POSTed to /api/contact (see api/contact.js), a Vercel
   serverless function that forwards it to Resend. Because that is a network
   round trip, the form shows a "Sending…" state and re-enables the button
   when it finishes. If sending fails, the visitor is shown CONTACT_EMAIL so
   they can still reach you directly.
   ========================================================================== */
const CONTACT_EMAIL = "neelxm08@gmail.com";

/* Simple but practical email check: something@something.tld */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const MIN_MESSAGE_LENGTH = 10;

function initContactForm() {
  const form = $("#contact-form");
  if (!form) return;

  const nameField = $("#contact-name");
  const emailField = $("#contact-email");
  const messageField = $("#contact-message");
  const status = $("#form-status");

  /* Each rule returns an error message, or "" when the value is fine. */
  const rules = {
    name: (value) => (value ? "" : "Please enter your name."),
    email: (value) => {
      if (!value) return "Please enter your email address.";
      if (!EMAIL_PATTERN.test(value)) return "Please enter a valid email address.";
      return "";
    },
    message: (value) => {
      if (!value) return "Please enter a message.";
      if (value.length < MIN_MESSAGE_LENGTH) {
        return `Please write at least ${MIN_MESSAGE_LENGTH} characters.`;
      }
      return "";
    },
  };

  /* Shows or clears the message under one field. */
  function setError(field, key, message) {
    const errorEl = $(`#error-${key}`);
    if (errorEl) errorEl.textContent = message;
    field.classList.toggle("has-error", Boolean(message));
    field.setAttribute("aria-invalid", message ? "true" : "false");
    return !message;
  }

  /* Validates a single field and paints its error. */
  function validateField(key, field) {
    return setError(field, key, rules[key](field.value.trim()));
  }

  /* Clears a field's error as soon as the visitor starts fixing it. */
  [nameField, emailField, messageField].forEach((field, index) => {
    const key = ["name", "email", "message"][index];
    field.addEventListener("input", () => {
      if (field.classList.contains("has-error")) validateField(key, field);
    });
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const results = [
      validateField("name", nameField),
      validateField("email", emailField),
      validateField("message", messageField),
    ];

    // Any rule failed → show the first error and stop.
    if (results.includes(false)) {
      if (status) status.textContent = "";
      form.querySelector(".has-error")?.focus();
      return;
    }

    const name = nameField.value.trim();
    const email = emailField.value.trim();
    const message = messageField.value.trim();
    const honeypot = $("#contact-website");

    // Shows whatever the visitor needs to know while the request is in flight.
    function setStatus(text, kind) {
      if (!status) return;
      status.textContent = text;
      status.classList.toggle("is-ok", kind === "ok");
      status.classList.toggle("is-error", kind === "error");
    }

    const submit = form.querySelector(".form-submit");
    const originalBtnText = submit ? submit.textContent : "";

    if (submit) {
      submit.disabled = true;
      submit.textContent = "Sending…";
    }
    setStatus("Sending…");

    fetch("/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        email,
        message,
        website: honeypot ? honeypot.value : "",
      }),
    })
      .then((response) =>
        response
          .json()
          .catch(() => ({ ok: false, error: "Something went wrong. Please email directly." }))
          .then((data) => ({ ok: response.ok && data.ok !== false, data }))
      )
      .then(({ ok, data }) => {
        if (ok) {
          setStatus("Thank you! Your message has been sent.", "ok");
          form.reset();
          [nameField, emailField, messageField].forEach((field) =>
            field.classList.remove("has-error")
          );
          return;
        }

        // Failed. Offer the visitor a way through that does not depend on us.
        setStatus(
          `${data.error || "Could not send that."} You can also email me directly at ${CONTACT_EMAIL}.`,
          "error"
        );
      })
      .catch(() => {
        setStatus(
          `Could not send that. You can email me directly at ${CONTACT_EMAIL}.`,
          "error"
        );
      })
      .finally(() => {
        if (submit) {
          submit.disabled = false;
          submit.textContent = originalBtnText || "Send";
        }
      });
  });
}

initContactForm();


/* ==========================================================================
   FAQ — Dynamic "People Also Ask" (Google-style)
   When a question is opened, a new related question is appended.
   ========================================================================== */

const FAQ_EXTRA_QUESTIONS = [
  {
    question: "What is Neelam's educational background?",
    answer: "Neelam completed 10th (81.2%) and 12th (88.2%) from HBSE Board. She is currently pursuing a Bachelor of Arts at Kurukshetra University (2024-2027). She also completed O Level from NIELIT (B grade) and is pursuing Digital Marketing with AI course at NIELIT."
  },
  {
    question: "Can Neelam build custom web applications?",
    answer: "Yes. Neelam builds custom websites, web apps, and automation tools using HTML, CSS, JavaScript, and Python. She has built projects like a Telegram automation bot, a recipe app (Rasoi Mitra), a math learning tool (Socratic Math Mentor), and a blog automation agent."
  },
  {
    question: "Does Neelam provide YouTube SEO services?",
    answer: "Yes. Neelam specializes in YouTube SEO using tools like vidIQ for keyword research, title optimization, description writing, and thumbnail strategy. She helps creators and businesses grow their channels organically."
  },
  {
    question: "What is Neelam's approach to digital marketing?",
    answer: "Neelam combines content creation, social media management, and SEO fundamentals. She focuses on building real audiences through valuable content rather than just chasing metrics. AI tools assist in content ideation and optimization."
  },
  {
    question: "Can Neelam help with video editing and content creation?",
    answer: "Yes. Neelam edits short-form videos and reels using CapCut, creates visual content, and uses AI tools for ideation and editing assistance. She helps brands create engaging content for social media platforms."
  },
  {
    question: "What Python automation projects has Neelam built?",
    answer: "Neelam has built a Telegram bot with auto-replies and scheduled messages, a blog automation agent (CalcNotebook Blog Agent) that generates content, and various task automation scripts for repetitive workflows."
  },
  {
    question: "Is Neelam available for freelance work?",
    answer: "Yes. Neelam takes on freelance projects for website development, digital marketing, social media management, and automation. She works with small businesses in Kaithal, Haryana, and nearby areas. Contact via the form on this page."
  },
  {
    question: "What makes Neelam different from other developers?",
    answer: "Neelam combines technical skills (coding, automation) with creative skills (video editing, content creation, digital marketing). She uses AI tools daily to accelerate development and content creation, delivering complete digital solutions."
  },
  {
    question: "How long does a typical website project take?",
    answer: "Project timelines vary based on scope. A simple business website takes 1-2 weeks, while custom web apps with automation can take 3-6 weeks. Neelam provides clear timelines during the initial consultation."
  },
  {
    question: "Does Neelam offer ongoing maintenance and support?",
    answer: "Yes. Neelam offers website maintenance, content updates, SEO monitoring, and social media management on a retainer basis. This ensures your digital presence stays current and effective."
  }
];

let faqAddedCount = 0;
const MAX_FAQ_EXTRA = FAQ_EXTRA_QUESTIONS.length;

function createFaqItem(question, answer, index) {
  const details = document.createElement('details');
  details.className = 'faq-item reveal';
  details.dataset.faqId = `extra-${index}`;
  details.innerHTML = `
    <summary class="faq-item__summary">
      <span class="faq-item__question">${question}</span>
      <span class="faq-item__icon" aria-hidden="true"></span>
    </summary>
    <div class="faq-item__wrap">
      <div class="faq-item__body">
        <p>${answer}</p>
      </div>
    </div>
  `;
  return details;
}

function initFaqDynamic() {
  const faqList = document.getElementById('faq-list');
  if (!faqList) return;

  const faqItems = faqList.querySelectorAll('.faq-item[data-faq-id]');

  faqItems.forEach((item) => {
    item.addEventListener('toggle', function () {
      if (this.open && faqAddedCount < MAX_FAQ_EXTRA) {
        // Add a small delay for smooth animation
        setTimeout(() => {
          const extraQuestion = FAQ_EXTRA_QUESTIONS[faqAddedCount];
          const newItem = createFaqItem(extraQuestion.question, extraQuestion.answer, faqAddedCount);
          faqList.appendChild(newItem);

          // Trigger reveal animation for the new item
          requestAnimationFrame(() => {
            newItem.classList.add('in-view');
          });

          // Re-initialize Lucide icons for the new item
          if (window.lucide && typeof window.lucide.createIcons === 'function') {
            window.lucide.createIcons({
              attrs: { 'aria-hidden': 'true', 'focusable': 'false' },
            });
          }

          faqAddedCount++;
        }, 300);
      }
    });
  });
}

initFaqDynamic();


/* ==========================================================================
   17. BACK TO TOP BUTTON
   Fades in once the page is scrolled past 400px.
   ========================================================================== */
function initBackToTop() {
  const button = $("#to-top");
  if (!button) return;

  const THRESHOLD = 400;

  function handleScroll() {
    button.classList.toggle("visible", window.scrollY > THRESHOLD);
  }

  window.addEventListener("scroll", handleScroll, { passive: true });
  handleScroll();

  button.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: prefersReducedMotion ? "auto" : "smooth" });
  });
}

initBackToTop();
/* ==========================================================================
   JOURNEY — alternating centre timeline
   --------------------------------------------------------------------------
   1) Each milestone card slides in from its own side as it reaches the
      screen, and its dot pulses once.
   2) The vertical rule down the middle fills up as you scroll past it.
   The card layout itself is pure CSS (:nth-child picks the side).
   ========================================================================== */
(function initJourney() {
  const box = document.getElementById('journeyBox');
  const fill = document.getElementById('journeyLineFill');
  const items = document.querySelectorAll('.journey-item');
  if (!box || !fill || !items.length) return;

  /* If the user prefers less motion, show everything at once. */
  if (prefersReducedMotion || !('IntersectionObserver' in window)) {
    items.forEach(function (el) { el.classList.add('in-view'); });
    fill.style.height = '100%';
    return;
  }

  /* 1) Slide each card in from its side, and pulse its dot. */
  const itemObserver = new IntersectionObserver(function (entries, observer) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('in-view');
      observer.unobserve(entry.target);       // once is enough
    });
  }, { threshold: 0.25 });
  items.forEach(function (el) { itemObserver.observe(el); });

  /* 2) Grow the centre rule as the section passes through the screen. */
  function updateLine() {
    const rect = box.getBoundingClientRect();
    const anchor = window.innerHeight * 0.7;      // starts filling at 70% down
    const progress = (anchor - rect.top) / rect.height;
    const clamped = Math.min(1, Math.max(0, progress));
    fill.style.height = (clamped * 100) + '%';
  }

  let ticking = false;
  window.addEventListener('scroll', function () {
    if (ticking) return;
    requestAnimationFrame(function () { updateLine(); ticking = false; });
    ticking = true;
  }, { passive: true });

  window.addEventListener('resize', updateLine);
  updateLine();
})();
/* ===== HERO: typing effect =====
   Types each word, pauses, deletes it, then moves to the next one.
   Edit the `words` array below to change what it cycles through. */
(function initTyping() {
  const el = document.getElementById('typed-text');
  if (!el) return;

    // Change these words anytime.
    // "Web Developer in Kaithal, Haryana" is first on purpose: the animation
    // starts there on every page load, so the location line is what a visitor
    // (and a crawler reading the rendered text) meets first. The remaining
    // phrases are unchanged and still cycle as before.
    const words = [
      'Web Developer in Kaithal, Haryana',
      'Web Developer',
      'Aspiring Full Stack Developer',
      'YouTube SEO',
      'Video Editing',
      'Social Media Management',
      'AI Content Creation'
    ];

  // Less-motion users: no animation, just list them all at once.
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    el.textContent = words.join(' · ');
    return;
  }

  let w = 0;          // which word
  let i = 0;          // how many letters are shown
  let deleting = false;
  let timer = null;

  function tick() {
    const word = words[w];
    el.textContent = word.slice(0, i);

    let delay = deleting ? 45 : 90;                 // deleting is faster than typing
    if (!deleting && i === word.length) {           // full word typed: pause
      deleting = true;
      delay = 1600;
    } else if (deleting && i === 0) {               // fully deleted: next word
      deleting = false;
      w = (w + 1) % words.length;
      delay = 400;
    }
    i += deleting ? -1 : 1;
    timer = setTimeout(tick, delay);
  }

  function start() { if (timer === null) tick(); }

  function stop() {
    if (timer === null) return;
    clearTimeout(timer);
    timer = null;
  }

  // Don't keep typing away in a background tab.
  document.addEventListener('visibilitychange', function () {
    document.hidden ? stop() : start();
  });

  // The hero is at the very top, so stop once the user has scrolled past it.
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) { entry.isIntersecting ? start() : stop(); });
    }, { threshold: 0 }).observe(el.parentElement);
  } else {
    start();
  }
})();


/* ==========================================================================
   ABOUT: SCROLL-DIRECTION AWARE INTRO
   --------------------------------------------------------------------------
   The photo and the text slide in from opposite sides, and WHICH side
   depends on which way you are scrolling:

     coming DOWN from the hero  -> photo slides in from the left,
                                    text slides in from the right
     coming UP from "My Story"  -> photo slides in from the right,
                                    text slides in from the left

   Unlike the normal one-shot .reveal, this re-runs every time the block
   enters the screen, so scrolling back up replays it in the other
   direction. The matching CSS lives in the
   "SCROLL-DIRECTION AWARE INTRO" block in style.css.
   ========================================================================== */
(function initAboutScrollAnimations() {
  const intro = $('.about-intro');
  const story = $('.about-story');
  if (!intro && !story) return;

  /* Less-motion users just get everything, static. */
  if (prefersReducedMotion || !('IntersectionObserver' in window)) {
    intro?.classList.add('in-view');
    story?.classList.add('in-view');
    return;
  }

  /* --- Track which way the page is scrolling --- */
  let lastY = window.scrollY;
  let direction = 'down';

  window.addEventListener('scroll', function () {
    const y = window.scrollY;
    if (y === lastY) return;
    direction = y > lastY ? 'down' : 'up';
    lastY = y;
  }, { passive: true });

  /* --- Add .in-view on entry, remove it on exit so it can replay --- */
  const observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) {
        entry.target.classList.remove('in-view');
        return;
      }
      // Stamp the direction we were travelling in, then slide in.
      entry.target.dataset.scrollDir = direction;
      entry.target.classList.add('in-view');
    });
  }, { threshold: 0.15 });

  [intro, story].forEach(function (el) { if (el) observer.observe(el); });
})();
