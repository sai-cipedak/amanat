const supabaseClient = supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);

const state = {
  kpis: [],
  filtered: [],
  volunteerStats: {
    activeAssignments: 0,
    neededSlots: 0
  }
};

const els = {
  loading: document.getElementById("loading-state"),
  error: document.getElementById("error-state"),
  errorMessage: document.getElementById("error-message"),
  list: document.getElementById("kpi-list"),
  template: document.getElementById("kpi-template"),
  clusterProgress: document.getElementById("cluster-progress"),
  activeProjects: document.getElementById("active-projects"),
  volunteerCount: document.getElementById("volunteer-count"),
  overallProgress: document.getElementById("overall-progress"),
  lastUpdated: document.getElementById("last-updated"),
  resultCount: document.getElementById("result-count"),
  search: document.getElementById("search-input"),
  clusterFilter: document.getElementById("cluster-filter"),
  typeFilter: document.getElementById("type-filter"),
  responsibilityFilter: document.getElementById("responsibility-filter"),
  priorityFilter: document.getElementById("priority-filter"),
  activityFilter: document.getElementById("activity-filter"),
  dataFilter: document.getElementById("data-filter"),
  resetFilters: document.getElementById("reset-filters")
};

function clamp(value) {
  return Math.max(0, Math.min(100, value));
}

// kpi_metrics is the public snapshot of the latest VERIFIED metric update.
 // The DB snapshot trigger rolls the latest approved/verified update into
 // progress_pct / actual / actual_date. Public aggregation therefore starts
 // from this snapshot and never from pending/draft contributor or owner data.
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

function metricAggregateValue(metric) {
  const progress = metricProgress(metric);
  return progress === null ? 0 : progress;
}

function averageMetricProgress(metrics) {
  const publicMetrics = (metrics || []).filter(
    metric => metric.is_public !== false
  );

  if (!publicMetrics.length) return null;

  const total = publicMetrics.reduce(
    (sum, metric) => sum + metricAggregateValue(metric),
    0
  );

  return total / publicMetrics.length;
}

function kpiProgress(kpi) {
  return averageMetricProgress(kpi.kpi_metrics || []);
}

function mandateProgress(mandateId) {
  const metrics = state.kpis
    .filter(kpi => kpi.mandate_id === mandateId)
    .flatMap(kpi => (kpi.kpi_metrics || []).filter(
      metric => metric.is_public !== false
    ));

  return averageMetricProgress(metrics);
}

function clusterProgress(clusterName) {
  const metrics = state.kpis
    .filter(
      kpi =>
        (kpi.mandates?.cluster || "Belum diklasifikasikan") === clusterName
    )
    .flatMap(kpi => (kpi.kpi_metrics || []).filter(
      metric => metric.is_public !== false
    ));

  return averageMetricProgress(metrics);
}

function overallPortfolioProgress() {
  const metrics = state.kpis.flatMap(
    kpi => (kpi.kpi_metrics || []).filter(
      metric => metric.is_public !== false
    )
  );

  return averageMetricProgress(metrics);
}

function kpiDataState(kpi) {
  const metrics = (kpi.kpi_metrics || []).filter(
    metric => metric.is_public !== false
  );

  if (!metrics.length) return "needs_data";

  if (metrics.some(metric => metricReadiness(metric) === "needs_target")) {
    return "needs_target";
  }

  const hasAnyMeasuredMetric = metrics.some(
    metric => metricProgress(metric) !== null
  );

  return hasAnyMeasuredMetric ? "measured" : "needs_data";
}


function isKpiPriority(kpi) {
  return Boolean(kpi.is_priority);
}

function kpiProjectStatus(kpi) {
  const progress = kpiProgress(kpi);

  if (progress !== null && progress >= 100) {
    return "completed";
  }

  if (Boolean(kpi.is_active_manual)) {
    return "active";
  }

  const hasProgress = (kpi.kpi_metrics || []).some(metric => {
    const metricValue = metricProgress(metric);
    return metricValue !== null && metricValue > 0;
  });

  return hasProgress ? "active" : "not_active";
}

function formatProjectStatus(status) {
  if (status === "completed") return "Completed";
  if (status === "active") return "Active";
  return "Belum Active";
}

