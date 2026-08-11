const adminSupabase = supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);

const state = {
  session: null,
  profile: null,
  kpis: [],
  updates: [],
  allUpdates: [],
  adminUsers: [],
  selectedKpi: null,
  selectedMetric: null
};

const els = {
  loginPanel: document.getElementById("login-panel"),
  googleLoginButton: document.getElementById("google-login-button"),
  loginMessage: document.getElementById("login-message"),
  accessDenied: document.getElementById("access-denied"),
  deniedLogout: document.getElementById("denied-logout-button"),
  adminApp: document.getElementById("admin-app"),
  sessionControls: document.getElementById("session-controls"),
  userName: document.getElementById("user-name"),
  userRole: document.getElementById("user-role"),
  logout: document.getElementById("logout-button"),
  pageLoading: document.getElementById("page-loading"),
  totalKpis: document.getElementById("admin-total-kpis"),
  totalMetrics: document.getElementById("admin-total-metrics"),
  draftCount: document.getElementById("admin-draft-count"),
  verifiedCount: document.getElementById("admin-verified-count"),
  kpiSelect: document.getElementById("kpi-select"),
  metricSelect: document.getElementById("metric-select"),
  workspace: document.getElementById("metric-workspace"),
  metricId: document.getElementById("metric-id"),
  metricName: document.getElementById("metric-name"),
  metricKpiTitle: document.getElementById("metric-kpi-title"),
  metricState: document.getElementById("metric-state"),
  metricMethod: document.getElementById("metric-method"),
  metricBaseline: document.getElementById("metric-baseline"),
  metricTarget: document.getElementById("metric-target"),
  metricCurrent: document.getElementById("metric-current"),
  metricCurrentDate: document.getElementById("metric-current-date"),
  metricFrequency: document.getElementById("metric-frequency"),
  metricTargetDescription: document.getElementById("metric-target-description"),
  updateForm: document.getElementById("update-form"),
  editingUpdateId: document.getElementById("editing-update-id"),
  updateFormTitle: document.getElementById("update-form-title"),
  formModeTag: document.getElementById("form-mode-tag"),
  submitUpdateButton: document.getElementById("submit-update-button"),
  cancelEditButton: document.getElementById("cancel-edit-button"),
  updateDate: document.getElementById("update-date"),
  updateActual: document.getElementById("update-actual"),
  updateProgress: document.getElementById("update-progress"),
  updateEvidence: document.getElementById("update-evidence"),
  updateNote: document.getElementById("update-note"),
  updateMessage: document.getElementById("update-message"),
  historyCount: document.getElementById("history-count"),
  historyList: document.getElementById("history-list"),
  myDraftsPanel: document.getElementById("my-drafts-panel"),
  myDraftCount: document.getElementById("my-draft-count"),
  myDraftsSearch: document.getElementById("my-drafts-search"),
  myDraftsList: document.getElementById("my-drafts-list"),
  reviewQueuePanel: document.getElementById("review-queue-panel"),
  reviewQueueCount: document.getElementById("review-queue-count"),
  reviewSearch: document.getElementById("review-search"),
  reviewClusterFilter: document.getElementById("review-cluster-filter"),
  reviewList: document.getElementById("review-list"),
  userManagementPanel: document.getElementById("user-management-panel"),
  activeUserCount: document.getElementById("active-user-count"),
  addUserForm: document.getElementById("add-user-form"),
  newUserEmail: document.getElementById("new-user-email"),
  newUserName: document.getElementById("new-user-name"),
  newUserRole: document.getElementById("new-user-role"),
  userFormMessage: document.getElementById("user-form-message"),
  userSearch: document.getElementById("user-search"),
  userList: document.getElementById("user-list")
};

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatNumber(value) {
  if (value === null || value === undefined || value === "") return "—";
  return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 })
    .format(Number(value));
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric", month: "short", year: "numeric"
  }).format(date);
}

function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit"
  }).format(date);
}

function roleCanReview() {
  return ["reviewer", "admin"].includes(state.profile?.role);
}

function setMessage(element, text, type = "") {
  element.textContent = text || "";
  element.className = `form-message ${type}`.trim();
}

