(() => {
  // Prevent duplicate shell initialization if this script is evaluated more than once.
  if (window.__GERAK_SAI_SHELL_INITIALIZED__) return;
  window.__GERAK_SAI_SHELL_INITIALIZED__ = true;

  if (typeof supabase === "undefined") return;
  if (typeof SUPABASE_URL === "undefined" ||
      typeof SUPABASE_PUBLISHABLE_KEY === "undefined") return;

  const header = document.querySelector(
    "header .header-inner, header .topbar-inner, header .head"
  );

  if (!header) return;

  const navDb = supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
  );

  const PAGE_CONTEXT = {
    "index.html": "Amanat Muskom 2026 · KPI Tracker",
    "volunteer.html": "Volunteer Marketplace",
    "my-metrics.html": "Metric Workspace",
    "admin.html": "KPI Admin",
    "volunteer-admin.html": "Volunteer Admin"
  };

  const currentPage =
    (location.pathname.split("/").pop() || "index.html").toLowerCase();

  let renderGeneration = 0;

  function installShellStyles() {
    if (document.querySelector("link[data-sai-shell]")) return;

    const style = document.createElement("link");
    style.rel = "stylesheet";
    style.href = "sai-shell.css?v=20260907-2";
    style.dataset.saiShell = "1";
    document.head.append(style);
  }

  function installPageExtensions() {
    if (currentPage !== "admin.html") return;
    if (document.querySelector("script[data-owner-governance]")) return;

    const script = document.createElement("script");
    script.src = "owner-governance.js?v=20260908-1";
    script.async = false;
    script.dataset.ownerGovernance = "1";
    document.head.append(script);
  }

  function pageContext() {
    return PAGE_CONTEXT[currentPage] || "KPI Tracker";
  }

  function installBrand() {
    // If another evaluation already replaced the legacy brand, do nothing.
    if (header.querySelector(":scope > .sai-shell-brand")) return;

    const existing = header.querySelector(".sai-brand-block");
    if (!existing) return;

    const brand = document.createElement("a");
    brand.className = "sai-shell-brand";
    brand.href = "index.html";
    brand.setAttribute("aria-label", "Gerak SAI - Public Dashboard");

    const mark = document.createElement("span");
    mark.className = "sai-shell-mark";

    const logo = document.createElement("img");
    // Blob changed in the repository; version is tied to the current image blob
    // so GitHub Pages/browser cache cannot keep serving the previous artwork.
    logo.src = "sai-logo-web.png?v=1142d263";
    logo.alt = "";
    logo.setAttribute("aria-hidden", "true");
    mark.append(logo);

    const words = document.createElement("span");
    words.className = "sai-shell-brand-copy";

    const title = document.createElement("strong");
    title.textContent = "Gerak SAI";

    const context = document.createElement("small");
    context.textContent = pageContext();

    words.append(title, context);
    brand.append(mark, words);
    existing.replaceWith(brand);
  }

  function hideLegacyHeaderUi() {
    for (const node of header.querySelectorAll(
      ".header-actions, .topbar-actions, .head-actions"
    )) {
      node.classList.add("sai-shell-legacy-header");
    }
  }

  function removeShellUi() {
    for (const node of header.querySelectorAll(
      ":scope > .sai-shell-tools, :scope > .sai-shell-nav"
    )) {
      node.remove();
    }
  }

  function retireEditorUi() {
    if (currentPage === "admin.html") {
      const roleSelect = document.getElementById("new-user-role");
      if (roleSelect) {
        roleSelect.innerHTML = '<option value="admin">Admin</option>';
        roleSelect.value = "admin";
      }

      const addUserForm = document.getElementById("add-user-form");
      if (addUserForm && roleSelect) {
        addUserForm.addEventListener("submit", () => {
          roleSelect.value = "admin";
        }, true);
      }

      const accessDenied = document.getElementById("access-denied");
      const accessCopy = accessDenied?.querySelector(
        "p:not(.eyebrow):not(.muted)"
      );
      if (accessCopy) {
        accessCopy.textContent =
          "Akses KPI Admin diberikan kepada Admin atau Cluster Lead yang aktif sebagai scoped Reviewer.";
      }

      const updateGuidance = document.querySelector(".admin-role-guidance");
      if (updateGuidance) {
        updateGuidance.textContent =
          "Admin dapat membuat draft sebagai global override. Metric Owner menggunakan My Metrics; Cluster Lead menetapkan Metric Owner dan melakukan review dalam cluster scope.";
      }

      const userFormCopy = document.querySelector(".user-form-card .muted");
      if (userFormCopy) {
        userFormCopy.textContent =
          "User Management hanya untuk Admin. Cluster Lead dikelola melalui Cluster Governance, sedangkan Metric Owner ditetapkan oleh Admin atau Cluster Lead sesuai scope cluster.";
      }

      const userList = document.getElementById("user-list");
      if (userList) {
        const sanitizeRoleSelectors = () => {
          for (const select of userList.querySelectorAll("select.user-role-select")) {
            for (const option of [...select.options]) {
              if (option.value !== "admin") option.remove();
            }
            select.value = "admin";
            select.disabled = true;
          }
        };

        sanitizeRoleSelectors();
        new MutationObserver(sanitizeRoleSelectors).observe(userList, {
          childList: true,
          subtree: true
        });
      }
    }

    if (currentPage === "volunteer-admin.html") {
      const loginCopy = document.querySelector("#login-panel .muted");
      if (loginCopy) {
        loginCopy.innerHTML =
          'Volunteer operations hanya tersedia untuk Admin. Gunakan menu <strong>Log-in</strong> di kanan atas.';
      }
    }
  }

  function isPageActive(href) {
    return currentPage === href ||
      (currentPage === "" && href === "index.html");
  }

  function navLink(label, href) {
    const link = document.createElement("a");
    link.className = "sai-shell-nav-link";
    link.href = href;
    link.textContent = label;

    if (isPageActive(href)) {
      link.setAttribute("aria-current", "page");
    }

    return link;
  }

  async function effectiveRole() {
    try {
      const { data, error } = await navDb.rpc("current_admin_role");
      if (error) return null;
      return data || null;
    } catch (_) {
      return null;
    }
  }

  async function metricsAccess() {
    try {
      const { data, error } = await navDb.rpc("get_my_metrics_access");

      if (error || !Array.isArray(data) || !data.length) {
        return { can_access: false };
      }

      return data[0];
    } catch (_) {
      return { can_access: false };
    }
  }

  function authError(account, message) {
    const status = account.querySelector(".sai-shell-auth-status");
    if (!status) return;

    status.textContent = message || "";
    status.hidden = !message;
  }

  async function signIn(button, account) {
    button.disabled = true;
    authError(account, "");

    const { error } = await navDb.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: location.href.split("#")[0]
      }
    });

    if (error) {
      button.disabled = false;
      authError(account, error.message || "Login belum dapat dimulai.");
    }
  }

  async function signOut(button, account) {
    button.disabled = true;
    authError(account, "");

    const { error } = await navDb.auth.signOut({ scope: "local" });

    if (error) {
      button.disabled = false;
      authError(account, error.message || "Belum dapat keluar. Coba lagi.");
      return;
    }

    location.replace("index.html");
  }

  function buildAccount(session) {
    const tools = document.createElement("div");
    tools.className = "sai-shell-tools";

    const account = document.createElement("div");
    account.className = "sai-shell-account";

    if (session?.user) {
      const email = session.user.email || "Akun Google";

      const desktop = document.createElement("div");
      desktop.className = "sai-shell-account-copy";

      const identity = document.createElement("strong");
      identity.textContent = `Halo, ${email}`;

      const logout = document.createElement("button");
      logout.type = "button";
      logout.className = "sai-shell-account-logout";
      logout.textContent = "Keluar";
      logout.addEventListener("click", () => signOut(logout, account));

      desktop.append(identity, logout);

      const mobile = document.createElement("div");
      mobile.className = "sai-shell-account-mobile";

      const mobileEmail = document.createElement("span");
      mobileEmail.textContent = email;

      const separator = document.createElement("span");
      separator.textContent = "|";

      const mobileLogout = document.createElement("button");
      mobileLogout.type = "button";
      mobileLogout.textContent = "Keluar";
      mobileLogout.addEventListener("click", () => signOut(mobileLogout, account));

      mobile.append(mobileEmail, separator, mobileLogout);
      account.append(desktop, mobile);
    } else {
      const login = document.createElement("button");
      login.type = "button";
      login.className = "sai-shell-login";
      login.textContent = "Masuk dengan Google";
      login.addEventListener("click", () => signIn(login, account));
      account.append(login);
    }

    const status = document.createElement("span");
    status.className = "sai-shell-auth-status";
    status.setAttribute("role", "status");
    status.hidden = true;
    account.append(status);

    tools.append(account);
    return tools;
  }

  function buildNavigation(session, role, access) {
    const nav = document.createElement("nav");
    nav.className = "sai-shell-nav";
    nav.setAttribute("aria-label", "Navigasi Gerak SAI");

    nav.append(navLink("Public Dashboard", "index.html"));
    nav.append(navLink("Volunteer Home", "volunteer.html"));

    if (!session?.user) return nav;

    if (access?.can_access) {
      nav.append(navLink("My Metrics", "my-metrics.html"));
    }

    if (["admin", "reviewer"].includes(role)) {
      nav.append(navLink("KPI Admin", "admin.html"));
    }

    if (role === "admin") {
      nav.append(navLink("Volunteer Admin", "volunteer-admin.html"));
    }

    return nav;
  }

  async function render(session) {
    const generation = ++renderGeneration;

    // Clear immediately so a genuine auth-state transition never leaves stale UI.
    removeShellUi();

    let role = null;
    let access = { can_access: false };

    if (session?.user) {
      [role, access] = await Promise.all([
        effectiveRole(),
        metricsAccess()
      ]);
    }

    // Supabase can emit several auth events close together. Only the newest
    // render is allowed to commit UI after its async role/access lookups finish.
    if (generation !== renderGeneration) return;

    // Clean once more immediately before commit. This also makes rendering
    // idempotent if another script/event touched the shell in the meantime.
    removeShellUi();

    header.append(
      buildAccount(session),
      buildNavigation(session, role, access)
    );
  }

  installShellStyles();
  installBrand();
  hideLegacyHeaderUi();
  retireEditorUi();
  installPageExtensions();

  navDb.auth.onAuthStateChange((_event, session) => {
    render(session);
  });

  navDb.auth.getSession()
    .then(({ data }) => render(data.session))
    .catch(() => render(null));
})();