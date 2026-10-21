/*
  ADMIN AUTH — login, session check, logout.

  SECURITY NOTE
  Hiding this dashboard is NOT security. The publishable key is shipped to
  the browser, so anyone can extract it. Every table and storage bucket the
  admin area ever touches must be protected by Supabase Row Level Security
  policies that check the authenticated user (auth.uid()) and their role.
  Without RLS this screen only hides the interface, not the data.
*/
(function () {
  "use strict";

  var GENERIC_ERROR = "Invalid email or password";

  var loginPanel = document.getElementById("login-panel");
  var loginForm = document.getElementById("login-form");
  var emailInput = document.getElementById("login-email");
  var passwordInput = document.getElementById("login-password");
  var submitButton = document.getElementById("login-submit");
  var errorEl = document.getElementById("login-error");
  var loginHeading = document.getElementById("login-heading");

  var dashboardPanel = document.getElementById("dashboard-panel");
  var dashboardHeading = document.getElementById("dashboard-heading");
  var dashboardEmail = document.getElementById("dashboard-email");
  var logoutButton = document.getElementById("logout");
  var dashboardStatus = document.getElementById("dashboard-status");

  var client = null;

  function readConfig(name) {
    if (name === "url") {
      return typeof SUPABASE_URL === "string" ? SUPABASE_URL : "";
    }
    return typeof SUPABASE_PUBLISHABLE_KEY === "string" ? SUPABASE_PUBLISHABLE_KEY : "";
  }

  var supabaseUrl = readConfig("url");
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
      // A bad URL/key must never throw into the page; the form stays usable
      // and every failed attempt shows the same generic message.
      client = null;
    }
  }

  function clearError() {
    errorEl.textContent = "";
    errorEl.hidden = true;
  }

  function showError() {
    errorEl.textContent = GENERIC_ERROR;
    errorEl.hidden = false;
  }

  function showLogin(moveFocus) {
    dashboardPanel.hidden = true;
    loginPanel.hidden = false;
    dashboardEmail.textContent = "";
    clearError();
    document.title = "Admin | Neelam Dhiman";
    if (moveFocus) {
      loginHeading.focus();
    }
  }

  function showDashboard(email, moveFocus) {
    loginPanel.hidden = true;
    dashboardPanel.hidden = false;
    dashboardEmail.textContent = email || "your account";
    clearError();
    document.title = "Dashboard | Neelam Dhiman Admin";
    if (moveFocus) {
      dashboardHeading.focus();
    }
  }

  // Start with both views hidden; listeners are attached below before the
  // session check decides what to show. With the placeholder config there is
  // no client, so the login form shows immediately and every submit returns
  // the generic message.
  loginForm.addEventListener("submit", function (event) {
    event.preventDefault();
    clearError();

    if (!client) {
      showError();
      return;
    }

    var email = emailInput.value.trim();
    var password = passwordInput.value;

    if (email === "" || password === "") {
      showError();
      return;
    }

    submitButton.disabled = true;
    submitButton.setAttribute("aria-busy", "true");

    client.auth
      .signInWithPassword({ email: email, password: password })
      .then(function (result) {
        if (!result || result.error || !result.data || !result.data.session) {
          showError();
          return;
        }
        showDashboard(result.data.session.user.email, true);
      })
      .catch(function () {
        showError();
      })
      .then(function () {
        submitButton.disabled = false;
        submitButton.removeAttribute("aria-busy");
      });
  });

  // Editing the form clears a stale error so it is not re-announced.
  [emailInput, passwordInput].forEach(function (input) {
    input.addEventListener("input", clearError);
  });

  logoutButton.addEventListener("click", function () {
    if (!client) {
      showLogin(true);
      return;
    }

    logoutButton.disabled = true;
    dashboardStatus.hidden = false;
    dashboardStatus.textContent = "Signing out…";

    client.auth
      .signOut()
      .catch(function () {
        // Network failure during the global revoke: still clear the session
        // stored in this browser so the dashboard cannot be reopened by a
        // reload.
        return client.auth.signOut({ scope: "local" }).catch(function () {});
      })
      .then(function () {
        logoutButton.disabled = false;
        dashboardStatus.hidden = true;
        dashboardStatus.textContent = "";
        showLogin(true);
      });
  });

  // Session check: show the dashboard only for a real session, otherwise the
  // login form. onAuthStateChange keeps both views in sync afterwards.
  if (!client) {
    showLogin(false);
    return;
  }

  client.auth
    .getSession()
    .then(function (result) {
      var session = result && result.data ? result.data.session : null;
      if (session && session.user) {
        showDashboard(session.user.email, false);
      } else {
        showLogin(false);
      }
    })
    .catch(function () {
      showLogin(false);
    });

  client.auth.onAuthStateChange(function (event, session) {
    if (event === "SIGNED_IN" && session && session.user) {
      showDashboard(session.user.email, true);
    } else if (event === "SIGNED_OUT") {
      showLogin(true);
    }
  });
})();
