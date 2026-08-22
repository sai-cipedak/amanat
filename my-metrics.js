const myMetricsSupabase = supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);

const MODE_LABELS = {
  advisor_sme: "Advisor / SME",
  operational_execution: "Operational / Execution",
  project_lead: "Project Lead"
};

const state = {
  session: null,
  rows: [],
  selectedMetricId: null,
  updateHistory: []
};

const $ = id => document.getElementById(id);

const els = {
  loginPanel: $("login-panel"),
  googleLogin: $("google-login-button"),
  loginMessage: $("login-message"),
  workspace: $("workspace"),
  sessionControls: $("session-controls"),
  userName: $("user-name"),
  userEmail: $("user-email"),
  logout: $("logout-button"),

  metricCount: $("metric-count"),
  primaryCount: $("primary-count"),
  openCount: $("open-count"),
  pendingCount: $("pending-count"),

  metricSearch: $("metric-search"),
  ownerRoleFilter: $("owner-role-filter"),
  opportunityFilter: $("opportunity-filter"),

  emptyOwnerState: $("empty-owner-state"),
  resultCount: $("result-count"),
  metricList: $("metric-list"),

  progressModal: $("progress-modal"),
  progressModalClose: $("progress-modal-close"),
  progressModalTitle: $("progress-modal-title"),
  progressModalContext: $("progress-modal-context"),
  progressForm: $("progress-form"),
  progressDate: $("progress-date"),
  progressActual: $("progress-actual"),
  progressOverride: $("progress-override"),
  progressEvidence: $("progress-evidence"),
  progressNote: $("progress-note"),
  progressMessage: $("progress-message"),
  historyCount: $("history-count"),
  historyList: $("history-list")
};

function esc(value) {
  return String(value ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function setMessage(text, type = "") {
  els.loginMessage.textContent = text || "";
  els.loginMessage.className = `form-message ${type}`.trim();
}

function ownerRoleLabel(role) {
  return role === "primary_owner"
    ? "Primary Owner"
    : "Supporting Owner";
}

function numberOrDash(value, unit = "") {
  if (value === null || value === undefined || value === "") {
    return "—";
  }
  return `${value}${unit ? ` ${unit}` : ""}`;
}

function effectiveProgress(row) {
  const raw = Number(row.progress_pct);
  if (Number.isFinite(raw)) {
    return Math.max(0, Math.min(100, raw));
  }
  return null;
}

async function signInWithGoogle() {
  const redirectTo =
    `${location.origin}${location.pathname}${location.search}`;

  const { error } = await myMetricsSupabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo }
  });

  if (error) throw error;
}

async function claimOwnership() {
  const { error } = await myMetricsSupabase.rpc(
    "claim_my_metric_ownership"
  );

  if (error) throw error;
}

async function loadWorkspace() {
  const { data, error } = await myMetricsSupabase.rpc(
    "get_my_metric_workspace"
  );

  if (error) throw error;
  state.rows = data || [];
}

function renderSession() {
  const user = state.session?.user;

  if (!user) {
    els.sessionControls.hidden = true;
    return;
  }

  els.userName.textContent =
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.email;

  els.userEmail.textContent = user.email || "";
  els.sessionControls.hidden = false;
}

function renderSummary() {
  const primary = state.rows.filter(
    row => row.owner_role === "primary_owner"
  ).length;

  const open = state.rows.filter(
    row => row.opportunity_status === "open"
  ).length;

  const pending = state.rows.reduce(
    (sum, row) =>
      sum + Number(row.pending_applications || 0),
    0
  );

  els.metricCount.textContent = state.rows.length;
  els.primaryCount.textContent = primary;
  els.openCount.textContent = open;
  els.pendingCount.textContent = pending;
}

