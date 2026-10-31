(function () {
  "use strict";

  var SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
  var GENERIC_ERROR = "Invalid email or password";
  var SESSION_MESSAGE = "Your session expired.";
  var MAX_IMAGE_BYTES = 5 * 1024 * 1024;
  var MAX_SCREENSHOTS = 8;
  var SCREENSHOT_MAX_WIDTH = 1600;
  var IMAGE_QUALITY = 0.82;
  var BUTTON_LABELS = ["Visit Website", "Try Now", "View on GitHub"];
  var SVG_NS = "http://www.w3.org/2000/svg";
  var EMPTY_SEED_MESSAGE = "No data yet. Run the seed first.";

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
  if (publishButton) {
    publishButton.addEventListener("click", async function () {
      publishButton.disabled = true;
      var originalText = publishButton.textContent;
      publishButton.textContent = "Publishing...";
      try {
        var token = currentSession && currentSession.access_token ? currentSession.access_token : "";
        var res = await fetch("/api/publish", { method: "POST", headers: { Authorization: "Bearer " + token } });
        if (res.status === 401) { sessionExpired(); return; }
        if (!res.ok) throw new Error("publish failed");
        showToast("Publishing started. The site updates in about 1-2 minutes.", false);
      } catch (e) {
        showToast("Publish failed. Please try again.", true);
      } finally {
        publishButton.disabled = false;
        publishButton.textContent = originalText;
      }
    });
  }
  var menuToggle = document.getElementById("menu-toggle");
  var sidebarOverlay = document.getElementById("sidebar-overlay");
  var toastEl = document.getElementById("toast");
  var messageNavBadge = document.getElementById("messages-nav-badge");
  var navItems = Array.prototype.slice.call(document.querySelectorAll(".nav-item[data-nav]"));

  var client = null;
  var currentSession = null;
  var currentHash = "";
  var currentRouteName = "dashboard";
  var viewToken = 0;
  var editorState = null;
  var settingsDirty = { hero: false, social: false, vision: false, sections: false, seo: false };
  var imagesDirty = false;
  var toastTimer = null;
  var signingOut = false;
  var slugCheckSeq = 0;

  function readConfig(name) {
    if (name === "url") return typeof SUPABASE_URL === "string" ? SUPABASE_URL : "";
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

  function el(tag, props, children) {
    var node = document.createElement(tag);
    if (props) {
      Object.keys(props).forEach(function (key) {
        var value = props[key];
        if (value === null || value === undefined || value === false) return;
        if (key === "text") node.textContent = value;
        else if (key === "className") node.className = value;
        else if (key === "dataset") {
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
    plus: [
      ["line", { x1: "12", y1: "5", x2: "12", y2: "19" }],
      ["line", { x1: "5", y1: "12", x2: "19", y2: "12" }]
    ],
    edit: [
      ["path", { d: "M12 20h9" }],
      ["path", { d: "M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z" }]
    ],
    trash: [
      ["polyline", { points: "3 6 5 6 21 6" }],
      ["path", { d: "M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" }],
      ["line", { x1: "10", y1: "11", x2: "10", y2: "17" }],
      ["line", { x1: "14", y1: "11", x2: "14", y2: "17" }],
      ["path", { d: "M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" }]
    ],
    up: [["polyline", { points: "18 15 12 9 6 15" }]],
    down: [["polyline", { points: "6 9 12 15 18 9" }]],
    back: [
      ["line", { x1: "19", y1: "12", x2: "5", y2: "12" }],
      ["polyline", { points: "12 19 5 12 12 5" }]
    ],
    check: [["polyline", { points: "20 6 9 17 4 12" }]],
    mail: [
      ["path", { d: "M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" }],
      ["polyline", { points: "22,6 12,13 2,6" }]
    ],
    eye: [
      ["path", { d: "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" }],
      ["circle", { cx: "12", cy: "12", r: "3" }]
    ],
    file: [
      ["path", { d: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" }],
      ["polyline", { points: "14 2 14 8 20 8" }],
      ["line", { x1: "16", y1: "13", x2: "8", y2: "13" }],
      ["line", { x1: "16", y1: "17", x2: "8", y2: "17" }]
    ],
    search: [
      ["circle", { cx: "11", cy: "11", r: "8" }],
      ["line", { x1: "21", y1: "21", x2: "16.65", y2: "16.65" }]
    ]
  };

  function icon(name) {
    var wrapper = document.createElement("span");
    wrapper.className = "icon";
    wrapper.setAttribute("aria-hidden", "true");
    var svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "2");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    (ICONS[name] || []).forEach(function (spec) {
      var part = document.createElementNS(SVG_NS, spec[0]);
      Object.keys(spec[1]).forEach(function (key) {
        part.setAttribute(key, spec[1][key]);
      });
      svg.appendChild(part);
    });
    wrapper.appendChild(svg);
    return wrapper;
  }

  function iconButton(name, label, extraClass) {
    return el("button", {
      type: "button",
      className: "icon-action" + (extraClass ? " " + extraClass : ""),
      "aria-label": label,
      title: label
    }, [icon(name)]);
  }

  function clearNode(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
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

  function setStatus(node, message, isError) {
    if (!node) return;
    node.textContent = message || "";
    node.hidden = !message;
    node.classList.toggle("is-error", !!message && !!isError);
    node.classList.toggle("is-ok", !!message && !isError);
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

  function safeHref(raw) {
    var value = String(raw || "").trim();
    if (!value) return "";
    if (value.charAt(0) === "/" && value.charAt(1) !== "/") return value;
    if (/^https:\/\//i.test(value)) return value;
    return "";
  }

  function isHttpsUrl(raw) {
    var value = String(raw || "").trim();
    if (!value) return true;
    try {
      return new URL(value).protocol === "https:";
    } catch (_) {
      return false;
    }
  }

  function isCtaUrl(raw) {
    var value = String(raw || "").trim();
    if (!value) return true;
    if (value.charAt(0) === "#") return true;
    return safeHref(value) !== "";
  }

  function addImageWithFallback(container, rawUrl, alt, imgClass, placeholderClass, placeholderText, lazy) {
    var url = safeHref(rawUrl);
    if (!url) {
      container.appendChild(el("div", { className: placeholderClass, text: placeholderText }));
      return null;
    }
    var img = el("img", { className: imgClass, src: url, alt: alt || "" });
    if (lazy) img.setAttribute("loading", "lazy");
    img.addEventListener("error", function () {
      img.remove();
      container.appendChild(el("div", { className: placeholderClass, text: placeholderText }));
    });
    container.appendChild(img);
    return img;
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

  function formatDate(value) {
    if (!value) return "Not tracked";
    var date = new Date(value);
    if (isNaN(date.getTime())) return "Not tracked";
    return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  }

  function formatDateTime(value) {
    if (!value) return "Not tracked";
    var date = new Date(value);
    if (isNaN(date.getTime())) return "Not tracked";
    return date.toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit"
    });
  }

  function latestDate(rows, keys) {
    var latest = null;
    (rows || []).forEach(function (row) {
      (keys || ["updated_at", "created_at"]).forEach(function (key) {
        var date = row && row[key] ? new Date(row[key]) : null;
        if (date && !isNaN(date.getTime()) && (!latest || date > latest)) latest = date;
      });
    });
    return latest;
  }

  function makeUuid() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }
    var bytes = new Uint8Array(16);
    window.crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    var hex = Array.prototype.map.call(bytes, function (byte) {
      return byte.toString(16).padStart(2, "0");
    }).join("");
    return hex.slice(0, 8) + "-" + hex.slice(8, 12) + "-" + hex.slice(12, 16) + "-" + hex.slice(16, 20) + "-" + hex.slice(20);
  }

  function mapSettings(rows) {
    var map = {};
    (rows || []).forEach(function (row) {
      if (!row || !row.key) return;
      var value = row.value;
      if (typeof value === "string") {
        try {
          value = JSON.parse(value);
        } catch (_) {
          value = {};
        }
      }
      map[row.key] = value && typeof value === "object" ? value : {};
    });
    return map;
  }

  function isSessionError(error) {
    if (!error) return false;
    if (error.status === 401 || error.statusCode === 401) return true;
    if (error.code === "PGRST301") return true;
    var message = String(error.message || "");
    return /jwt|token|session/i.test(message) && /expired|invalid|missing|not found/i.test(message);
  }

  function sessionException() {
    var error = new Error(SESSION_MESSAGE);
    error.isSession = true;
    return error;
  }

  function humanError(error, fallback) {
    if (!error) return fallback || "Something went wrong. Please try again.";
    if (error.status === 403 || /row-level security|permission denied/i.test(String(error.message || ""))) {
      return "You do not have permission to do that.";
    }
    if (error.code === "23505") return "That value is already in use.";
    if (error.code === "23502") return "A required value is missing.";
    if (error.code === "23514") return "One of the values is not allowed.";
    if (error.code === "42P01") return "A database table is missing. Run tools/schema.sql in Supabase.";
    if (/failed to fetch|networkerror|network request failed/i.test(String(error.message || ""))) {
      return "Network error. Check your connection and try again.";
    }
    return fallback || "Something went wrong. Please try again.";
  }

  function reportError(error, fallback, statusNode) {
    if (!error || error.message === SESSION_MESSAGE) return;
    var message = humanError(error, fallback);
    if (statusNode) setStatus(statusNode, message, true);
    showToast(message, true);
  }

  async function runQueryResult(query, fallback) {
    var result;
    try {
      result = await query;
    } catch (error) {
      if (isSessionError(error)) {
        sessionExpired();
        throw sessionException();
      }
      throw new Error(humanError(error, fallback));
    }
    if (result && result.error) {
      if (isSessionError(result.error)) {
        sessionExpired();
        throw sessionException();
      }
      throw new Error(humanError(result.error, fallback));
    }
    return result;
  }

  async function runQuery(query, fallback) {
    var result = await runQueryResult(query, fallback);
    return result ? result.data : null;
  }

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

  function resetContentDirty() {
    settingsDirty = { hero: false, social: false, vision: false, sections: false, seo: false };
    imagesDirty = false;
    editorState = null;
  }

  function showLogin(moveFocus) {
    resetContentDirty();
    currentSession = null;
    if (appShell) appShell.hidden = true;
    if (loginPanel) loginPanel.hidden = false;
    if (view) view.textContent = "";
    if (topbarEmail) topbarEmail.textContent = "";
    closeMenu();
    document.title = "Admin | Neelam Dhiman";
    resetLoginForm();
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
    Promise.resolve(client.auth.signOut())
      .catch(function () {
        return Promise.resolve(client.auth.signOut({ scope: "local" })).catch(function () {});
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
    Promise.resolve(client.auth.signOut())
      .catch(function () {
        return Promise.resolve(client.auth.signOut({ scope: "local" })).catch(function () {});
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
        if (session && session.user) showApp(session, false);
        else showLogin(false);
      })
      .catch(function () {
        showLogin(false);
      });

    client.auth.onAuthStateChange(function (event, session) {
      if (event === "SIGNED_IN" && session && session.user) showApp(session, true);
      else if (event === "SIGNED_OUT") showLogin(true);
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
          if (appShell.hidden) showApp(session, false);
          else currentSession = session;
        } else {
          showLogin(false);
        }
      })
      .catch(function () {
        showLogin(false);
      });
  });

  function listProjects() {
    return runQuery(
      client.from("projects").select("*").order("sort_order", { ascending: true }).order("created_at", { ascending: true }),
      "Could not load projects."
    ).then(function (rows) { return Array.isArray(rows) ? rows : []; });
  }

  function getProject(id) {
    return runQuery(
      client.from("projects").select("*").eq("id", id).maybeSingle(),
      "Could not load that project."
    );
  }

  function listTools() {
    return runQuery(
      client.from("tools").select("*").order("sort_order", { ascending: true }),
      "Could not load tools."
    ).then(function (rows) { return Array.isArray(rows) ? rows : []; });
  }

  function listStats() {
    return runQuery(
      client.from("stats").select("*").order("sort_order", { ascending: true }),
      "Could not load stats."
    ).then(function (rows) { return Array.isArray(rows) ? rows : []; });
  }

  function listSettings() {
    return runQuery(
      client.from("site_settings").select("key,value,updated_at"),
      "Could not load settings."
    ).then(function (rows) { return Array.isArray(rows) ? rows : []; });
  }

  function listMessages(limit) {
    var query = client
      .from("messages")
      .select("*")
      .order("created_at", { ascending: false });
    if (limit) query = query.limit(limit);
    return runQuery(query, "Could not load messages.").then(function (rows) {
      return Array.isArray(rows) ? rows : [];
    });
  }

  function countUnreadMessages() {
    return runQueryResult(
      client.from("messages").select("id", { count: "exact", head: true }).eq("is_read", false),
      "Could not count messages."
    ).then(function (result) {
      return result && Number.isFinite(result.count) ? result.count : 0;
    });
  }

  function updateMessage(id, patch) {
    return runQuery(
      client.from("messages").update(patch).eq("id", id),
      "Could not update that message."
    );
  }

  function updateMessageBadge(count) {
    if (!messageNavBadge) return;
    var value = Number(count) || 0;
    messageNavBadge.textContent = value > 99 ? "99+" : String(value);
    messageNavBadge.hidden = value === 0;
    messageNavBadge.setAttribute("aria-label", value + " unread message" + (value === 1 ? "" : "s"));
  }

  function refreshMessageBadge() {
    if (!client) return Promise.resolve();
    return countUnreadMessages()
      .then(updateMessageBadge)
      .catch(function () {});
  }

  function slugTaken(slug, excludeId) {
    return runQuery(
      client.from("projects").select("id,slug").eq("slug", slug),
      "Could not check that slug."
    ).then(function (rows) {
      return (rows || []).some(function (row) { return !excludeId || row.id !== excludeId; });
    });
  }

  async function nextSortOrder(table) {
    var rows = await runQuery(
      client.from(table).select("sort_order").order("sort_order", { ascending: false }).limit(1),
      "Could not prepare the new item."
    );
    var current = rows && rows[0] && Number(rows[0].sort_order);
    return (Number.isFinite(current) ? current : 0) + 10;
  }

  function saveProjectRecord(payload, id) {
    var query = id
      ? client.from("projects").update(payload).eq("id", id)
      : client.from("projects").insert(payload);
    return runQuery(query.select().single(), "Could not save the project.");
  }

  function saveProjectImages(id, images) {
    return runQuery(
      client.from("projects").update({ images: images, updated_at: new Date().toISOString() }).eq("id", id),
      "Could not save the screenshot order."
    );
  }

  function deleteRecord(table, id) {
    return runQuery(
      client.from(table).delete().eq("id", id),
      "Could not delete that item."
    );
  }

  function upsertOrder(table, rows) {
    return runQuery(
      client.from(table).upsert(rows, { onConflict: "id" }),
      "Could not save the new order."
    );
  }

  function saveSettingValue(key, value) {
    return runQuery(
      client.from("site_settings").upsert(
        { key: key, value: value, updated_at: new Date().toISOString() },
        { onConflict: "key" }
      ),
      "Could not save the " + key + " settings."
    );
  }

  function uploadToSiteImages(path, blob, contentType) {
    return runQuery(
      client.storage.from("site-images").upload(path, blob, {
        contentType: contentType,
        cacheControl: "3600",
        upsert: false
      }),
      "Could not upload that image."
    ).then(function () {
      var result = client.storage.from("site-images").getPublicUrl(path);
      return result && result.data ? result.data.publicUrl : "";
    });
  }

  function validateImageFile(file) {
    if (!file) return "Choose an image.";
    if (["image/jpeg", "image/png", "image/webp"].indexOf(file.type) === -1) {
      return "Choose a JPG, PNG or WebP image.";
    }
    if (file.size > MAX_IMAGE_BYTES) return "That image is larger than 5 MB.";
    return "";
  }

  function loadImageFile(file) {
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

  function canvasBlob(canvas, type, quality) {
    return new Promise(function (resolve) {
      canvas.toBlob(resolve, type, quality);
    });
  }

  async function resizeImage(img, maxWidth, type, quality) {
    var naturalWidth = img.naturalWidth || img.width;
    var naturalHeight = img.naturalHeight || img.height;
    if (!naturalWidth || !naturalHeight) throw new Error("Could not read that image.");
    var width = Math.min(maxWidth, naturalWidth);
    var height = Math.max(1, Math.round((naturalHeight / naturalWidth) * width));
    var canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    var context = canvas.getContext("2d");
    if (!context) throw new Error("Could not process that image.");
    if (type === "image/jpeg") {
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, width, height);
    }
    context.drawImage(img, 0, 0, width, height);
    var blob = await canvasBlob(canvas, type, quality);
    if (!blob) throw new Error("Could not convert that image.");
    return blob;
  }

  async function makeScreenshotBlob(file) {
    var img = await loadImageFile(file);
    return resizeImage(img, SCREENSHOT_MAX_WIDTH, "image/webp", IMAGE_QUALITY);
  }

  async function uploadToolLogo(file) {
    var problem = validateImageFile(file);
    if (problem) throw new Error(problem);
    var extension = file.type === "image/png" ? "png" : file.type === "image/jpeg" ? "jpg" : "webp";
    var path = "tools/" + makeUuid() + "." + extension;
    var url = await uploadToSiteImages(path, file, file.type);
    if (!url) throw new Error("Could not get the uploaded logo URL.");
    return url;
  }

  var TITLES = {
    dashboard: "Dashboard",
    projects: "Projects",
    editor: "Project",
    images: "Images",
    skills: "Skills",
    messages: "Messages",
    settings: "Settings",
    seo: "SEO"
  };

  function parseHash() {
    var raw = String(location.hash || "").replace(/^#\/?/, "").replace(/\/+$/, "");
    if (!raw || raw === "dashboard") return { name: "dashboard" };
    var parts = raw.split("/");
    if (parts[0] === "projects") {
      if (parts.length === 1) return { name: "projects" };
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
    if (parts.length === 1 && ["images", "skills", "messages", "settings", "seo"].indexOf(parts[0]) !== -1) {
      return { name: parts[0] };
    }
    return { name: "dashboard" };
  }

  function setActiveNav(name) {
    var target = name === "editor" ? "projects" : name;
    navItems.forEach(function (item) {
      var active = item.getAttribute("data-nav") === target;
      item.classList.toggle("is-active", active);
      if (active) item.setAttribute("aria-current", "page");
      else item.removeAttribute("aria-current");
    });
  }

  function routeTitle(route) {
    if (route.name === "editor") return route.id ? "Edit project" : "New project";
    return TITLES[route.name] || "Dashboard";
  }

  function renderRoute(route) {
    route = route || parseHash();
    viewToken += 1;
    var token = viewToken;
    currentHash = location.hash || "#/dashboard";
    currentRouteName = route.name;
    closeMenu();
    setActiveNav(route.name);
    resetContentDirty();
    window.scrollTo(0, 0);
    document.title = routeTitle(route) + " | Neelam Dhiman Admin";
    refreshMessageBadge();
    if (route.name === "dashboard") renderDashboard(token);
    else if (route.name === "projects") renderProjects(token);
    else if (route.name === "editor") renderProjectEditor(route, token);
    else if (route.name === "images") renderImages(token);
    else if (route.name === "skills") renderSkills(token);
    else if (route.name === "messages") renderMessages(token);
    else if (route.name === "settings") renderSettings(token);
    else if (route.name === "seo") renderSeo(token);
    else renderDashboard(token);
  }

  function hasUnsavedChanges() {
    return !!(
      (editorState && editorState.dirty) ||
      settingsDirty.hero ||
      settingsDirty.social ||
      settingsDirty.vision ||
      settingsDirty.sections ||
      settingsDirty.seo ||
      imagesDirty
    );
  }

  window.addEventListener("hashchange", function () {
    var next = parseHash();
    var stayingEditor =
      next.name === "editor" &&
      editorState &&
      String(next.id || "") === String(editorState.id || "");
    var stayingSettings = next.name === "settings" && currentRouteName === "settings";
    var stayingImages = next.name === "images" && currentRouteName === "images";
    if (hasUnsavedChanges() && !stayingEditor && !stayingSettings && !stayingImages) {
      var ok = window.confirm("You have unsaved changes. Leave this page?");
      if (!ok) {
        history.replaceState(null, "", currentHash || "#/dashboard");
        return;
      }
    }
    renderRoute(next);
  });

  window.addEventListener("beforeunload", function (event) {
    if (!hasUnsavedChanges()) return;
    event.preventDefault();
    event.returnValue = "";
  });

  function openMenu() {
    appShell.classList.add("is-menu-open");
    sidebarOverlay.hidden = false;
    menuToggle.setAttribute("aria-expanded", "true");
    menuToggle.setAttribute("aria-label", "Close menu");
  }

  function closeMenu() {
    if (!appShell) return;
    appShell.classList.remove("is-menu-open");
    if (sidebarOverlay) sidebarOverlay.hidden = true;
    if (menuToggle) {
      menuToggle.setAttribute("aria-expanded", "false");
      menuToggle.setAttribute("aria-label", "Open menu");
    }
  }

  if (menuToggle) {
    menuToggle.addEventListener("click", function () {
      if (appShell.classList.contains("is-menu-open")) closeMenu();
      else openMenu();
    });
  }

  if (sidebarOverlay) sidebarOverlay.addEventListener("click", closeMenu);

  window.addEventListener("resize", function () {
    if (appShell && !window.matchMedia("(max-width: 820px)").matches) closeMenu();
  });

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

  function pageHead(title, subtitle, actions) {
    return el("div", { className: "page-head" }, [
      el("div", null, [
        el("h1", { text: title, tabindex: "-1" }),
        subtitle ? el("p", { className: "page-head__sub", text: subtitle }) : null
      ]),
      actions && actions.length ? el("div", { className: "page-actions" }, actions) : null
    ]);
  }

  function statCard(value, label) {
    return el("div", { className: "stat" }, [
      el("span", { className: "stat__value", text: String(value) }),
      el("span", { className: "stat__label", text: label })
    ]);
  }

  function seedMessage() {
    return el("p", { className: "empty-message", text: EMPTY_SEED_MESSAGE });
  }

  function errorPanel(title, message) {
    return el("div", { className: "error-panel" }, [
      el("strong", { text: title }),
      el("p", { text: message })
    ]);
  }

  function backLink(href, label) {
    return el("a", { className: "back-link", href: href }, [icon("back"), document.createTextNode(label)]);
  }

  function loadingNode(message) {
    return el("p", { className: "loading", text: message });
  }

  function actionLink(href, label, iconName) {
    return el("a", { className: "btn", href: href }, [
      iconName ? icon(iconName) : null,
      document.createTextNode(label)
    ]);
  }

  function greetingText() {
    var hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  }

  function dashboardName() {
    var email = currentSession && currentSession.user ? currentSession.user.email || "" : "";
    var name = email.split("@")[0].replace(/[._-]+/g, " ").trim();
    if (!name) return "Neelam";
    return name.charAt(0).toUpperCase() + name.slice(1);
  }

  function messagePreview(message) {
    return el("li", { className: "message-preview" + (message.is_read ? "" : " is-unread") }, [
      el("span", { className: "message-preview__dot", "aria-hidden": "true" }),
      el("div", { className: "message-preview__body" }, [
        el("div", { className: "message-preview__top" }, [
          el("strong", { text: message.name || "Unknown sender" }),
          el("span", { className: "muted small", text: formatDate(message.created_at) })
        ]),
        el("p", { className: "message-preview__text", text: message.message || "" })
      ])
    ]);
  }

  async function renderDashboard(token) {
    view.textContent = "";
    view.appendChild(pageHead("Dashboard", "Overview of your portfolio content.", [
      actionLink("#/projects/new", "Add project", "plus"),
      el("a", { className: "btn btn--ghost", href: "#/settings", text: "Settings" })
    ]));
    var loading = loadingNode("Loading dashboard…");
    view.appendChild(loading);

    try {
      var results = await Promise.all([listProjects(), listTools(), listStats(), listSettings()]);
      if (token !== viewToken) return;
      var projects = results[0];
      var tools = results[1];
      var stats = results[2];
      var settingsRows = results[3];
      var messages = [];
      var unread = 0;
      var messagesError = "";

      try {
        messages = await listMessages(4);
        unread = await countUnreadMessages();
        updateMessageBadge(unread);
      } catch (messageError) {
        if (messageError.message === SESSION_MESSAGE) return;
        messagesError = messageError.message;
      }
      if (token !== viewToken) return;

      var visible = projects.filter(function (project) { return project.is_visible !== false; }).length;
      var projectDate = latestDate(projects, ["updated_at", "created_at"]);
      var settingsDate = latestDate(settingsRows, ["updated_at"]);
      var allEmpty = projects.length === 0 && tools.length === 0 && stats.length === 0 && settingsRows.length === 0;

      loading.remove();

      var welcome = el("section", { className: "welcome" }, [
        el("div", { className: "welcome__copy" }, [
          el("span", { className: "welcome__eyebrow", text: new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" }) }),
          el("h2", { text: greetingText() + ", " + dashboardName() + "." }),
          el("p", { text: "Here's what's happening with your portfolio today." })
        ]),
        el("div", { className: "welcome__actions" }, [
          actionLink("#/projects/new", "Add project", "plus"),
          el("a", { className: "btn btn--ghost", href: "#/projects", text: "Manage projects" })
        ])
      ]);
      view.appendChild(welcome);

      if (allEmpty) view.appendChild(seedMessage());

      view.appendChild(el("div", { className: "stats" }, [
        statCard(projects.length, "Projects"),
        statCard(visible, "Visible projects"),
        statCard(tools.length, "Tools"),
        statCard(unread, "Unread messages")
      ]));

      var messagesCard = el("section", { className: "card", "aria-labelledby": "h-messages" }, [
        el("div", { className: "card__head" }, [
          el("h2", { id: "h-messages", text: "Latest messages" }),
          el("a", { className: "card-link", href: "#/messages", text: "Inbox →" })
        ]),
        messagesError
          ? el("p", { className: "note", text: messagesError })
          : messages.length === 0
            ? el("p", { className: "empty-message", text: "No messages yet. Contact form submissions will appear here." })
            : el("ul", { className: "message-preview-list" }, messages.map(messagePreview))
      ]);

      var recentProjectsCard = el("section", { className: "card", "aria-labelledby": "h-recent-projects" }, [
        el("div", { className: "card__head" }, [
          el("h2", { id: "h-recent-projects", text: "Recent projects" }),
          el("a", { className: "card-link", href: "#/projects", text: "View all →" })
        ]),
        projects.length === 0
          ? el("p", { className: "empty-message", text: "No projects yet. Add your first project." })
          : el("ul", { className: "project-mini-list" }, projects.slice(0, 3).map(function (project) {
            var isVisible = project.is_visible !== false;
            var meta = [project.category, project.year].filter(Boolean).join(" · ");
            return el("li", { className: "project-mini" }, [
              el("a", {
                className: "project-mini__main",
                href: project.id ? "#/projects/" + encodeURIComponent(project.id) : "#/projects"
              }, [
                el("strong", { className: "project-mini__title", text: project.title || "Untitled project" }),
                el("span", { className: "project-mini__meta", text: meta || "Project" })
              ]),
              el("span", {
                className: "project-mini__status" + (isVisible ? "" : " is-hidden"),
                text: isVisible ? "Live" : "Hidden"
              })
            ]);
          }))
      ]);

      var quickCard = el("section", { className: "card", "aria-labelledby": "h-quick" }, [
        el("div", { className: "card__head" }, [el("h2", { id: "h-quick", text: "Quick actions" })]),
        el("div", { className: "quick" }, [
          actionLink("#/projects/new", "Add project", "plus"),
          el("a", { className: "btn btn--secondary btn--block", href: "#/projects", text: "Manage projects" }),
          el("a", { className: "btn btn--ghost btn--block", href: "#/messages", text: "Open inbox" }),
          el("a", { className: "btn btn--ghost btn--block", href: "#/settings", text: "Edit hero & sections" }),
          el("a", { className: "btn btn--ghost btn--block", href: "#/seo", text: "Edit SEO" })
        ])
      ]);

      var lastUpdatedCard = el("section", { className: "card" }, [
        el("div", { className: "card__head" }, [el("h2", { text: "Last updated" })]),
        el("ul", { className: "meta-list" }, [
          el("li", null, [el("strong", { text: "Projects" }), el("span", { className: "muted", text: formatDate(projectDate) })]),
          el("li", null, [el("strong", { text: "Tools" }), el("span", { className: "muted", text: "Not tracked" })]),
          el("li", null, [el("strong", { text: "Stats" }), el("span", { className: "muted", text: "Not tracked" })]),
          el("li", null, [el("strong", { text: "Settings" }), el("span", { className: "muted", text: formatDate(settingsDate) })])
        ])
      ]);

      var leftColumn = el("div", { className: "dash-stack" }, [messagesCard, recentProjectsCard]);
      var rightColumn = el("div", { className: "dash-stack" }, [quickCard, lastUpdatedCard]);
      view.appendChild(el("div", { className: "dash-grid" }, [leftColumn, rightColumn]));
    } catch (error) {
      if (token !== viewToken) return;
      loading.remove();
      if (error.message === SESSION_MESSAGE) return;
      view.appendChild(errorPanel("Could not load the dashboard", error.message));
    }
  }

  async function renderProjects(token) {
    view.textContent = "";
    view.appendChild(pageHead("Projects", "Reorder, hide, edit or remove projects shown on the site.", [
      actionLink("#/projects/new", "Add project", "plus")
    ]));
    var loading = loadingNode("Loading projects…");
    view.appendChild(loading);

    var projects;
    try {
      projects = await listProjects();
    } catch (error) {
      if (token !== viewToken) return;
      loading.remove();
      if (error.message !== SESSION_MESSAGE) view.appendChild(errorPanel("Could not load projects", error.message));
      return;
    }
    if (token !== viewToken) return;
    loading.remove();

    var status = el("p", { className: "inline-status", role: "status", "aria-live": "polite", hidden: true });
    view.appendChild(status);

    if (projects.length === 0) {
      view.appendChild(seedMessage());
      return;
    }

    var grid = el("div", { className: "project-grid" });
    view.appendChild(grid);
    var reordering = false;

    function draw() {
      clearNode(grid);
      projects.forEach(function (project, index) {
        var media = el("div", { className: "project-card__media" });
        var firstImage = Array.isArray(project.images) && project.images[0] ? project.images[0] : null;
        addImageWithFallback(
          media,
          firstImage ? firstImage.url : "",
          firstImage && firstImage.alt ? firstImage.alt : project.title,
          "project-card__cover",
          "project-card__placeholder",
          "No screenshot",
          true
        );
        if (project.is_visible === false) {
          media.appendChild(el("span", { className: "project-card__badge", text: "Hidden" }));
        }

        var tags = el("div", { className: "project-card__tags" });
        (Array.isArray(project.tags) ? project.tags : []).forEach(function (tag) {
          tags.appendChild(el("span", { className: "tag", text: String(tag) }));
        });

        var up = iconButton("up", "Move " + (project.title || "project") + " up");
        var down = iconButton("down", "Move " + (project.title || "project") + " down");
        up.disabled = reordering || index === 0;
        down.disabled = reordering || index === projects.length - 1;
        up.addEventListener("click", function () { moveProject(index, -1); });
        down.addEventListener("click", function () { moveProject(index, 1); });

        var edit = el("a", {
          className: "btn btn--secondary btn--small",
          href: "#/projects/" + encodeURIComponent(project.id),
          text: "Edit"
        });
        edit.setAttribute("aria-label", "Edit " + (project.title || "project"));

        var remove = iconButton("trash", "Delete " + (project.title || "project"), "is-danger");
        remove.addEventListener("click", function () { deleteProject(project, remove); });

        grid.appendChild(el("article", { className: "project-card" }, [
          media,
          el("div", { className: "project-card__body" }, [
            el("a", {
              className: "project-card__title",
              href: "#/projects/" + encodeURIComponent(project.id),
              text: project.title || "(untitled project)"
            }),
            el("p", { className: "project-card__desc", text: project.description || "No description yet." }),
            tags,
            el("div", { className: "project-card__actions" }, [
              el("div", { className: "project-card__order" }, [up, down]),
              edit,
              remove
            ])
          ])
        ]));
      });
    }

    async function moveProject(index, delta) {
      if (reordering) return;
      var target = index + delta;
      if (target < 0 || target >= projects.length) return;
      var snapshot = projects.map(function (project) { return Object.assign({}, project); });
      var next = projects.slice();
      var moved = next[index];
      next[index] = next[target];
      next[target] = moved;
      next.forEach(function (project, position) { project.sort_order = (position + 1) * 10; });
      projects = next;
      reordering = true;
      setStatus(status, "Saving order…", false);
      draw();

      try {
        await upsertOrder("projects", projects.map(function (project) {
          return Object.assign({}, project);
        }));
        setStatus(status, "Project order saved.", false);
      } catch (error) {
        projects = snapshot;
        if (error.message !== SESSION_MESSAGE) {
          setStatus(status, "Could not save the new order. Nothing was changed.", true);
          showToast("Could not save the new order.", true);
        }
      } finally {
        reordering = false;
        draw();
      }
    }

    async function deleteProject(project, button) {
      var confirmed = window.confirm('Delete "' + (project.title || "this project") + '"? This cannot be undone.');
      if (!confirmed) return;
      button.disabled = true;
      setStatus(status, "Deleting project…", false);
      try {
        await deleteRecord("projects", project.id);
        projects = projects.filter(function (item) { return item.id !== project.id; });
        draw();
        if (projects.length === 0) {
          status.hidden = true;
          view.appendChild(seedMessage());
        } else {
          setStatus(status, "Project deleted.", false);
        }
        showToast("Project deleted.", false);
      } catch (error) {
        button.disabled = false;
        reportError(error, "Could not delete that project.", status);
      }
    }

    draw();
  }

  async function renderProjectEditor(route, token) {
    view.textContent = "";
    view.appendChild(backLink("#/projects", "All projects"));
    var loading = loadingNode(route.id ? "Loading project…" : "Preparing editor…");
    view.appendChild(loading);

    var existing = null;
    if (route.id) {
      try {
        existing = await getProject(route.id);
      } catch (error) {
        if (token !== viewToken) return;
        loading.remove();
        if (error.message !== SESSION_MESSAGE) view.appendChild(errorPanel("Could not load that project", error.message));
        return;
      }
      if (token !== viewToken) return;
    }

    loading.remove();
    if (route.id && !existing) {
      view.appendChild(errorPanel("Project not found", "It may have been deleted. Go back to all projects."));
      return;
    }

    var data = existing ? Object.assign({}, existing) : {
      id: null,
      title: "",
      slug: "",
      description: "",
      seo_description: "",
      live_url: "",
      code_url: "",
      button_label: "Visit Website",
      tags: [],
      images: [],
      is_visible: true,
      sort_order: 0,
      updated_at: null
    };
    if (!Array.isArray(data.tags)) data.tags = [];
    if (!Array.isArray(data.images)) data.images = [];
    data.images = data.images.map(function (image) {
      return image && typeof image === "object"
        ? { url: String(image.url || ""), alt: String(image.alt || "") }
        : { url: "", alt: "" };
    });

    var state = {
      id: existing ? existing.id : null,
      data: data,
      dirty: false,
      saving: false,
      uploading: false,
      savingShots: false,
      slugTouched: !!existing
    };
    editorState = state;

    var editorHead = pageHead(
      existing ? "Edit project" : "New project",
      existing
        ? "Changes appear on the public site only after publishing in the next step."
        : "Add the project details and screenshots.",
      []
    );
    view.appendChild(editorHead);

    var formMessage = el("p", { className: "form-message", id: "project-form-message", role: "status", "aria-live": "polite", hidden: true });
    var form = el("form", { id: "project-form", novalidate: "novalidate" });

    var titleInput = el("input", {
      id: "project-title",
      name: "title",
      type: "text",
      value: data.title || "",
      autocomplete: "off",
      "aria-describedby": "project-title-error"
    });
    var titleError = el("p", { className: "field-error", id: "project-title-error", hidden: true });

    var slugInput = el("input", {
      id: "project-slug",
      name: "slug",
      type: "text",
      value: data.slug || "",
      autocomplete: "off",
      spellcheck: "false",
      "aria-describedby": "project-slug-hint project-slug-error"
    });
    var slugHint = el("p", { className: "field-hint", id: "project-slug-hint", text: "Lowercase letters, numbers and single hyphens." });
    var slugError = el("p", { className: "field-error", id: "project-slug-error", hidden: true });

    var descriptionInput = el("textarea", {
      id: "project-description",
      name: "description",
      rows: "4",
      maxlength: "400",
      "aria-describedby": "project-description-count project-description-error"
    });
    descriptionInput.value = data.description || "";
    var descriptionCount = el("span", { className: "counter", id: "project-description-count", text: "0/400" });
    var descriptionError = el("p", { className: "field-error", id: "project-description-error", hidden: true });

    var seoDescriptionInput = el("textarea", {
      id: "project-seo-description",
      name: "seo_description",
      rows: "3",
      "aria-describedby": "project-seo-count project-seo-description-error"
    });
    seoDescriptionInput.value = data.seo_description || "";
    var seoCount = el("span", { className: "counter", id: "project-seo-count", text: "0 (target 120–160)" });
    var seoError = el("p", { className: "field-error", id: "project-seo-description-error", hidden: true });

    var liveInput = el("input", {
      id: "project-live-url",
      name: "live_url",
      type: "url",
      value: data.live_url || "",
      autocomplete: "off",
      placeholder: "https://example.com",
      "aria-describedby": "project-live-url-error"
    });
    var liveError = el("p", { className: "field-error", id: "project-live-url-error", hidden: true });

    var codeInput = el("input", {
      id: "project-code-url",
      name: "code_url",
      type: "url",
      value: data.code_url || "",
      autocomplete: "off",
      placeholder: "https://github.com/...",
      "aria-describedby": "project-code-url-error"
    });
    var codeError = el("p", { className: "field-error", id: "project-code-url-error", hidden: true });

    var buttonSelect = el("select", { id: "project-button-label", name: "button_label" },
      BUTTON_LABELS.map(function (label) { return el("option", { value: label, text: label }); })
    );
    buttonSelect.value = BUTTON_LABELS.indexOf(data.button_label) !== -1 ? data.button_label : BUTTON_LABELS[0];

    var tagsInput = el("input", {
      id: "project-tags",
      name: "tags",
      type: "text",
      value: (data.tags || []).join(", "),
      autocomplete: "off",
      placeholder: "HTML, CSS, JavaScript"
    });

    var visibleInput = el("input", { id: "project-visible", name: "is_visible", type: "checkbox" });
    visibleInput.checked = data.is_visible !== false;
    var visibleRow = el("div", { className: "checkbox-row" }, [
      visibleInput,
      el("label", { for: "project-visible", text: "Show this project on the site" })
    ]);

    var fieldsCard = el("section", { className: "card" }, [
      el("div", { className: "form-grid" }, [
        el("div", { className: "field field--wide" }, [
          el("label", { for: "project-title", text: "Title" }),
          titleInput,
          titleError
        ]),
        el("div", { className: "field field--wide" }, [
          el("label", { for: "project-slug", text: "Slug" }),
          slugInput,
          slugHint,
          slugError
        ]),
        el("div", { className: "field field--wide" }, [
          el("label", { for: "project-description", text: "Description" }),
          descriptionInput,
          el("div", { className: "counter-row" }, [
            el("span", { className: "field-hint", text: "Short summary shown on the project card." }),
            descriptionCount
          ]),
          descriptionError
        ]),
        el("div", { className: "field field--wide" }, [
          el("label", { for: "project-seo-description", text: "SEO description" }),
          seoDescriptionInput,
          el("div", { className: "counter-row" }, [
            el("span", { className: "field-hint", text: "Aim for 120–160 characters." }),
            seoCount
          ]),
          seoError
        ]),
        el("div", { className: "field" }, [
          el("label", { for: "project-live-url", text: "Live URL" }),
          liveInput,
          liveError
        ]),
        el("div", { className: "field" }, [
          el("label", { for: "project-code-url", text: "Code URL" }),
          codeInput,
          codeError
        ]),
        el("div", { className: "field" }, [
          el("label", { for: "project-button-label", text: "Button label" }),
          buttonSelect
        ]),
        el("div", { className: "field" }, [
          el("label", { for: "project-tags", text: "Tags (comma separated)" }),
          tagsInput
        ])
      ]),
      visibleRow
    ]);

    var shotsHeading = el("h2", { text: "Screenshots (0/8)" });
    var shotFile = el("input", {
      id: "project-shot-file",
      type: "file",
      accept: "image/jpeg,image/png,image/webp",
      multiple: true,
      "aria-describedby": "project-shot-status"
    });
    var shotStatus = el("p", { className: "inline-status", id: "project-shot-status", role: "status", "aria-live": "polite", hidden: true });
    var shotsList = el("div", { className: "shot-list" });
    var shotsCard = el("section", { className: "card" }, [
      el("div", { className: "card__head" }, [shotsHeading]),
      el("div", { className: "field" }, [
        el("label", { for: "project-shot-file", text: "Add screenshots (JPG, PNG or WebP, max 5 MB each)" }),
        el("div", { className: "upload-row" }, [shotFile])
      ]),
      shotStatus,
      shotsList
    ]);

    var saveButton = el("button", { type: "submit", className: "btn", text: "Save project" });
    var actions = el("div", { className: "form-actions" }, [
      saveButton,
      el("a", { className: "btn btn--ghost", href: "#/projects", text: "Cancel" })
    ]);

    form.appendChild(formMessage);
    form.appendChild(fieldsCard);
    form.appendChild(shotsCard);
    form.appendChild(actions);
    view.appendChild(form);

    function markDirty() {
      if (editorState === state) state.dirty = true;
    }

    function updateCounters() {
      var descriptionLength = descriptionInput.value.length;
      var seoLength = seoDescriptionInput.value.length;
      descriptionCount.textContent = descriptionLength + "/400";
      descriptionCount.classList.toggle("is-over", descriptionLength > 400);
      seoCount.textContent = seoLength + " (target 120–160)";
      seoCount.classList.toggle("is-near", seoLength > 0 && seoLength < 120);
      seoCount.classList.toggle("is-over", seoLength > 160);
    }

    function validateSlugFormat() {
      var slug = slugInput.value.trim();
      if (!slug) {
        setFieldError("project-slug", "Slug is required.");
        return false;
      }
      if (!SLUG_RE.test(slug)) {
        setFieldError("project-slug", "Use lowercase letters, numbers and single hyphens only.");
        return false;
      }
      setFieldError("project-slug", "");
      return true;
    }

    async function validateSlugUnique() {
      if (!validateSlugFormat()) return false;
      var slug = slugInput.value.trim();
      var seq = ++slugCheckSeq;
      slugHint.textContent = "Checking availability…";
      try {
        var taken = await slugTaken(slug, state.id);
        if (editorState !== state || seq !== slugCheckSeq) return false;
        if (taken) {
          setFieldError("project-slug", "That slug is already used by another project.");
          slugHint.textContent = "Slug must be unique.";
          return false;
        }
        setFieldError("project-slug", "");
        slugHint.textContent = "Lowercase letters, numbers and single hyphens. This URL will be /" + slug + ".";
        return true;
      } catch (error) {
        if (editorState !== state) return false;
        if (error.message !== SESSION_MESSAGE) {
          slugHint.textContent = "Could not check the slug yet.";
          reportError(error, "Could not check that slug.", formMessage);
        }
        return false;
      }
    }

    function drawShots() {
      if (editorState !== state) return;
      shotsHeading.textContent = "Screenshots (" + state.data.images.length + "/8)";
      shotFile.disabled = state.uploading || state.savingShots || state.data.images.length >= MAX_SCREENSHOTS;
      clearNode(shotsList);

      if (state.data.images.length === 0) {
        shotsList.appendChild(el("p", { className: "field-hint", text: "No screenshots yet. Add up to 8 images." }));
        return;
      }

      state.data.images.forEach(function (image, index) {
        var thumb = el("div", { className: "shot-thumb" });
        addImageWithFallback(thumb, image.url, image.alt, "", "shot-thumb--empty", "No image", true);

        var urlInput = el("input", {
          type: "text",
          className: "shot-url",
          value: image.url || "",
          autocomplete: "off",
          "aria-label": "Screenshot " + (index + 1) + " URL",
          placeholder: "/assets/projects/... or https://..."
        });
        var altInput = el("input", {
          type: "text",
          value: image.alt || "",
          autocomplete: "off",
          "aria-label": "Screenshot " + (index + 1) + " alt text",
          placeholder: "Describe this screenshot"
        });
        urlInput.dataset.shotUrl = String(index);
        altInput.dataset.shotAlt = String(index);

        urlInput.addEventListener("input", function () {
          state.data.images[index].url = urlInput.value.trim();
          markDirty();
        });
        altInput.addEventListener("input", function () {
          state.data.images[index].alt = altInput.value;
          altInput.classList.remove("is-invalid");
          markDirty();
        });

        var up = iconButton("up", "Move screenshot " + (index + 1) + " up");
        var down = iconButton("down", "Move screenshot " + (index + 1) + " down");
        up.disabled = state.savingShots || state.uploading || index === 0;
        down.disabled = state.savingShots || state.uploading || index === state.data.images.length - 1;
        up.addEventListener("click", function () { moveShot(index, -1); });
        down.addEventListener("click", function () { moveShot(index, 1); });

        var remove = iconButton("trash", "Remove screenshot " + (index + 1), "is-danger");
        remove.disabled = state.savingShots || state.uploading;
        remove.addEventListener("click", function () {
          state.data.images.splice(index, 1);
          markDirty();
          drawShots();
          setStatus(shotStatus, "Screenshot removed. Save the project to apply.", false);
        });

        shotsList.appendChild(el("div", { className: "shot-row" }, [
          thumb,
          el("div", { className: "shot-fields" }, [urlInput, altInput]),
          el("div", { className: "shot-actions" }, [up, down, remove])
        ]));
      });
    }

    async function persistShotOrder(previousImages) {
      if (editorState !== state || !state.id) return;
      state.savingShots = true;
      drawShots();
      setStatus(shotStatus, "Saving screenshot order…", false);
      try {
        await saveProjectImages(state.id, state.data.images.map(function (image) {
          return { url: image.url, alt: image.alt };
        }));
        setStatus(shotStatus, "Screenshot order saved.", false);
      } catch (error) {
        state.data.images = previousImages;
        if (error.message !== SESSION_MESSAGE) {
          setStatus(shotStatus, "Could not save the new order. Nothing was changed.", true);
          showToast("Could not save the screenshot order.", true);
        }
      } finally {
        if (editorState === state) {
          state.savingShots = false;
          drawShots();
        }
      }
    }

    function moveShot(index, delta) {
      if (state.savingShots || state.uploading) return;
      var target = index + delta;
      if (target < 0 || target >= state.data.images.length) return;
      var previous = state.data.images.map(function (image) { return { url: image.url, alt: image.alt }; });
      var moved = state.data.images[index];
      state.data.images[index] = state.data.images[target];
      state.data.images[target] = moved;
      markDirty();
      drawShots();
      if (state.id) persistShotOrder(previous);
      else setStatus(shotStatus, "Screenshot order updated. Save the project to apply.", false);
    }

    async function uploadScreenshots(files) {
      if (editorState !== state || !files.length) return;
      var slots = MAX_SCREENSHOTS - state.data.images.length;
      if (slots <= 0) {
        setStatus(shotStatus, "You can add up to 8 screenshots.", true);
        return;
      }
      if (files.length > slots) {
        files = files.slice(0, slots);
        setStatus(shotStatus, "Only " + slots + " more screenshot(s) can be added.", true);
      } else {
        setStatus(shotStatus, "Preparing screenshots…", false);
      }

      state.uploading = true;
      shotFile.disabled = true;
      drawShots();
      var added = 0;
      var failures = [];

      for (var i = 0; i < files.length; i += 1) {
        var file = files[i];
        var problem = validateImageFile(file);
        if (problem) {
          failures.push(problem);
          continue;
        }
        setStatus(shotStatus, "Processing screenshot " + (i + 1) + " of " + files.length + "…", false);
        try {
          var blob = await makeScreenshotBlob(file);
          if (editorState !== state) return;
          var folder = slugify(slugInput.value.trim()) || "project";
          var path = "projects/" + folder + "/" + makeUuid() + ".webp";
          var url = await uploadToSiteImages(path, blob, "image/webp");
          if (editorState !== state) return;
          if (!url) throw new Error("Could not get the uploaded image URL.");
          state.data.images.push({ url: url, alt: "" });
          added += 1;
          markDirty();
          drawShots();
        } catch (error) {
          if (error.message === SESSION_MESSAGE) return;
          failures.push(error.message);
        }
      }

      state.uploading = false;
      shotFile.disabled = false;
      shotFile.value = "";
      if (editorState !== state) return;
      drawShots();
      if (failures.length) {
        setStatus(shotStatus, added + " added. " + failures[0], true);
      } else if (added) {
        setStatus(shotStatus, added + " screenshot(s) added. Add alt text for each image.", false);
      }
    }

    function readProjectForm() {
      return {
        title: titleInput.value.trim(),
        slug: slugInput.value.trim(),
        description: descriptionInput.value.trim(),
        seo_description: seoDescriptionInput.value.trim(),
        live_url: liveInput.value.trim(),
        code_url: codeInput.value.trim(),
        button_label: buttonSelect.value,
        tags: tagList(tagsInput.value),
        is_visible: visibleInput.checked,
        images: state.data.images.map(function (image) {
          return { url: String(image.url || "").trim(), alt: String(image.alt || "").trim() };
        })
      };
    }

    function validateProject(project) {
      var first = null;
      setFieldError("project-title", "");
      setFieldError("project-slug", "");
      setFieldError("project-description", "");
      setFieldError("project-live-url", "");
      setFieldError("project-code-url", "");
      setStatus(shotStatus, "", false);

      if (!project.title) {
        setFieldError("project-title", "Title is required.");
        first = first || titleInput;
      }
      if (!project.slug) {
        setFieldError("project-slug", "Slug is required.");
        first = first || slugInput;
      } else if (!SLUG_RE.test(project.slug)) {
        setFieldError("project-slug", "Use lowercase letters, numbers and single hyphens only.");
        first = first || slugInput;
      }
      if (!project.description) {
        setFieldError("project-description", "Description is required.");
        first = first || descriptionInput;
      } else if (project.description.length > 400) {
        setFieldError("project-description", "Keep the description to 400 characters or fewer.");
        first = first || descriptionInput;
      }
      if (!isHttpsUrl(project.live_url)) {
        setFieldError("project-live-url", "Use an https:// URL or leave this empty.");
        first = first || liveInput;
      }
      if (!isHttpsUrl(project.code_url)) {
        setFieldError("project-code-url", "Use an https:// URL or leave this empty.");
        first = first || codeInput;
      }
      if (BUTTON_LABELS.indexOf(project.button_label) === -1) {
        first = first || buttonSelect;
      }
      if (project.images.length > MAX_SCREENSHOTS) {
        setStatus(shotStatus, "You can have at most 8 screenshots.", true);
      }

      var missingAlt = false;
      var invalidUrl = false;
      project.images.forEach(function (image, index) {
        var altField = document.querySelector('[data-shot-alt="' + index + '"]');
        if (!image.alt) {
          missingAlt = true;
          if (altField) altField.classList.add("is-invalid");
          first = first || altField;
        } else if (altField) {
          altField.classList.remove("is-invalid");
        }
        if (!safeHref(image.url)) {
          invalidUrl = true;
          var urlField = document.querySelector('[data-shot-url="' + index + '"]');
          if (urlField) urlField.classList.add("is-invalid");
          first = first || urlField;
        }
      });
      if (missingAlt) setStatus(shotStatus, "Every screenshot needs alt text.", true);
      else if (invalidUrl) setStatus(shotStatus, "Use a relative /assets path or an https:// URL for every screenshot.", true);
      if (first) first.focus();
      return !first;
    }

    async function saveProject() {
      if (editorState !== state || state.saving) return;
      if (state.uploading || state.savingShots) {
        setStatus(formMessage, "Wait for the screenshots to finish saving.", true);
        return;
      }
      var project = readProjectForm();
      if (!validateProject(project)) {
        setStatus(formMessage, "Please fix the highlighted fields.", true);
        return;
      }

      state.saving = true;
      saveButton.disabled = true;
      setStatus(formMessage, "Saving project…", false);

      try {
        var unique = await validateSlugUnique();
        if (!unique) {
          if (editorState === state) setStatus(formMessage, "Please choose an available slug.", true);
          return;
        }
        if (editorState !== state) return;
        var payload = {
          title: project.title,
          slug: project.slug,
          description: project.description,
          seo_description: project.seo_description,
          live_url: project.live_url || null,
          code_url: project.code_url || null,
          button_label: project.button_label,
          tags: project.tags,
          images: project.images,
          is_visible: project.is_visible,
          updated_at: new Date().toISOString()
        };
        if (!state.id) payload.sort_order = await nextSortOrder("projects");
        if (editorState !== state) return;
        var saved = await saveProjectRecord(payload, state.id);
        if (editorState !== state) return;
        if (!saved || !saved.id) throw new Error("The project was saved but the response was unexpected.");
        state.id = saved.id;
        state.data = Object.assign({}, state.data, saved);
        state.slugTouched = true;
        state.dirty = false;
        if (!existing) {
          existing = saved;
          var newHash = "#/projects/" + encodeURIComponent(saved.id);
          history.replaceState(null, "", newHash);
          currentHash = newHash;
          document.title = "Edit project | Neelam Dhiman Admin";
          var headTitle = editorHead.querySelector("h1");
          var headSub = editorHead.querySelector(".page-head__sub");
          if (headTitle) headTitle.textContent = "Edit project";
          if (headSub) headSub.textContent = "Changes appear on the public site only after publishing in the next step.";
        }
        setStatus(formMessage, "Project saved.", false);
        showToast("Project saved.", false);
      } catch (error) {
        if (editorState === state && error.message !== SESSION_MESSAGE) {
          setStatus(formMessage, error.message, true);
          showToast(error.message, true);
        }
      } finally {
        if (editorState === state) {
          state.saving = false;
          saveButton.disabled = false;
        }
      }
    }

    titleInput.addEventListener("input", function () {
      if (!state.slugTouched) slugInput.value = slugify(titleInput.value);
      markDirty();
      setFieldError("project-title", "");
    });
    slugInput.addEventListener("input", function () {
      state.slugTouched = true;
      markDirty();
      setFieldError("project-slug", "");
    });
    slugInput.addEventListener("blur", validateSlugUnique);
    descriptionInput.addEventListener("input", function () {
      markDirty();
      updateCounters();
      setFieldError("project-description", "");
    });
    seoDescriptionInput.addEventListener("input", function () {
      markDirty();
      updateCounters();
    });
    liveInput.addEventListener("input", function () {
      markDirty();
      setFieldError("project-live-url", "");
    });
    codeInput.addEventListener("input", function () {
      markDirty();
      setFieldError("project-code-url", "");
    });
    buttonSelect.addEventListener("change", markDirty);
    tagsInput.addEventListener("input", markDirty);
    visibleInput.addEventListener("change", markDirty);
    shotFile.addEventListener("change", function () {
      var files = Array.prototype.slice.call(shotFile.files || []);
      if (files.length) uploadScreenshots(files);
    });
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      saveProject();
    });

    updateCounters();
    drawShots();
  }

  async function renderImages(token) {
    view.textContent = "";
    view.appendChild(pageHead("Images", "Replace the profile photo used in the hero and about sections."));
    var loading = loadingNode("Loading images…");
    view.appendChild(loading);

    var rows;
    try {
      rows = await listSettings();
    } catch (error) {
      if (token !== viewToken) return;
      loading.remove();
      if (error.message !== SESSION_MESSAGE) view.appendChild(errorPanel("Could not load images", error.message));
      return;
    }
    if (token !== viewToken) return;
    loading.remove();

    var settings = mapSettings(rows);
    var imagesValue = settings.images && typeof settings.images === "object" ? Object.assign({}, settings.images) : {};
    var profile = imagesValue.profile && typeof imagesValue.profile === "object" ? Object.assign({}, imagesValue.profile) : {};
    var hasProfile = !!(profile.webp400 || profile.webp800 || profile.jpg800);

    if (!settings.images || !hasProfile) view.appendChild(seedMessage());

    var status = el("p", { className: "inline-status", role: "status", "aria-live": "polite", hidden: true });
    var preview = el("div", { className: "profile-preview" });
    var altInput = el("input", {
      id: "profile-alt",
      type: "text",
      value: profile.alt || "",
      autocomplete: "off",
      "aria-describedby": "profile-alt-error"
    });
    var altError = el("p", { className: "field-error", id: "profile-alt-error", hidden: true });
    var fileInput = el("input", {
      id: "profile-file",
      type: "file",
      accept: "image/jpeg,image/png,image/webp",
      className: "profile-file"
    });
    var replaceButton = el("button", { type: "button", className: "btn", text: "Replace photo" });
    var saveAltButton = el("button", { type: "button", className: "btn btn--secondary", text: "Save alt text" });

    var card = el("section", { className: "card" }, [
      el("div", { className: "profile-panel" }, [
        preview,
        el("div", { className: "profile-fields" }, [
          el("div", { className: "field" }, [
            el("label", { for: "profile-alt", text: "Alt text" }),
            altInput,
            el("p", { className: "field-hint", text: "Describe the photo for screen readers. Required." }),
            altError
          ]),
          el("div", { className: "form-actions" }, [replaceButton, saveAltButton]),
          fileInput,
          status
        ])
      ]),
      el("p", { className: "note", text: "The public site changes only after you publish the site in the next step." })
    ]);
    view.appendChild(card);

    function drawPreview() {
      clearNode(preview);
      addImageWithFallback(
        preview,
        profile.webp800 || profile.webp400 || profile.jpg800,
        altInput.value.trim() || profile.alt || "Profile photo",
        "",
        "profile-placeholder",
        "No profile photo yet",
        false
      );
    }

    function markAltDirty() {
      imagesDirty = true;
      setFieldError("profile-alt", "");
    }

    async function saveProfile(nextProfile, successMessage) {
      try {
        var nextImages = Object.assign({}, imagesValue, { profile: nextProfile });
        await saveSettingValue("images", nextImages);
        imagesValue = nextImages;
        profile = nextProfile;
        imagesDirty = false;
        drawPreview();
        setStatus(status, successMessage, false);
        showToast(successMessage, false);
        return true;
      } catch (error) {
        if (error.message !== SESSION_MESSAGE) {
          setStatus(status, error.message, true);
          showToast(error.message, true);
        }
        return false;
      }
    }

    altInput.addEventListener("input", markAltDirty);
    replaceButton.addEventListener("click", function () {
      var alt = altInput.value.trim();
      if (!alt) {
        setFieldError("profile-alt", "Alt text is required before replacing the photo.");
        altInput.focus();
        return;
      }
      setFieldError("profile-alt", "");
      fileInput.click();
    });

    fileInput.addEventListener("change", async function () {
      var file = fileInput.files && fileInput.files[0];
      fileInput.value = "";
      if (!file) return;
      var alt = altInput.value.trim();
      if (!alt) {
        setFieldError("profile-alt", "Alt text is required before uploading the photo.");
        altInput.focus();
        return;
      }
      var problem = validateImageFile(file);
      if (problem) {
        setStatus(status, problem, true);
        return;
      }

      replaceButton.disabled = true;
      saveAltButton.disabled = true;
      setStatus(status, "Preparing the three image sizes…", false);

      try {
        var img = await loadImageFile(file);
        var uuid = makeUuid();
        var base = "site/profile-" + uuid;
        var specs = [
          { key: "webp400", suffix: "-400.webp", width: 400, type: "image/webp" },
          { key: "webp800", suffix: "-800.webp", width: 800, type: "image/webp" },
          { key: "jpg800", suffix: "-800.jpg", width: 800, type: "image/jpeg" }
        ];
        var nextProfile = { alt: alt };

        for (var i = 0; i < specs.length; i += 1) {
          var spec = specs[i];
          setStatus(status, "Creating " + spec.width + "px " + (spec.type === "image/jpeg" ? "JPEG" : "WebP") + "…", false);
          var blob = await resizeImage(img, spec.width, spec.type, IMAGE_QUALITY);
          var url = await uploadToSiteImages(base + spec.suffix, blob, spec.type);
          if (!url) throw new Error("Could not get the uploaded image URL.");
          nextProfile[spec.key] = url;
        }

        setStatus(status, "Saving photo details…", false);
        await saveProfile(nextProfile, "Profile photo updated.");
      } catch (error) {
        if (error.message !== SESSION_MESSAGE) {
          setStatus(status, error.message, true);
          showToast(error.message, true);
        }
      } finally {
        replaceButton.disabled = false;
        saveAltButton.disabled = false;
      }
    });

    saveAltButton.addEventListener("click", async function () {
      var alt = altInput.value.trim();
      if (!alt) {
        setFieldError("profile-alt", "Alt text is required.");
        altInput.focus();
        return;
      }
      if (!hasProfile && !profile.webp400 && !profile.webp800 && !profile.jpg800) {
        setStatus(status, "Upload a profile photo first.", true);
        return;
      }
      setFieldError("profile-alt", "");
      saveAltButton.disabled = true;
      setStatus(status, "Saving alt text…", false);
      var nextProfile = Object.assign({}, profile, { alt: alt });
      await saveProfile(nextProfile, "Alt text saved.");
      saveAltButton.disabled = false;
    });

    drawPreview();
  }

  async function renderSkills(token) {
    view.textContent = "";
    view.appendChild(pageHead("Skills", "Manage the toolkit and stat cards shown on the site."));
    var loading = loadingNode("Loading skills…");
    view.appendChild(loading);

    var tools;
    var stats;
    try {
      var results = await Promise.all([listTools(), listStats()]);
      tools = results[0];
      stats = results[1];
    } catch (error) {
      if (token !== viewToken) return;
      loading.remove();
      if (error.message !== SESSION_MESSAGE) view.appendChild(errorPanel("Could not load skills", error.message));
      return;
    }
    if (token !== viewToken) return;
    loading.remove();

    var toolsStatus = el("p", { className: "inline-status", role: "status", "aria-live": "polite", hidden: true });
    var statsStatus = el("p", { className: "inline-status", role: "status", "aria-live": "polite", hidden: true });
    var toolsList = el("div", { className: "skill-list" });
    var statsList = el("div", { className: "skill-list" });
    var addToolHolder = el("div");
    var addStatHolder = el("div");
    var sortingTools = false;
    var sortingStats = false;

    var addToolButton = el("button", { type: "button", className: "btn btn--secondary btn--small", text: "Add tool" });
    var addStatButton = el("button", { type: "button", className: "btn btn--secondary btn--small", text: "Add stat" });

    var toolsCard = el("section", { className: "card" }, [
      el("div", { className: "card__head" }, [
        el("h2", { text: "Tools" }),
        el("div", { className: "card__actions" }, [addToolButton])
      ]),
      addToolHolder,
      toolsStatus,
      toolsList
    ]);
    var statsCard = el("section", { className: "card" }, [
      el("div", { className: "card__head" }, [
        el("h2", { text: "Stats" }),
        el("div", { className: "card__actions" }, [addStatButton])
      ]),
      addStatHolder,
      statsStatus,
      statsList
    ]);
    view.appendChild(el("div", { className: "skills-grid" }, [toolsCard, statsCard]));

    function toolLogo(tool) {
      var box = el("div", { className: "skill-logo" });
      var url = safeHref(tool.logo_url);
      if (!url) {
        box.textContent = String(tool.name || "?").trim().charAt(0).toUpperCase() || "?";
        return box;
      }
      var img = el("img", { src: url, alt: "", loading: "lazy" });
      img.addEventListener("error", function () {
        clearNode(box);
        box.textContent = String(tool.name || "?").trim().charAt(0).toUpperCase() || "?";
      });
      box.appendChild(img);
      return box;
    }

    async function updateToolLogo(tool, url, button, statusNode) {
      button.disabled = true;
      setStatus(statusNode, "Saving logo…", false);
      try {
        await runQuery(
          client.from("tools").update({ logo_url: url }).eq("id", tool.id),
          "Could not save the logo."
        );
        tool.logo_url = url;
        setStatus(statusNode, url ? "Logo updated." : "Logo removed.", false);
        drawTools();
      } catch (error) {
        button.disabled = false;
        reportError(error, "Could not save the logo.", statusNode);
      }
    }

    function drawTools() {
      clearNode(toolsList);
      if (tools.length === 0) {
        toolsList.appendChild(seedMessage());
        return;
      }
      tools.forEach(function (tool, index) {
        var up = iconButton("up", "Move " + (tool.name || "tool") + " up");
        var down = iconButton("down", "Move " + (tool.name || "tool") + " down");
        up.disabled = sortingTools || index === 0;
        down.disabled = sortingTools || index === tools.length - 1;
        up.addEventListener("click", function () { moveTool(index, -1); });
        down.addEventListener("click", function () { moveTool(index, 1); });

        var nameInput = el("input", {
          type: "text",
          value: tool.name || "",
          autocomplete: "off",
          "aria-label": "Tool name"
        });
        nameInput.addEventListener("input", function () {
          tool.name = nameInput.value;
          setStatus(toolsStatus, "", false);
        });

        var logoFile = el("input", {
          type: "file",
          accept: "image/jpeg,image/png,image/webp",
          className: "profile-file",
          "aria-label": "Upload logo for " + (tool.name || "tool")
        });
        logoFile.addEventListener("change", function () {
          var file = logoFile.files && logoFile.files[0];
          logoFile.value = "";
          if (!file) return;
          var problem = validateImageFile(file);
          if (problem) {
            setStatus(toolsStatus, problem, true);
            return;
          }
          setStatus(toolsStatus, "Uploading logo…", false);
          uploadToolLogo(file)
            .then(function (url) { return updateToolLogo(tool, url, uploadButton, toolsStatus); })
            .catch(function (error) {
              if (error.message !== SESSION_MESSAGE) {
                setStatus(toolsStatus, error.message, true);
                showToast(error.message, true);
              }
            });
        });

        var uploadButton = el("button", { type: "button", className: "btn btn--ghost btn--small", text: "Logo" });
        uploadButton.setAttribute("aria-label", "Upload logo for " + (tool.name || "tool"));
        uploadButton.addEventListener("click", function () { logoFile.click(); });

        var removeLogo = el("button", { type: "button", className: "btn btn--ghost btn--small", text: "Remove logo" });
        removeLogo.hidden = !tool.logo_url;
        removeLogo.addEventListener("click", function () { updateToolLogo(tool, null, removeLogo, toolsStatus); });

        var save = el("button", { type: "button", className: "btn btn--secondary btn--small", text: "Save" });
        save.addEventListener("click", async function () {
          var name = nameInput.value.trim();
          if (!name) {
            setStatus(toolsStatus, "Tool name is required.", true);
            nameInput.focus();
            return;
          }
          save.disabled = true;
          setStatus(toolsStatus, "Saving tool…", false);
          try {
            await runQuery(
              client.from("tools").update({ name: name, logo_url: tool.logo_url || null }).eq("id", tool.id),
              "Could not save that tool."
            );
            tool.name = name;
            setStatus(toolsStatus, "Tool saved.", false);
            drawTools();
          } catch (error) {
            save.disabled = false;
            reportError(error, "Could not save that tool.", toolsStatus);
          }
        });

        var remove = iconButton("trash", "Delete " + (tool.name || "tool"), "is-danger");
        remove.addEventListener("click", async function () {
          if (!window.confirm('Delete "' + (tool.name || "this tool") + '"? This cannot be undone.')) return;
          remove.disabled = true;
          try {
            await deleteRecord("tools", tool.id);
            tools = tools.filter(function (item) { return item.id !== tool.id; });
            drawTools();
            setStatus(toolsStatus, "Tool deleted.", false);
            showToast("Tool deleted.", false);
          } catch (error) {
            remove.disabled = false;
            reportError(error, "Could not delete that tool.", toolsStatus);
          }
        });

        toolsList.appendChild(el("div", { className: "skill-row" }, [
          el("div", { className: "skill-row__order" }, [up, down]),
          toolLogo(tool),
          el("div", { className: "skill-fields" }, [
            nameInput,
            el("div", { className: "skill-row__actions" }, [uploadButton, removeLogo, save, remove])
          ]),
          logoFile
        ]));
      });
    }

    async function moveTool(index, delta) {
      if (sortingTools) return;
      var target = index + delta;
      if (target < 0 || target >= tools.length) return;
      var snapshot = tools.map(function (tool) { return Object.assign({}, tool); });
      var next = tools.slice();
      var moved = next[index];
      next[index] = next[target];
      next[target] = moved;
      next.forEach(function (tool, position) { tool.sort_order = (position + 1) * 10; });
      tools = next;
      sortingTools = true;
      setStatus(toolsStatus, "Saving order…", false);
      drawTools();
      try {
        await upsertOrder("tools", tools.map(function (tool) {
          return Object.assign({}, tool);
        }));
        setStatus(toolsStatus, "Tool order saved.", false);
      } catch (error) {
        tools = snapshot;
        if (error.message !== SESSION_MESSAGE) {
          setStatus(toolsStatus, "Could not save the new order. Nothing was changed.", true);
          showToast("Could not save the new order.", true);
        }
      } finally {
        sortingTools = false;
        drawTools();
      }
    }

    function openAddTool() {
      clearNode(addToolHolder);
      var nameInput = el("input", { type: "text", autocomplete: "off", "aria-label": "New tool name", placeholder: "Tool name" });
      var logoFile = el("input", { type: "file", accept: "image/jpeg,image/png,image/webp", "aria-label": "Logo (optional)" });
      var addButton = el("button", { type: "submit", className: "btn btn--small", text: "Add tool" });
      var cancel = el("button", { type: "button", className: "btn btn--ghost btn--small", text: "Cancel" });
      var form = el("form", { className: "inline-form", novalidate: "novalidate" }, [
        el("div", { className: "inline-grid" }, [
          el("div", { className: "field" }, [
            el("label", { text: "Tool name" }),
            nameInput
          ]),
          el("div", { className: "field" }, [
            el("label", { text: "Logo (optional, JPG/PNG/WebP)" }),
            logoFile
          ])
        ]),
        el("div", { className: "inline-actions" }, [addButton, cancel])
      ]);
      cancel.addEventListener("click", function () { clearNode(addToolHolder); });
      form.addEventListener("submit", async function (event) {
        event.preventDefault();
        var name = nameInput.value.trim();
        if (!name) {
          setStatus(toolsStatus, "Tool name is required.", true);
          nameInput.focus();
          return;
        }
        var file = logoFile.files && logoFile.files[0];
        if (file) {
          var problem = validateImageFile(file);
          if (problem) {
            setStatus(toolsStatus, problem, true);
            return;
          }
        }
        addButton.disabled = true;
        setStatus(toolsStatus, file ? "Uploading logo…" : "Adding tool…", false);
        try {
          var logoUrl = file ? await uploadToolLogo(file) : null;
          var maxOrder = tools.reduce(function (max, tool) {
            return Math.max(max, Number(tool.sort_order) || 0);
          }, 0);
          var inserted = await runQuery(
            client.from("tools").insert({ name: name, logo_url: logoUrl, sort_order: maxOrder + 10 }).select().single(),
            "Could not add that tool."
          );
          tools.push(inserted);
          clearNode(addToolHolder);
          drawTools();
          setStatus(toolsStatus, "Tool added.", false);
          showToast("Tool added.", false);
        } catch (error) {
          addButton.disabled = false;
          reportError(error, "Could not add that tool.", toolsStatus);
        }
      });
      addToolHolder.appendChild(form);
      nameInput.focus();
    }

    addToolButton.addEventListener("click", openAddTool);

    function drawStats() {
      clearNode(statsList);
      if (stats.length === 0) {
        statsList.appendChild(seedMessage());
        return;
      }
      stats.forEach(function (stat, index) {
        var up = iconButton("up", "Move " + (stat.label || "stat") + " up");
        var down = iconButton("down", "Move " + (stat.label || "stat") + " down");
        up.disabled = sortingStats || index === 0;
        down.disabled = sortingStats || index === stats.length - 1;
        up.addEventListener("click", function () { moveStat(index, -1); });
        down.addEventListener("click", function () { moveStat(index, 1); });

        var valueInput = el("input", {
          type: "text",
          value: stat.value || "",
          autocomplete: "off",
          "aria-label": "Stat value"
        });
        var labelInput = el("input", {
          type: "text",
          value: stat.label || "",
          autocomplete: "off",
          "aria-label": "Stat label"
        });
        valueInput.addEventListener("input", function () {
          stat.value = valueInput.value;
          setStatus(statsStatus, "", false);
        });
        labelInput.addEventListener("input", function () {
          stat.label = labelInput.value;
          setStatus(statsStatus, "", false);
        });

        var save = el("button", { type: "button", className: "btn btn--secondary btn--small", text: "Save" });
        save.addEventListener("click", async function () {
          var value = valueInput.value.trim();
          var label = labelInput.value.trim();
          if (!value || !label) {
            setStatus(statsStatus, "Value and label are required.", true);
            (value ? labelInput : valueInput).focus();
            return;
          }
          save.disabled = true;
          setStatus(statsStatus, "Saving stat…", false);
          try {
            await runQuery(
              client.from("stats").update({ value: value, label: label }).eq("id", stat.id),
              "Could not save that stat."
            );
            stat.value = value;
            stat.label = label;
            setStatus(statsStatus, "Stat saved.", false);
            drawStats();
          } catch (error) {
            save.disabled = false;
            reportError(error, "Could not save that stat.", statsStatus);
          }
        });

        var remove = iconButton("trash", "Delete " + (stat.label || "stat"), "is-danger");
        remove.addEventListener("click", async function () {
          if (!window.confirm('Delete "' + (stat.label || "this stat") + '"? This cannot be undone.')) return;
          remove.disabled = true;
          try {
            await deleteRecord("stats", stat.id);
            stats = stats.filter(function (item) { return item.id !== stat.id; });
            drawStats();
            setStatus(statsStatus, "Stat deleted.", false);
            showToast("Stat deleted.", false);
          } catch (error) {
            remove.disabled = false;
            reportError(error, "Could not delete that stat.", statsStatus);
          }
        });

        statsList.appendChild(el("div", { className: "stat-row" }, [
          el("div", { className: "skill-row__order" }, [up, down]),
          valueInput,
          el("div", { className: "stat-row__actions" }, [labelInput, save, remove])
        ]));
      });
    }

    async function moveStat(index, delta) {
      if (sortingStats) return;
      var target = index + delta;
      if (target < 0 || target >= stats.length) return;
      var snapshot = stats.map(function (stat) { return Object.assign({}, stat); });
      var next = stats.slice();
      var moved = next[index];
      next[index] = next[target];
      next[target] = moved;
      next.forEach(function (stat, position) { stat.sort_order = (position + 1) * 10; });
      stats = next;
      sortingStats = true;
      setStatus(statsStatus, "Saving order…", false);
      drawStats();
      try {
        await upsertOrder("stats", stats.map(function (stat) {
          return Object.assign({}, stat);
        }));
        setStatus(statsStatus, "Stat order saved.", false);
      } catch (error) {
        stats = snapshot;
        if (error.message !== SESSION_MESSAGE) {
          setStatus(statsStatus, "Could not save the new order. Nothing was changed.", true);
          showToast("Could not save the new order.", true);
        }
      } finally {
        sortingStats = false;
        drawStats();
      }
    }

    function openAddStat() {
      clearNode(addStatHolder);
      var valueInput = el("input", { type: "text", autocomplete: "off", "aria-label": "New stat value", placeholder: "500+" });
      var labelInput = el("input", { type: "text", autocomplete: "off", "aria-label": "New stat label", placeholder: "Development Hours" });
      var addButton = el("button", { type: "submit", className: "btn btn--small", text: "Add stat" });
      var cancel = el("button", { type: "button", className: "btn btn--ghost btn--small", text: "Cancel" });
      var form = el("form", { className: "inline-form", novalidate: "novalidate" }, [
        el("div", { className: "inline-grid" }, [
          el("div", { className: "field" }, [el("label", { text: "Value" }), valueInput]),
          el("div", { className: "field" }, [el("label", { text: "Label" }), labelInput])
        ]),
        el("div", { className: "inline-actions" }, [addButton, cancel])
      ]);
      cancel.addEventListener("click", function () { clearNode(addStatHolder); });
      form.addEventListener("submit", async function (event) {
        event.preventDefault();
        var value = valueInput.value.trim();
        var label = labelInput.value.trim();
        if (!value || !label) {
          setStatus(statsStatus, "Value and label are required.", true);
          (value ? labelInput : valueInput).focus();
          return;
        }
        addButton.disabled = true;
        setStatus(statsStatus, "Adding stat…", false);
        try {
          var maxOrder = stats.reduce(function (max, stat) {
            return Math.max(max, Number(stat.sort_order) || 0);
          }, 0);
          var inserted = await runQuery(
            client.from("stats").insert({ value: value, label: label, sort_order: maxOrder + 10 }).select().single(),
            "Could not add that stat."
          );
          stats.push(inserted);
          clearNode(addStatHolder);
          drawStats();
          setStatus(statsStatus, "Stat added.", false);
          showToast("Stat added.", false);
        } catch (error) {
          addButton.disabled = false;
          reportError(error, "Could not add that stat.", statsStatus);
        }
      });
      addStatHolder.appendChild(form);
      valueInput.focus();
    }

    addStatButton.addEventListener("click", openAddStat);

    drawTools();
    drawStats();
  }

  async function renderMessages(token) {
    view.textContent = "";
    var markAllButton = el("button", { type: "button", className: "btn btn--ghost btn--small", text: "Mark all read" });
    markAllButton.disabled = true;
    view.appendChild(pageHead("Messages", "Every contact form submission appears here.", [markAllButton]));
    var loading = loadingNode("Loading messages…");
    view.appendChild(loading);

    var messages;
    try {
      messages = await listMessages();
    } catch (error) {
      if (token !== viewToken) return;
      loading.remove();
      if (error.message === SESSION_MESSAGE) return;
      view.appendChild(errorPanel("Could not load messages", error.message));
      view.appendChild(el("p", { className: "note", text: "Create the messages table by running tools/schema.sql in the Supabase SQL editor, then refresh this page." }));
      return;
    }
    if (token !== viewToken) return;
    loading.remove();

    var unread = messages.filter(function (message) { return !message.is_read; }).length;
    updateMessageBadge(unread);
    markAllButton.disabled = unread === 0;

    var status = el("p", { className: "inline-status", role: "status", "aria-live": "polite", hidden: true });
    var tabs = el("div", { className: "filter-tabs", role: "tablist", "aria-label": "Filter messages" });
    var list = el("div", { className: "message-list" });
    var filter = "all";

    function setUnreadCount() {
      unread = messages.filter(function (message) { return !message.is_read; }).length;
      updateMessageBadge(unread);
      markAllButton.disabled = unread === 0;
      drawTabs();
    }

    function drawTabs() {
      clearNode(tabs);
      [
        { key: "all", label: "All", count: messages.length },
        { key: "unread", label: "Unread", count: unread }
      ].forEach(function (tab) {
        var button = el("button", {
          type: "button",
          className: "filter-tab" + (filter === tab.key ? " is-active" : ""),
          role: "tab",
          "aria-selected": filter === tab.key ? "true" : "false",
          text: tab.label + " (" + tab.count + ")"
        });
        button.addEventListener("click", function () {
          filter = tab.key;
          drawTabs();
          drawList();
        });
        tabs.appendChild(button);
      });
    }

    function drawList() {
      clearNode(list);
      var visibleMessages = filter === "unread"
        ? messages.filter(function (message) { return !message.is_read; })
        : messages;

      if (visibleMessages.length === 0) {
        list.appendChild(el("div", { className: "empty" }, [
          el("strong", { text: filter === "unread" ? "No unread messages" : "No messages yet" }),
          el("span", { text: filter === "unread" ? "You're all caught up." : "Contact form submissions will appear here." })
        ]));
        return;
      }

      visibleMessages.forEach(function (message) {
        var unreadClass = message.is_read ? "" : " is-unread";
        var reply = el("a", {
          className: "btn btn--secondary btn--small",
          href: "mailto:" + encodeURIComponent(message.email || ""),
          text: "Reply"
        });
        var toggle = el("button", {
          type: "button",
          className: "btn btn--ghost btn--small",
          text: message.is_read ? "Mark unread" : "Mark read"
        });
        toggle.addEventListener("click", function () {
          var nextRead = !message.is_read;
          toggle.disabled = true;
          setStatus(status, nextRead ? "Marking as read…" : "Marking as unread…", false);
          updateMessage(message.id, { is_read: nextRead })
            .then(function () {
              message.is_read = nextRead;
              setUnreadCount();
              drawList();
              setStatus(status, nextRead ? "Message marked as read." : "Message marked as unread.", false);
            })
            .catch(function (error) {
              toggle.disabled = false;
              reportError(error, "Could not update that message.", status);
            });
        });

        var remove = el("button", { type: "button", className: "btn btn--danger btn--small", text: "Delete" });
        remove.addEventListener("click", function () {
          if (!window.confirm("Delete the message from " + (message.name || "this sender") + "? This cannot be undone.")) return;
          remove.disabled = true;
          setStatus(status, "Deleting message…", false);
          deleteRecord("messages", message.id)
            .then(function () {
              messages = messages.filter(function (item) { return item.id !== message.id; });
              setUnreadCount();
              drawList();
              setStatus(status, "Message deleted.", false);
              showToast("Message deleted.", false);
            })
            .catch(function (error) {
              remove.disabled = false;
              reportError(error, "Could not delete that message.", status);
            });
        });

        list.appendChild(el("article", { className: "message-card" + unreadClass }, [
          el("div", { className: "message-card__head" }, [
            el("span", { className: "message-card__dot", "aria-hidden": "true" }),
            el("div", { className: "message-card__who" }, [
              el("strong", { text: message.name || "Unknown sender" }),
              el("a", { href: "mailto:" + encodeURIComponent(message.email || ""), text: message.email || "No email" })
            ]),
            el("span", { className: "message-card__date", text: formatDateTime(message.created_at) })
          ]),
          el("p", { className: "message-card__body", text: message.message || "" }),
          el("div", { className: "message-card__foot" }, [
            el("span", { className: "tag", text: message.source || "contact" }),
            el("div", { className: "message-card__actions" }, [reply, toggle, remove])
          ])
        ]));
      });
    }

    markAllButton.disabled = unread === 0;
    markAllButton.addEventListener("click", function () {
      if (!unread) return;
      markAllButton.disabled = true;
      setStatus(status, "Marking all messages as read…", false);
      runQuery(
        client.from("messages").update({ is_read: true }).eq("is_read", false),
        "Could not mark messages as read."
      )
        .then(function () {
          messages.forEach(function (message) { message.is_read = true; });
          setUnreadCount();
          drawList();
          setStatus(status, "All messages marked as read.", false);
          showToast("All messages marked as read.", false);
        })
        .catch(function (error) {
          markAllButton.disabled = false;
          reportError(error, "Could not mark messages as read.", status);
        });
    });

    view.appendChild(tabs);
    view.appendChild(status);
    view.appendChild(list);
    drawTabs();
    drawList();
  }

  function seoDefaults() {
    return {
      site_name: "Neelam Dhiman",
      author: "Neelam Dhiman",
      theme_color: "#FAF5EA",
      robots: "index, follow, max-image-preview:large",
      home: {
        title: "Neelam Dhiman | Web Developer in Kaithal, Haryana",
        description: "Neelam Dhiman is a web developer in Kaithal, Haryana. I build websites, games and automation tools, and help small businesses with SEO and social media.",
        canonical: "https://neelamdhiman.vercel.app/",
        og_title: "Neelam Dhiman | Web Developer in Kaithal, Haryana",
        og_description: "Neelam Dhiman is a web developer in Kaithal, Haryana. I build websites, games and automation tools, and help small businesses with SEO and social media.",
        og_image: "https://neelamdhiman.vercel.app/assets/og-image.png"
      },
      faq: {
        title: "FAQ | Neelam Dhiman",
        description: "Answers to common questions about Neelam Dhiman's web development, SEO and social media work in Kaithal, Haryana.",
        canonical: "https://neelamdhiman.vercel.app/faq.html",
        og_title: "FAQ | Neelam Dhiman",
        og_description: "Answers to common questions about Neelam Dhiman's web development, SEO and social media work in Kaithal, Haryana.",
        og_image: "https://neelamdhiman.vercel.app/assets/og-image.png"
      }
    };
  }

  function seoCounter(input, counter, min, max) {
    function update() {
      var length = input.value.length;
      counter.textContent = length + " (target " + min + "–" + max + ")";
      counter.classList.toggle("is-near", length > 0 && length < min);
      counter.classList.toggle("is-over", length > max);
    }
    input.addEventListener("input", update);
    update();
  }

  async function renderSeo(token) {
    view.textContent = "";
    view.appendChild(pageHead("SEO", "Edit the title, description and sharing metadata for the whole portfolio."));
    var loading = loadingNode("Loading SEO settings…");
    view.appendChild(loading);

    var rows;
    try {
      rows = await listSettings();
    } catch (error) {
      if (token !== viewToken) return;
      loading.remove();
      if (error.message === SESSION_MESSAGE) return;
      view.appendChild(errorPanel("Could not load SEO settings", error.message));
      return;
    }
    if (token !== viewToken) return;
    loading.remove();

    var settings = mapSettings(rows);
    var defaults = seoDefaults();
    var stored = settings.seo && typeof settings.seo === "object" ? settings.seo : {};
    var seo = {
      site_name: String(stored.site_name || defaults.site_name),
      author: String(stored.author || defaults.author),
      theme_color: String(stored.theme_color || defaults.theme_color),
      robots: String(stored.robots || defaults.robots),
      home: Object.assign({}, defaults.home, stored.home && typeof stored.home === "object" ? stored.home : {}),
      faq: Object.assign({}, defaults.faq, stored.faq && typeof stored.faq === "object" ? stored.faq : {})
    };

    var status = el("p", { className: "inline-status", role: "status", "aria-live": "polite", hidden: true });
    var saveButton = el("button", { type: "button", className: "btn", text: "Save SEO settings" });

    function markSeoDirty() {
      settingsDirty.seo = true;
      setStatus(status, "", false);
    }

    function makeInput(key, label, value, target, options) {
      var input = el("input", Object.assign({
        type: "text",
        value: value || "",
        autocomplete: "off",
        "aria-label": label,
        "data-seo-target": target || "global"
      }, options || {}));
      input.addEventListener("input", function () {
        var scope = input.getAttribute("data-seo-target") || "global";
        if (scope === "global") seo[key] = input.value;
        else seo[scope][key] = input.value;
        markSeoDirty();
      });
      return input;
    }

    var siteNameInput = makeInput("site_name", "Site name", seo.site_name);
    var authorInput = makeInput("author", "Author", seo.author);
    var themeColorInput = makeInput("theme_color", "Theme color", seo.theme_color);
    var robotsInput = el("select", { "aria-label": "Robots directive" }, [
      el("option", { value: "index, follow, max-image-preview:large", text: "Index, follow, large image previews" }),
      el("option", { value: "index, follow", text: "Index, follow" }),
      el("option", { value: "noindex, nofollow", text: "No index, no follow" })
    ]);
    robotsInput.value = seo.robots;
    if (!robotsInput.value) robotsInput.value = "index, follow, max-image-preview:large";
    robotsInput.addEventListener("change", function () {
      seo.robots = robotsInput.value;
      markSeoDirty();
    });

    function pageCard(title, key, description) {
      var page = seo[key];
      var titleInput = makeInput("title", title + " title", page.title, key);
      var descriptionInput = el("textarea", { rows: "3", "aria-label": title + " meta description" });
      descriptionInput.value = page.description || "";
      descriptionInput.setAttribute("data-seo-target", key);
      descriptionInput.addEventListener("input", function () {
        page.description = descriptionInput.value;
        markSeoDirty();
      });
      var canonicalInput = makeInput("canonical", title + " canonical URL", page.canonical, key);
      var ogTitleInput = makeInput("og_title", title + " social title", page.og_title, key);
      var ogDescriptionInput = el("textarea", { rows: "2", "aria-label": title + " social description" });
      ogDescriptionInput.value = page.og_description || "";
      ogDescriptionInput.setAttribute("data-seo-target", key);
      ogDescriptionInput.addEventListener("input", function () {
        page.og_description = ogDescriptionInput.value;
        markSeoDirty();
      });
      var ogImageInput = makeInput("og_image", title + " social image", page.og_image, key);

      var titleCount = el("span", { className: "counter" });
      var descCount = el("span", { className: "counter" });
      seoCounter(titleInput, titleCount, 50, 60);
      seoCounter(descriptionInput, descCount, 120, 160);

      var previewTitle = el("span", { className: "seo-preview__title", text: page.title || "Page title" });
      var previewUrl = el("span", { className: "seo-preview__url", text: page.canonical || "https://neelamdhiman.vercel.app/" });
      var previewDesc = el("span", { className: "seo-preview__desc", text: page.description || "Meta description preview" });
      titleInput.addEventListener("input", function () { previewTitle.textContent = titleInput.value || "Page title"; });
      canonicalInput.addEventListener("input", function () { previewUrl.textContent = canonicalInput.value || "https://neelamdhiman.vercel.app/"; });
      descriptionInput.addEventListener("input", function () { previewDesc.textContent = descriptionInput.value || "Meta description preview"; });

      return el("section", { className: "card seo-card" }, [
        el("div", { className: "card__head" }, [
          el("h2", { text: title }),
          el("span", { className: "muted small", text: description })
        ]),
        el("div", { className: "seo-preview" }, [previewTitle, previewUrl, previewDesc]),
        el("div", { className: "form-grid" }, [
          el("div", { className: "field field--wide" }, [
            el("label", { text: "SEO title" }),
            titleInput,
            el("div", { className: "counter-row" }, [el("span", { className: "field-hint", text: "Aim for 50–60 characters." }), titleCount])
          ]),
          el("div", { className: "field field--wide" }, [
            el("label", { text: "Meta description" }),
            descriptionInput,
            el("div", { className: "counter-row" }, [el("span", { className: "field-hint", text: "Aim for 120–160 characters." }), descCount])
          ]),
          el("div", { className: "field" }, [el("label", { text: "Canonical URL" }), canonicalInput]),
          el("div", { className: "field" }, [el("label", { text: "Social image URL" }), ogImageInput]),
          el("div", { className: "field" }, [el("label", { text: "Social title" }), ogTitleInput]),
          el("div", { className: "field" }, [el("label", { text: "Social description" }), ogDescriptionInput])
        ])
      ]);
    }

    var globalCard = el("section", { className: "card seo-card" }, [
      el("div", { className: "card__head" }, [
        el("h2", { text: "Global" }),
        el("span", { className: "muted small", text: "Shared identity and crawler defaults." })
      ]),
      el("div", { className: "form-grid" }, [
        el("div", { className: "field" }, [el("label", { text: "Site name" }), siteNameInput]),
        el("div", { className: "field" }, [el("label", { text: "Author" }), authorInput]),
        el("div", { className: "field" }, [el("label", { text: "Theme color" }), themeColorInput]),
        el("div", { className: "field" }, [el("label", { text: "Robots directive" }), robotsInput])
      ])
    ]);

    var homeCard = pageCard("Home page", "home", "Search and social preview for the main page.");
    var faqCard = pageCard("FAQ page", "faq", "Search and social preview for the FAQ page.");

    saveButton.addEventListener("click", async function () {
      var required = [
        { value: seo.home.title, label: "Home SEO title" },
        { value: seo.home.description, label: "Home meta description" },
        { value: seo.home.canonical, label: "Home canonical URL" },
        { value: seo.faq.title, label: "FAQ SEO title" },
        { value: seo.faq.description, label: "FAQ meta description" },
        { value: seo.faq.canonical, label: "FAQ canonical URL" }
      ];
      var missing = required.filter(function (item) { return !String(item.value || "").trim(); })[0];
      if (missing) {
        setStatus(status, missing.label + " is required.", true);
        return;
      }
      var urls = [seo.home.canonical, seo.faq.canonical];
      if (urls.some(function (url) { return !isHttpsUrl(url); })) {
        setStatus(status, "Canonical URLs must start with https://.", true);
        return;
      }
      var images = [seo.home.og_image, seo.faq.og_image];
      if (images.some(function (url) { return url && !safeHref(url); })) {
        setStatus(status, "Social images must use a /assets path or an https:// URL.", true);
        return;
      }
      saveButton.disabled = true;
      setStatus(status, "Saving SEO settings…", false);
      try {
        await saveSettingValue("seo", seo);
        settingsDirty.seo = false;
        setStatus(status, "SEO settings saved.", false);
        showToast("SEO settings saved.", false);
      } catch (error) {
        if (error.message !== SESSION_MESSAGE) {
          setStatus(status, error.message, true);
          showToast(error.message, true);
        }
      } finally {
        saveButton.disabled = false;
      }
    });

    view.appendChild(globalCard);
    view.appendChild(homeCard);
    view.appendChild(faqCard);
    view.appendChild(el("div", { className: "seo-save" }, [saveButton, status]));
    view.appendChild(el("p", { className: "note", text: "The public site updates only after the publish step is connected." }));
  }

  async function renderSettings(token) {
    view.textContent = "";
    view.appendChild(pageHead("Settings", "Edit the hero, social links, page sections and vision copy."));
    var loading = loadingNode("Loading settings…");
    view.appendChild(loading);

    var rows;
    try {
      rows = await listSettings();
    } catch (error) {
      if (token !== viewToken) return;
      loading.remove();
      if (error.message !== SESSION_MESSAGE) view.appendChild(errorPanel("Could not load settings", error.message));
      return;
    }
    if (token !== viewToken) return;
    loading.remove();

    var settings = mapSettings(rows);
    if (rows.length === 0) view.appendChild(seedMessage());

    function hasKey(key) {
      return Object.prototype.hasOwnProperty.call(settings, key);
    }

    function missingNote(key) {
      if (hasKey(key)) return null;
      return el("p", { className: "missing-note", text: EMPTY_SEED_MESSAGE });
    }

    var hero = settings.hero || {};
    var roles = Array.isArray(hero.roles)
      ? hero.roles
        .filter(function (role) { return typeof role === "string" && role.trim(); })
        .map(function (role) { return role.trim(); })
      : [];

    var heroStatus = el("p", { className: "inline-status", role: "status", "aria-live": "polite", hidden: true });
    var eyebrowInput = el("input", {
      type: "text",
      value: hero.eyebrow || "Portfolio",
      autocomplete: "off",
      "aria-label": "Hero eyebrow label"
    });
    var nameInput = el("input", {
      type: "text",
      value: hero.name || "Neelam Dhiman",
      autocomplete: "off",
      "aria-label": "Hero name"
    });
    var subtitleInput = el("input", {
      type: "text",
      value: hero.subtitle || "",
      autocomplete: "off",
      "aria-label": "Hero subtitle"
    });
    var paragraphInput = el("textarea", { rows: "3", "aria-label": "Hero paragraph" });
    paragraphInput.value = hero.paragraph || "";
    var skillsInput = el("input", {
      type: "text",
      value: hero.skills_line || "",
      autocomplete: "off",
      "aria-label": "Hero skills line"
    });
    var primaryLabelInput = el("input", {
      type: "text",
      value: hero.primary_cta_label || "Hire Me",
      autocomplete: "off",
      "aria-label": "Primary button label"
    });
    var primaryUrlInput = el("input", {
      type: "text",
      value: hero.primary_cta_url || "#contact",
      autocomplete: "off",
      "aria-label": "Primary button link"
    });
    var secondaryLabelInput = el("input", {
      type: "text",
      value: hero.secondary_cta_label || "View Projects",
      autocomplete: "off",
      "aria-label": "Secondary button label"
    });
    var secondaryUrlInput = el("input", {
      type: "text",
      value: hero.secondary_cta_url || "#projects",
      autocomplete: "off",
      "aria-label": "Secondary button link"
    });
    var chipList = el("div", { className: "chip-list" });
    var chipInput = el("input", { type: "text", autocomplete: "off", "aria-label": "New typing role", placeholder: "Add a typing role" });
    var addRoleButton = el("button", { type: "button", className: "btn btn--secondary btn--small", text: "Add" });
    var saveHeroButton = el("button", { type: "button", className: "btn", text: "Save hero" });

    function markHeroDirty() {
      settingsDirty.hero = true;
      setStatus(heroStatus, "", false);
    }

    function drawChips() {
      clearNode(chipList);
      if (roles.length === 0) {
        chipList.appendChild(el("span", { className: "field-hint", text: "No typing roles yet." }));
        return;
      }
      roles.forEach(function (role, index) {
        var remove = el("button", {
          type: "button",
          className: "chip__remove",
          "aria-label": "Remove typing role " + role,
          text: "×"
        });
        remove.addEventListener("click", function () {
          roles.splice(index, 1);
          drawChips();
          markHeroDirty();
        });
        chipList.appendChild(el("span", { className: "chip" }, [
          el("span", { text: role }),
          remove
        ]));
      });
    }

    function addRole() {
      var value = chipInput.value.trim();
      if (!value) return;
      var exists = roles.some(function (role) { return role.toLowerCase() === value.toLowerCase(); });
      if (exists) {
        setStatus(heroStatus, "That typing role is already in the list.", true);
        return;
      }
      roles.push(value);
      chipInput.value = "";
      drawChips();
      markHeroDirty();
    }

    addRoleButton.addEventListener("click", addRole);
    chipInput.addEventListener("keydown", function (event) {
      if (event.key === "Enter") {
        event.preventDefault();
        addRole();
      }
    });
    [eyebrowInput, nameInput, subtitleInput, paragraphInput, skillsInput, primaryLabelInput, primaryUrlInput, secondaryLabelInput, secondaryUrlInput].forEach(function (input) {
      input.addEventListener("input", markHeroDirty);
    });

    saveHeroButton.addEventListener("click", async function () {
      var eyebrow = eyebrowInput.value.trim();
      var name = nameInput.value.trim();
      var subtitle = subtitleInput.value.trim();
      var paragraph = paragraphInput.value.trim();
      var skills = skillsInput.value.trim();
      var primaryLabel = primaryLabelInput.value.trim();
      var primaryUrl = primaryUrlInput.value.trim();
      var secondaryLabel = secondaryLabelInput.value.trim();
      var secondaryUrl = secondaryUrlInput.value.trim();
      if (!name || !subtitle || !paragraph || !skills) {
        setStatus(heroStatus, "Name, subtitle, paragraph and skills line are required.", true);
        (!name ? nameInput : !subtitle ? subtitleInput : !paragraph ? paragraphInput : skillsInput).focus();
        return;
      }
      if (!isCtaUrl(primaryUrl) || !isCtaUrl(secondaryUrl)) {
        setStatus(heroStatus, "Button links must be an https:// URL, a /path or a #section link.", true);
        (!isCtaUrl(primaryUrl) ? primaryUrlInput : secondaryUrlInput).focus();
        return;
      }
      if ((primaryLabel && !primaryUrl) || (!primaryLabel && primaryUrl)) {
        setStatus(heroStatus, "A primary button needs both a label and a link.", true);
        (!primaryLabel ? primaryLabelInput : primaryUrlInput).focus();
        return;
      }
      if ((secondaryLabel && !secondaryUrl) || (!secondaryLabel && secondaryUrl)) {
        setStatus(heroStatus, "A secondary button needs both a label and a link.", true);
        (!secondaryLabel ? secondaryLabelInput : secondaryUrlInput).focus();
        return;
      }
      saveHeroButton.disabled = true;
      setStatus(heroStatus, "Saving hero…", false);
      try {
        await saveSettingValue("hero", {
          eyebrow: eyebrow,
          name: name,
          subtitle: subtitle,
          paragraph: paragraph,
          skills_line: skills,
          roles: roles.slice(),
          primary_cta_label: primaryLabel,
          primary_cta_url: primaryUrl,
          secondary_cta_label: secondaryLabel,
          secondary_cta_url: secondaryUrl
        });
        settingsDirty.hero = false;
        setStatus(heroStatus, "Hero settings saved.", false);
        showToast("Hero settings saved.", false);
      } catch (error) {
        if (error.message !== SESSION_MESSAGE) {
          setStatus(heroStatus, error.message, true);
          showToast(error.message, true);
        }
      } finally {
        saveHeroButton.disabled = false;
      }
    });

    var heroCard = el("section", { className: "card settings-card settings-card--wide" }, [
      el("div", { className: "card__head" }, [el("h2", { text: "Hero section" })]),
      missingNote("hero"),
      el("div", { className: "form-grid" }, [
        el("div", { className: "field" }, [el("label", { text: "Eyebrow label" }), eyebrowInput]),
        el("div", { className: "field" }, [el("label", { text: "Name" }), nameInput]),
        el("div", { className: "field field--wide" }, [el("label", { text: "Subtitle / role line" }), subtitleInput]),
        el("div", { className: "field field--wide" }, [el("label", { text: "Intro paragraph" }), paragraphInput]),
        el("div", { className: "field field--wide" }, [el("label", { text: "Skills line" }), skillsInput]),
        el("div", { className: "field field--wide" }, [
          el("span", { className: "field-label", text: "Typing roles" }),
          chipList,
          el("div", { className: "chip-add-row" }, [chipInput, addRoleButton])
        ]),
        el("div", { className: "field" }, [el("label", { text: "Primary button label" }), primaryLabelInput]),
        el("div", { className: "field" }, [el("label", { text: "Primary button link" }), primaryUrlInput]),
        el("div", { className: "field" }, [el("label", { text: "Secondary button label" }), secondaryLabelInput]),
        el("div", { className: "field" }, [el("label", { text: "Secondary button link" }), secondaryUrlInput])
      ]),
      el("div", { className: "form-actions" }, [saveHeroButton]),
      heroStatus
    ]);

    var social = settings.social || {};
    var socialStatus = el("p", { className: "inline-status", role: "status", "aria-live": "polite", hidden: true });
    var socialLinks = Array.isArray(social.links)
      ? social.links
        .filter(function (link) { return link && typeof link === "object"; })
        .map(function (link) {
          return { name: String(link.name || ""), url: String(link.url || "") };
        })
      : [];
    if (!Array.isArray(social.links)) {
      if (social.github) socialLinks.push({ name: "GitHub", url: social.github });
      if (social.linkedin) socialLinks.push({ name: "LinkedIn", url: social.linkedin });
    }

    var socialList = el("div", { className: "social-list" });
    var addSocialButton = el("button", { type: "button", className: "btn btn--secondary btn--small", text: "Add social link" });
    var saveSocialButton = el("button", { type: "button", className: "btn", text: "Save social links" });

    function markSocialDirty() {
      settingsDirty.social = true;
      setStatus(socialStatus, "", false);
    }

    function drawSocialLinks() {
      clearNode(socialList);
      if (socialLinks.length === 0) {
        socialList.appendChild(el("p", { className: "field-hint", text: "No social links yet. Add a name and an https:// link." }));
        return;
      }
      socialLinks.forEach(function (link, index) {
        var nameInput = el("input", {
          type: "text",
          value: link.name,
          autocomplete: "off",
          placeholder: "GitHub",
          "aria-label": "Social link " + (index + 1) + " name"
        });
        var urlInput = el("input", {
          type: "url",
          value: link.url,
          autocomplete: "off",
          placeholder: "https://...",
          "aria-label": "Social link " + (index + 1) + " URL"
        });
        nameInput.addEventListener("input", function () {
          link.name = nameInput.value;
          markSocialDirty();
        });
        urlInput.addEventListener("input", function () {
          link.url = urlInput.value;
          markSocialDirty();
        });

        var up = iconButton("up", "Move " + (link.name || "social link") + " up");
        var down = iconButton("down", "Move " + (link.name || "social link") + " down");
        up.disabled = index === 0;
        down.disabled = index === socialLinks.length - 1;
        up.addEventListener("click", function () {
          var moved = socialLinks[index];
          socialLinks[index] = socialLinks[index - 1];
          socialLinks[index - 1] = moved;
          markSocialDirty();
          drawSocialLinks();
        });
        down.addEventListener("click", function () {
          var moved = socialLinks[index];
          socialLinks[index] = socialLinks[index + 1];
          socialLinks[index + 1] = moved;
          markSocialDirty();
          drawSocialLinks();
        });

        var remove = iconButton("trash", "Remove " + (link.name || "social link"), "is-danger");
        remove.addEventListener("click", function () {
          socialLinks.splice(index, 1);
          markSocialDirty();
          drawSocialLinks();
        });

        socialList.appendChild(el("div", { className: "social-row" }, [
          el("div", { className: "social-row__order" }, [up, down]),
          nameInput,
          urlInput,
          remove
        ]));
      });
    }

    addSocialButton.addEventListener("click", function () {
      socialLinks.push({ name: "", url: "" });
      markSocialDirty();
      drawSocialLinks();
      var inputs = socialList.querySelectorAll("input");
      if (inputs.length) inputs[inputs.length - 2].focus();
    });

    saveSocialButton.addEventListener("click", async function () {
      var cleaned = [];
      var invalid = null;
      socialLinks.forEach(function (link) {
        var name = String(link.name || "").trim();
        var url = String(link.url || "").trim();
        if (!name && !url) return;
        if (!name || !url) {
          invalid = invalid || (!name ? "Every social link needs a name." : "Every social link needs a URL.");
          return;
        }
        if (!isHttpsUrl(url)) {
          invalid = "Social links must use an https:// URL.";
          return;
        }
        cleaned.push({ name: name, url: url });
      });
      if (invalid) {
        setStatus(socialStatus, invalid, true);
        return;
      }
      var github = cleaned.filter(function (link) { return /github/i.test(link.name); })[0];
      var linkedin = cleaned.filter(function (link) { return /linkedin/i.test(link.name); })[0];
      saveSocialButton.disabled = true;
      setStatus(socialStatus, "Saving social links…", false);
      try {
        await saveSettingValue("social", {
          links: cleaned,
          github: github ? github.url : "",
          linkedin: linkedin ? linkedin.url : ""
        });
        socialLinks = cleaned.map(function (link) { return { name: link.name, url: link.url }; });
        settingsDirty.social = false;
        drawSocialLinks();
        setStatus(socialStatus, "Social links saved.", false);
        showToast("Social links saved.", false);
      } catch (error) {
        if (error.message !== SESSION_MESSAGE) {
          setStatus(socialStatus, error.message, true);
          showToast(error.message, true);
        }
      } finally {
        saveSocialButton.disabled = false;
      }
    });

    var socialCard = el("section", { className: "card settings-card" }, [
      el("div", { className: "card__head" }, [el("h2", { text: "Social links" })]),
      missingNote("social"),
      el("p", { className: "field-hint", text: "Add any platform: name it, paste the https:// link, and reorder as needed." }),
      socialList,
      el("div", { className: "form-actions" }, [addSocialButton, saveSocialButton]),
      socialStatus
    ]);

    var vision = settings.vision || {};
    var visionStatus = el("p", { className: "inline-status", role: "status", "aria-live": "polite", hidden: true });
    var visionInput = el("textarea", { rows: "5", "aria-label": "Vision paragraph" });
    visionInput.value = vision.paragraph || "";
    var saveVisionButton = el("button", { type: "button", className: "btn", text: "Save vision" });

    visionInput.addEventListener("input", function () {
      settingsDirty.vision = true;
      setStatus(visionStatus, "", false);
    });

    saveVisionButton.addEventListener("click", async function () {
      var paragraph = visionInput.value.trim();
      if (!paragraph) {
        setStatus(visionStatus, "Vision paragraph is required.", true);
        visionInput.focus();
        return;
      }
      saveVisionButton.disabled = true;
      setStatus(visionStatus, "Saving vision…", false);
      try {
        await saveSettingValue("vision", { paragraph: paragraph });
        settingsDirty.vision = false;
        setStatus(visionStatus, "Vision saved.", false);
        showToast("Vision saved.", false);
      } catch (error) {
        if (error.message !== SESSION_MESSAGE) {
          setStatus(visionStatus, error.message, true);
          showToast(error.message, true);
        }
      } finally {
        saveVisionButton.disabled = false;
      }
    });

    var visionCard = el("section", { className: "card settings-card settings-card--wide" }, [
      el("div", { className: "card__head" }, [el("h2", { text: "Vision" })]),
      missingNote("vision"),
      el("div", { className: "field" }, [el("label", { text: "Paragraph" }), visionInput]),
      el("div", { className: "form-actions" }, [saveVisionButton]),
      visionStatus
    ]);

    var sections = Array.isArray(settings.sections)
      ? settings.sections
        .filter(function (section) { return section && typeof section === "object"; })
        .map(function (section, index) {
          return {
            id: String(section.id || makeUuid()),
            title: String(section.title || ""),
            subtitle: String(section.subtitle || ""),
            body: String(section.body || ""),
            layout: ["text", "image-left", "image-right", "cta"].indexOf(section.layout) !== -1 ? section.layout : "text",
            image_url: String(section.image_url || ""),
            image_alt: String(section.image_alt || ""),
            link_label: String(section.link_label || ""),
            link_url: String(section.link_url || ""),
            visible: section.visible !== false,
            sort_order: Number(section.sort_order) || (index + 1) * 10
          };
        })
      : [];
    var sectionsStatus = el("p", { className: "inline-status", role: "status", "aria-live": "polite", hidden: true });
    var sectionsList = el("div", { className: "section-list" });
    var addSectionButton = el("button", { type: "button", className: "btn btn--secondary btn--small", text: "Add section" });
    var saveSectionsButton = el("button", { type: "button", className: "btn", text: "Save sections" });

    function markSectionsDirty() {
      settingsDirty.sections = true;
      setStatus(sectionsStatus, "", false);
    }

    function drawSections() {
      clearNode(sectionsList);
      if (sections.length === 0) {
        sectionsList.appendChild(el("p", { className: "field-hint", text: "No custom sections yet. Add one to build a new part of the page." }));
        return;
      }
      sections.forEach(function (section, index) {
        var summaryTitle = section.title.trim() || "Untitled section";
        var details = el("details", { className: "section-editor" });
        var summary = el("summary", null, [
          el("span", { className: "section-editor__title", text: summaryTitle }),
          el("span", { className: "section-editor__meta", text: section.layout.replace("-", " ") + (section.visible ? "" : " · hidden") })
        ]);
        details.appendChild(summary);

        var titleInput = el("input", { type: "text", value: section.title, autocomplete: "off", "aria-label": "Section title" });
        var subtitleInput = el("input", { type: "text", value: section.subtitle, autocomplete: "off", "aria-label": "Section subtitle" });
        var bodyInput = el("textarea", { rows: "4", "aria-label": "Section body" });
        bodyInput.value = section.body;
        var layoutSelect = el("select", { "aria-label": "Section layout" }, [
          el("option", { value: "text", text: "Text only" }),
          el("option", { value: "image-left", text: "Image left, text right" }),
          el("option", { value: "image-right", text: "Text left, image right" }),
          el("option", { value: "cta", text: "Call to action" })
        ]);
        layoutSelect.value = section.layout;
        var imageInput = el("input", { type: "text", value: section.image_url, autocomplete: "off", placeholder: "/assets/... or https://...", "aria-label": "Section image URL" });
        var imageAltInput = el("input", { type: "text", value: section.image_alt, autocomplete: "off", "aria-label": "Section image alt text" });
        var linkLabelInput = el("input", { type: "text", value: section.link_label, autocomplete: "off", "aria-label": "Section button label" });
        var linkUrlInput = el("input", { type: "text", value: section.link_url, autocomplete: "off", placeholder: "#contact or https://...", "aria-label": "Section button link" });
        var visibleInput = el("input", { type: "checkbox" });
        visibleInput.checked = section.visible;
        var visibleRow = el("div", { className: "checkbox-row" }, [
          visibleInput,
          el("label", { text: "Show this section on the site" })
        ]);

        titleInput.addEventListener("input", function () {
          section.title = titleInput.value;
          summary.querySelector(".section-editor__title").textContent = titleInput.value.trim() || "Untitled section";
          markSectionsDirty();
        });
        subtitleInput.addEventListener("input", function () { section.subtitle = subtitleInput.value; markSectionsDirty(); });
        bodyInput.addEventListener("input", function () { section.body = bodyInput.value; markSectionsDirty(); });
        layoutSelect.addEventListener("change", function () {
          section.layout = layoutSelect.value;
          summary.querySelector(".section-editor__meta").textContent = section.layout.replace("-", " ") + (section.visible ? "" : " · hidden");
          markSectionsDirty();
        });
        imageInput.addEventListener("input", function () { section.image_url = imageInput.value; markSectionsDirty(); });
        imageAltInput.addEventListener("input", function () { section.image_alt = imageAltInput.value; markSectionsDirty(); });
        linkLabelInput.addEventListener("input", function () { section.link_label = linkLabelInput.value; markSectionsDirty(); });
        linkUrlInput.addEventListener("input", function () { section.link_url = linkUrlInput.value; markSectionsDirty(); });
        visibleInput.addEventListener("change", function () {
          section.visible = visibleInput.checked;
          summary.querySelector(".section-editor__meta").textContent = section.layout.replace("-", " ") + (section.visible ? "" : " · hidden");
          markSectionsDirty();
        });

        var up = iconButton("up", "Move " + summaryTitle + " up");
        var down = iconButton("down", "Move " + summaryTitle + " down");
        up.disabled = index === 0;
        down.disabled = index === sections.length - 1;
        up.addEventListener("click", function () {
          var moved = sections[index];
          sections[index] = sections[index - 1];
          sections[index - 1] = moved;
          markSectionsDirty();
          drawSections();
        });
        down.addEventListener("click", function () {
          var moved = sections[index];
          sections[index] = sections[index + 1];
          sections[index + 1] = moved;
          markSectionsDirty();
          drawSections();
        });
        var remove = iconButton("trash", "Delete " + summaryTitle, "is-danger");
        remove.addEventListener("click", function () {
          if (!window.confirm('Delete the "' + summaryTitle + '" section? This cannot be undone after saving.')) return;
          sections.splice(index, 1);
          markSectionsDirty();
          drawSections();
        });

        details.appendChild(el("div", { className: "section-editor__body" }, [
          el("div", { className: "form-grid" }, [
            el("div", { className: "field" }, [el("label", { text: "Title" }), titleInput]),
            el("div", { className: "field" }, [el("label", { text: "Subtitle" }), subtitleInput]),
            el("div", { className: "field field--wide" }, [el("label", { text: "Body" }), bodyInput]),
            el("div", { className: "field" }, [el("label", { text: "Layout" }), layoutSelect]),
            el("div", { className: "field" }, [el("label", { text: "Image URL (optional)" }), imageInput]),
            el("div", { className: "field" }, [el("label", { text: "Image alt text" }), imageAltInput]),
            el("div", { className: "field" }, [el("label", { text: "Button label" }), linkLabelInput]),
            el("div", { className: "field" }, [el("label", { text: "Button link" }), linkUrlInput])
          ]),
          visibleRow,
          el("div", { className: "section-editor__actions" }, [up, down, remove])
        ]));
        sectionsList.appendChild(details);
      });
    }

    addSectionButton.addEventListener("click", function () {
      var section = {
        id: makeUuid(),
        title: "",
        subtitle: "",
        body: "",
        layout: "text",
        image_url: "",
        image_alt: "",
        link_label: "",
        link_url: "",
        visible: true,
        sort_order: (sections.length + 1) * 10
      };
      sections.push(section);
      markSectionsDirty();
      drawSections();
      var editors = sectionsList.querySelectorAll(".section-editor");
      if (editors.length) {
        var last = editors[editors.length - 1];
        last.open = true;
        var input = last.querySelector("input");
        if (input) input.focus();
      }
    });

    saveSectionsButton.addEventListener("click", async function () {
      var cleaned = [];
      var invalid = "";
      sections.forEach(function (section) {
        var title = String(section.title || "").trim();
        if (!title) {
          invalid = invalid || "Every section needs a title.";
          return;
        }
        if (section.image_url && !safeHref(section.image_url)) {
          invalid = invalid || "Section images must use a /assets path or an https:// URL.";
          return;
        }
        if (section.image_url && !String(section.image_alt || "").trim()) {
          invalid = invalid || "Every section image needs alt text.";
          return;
        }
        if (!isCtaUrl(section.link_url)) {
          invalid = invalid || "Section button links must be an https:// URL, a /path or a #section link.";
          return;
        }
        if ((section.link_label && !section.link_url) || (!section.link_label && section.link_url)) {
          invalid = invalid || "A section button needs both a label and a link.";
          return;
        }
        cleaned.push({
          id: section.id,
          title: title,
          subtitle: String(section.subtitle || "").trim(),
          body: String(section.body || "").trim(),
          layout: section.layout,
          image_url: String(section.image_url || "").trim(),
          image_alt: String(section.image_alt || "").trim(),
          link_label: String(section.link_label || "").trim(),
          link_url: String(section.link_url || "").trim(),
          visible: section.visible !== false,
          sort_order: (cleaned.length + 1) * 10
        });
      });
      if (invalid) {
        setStatus(sectionsStatus, invalid, true);
        return;
      }
      saveSectionsButton.disabled = true;
      setStatus(sectionsStatus, "Saving sections…", false);
      try {
        await saveSettingValue("sections", cleaned);
        sections = cleaned.map(function (section) { return Object.assign({}, section); });
        settingsDirty.sections = false;
        drawSections();
        setStatus(sectionsStatus, "Sections saved.", false);
        showToast("Sections saved.", false);
      } catch (error) {
        if (error.message !== SESSION_MESSAGE) {
          setStatus(sectionsStatus, error.message, true);
          showToast(error.message, true);
        }
      } finally {
        saveSectionsButton.disabled = false;
      }
    });

    var sectionsCard = el("section", { className: "card settings-card settings-card--wide" }, [
      el("div", { className: "card__head" }, [
        el("h2", { text: "Page sections" }),
        el("div", { className: "card__actions" }, [addSectionButton])
      ]),
      missingNote("sections"),
      el("p", { className: "field-hint", text: "Add new sections below the hero, or edit the ones you already have." }),
      sectionsList,
      el("div", { className: "form-actions" }, [saveSectionsButton]),
      sectionsStatus
    ]);

    var passwordCurrentInput = el("input", { type: "password", autocomplete: "current-password", "aria-label": "Current password" });
    var passwordNewInput = el("input", { type: "password", autocomplete: "new-password", "aria-label": "New password" });
    var passwordConfirmInput = el("input", { type: "password", autocomplete: "new-password", "aria-label": "Confirm new password" });
    var passwordStatus = el("p", { className: "inline-status", role: "status", "aria-live": "polite", hidden: true });
    var savePasswordButton = el("button", { type: "button", className: "btn btn--primary", text: "Save" });
    savePasswordButton.addEventListener("click", async function () {
      var current = passwordCurrentInput.value;
      var newPassword = passwordNewInput.value;
      var confirm = passwordConfirmInput.value;
      if (!current || !newPassword || !confirm) { showToast("All fields are required", true); return; }
      if (newPassword.length < 8) { showToast("New password must be at least 8 characters", true); return; }
      if (newPassword !== confirm) { showToast("New passwords do not match", true); return; }
      if (newPassword === current) { showToast("New password must differ from current", true); return; }
      savePasswordButton.disabled = true;
      try {
        var email = currentSession && currentSession.user ? currentSession.user.email : "";
        var verify = await client.auth.signInWithPassword({ email: email, password: current });
        if (verify.error) { showToast("Current password is wrong", true); return; }
        var upd = await client.auth.updateUser({ password: newPassword });
        if (upd.error) { showToast(upd.error.message || "Could not change password", true); return; }
        showToast("Password changed", false);
        passwordCurrentInput.value = "";
        passwordNewInput.value = "";
        passwordConfirmInput.value = "";
      } catch (e) {
        showToast((e && e.message) ? e.message : "Could not change password", true);
      } finally {
        savePasswordButton.disabled = false;
      }
    });
    var passwordCard = el("section", { className: "card settings-card" }, [
      el("div", { className: "card__head" }, [el("h2", { text: "Change Password" })]),
      el("div", { className: "field" }, [el("label", { text: "Current password" }), passwordCurrentInput]),
      el("div", { className: "field" }, [el("label", { text: "New password" }), passwordNewInput]),
      el("div", { className: "field" }, [el("label", { text: "Confirm new password" }), passwordConfirmInput]),
      el("div", { className: "form-actions" }, [savePasswordButton]),
      passwordStatus
    ]);

    view.appendChild(el("div", { className: "settings-grid" }, [heroCard, socialCard, visionCard, sectionsCard, passwordCard]));
    drawChips();
    drawSocialLinks();
    drawSections();
  }
})();