function formatPriorityLabel(kpi) {
  return isKpiPriority(kpi)
    ? "Project Prioritas"
    : "Less Priority";
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
  if (value === null || value === undefined) return "—";

  const rounded = Math.round(Number(value) * 10) / 10;
  return `${rounded}%`;
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

function numericKpiKey(id) {
  const match = String(id || "").match(/^AM(\d+)-K(\d+)$/i);
  if (!match) return [9999, 9999];
  return [Number(match[1]), Number(match[2])];
}

function buildClusterOrderMap(kpis) {
  const order = new Map();

  kpis.forEach(kpi => {
    const cluster = kpi.mandates?.cluster || "Belum diklasifikasikan";
    const mandateOrder = Number(kpi.mandates?.sort_order ?? 9999);

    if (!order.has(cluster) || mandateOrder < order.get(cluster)) {
      order.set(cluster, mandateOrder);
    }
  });

  return order;
}

function compareKpisByClusterThenId(a, b, clusterOrder) {
  const clusterA = a.mandates?.cluster || "Belum diklasifikasikan";
  const clusterB = b.mandates?.cluster || "Belum diklasifikasikan";

  const rankA = clusterOrder.get(clusterA) ?? 9999;
  const rankB = clusterOrder.get(clusterB) ?? 9999;

  if (rankA !== rankB) return rankA - rankB;

  const clusterCompare = clusterA.localeCompare(clusterB, "id");
  if (clusterCompare !== 0 && rankA === rankB) {
    return clusterCompare;
  }

  const [amA, kA] = numericKpiKey(a.id);
  const [amB, kB] = numericKpiKey(b.id);

  if (amA !== amB) return amA - amB;
  if (kA !== kB) return kA - kB;

  return String(a.id).localeCompare(String(b.id), "id");
}

async function loadData() {
  try {
    const kpiPromise = supabaseClient
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
        is_priority,
        is_active_manual,
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

    const [
      kpiResult,
      opportunitiesResult,
      contributorsResult,
      approvedApplicationsResult
    ] = await Promise.allSettled([
      kpiPromise,
      supabaseClient
        .from("volunteer_opportunities")
        .select("id,status,volunteer_slots")
        .neq("status", "closed"),
      supabaseClient
        .from("metric_contributors")
        .select("id,assignment_status"),
      supabaseClient
        .from("volunteer_applications")
        .select("id,status")
        .eq("status", "approved")
    ]);

    if (kpiResult.status !== "fulfilled") throw kpiResult.reason;
    if (kpiResult.value.error) throw kpiResult.value.error;

    const data = kpiResult.value.data || [];

    state.kpis = data.map(kpi => ({
      ...kpi,
      kpi_metrics: (kpi.kpi_metrics || [])
        .filter(metric => metric.is_public !== false)
        .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
    }));

    const opportunities =
      opportunitiesResult.status === "fulfilled" && !opportunitiesResult.value.error
        ? (opportunitiesResult.value.data || [])
        : [];

    const contributorRows =
      contributorsResult.status === "fulfilled" && !contributorsResult.value.error
        ? (contributorsResult.value.data || [])
        : [];

    const approvedApps =
      approvedApplicationsResult.status === "fulfilled" && !approvedApplicationsResult.value.error
        ? (approvedApplicationsResult.value.data || [])
        : [];

    const neededSlots = opportunities
      .filter(opportunity => opportunity.status === "open")
      .reduce(
        (sum, opportunity) =>
          sum + Math.max(1, Number(opportunity.volunteer_slots || 0)),
        0
      );

    const activeAssignments = contributorRows.length
      ? contributorRows.filter(row => row.assignment_status === "active").length
      : approvedApps.length;

    state.volunteerStats = {
      activeAssignments,
      neededSlots
    };

    state.filtered = [...state.kpis];

    populateClusterFilter();
    renderAll();

    els.loading.hidden = true;
  } catch (error) {
    console.error(error);
    els.error.hidden = false;
    els.errorMessage.textContent = error.message || "Gagal memuat data KPI.";
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
  const activeKpiCount = state.kpis.filter(
    kpi => kpiProjectStatus(kpi) === "active"
  ).length;

  const portfolioProgress = overallPortfolioProgress();

  els.activeProjects.textContent =
    `${activeKpiCount}/${state.kpis.length}`;

  els.volunteerCount.textContent =
    `${state.volunteerStats.activeAssignments}/${state.volunteerStats.neededSlots}`;

  els.overallProgress.textContent =
    formatProgress(portfolioProgress);

  const timestamps = state.kpis.flatMap(kpi => [
    kpi.updated_at,
    ...(kpi.kpi_metrics || []).map(metric => metric.updated_at)
  ]).filter(Boolean).map(value => new Date(value));

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
      const metrics = kpis.flatMap(
        kpi => (kpi.kpi_metrics || []).filter(
          metric => metric.is_public !== false
        )
      );

      const measuredMetricCount = metrics.filter(
        metric => metricProgress(metric) !== null
      ).length;

      const progress = averageMetricProgress(metrics);

      const row = document.createElement("div");
      row.className = "cluster-row";

      const name = document.createElement("div");
      name.className = "cluster-name";
      name.innerHTML = `
        <strong>${escapeHtml(cluster)}</strong>
        <small>
          ${kpis.length} KPI ·
          ${metrics.length} metrics ·
          ${measuredMetricCount} with progress data
        </small>
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
        <small>all-metric average</small>
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
  const priority = els.priorityFilter.value;
  const activity = els.activityFilter.value;
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
      (!priority ||
        (priority === "priority"
          ? isKpiPriority(kpi)
          : !isKpiPriority(kpi))) &&
      (!activity || kpiProjectStatus(kpi) === activity) &&
      (!dataState || kpiDataState(kpi) === dataState)
    );
  });

  const clusterOrder = buildClusterOrderMap(state.kpis);
  state.filtered.sort((a, b) => compareKpisByClusterThenId(a, b, clusterOrder));

  renderKpis();
}

function renderKpis() {
  els.list.innerHTML = "";
  els.resultCount.textContent = `${state.filtered.length} KPI`;

  let currentCluster = null;
  const clusterCounts = new Map();
  state.filtered.forEach(kpi => {
    const cluster = kpi.mandates?.cluster || "Belum diklasifikasikan";
    clusterCounts.set(cluster, (clusterCounts.get(cluster) || 0) + 1);
  });

  state.filtered.forEach(kpi => {
    const cluster = kpi.mandates?.cluster || "Belum diklasifikasikan";
    if (cluster !== currentCluster) {
      currentCluster = cluster;
      const heading = document.createElement("div");
      heading.className = "section-heading kpi-cluster-heading";
      const title = document.createElement("h2");
      title.textContent = cluster;
      const count = document.createElement("span");
      count.className = "result-count";
      count.textContent = `${clusterCounts.get(cluster)} KPI`;
      heading.append(title, count);
      els.list.appendChild(heading);
    }

    const fragment = els.template.content.cloneNode(true);
    const card = fragment.querySelector(".kpi-card");
    const header = fragment.querySelector(".kpi-card-header");
    const detail = fragment.querySelector(".kpi-detail");

    const progress = kpiProgress(kpi);
    const dataState = kpiDataState(kpi);

    fragment.querySelector(".kpi-id").textContent = kpi.id;
    fragment.querySelector(".kpi-type").textContent = formatLabel(kpi.measurement_type);
    fragment.querySelector(".responsibility").textContent = formatLabel(kpi.responsibility);
    fragment.querySelector(".project-priority-flag").textContent = formatPriorityLabel(kpi);
    fragment.querySelector(".project-activity-flag").textContent = formatProjectStatus(kpiProjectStatus(kpi));
    fragment.querySelector(".kpi-title").textContent = kpi.title;
    const mandateId = kpi.mandates?.id || kpi.mandate_id;
    const mandateValue = mandateProgress(mandateId);

    fragment.querySelector(".kpi-mandate").textContent =
      `${kpi.mandates?.id || ""} · ${kpi.mandates?.title || "Amanat belum tersedia"} · Amanat ${formatProgress(mandateValue)}`;

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

      metricEl.innerHTML = `
        <div>
          <strong>${escapeHtml(metric.metric_name)}</strong>
          <small>${escapeHtml(formatLabel(metric.measurement_method))} · ${escapeHtml(metric.target_description || "Target definition TBD")}</small>
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
  els.priorityFilter,
  els.activityFilter,
  els.dataFilter
].forEach(input => {
  input.addEventListener(input.tagName === "INPUT" ? "input" : "change", applyFilters);
});

els.resetFilters.addEventListener("click", () => {
  els.search.value = "";
  els.clusterFilter.value = "";
  els.typeFilter.value = "";
  els.responsibilityFilter.value = "";
  els.priorityFilter.value = "";
  els.activityFilter.value = "";
  els.dataFilter.value = "";
  applyFilters();
});

loadData();
