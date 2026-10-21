/*
  ADMIN APP — login, dashboard, blog posts, publish trigger.

  SECURITY NOTE
  Hiding this dashboard is NOT security. The publishable key is shipped to
  the browser, so anyone can extract it. Every table and storage bucket this
  area touches is protected by Supabase Row Level Security policies that check
  the authenticated user (auth.uid()). The admin only talks to Supabase with
  the signed-in user's access token.
*/
(function () {
  "use strict";

  var SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
  var GENERIC_ERROR = "Invalid email or password";
  var COVER_MAX_BYTES = 5 * 1024 * 1024;
  var COVER_MAX_WIDTH = 1600;
  var COVER_QUALITY = 0.82;
  var PUBLISH_LOCK_MS = 60000;

  var loginPanel = document.getElementById("login-panel");
  var loginForm = document.getElementById("login-form");
  var emailInput = document.getElementById("login-email");
  var passwordInput = document.getElementById("login-password");
  var submitButton = document.getElementById("login-submit");
  var errorEl = document.getElementById("login-error");

  var appShell = document.getElementById("app-shell");
  var view = document.getElementById("view");
  var topbarEmail = document.getElementById("dashboard-email");
  var logoutButton = document.getElementById("logout");
  var publishButton = document.getElementById("publish-btn");
  var menuToggle = document.getElementById("menu-toggle");
  var sidebarOverlay = document.getElementById("sidebar-overlay");
  var toastEl = document.getElementById("toast");
  var navItems = Array.prototype.slice.call(document.querySelectorAll(".nav-item[data-nav]"));

  var client = null;
  var currentSession = null;
  var currentHash = "";
  var viewToken = 0;
  var editorState = null;
  var flash = null;
  var toastTimer = null;
  var signingOut = false;
  var publishLockUntil = 0;
  var publishTimer = null;

  function readConfig(name) {
    if (name === "url") {
      return typeof SUPABASE_URL === "string" ? SUPABASE_URL : "";
    }
    return typeof SUPABASE_PUBLISHABLE_KEY === "string" ? SUPABASE_PUBLISHABLE_KEY : "";
  }

  var supabaseUrl = readConfig("url").replace(/\/+$/, "");
  var supabaseKey = readConfig("key");
  var isConfigured =
    supabaseUrl !== "" &&
    supabaseKey !== "" &&
    supabaseUrl !== "PASTE_PROJECT_URL" &&
    supabaseKey !== "PASTE_PUBLISHABLE_KEY";

  if (isConfigured && window.supabase && typeof window.supabase.createClient === "function") {
    try {
      client = window.supabase.createClient(supabaseUrl, supabaseKey);
    } catch (_) {
      client = null;
    }
  }

  /* ---------------- small helpers ---------------- */

  function el(tag, props, children) {
    var node = document.createElement(tag);
    if (props) {
      Object.keys(props).forEach(function (key) {
        var value = props[key];
        if (value === null || value === undefined || value === false) return;
        if (key === "text") {
          node.textContent = value;
        } else if (key === "className") {
          node.className = value;
        } else if (key === "dataset") {
          Object.keys(value).forEach(function (dataKey) {
            node.dataset[dataKey] = value[dataKey];
          });
        } else if (key.slice(0, 2) === "on" && typeof value === "function") {
          node.addEventListener(key.slice(2).toLowerCase(), value);
        } else {
          node.setAttribute(key, value === true ? "" : value);
        }
      });
    }
    (children || []).forEach(function (child) {
      if (child === null || child === undefined) return;
      node.appendChild(typeof child === "string" ? document.createTextNode(child) : child);
    });
    return node;
  }

  var ICONS = {
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>',
    edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"></path><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"></path></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path></svg>',
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>',
    external: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"></polyline></svg>'
  };

  function icon(name) {
    var wrapper = document.createElement("span");
    wrapper.className = "icon";
    wrapper.setAttribute("aria-hidden", "true");
    wrapper.innerHTML = ICONS[name] || "";
    return wrapper;
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }

  function safeUrl(raw) {
    var url = String(raw || "").trim();
    if (!url) return "";
    if (/^(https?:\/\/|mailto:)/i.test(url) || /^(\/(?!\/)|\.{1,2}\/|#)/.test(url)) {
      return url;
    }
    return "";
  }

  function slugify(value) {
    return String(value)
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
  }

  function formatDate(value) {
    if (!value) return "—";
    var date = new Date(value);
    if (isNaN(date.getTime())) return "—";
    return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  }

  function tagList(value) {
    var seen = {};
    return String(value || "")
      .split(",")
      .map(function (tag) { return tag.trim(); })
      .filter(function (tag) {
        if (!tag || seen[tag.toLowerCase()]) return false;
        seen[tag.toLowerCase()] = true;
        return true;
      });
  }

  function wordCount(md) {
    var text = String(md || "").replace(/```[\s\S]*?```/g, " ");
    return text.replace(/[#*_`>[\]()|!-]/g, " ").trim().split(/\s+/).filter(Boolean).length;
  }

  function hasH2(md) {
    return /^##\s+\S+/m.test(String(md || ""));
  }

  function postTitle(post) {
    return String((post && post.seo_title) || (post && post.title) || "").trim();
  }

  function postDescription(post) {
    return String((post && post.seo_description) || (post && post.excerpt) || "").trim();
  }

  function seoChecklist(post) {
    var titleLength = postTitle(post).length;
    var descLength = postDescription(post).length;
    var slug = String((post && post.slug) || "");
    var excerpt = String((post && post.excerpt) || "").trim();
    var cover = String((post && post.cover_image) || "");
    var alt = String((post && post.cover_alt) || "").trim();
    var words = wordCount(post && post.content_md);

    return [
      { label: "Title length", detail: titleLength + "/60 characters", pass: titleLength > 0 && titleLength <= 60 },
      { label: "Description length", detail: descLength + " characters (target 120–160)", pass: descLength >= 120 && descLength <= 160 },
      { label: "Slug length", detail: slug ? slug.length + "/60 characters" : "Required", pass: SLUG_RE.test(slug) && slug.length >= 3 && slug.length <= 60 },
      { label: "Excerpt filled", detail: excerpt ? excerpt.length + "/160 characters" : "Empty", pass: excerpt.length > 0 && excerpt.length <= 160 },
      { label: "Cover alt filled", detail: cover ? (alt ? "Added" : "Required with a cover") : "No cover image", pass: !cover || alt.length > 0 },
      { label: "300+ words", detail: words + " words", pass: words >= 300 },
      { label: "At least one H2", detail: hasH2(post && post.content_md) ? "Found" : "Add a ## heading", pass: hasH2(post && post.content_md) }
    ];
  }

  function seoScore(post) {
    var checks = seoChecklist(post);
    var passed = checks.filter(function (check) { return check.pass; }).length;
    return Math.round((passed / checks.length) * 100);
  }

  function scoreClass(score) {
    if (score >= 80) return "score--good";
    if (score >= 50) return "score--mid";
    return "score--low";
  }

  function statusPill(status) {
    var published = status === "published";
    return el("span", {
      className: "pill " + (published ? "pill--published" : "pill--draft"),
      text: published ? "Published" : "Draft"
    });
  }

  function hideToast() {
    if (!toastEl) return;
    if (toastTimer) {
      clearTimeout(toastTimer);
      toastTimer = null;
    }
    toastEl.hidden = true;
    toastEl.textContent = "";
    toastEl.classList.remove("is-error");
  }

  function showToast(message, isError) {
    if (!toastEl) return;
    toastEl.textContent = message;
    toastEl.classList.toggle("is-error", !!isError);
    toastEl.hidden = false;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toastEl.hidden = true;
      toastEl.textContent = "";
    }, isError ? 8000 : 5000);
  }

  /* ---------------- safe markdown preview ---------------- */

  function mdLinkUrl(raw) {
    return safeUrl(raw);
  }

  function mdToHtml(md) {
    var html = escapeHtml(md || "");
    html = html.replace(/^---$/gm, "<hr>");
    html = html.replace(/^##\s+(.+)$/gm, function (_, text) {
      return '<h2 id="' + slugify(text) + '">' + text + "</h2>";
    });
    html = html.replace(/^###\s+(.+)$/gm, function (_, text) {
      return '<h3 id="' + slugify(text) + '">' + text + "</h3>";
    });
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, function (_, lang, code) {
      var cls = lang ? ' class="language-' + lang + '"' : "";
      return "<pre><code" + cls + ">" + code.trim() + "</code></pre>";
    });
    html = html.replace(/!\[([^\]]*)\]\(([^)]+?)(?:\s+&quot;([^&]*)&quot;)?\)/g, function (_, alt, src, caption) {
      var url = mdLinkUrl(src);
      if (!url) return alt;
      var cap = caption ? "<figcaption>" + caption + "</figcaption>" : "";
      return '<figure><img src="' + url + '" alt="' + alt + '" loading="lazy">' + cap + "</figure>";
    });
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, function (_, text, href) {
      var url = mdLinkUrl(href);
      if (!url) return text;
      return '<a href="' + url + '" target="_blank" rel="noopener noreferrer">' + text + "</a>";
    });
    html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
    html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
    html = html.replace(/^>\s+(.+)$/gm, "<blockquote>$1</blockquote>");
    html = html.replace(/^\|(.+)\|\n\|[\s\-:|]+\|\n((?:\|.+\|\n?)+)/gm, function (_, headerRow, bodyRows) {
      var headers = headerRow.split("|").slice(1, -1).map(function (h) { return "<th>" + h.trim() + "</th>"; }).join("");
      var rows = bodyRows.trim().split("\n").map(function (row) {
        var cells = row.split("|").slice(1, -1).map(function (c) { return "<td>" + c.trim() + "</td>"; }).join("");
        return "<tr>" + cells + "</tr>";
      }).join("");
      return '<div class="table-wrapper"><table><thead><tr>' + headers + "</tr></thead><tbody>" + rows + "</tbody></table></div>";
    });
    html = html.replace(/^[-*]\s+(.+)$/gm, "<li>$1</li>");
    html = html.replace(/^\d\.\s+(.+)$/gm, "<li>$1</li>");
    html = html.replace(/(<li>.*<\/li>\n?)+/g, function (match) { return "<ul>" + match + "</ul>"; });

    var lines = html.split("\n");
    var output = [];
    var inParagraph = false;
    lines.forEach(function (line) {
      var trimmed = line.trim();
      var isBlock = /^<(h[23]|ul|ol|li|pre|blockquote|div|table|hr|figure)/.test(trimmed);
      if (trimmed === "") {
        if (inParagraph) { output.push("</p>"); inParagraph = false; }
        output.push("");
      } else if (isBlock) {
        if (inParagraph) { output.push("</p>"); inParagraph = false; }
        output.push(line);
      } else {
        if (!inParagraph) { output.push("<p>"); inParagraph = true; }
        output.push(line);
      }
    });
    if (inParagraph) output.push("</p>");
    return output.join("\n");
  }

  /* ---------------- auth ---------------- */

  function clearError() {
    if (!errorEl) return;
    errorEl.textContent = "";
    errorEl.hidden = true;
  }

  function showLoginError() {
    if (!errorEl) return;
    errorEl.textContent = GENERIC_ERROR;
    errorEl.hidden = false;
  }

  function resetLoginForm() {
    loginForm.reset();
    emailInput.value = "";
    passwordInput.value = "";
    clearError();
  }

  function showLogin(moveFocus) {
    editorState = null;
    currentSession = null;
    if (appShell) appShell.hidden = true;
    if (loginPanel) loginPanel.hidden = false;
    if (view) view.textContent = "";
    if (topbarEmail) topbarEmail.textContent = "";
    listState = { tab: "all", query: "" };
    closeMenu();
    document.title = "Admin | Neelam Dhiman";
    resetLoginForm();
    clearPublishLock();
    if (moveFocus) emailInput.focus();
  }

  function showApp(session, moveFocus) {
    currentSession = session;
    hideToast();
    if (loginPanel) loginPanel.hidden = true;
    if (appShell) appShell.hidden = false;
    if (topbarEmail) topbarEmail.textContent = (session.user && session.user.email) || "";
    resetLoginForm();
    if (!location.hash) {
      history.replaceState(null, "", "#/dashboard");
      currentHash = "#/dashboard";
    }
    if (!currentHash) currentHash = location.hash;
    renderRoute(parseHash());
    if (moveFocus && view) view.focus();
  }

  function sessionExpired() {
    if (signingOut) return;
    signingOut = true;
    showToast("Your session expired. Please sign in again.", true);
    if (!client) {
      signingOut = false;
      showLogin(true);
      return;
    }
    client.auth
      .signOut()
      .catch(function () {
        return client.auth.signOut({ scope: "local" }).catch(function () {});
      })
      .then(function () {
        signingOut = false;
        showLogin(true);
      });
  }

  loginForm.addEventListener("submit", function (event) {
    event.preventDefault();
    clearError();

    if (!client) {
      showLoginError();
      return;
    }

    var email = emailInput.value.trim();
    var password = passwordInput.value;

    if (email === "" || password === "") {
      showLoginError();
      return;
    }

    submitButton.disabled = true;
    submitButton.setAttribute("aria-busy", "true");

    client.auth
      .signInWithPassword({ email: email, password: password })
      .then(function (result) {
        if (!result || result.error || !result.data || !result.data.session) {
          showLoginError();
          return;
        }
        passwordInput.value = "";
        showApp(result.data.session, true);
      })
      .catch(function () {
        showLoginError();
      })
      .then(function () {
        submitButton.disabled = false;
        submitButton.removeAttribute("aria-busy");
      });
  });

  [emailInput, passwordInput].forEach(function (input) {
    input.addEventListener("input", clearError);
  });

  logoutButton.addEventListener("click", function () {
    if (!client) {
      showLogin(true);
      return;
    }

    logoutButton.disabled = true;

    client.auth
      .signOut()
      .catch(function () {
        return client.auth.signOut({ scope: "local" }).catch(function () {});
      })
      .then(function () {
        logoutButton.disabled = false;
        showLogin(true);
      });
  });

  if (!client) {
    showLogin(false);
  } else {
    client.auth
      .getSession()
      .then(function (result) {
        var session = result && result.data ? result.data.session : null;
        if (session && session.user) {
          showApp(session, false);
        } else {
          showLogin(false);
        }
      })
      .catch(function () {
        showLogin(false);
      });

    client.auth.onAuthStateChange(function (event, session) {
      if (event === "SIGNED_IN" && session && session.user) {
        showApp(session, true);
      } else if (event === "SIGNED_OUT") {
        showLogin(true);
      }
    });
  }

  window.addEventListener("pageshow", function (event) {
    if (!event.persisted) return;
    resetLoginForm();
    if (!client) {
      showLogin(false);
      return;
    }
    client.auth
      .getSession()
      .then(function (result) {
        var session = result && result.data ? result.data.session : null;
        if (session && session.user) {
          if (appShell.hidden) {
            showApp(session, false);
          } else {
            currentSession = session;
          }
        } else {
          showLogin(false);
        }
      })
      .catch(function () {
        showLogin(false);
      });
  });

  /* ---------------- REST layer ---------------- */

  function restBase() {
    return supabaseUrl + "/rest/v1/";
  }

  function accessToken() {
    return currentSession && currentSession.access_token ? currentSession.access_token : "";
  }

  function headersFor(token) {
    return {
      apikey: supabaseKey,
      Authorization: "Bearer " + token
    };
  }

  async function restRequest(path, options) {
    var token = accessToken();
    if (!token) {
      sessionExpired();
      throw new Error("Your session expired.");
    }

    var opts = options || {};
    var headers = Object.assign(headersFor(token), opts.headers || {});
    var response;
    try {
      response = await fetch(restBase() + path, {
        method: opts.method || "GET",
        headers: headers,
        body: opts.body,
        cache: "no-store"
      });
    } catch (_) {
      throw new Error("Network error. Check your connection and try again.");
    }

    if (response.status === 401) {
      sessionExpired();
      throw new Error("Your session expired.");
    }

    if (!response.ok) {
      if (response.status === 403) {
        throw new Error("You do not have permission to do that.");
      }
      if (response.status === 409) {
        throw new Error("That value is already in use.");
      }
      throw new Error("Request failed (" + response.status + "). Please try again.");
    }

    if (response.status === 204) return null;
    var text = await response.text();
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch (_) {
      throw new Error("Unexpected response from the server.");
    }
  }

  async function listPosts() {
    var rows = await restRequest("posts?select=*&order=updated_at.desc");
    return Array.isArray(rows) ? rows : [];
  }

  async function getPost(id) {
    var rows = await restRequest("posts?id=eq." + encodeURIComponent(id) + "&select=*");
    return Array.isArray(rows) && rows.length ? rows[0] : null;
  }

  async function slugTaken(slug, excludeId) {
    var rows = await restRequest("posts?slug=eq." + encodeURIComponent(slug) + "&select=id");
    return Array.isArray(rows) && rows.some(function (row) { return !excludeId || row.id !== excludeId; });
  }

  async function safeCount(path) {
    try {
      var rows = await restRequest(path);
      return Array.isArray(rows) ? rows.length : 0;
    } catch (error) {
      if (error && error.message === "Your session expired.") throw error;
      return 0;
    }
  }

  /* ---------------- routing ---------------- */

  var TITLES = {
    dashboard: "Dashboard",
    posts: "Blog posts",
    projects: "Projects",
    images: "Images",
    skills: "Skills",
    messages: "Messages",
    settings: "Settings"
  };

  var PLACEHOLDERS = ["projects", "images", "skills", "messages", "settings"];

  function parseHash() {
    var raw = String(location.hash || "").replace(/^#\/?/, "").replace(/\/+$/, "");
    if (!raw || raw === "dashboard") return { name: "dashboard" };
    var parts = raw.split("/");
    if (parts[0] === "posts") {
      if (parts.length === 1) return { name: "posts" };
      if (parts.length === 2 && parts[1] === "new") return { name: "editor", id: null };
      if (parts.length === 2 && parts[1]) {
        var id;
        try {
          id = decodeURIComponent(parts[1]);
        } catch (_) {
          id = "";
        }
        if (id) return { name: "editor", id: id };
      }
    }
    if (parts.length === 1 && PLACEHOLDERS.indexOf(parts[0]) !== -1) {
      return { name: parts[0] };
    }
    return { name: "dashboard" };
  }

  function setActiveNav(name) {
    var target = name === "editor" ? "posts" : name;
    navItems.forEach(function (item) {
      var active = item.getAttribute("data-nav") === target;
      item.classList.toggle("is-active", active);
      if (active) {
        item.setAttribute("aria-current", "page");
      } else {
        item.removeAttribute("aria-current");
      }
    });
  }

  function renderRoute(route) {
    route = route || parseHash();
    viewToken += 1;
    var token = viewToken;
    var previousEditorId = editorState ? editorState.id : null;
    var keepEditor = route.name === "editor" && editorState && editorState.id === route.id;
    if (route.name !== "editor" || !keepEditor) {
      editorState = null;
    }
    currentHash = location.hash || "#/dashboard";
    closeMenu();
    setActiveNav(route.name);

    var title = route.name === "editor"
      ? (route.id ? "Edit post" : "New post")
      : (TITLES[route.name] || "Dashboard");
    document.title = title + " | Neelam Dhiman Admin";

    if (route.name === "dashboard") {
      renderDashboard(token);
    } else if (route.name === "posts") {
      renderPostsList(token);
    } else if (route.name === "editor") {
      renderEditor(route, token, previousEditorId);
    } else if (PLACEHOLDERS.indexOf(route.name) !== -1) {
      renderPlaceholder(route.name);
    } else {
      renderDashboard(token);
    }
  }

  window.addEventListener("hashchange", function () {
    var next = parseHash();
    var leavingEditor = editorState && editorState.dirty;
    var staying = next.name === "editor" && editorState && next.id === editorState.id;
    if (leavingEditor && !staying) {
      var ok = window.confirm("You have unsaved changes. Leave this page?");
      if (!ok) {
        history.replaceState(null, "", currentHash || "#/dashboard");
        return;
      }
    }
    renderRoute(next);
  });

  window.addEventListener("beforeunload", function (event) {
    if (editorState && editorState.dirty) {
      event.preventDefault();
      event.returnValue = "";
    }
  });

  /* ---------------- menu ---------------- */

  function openMenu() {
    appShell.classList.add("is-menu-open");
    sidebarOverlay.hidden = false;
    menuToggle.setAttribute("aria-expanded", "true");
    menuToggle.setAttribute("aria-label", "Close menu");
  }

  function closeMenu() {
    if (!appShell) return;
    appShell.classList.remove("is-menu-open");
    sidebarOverlay.hidden = true;
    menuToggle.setAttribute("aria-expanded", "false");
    menuToggle.setAttribute("aria-label", "Open menu");
  }

  menuToggle.addEventListener("click", function () {
    if (appShell.classList.contains("is-menu-open")) closeMenu();
    else openMenu();
  });

  sidebarOverlay.addEventListener("click", closeMenu);

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && appShell.classList.contains("is-menu-open")) {
      closeMenu();
      menuToggle.focus();
    }
  });

  navItems.forEach(function (item) {
    item.addEventListener("click", function () {
      if (window.matchMedia("(max-width: 820px)").matches) closeMenu();
    });
  });

  /* ---------------- publish ---------------- */

  function clearPublishLock() {
    publishLockUntil = 0;
    if (publishTimer) {
      clearTimeout(publishTimer);
      publishTimer = null;
    }
    if (publishButton) publishButton.disabled = false;
  }

  function lockPublish() {
    publishLockUntil = Date.now() + PUBLISH_LOCK_MS;
    publishButton.disabled = true;
    if (publishTimer) clearTimeout(publishTimer);
    publishTimer = setTimeout(function () {
      publishLockUntil = 0;
      publishButton.disabled = false;
      publishButton.removeAttribute("aria-busy");
      publishTimer = null;
    }, PUBLISH_LOCK_MS);
  }

  publishButton.addEventListener("click", function () {
    if (Date.now() < publishLockUntil) return;
    if (!currentSession || !currentSession.access_token) {
      sessionExpired();
      return;
    }

    publishButton.setAttribute("aria-busy", "true");
    lockPublish();

    fetch("/api/publish", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + currentSession.access_token
      }
    })
      .then(function (response) {
        if (response.status === 401) {
          sessionExpired();
          return null;
        }
        return response.json().catch(function () { return {}; }).then(function (body) {
          return { ok: response.ok && body && body.ok === true };
        });
      })
      .then(function (result) {
        if (!result) return;
        if (result.ok) {
          showToast("Rebuild started, the site updates in about 1-2 minutes.", false);
        } else {
          showToast("Could not start the rebuild. Please try again.", true);
        }
      })
      .catch(function () {
        showToast("Could not start the rebuild. Please try again.", true);
      });
  });

  /* ---------------- dashboard ---------------- */

  function pageHead(title, subtitle, actions) {
    return el("div", { className: "page-head" }, [
      el("div", null, [
        el("h1", { text: title, tabindex: "-1" }),
        subtitle ? el("p", { className: "page-head__sub", text: subtitle }) : null
      ]),
      actions ? el("div", { className: "page-actions" }, actions) : null
    ]);
  }

  function statCard(value, label) {
    return el("div", { className: "stat" }, [
      el("span", { className: "stat__value", text: String(value) }),
      el("span", { className: "stat__label", text: label })
    ]);
  }

  async function renderDashboard(token) {
    view.textContent = "";
    var heading = pageHead("Dashboard", "Overview of your portfolio content.", [
      el("a", { className: "btn", href: "#/posts/new" }, [icon("plus"), document.createTextNode("New post")])
    ]);
    view.appendChild(heading);
    var loading = el("p", { className: "loading", text: "Loading dashboard…" });
    view.appendChild(loading);

    try {
      var results = await Promise.all([
        listPosts(),
        safeCount("projects?select=id"),
        safeCount("messages?select=id&is_read=eq.false")
      ]);
      if (token !== viewToken) return;

      var posts = results[0];
      var projectCount = results[1];
      var unreadCount = results[2];
      var published = posts.filter(function (post) { return post.status === "published"; });
      var drafts = posts.filter(function (post) { return post.status !== "published"; });

      loading.remove();
      view.appendChild(el("div", { className: "stats" }, [
        statCard(published.length, "Published posts"),
        statCard(drafts.length, "Drafts"),
        statCard(projectCount, "Projects"),
        statCard(unreadCount, "Unread messages")
      ]));

      var recent = posts.slice(0, 5);
      var recentCard = el("section", { className: "card", "aria-labelledby": "h-recent" }, [
        el("h2", { id: "h-recent", text: "Recent posts" })
      ]);
      if (recent.length === 0) {
        recentCard.appendChild(el("p", { className: "muted small", text: "No posts yet. Create your first one." }));
      } else {
        var list = el("ul", { className: "list" });
        recent.forEach(function (post) {
          var right = el("span", { className: "small muted" }, [
            statusPill(post.status),
            document.createTextNode(" " + formatDate(post.updated_at || post.created_at))
          ]);
          list.appendChild(el("li", null, [
            el("a", { href: "#/posts/" + encodeURIComponent(post.id), text: post.title || "(untitled)" }),
            right
          ]));
        });
        recentCard.appendChild(list);
      }

      var quickCard = el("section", { className: "card", "aria-labelledby": "h-quick" }, [
        el("h2", { id: "h-quick", text: "Quick actions" }),
        el("div", { className: "quick" }, [
          el("a", { className: "btn btn--secondary btn--block", href: "#/posts/new" }, [icon("plus"), document.createTextNode("New post")]),
          el("a", { className: "btn btn--ghost btn--block", href: "#/posts", text: "Manage all posts" })
        ])
      ]);

      view.appendChild(el("div", { className: "dash-grid" }, [recentCard, quickCard]));
    } catch (error) {
      if (token !== viewToken) return;
      loading.remove();
      if (error.message !== "Your session expired.") {
        view.appendChild(el("div", { className: "empty" }, [
          el("strong", { text: "Could not load the dashboard" }),
          el("p", { text: error.message })
        ]));
      }
    }
  }

  /* ---------------- posts list ---------------- */

  var listState = { tab: "all", query: "" };

  async function renderPostsList(token) {
    view.textContent = "";
    var heading = pageHead("Blog posts", "Write, edit and delete posts. Drafts never appear on the public site.", [
      el("a", { className: "btn", href: "#/posts/new" }, [icon("plus"), document.createTextNode("New post")])
    ]);
    view.appendChild(heading);
    var loading = el("p", { className: "loading", text: "Loading posts…" });
    view.appendChild(loading);

    var posts;
    try {
      posts = await listPosts();
    } catch (error) {
      if (token !== viewToken) return;
      loading.remove();
      if (error.message !== "Your session expired.") {
        view.appendChild(el("div", { className: "empty" }, [
          el("strong", { text: "Could not load posts" }),
          el("p", { text: error.message })
        ]));
      }
      return;
    }
    if (token !== viewToken) return;
    loading.remove();

    var wrapper = el("div");
    view.appendChild(wrapper);

    function counts() {
      return {
        all: posts.length,
        published: posts.filter(function (post) { return post.status === "published"; }).length,
        draft: posts.filter(function (post) { return post.status !== "published"; }).length
      };
    }

    function filterPosts() {
      var tab = listState.tab;
      var query = listState.query.trim().toLowerCase();
      return posts.filter(function (post) {
        if (tab === "published" && post.status !== "published") return false;
        if (tab === "draft" && post.status === "published") return false;
        if (!query) return true;
        var haystack = [post.title, post.slug, post.category, post.excerpt, (post.tags || []).join(" ")].join(" ").toLowerCase();
        return haystack.indexOf(query) !== -1;
      });
    }

    function drawRows(tbody) {
      tbody.textContent = "";
      var rows = filterPosts();
      if (rows.length === 0) {
        tbody.appendChild(el("tr", null, [
          el("td", { colspan: "7", className: "empty", text: "No posts match this view." })
        ]));
        return;
      }
      rows.forEach(function (post) {
        var score = seoScore(post);
        var editLink = el("a", {
          className: "icon-action",
          href: "#/posts/" + encodeURIComponent(post.id),
          "aria-label": "Edit " + (post.title || "post")
        }, [icon("edit")]);

        var deleteButton = el("button", {
          type: "button",
          className: "icon-action is-danger",
          "aria-label": "Delete " + (post.title || "post")
        }, [icon("trash")]);
        deleteButton.addEventListener("click", function () {
          var confirmed = window.confirm('Delete "' + (post.title || "this post") + '"? This cannot be undone.');
          if (!confirmed) return;
          deleteButton.disabled = true;
          restRequest("posts?id=eq." + encodeURIComponent(post.id), {
            method: "DELETE",
            headers: { Prefer: "return=minimal" }
          })
            .then(function () {
              posts = posts.filter(function (item) { return item.id !== post.id; });
              listState = { tab: listState.tab, query: listState.query };
              redraw();
              showToast("Post deleted.", false);
            })
            .catch(function (error) {
              deleteButton.disabled = false;
              if (error.message !== "Your session expired.") showToast(error.message, true);
            });
        });

        var titleCell = el("td", null, [
          el("a", {
            className: "cell-title",
            href: "/blog/" + encodeURIComponent(post.slug) + "/",
            target: "_blank",
            rel: "noopener noreferrer",
            text: post.title || "(untitled)"
          }),
          el("span", { className: "cell-sub", text: "/blog/" + (post.slug || "") })
        ]);

        tbody.appendChild(el("tr", null, [
          titleCell,
          el("td", { text: post.category || "—" }),
          el("td", null, [statusPill(post.status)]),
          el("td", null, [el("span", { className: "score " + scoreClass(score), text: String(score) })]),
          el("td", { text: formatDate(post.published_at || post.created_at) }),
          el("td", { text: formatDate(post.updated_at) }),
          el("td", null, [el("div", { className: "row-actions" }, [editLink, deleteButton])])
        ]));
      });
    }

    function draw() {
      wrapper.textContent = "";
      var c = counts();

      var tabButtons = [
        { key: "all", label: "All", count: c.all },
        { key: "published", label: "Published", count: c.published },
        { key: "draft", label: "Drafts", count: c.draft }
      ].map(function (tab) {
        var button = el("button", {
          type: "button",
          role: "tab",
          className: "tab" + (listState.tab === tab.key ? " is-active" : ""),
          "aria-selected": listState.tab === tab.key ? "true" : "false",
          text: tab.label + " (" + tab.count + ")"
        });
        button.addEventListener("click", function () {
          listState.tab = tab.key;
          draw();
        });
        return button;
      });

      var search = el("input", {
        type: "search",
        className: "search",
        id: "post-search",
        placeholder: "Search posts…",
        "aria-label": "Search posts",
        value: listState.query
      });
      search.addEventListener("input", function () {
        listState.query = search.value;
        drawRows(tbody);
      });

      var toolbar = el("div", { className: "toolbar" }, [
        el("div", { className: "tabs", role: "tablist", "aria-label": "Filter posts" }, tabButtons),
        search
      ]);

      var tbody = el("tbody");
      var table = el("table", null, [
        el("thead", null, [
          el("tr", null, [
            el("th", { scope: "col", text: "Title" }),
            el("th", { scope: "col", text: "Category" }),
            el("th", { scope: "col", text: "Status" }),
            el("th", { scope: "col", text: "SEO" }),
            el("th", { scope: "col", text: "Date" }),
            el("th", { scope: "col", text: "Updated" }),
            el("th", { scope: "col", text: "Actions" })
          ])
        ]),
        tbody
      ]);

      drawRows(tbody);

      wrapper.appendChild(toolbar);
      wrapper.appendChild(el("div", { className: "table-wrap" }, [table]));
      if (search.value) {
        search.focus();
        search.setSelectionRange(search.value.length, search.value.length);
      }
    }

    function redraw() {
      draw();
    }

    draw();
  }

  /* ---------------- editor ---------------- */

  function nextCoverPreviewUrl(url) {
    var safe = safeUrl(url);
    return safe || "";
  }

  function readEditorForm() {
    var form = document.getElementById("post-form");
    if (!form) return null;
    return {
      title: document.getElementById("post-title").value,
      slug: document.getElementById("post-slug").value.trim(),
      excerpt: document.getElementById("post-excerpt").value,
      category: document.getElementById("post-category").value,
      tags: document.getElementById("post-tags").value,
      content_md: document.getElementById("post-content").value,
      seo_title: document.getElementById("post-seo-title").value,
      seo_description: document.getElementById("post-seo-description").value,
      cover_alt: document.getElementById("post-cover-alt").value,
      status: document.getElementById("post-status").value
    };
  }

  function currentEditorData() {
    var formData = readEditorForm();
    var data = Object.assign({}, editorState ? editorState.data : {}, formData || {});
    if (editorState) data.cover_image = editorState.data.cover_image || "";
    return data;
  }

  function updateSeoPanel() {
    if (!editorState) return;
    var data = currentEditorData();
    var checks = seoChecklist(data);
    var score = seoScore(data);
    var valueEl = document.getElementById("seo-score-value");
    var listEl = document.getElementById("seo-checklist");
    if (valueEl) {
      valueEl.textContent = String(score);
      valueEl.className = "seo-score__value " + (score >= 80 ? "is-good" : score >= 50 ? "is-mid" : "is-low");
    }
    if (listEl) {
      listEl.textContent = "";
      checks.forEach(function (check) {
        listEl.appendChild(el("li", { className: check.pass ? "is-pass" : "is-fail" }, [
          el("span", { className: "mark", text: check.pass ? "✓" : "!" }),
          el("span", null, [
            el("span", { text: check.label }),
            el("span", { className: "detail", text: " — " + check.detail })
          ])
        ]));
      });
    }
  }

  function updateCounters() {
    var excerpt = document.getElementById("post-excerpt");
    var seoTitle = document.getElementById("post-seo-title");
    var seoDescription = document.getElementById("post-seo-description");
    if (excerpt) {
      var excerptCount = document.getElementById("excerpt-count");
      excerptCount.textContent = excerpt.value.length + "/160";
      excerptCount.classList.toggle("is-over", excerpt.value.length > 160);
    }
    if (seoTitle) {
      var titleCount = document.getElementById("seo-title-count");
      titleCount.textContent = seoTitle.value.length + "/60";
      titleCount.classList.toggle("is-over", seoTitle.value.length > 60);
    }
    if (seoDescription) {
      var descCount = document.getElementById("seo-desc-count");
      descCount.textContent = seoDescription.value.length + " (target 120–160)";
      descCount.classList.toggle("is-over", seoDescription.value.length > 160);
      descCount.classList.toggle("is-near", seoDescription.value.length > 0 && seoDescription.value.length < 120);
    }
  }

  function updatePreview() {
    var content = document.getElementById("post-content");
    var preview = document.getElementById("md-preview");
    if (!content || !preview) return;
    preview.innerHTML = mdToHtml(content.value);
  }

  function markEditorDirty() {
    if (!editorState) return;
    editorState.dirty = true;
  }

  function setFieldError(id, message) {
    var field = document.getElementById(id);
    var error = document.getElementById(id + "-error");
    if (field) {
      field.classList.toggle("is-invalid", !!message);
      if (message) field.setAttribute("aria-invalid", "true");
      else field.removeAttribute("aria-invalid");
    }
    if (error) {
      error.textContent = message || "";
      error.hidden = !message;
    }
  }

  function validateSlugFormat() {
    var slug = document.getElementById("post-slug").value.trim();
    if (!slug) {
      setFieldError("post-slug", "Slug is required.");
      return false;
    }
    if (!SLUG_RE.test(slug)) {
      setFieldError("post-slug", "Use lowercase letters, numbers and single hyphens only, e.g. my-post-name.");
      return false;
    }
    setFieldError("post-slug", "");
    return true;
  }

  var slugCheckSeq = 0;

  function validateSlugUnique() {
    if (!editorState) return;
    if (!validateSlugFormat()) return;
    var slug = document.getElementById("post-slug").value.trim();
    var seq = ++slugCheckSeq;
    var hint = document.getElementById("post-slug-hint");
    if (hint) hint.textContent = "Checking availability…";
    slugTaken(slug, editorState.id)
      .then(function (taken) {
        if (!editorState || seq !== slugCheckSeq) return;
        if (taken) {
          setFieldError("post-slug", "That slug is already used by another post.");
          if (hint) hint.textContent = "Slug must be unique.";
        } else if (hint) {
          hint.textContent = "Lowercase letters, numbers and single hyphens. This URL will be /blog/" + slug + "/.";
        }
      })
      .catch(function (error) {
        if (error.message !== "Your session expired." && hint) hint.textContent = "Could not check the slug yet.";
      });
  }

  function setCoverPreview() {
    if (!editorState) return;
    var preview = document.getElementById("cover-preview");
    var image = document.getElementById("cover-preview-img");
    var remove = document.getElementById("cover-remove");
    if (!preview || !image || !remove) return;
    var url = nextCoverPreviewUrl(editorState.data.cover_image);
    if (url) {
      image.src = url;
      image.alt = document.getElementById("post-cover-alt").value || "Cover preview";
      preview.hidden = false;
      remove.hidden = false;
    } else {
      image.removeAttribute("src");
      image.alt = "";
      preview.hidden = true;
      remove.hidden = true;
    }
  }

  function setCoverStatus(message, isError) {
    var status = document.getElementById("cover-status");
    if (!status) return;
    status.textContent = message || "";
    status.classList.toggle("is-error", !!isError);
    status.classList.toggle("field-error", !!isError);
    status.classList.toggle("field-hint", !isError);
    status.hidden = !message;
  }

  function loadImage(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error("Could not read that image."));
      };
      img.src = url;
    });
  }

  function makeUuid() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }
    var bytes = new Uint8Array(16);
    window.crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    var hex = Array.prototype.map.call(bytes, function (b) { return b.toString(16).padStart(2, "0"); }).join("");
    return hex.slice(0, 8) + "-" + hex.slice(8, 12) + "-" + hex.slice(12, 16) + "-" + hex.slice(16, 20) + "-" + hex.slice(20);
  }

  async function convertCover(file) {
    var img = await loadImage(file);
    var width = img.naturalWidth || img.width;
    var height = img.naturalHeight || img.height;
    if (!width || !height) throw new Error("Could not read that image.");
    var scale = Math.min(1, COVER_MAX_WIDTH / width);
    var canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    var ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not process that image.");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    var blob = await new Promise(function (resolve) {
      canvas.toBlob(resolve, "image/webp", COVER_QUALITY);
    });
    if (!blob) throw new Error("Could not convert that image to WebP.");
    return blob;
  }

  async function uploadCover(file) {
    if (!file) return;
    if (["image/jpeg", "image/png", "image/webp"].indexOf(file.type) === -1) {
      setCoverStatus("Choose a JPG, PNG or WebP image.", true);
      return;
    }
    if (file.size > COVER_MAX_BYTES) {
      setCoverStatus("That image is larger than 5 MB.", true);
      return;
    }

    var stateAtStart = editorState;
    setCoverStatus("Converting to WebP…", false);
    var input = document.getElementById("post-cover-file");
    if (input) input.disabled = true;

    try {
      var blob = await convertCover(file);
      if (!editorState || editorState !== stateAtStart) return;
      setCoverStatus("Uploading…", false);
      var base = slugify(file.name.replace(/\.[^.]+$/, "")) || "cover";
      var objectPath = "posts/" + makeUuid() + "-" + base + ".webp";
      var encodedPath = objectPath.split("/").map(encodeURIComponent).join("/");
      var response = await fetch(supabaseUrl + "/storage/v1/object/site-images/" + encodedPath, {
        method: "POST",
        headers: {
          apikey: supabaseKey,
          Authorization: "Bearer " + accessToken(),
          "Content-Type": "image/webp",
          "x-upsert": "false",
          "cache-control": "3600"
        },
        body: blob
      });
      if (response.status === 401) {
        sessionExpired();
        return;
      }
      if (!response.ok) {
        throw new Error("Upload failed. Please try again.");
      }
      var publicUrl = supabaseUrl + "/storage/v1/object/public/site-images/" + encodedPath;
      if (!editorState || editorState !== stateAtStart) return;
      editorState.data.cover_image = publicUrl;
      setCoverPreview();
      setCoverStatus("Cover uploaded.", false);
      markEditorDirty();
      updateSeoPanel();
    } catch (error) {
      if (error.message !== "Your session expired.") setCoverStatus(error.message, true);
    } finally {
      if (input) input.disabled = false;
      if (editorState && editorState === stateAtStart) {
        if (input) input.value = "";
      }
    }
  }

  function readFormPost() {
    var data = readEditorForm();
    return {
      title: data.title.trim(),
      slug: data.slug,
      excerpt: data.excerpt.trim(),
      content_md: data.content_md,
      category: data.category.trim(),
      tags: tagList(data.tags),
      cover_image: editorState.data.cover_image || "",
      cover_alt: data.cover_alt.trim(),
      seo_title: data.seo_title.trim(),
      seo_description: data.seo_description.trim(),
      status: data.status === "published" ? "published" : "draft"
    };
  }

  function validateEditor(post) {
    var errors = [];
    setFieldError("post-title", "");
    setFieldError("post-slug", "");
    setFieldError("post-excerpt", "");
    setFieldError("post-cover-alt", "");

    if (!post.title) {
      setFieldError("post-title", "Title is required.");
      errors.push("title");
    }
    if (!post.slug) {
      setFieldError("post-slug", "Slug is required.");
      errors.push("slug");
    } else if (!SLUG_RE.test(post.slug)) {
      setFieldError("post-slug", "Use lowercase letters, numbers and single hyphens only.");
      errors.push("slug");
    }
    if (post.excerpt.length > 160) {
      setFieldError("post-excerpt", "Keep the excerpt to 160 characters or fewer.");
      errors.push("excerpt");
    }
    if (post.cover_image && !post.cover_alt) {
      setFieldError("post-cover-alt", "Cover alt text is required when a cover image is added.");
      errors.push("cover");
    }
    return errors;
  }

  function showFormMessage(message, isError) {
    var box = document.getElementById("form-message");
    if (!box) return;
    if (!message) {
      box.hidden = true;
      box.textContent = "";
      return;
    }
    box.textContent = message;
    box.className = "form-message " + (isError ? "is-error" : "is-ok");
    box.hidden = false;
  }

  async function savePost(mode) {
    if (!editorState || editorState.saving) return;
    var post = readFormPost();
    var errors = validateEditor(post);
    if (errors.length) {
      showFormMessage("Please fix the highlighted fields.", true);
      var first = document.getElementById(errors[0] === "cover" ? "post-cover-alt" : "post-" + errors[0]);
      if (first) first.focus();
      return;
    }

    var token = accessToken();
    if (!token) {
      sessionExpired();
      return;
    }

    editorState.saving = true;
    showFormMessage("Checking slug…", false);
    var saveButtons = Array.prototype.slice.call(document.querySelectorAll("[data-save]"));
    saveButtons.forEach(function (button) { button.disabled = true; });

    try {
      var taken = await slugTaken(post.slug, editorState.id);
      if (taken) {
        setFieldError("post-slug", "That slug is already used by another post.");
        showFormMessage("That slug is already in use. Choose a different one.", true);
        document.getElementById("post-slug").focus();
        return;
      }
    } catch (error) {
      if (error.message !== "Your session expired.") showFormMessage(error.message, true);
      return;
    } finally {
      editorState.saving = false;
      saveButtons.forEach(function (button) { button.disabled = false; });
    }

    var now = new Date().toISOString();
    var payload = {
      title: post.title,
      slug: post.slug,
      excerpt: post.excerpt,
      content_md: post.content_md,
      category: post.category,
      tags: post.tags,
      cover_image: post.cover_image || null,
      cover_alt: post.cover_image ? post.cover_alt : "",
      seo_title: post.seo_title,
      seo_description: post.seo_description,
      updated_at: now
    };

    if (mode === "publish") {
      payload.status = "published";
      payload.published_at = editorState.data.published_at || now;
    } else {
      payload.status = "draft";
      payload.published_at = editorState.data.published_at || null;
    }

    editorState.saving = true;
    saveButtons.forEach(function (button) { button.disabled = true; });
    showFormMessage(mode === "publish" ? "Publishing…" : "Saving draft…", false);

    try {
      var result;
      if (editorState.id) {
        result = await restRequest("posts?id=eq." + encodeURIComponent(editorState.id), {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Prefer: "return=representation" },
          body: JSON.stringify(payload)
        });
      } else {
        result = await restRequest("posts", {
          method: "POST",
          headers: { "Content-Type": "application/json", Prefer: "return=representation" },
          body: JSON.stringify(payload)
        });
      }
      var saved = Array.isArray(result) ? result[0] : result;
      if (!saved || !saved.id) throw new Error("The post was saved but the response was unexpected.");
      editorState.id = saved.id;
      editorState.data = saved;
      editorState.dirty = false;

      var message = mode === "publish" ? "Post published." : "Draft saved.";
      flash = { message: message, error: false };
      var targetHash = "#/posts/" + encodeURIComponent(saved.id);
      if (location.hash !== targetHash) {
        location.hash = targetHash;
      } else {
        renderRoute(parseHash());
      }
    } catch (error) {
      if (error.message !== "Your session expired.") {
        showFormMessage(error.message, true);
        showToast(error.message, true);
      }
    } finally {
      editorState.saving = false;
      saveButtons.forEach(function (button) { button.disabled = false; });
    }
  }

  async function renderEditor(route, token, previousEditorId) {
    view.textContent = "";
    view.appendChild(el("a", { className: "back-link", href: "#/posts" }, [icon("back"), document.createTextNode("All posts")]));

    var loading = el("p", { className: "loading", text: route.id ? "Loading post…" : "Preparing editor…" });
    view.appendChild(loading);

    var existing = null;
    if (route.id) {
      try {
        existing = await getPost(route.id);
      } catch (error) {
        if (token !== viewToken) return;
        loading.remove();
        if (error.message !== "Your session expired.") {
          view.appendChild(el("div", { className: "empty" }, [
            el("strong", { text: "Could not load that post" }),
            el("p", { text: error.message })
          ]));
        }
        return;
      }
      if (token !== viewToken) return;
      if (!existing) {
        loading.remove();
        view.appendChild(el("div", { className: "empty" }, [
          el("strong", { text: "Post not found" }),
          el("p", { text: "It may have been deleted." }),
          el("p", null, [el("a", { href: "#/posts", text: "Back to all posts" })])
        ]));
        return;
      }
    }

    loading.remove();

    var data = existing || {
      title: "",
      slug: "",
      excerpt: "",
      category: "",
      tags: [],
      content_md: "",
      seo_title: "",
      seo_description: "",
      cover_image: "",
      cover_alt: "",
      status: "draft",
      published_at: null,
      created_at: null,
      updated_at: null
    };

    editorState = {
      id: existing ? existing.id : null,
      data: data,
      dirty: false,
      saving: false,
      slugTouched: !!existing
    };

    var heading = pageHead(
      existing ? "Edit post" : "New post",
      existing ? "/blog/" + existing.slug + "/" : "Drafts are private until you publish.",
      []
    );
    view.appendChild(heading);

    var formMessage = el("p", { id: "form-message", className: "form-message", role: "status", "aria-live": "polite", hidden: true });
    view.appendChild(formMessage);

    var titleInput = el("input", {
      id: "post-title",
      name: "title",
      type: "text",
      value: data.title || "",
      autocomplete: "off",
      "aria-describedby": "post-title-error"
    });
    var slugInput = el("input", {
      id: "post-slug",
      name: "slug",
      type: "text",
      value: data.slug || "",
      autocomplete: "off",
      spellcheck: "false",
      "aria-describedby": "post-slug-hint post-slug-error"
    });
    var excerptInput = el("textarea", {
      id: "post-excerpt",
      name: "excerpt",
      rows: "3",
      maxlength: "160",
      "aria-describedby": "excerpt-count post-excerpt-error"
    });
    excerptInput.value = data.excerpt || "";
    var categoryInput = el("input", {
      id: "post-category",
      name: "category",
      type: "text",
      value: data.category || "",
      autocomplete: "off"
    });
    var tagsInput = el("input", {
      id: "post-tags",
      name: "tags",
      type: "text",
      value: (data.tags || []).join(", "),
      autocomplete: "off",
      placeholder: "SEO, Web Development"
    });
    var coverFile = el("input", {
      id: "post-cover-file",
      name: "cover",
      type: "file",
      accept: "image/jpeg,image/png,image/webp",
      "aria-describedby": "cover-status"
    });
    var coverAltInput = el("input", {
      id: "post-cover-alt",
      name: "cover_alt",
      type: "text",
      value: data.cover_alt || "",
      autocomplete: "off",
      "aria-describedby": "post-cover-alt-error"
    });
    var contentInput = el("textarea", {
      id: "post-content",
      name: "content",
      rows: "18",
      spellcheck: "true",
      "aria-describedby": "md-preview"
    });
    contentInput.value = data.content_md || "";
    var seoTitleInput = el("input", {
      id: "post-seo-title",
      name: "seo_title",
      type: "text",
      value: data.seo_title || "",
      autocomplete: "off",
      "aria-describedby": "seo-title-count"
    });
    var seoDescriptionInput = el("textarea", {
      id: "post-seo-description",
      name: "seo_description",
      rows: "4",
      "aria-describedby": "seo-desc-count"
    });
    seoDescriptionInput.value = data.seo_description || "";
    var statusSelect = el("select", {
      id: "post-status",
      name: "status",
      className: "status-select",
      "aria-label": "Post status"
    }, [
      el("option", { value: "draft", text: "Draft" }),
      el("option", { value: "published", text: "Published" })
    ]);
    statusSelect.value = data.status === "published" ? "published" : "draft";

    var coverPreview = el("div", { className: "cover-preview", id: "cover-preview", hidden: true }, [
      el("img", { id: "cover-preview-img", alt: "" }),
      el("button", { type: "button", className: "btn btn--ghost btn--small", id: "cover-remove", hidden: true, text: "Remove cover" })
    ]);

    var slugError = el("p", { className: "field-error", id: "post-slug-error", hidden: true });
    var titleError = el("p", { className: "field-error", id: "post-title-error", hidden: true });
    var excerptError = el("p", { className: "field-error", id: "post-excerpt-error", hidden: true });
    var coverAltError = el("p", { className: "field-error", id: "post-cover-alt-error", hidden: true });

    var form = el("form", { id: "post-form", novalidate: "novalidate" }, [
      el("div", { className: "editor-layout" }, [
        el("div", null, [
          el("div", { className: "card" }, [
            el("div", { className: "form-grid" }, [
              el("div", { className: "field field--wide" }, [
                el("label", { for: "post-title", text: "Title" }),
                titleInput,
                titleError
              ]),
              el("div", { className: "field field--wide" }, [
                el("label", { for: "post-slug", text: "Slug" }),
                slugInput,
                el("p", { className: "field-hint", id: "post-slug-hint", text: "Lowercase letters, numbers and single hyphens." }),
                slugError
              ]),
              el("div", { className: "field field--wide" }, [
                el("label", { for: "post-excerpt", text: "Excerpt" }),
                excerptInput,
                el("div", { className: "counter-row" }, [
                  el("span", { className: "field-hint", text: "Short summary used in listings and search results." }),
                  el("span", { className: "counter", id: "excerpt-count", text: "0/160" })
                ]),
                excerptError
              ]),
              el("div", { className: "field" }, [
                el("label", { for: "post-category", text: "Category" }),
                categoryInput
              ]),
              el("div", { className: "field" }, [
                el("label", { for: "post-tags", text: "Tags (comma separated)" }),
                tagsInput
              ]),
              el("div", { className: "field field--wide" }, [
                el("label", { for: "post-cover-file", text: "Cover image (JPG, PNG or WebP, max 5 MB)" }),
                coverFile,
                el("p", { className: "field-hint", id: "cover-status", role: "status", "aria-live": "polite", hidden: true }),
                coverPreview
              ]),
              el("div", { className: "field field--wide" }, [
                el("label", { for: "post-cover-alt", text: "Cover alt text" }),
                coverAltInput,
                el("p", { className: "field-hint", text: "Describe the image for screen readers. Required when a cover exists." }),
                coverAltError
              ])
            ])
          ]),
          el("div", { className: "card" }, [
            el("label", { className: "field-label", for: "post-content", text: "Content (Markdown)" }),
            contentInput,
            el("span", { className: "section-label", text: "Live preview" }),
            el("div", { className: "preview", id: "md-preview" })
          ]),
          el("div", { className: "form-actions" }, [
            el("button", { type: "button", className: "btn btn--secondary", "data-save": "draft", text: "Save draft" }),
            el("button", { type: "button", className: "btn", "data-save": "publish", text: "Save and publish" }),
            el("a", { className: "btn btn--ghost", href: "#/posts", text: "Cancel" })
          ])
        ]),
        el("aside", { className: "editor-side" }, [
          el("div", { className: "card" }, [
            el("label", { className: "field-label", for: "post-status", text: "Status" }),
            statusSelect,
            el("p", { className: "field-hint", text: "Save draft keeps it private. Save and publish makes it live after the next rebuild." })
          ]),
          el("div", { className: "card" }, [
            el("h2", { text: "SEO score" }),
            el("div", { className: "seo-score" }, [
              el("span", { className: "seo-score__value", id: "seo-score-value", text: "0" }),
              el("span", { className: "muted small", text: "Improve the checklist to raise the score." })
            ]),
            el("ul", { className: "checklist", id: "seo-checklist" })
          ]),
          el("div", { className: "card" }, [
            el("div", { className: "field" }, [
              el("label", { for: "post-seo-title", text: "SEO title" }),
              seoTitleInput,
              el("div", { className: "counter-row" }, [el("span", { className: "field-hint", text: "Target up to 60 characters." }), el("span", { className: "counter", id: "seo-title-count", text: "0/60" })])
            ]),
            el("div", { className: "field" }, [
              el("label", { for: "post-seo-description", text: "SEO description" }),
              seoDescriptionInput,
              el("div", { className: "counter-row" }, [el("span", { className: "field-hint", text: "Target 120–160 characters." }), el("span", { className: "counter", id: "seo-desc-count", text: "0 (target 120–160)" })])
            ])
          ])
        ])
      ])
    ]);

    view.appendChild(form);

    if (flash) {
      showFormMessage(flash.message, !!flash.error);
      flash = null;
    }

    titleInput.addEventListener("input", function () {
      if (!editorState.slugTouched) {
        slugInput.value = slugify(titleInput.value);
      }
      markEditorDirty();
      updateCounters();
      updateSeoPanel();
    });

    slugInput.addEventListener("input", function () {
      if (editorState) editorState.slugTouched = true;
      markEditorDirty();
      validateSlugFormat();
      updateSeoPanel();
    });

    slugInput.addEventListener("blur", validateSlugUnique);

    excerptInput.addEventListener("input", function () {
      markEditorDirty();
      updateCounters();
      updateSeoPanel();
    });

    categoryInput.addEventListener("input", markEditorDirty);
    tagsInput.addEventListener("input", function () {
      markEditorDirty();
      updateSeoPanel();
    });

    coverAltInput.addEventListener("input", function () {
      markEditorDirty();
      setCoverPreview();
      updateSeoPanel();
    });

    contentInput.addEventListener("input", function () {
      markEditorDirty();
      updatePreview();
      updateSeoPanel();
    });

    seoTitleInput.addEventListener("input", function () {
      markEditorDirty();
      updateCounters();
      updateSeoPanel();
    });

    seoDescriptionInput.addEventListener("input", function () {
      markEditorDirty();
      updateCounters();
      updateSeoPanel();
    });

    statusSelect.addEventListener("change", function () {
      markEditorDirty();
      updateSeoPanel();
    });

    coverFile.addEventListener("change", function () {
      var file = coverFile.files && coverFile.files[0];
      if (file) uploadCover(file);
    });

    document.getElementById("cover-remove").addEventListener("click", function () {
      if (!editorState) return;
      editorState.data.cover_image = "";
      editorState.data.cover_alt = "";
      coverAltInput.value = "";
      setCoverPreview();
      setCoverStatus("Cover removed. Save to apply.", false);
      markEditorDirty();
      updateSeoPanel();
    });

    view.querySelectorAll("[data-save]").forEach(function (button) {
      button.addEventListener("click", function () {
        savePost(button.getAttribute("data-save"));
      });
    });

    form.addEventListener("submit", function (event) {
      event.preventDefault();
    });

    setCoverPreview();
    updateCounters();
    updatePreview();
    updateSeoPanel();

    if (previousEditorId === null && !existing) {
      titleInput.focus();
    }
  }

  /* ---------------- placeholder ---------------- */

  function renderPlaceholder(name) {
    var label = TITLES[name] || "Section";
    view.textContent = "";
    view.appendChild(el("div", { className: "page-head" }, [
      el("h1", { text: label, tabindex: "-1" })
    ]));
    view.appendChild(el("div", { className: "placeholder" }, [
      el("h2", { text: label }),
      el("p", { text: "Coming in the next phase" })
    ]));
  }
})();