function setLoading(isLoading) {
  els.pageLoading.hidden = !isLoading;
}

function metricProgress(metric) {
  if (metric.progress_pct !== null && metric.progress_pct !== undefined) {
    return Math.max(0, Math.min(100, Number(metric.progress_pct)));
  }
  if (metric.actual === null || metric.actual === undefined) return null;

  const actual = Number(metric.actual);
  const target = metric.target === null || metric.target === undefined ? null : Number(metric.target);
  const baseline = metric.baseline === null || metric.baseline === undefined ? null : Number(metric.baseline);

  switch (metric.measurement_direction) {
    case "binary": return actual >= 1 ? 100 : 0;
    case "milestone":
      if (target && target !== 0) return Math.max(0, Math.min(100, (actual / target) * 100));
      return Math.max(0, Math.min(100, actual));
    case "higher_is_better":
      if (target === null) return null;
      if (baseline !== null && target !== baseline) {
        return Math.max(0, Math.min(100, ((actual - baseline) / (target - baseline)) * 100));
      }
      if (target > 0) return Math.max(0, Math.min(100, (actual / target) * 100));
      return null;
    case "lower_is_better":
      if (baseline === null || target === null || baseline === target) return null;
      return Math.max(0, Math.min(100, ((baseline - actual) / (baseline - target)) * 100));
    case "target_is_exact": return target !== null && actual === target ? 100 : 0;
    default: return null;
  }
}

async function signInWithGoogle() {
  const redirectTo = `${window.location.origin}${window.location.pathname}`;
  const { error } = await adminSupabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo }
  });
  if (error) throw error;
}

