(() => {
  const root = document.querySelector("[data-sai-global-nav]");
  if (!root || typeof supabase === "undefined") return;
  if (typeof SUPABASE_URL === "undefined" ||
      typeof SUPABASE_PUBLISHABLE_KEY === "undefined") return;

  const navDb = supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
  );

  const currentPage = () => {
    const name = (location.pathname.split("/").pop() || "index.html").toLowerCase();
    return name || "index.html";
  };

  const esc = value => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  const activeClass = pages =>
    pages.includes(currentPage()) ? " is-current" : "";

  async function effectiveRole() {
    try {
      const { data, error } = await navDb.rpc("current_admin_role");
      if (error) return null;
      return data || null;
    } catch (_) {
      return null;
    }
  }

  async function displayIdentity(user) {
    let name =
      user?.user_metadata?.full_name ||
      user?.user_metadata?.name ||
      "";

    try {
      const { data } = await navDb
        .from("volunteer_profiles")
        .select("display_name")
        .eq("user_id", user.id)
        .maybeSingle();

      if (data?.display_name) name = data.display_name;
    } catch (_) {}

    return {
      name: name || user.email || "Google User",
      email: user.email || ""
    };
  }

  function adminMenu(role) {
    if (!["admin", "editor", "reviewer"].includes(role)) return "";

    const items = [
      `<a href="admin.html"${activeClass(["admin.html"])}>KPI Admin</a>`
    ];

    if (["admin", "editor"].includes(role)) {
      items.push(
        `<a href="volunteer-admin.html"${activeClass(["volunteer-admin.html"])}>Volunteer Admin</a>`
      );
    }

    return `
      <details class="sai-admin-dropdown">
        <summary class="sai-nav-link${activeClass(["admin.html","volunteer-admin.html"])}">
          KPI Admin
        </summary>
        <div class="sai-admin-dropdown-menu">
          ${items.join("")}
        </div>
      </details>
    `;
  }

  async function signIn() {
    const redirectTo = location.href;
    const { error } = await navDb.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo }
    });
    if (error) window.alert(error.message);
  }

  async function signOut() {
    const { error } = await navDb.auth.signOut({ scope: "local" });
    if (error) {
      window.alert(error.message);
      return;
    }
    await render(null);
  }

  async function render(session) {
    if (!session?.user) {
      root.innerHTML = `
        <div class="sai-global-nav-row">
          <nav class="sai-global-nav-links" aria-label="Main navigation">
            <a href="volunteer.html"
               class="sai-nav-link${activeClass(["volunteer.html"])}">
              Volunteer Home
            </a>
            <button type="button"
                    class="sai-nav-link sai-nav-button"
                    data-sai-login>
              Log-in
            </button>
          </nav>
        </div>
      `;

      root.querySelector("[data-sai-login]")
        ?.addEventListener("click", signIn);
      return;
    }

    const [role, identity] = await Promise.all([
      effectiveRole(),
      displayIdentity(session.user)
    ]);

    root.innerHTML = `
      <div class="sai-global-nav-row">
        <div class="sai-global-user">
          <strong>${esc(identity.name)}</strong>
          <span>${esc(identity.email)}</span>
        </div>

        <nav class="sai-global-nav-links" aria-label="Main navigation">
          <a href="index.html"
             class="sai-nav-link${activeClass(["index.html",""])}">
            Public Dashboard
          </a>

          <a href="volunteer.html"
             class="sai-nav-link${activeClass(["volunteer.html"])}">
            Volunteer Home
          </a>

          <a href="my-metrics.html"
             class="sai-nav-link${activeClass(["my-metrics.html"])}">
            My Metrics
          </a>

          <button type="button"
                  class="sai-nav-link sai-nav-button"
                  data-sai-logout>
            Sign out
          </button>

          ${adminMenu(role)}
        </nav>
      </div>
    `;

    root.querySelector("[data-sai-logout]")
      ?.addEventListener("click", signOut);
  }

  navDb.auth.onAuthStateChange((_event, session) => {
    render(session);
  });

  navDb.auth.getSession()
    .then(({ data }) => render(data.session))
    .catch(() => render(null));
})();
