// Public dashboard must always behave as an anonymous reader.
// It intentionally ignores any Supabase Auth session that may exist
// in the same browser from /admin.html.
const supabaseClient = supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storageKey: "sai-kpi-public-anon"
    }
  }
);

const state = {
  kpis: [],
  filtered: []
};

const els = {
  loading: document.getElementById("loading-state"),
  error: document.getElementById("error-state"),
  errorMessage: document.getElementById("error-message"),
  list: document.getElementById("kpi-list"),
  template: document.getElementById("kpi-template"),
  clusterProgress: document.getElementById("cluster-progress"),
  totalMandates: document.getElementById("total-mandates"),
  totalKpis: document.getElementById("total-kpis"),
  totalMetrics: document.getElementById("total-metrics"),
  progressCoverage: document.getElementById("progress-coverage"),
  progressCoverageNote: document.getElementById("progress-coverage-note"),
  overallProgress: document.getElementById("overall-progress"),
  lastUpdated: document.getElementById("last-updated"),
  resultCount: document.getElementById("result-count"),
  search: document.getElementById("search-input"),
  clusterFilter: document.getElementById("cluster-filter"),
  typeFilter: document.getElementById("type-filter"),
  responsibilityFilter: document.getElementById("responsibility-filter"),
  dataFilter: document.getElementById("data-filter"),
  resetFilters: document.getElementById("reset-filters")
};

function clamp(value) {
  return Math.max(0, Math.min(100, value));
}

function metricProgress(metric) {
  if (metric.progress_pct !== null && metric.progress_pct !== undefined) {
    return clamp(Number(metric.progress_pct));
  }

  if (metric.actual === null || metric.actual === undefined || metric.actual === "") {
    return null;
  }

  const actual = Number(metric.actual);
  const baseline = metric.baseline === null || metric.baseline === undefined
    ? null
    : Number(metric.baseline);
  const target = metric.target === null || metric.target === undefined
    ? null
    : Number(metric.target);

  switch (metric.measurement_direction) {
    case "binary":
      return actual >= 1 ? 100 : 0;

    case "milestone":
      if (target && target !== 0) return clamp((actual / target) * 100);
      return clamp(actual);

    case "higher_is_better":
      if (target === null) return null;
      if (baseline !== null && target !== baseline) {
        return clamp(((actual - baseline) / (target - baseline)) * 100);
      }
      if (target > 0) return clamp((actual / target) * 100);
      return null;

    case "lower_is_better":
      if (baseline === null || target === null || baseline === target) return null;
      return clamp(((baseline - actual) / (baseline - target)) * 100);

    case "target_is_exact":
      if (target === null) return null;
      return actual === target ? 100 : 0;

    default:
      return null;
  }
}

function metricReadiness(metric) {
  const method = metric.measurement_method;

  if (
    ["number", "percentage", "currency"].includes(method) &&
    (metric.target === null || metric.target === undefined)
  ) {
    return "needs_target";
  }

  const progress = metricProgress(metric);
  return progress === null ? "needs_data" : "measured";
}

function kpiProgress(kpi) {
  const metrics = (kpi.kpi_metrics || []).filter(m => m.is_public !== false);
  if (!metrics.length) return null;

  const calculated = metrics.map(metric => ({
    progress: metricProgress(metric),
    weight: Number(metric.weight || 1)
  }));

  // Conservative rule: do not show a KPI progress number until all metrics are measurable.
  if (calculated.some(item => item.progress === null)) return null;

  const denominator = calculated.reduce((sum, item) => sum + item.weight, 0);
  if (!denominator) return null;

  return calculated.reduce(
    (sum, item) => sum + item.progress * item.weight,
    0
  ) / denominator;
}

function kpiDataState(kpi) {
  const metrics = kpi.kpi_metrics || [];
  if (!metrics.length) return "needs_data";

  if (metrics.some(m => metricReadiness(m) === "needs_target")) {
    return "needs_target";
  }

  return kpiProgress(kpi) === null ? "needs_data" : "measured";
}

function formatDataState(value) {
  return {
    measured: "Measured",
    needs_data: "Needs Data",
    needs_target: "Needs Target"
  }[value] || value;
}

function formatLabel(value) {
  if (!value) return "—";
  return value.replaceAll("_", " ");
}

function formatNumber(value) {
  if (value === null || value === undefined || value === "") return "—";
  return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(Number(value));
}

function formatMetricValue(metric) {
  const actual = metric.actual === null || metric.actual === undefined
    ? "—"
    : formatNumber(metric.actual);

  const target = metric.target === null || metric.target === undefined
    ? "TBD"
    : formatNumber(metric.target);

  const unit = metric.unit ? ` ${metric.unit}` : "";
  return `${actual} / ${target}${unit}`;
}

function formatProgress(value) {
  return value === null ? "—" : `${Math.round(value)}%`;
}

function formatDate(dateString) {
  if (!dateString) return "";
  const d = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dateString;
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(d);
}