function filteredRows() {
  const q = els.metricSearch.value
    .trim()
    .toLowerCase();

  const role = els.ownerRoleFilter.value;
  const opportunity = els.opportunityFilter.value;

  return state.rows.filter(row => {
    const haystack = [
      row.metric_id,
      row.metric_name,
      row.metric_description,
      row.kpi_id,
      row.kpi_title,
      row.cluster,
      row.mandate_title
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    const opportunityMatch =
      !opportunity ||
      (
        opportunity === "none"
          ? !row.opportunity_id
          : row.opportunity_status === opportunity
      );

    return (
      (!q || haystack.includes(q)) &&
      (!role || row.owner_role === role) &&
      opportunityMatch
    );
  });
}

function renderSkillTags(skills) {
  if (!Array.isArray(skills) || !skills.length) {
    return `<span class="muted">Belum ada skill requirement.</span>`;
  }

  return skills.map(skill => `
    <span class="tag ${esc(skill.requirement_level)}">
      ${skill.requirement_level === "required" ? "Required" : "Preferred"}
      · ${esc(skill.skill_name)}
    </span>
  `).join("");
}

function renderModeTags(modes) {
  if (!Array.isArray(modes) || !modes.length) {
    return `<span class="muted">Belum ada contribution mode.</span>`;
  }

  return modes.map(mode => `
    <span class="tag">
      ${esc(MODE_LABELS[mode] || mode)}
    </span>
  `).join("");
}

function renderOpportunity(row) {
  if (!row.opportunity_id) {
    return `
      <div class="opportunity-box">
        <h4>Belum ada Volunteer Opportunity</h4>
        <p>
          Opportunity untuk metric ini belum dibuat.
        </p>
      </div>
    `;
  }

  const hours = [
    row.min_hours_month,
    row.max_hours_month
  ]
    .filter(v => v !== null && v !== undefined)
    .join("–");

  return `
    <div class="opportunity-box">
      <div class="badge-row" style="margin-bottom:6px">
        <span class="badge ${esc(row.opportunity_status)}">
          ${esc(row.opportunity_status || "—")}
        </span>
      </div>

      <h4>${esc(row.opportunity_title || row.metric_name)}</h4>

      <p>
        ${hours ? `${esc(hours)} h/month · ` : ""}
        ${row.volunteer_slots ?? "—"} slot
      </p>
    </div>
  `;
}


function localDateISO() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function selectedMetricRow() {
  return state.rows.find(
    row => row.metric_id === state.selectedMetricId
  ) || null;
}

function setProgressMessage(text, type = "") {
  els.progressMessage.textContent = text || "";
  els.progressMessage.className =
    `form-message ${type}`.trim();
}

function formatHistoryValue(value, fallback = "—") {
  return value === null || value === undefined || value === ""
    ? fallback
    : String(value);
}

async function loadMetricHistory(metricId) {
  const { data, error } = await myMetricsSupabase.rpc(
    "get_my_metric_update_history",
    { p_metric_id: metricId }
  );

  if (error) throw error;

  state.updateHistory = data || [];
  renderMetricHistory();
}

function renderMetricHistory() {
  els.historyCount.textContent = state.updateHistory.length;

  if (!state.updateHistory.length) {
    els.historyList.innerHTML = `
      <div class="empty-owner-state">
        Belum ada update history.
      </div>
    `;
    return;
  }

  els.historyList.innerHTML = state.updateHistory.map(update => `
    <article class="history-row">
      <div class="history-row-top">
        <div>
          <strong>${esc(update.as_of_date || "—")}</strong>
          <span class="history-meta">
            Actual: ${esc(formatHistoryValue(update.actual))}
            · Progress: ${
              update.progress_pct === null ||
              update.progress_pct === undefined
                ? "—"
                : `${esc(update.progress_pct)}%`
            }
          </span>
        </div>

        <span class="badge ${esc(update.verification_status)}">
          ${esc(update.verification_status)}
        </span>
      </div>

      ${
        update.update_note
          ? `<div class="history-note">
               ${esc(update.update_note)}
             </div>`
          : ""
      }

      ${
        update.review_note
          ? `<div class="history-note">
               <strong>Review:</strong>
               ${esc(update.review_note)}
             </div>`
          : ""
      }
    </article>
  `).join("");
}

async function openProgressModal(metricId) {
  const row = state.rows.find(
    item => item.metric_id === metricId
  );

  if (!row) return;

  state.selectedMetricId = metricId;

  els.progressModalTitle.textContent = "Update Progress";
  els.progressModalContext.innerHTML = `
    <strong>${esc(row.kpi_id)} · ${esc(row.kpi_title)}</strong><br>
    ${esc(row.metric_id)} · ${esc(row.metric_name)}<br>
    Ownership: <strong>${esc(ownerRoleLabel(row.owner_role))}</strong>
  `;

  els.progressDate.value = localDateISO();
  els.progressActual.value = "";
  els.progressOverride.value = "";
  els.progressEvidence.value = "";
  els.progressNote.value = "";

  setProgressMessage("");
  els.historyList.innerHTML = `
    <div class="empty-owner-state">Memuat history…</div>
  `;
  els.progressModal.hidden = false;

  try {
    await loadMetricHistory(metricId);
  } catch (error) {
    console.error(error);
    els.historyList.innerHTML = `
      <div class="empty-owner-state">
        Gagal memuat history: ${esc(error.message)}
      </div>
    `;
  }
}

async function submitProgressUpdate() {
  const row = selectedMetricRow();

  if (!row) {
    throw new Error("Metric tidak ditemukan.");
  }

  const actualRaw = els.progressActual.value.trim();
  const overrideRaw = els.progressOverride.value.trim();

  if (!actualRaw && !overrideRaw) {
    throw new Error("Isi Actual atau Progress Override.");
  }

  const progressValue =
    overrideRaw === "" ? null : Number(overrideRaw);

  if (
    progressValue !== null &&
    (progressValue < 0 || progressValue > 100)
  ) {
    throw new Error("Progress Override harus 0–100.");
  }

  const { error } = await myMetricsSupabase.rpc(
    "submit_owner_metric_update",
    {
      p_metric_id: row.metric_id,
      p_as_of_date: els.progressDate.value,
      p_actual:
        actualRaw === "" ? null : Number(actualRaw),
      p_progress_pct: progressValue,
      p_public_evidence_url:
        els.progressEvidence.value.trim() || null,
      p_update_note:
        els.progressNote.value.trim() || null
    }
  );

  if (error) throw error;

  els.progressActual.value = "";
  els.progressOverride.value = "";
  els.progressEvidence.value = "";
  els.progressNote.value = "";

  await loadMetricHistory(row.metric_id);
}

function renderRows() {
  const rows = filteredRows();

  els.resultCount.textContent =
    `${rows.length} metric${rows.length === 1 ? "" : "s"}`;

  els.emptyOwnerState.hidden =
    state.rows.length > 0;

  if (!rows.length) {
    els.metricList.innerHTML =
      state.rows.length
        ? `<div class="panel empty-owner-state">
             Tidak ada metric yang cocok dengan filter.
           </div>`
        : "";
    return;
  }

  els.metricList.innerHTML = rows.map(row => {
    const progress = effectiveProgress(row);

    return `
      <article class="metric-card">
        <div class="metric-card-top">
          <div class="metric-title-row">
            <div class="metric-title-block">
              <p class="eyebrow">
                ${esc(row.kpi_id)} · ${esc(row.metric_id)}
              </p>

              <h3>${esc(row.metric_name)}</h3>

              <div class="metric-context">
                ${esc(row.cluster)} ·
                ${esc(row.kpi_title)}
              </div>
            </div>

            <div class="badge-row">
              <span class="badge ${
                row.owner_role === "primary_owner"
                  ? "primary"
                  : "supporting"
              }">
                ${esc(ownerRoleLabel(row.owner_role))}
              </span>

              ${row.kpi_is_priority
                ? `<span class="badge priority">★ Priority</span>`
                : ""
              }

              <span class="badge ${esc(row.assignment_status)}">
                ${esc(row.assignment_status)}
              </span>
            </div>
          </div>
        </div>

        <div class="metric-body">
          <div class="metric-column">
            <p class="metric-description">
              ${esc(row.metric_description || "Belum ada metric description.")}
            </p>

            <div class="metric-stat-grid">
              <div class="metric-stat">
                <span>Baseline</span>
                <strong>
                  ${esc(numberOrDash(row.baseline, row.unit))}
                </strong>
              </div>

              <div class="metric-stat">
                <span>Target</span>
                <strong>
                  ${esc(numberOrDash(row.target, row.unit))}
                </strong>
              </div>

              <div class="metric-stat">
                <span>Actual</span>
                <strong>
                  ${esc(numberOrDash(row.actual, row.unit))}
                </strong>
              </div>

              <div class="metric-stat">
                <span>Progress</span>
                <strong>
                  ${progress === null ? "—" : `${progress.toFixed(0)}%`}
                </strong>
              </div>
            </div>

            <div class="progress-shell">
              <div class="progress-meta">
                <span>Metric progress</span>
                <strong>
                  ${progress === null ? "Belum terukur" : `${progress.toFixed(0)}%`}
                </strong>
              </div>

              <div class="progress-track">
                <div class="progress-bar"
                     style="width:${progress === null ? 0 : progress}%">
                </div>
              </div>
            </div>
          </div>

          <div class="metric-column">
            <div class="metric-section">
              <strong>Volunteer Opportunity</strong>
              ${renderOpportunity(row)}
            </div>

            <div class="metric-section">
              <strong>Volunteer Pipeline</strong>
              <div class="metric-stat-grid">
                <div class="metric-stat">
                  <span>Pending</span>
                  <strong>${Number(row.pending_applications || 0)}</strong>
                </div>
                <div class="metric-stat">
                  <span>Approved</span>
                  <strong>${Number(row.approved_applications || 0)}</strong>
                </div>
                <div class="metric-stat">
                  <span>Active</span>
                  <strong>${Number(row.active_contributors || 0)}</strong>
                </div>
              </div>
            </div>

            <div class="metric-section">
              <strong>Skill Requirements</strong>
              <div class="tag-row">
                ${renderSkillTags(row.skills)}
              </div>
            </div>

            <div class="metric-section">
              <strong>Contribution Modes</strong>
              <div class="tag-row">
                ${renderModeTags(row.contribution_modes)}
              </div>
            </div>
          </div>
        </div>

        <div class="metric-actions">
          <span class="readonly-note">
            Progress update masuk sebagai Draft untuk verification.
          </span>

          ${
            row.opportunity_id &&
            row.opportunity_status === "open"
              ? `<a class="text-link"
                    href="opportunities.html?mode=kpi&opportunity=${encodeURIComponent(row.opportunity_id)}">
                   Lihat Public Opportunity ↗
                 </a>`
              : ""
          }

          <button class="primary-button"
                  type="button"
                  data-update-progress="${esc(row.metric_id)}">
            Update Progress
          </button>
        </div>
      </article>
    `;
  }).join("");

  els.metricList
    .querySelectorAll("[data-update-progress]")
    .forEach(button => {
      button.addEventListener("click", () => {
        openProgressModal(button.dataset.updateProgress);
      });
    });
}

function renderAll() {
  renderSession();
  renderSummary();
  renderRows();
}

async function enterWorkspace(session) {
  state.session = session;

  try {
    // Email-first ownership assignment becomes UID-bound here.
    await claimOwnership();
    await loadWorkspace();

    els.loginPanel.hidden = true;
    els.workspace.hidden = false;

    renderAll();
  } catch (error) {
    console.error(error);

    els.loginPanel.hidden = false;
    els.workspace.hidden = true;

    setMessage(
      error.message || "Gagal memuat My Metrics.",
      "error"
    );
  }
}

async function exitWorkspace() {
  state.session = null;
  state.rows = [];

  els.sessionControls.hidden = true;
  els.workspace.hidden = true;
  els.loginPanel.hidden = false;

  els.userName.textContent = "";
  els.userEmail.textContent = "";
}

els.googleLogin.addEventListener("click", async () => {
  try {
    els.googleLogin.disabled = true;
    els.googleLogin.textContent = "Opening Google…";
    await signInWithGoogle();
  } catch (error) {
    console.error(error);
    setMessage(error.message, "error");
    els.googleLogin.disabled = false;
    els.googleLogin.textContent = "Continue with Google";
  }
});

els.logout.addEventListener("click", async () => {
  await myMetricsSupabase.auth.signOut({ scope: "local" });
  await exitWorkspace();
});

[
  els.metricSearch,
  els.ownerRoleFilter,
  els.opportunityFilter
].forEach(input => {
  input.addEventListener(
    input.tagName === "INPUT" ? "input" : "change",
    renderRows
  );
});


els.progressModalClose.addEventListener("click", () => {
  els.progressModal.hidden = true;
});

els.progressModal.addEventListener("click", event => {
  if (event.target === els.progressModal) {
    els.progressModal.hidden = true;
  }
});

els.progressForm.addEventListener("submit", async event => {
  event.preventDefault();

  try {
    setProgressMessage("Submitting…");
    await submitProgressUpdate();

    setProgressMessage(
      "Draft tersimpan. Menunggu verification.",
      "success"
    );
  } catch (error) {
    console.error(error);
    setProgressMessage(error.message, "error");
  }
});

myMetricsSupabase.auth.onAuthStateChange(
  async (_event, session) => {
    if (session) {
      await enterWorkspace(session);
    } else {
      await exitWorkspace();
    }
  }
);

(async function init() {
  try {
    const { data, error } =
      await myMetricsSupabase.auth.getSession();

    if (error) throw error;

    if (data.session) {
      await enterWorkspace(data.session);
    } else {
      await exitWorkspace();
    }
  } catch (error) {
    console.error(error);
    setMessage(error.message, "error");
  }
})();