async function resolveProfile(session) {
  if (!session?.user?.email) return null;
  const { data, error } = await adminSupabase
    .from("admin_users")
    .select("email, display_name, role, is_active")
    .eq("email", session.user.email)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function loadReferenceData() {
  const { data, error } = await adminSupabase
    .from("kpis")
    .select(`
      id, title, mandate_id, sort_order,
      mandates (id, title, cluster, sort_order),
      kpi_metrics (
        id, metric_name, metric_description,
        measurement_method, measurement_direction, unit,
        baseline, baseline_date, baseline_source,
        target, target_description, target_source,
        actual, actual_date, actual_note,
        progress_pct, public_evidence_url,
        data_owner, reporting_frequency,
        sort_order, is_public
      )
    `)
    .order("sort_order", { ascending: true });

  if (error) throw error;

  state.kpis = (data || []).map(kpi => ({
    ...kpi,
    kpi_metrics: (kpi.kpi_metrics || [])
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
  })).sort((a, b) => {
    const ma = a.mandates?.sort_order || 0;
    const mb = b.mandates?.sort_order || 0;
    return ma !== mb ? ma - mb : (a.sort_order || 0) - (b.sort_order || 0);
  });
}


function findMetricContext(metricId) {
  for (const kpi of state.kpis) {
    const metric = (kpi.kpi_metrics || []).find(m => m.id === metricId);
    if (metric) {
      return {
        kpi,
        metric,
        cluster: kpi.mandates?.cluster || "Unclassified"
      };
    }
  }
  return null;
}

function updateValueLabel(update) {
  if (update.actual !== null && update.actual !== undefined) {
    return `Actual ${formatNumber(update.actual)}`;
  }
  if (update.progress_pct !== null && update.progress_pct !== undefined) {
    return `Progress ${formatNumber(update.progress_pct)}%`;
  }
  return "No numeric value";
}

function resetUpdateForm() {
  els.editingUpdateId.value = "";
  els.updateFormTitle.textContent = "Submit Update";
  els.formModeTag.textContent = "New Draft";
  els.submitUpdateButton.textContent = "Submit as Draft";
  els.cancelEditButton.hidden = true;
  els.updateDate.value = new Date().toISOString().slice(0, 10);
  els.updateActual.value = "";
  els.updateProgress.value = "";
  els.updateEvidence.value = "";
  els.updateNote.value = "";
  setMessage(els.updateMessage, "");
}

function populateReviewClusters() {
  const clusters = [...new Set(
    state.kpis.map(k => k.mandates?.cluster).filter(Boolean)
  )].sort((a, b) => a.localeCompare(b, "id"));

  els.reviewClusterFilter.innerHTML =
    `<option value="">Semua cluster</option>`;

  clusters.forEach(cluster => {
    const option = document.createElement("option");
    option.value = cluster;
    option.textContent = cluster;
    els.reviewClusterFilter.appendChild(option);
  });
}

function queueCardHtml(update, mode) {
  const context = findMetricContext(update.metric_id);
  if (!context) return "";

  const evidence = update.public_evidence_url
    ? `<a class="evidence-link" href="${escapeHtml(update.public_evidence_url)}"
         target="_blank" rel="noopener noreferrer">Public evidence ↗</a>`
    : "";

  const ownDraft =
    update.verification_status === "draft" &&
    update.created_by === state.session?.user?.id;

  const editButton = mode === "mine" && ownDraft
    ? `<button class="small-button edit-button" type="button"
         data-edit="${update.id}">Edit Draft</button>`
    : "";

  const reviewButtons = mode === "review" && roleCanReview()
    ? `<button class="small-button verify-button" type="button"
         data-review="verified" data-id="${update.id}">Verify</button>
       <button class="small-button reject-button" type="button"
         data-review="rejected" data-id="${update.id}">Reject</button>`
    : "";

  return `
    <article class="queue-card">
      <div class="queue-card-main">
        <div class="queue-card-top">
          <div>
            <p class="queue-card-id">
              ${escapeHtml(update.metric_id)} · ${escapeHtml(context.cluster)}
            </p>
            <h3>${escapeHtml(context.metric.metric_name)}</h3>
            <p class="queue-kpi">
              ${escapeHtml(context.kpi.id)} · ${escapeHtml(context.kpi.title)}
            </p>
          </div>

          <div class="queue-value">
            <strong>${escapeHtml(updateValueLabel(update))}</strong>
            <span>As of ${escapeHtml(formatDate(update.as_of_date))}</span>
          </div>
        </div>

        <p class="queue-note">${escapeHtml(update.update_note || "—")}</p>
        ${evidence}

        <div class="queue-meta">
          Submitted by ${escapeHtml(update.submitted_by || "—")}
          · ${escapeHtml(formatDateTime(update.created_at))}
        </div>
      </div>

      <div class="queue-actions">
        <button class="small-button open-button" type="button"
          data-open-metric="${escapeHtml(update.metric_id)}">Open Metric</button>
        ${editButton}
        ${reviewButtons}
      </div>
    </article>
  `;
}

function bindQueueActions(container) {
  container.querySelectorAll("[data-open-metric]").forEach(button => {
    button.addEventListener("click", () => {
      openMetric(button.dataset.openMetric);
    });
  });

  container.querySelectorAll("[data-edit]").forEach(button => {
    button.addEventListener("click", () => {
      const update = state.allUpdates.find(
        row => row.id === Number(button.dataset.edit)
      );
      if (update) startEditDraft(update);
    });
  });

  container.querySelectorAll("[data-review]").forEach(button => {
    button.addEventListener("click", async () => {
      await reviewUpdate(
        Number(button.dataset.id),
        button.dataset.review
      );
    });
  });
}

function renderMyDrafts() {
  const q = (els.myDraftsSearch.value || "").trim().toLowerCase();
  const myUserId = state.session?.user?.id;

  let rows = state.allUpdates.filter(update =>
    update.verification_status === "draft" &&
    update.created_by === myUserId
  );

  if (q) {
    rows = rows.filter(update => {
      const context = findMetricContext(update.metric_id);
      const haystack = [
        update.metric_id,
        update.update_note,
        context?.metric?.metric_name,
        context?.kpi?.id,
        context?.kpi?.title,
        context?.cluster
      ].filter(Boolean).join(" ").toLowerCase();

      return haystack.includes(q);
    });
  }

  els.myDraftCount.textContent = rows.length;
  els.myDraftsList.innerHTML = rows.length
    ? rows.map(update => queueCardHtml(update, "mine")).join("")
    : `<div class="queue-empty">Tidak ada draft milik lu.</div>`;

  bindQueueActions(els.myDraftsList);
}

function renderReviewQueue() {
  if (!roleCanReview()) {
    els.reviewQueuePanel.hidden = true;
    return;
  }

  els.reviewQueuePanel.hidden = false;

  const q = (els.reviewSearch.value || "").trim().toLowerCase();
  const cluster = els.reviewClusterFilter.value || "";

  let rows = state.allUpdates.filter(
    update => update.verification_status === "draft"
  );

  rows = rows.filter(update => {
    const context = findMetricContext(update.metric_id);
    if (!context) return false;

    const haystack = [
      update.metric_id,
      update.submitted_by,
      update.update_note,
      context.metric.metric_name,
      context.kpi.id,
      context.kpi.title,
      context.cluster
    ].filter(Boolean).join(" ").toLowerCase();

    return (
      (!q || haystack.includes(q)) &&
      (!cluster || context.cluster === cluster)
    );
  });

  els.reviewQueueCount.textContent = rows.length;
  els.reviewList.innerHTML = rows.length
    ? rows.map(update => queueCardHtml(update, "review")).join("")
    : `<div class="queue-empty">Tidak ada draft yang menunggu review.</div>`;

  bindQueueActions(els.reviewList);
}

function openMetric(metricId) {
  const context = findMetricContext(metricId);
  if (!context) return;

  state.selectedKpi = context.kpi;
  state.selectedMetric = context.metric;

  els.kpiSelect.value = context.kpi.id;
  populateMetrics(context.kpi);
  els.metricSelect.value = context.metric.id;

  resetUpdateForm();
  renderMetric(context.metric);
  loadHistory(context.metric.id);

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function startEditDraft(update) {
  const context = findMetricContext(update.metric_id);
  if (!context) return;

  state.selectedKpi = context.kpi;
  state.selectedMetric = context.metric;

  els.kpiSelect.value = context.kpi.id;
  populateMetrics(context.kpi);
  els.metricSelect.value = context.metric.id;

  renderMetric(context.metric);

  els.editingUpdateId.value = String(update.id);
  els.updateFormTitle.textContent = "Edit Draft";
  els.formModeTag.textContent = `Draft #${update.id}`;
  els.submitUpdateButton.textContent = "Save Draft";
  els.cancelEditButton.hidden = false;

  els.updateDate.value = update.as_of_date || "";
  els.updateActual.value =
    update.actual === null || update.actual === undefined ? "" : update.actual;
  els.updateProgress.value =
    update.progress_pct === null || update.progress_pct === undefined
      ? ""
      : update.progress_pct;
  els.updateEvidence.value = update.public_evidence_url || "";
  els.updateNote.value = update.update_note || "";

  loadHistory(context.metric.id);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function loadAllUpdateCounts() {
  const { data, error } = await adminSupabase
    .from("metric_updates")
    .select(`
      id,
      metric_id,
      as_of_date,
      actual,
      progress_pct,
      public_evidence_url,
      update_note,
      verification_status,
      submitted_by,
      verified_by,
      verified_at,
      reviewed_by,
      reviewed_at,
      review_note,
      created_by,
      created_at
    `)
    .order("created_at", { ascending: false });

  if (error) throw error;

  state.allUpdates = data || [];

  const drafts = state.allUpdates.filter(
    row => row.verification_status === "draft"
  );
  const verified = state.allUpdates.filter(
    row => row.verification_status === "verified"
  );

  els.draftCount.textContent = drafts.length;
  els.verifiedCount.textContent = verified.length;

  renderMyDrafts();
  renderReviewQueue();
}
function populateKpis() {
  els.kpiSelect.innerHTML = `<option value="">Pilih KPI…</option>`;
  state.kpis.forEach(kpi => {
    const option = document.createElement("option");
    option.value = kpi.id;
    option.textContent = `${kpi.id} · ${kpi.title}`;
    els.kpiSelect.appendChild(option);
  });
  els.totalKpis.textContent = state.kpis.length;
  els.totalMetrics.textContent = state.kpis.reduce(
    (sum, kpi) => sum + (kpi.kpi_metrics || []).length, 0
  );

  populateReviewClusters();
}

function populateMetrics(kpi) {
  els.metricSelect.innerHTML = `<option value="">Pilih metric…</option>`;
  els.metricSelect.disabled = !kpi;
  if (!kpi) return;

  kpi.kpi_metrics.forEach(metric => {
    const option = document.createElement("option");
    option.value = metric.id;
    option.textContent = `${metric.id} · ${metric.metric_name}`;
    els.metricSelect.appendChild(option);
  });
}

function renderMetric(metric) {
  if (!metric || !state.selectedKpi) {
    els.workspace.hidden = true;
    return;
  }

  els.workspace.hidden = false;
  els.metricId.textContent = metric.id;
  els.metricName.textContent = metric.metric_name;
  els.metricKpiTitle.textContent = `${state.selectedKpi.id} · ${state.selectedKpi.title}`;
  els.metricMethod.textContent = `${metric.measurement_method || "—"} · ${metric.unit || "no unit"}`;
  els.metricBaseline.textContent = `${formatNumber(metric.baseline)}${metric.unit ? ` ${metric.unit}` : ""}`;
  els.metricTarget.textContent = `${formatNumber(metric.target)}${metric.unit ? ` ${metric.unit}` : ""}`;
  els.metricCurrent.textContent = `${formatNumber(metric.actual)}${metric.unit ? ` ${metric.unit}` : ""}`;
  els.metricCurrentDate.textContent = formatDate(metric.actual_date);
  els.metricFrequency.textContent = metric.reporting_frequency || "—";
  els.metricTargetDescription.textContent = metric.target_description || "Target definition belum tersedia.";

  const progress = metricProgress(metric);
  els.metricState.textContent = progress === null ? "Needs Data" : `${Math.round(progress)}%`;

  if (!els.editingUpdateId.value) {
    resetUpdateForm();
  }
}

async function loadHistory(metricId) {
  if (!metricId) {
    state.updates = [];
    renderHistory();
    return;
  }

  const { data, error } = await adminSupabase
    .from("metric_updates")
    .select(`
      id, metric_id, as_of_date, actual, progress_pct,
      public_evidence_url, update_note, verification_status,
      submitted_by, verified_by, verified_at,
      reviewed_by, reviewed_at, review_note, created_at
    `)
    .eq("metric_id", metricId)
    .order("as_of_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) throw error;
  state.updates = data || [];
  renderHistory();
}

function renderHistory() {
  els.historyCount.textContent = state.updates.length;
  els.historyList.innerHTML = "";

  if (!state.updates.length) {
    els.historyList.innerHTML = `<p class="empty-state">Belum ada update untuk metric ini.</p>`;
    return;
  }

  state.updates.forEach(update => {
    const card = document.createElement("article");
    card.className = "history-card";

    const value = update.actual !== null && update.actual !== undefined
      ? `Actual ${formatNumber(update.actual)}`
      : update.progress_pct !== null && update.progress_pct !== undefined
        ? `Progress ${formatNumber(update.progress_pct)}%`
        : "No numeric value";

    const evidence = update.public_evidence_url
      ? `<a class="evidence-link" href="${escapeHtml(update.public_evidence_url)}"
           target="_blank" rel="noopener noreferrer">Public evidence ↗</a>`
      : "";

    const reviewer = update.reviewed_by || update.verified_by;
    const reviewedAt = update.reviewed_at || update.verified_at;

    const canEdit =
      update.verification_status === "draft" &&
      update.created_by === state.session?.user?.id;

    const editAction = canEdit
      ? `<button class="review-button open-button" type="button"
           data-edit-history="${update.id}">Edit</button>`
      : "";

    const reviewAction = roleCanReview() && update.verification_status === "draft"
      ? `<button class="review-button verify-button" type="button"
           data-action="verified" data-id="${update.id}">Verify</button>
         <button class="review-button reject-button" type="button"
           data-action="rejected" data-id="${update.id}">Reject</button>`
      : "";

    const actions = editAction || reviewAction
      ? `<div class="history-actions">${editAction}${reviewAction}</div>`
      : "";

    card.innerHTML = `
      <div class="history-top">
        <div class="history-value">
          <strong>${escapeHtml(value)}</strong>
          <span>As of ${escapeHtml(formatDate(update.as_of_date))}</span>
        </div>
        <span class="history-status ${escapeHtml(update.verification_status)}">
          ${escapeHtml(update.verification_status)}
        </span>
      </div>
      <p class="history-note">${escapeHtml(update.update_note || "—")}</p>
      ${evidence}
      <div class="history-meta">
        Submitted by ${escapeHtml(update.submitted_by || "—")}
        · ${escapeHtml(formatDateTime(update.created_at))}
        ${reviewer ? `<br>Reviewed by ${escapeHtml(reviewer)} · ${escapeHtml(formatDateTime(reviewedAt))}` : ""}
        ${update.review_note ? `<br>Review note: ${escapeHtml(update.review_note)}` : ""}
      </div>
      ${actions}
    `;
    els.historyList.appendChild(card);
  });

  els.historyList.querySelectorAll("[data-action]").forEach(button => {
    button.addEventListener("click", async () => {
      await reviewUpdate(Number(button.dataset.id), button.dataset.action);
    });
  });
}

async function submitDraft() {
  if (!state.selectedMetric) {
    throw new Error("Pilih metric terlebih dahulu.");
  }

  const actualValue = els.updateActual.value.trim();
  const progressValue = els.updateProgress.value.trim();

  if (!actualValue && !progressValue) {
    throw new Error("Isi Actual atau Progress Override.");
  }

  if (progressValue) {
    const n = Number(progressValue);
    if (n < 0 || n > 100) {
      throw new Error("Progress Override harus 0–100.");
    }
  }

  const payload = {
    metric_id: state.selectedMetric.id,
    as_of_date: els.updateDate.value,
    actual: actualValue === "" ? null : Number(actualValue),
    progress_pct: progressValue === "" ? null : Number(progressValue),
    public_evidence_url: els.updateEvidence.value.trim() || null,
    update_note: els.updateNote.value.trim(),
    verification_status: "draft"
  };

  const editingId = els.editingUpdateId.value;

  if (editingId) {
    const { error } = await adminSupabase
      .from("metric_updates")
      .update(payload)
      .eq("id", Number(editingId));

    if (error) throw error;
  } else {
    const { error } = await adminSupabase
      .from("metric_updates")
      .insert(payload);

    if (error) throw error;
  }

  resetUpdateForm();

  await Promise.all([
    loadHistory(state.selectedMetric.id),
    loadAllUpdateCounts()
  ]);
}
async function reviewUpdate(id, status) {
  const reviewNote = window.prompt(
    status === "verified"
      ? "Optional review note sebelum Verify:"
      : "Alasan Reject:"
  );

  if (status === "rejected" && !reviewNote?.trim()) return;

  const { error } = await adminSupabase
    .from("metric_updates")
    .update({
      verification_status: status,
      review_note: reviewNote?.trim() || null
    })
    .eq("id", id);

  if (error) {
    window.alert(`Review gagal: ${error.message}`);
    return;
  }

  const selectedKpiId = state.selectedKpi?.id || null;
  const selectedMetricId = state.selectedMetric?.id || null;

  await Promise.all([
    loadReferenceData(),
    loadAllUpdateCounts()
  ]);

  if (selectedKpiId && selectedMetricId) {
    state.selectedKpi = state.kpis.find(kpi => kpi.id === selectedKpiId);
    state.selectedMetric = state.selectedKpi?.kpi_metrics.find(
      metric => metric.id === selectedMetricId
    );

    renderMetric(state.selectedMetric);
    await loadHistory(selectedMetricId);
  }
}


async function loadAdminUsers() {
  if (state.profile?.role !== "admin") {
    state.adminUsers = [];
    els.userManagementPanel.hidden = true;
    return;
  }
  const { data, error } = await adminSupabase
    .from("admin_users")
    .select("email,display_name,role,is_active,created_at,updated_at,updated_by")
    .order("is_active", { ascending: false })
    .order("role", { ascending: true })
    .order("email", { ascending: true });
  if (error) throw error;
  state.adminUsers = data || [];
  els.userManagementPanel.hidden = false;
  renderAdminUsers();
}

function renderAdminUsers() {
  const q = (els.userSearch.value || "").trim().toLowerCase();
  const self = (state.session?.user?.email || "").toLowerCase();
  const rows = state.adminUsers.filter(user => {
    const haystack = [user.email,user.display_name,user.role,user.is_active?"active":"inactive"]
      .filter(Boolean).join(" ").toLowerCase();
    return !q || haystack.includes(q);
  });
  els.activeUserCount.textContent = state.adminUsers.filter(u => u.is_active).length;
  if (!rows.length) {
    els.userList.innerHTML = `<div class="queue-empty">Tidak ada user yang cocok.</div>`;
    return;
  }
  els.userList.innerHTML = rows.map(user => {
    const isSelf = user.email.toLowerCase() === self;
    return `<article class="user-row">
      <div class="user-identity"><strong>${escapeHtml(user.display_name || user.email)}${isSelf?`<span class="user-self-tag">YOU</span>`:""}</strong><span>${escapeHtml(user.email)}</span></div>
      <select class="user-role-select" data-user-role="${escapeHtml(user.email)}">
        <option value="editor" ${user.role==="editor"?"selected":""}>Editor</option>
        <option value="reviewer" ${user.role==="reviewer"?"selected":""}>Reviewer</option>
        <option value="admin" ${user.role==="admin"?"selected":""}>Admin</option>
      </select>
      <div class="user-actions"><button type="button" class="user-status-button ${user.is_active?"active":"inactive"}" data-user-status="${escapeHtml(user.email)}" data-current-status="${user.is_active?"true":"false"}">${user.is_active?"Active":"Inactive"}</button></div>
    </article>`;
  }).join("");
  els.userList.querySelectorAll("[data-user-role]").forEach(select => {
    select.addEventListener("change", async () => updateAdminUser(select.dataset.userRole,{role:select.value}));
  });
  els.userList.querySelectorAll("[data-user-status]").forEach(button => {
    button.addEventListener("click", async () => {
      const current = button.dataset.currentStatus === "true";
      if (!window.confirm(`${current?"Deactivate":"Reactivate"} ${button.dataset.userStatus}?`)) return;
      await updateAdminUser(button.dataset.userStatus,{is_active:!current});
    });
  });
}

async function addAdminUser() {
  const email = els.newUserEmail.value.trim().toLowerCase();
  const { error } = await adminSupabase.from("admin_users").insert({
    email,
    display_name: els.newUserName.value.trim() || null,
    role: els.newUserRole.value,
    is_active: true
  });
  if (error) throw error;
  els.newUserEmail.value=""; els.newUserName.value=""; els.newUserRole.value="editor";
  await loadAdminUsers();
}

async function updateAdminUser(email, changes) {
  const { error } = await adminSupabase.from("admin_users").update(changes).eq("email",email);
  if (error) { window.alert(`User update gagal: ${error.message}`); await loadAdminUsers(); return; }
  const self = (state.session?.user?.email || "").toLowerCase();
  if (email.toLowerCase() === self) {
    const refreshed = await resolveProfile(state.session);
    if (!refreshed || !refreshed.is_active) { await adminSupabase.auth.signOut(); return; }
    state.profile = refreshed;
    els.userRole.textContent = refreshed.role;
    els.reviewQueuePanel.hidden = !["reviewer","admin"].includes(refreshed.role);
    if (refreshed.role !== "admin") { els.userManagementPanel.hidden = true; return; }
  }
  await loadAdminUsers();
}

async function enterAdmin(session) {
  setLoading(true);
  try {
    const profile = await resolveProfile(session);

    if (!profile || !profile.is_active) {
      state.profile = null;
      els.loginPanel.hidden = true;
      els.adminApp.hidden = true;
      els.sessionControls.hidden = true;
      els.accessDenied.hidden = false;
      return;
    }

    state.profile = profile;

    await Promise.all([
      loadReferenceData(),
      loadAllUpdateCounts()
    ]);

    els.loginPanel.hidden = true;
    els.accessDenied.hidden = true;
    els.adminApp.hidden = false;
    els.sessionControls.hidden = false;
    els.userName.textContent = profile.display_name || session.user.email;
    els.userRole.textContent = profile.role;
    populateKpis();
    els.reviewQueuePanel.hidden = !roleCanReview();
    renderMyDrafts();
    renderReviewQueue();
    if (profile.role === "admin") await loadAdminUsers();
    else els.userManagementPanel.hidden = true;
  } catch (error) {
    console.error(error);
    window.alert(`Admin console gagal dimuat: ${error.message}`);
  } finally {
    setLoading(false);
  }
}

async function exitAdmin() {
  state.session = null;
  state.profile = null;
  state.kpis = [];
  state.updates = [];
  state.allUpdates = [];
  state.adminUsers = [];
  state.selectedKpi = null;
  state.selectedMetric = null;

  els.adminApp.hidden = true;
  els.accessDenied.hidden = true;
  els.sessionControls.hidden = true;
  els.workspace.hidden = true;
  els.loginPanel.hidden = false;
}

els.googleLoginButton.addEventListener("click", async () => {
  setMessage(els.loginMessage, "Redirecting to Google…");
  try { await signInWithGoogle(); }
  catch (error) { setMessage(els.loginMessage, error.message, "error"); }
});

els.logout.addEventListener("click", async () => {
  await adminSupabase.auth.signOut();
});

els.deniedLogout.addEventListener("click", async () => {
  await adminSupabase.auth.signOut();
});

els.kpiSelect.addEventListener("change", () => {
  state.selectedKpi =
    state.kpis.find(kpi => kpi.id === els.kpiSelect.value) || null;
  state.selectedMetric = null;
  populateMetrics(state.selectedKpi);
  resetUpdateForm();
  els.workspace.hidden = true;
});

els.metricSelect.addEventListener("change", async () => {
  state.selectedMetric =
    state.selectedKpi?.kpi_metrics.find(
      metric => metric.id === els.metricSelect.value
    ) || null;

  resetUpdateForm();
  renderMetric(state.selectedMetric);
  if (state.selectedMetric) await loadHistory(state.selectedMetric.id);
});

els.updateForm.addEventListener("submit", async event => {
  event.preventDefault();

  const editing = Boolean(els.editingUpdateId.value);
  setMessage(els.updateMessage, editing ? "Saving…" : "Submitting…");

  try {
    await submitDraft();
    setMessage(
      els.updateMessage,
      editing
        ? "Draft berhasil diperbarui."
        : "Draft tersimpan. Menunggu reviewer/admin.",
      "success"
    );
  } catch (error) {
    setMessage(els.updateMessage, error.message, "error");
  }
});

els.cancelEditButton.addEventListener("click", () => {
  resetUpdateForm();
});

els.myDraftsSearch.addEventListener("input", renderMyDrafts);
els.reviewSearch.addEventListener("input", renderReviewQueue);
els.reviewClusterFilter.addEventListener("change", renderReviewQueue);


els.addUserForm.addEventListener("submit", async event => {
  event.preventDefault();
  setMessage(els.userFormMessage,"Adding user…");
  try {
    await addAdminUser();
    setMessage(els.userFormMessage,"User ditambahkan. User bisa login via Google dengan email tersebut.","success");
  } catch (error) {
    setMessage(els.userFormMessage,error.message,"error");
  }
});
els.userSearch.addEventListener("input", renderAdminUsers);

adminSupabase.auth.onAuthStateChange(async (_event, session) => {
  state.session = session;
  if (session) await enterAdmin(session);
  else await exitAdmin();
});

(async function init() {
  setLoading(true);
  const { data, error } = await adminSupabase.auth.getSession();

  if (error) {
    console.error(error);
    setLoading(false);
    return;
  }

  state.session = data.session;

  if (data.session) await enterAdmin(data.session);
  else {
    await exitAdmin();
    setLoading(false);
  }
})();
