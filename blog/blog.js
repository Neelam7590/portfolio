/* ==========================================================================
   blog.js — Blog-only JavaScript (no dependencies)
   Loaded only on blog pages
   ========================================================================== */

(function () {
  'use strict';

  // --- Small helpers ---
  const $ = (sel, scope = document) => scope.querySelector(sel);
  const $$ = (sel, scope = document) => [...scope.querySelectorAll(sel)];

  // --- Show toolbar when JS is enabled ---
  const toolbar = $('#blog-toolbar') || $('.blog-toolbar');
  if (toolbar) toolbar.hidden = false;

  // --- Listing page: search + tag filter + load more ---
  function initListing() {
    const grid = $('#blog-grid');
    const search = $('#blog-search');
    const tagChips = $$('.blog-tag-chip');
    const loadMoreBtn = $('#blog-load-more-btn');
    const loadMoreRow = $('#blog-load-more');
    if (!grid) return;

    const cards = $$('.blog-card', grid);
    const POSTS_PER_PAGE = 9;
    let visibleCount = POSTS_PER_PAGE;
    let currentTag = 'all';
    let searchQuery = '';

    function filterCards() {
      let shown = 0;
      cards.forEach((card, idx) => {
        const title = (card.querySelector('h3')?.textContent || '').toLowerCase();
        const excerpt = (card.querySelector('.blog-card__excerpt')?.textContent || '').toLowerCase();
        const tags = [...card.querySelectorAll('.blog-card__tag a')].map(a => a.textContent.toLowerCase());

        const matchesSearch = !searchQuery || title.includes(searchQuery) || excerpt.includes(searchQuery);
        const matchesTag = currentTag === 'all' || tags.includes(currentTag);

        const shouldShow = matchesSearch && matchesTag && shown < visibleCount;
        card.style.display = shouldShow ? '' : 'none';
        if (shouldShow) shown++;
      });

      // Show/hide load more
      const totalMatching = cards.filter(c => {
        const title = (c.querySelector('h3')?.textContent || '').toLowerCase();
        const excerpt = (c.querySelector('.blog-card__excerpt')?.textContent || '').toLowerCase();
        const tags = [...c.querySelectorAll('.blog-card__tag a')].map(a => a.textContent.toLowerCase());
        return (!searchQuery || title.includes(searchQuery) || excerpt.includes(searchQuery)) &&
               (currentTag === 'all' || tags.includes(currentTag));
      }).length;

      if (loadMoreRow) loadMoreRow.hidden = shown >= totalMatching;
    }

    // Search (debounced)
    let searchTimer;
    search?.addEventListener('input', () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        searchQuery = search.value.trim().toLowerCase();
        visibleCount = POSTS_PER_PAGE;
        filterCards();
      }, 150);
    });

    // Tag chips
    tagChips.forEach(chip => {
      chip.addEventListener('click', () => {
        tagChips.forEach(c => c.classList.toggle('is-active', c === chip));
        currentTag = chip.dataset.tag;
        visibleCount = POSTS_PER_PAGE;
        filterCards();
      });
    });

    // Load more
    loadMoreBtn?.addEventListener('click', () => {
      visibleCount += POSTS_PER_PAGE;
      filterCards();
    });

    // Initial
    filterCards();
  }

  // --- Post page: TOC active highlighting ---
  function initToc() {
    const toc = $('.blog-toc');
    const content = $('#blog-content');
    if (!toc || !content) return;

    const links = $$('a', toc);
    const headings = $$('h2[id], h3[id]', content);
    if (!headings.length) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const id = entry.target.id;
        const link = toc.querySelector(`a[href="#${id}"]`);
        if (link) link.classList.toggle('is-active', entry.isIntersecting);
      });
    }, { rootMargin: '-20% 0px -70% 0px', threshold: 0 });

    headings.forEach(h => observer.observe(h));
  }

  // --- Post page: Copy code button ---
  function initCodeCopy() {
    $$('pre', '#blog-content').forEach(pre => {
      if (pre.querySelector('.code-copy-btn')) return;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'code-copy-btn';
      btn.setAttribute('aria-label', 'Copy code');
      btn.innerHTML = '<i data-lucide="copy" aria-hidden="true"></i>';
      pre.appendChild(btn);

      btn.addEventListener('click', async () => {
        const code = pre.querySelector('code')?.textContent || pre.textContent;
        try {
          await navigator.clipboard.writeText(code);
          btn.classList.add('copied');
          btn.innerHTML = '<i data-lucide="check" aria-hidden="true"></i>';
          setTimeout(() => {
            btn.classList.remove('copied');
            btn.innerHTML = '<i data-lucide="copy" aria-hidden="true"></i>';
            safeCreateIcons();
          }, 2000);
        } catch (_) {
          btn.innerHTML = '<i data-lucide="alert-circle" aria-hidden="true"></i>';
          setTimeout(() => {
            btn.innerHTML = '<i data-lucide="copy" aria-hidden="true"></i>';
            safeCreateIcons();
          }, 2000);
        }
      });
    });

    // Re-run Lucide for new copy buttons
    safeCreateIcons();
  }

  // Safe Lucide icon creation - never breaks layout
  function safeCreateIcons() {
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      try {
        window.lucide.createIcons({ attrs: { 'aria-hidden': 'true', 'focusable': 'false' } });
      } catch (e) {
        console.warn('Lucide icon creation failed:', e.message);
      }
    }
  }

  // --- Post page: Share buttons ---
  function initShare() {
    const webShareBtn = $('.blog-share__btn--web');
    const copyBtn = $('.blog-share__btn[data-platform="copy"]');
    const canonical = $('link[rel="canonical"]')?.href || window.location.href;
    const title = document.title.replace(' | Neelam Dhiman', '');

    // Web Share API
    if (webShareBtn && navigator.share) {
      webShareBtn.hidden = false;
      webShareBtn.addEventListener('click', () => {
        navigator.share({ title, text: title, url: canonical }).catch(() => {});
      });
    }

    // Copy link
    copyBtn?.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(canonical);
        const original = copyBtn.innerHTML;
        copyBtn.innerHTML = '<i data-lucide="check" aria-hidden="true"></i>';
        safeCreateIcons();
        setTimeout(() => {
          copyBtn.innerHTML = original;
          safeCreateIcons();
        }, 2000);
      } catch (_) {}
    });
  }

  // --- Post page: Reading progress bar (reuse global or add thin one) ---
  function initReadingProgress() {
    // The global scroll-progress bar already exists at top of page
    // No extra work needed - it works across all pages
  }

  // --- Initialize based on page ---
  function init() {
    initListing();
    initToc();
    initCodeCopy();
    initShare();
    initReadingProgress();
  }

  // Run after DOM ready (script.js may run first)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();