function formatActualMeta(metric) {
  const parts = [];
  if (metric.actual_date) parts.push(`As of ${formatDate(metric.actual_date)}`);
  if (metric.actual_note) parts.push(metric.actual_note);
  return parts.join(" · ");
}

async function loadData() {
  try {
    const { data, error } = await supabaseClient
      .from("kpis")
      .select(`
        id,
        mandate_id,
        title,
        measurement_type,
        responsibility,
        accountable_owner,
        deadline,
        timeframe_tag,
        evidence_requirement,
        status,
        sort_order,
        is_public,
        updated_at,
        mandates (
          id,
          title,
          cluster,
          sort_order
        ),
        kpi_metrics (
          id,
          metric_name,
          metric_description,
          measurement_method,
          measurement_direction,
          baseline,
          baseline_date,
          target,
          target_description,
          actual,
          actual_date,
          actual_note,
          public_evidence_url,
          unit,
          weight,
          progress_pct,
          evidence_requirement,
          sort_order,
          is_public,
          updated_at
        )
      `)
      .eq("is_public", true)
      .order("sort_order", { ascending: true });

    if (error) throw error;

    state.kpis = (data || []).map(kpi => ({
      ...kpi,
      kpi_metrics: (kpi.kpi_metrics || [])
        .filter(metric => metric.is_public !== false)
        .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
    }));

    state.filtered = [...state.kpis];

    populateClusterFilter();
    renderAll();
    els.loading.hidden = true;
  } catch (error) {
    console.error(error);
    els.loading.hidden = true;
    els.error.hidden = false;
    els.errorMessage.textContent = error.message || "Unknown error";
  }
}

function populateClusterFilter() {
  const clusters = [...new Set(
    state.kpis.map(kpi => kpi.mandates?.cluster).filter(Boolean)
  )].sort();

  clusters.forEach(cluster => {
    const option = document.createElement("option");
    option.value = cluster;
    option.textContent = cluster;
    els.clusterFilter.appendChild(option);
  });
}

function renderAll() {
  renderSummary();
  renderClusters();
  applyFilters();
}

function renderSummary() {
  const mandateIds = new Set(state.kpis.map(kpi => kpi.mandate_id));
  const metrics = state.kpis.flatMap(kpi => kpi.kpi_metrics || []);

  // Portfolio progress uses ALL official KPIs as the denominator.
  // A KPI without measurable progress contributes 0% to the aggregate,
  // while coverage remains visible separately.
  const progressValues = state.kpis.map(kpi => kpiProgress(kpi));
  const measured = progressValues.filter(value => value !== null);

  els.totalMandates.textContent = mandateIds.size;
  els.totalKpis.textContent = state.kpis.length;
  els.totalMetrics.textContent = metrics.length;
  els.progressCoverage.textContent = `${measured.length}/${state.kpis.length}`;
  els.progressCoverageNote.textContent = "KPI punya progress data";

  const totalProgress = progressValues.reduce(
    (sum, value) => sum + (value ?? 0),
    0
  );

  const overallProgress = state.kpis.length
    ? totalProgress / state.kpis.length
    : 0;

  els.overallProgress.textContent = `${Math.round(overallProgress)}%`;

  const timestamps = [
    ...state.kpis.map(k => k.updated_at),
    ...metrics.map(m => m.updated_at)
  ]
    .filter(Boolean)
    .map(value => new Date(value))
    .filter(date => !Number.isNaN(date.getTime()));

  if (timestamps.length) {
    const latest = new Date(Math.max(...timestamps.map(d => d.getTime())));
    els.lastUpdated.textContent = new Intl.DateTimeFormat("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric"
    }).format(latest);
  } else {
    els.lastUpdated.textContent = "—";
  }
}

function renderClusters() {
  els.clusterProgress.innerHTML = "";

  const map = new Map();

  state.kpis.forEach(kpi => {
    const cluster = kpi.mandates?.cluster || "Belum diklasifikasikan";
    if (!map.has(cluster)) map.set(cluster, []);
    map.get(cluster).push(kpi);
  });

  [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b, "id"))
    .forEach(([cluster, kpis]) => {
      // Cluster progress uses every KPI in the cluster as the denominator.
      // Unmeasured KPI contributes 0% until it has measurable data.
      const allProgressValues = kpis.map(kpi => kpiProgress(kpi));
      const measuredProgressValues = allProgressValues.filter(
        value => value !== null
      );

      const totalProgress = allProgressValues.reduce(
        (sum, value) => sum + (value ?? 0),
        0
      );

      const progress = kpis.length
        ? totalProgress / kpis.length
        : 0;

      const row = document.createElement("div");
      row.className = "cluster-row";

      const name = document.createElement("div");
      name.className = "cluster-name";
      name.innerHTML = `
        <strong>${escapeHtml(cluster)}</strong>
        <small>${kpis.length} KPI · ${measuredProgressValues.length} terukur</small>
      `;

      const track = document.createElement("div");
      track.className = "progress-track";
      const bar = document.createElement("div");
      bar.className = "progress-bar";
      bar.style.width = `${progress ?? 0}%`;
      track.appendChild(bar);

      const value = document.createElement("div");
      value.className = "cluster-value";
      value.innerHTML = `
        <strong>${formatProgress(progress)}</strong>
        <small>overall progress</small>
      `;

      row.append(name, track, value);
      els.clusterProgress.appendChild(row);
    });
}

