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
  var menuToggle = document.getElementById("menu-toggle");
  var sidebarOverlay = document.getElementById("sidebar-overlay");
  var toastEl = document.getElementById("toast");
  var navItems = Array.prototype.slice.call(document.querySelectorAll(".nav-item[data-nav]"));

  var client = null;
  var currentSession = null;
  var currentHash = "";
  var currentRouteName = "dashboard";
  var viewToken = 0;
  var editorState = null;
  var settingsDirty = { hero: false, social: false, vision: false };
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

  async function runQuery(query, fallback) {
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
    settingsDirty = { hero: false, social: false, vision: false };
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
    settings: "Settings"
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
    if (parts.length === 1 && ["images", "skills", "settings"].indexOf(parts[0]) !== -1) {
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
    if (route.name === "dashboard") renderDashboard(token);
    else if (route.name === "projects") renderProjects(token);
    else if (route.name === "editor") renderProjectEditor(route, token);
    else if (route.name === "images") renderImages(token);
    else if (route.name === "skills") renderSkills(token);
    else if (route.name === "settings") renderSettings(token);
    else renderDashboard(token);
  }

  function hasUnsavedChanges() {
    return !!(
      (editorState && editorState.dirty) ||
      settingsDirty.hero ||
      settingsDirty.social ||
      settingsDirty.vision ||
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
      var visible = projects.filter(function (project) { return project.is_visible !== false; }).length;
      var projectDate = latestDate(projects, ["updated_at", "created_at"]);
      var settingsDate = latestDate(settingsRows, ["updated_at"]);
      var allEmpty = projects.length === 0 && tools.length === 0 && stats.length === 0 && settingsRows.length === 0;

      loading.remove();
      if (allEmpty) view.appendChild(seedMessage());

      view.appendChild(el("div", { className: "stats" }, [
        statCard(projects.length, "Projects"),
        statCard(visible, "Visible projects"),
        statCard(tools.length, "Tools"),
        statCard(stats.length, "Stats")
      ]));

      var updatedCard = el("section", { className: "card", "aria-labelledby": "h-updated" }, [
        el("div", { className: "card__head" }, [el("h2", { id: "h-updated", text: "Last updated" })]),
        el("ul", { className: "meta-list" }, [
          el("li", null, [el("strong", { text: "Projects" }), el("span", { className: "muted", text: formatDate(projectDate) })]),
          el("li", null, [el("strong", { text: "Tools" }), el("span", { className: "muted", text: "Not tracked" })]),
          el("li", null, [el("strong", { text: "Stats" }), el("span", { className: "muted", text: "Not tracked" })]),
          el("li", null, [el("strong", { text: "Settings" }), el("span", { className: "muted", text: formatDate(settingsDate) })])
        ])
      ]);

      var quickCard = el("section", { className: "card", "aria-labelledby": "h-quick" }, [
        el("div", { className: "card__head" }, [el("h2", { id: "h-quick", text: "Quick actions" })]),
        el("div", { className: "quick" }, [
          actionLink("#/projects/new", "Add project", "plus"),
          el("a", { className: "btn btn--secondary btn--block", href: "#/projects", text: "Manage projects" }),
          el("a", { className: "btn btn--ghost btn--block", href: "#/settings", text: "Edit site settings" })
        ])
      ]);

      view.appendChild(el("div", { className: "dash-grid" }, [updatedCard, quickCard]));
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

  async function renderSettings(token) {
    view.textContent = "";
    view.appendChild(pageHead("Settings", "Edit the hero, social links and vision copy."));
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
    [subtitleInput, paragraphInput, skillsInput].forEach(function (input) {
      input.addEventListener("input", markHeroDirty);
    });

    saveHeroButton.addEventListener("click", async function () {
      var subtitle = subtitleInput.value.trim();
      var paragraph = paragraphInput.value.trim();
      var skills = skillsInput.value.trim();
      if (!subtitle || !paragraph || !skills) {
        setStatus(heroStatus, "Subtitle, paragraph and skills line are required.", true);
        (!subtitle ? subtitleInput : !paragraph ? paragraphInput : skillsInput).focus();
        return;
      }
      saveHeroButton.disabled = true;
      setStatus(heroStatus, "Saving hero…", false);
      try {
        await saveSettingValue("hero", {
          subtitle: subtitle,
          paragraph: paragraph,
          skills_line: skills,
          roles: roles.slice()
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
      el("div", { className: "card__head" }, [el("h2", { text: "Hero" })]),
      missingNote("hero"),
      el("div", { className: "field" }, [el("label", { text: "Subtitle" }), subtitleInput]),
      el("div", { className: "field" }, [el("label", { text: "Paragraph" }), paragraphInput]),
      el("div", { className: "field" }, [el("label", { text: "Skills line" }), skillsInput]),
      el("div", { className: "field" }, [
        el("span", { className: "field-label", text: "Typing roles" }),
        chipList,
        el("div", { className: "chip-add-row" }, [chipInput, addRoleButton])
      ]),
      el("div", { className: "form-actions" }, [saveHeroButton]),
      heroStatus
    ]);

    var social = settings.social || {};
    var socialStatus = el("p", { className: "inline-status", role: "status", "aria-live": "polite", hidden: true });
    var githubInput = el("input", {
      type: "url",
      value: social.github || "",
      autocomplete: "off",
      placeholder: "https://github.com/...",
      "aria-label": "GitHub URL"
    });
    var linkedinInput = el("input", {
      type: "url",
      value: social.linkedin || "",
      autocomplete: "off",
      placeholder: "https://www.linkedin.com/in/...",
      "aria-label": "LinkedIn URL"
    });
    var saveSocialButton = el("button", { type: "button", className: "btn", text: "Save social links" });

    function markSocialDirty() {
      settingsDirty.social = true;
      setStatus(socialStatus, "", false);
    }

    githubInput.addEventListener("input", markSocialDirty);
    linkedinInput.addEventListener("input", markSocialDirty);

    saveSocialButton.addEventListener("click", async function () {
      var github = githubInput.value.trim();
      var linkedin = linkedinInput.value.trim();
      if (!isHttpsUrl(github) || !isHttpsUrl(linkedin)) {
        setStatus(socialStatus, "Use an https:// URL or leave the field empty.", true);
        (!isHttpsUrl(github) ? githubInput : linkedinInput).focus();
        return;
      }
      saveSocialButton.disabled = true;
      setStatus(socialStatus, "Saving social links…", false);
      try {
        await saveSettingValue("social", { github: github, linkedin: linkedin });
        settingsDirty.social = false;
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
      el("div", { className: "field" }, [el("label", { text: "GitHub" }), githubInput]),
      el("div", { className: "field" }, [el("label", { text: "LinkedIn" }), linkedinInput]),
      el("div", { className: "form-actions" }, [saveSocialButton]),
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

    view.appendChild(el("div", { className: "settings-grid" }, [heroCard, socialCard, visionCard]));
    drawChips();
  }
})();
