const adminSupabase = supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);

const state = {
  session: null,
  profile: null,
  kpis: [],
  updates: [],
  selectedKpi: null,
  selectedMetric: null
};

const els = {
  loginPanel: document.getElementById("login-panel"),
  loginForm: document.getElementById("login-form"),
  loginEmail: document.getElementById("login-email"),
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
  updateDate: document.getElementById("update-date"),
  updateActual: document.getElementById("update-actual"),
  updateProgress: document.getElementById("update-progress"),
  updateEvidence: document.getElementById("update-evidence"),
  updateNote: document.getElementById("update-note"),
  updateMessage: document.getElementById("update-message"),
  historyCount: document.getElementById("history-count"),
  historyList: document.getElementById("history-list")
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

async function requestMagicLink(email) {
  const redirectTo = `${window.location.origin}${window.location.pathname}`;
  const { error } = await adminSupabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: redirectTo, shouldCreateUser: false }
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

async function loadAllUpdateCounts() {
  const { data, error } = await adminSupabase
    .from("metric_updates")
    .select("id, verification_status");
  if (error) throw error;
  const rows = data || [];
  els.draftCount.textContent = rows.filter(r => r.verification_status === "draft").length;
  els.verifiedCount.textContent = rows.filter(r => r.verification_status === "verified").length;
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

  els.updateDate.value = new Date().toISOString().slice(0, 10);
  setMessage(els.updateMessage, "");
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

    const actions = roleCanReview() && update.verification_status === "draft"
      ? `<div class="history-actions">
           <button class="review-button verify-button" type="button"
             data-action="verified" data-id="${update.id}">Verify</button>
           <button class="review-button reject-button" type="button"
             data-action="rejected" data-id="${update.id}">Reject</button>
         </div>`
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
  if (!state.selectedMetric) throw new Error("Pilih metric terlebih dahulu.");

  const actualValue = els.updateActual.value.trim();
  const progressValue = els.updateProgress.value.trim();

  if (!actualValue && !progressValue) {
    throw new Error("Isi Actual atau Progress Override.");
  }

  if (progressValue) {
    const n = Number(progressValue);
    if (n < 0 || n > 100) throw new Error("Progress Override harus 0–100.");
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

  const { error } = await adminSupabase.from("metric_updates").insert(payload);
  if (error) throw error;

  els.updateActual.value = "";
  els.updateProgress.value = "";
  els.updateEvidence.value = "";
  els.updateNote.value = "";

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

  const selectedKpiId = state.selectedKpi.id;
  const selectedMetricId = state.selectedMetric.id;

  await Promise.all([
    loadReferenceData(),
    loadHistory(selectedMetricId),
    loadAllUpdateCounts()
  ]);

  state.selectedKpi = state.kpis.find(kpi => kpi.id === selectedKpiId);
  state.selectedMetric = state.selectedKpi?.kpi_metrics.find(
    metric => metric.id === selectedMetricId
  );

  renderMetric(state.selectedMetric);
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
  state.selectedKpi = null;
  state.selectedMetric = null;

  els.adminApp.hidden = true;
  els.accessDenied.hidden = true;
  els.sessionControls.hidden = true;
  els.workspace.hidden = true;
  els.loginPanel.hidden = false;
}

els.loginForm.addEventListener("submit", async event => {
  event.preventDefault();
  setMessage(els.loginMessage, "Mengirim magic link…");
  try {
    await requestMagicLink(els.loginEmail.value.trim());
    setMessage(
      els.loginMessage,
      "Magic link terkirim. Buka email dan klik link untuk masuk.",
      "success"
    );
  } catch (error) {
    setMessage(els.loginMessage, error.message, "error");
  }
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
  els.workspace.hidden = true;
});

els.metricSelect.addEventListener("change", async () => {
  state.selectedMetric =
    state.selectedKpi?.kpi_metrics.find(
      metric => metric.id === els.metricSelect.value
    ) || null;

  renderMetric(state.selectedMetric);
  if (state.selectedMetric) await loadHistory(state.selectedMetric.id);
});

els.updateForm.addEventListener("submit", async event => {
  event.preventDefault();
  setMessage(els.updateMessage, "Submitting…");
  try {
    await submitDraft();
    setMessage(
      els.updateMessage,
      "Draft tersimpan. Menunggu reviewer/admin.",
      "success"
    );
  } catch (error) {
    setMessage(els.updateMessage, error.message, "error");
  }
});

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