function applyFilters() {
  const q = els.search.value.trim().toLowerCase();
  const cluster = els.clusterFilter.value;
  const type = els.typeFilter.value;
  const responsibility = els.responsibilityFilter.value;
  const dataState = els.dataFilter.value;

  state.filtered = state.kpis.filter(kpi => {
    const haystack = [
      kpi.id,
      kpi.title,
      kpi.mandates?.title,
      kpi.mandates?.cluster,
      kpi.accountable_owner,
      kpi.responsibility,
      kpi.measurement_type
    ].filter(Boolean).join(" ").toLowerCase();

    return (
      (!q || haystack.includes(q)) &&
      (!cluster || kpi.mandates?.cluster === cluster) &&
      (!type || kpi.measurement_type === type) &&
      (!responsibility || kpi.responsibility === responsibility) &&
      (!dataState || kpiDataState(kpi) === dataState)
    );
  });

  renderKpis();
}

function renderKpis() {
  els.list.innerHTML = "";
  els.resultCount.textContent = `${state.filtered.length} KPI`;

  state.filtered.forEach(kpi => {
    const fragment = els.template.content.cloneNode(true);
    const card = fragment.querySelector(".kpi-card");
    const header = fragment.querySelector(".kpi-card-header");
    const detail = fragment.querySelector(".kpi-detail");

    const progress = kpiProgress(kpi);
    const dataState = kpiDataState(kpi);

    fragment.querySelector(".kpi-id").textContent = kpi.id;
    fragment.querySelector(".kpi-type").textContent = formatLabel(kpi.measurement_type);
    fragment.querySelector(".responsibility").textContent = formatLabel(kpi.responsibility);
    fragment.querySelector(".kpi-title").textContent = kpi.title;
    fragment.querySelector(".kpi-mandate").textContent =
      `${kpi.mandates?.id || ""} · ${kpi.mandates?.title || "Amanat belum tersedia"}`;

    fragment.querySelector(".kpi-progress-value").textContent = formatProgress(progress);
    fragment.querySelector(".kpi-data-state").textContent = formatDataState(dataState);
    fragment.querySelector(".progress-bar").style.width = `${progress ?? 0}%`;

    fragment.querySelector(".owner").textContent = kpi.accountable_owner || "TBD";

    const deadlineParts = [
      kpi.deadline ? formatDate(kpi.deadline) : "",
      kpi.timeframe_tag || ""
    ].filter(Boolean);

    fragment.querySelector(".deadline").textContent =
      deadlineParts.length ? deadlineParts.join(" · ") : "TBD";

    fragment.querySelector(".evidence").textContent =
      kpi.evidence_requirement || "Evidence requirement belum ditetapkan.";

    const metricList = fragment.querySelector(".metric-list");

    (kpi.kpi_metrics || []).forEach(metric => {
      const metricEl = document.createElement("div");
      metricEl.className = "metric-card";

      const progressValue = metricProgress(metric);
      const readiness = metricReadiness(metric);

      const actualMeta = formatActualMeta(metric);
      const evidenceLink = metric.public_evidence_url
        ? `<a class="metric-evidence-link" href="${escapeHtml(metric.public_evidence_url)}" target="_blank" rel="noopener noreferrer">Evidence ↗</a>`
        : "";

      metricEl.innerHTML = `
        <div>
          <strong>${escapeHtml(metric.metric_name)}</strong>
          <small>${escapeHtml(formatLabel(metric.measurement_method))} · ${escapeHtml(metric.target_description || "Target definition TBD")}</small>
          ${actualMeta ? `<small>${escapeHtml(actualMeta)}</small>` : ""}
          ${evidenceLink}
        </div>
        <div class="metric-value">
          <strong>${escapeHtml(formatMetricValue(metric))}</strong>
          <small>${escapeHtml(formatProgress(progressValue))} · ${escapeHtml(formatDataState(readiness))}</small>
        </div>
      `;

      metricList.appendChild(metricEl);
    });

    header.addEventListener("click", () => {
      const open = card.classList.toggle("open");
      header.setAttribute("aria-expanded", String(open));
      detail.hidden = !open;
    });

    els.list.appendChild(fragment);
  });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

[
  els.search,
  els.clusterFilter,
  els.typeFilter,
  els.responsibilityFilter,
  els.dataFilter
].forEach(input => {
  input.addEventListener(input.tagName === "INPUT" ? "input" : "change", applyFilters);
});

els.resetFilters.addEventListener("click", () => {
  els.search.value = "";
  els.clusterFilter.value = "";
  els.typeFilter.value = "";
  els.responsibilityFilter.value = "";
  els.dataFilter.value = "";
  applyFilters();
});

loadData();
