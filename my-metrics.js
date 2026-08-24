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
  updateHistory: [],
  skillCatalog: [],
  opportunityDetail: null,
  shareMetricId: null,
  applicationsMetricId: null,
  applications: [],
  reviewApplicationId: null,
  reviewDecision: null,
  skillRequests: [],
  volunteerSummary: null,
  myApplications: [],
  contributorProgressUpdates: [],
  pendingContributorUpdateCounts: {},
  selectedContributionMetricId: null,
  ownerContributorUpdates: [],
  ownerContributorMetricId: null,
  ownerContributorReviewId: null,
  ownerContributorReviewDecision: null
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
  pendingCount: $("pending-count"),

  myApplicationCount: $("my-application-count"),
  myApplicationNote: $("my-application-note"),
  matchedCount: $("matched-count"),
  openTotalCount: $("open-total-count"),
  activeContributionCount: $("active-contribution-count"),

  metricCountCard: $("metric-count-card"),
  primaryCountCard: $("primary-count-card"),
  pendingOwnerCard: $("pending-owner-card"),

  myApplicationList: $("my-application-list"),
  myContributionsSection: $("my-contributions"),
  myContributionList: $("my-contribution-list"),
  ownerWorkspacePanel: $("owner-workspace-panel"),
  ownerMetricResults: $("owner-metric-results"),

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
  historyList: $("history-list"),
  skillsModal: $("skills-modal"),
  skillsModalClose: $("skills-modal-close"),
  skillsModalTitle: $("skills-modal-title"),
  skillsModalContext: $("skills-modal-context"),
  skillsSearch: $("skills-search"),
  skillsTree: $("skills-tree"),
  requiredSkillCount: $("required-skill-count"),
  preferredSkillCount: $("preferred-skill-count"),
  saveSkillsButton: $("save-skills-button"),
  skillsMessage: $("skills-message"),
  requestSkillButton: $("request-skill-button"),

  skillRequestModal: $("skill-request-modal"),
  skillRequestClose: $("skill-request-close"),
  skillRequestTitle: $("skill-request-title"),
  skillRequestContext: $("skill-request-context"),
  skillRequestForm: $("skill-request-form"),
  skillRequestType: $("skill-request-type"),
  skillRequestLevel: $("skill-request-level"),
  existingFamilyField: $("existing-family-field"),
  newFamilyField: $("new-family-field"),
  skillRequestFamilySelect: $("skill-request-family-select"),
  skillRequestFamilyInput: $("skill-request-family-input"),
  skillRequestName: $("skill-request-name"),
  skillRequestDescription: $("skill-request-description"),
  skillRequestRationale: $("skill-request-rationale"),
  skillRequestMessage: $("skill-request-message"),
  skillRequestCount: $("skill-request-count"),
  skillRequestList: $("skill-request-list"),

  opportunityModal: $("opportunity-modal"),
  opportunityModalClose: $("opportunity-modal-close"),
  opportunityModalTitle: $("opportunity-modal-title"),
  opportunityModalContext: $("opportunity-modal-context"),
  opportunityForm: $("opportunity-form"),
  opportunityStatus: $("opportunity-status"),
  opportunitySlots: $("opportunity-slots"),
  opportunityTitle: $("opportunity-title"),
  opportunityDescription: $("opportunity-description"),
  opportunityMinHours: $("opportunity-min-hours"),
  opportunityMaxHours: $("opportunity-max-hours"),
  opportunityModeAdvisor: $("opportunity-mode-advisor"),
  opportunityModeOperational: $("opportunity-mode-operational"),
  opportunityModeLead: $("opportunity-mode-lead"),
  opportunityPublicNote: $("opportunity-public-note"),
  opportunityOwnerNote: $("opportunity-owner-note"),
  opportunityStatusGuidance: $("opportunity-status-guidance"),
  opportunityMessage: $("opportunity-message"),

  shareModal: $("share-modal"),
  shareModalClose: $("share-modal-close"),
  shareModalTitle: $("share-modal-title"),
  shareModalContext: $("share-modal-context"),
  shareContributionMode: $("share-contribution-mode"),
  shareSource: $("share-source"),
  shareCampaign: $("share-campaign"),
  shareLink: $("share-link"),
  shareMessage: $("share-message"),
  publishShareButton: $("publish-share-button"),

  applicationsModal: $("applications-modal"),
  applicationsModalClose: $("applications-modal-close"),
  applicationsModalTitle: $("applications-modal-title"),
  applicationsModalContext: $("applications-modal-context"),
  applicationsStatusFilter: $("applications-status-filter"),
  applicationsCount: $("applications-count"),
  applicationsList: $("applications-list"),

  applicationReviewModal: $("application-review-modal"),
  applicationReviewClose: $("application-review-close"),
  applicationReviewEyebrow: $("application-review-eyebrow"),
  applicationReviewTitle: $("application-review-title"),
  applicationReviewContext: $("application-review-context"),
  applicationReviewForm: $("application-review-form"),
  applicationApprovalFields: $("application-approval-fields"),
  applicationReviewMode: $("application-review-mode"),
  applicationReviewHours: $("application-review-hours"),
  applicationReviewNote: $("application-review-note"),
  applicationReviewMessage: $("application-review-message"),
  applicationReviewSubmit: $("application-review-submit"),

  contributorProgressModal: $("contributor-progress-modal"),
  contributorProgressClose: $("contributor-progress-close"),
  contributorProgressTitle: $("contributor-progress-title"),
  contributorProgressContext: $("contributor-progress-context"),
  contributorProgressForm: $("contributor-progress-form"),
  contributorProgressDate: $("contributor-progress-date"),
  contributorProgressActual: $("contributor-progress-actual"),
  contributorProgressPct: $("contributor-progress-pct"),
  contributorProgressEvidence: $("contributor-progress-evidence"),
  contributorProgressNote: $("contributor-progress-note"),
  contributorProgressMessage: $("contributor-progress-message"),
  contributorProgressHistoryCount: $("contributor-progress-history-count"),
  contributorProgressHistory: $("contributor-progress-history"),

  ownerContributorUpdatesModal: $("owner-contributor-updates-modal"),
  ownerContributorUpdatesClose: $("owner-contributor-updates-close"),
  ownerContributorUpdatesTitle: $("owner-contributor-updates-title"),
  ownerContributorUpdatesContext: $("owner-contributor-updates-context"),
  ownerContributorStatusFilter: $("owner-contributor-status-filter"),
  ownerContributorUpdatesCount: $("owner-contributor-updates-count"),
  ownerContributorUpdatesList: $("owner-contributor-updates-list"),

  ownerContributorReviewModal: $("owner-contributor-review-modal"),
  ownerContributorReviewClose: $("owner-contributor-review-close"),
  ownerContributorReviewEyebrow: $("owner-contributor-review-eyebrow"),
  ownerContributorReviewTitle: $("owner-contributor-review-title"),
  ownerContributorReviewContext: $("owner-contributor-review-context"),
  ownerContributorReviewForm: $("owner-contributor-review-form"),
  ownerContributorAcceptFields: $("owner-contributor-accept-fields"),
  ownerContributorDate: $("owner-contributor-date"),
  ownerContributorActual: $("owner-contributor-actual"),
  ownerContributorPct: $("owner-contributor-pct"),
  ownerContributorEvidence: $("owner-contributor-evidence"),
  ownerContributorNote: $("owner-contributor-note"),
  ownerContributorReviewNote: $("owner-contributor-review-note"),
  ownerContributorReviewMessage: $("owner-contributor-review-message"),
  ownerContributorReviewSubmit: $("owner-contributor-review-submit")
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

async function loadSkillCatalog() {
  const {data,error}=await myMetricsSupabase
    .from("skill_catalog")
    .select("id,skill_family,skill_name,sort_order")
    .eq("is_active",true)
    .order("skill_family")
    .order("sort_order")
    .order("skill_name");
  if(error)throw error;
  state.skillCatalog=data||[];
}


async function loadVolunteerSummary() {
  const { data, error } = await myMetricsSupabase.rpc(
    "get_my_volunteer_summary"
  );

  if (error) throw error;

  state.volunteerSummary =
    Array.isArray(data) && data.length
      ? data[0]
      : {
          my_applications: 0,
          pending_applications: 0,
          approved_applications: 0,
          rejected_applications: 0,
          active_contributions: 0,
          matched_opportunities: 0,
          open_opportunities: 0
        };
}

async function loadMyApplications() {
  const { data, error } = await myMetricsSupabase.rpc(
    "get_my_volunteer_applications"
  );

  if (error) throw error;

  state.myApplications = data || [];
}


async function loadMyContributorProgressUpdates() {
  const { data, error } = await myMetricsSupabase.rpc(
    "get_my_contributor_progress_updates"
  );

  if (error) throw error;

  state.contributorProgressUpdates = data || [];
}

async function loadPendingContributorUpdateCounts() {
  const { data, error } = await myMetricsSupabase.rpc(
    "get_my_pending_contributor_update_counts"
  );

  if (error) throw error;

  state.pendingContributorUpdateCounts = Object.fromEntries(
    (data || []).map(row => [
      row.metric_id,
      Number(row.pending_count || 0)
    ])
  );
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

  const pendingOwner = state.rows.reduce(
    (sum, row) =>
      sum + Number(row.pending_applications || 0),
    0
  );

  const volunteer = state.volunteerSummary || {};

  els.myApplicationCount.textContent =
    Number(volunteer.my_applications || 0);

  els.myApplicationNote.textContent =
    `${Number(volunteer.pending_applications || 0)} pending`;

  els.matchedCount.textContent =
    Number(volunteer.matched_opportunities || 0);

  els.openTotalCount.textContent =
    Number(volunteer.open_opportunities || 0);

  els.activeContributionCount.textContent =
    Number(volunteer.active_contributions || 0);

  els.metricCount.textContent = state.rows.length;
  els.primaryCount.textContent = primary;
  els.pendingCount.textContent = pendingOwner;

  // Owner-specific cards only appear when the capability exists.
  els.metricCountCard.hidden = state.rows.length === 0;
  els.primaryCountCard.hidden = primary === 0;
  els.pendingOwnerCard.hidden = state.rows.length === 0;

  // Pure volunteers should not see an empty owner-management shell.
  els.ownerWorkspacePanel.hidden = state.rows.length === 0;
  els.ownerMetricResults.hidden = state.rows.length === 0;
}

function formatApplicationDate(value) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(date);
}

function applicationStatusLabel(status) {
  return {
    pending: "Pending",
    approved: "Approved",
    rejected: "Rejected",
    withdrawn: "Withdrawn"
  }[status] || status || "—";
}

function renderMyApplications() {
  if (!state.myApplications.length) {
    els.myApplicationList.innerHTML = `
      <div class="my-application-empty">
        Belum ada application yang Anda submit.
        <br>
        <a class="text-link"
           href="opportunities.html?mode=capacity&use_profile=1">
          Cari opportunity yang cocok
        </a>
      </div>
    `;
    return;
  }

  els.myApplicationList.innerHTML =
    state.myApplications.map(app => {
      const approved = app.application_status === "approved";
      const assignment =
        approved && app.contributor_status
          ? `${applicationStatusLabel(app.contributor_status)}
             · ${MODE_LABELS[app.assigned_contribution_mode] || app.assigned_contribution_mode || "—"}
             · ${app.committed_hours_month ?? "—"} h/month`
          : "—";

      return `
        <article class="my-application-card">
          <div>
            <div class="badge-row" style="margin-bottom:6px">
              <span class="badge ${esc(app.application_status)}">
                ${esc(applicationStatusLabel(app.application_status))}
              </span>
            </div>

            <h3>${esc(app.opportunity_title || app.metric_name)}</h3>

            <div class="my-application-context">
              ${esc(app.kpi_id)} · ${esc(app.kpi_title)}
              <br>
              ${esc(app.metric_id)} · ${esc(app.metric_name)}
            </div>
          </div>

          <div class="my-application-meta">
            <div class="my-application-stat">
              <span>Submitted</span>
              <strong>${esc(formatApplicationDate(app.submitted_at))}</strong>
            </div>

            <div class="my-application-stat">
              <span>Applied As</span>
              <strong>
                ${esc(MODE_LABELS[app.applied_contribution_mode] || app.applied_contribution_mode)}
                · ${esc(app.offered_hours_month)} h/month
              </strong>
            </div>

            <div class="my-application-stat">
              <span>Opportunity</span>
              <strong>${esc(app.opportunity_status || "—")}</strong>
            </div>

            <div class="my-application-stat">
              <span>Assignment</span>
              <strong>${esc(assignment.replace(/\s+/g, " ").trim())}</strong>
            </div>
          </div>
        </article>
      `;
    }).join("");
}



function contributionForMetric(metricId) {
  return state.myApplications.find(app =>
    app.metric_id === metricId &&
    app.contributor_status === "active"
  ) || null;
}

function contributorUpdatesForMetric(metricId) {
  return state.contributorProgressUpdates.filter(
    update => update.metric_id === metricId
  );
}

function renderMyContributions() {
  const contributions = state.myApplications.filter(
    app => app.contributor_status === "active"
  );

  els.myContributionsSection.hidden =
    contributions.length === 0;

  if (!contributions.length) {
    els.myContributionList.innerHTML = "";
    return;
  }

  els.myContributionList.innerHTML =
    contributions.map(app => {
      const pending = contributorUpdatesForMetric(app.metric_id)
        .filter(update => update.update_status === "pending")
        .length;

      return `
        <article class="my-contribution-card">
          <div>
            <div class="badge-row" style="margin-bottom:6px">
              <span class="badge active">Active Contributor</span>
              ${
                pending
                  ? `<span class="badge pending">
                       ${pending} update pending owner review
                     </span>`
                  : ""
              }
            </div>

            <h3>${esc(app.metric_name)}</h3>

            <div class="my-contribution-context">
              ${esc(app.kpi_id)} · ${esc(app.kpi_title)}
              <br>
              ${esc(app.metric_id)} · ${esc(app.cluster || "")}
            </div>
          </div>

          <div class="my-contribution-side">
            <div class="my-contribution-meta">
              <div class="my-application-stat">
                <span>Assigned As</span>
                <strong>
                  ${esc(MODE_LABELS[app.assigned_contribution_mode] ||
                    app.assigned_contribution_mode || "—")}
                </strong>
              </div>

              <div class="my-application-stat">
                <span>Committed</span>
                <strong>
                  ${esc(app.committed_hours_month ?? "—")} h/month
                </strong>
              </div>
            </div>

            <div class="contributor-update-actions">
              <button class="primary-button"
                      type="button"
                      data-submit-contributor-progress="${esc(app.metric_id)}">
                Submit Progress
              </button>
            </div>
          </div>
        </article>
      `;
    }).join("");

  els.myContributionList
    .querySelectorAll("[data-submit-contributor-progress]")
    .forEach(button => {
      button.addEventListener("click", () => {
        openContributorProgressModal(
          button.dataset.submitContributorProgress
        );
      });
    });
}

function setContributorProgressMessage(text, type = "") {
  els.contributorProgressMessage.textContent = text || "";
  els.contributorProgressMessage.className =
    `form-message ${type}`.trim();
}

function renderContributorProgressHistory(metricId) {
  const updates = contributorUpdatesForMetric(metricId);

  els.contributorProgressHistoryCount.textContent =
    updates.length;

  if (!updates.length) {
    els.contributorProgressHistory.innerHTML = `
      <div class="empty-owner-state">
        Belum ada contributor progress submission.
      </div>
    `;
    return;
  }

  els.contributorProgressHistory.innerHTML =
    updates.map(update => `
      <article class="history-row">
        <div class="history-row-top">
          <div>
            <strong>${esc(update.as_of_date || "—")}</strong>
            <span class="history-meta">
              Actual: ${esc(formatHistoryValue(update.actual))}
              · Progress:
              ${
                update.progress_pct === null ||
                update.progress_pct === undefined
                  ? "—"
                  : `${esc(update.progress_pct)}%`
              }
            </span>
          </div>

          <span class="badge ${esc(update.update_status)}">
            ${esc(update.update_status)}
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
          update.owner_review_note
            ? `<div class="history-note">
                 <strong>Owner:</strong>
                 ${esc(update.owner_review_note)}
               </div>`
            : ""
        }

        ${
          update.update_status === "accepted"
            ? `<div class="history-note">
                 Accepted as official Draft
                 ${
                   update.accepted_metric_update_id
                     ? `#${esc(update.accepted_metric_update_id)}`
                     : ""
                 }.
               </div>`
            : ""
        }
      </article>
    `).join("");
}

function openContributorProgressModal(metricId) {
  const contribution = contributionForMetric(metricId);

  if (!contribution) {
    window.alert(
      "Active contributor assignment untuk metric ini tidak ditemukan."
    );
    return;
  }

  state.selectedContributionMetricId = metricId;

  els.contributorProgressContext.innerHTML = `
    <strong>${esc(contribution.kpi_id)} · ${esc(contribution.kpi_title)}</strong><br>
    ${esc(contribution.metric_id)} · ${esc(contribution.metric_name)}<br>
    Assignment:
    <strong>
      ${esc(MODE_LABELS[contribution.assigned_contribution_mode] ||
        contribution.assigned_contribution_mode)}
    </strong>
  `;

  els.contributorProgressDate.value = localDateISO();
  els.contributorProgressActual.value = "";
  els.contributorProgressPct.value = "";
  els.contributorProgressEvidence.value = "";
  els.contributorProgressNote.value = "";

  setContributorProgressMessage("");
  renderContributorProgressHistory(metricId);

  els.contributorProgressModal.hidden = false;
}

async function submitContributorProgress() {
  const metricId = state.selectedContributionMetricId;

  if (!metricId) {
    throw new Error("Metric tidak ditemukan.");
  }

  const actualRaw =
    els.contributorProgressActual.value.trim();

  const progressRaw =
    els.contributorProgressPct.value.trim();

  if (!actualRaw && !progressRaw) {
    throw new Error(
      "Isi Actual atau Progress Estimate."
    );
  }

  const progress =
    progressRaw === "" ? null : Number(progressRaw);

  if (
    progress !== null &&
    (progress < 0 || progress > 100)
  ) {
    throw new Error("Progress Estimate harus 0–100.");
  }

  const { error } = await myMetricsSupabase.rpc(
    "submit_contributor_progress_update",
    {
      p_metric_id: metricId,
      p_as_of_date: els.contributorProgressDate.value,
      p_actual:
        actualRaw === "" ? null : Number(actualRaw),
      p_progress_pct: progress,
      p_public_evidence_url:
        els.contributorProgressEvidence.value.trim() || null,
      p_update_note:
        els.contributorProgressNote.value.trim() || null
    }
  );

  if (error) throw error;

  await loadMyContributorProgressUpdates();

  els.contributorProgressActual.value = "";
  els.contributorProgressPct.value = "";
  els.contributorProgressEvidence.value = "";
  els.contributorProgressNote.value = "";

  renderContributorProgressHistory(metricId);
  renderMyContributions();
}

function ownerContributorMetricRow() {
  return state.rows.find(
    row => row.metric_id === state.ownerContributorMetricId
  ) || null;
}

function filteredOwnerContributorUpdates() {
  const status = els.ownerContributorStatusFilter.value;

  return state.ownerContributorUpdates.filter(
    update => !status || update.update_status === status
  );
}

async function loadOwnerContributorUpdates(metricId) {
  const { data, error } = await myMetricsSupabase.rpc(
    "get_metric_contributor_progress_updates",
    { p_metric_id: metricId }
  );

  if (error) throw error;

  state.ownerContributorUpdates = data || [];
  renderOwnerContributorUpdates();
}

function renderOwnerContributorUpdates() {
  const updates = filteredOwnerContributorUpdates();

  els.ownerContributorUpdatesCount.textContent =
    updates.length;

  if (!updates.length) {
    els.ownerContributorUpdatesList.innerHTML = `
      <div class="empty-owner-state">
        Tidak ada contributor update untuk status ini.
      </div>
    `;
    return;
  }

  els.ownerContributorUpdatesList.innerHTML =
    updates.map(update => `
      <article class="contributor-update-card">
        <div class="contributor-update-top">
          <div>
            <h3>
              ${esc(update.contributor_name || update.contributor_email)}
            </h3>
            <div class="contributor-update-meta">
              ${esc(update.contributor_email)}
              · ${esc(MODE_LABELS[update.contribution_mode] ||
                update.contribution_mode)}
              · ${esc(update.committed_hours_month ?? "—")} h/month
            </div>
          </div>

          <span class="badge ${esc(update.update_status)}">
            ${esc(update.update_status)}
          </span>
        </div>

        <div class="contributor-update-grid">
          <div class="contributor-update-block">
            <span>As-of</span>
            <strong>${esc(update.as_of_date || "—")}</strong>
          </div>

          <div class="contributor-update-block">
            <span>Actual</span>
            <strong>${esc(formatHistoryValue(update.actual))}</strong>
          </div>

          <div class="contributor-update-block">
            <span>Progress</span>
            <strong>
              ${
                update.progress_pct === null ||
                update.progress_pct === undefined
                  ? "—"
                  : `${esc(update.progress_pct)}%`
              }
            </strong>
          </div>
        </div>

        ${
          update.update_note
            ? `<div class="contributor-update-note">
                 ${esc(update.update_note)}
               </div>`
            : ""
        }

        ${
          update.public_evidence_url
            ? `<div class="contributor-update-note">
                 <a class="text-link"
                    target="_blank"
                    rel="noopener noreferrer"
                    href="${esc(update.public_evidence_url)}">
                   View Evidence
                 </a>
               </div>`
            : ""
        }

        ${
          update.owner_review_note
            ? `<div class="owner-update-guidance">
                 <strong>Owner review:</strong>
                 ${esc(update.owner_review_note)}
               </div>`
            : ""
        }

        ${
          update.update_status === "pending"
            ? `
              <div class="contributor-update-review-actions">
                <button class="reject-button"
                        type="button"
                        data-review-contributor-update="${update.contributor_update_id}"
                        data-decision="reject">
                  Reject
                </button>

                <button class="primary-button"
                        type="button"
                        data-review-contributor-update="${update.contributor_update_id}"
                        data-decision="accept">
                  Accept as Draft
                </button>
              </div>
            `
            : update.update_status === "accepted"
              ? `<div class="owner-update-guidance">
                   Official Draft:
                   <strong>
                     #${esc(update.accepted_metric_update_id || "—")}
                   </strong>
                 </div>`
              : ""
        }
      </article>
    `).join("");

  els.ownerContributorUpdatesList
    .querySelectorAll("[data-review-contributor-update]")
    .forEach(button => {
      button.addEventListener("click", () => {
        openOwnerContributorReview(
          Number(button.dataset.reviewContributorUpdate),
          button.dataset.decision
        );
      });
    });
}

async function openOwnerContributorUpdates(metricId) {
  const row = state.rows.find(
    item => item.metric_id === metricId
  );

  if (!row) return;

  state.ownerContributorMetricId = metricId;
  state.ownerContributorUpdates = [];

  els.ownerContributorUpdatesContext.innerHTML = `
    <strong>${esc(row.kpi_id)} · ${esc(row.kpi_title)}</strong><br>
    ${esc(row.metric_id)} · ${esc(row.metric_name)}<br>
    Ownership:
    <strong>${esc(ownerRoleLabel(row.owner_role))}</strong>
  `;

  els.ownerContributorStatusFilter.value = "pending";

  els.ownerContributorUpdatesList.innerHTML = `
    <div class="empty-owner-state">
      Memuat contributor updates…
    </div>
  `;

  els.ownerContributorUpdatesModal.hidden = false;

  await loadOwnerContributorUpdates(metricId);
}

function currentOwnerContributorUpdate() {
  return state.ownerContributorUpdates.find(
    update =>
      Number(update.contributor_update_id) ===
      Number(state.ownerContributorReviewId)
  ) || null;
}

function setOwnerContributorReviewMessage(text, type = "") {
  els.ownerContributorReviewMessage.textContent =
    text || "";

  els.ownerContributorReviewMessage.className =
    `form-message ${type}`.trim();
}

function openOwnerContributorReview(updateId, decision) {
  const update = state.ownerContributorUpdates.find(
    item =>
      Number(item.contributor_update_id) ===
      Number(updateId)
  );

  const row = ownerContributorMetricRow();

  if (!update || !row) return;

  state.ownerContributorReviewId = updateId;
  state.ownerContributorReviewDecision = decision;

  const accept = decision === "accept";

  els.ownerContributorReviewEyebrow.textContent =
    accept
      ? "ACCEPT CONTRIBUTOR UPDATE"
      : "REJECT CONTRIBUTOR UPDATE";

  els.ownerContributorReviewTitle.textContent =
    update.contributor_name || update.contributor_email;

  els.ownerContributorReviewContext.innerHTML = `
    <strong>${esc(row.metric_id)} · ${esc(row.metric_name)}</strong><br>
    Proposed by ${esc(update.contributor_email)}
  `;

  els.ownerContributorAcceptFields.hidden = !accept;

  els.ownerContributorDate.value =
    update.as_of_date || localDateISO();

  els.ownerContributorActual.value =
    update.actual ?? "";

  els.ownerContributorPct.value =
    update.progress_pct ?? "";

  els.ownerContributorEvidence.value =
    update.public_evidence_url || "";

  els.ownerContributorNote.value =
    update.update_note || "";

  els.ownerContributorReviewNote.value = "";

  els.ownerContributorReviewSubmit.textContent =
    accept
      ? "Accept as Draft"
      : "Reject Update";

  setOwnerContributorReviewMessage("");
  els.ownerContributorReviewModal.hidden = false;
}

async function submitOwnerContributorReview() {
  const update = currentOwnerContributorUpdate();

  if (!update) {
    throw new Error("Contributor update tidak ditemukan.");
  }

  const accept =
    state.ownerContributorReviewDecision === "accept";

  const actualRaw =
    els.ownerContributorActual.value.trim();

  const progressRaw =
    els.ownerContributorPct.value.trim();

  if (
    accept &&
    !actualRaw &&
    !progressRaw
  ) {
    throw new Error(
      "Isi Actual atau Progress sebelum Accept."
    );
  }

  const { error } = await myMetricsSupabase.rpc(
    "review_contributor_progress_update",
    {
      p_contributor_update_id:
        update.contributor_update_id,
      p_decision:
        state.ownerContributorReviewDecision,
      p_as_of_date:
        accept ? els.ownerContributorDate.value : update.as_of_date,
      p_actual:
        accept
          ? (actualRaw === "" ? null : Number(actualRaw))
          : update.actual,
      p_progress_pct:
        accept
          ? (progressRaw === "" ? null : Number(progressRaw))
          : update.progress_pct,
      p_public_evidence_url:
        accept
          ? (els.ownerContributorEvidence.value.trim() || null)
          : update.public_evidence_url,
      p_update_note:
        accept
          ? (els.ownerContributorNote.value.trim() || null)
          : update.update_note,
      p_owner_review_note:
        els.ownerContributorReviewNote.value.trim() || null
    }
  );

  if (error) throw error;

  els.ownerContributorReviewModal.hidden = true;
  state.ownerContributorReviewId = null;
  state.ownerContributorReviewDecision = null;

  const metricId = state.ownerContributorMetricId;

  await Promise.all([
    loadOwnerContributorUpdates(metricId),
    loadPendingContributorUpdateCounts(),
    loadMyContributorProgressUpdates()
  ]);

  renderRows();
  renderMyContributions();
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


function setSkillsMessage(text,type=""){
  els.skillsMessage.textContent=text||"";
  els.skillsMessage.className=`form-message ${type}`.trim();
}
function currentSkillMap(row){
  const map=new Map();
  (Array.isArray(row.skills)?row.skills:[]).forEach(skill=>{
    map.set(Number(skill.skill_id),skill.requirement_level);
  });
  return map;
}
function collectSkillSelections(){
  const required=[],preferred=[];
  els.skillsTree.querySelectorAll("[data-skill-requirement]").forEach(select=>{
    const id=Number(select.dataset.skillRequirement);
    if(select.value==="required")required.push(id);
    if(select.value==="preferred")preferred.push(id);
  });
  return {required,preferred};
}
function updateSkillSelectionCounts(){
  const selected=collectSkillSelections();
  els.requiredSkillCount.textContent=`${selected.required.length} Required`;
  els.preferredSkillCount.textContent=`${selected.preferred.length} Preferred`;
}
function renderSkillsTree(row){
  const q=els.skillsSearch.value.trim().toLowerCase();
  const current=currentSkillMap(row);
  const byFamily=new Map();

  state.skillCatalog
    .filter(skill=>!q||skill.skill_name.toLowerCase().includes(q)||skill.skill_family.toLowerCase().includes(q))
    .forEach(skill=>{
      if(!byFamily.has(skill.skill_family))byFamily.set(skill.skill_family,[]);
      byFamily.get(skill.skill_family).push(skill);
    });

  if(!byFamily.size){
    els.skillsTree.innerHTML=`<div class="empty-owner-state">Skill tidak ditemukan.</div>`;
    updateSkillSelectionCounts();
    return;
  }

  els.skillsTree.innerHTML=[...byFamily.entries()].map(([family,skills])=>{
    const selectedCount=skills.filter(skill=>current.has(Number(skill.id))).length;
    return `
      <details class="skills-family" ${selectedCount||q?"open":""}>
        <summary>
          <span>${esc(family)}</span>
          <span class="skills-family-count">${selectedCount}/${skills.length} selected</span>
        </summary>
        <div class="skills-family-body">
          ${skills.map(skill=>`
            <label class="skill-manage-row">
              <span class="skill-name">${esc(skill.skill_name)}</span>
              <select data-skill-requirement="${skill.id}">
                <option value="" ${!current.has(Number(skill.id))?"selected":""}>None</option>
                <option value="preferred" ${current.get(Number(skill.id))==="preferred"?"selected":""}>Preferred</option>
                <option value="required" ${current.get(Number(skill.id))==="required"?"selected":""}>Required</option>
              </select>
            </label>
          `).join("")}
        </div>
      </details>`;
  }).join("");

  els.skillsTree.querySelectorAll("[data-skill-requirement]").forEach(select=>{
    select.addEventListener("change",updateSkillSelectionCounts);
  });
  updateSkillSelectionCounts();
}
function openSkillsModal(metricId){
  const row=state.rows.find(item=>item.metric_id===metricId);
  if(!row)return;
  state.selectedMetricId=metricId;
  els.skillsModalTitle.textContent="Manage Skill Requirements";
  els.skillsModalContext.innerHTML=`
    <strong>${esc(row.kpi_id)} · ${esc(row.kpi_title)}</strong><br>
    ${esc(row.metric_id)} · ${esc(row.metric_name)}<br>
    Ownership: <strong>${esc(ownerRoleLabel(row.owner_role))}</strong>
  `;
  els.skillsSearch.value="";
  setSkillsMessage("");
  renderSkillsTree(row);
  els.skillsModal.hidden=false;
}
async function saveMetricSkills(){
  const row=selectedMetricRow();
  if(!row)throw new Error("Metric tidak ditemukan.");
  const selected=collectSkillSelections();

  const {error}=await myMetricsSupabase.rpc("save_owner_metric_skills",{
    p_metric_id:row.metric_id,
    p_required_skill_ids:selected.required,
    p_preferred_skill_ids:selected.preferred
  });
  if(error)throw error;

  await loadWorkspace();
  const refreshed=selectedMetricRow();
  if(refreshed)renderSkillsTree(refreshed);
  renderSummary();
  renderRows();
}



function setSkillRequestMessage(text,type=""){
  els.skillRequestMessage.textContent=text||"";
  els.skillRequestMessage.className=
    `form-message ${type}`.trim();
}

function uniqueSkillFamilies(){
  return [...new Set(
    state.skillCatalog
      .map(skill=>skill.skill_family)
      .filter(Boolean)
  )].sort((a,b)=>a.localeCompare(b,"id"));
}

function populateSkillRequestFamilies(){
  const families=uniqueSkillFamilies();

  els.skillRequestFamilySelect.innerHTML=
    families.map(family=>`
      <option value="${esc(family)}">
        ${esc(family)}
      </option>
    `).join("");
}

function updateSkillRequestType(){
  const newFamily=
    els.skillRequestType.value==="new_family_skill";

  els.existingFamilyField.hidden=newFamily;
  els.newFamilyField.hidden=!newFamily;
}

async function loadMetricSkillRequests(metricId){
  const {data,error}=await myMetricsSupabase.rpc(
    "get_my_metric_skill_requests",
    {p_metric_id:metricId}
  );

  if(error)throw error;

  state.skillRequests=data||[];
  renderSkillRequestHistory();
}

function renderSkillRequestHistory(){
  els.skillRequestCount.textContent=state.skillRequests.length;

  if(!state.skillRequests.length){
    els.skillRequestList.innerHTML=`
      <div class="empty-owner-state">
        Belum ada taxonomy request untuk metric ini.
      </div>
    `;
    return;
  }

  els.skillRequestList.innerHTML=
    state.skillRequests.map(request=>`
      <article class="skill-request-row">
        <div class="skill-request-row-top">
          <div>
            <strong>
              ${esc(request.proposed_skill_family)}
              · ${esc(request.proposed_skill_name)}
            </strong>

            <div class="request-meta">
              ${
                request.request_type==="new_family_skill"
                  ? "New Talent Pool + Skill"
                  : "New Skill"
              }
              · ${esc(request.requirement_level)}
              · ${esc(request.requested_by_email)}
            </div>
          </div>

          <span class="badge ${esc(request.request_status)}">
            ${esc(request.request_status)}
          </span>
        </div>

        ${
          request.rationale
            ? `<div class="request-note">
                 ${esc(request.rationale)}
               </div>`
            : ""
        }

        ${
          request.resolved_skill_name
            ? `<div class="request-note">
                 Resolved to:
                 <strong>${esc(request.resolved_skill_name)}</strong>
               </div>`
            : ""
        }

        ${
          request.admin_note
            ? `<div class="request-note">
                 Admin: ${esc(request.admin_note)}
               </div>`
            : ""
        }
      </article>
    `).join("");
}

async function openSkillRequestModal(){
  const row=selectedMetricRow();
  if(!row)return;

  els.skillRequestContext.innerHTML=`
    <strong>${esc(row.kpi_id)} · ${esc(row.kpi_title)}</strong><br>
    ${esc(row.metric_id)} · ${esc(row.metric_name)}<br>
    Ownership: <strong>${esc(ownerRoleLabel(row.owner_role))}</strong>
  `;

  els.skillRequestType.value="new_skill";
  els.skillRequestLevel.value="required";
  els.skillRequestFamilyInput.value="";
  els.skillRequestName.value="";
  els.skillRequestDescription.value="";
  els.skillRequestRationale.value="";

  populateSkillRequestFamilies();
  updateSkillRequestType();
  setSkillRequestMessage("");

  els.skillRequestList.innerHTML=`
    <div class="empty-owner-state">
      Memuat request history…
    </div>
  `;

  els.skillRequestModal.hidden=false;

  try{
    await loadMetricSkillRequests(row.metric_id);
  }catch(error){
    console.error(error);
    els.skillRequestList.innerHTML=`
      <div class="empty-owner-state">
        Gagal memuat request history:
        ${esc(error.message)}
      </div>
    `;
  }
}

async function submitSkillRequest(){
  const row=selectedMetricRow();
  if(!row)throw new Error("Metric tidak ditemukan.");

  const requestType=els.skillRequestType.value;

  const family=requestType==="new_family_skill"
    ? els.skillRequestFamilyInput.value.trim()
    : els.skillRequestFamilySelect.value;

  const name=els.skillRequestName.value.trim();

  if(!family||!name){
    throw new Error("Talent Pool dan Skill Name wajib diisi.");
  }

  const {error}=await myMetricsSupabase.rpc(
    "submit_metric_skill_request",
    {
      p_metric_id:row.metric_id,
      p_request_type:requestType,
      p_skill_family:family,
      p_skill_name:name,
      p_description:
        els.skillRequestDescription.value.trim()||null,
      p_requirement_level:
        els.skillRequestLevel.value,
      p_rationale:
        els.skillRequestRationale.value.trim()||null
    }
  );

  if(error)throw error;

  els.skillRequestName.value="";
  els.skillRequestDescription.value="";
  els.skillRequestRationale.value="";

  await loadMetricSkillRequests(row.metric_id);
}

function setOpportunityMessage(text,type=""){
  els.opportunityMessage.textContent=text||"";
  els.opportunityMessage.className=`form-message ${type}`.trim();
}

function collectOpportunityModes(){
  const modes=[];
  if(els.opportunityModeAdvisor.checked)modes.push("advisor_sme");
  if(els.opportunityModeOperational.checked)modes.push("operational_execution");
  if(els.opportunityModeLead.checked)modes.push("project_lead");
  return modes;
}

function setOpportunityModes(modes){
  const selected=Array.isArray(modes)?modes:[];
  els.opportunityModeAdvisor.checked=selected.includes("advisor_sme");
  els.opportunityModeOperational.checked=selected.includes("operational_execution");
  els.opportunityModeLead.checked=selected.includes("project_lead");
}

function updateOpportunityStatusGuidance(){
  const status=els.opportunityStatus.value;
  const detail=state.opportunityDetail;

  if(status==="open"){
    els.opportunityStatusGuidance.innerHTML=`
      Opportunity ini sedang <strong>Open</strong>.
      Save akan mempertahankan status live. Untuk opportunity yang
      belum Open, publishing tetap dilakukan melalui Publish & Share.
    `;
    return;
  }

  if(detail?.opportunity_status==="open" && status!=="open"){
    els.opportunityStatusGuidance.innerHTML=`
      Mengubah status dari <strong>Open</strong> menjadi
      <strong>${esc(status)}</strong> akan menghentikan penerimaan
      applicant publik sesuai status baru.
    `;
    return;
  }

  els.opportunityStatusGuidance.innerHTML=`
    Simpan detail sebagai <strong>${esc(status)}</strong>.
    Membuka lowongan baru ke publik dilakukan melalui
    <strong>Publish & Share</strong> pada tahap berikutnya.
  `;
}

async function loadOpportunityDetail(metricId){
  const {data,error}=await myMetricsSupabase.rpc(
    "get_owner_metric_opportunity",
    {p_metric_id:metricId}
  );
  if(error)throw error;
  return Array.isArray(data)&&data.length?data[0]:null;
}

async function openOpportunityModal(metricId){
  const row=state.rows.find(item=>item.metric_id===metricId);
  if(!row)return;

  state.selectedMetricId=metricId;
  setOpportunityMessage("");

  els.opportunityModalTitle.textContent="Manage Opportunity";
  els.opportunityModalContext.innerHTML=`
    <strong>${esc(row.kpi_id)} · ${esc(row.kpi_title)}</strong><br>
    ${esc(row.metric_id)} · ${esc(row.metric_name)}<br>
    Ownership: <strong>${esc(ownerRoleLabel(row.owner_role))}</strong>
  `;

  state.opportunityDetail=await loadOpportunityDetail(metricId);
  const detail=state.opportunityDetail;

  els.opportunityStatus.value=detail?.opportunity_status||"draft";
  els.opportunitySlots.value=detail?.volunteer_slots??"";
  els.opportunityTitle.value=
    detail?.opportunity_title||row.metric_name||"";
  els.opportunityDescription.value=
    detail?.short_description||row.metric_description||"";
  els.opportunityMinHours.value=detail?.min_hours_month??"";
  els.opportunityMaxHours.value=detail?.max_hours_month??"";
  els.opportunityPublicNote.value=detail?.public_note||"";
  els.opportunityOwnerNote.value=detail?.owner_note||"";
  setOpportunityModes(
    detail?.contribution_modes || row.contribution_modes || []
  );

  // A non-open opportunity cannot be changed to Open in 5C.4D.3.
  const openOption=els.opportunityStatus.querySelector('option[value="open"]');
  if(openOption){
    openOption.disabled=detail?.opportunity_status!=="open";
  }

  updateOpportunityStatusGuidance();
  els.opportunityModal.hidden=false;
}

async function saveMetricOpportunity(){
  const row=selectedMetricRow();
  if(!row)throw new Error("Metric tidak ditemukan.");

  const minRaw=els.opportunityMinHours.value.trim();
  const maxRaw=els.opportunityMaxHours.value.trim();
  const slotsRaw=els.opportunitySlots.value.trim();

  const {data,error}=await myMetricsSupabase.rpc(
    "save_owner_metric_opportunity",
    {
      p_metric_id:row.metric_id,
      p_status:els.opportunityStatus.value,
      p_opportunity_title:els.opportunityTitle.value.trim(),
      p_short_description:
        els.opportunityDescription.value.trim()||null,
      p_min_hours_month:minRaw===""?null:Number(minRaw),
      p_max_hours_month:maxRaw===""?null:Number(maxRaw),
      p_volunteer_slots:slotsRaw===""?null:Number(slotsRaw),
      p_public_note:els.opportunityPublicNote.value.trim()||null,
      p_owner_note:els.opportunityOwnerNote.value.trim()||null,
      p_contribution_modes:collectOpportunityModes()
    }
  );

  if(error)throw error;

  await loadWorkspace();
  state.opportunityDetail=await loadOpportunityDetail(row.metric_id);
  renderSummary();
  renderRows();

  return data;
}


function setShareMessage(text,type=""){
  els.shareMessage.textContent=text||"";
  els.shareMessage.className=`form-message ${type}`.trim();
}

function normalizeShareParam(value){
  return String(value||"")
    .trim()
    .toLowerCase()
    .replace(/\s+/g,"-")
    .replace(/[^a-z0-9._-]/g,"")
    .slice(0,80);
}

function shareMetricRow(){
  return state.rows.find(
    row=>row.metric_id===state.shareMetricId
  )||null;
}

function buildOwnerShareUrl(){
  const row=shareMetricRow();
  if(!row||!row.opportunity_id)return "";

  const url=new URL("opportunities.html",window.location.href);
  url.searchParams.set("mode","kpi");
  url.searchParams.set("opportunity",String(row.opportunity_id));

  const mode=els.shareContributionMode.value;
  const source=normalizeShareParam(els.shareSource.value);
  const campaign=normalizeShareParam(els.shareCampaign.value);

  if(mode)url.searchParams.set("contribution_mode",mode);
  if(source)url.searchParams.set("source",source);
  if(campaign)url.searchParams.set("campaign",campaign);

  return url.toString();
}

function refreshOwnerShareUrl(){
  els.shareLink.value=buildOwnerShareUrl();
}

async function copyOwnerShareUrl(){
  const value=els.shareLink.value;
  if(!value)throw new Error("Link belum tersedia.");

  if(navigator.clipboard?.writeText){
    await navigator.clipboard.writeText(value);
    return;
  }

  const textarea=document.createElement("textarea");
  textarea.value=value;
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

function renderShareModeOptions(row){
  const modes=Array.isArray(row.contribution_modes)
    ? row.contribution_modes
    : [];

  els.shareContributionMode.innerHTML=
    `<option value="">Semua allowed mode</option>`+
    modes.map(mode=>`
      <option value="${esc(mode)}">
        ${esc(MODE_LABELS[mode]||mode)}
      </option>
    `).join("");
}

function openOwnerShareModal(metricId){
  const row=state.rows.find(item=>item.metric_id===metricId);
  if(!row)return;

  if(!row.opportunity_id){
    window.alert("Buat dan simpan Volunteer Opportunity terlebih dahulu.");
    return;
  }

  state.shareMetricId=metricId;

  els.shareModalTitle.textContent=
    row.opportunity_status==="open"
      ? "Share Opportunity"
      : row.opportunity_status==="paused"
        ? "Resume & Share Opportunity"
        : "Publish & Share Opportunity";

  els.shareModalContext.innerHTML=`
    <strong>${esc(row.kpi_id)} · ${esc(row.kpi_title)}</strong><br>
    ${esc(row.metric_id)} · ${esc(row.opportunity_title||row.metric_name)}<br>
    Current status: <strong>${esc(row.opportunity_status||"draft")}</strong>
  `;

  renderShareModeOptions(row);
  els.shareSource.value="";
  els.shareCampaign.value="";

  const blocked=["closed","filled"].includes(row.opportunity_status);

  els.publishShareButton.disabled=blocked;

  els.publishShareButton.textContent=
    row.opportunity_status==="open"
      ? "Copy Link"
      : row.opportunity_status==="paused"
        ? "Resume & Copy"
        : "Publish & Copy";

  setShareMessage(
    blocked
      ? "Closed / Filled opportunity tidak dapat dipublish kembali."
      : ""
  );

  refreshOwnerShareUrl();
  els.shareModal.hidden=false;
}

async function publishAndCopyOwnerOpportunity(){
  let row=shareMetricRow();
  if(!row)throw new Error("Metric tidak ditemukan.");

  if(["closed","filled"].includes(row.opportunity_status)){
    throw new Error(
      "Closed / Filled opportunity tidak dapat dipublish kembali."
    );
  }

  if(row.opportunity_status!=="open"){
    const {error}=await myMetricsSupabase.rpc(
      "publish_owner_metric_opportunity",
      {p_metric_id:row.metric_id}
    );
    if(error)throw error;

    await loadWorkspace();
    renderSummary();
    renderRows();

    row=shareMetricRow();

    if(!row||row.opportunity_status!=="open"){
      throw new Error(
        "Opportunity published but refreshed Open status was not found."
      );
    }
  }

  refreshOwnerShareUrl();
  await copyOwnerShareUrl();

  setShareMessage(
    "Opportunity sudah Open dan link berhasil dicopy.",
    "success"
  );
}


function applicationsMetricRow(){
  return state.rows.find(
    row=>row.metric_id===state.applicationsMetricId
  )||null;
}

function currentApplication(){
  return state.applications.find(
    app=>Number(app.application_id)===Number(state.reviewApplicationId)
  )||null;
}

function setApplicationReviewMessage(text,type=""){
  els.applicationReviewMessage.textContent=text||"";
  els.applicationReviewMessage.className=
    `form-message ${type}`.trim();
}

async function loadMetricApplications(metricId){
  const {data,error}=await myMetricsSupabase.rpc(
    "get_my_metric_applications",
    {p_metric_id:metricId}
  );

  if(error)throw error;

  state.applications=data||[];
  renderApplications();
}

function applicationSkillTags(skills){
  if(!Array.isArray(skills)||!skills.length){
    return `<span class="muted">No saved skills</span>`;
  }

  return skills.map(skill=>`
    <span class="tag">${esc(skill.skill_name)}</span>
  `).join("");
}

function applicationModeTags(modes){
  if(!Array.isArray(modes)||!modes.length){
    return `<span class="muted">No preference</span>`;
  }

  return modes.map(mode=>`
    <span class="tag">${esc(MODE_LABELS[mode]||mode)}</span>
  `).join("");
}

function filteredApplications(){
  const status=els.applicationsStatusFilter.value;

  return state.applications.filter(app=>
    !status||app.application_status===status
  );
}

function renderApplications(){
  const row=applicationsMetricRow();
  const apps=filteredApplications();

  els.applicationsCount.textContent=apps.length;

  if(!apps.length){
    els.applicationsList.innerHTML=`
      <div class="empty-owner-state">
        Tidak ada application untuk status ini.
      </div>
    `;
    return;
  }

  const canFinalApprove=
    row?.owner_role==="primary_owner";

  els.applicationsList.innerHTML=apps.map(app=>`
    <article class="owner-application-card">
      <div class="owner-application-top">
        <div>
          <h3>${esc(app.volunteer_name||app.volunteer_email)}</h3>
          <p class="owner-application-email">
            ${esc(app.volunteer_email)}
          </p>
        </div>

        <div class="badge-row">
          <span class="badge ${esc(app.application_status)}">
            ${esc(app.application_status)}
          </span>

          ${
            app.application_source
              ? `<span class="badge">${esc(app.application_source)}</span>`
              : ""
          }

          ${
            app.campaign
              ? `<span class="badge">${esc(app.campaign)}</span>`
              : ""
          }
        </div>
      </div>

      <div class="owner-application-grid">
        <div class="owner-application-section">
          <strong>Applied As</strong>
          <p>
            ${esc(MODE_LABELS[app.contribution_mode]||app.contribution_mode)}
            · ${esc(app.offered_hours_month)} h/month
          </p>
        </div>

        <div class="owner-application-section">
          <strong>Profile Capacity</strong>
          <p>
            ${esc(app.available_hours_month??"—")} h/month
            ${
              app.current_organization
                ? ` · ${esc(app.current_organization)}`
                : ""
            }
          </p>
        </div>

        <div class="owner-application-section">
          <strong>Background</strong>
          <p>${esc(app.professional_background||"—")}</p>
        </div>

        <div class="owner-application-section">
          <strong>Motivation</strong>
          <p>${esc(app.motivation||"—")}</p>
        </div>

        <div class="owner-application-section">
          <strong>Skills</strong>
          <div class="tag-row">
            ${applicationSkillTags(app.volunteer_skills)}
          </div>
        </div>

        <div class="owner-application-section">
          <strong>Preferred Modes</strong>
          <div class="tag-row">
            ${applicationModeTags(app.volunteer_modes)}
          </div>
        </div>
      </div>

      ${
        app.review_note
          ? `<div class="owner-update-guidance">
               <strong>Review:</strong>
               ${esc(app.review_note)}
               ${
                 app.reviewed_by
                   ? `<br><small>${esc(app.reviewed_by)}</small>`
                   : ""
               }
             </div>`
          : ""
      }

      ${
        app.application_status==="pending"
          ? canFinalApprove
            ? `
              <div class="owner-application-actions">
                <button class="reject-button"
                        type="button"
                        data-owner-review="${app.application_id}"
                        data-decision="rejected">
                  Reject
                </button>

                <button class="primary-button"
                        type="button"
                        data-owner-review="${app.application_id}"
                        data-decision="approved">
                  Approve & Assign
                </button>
              </div>
            `
            : `
              <div class="supporting-owner-note">
                Supporting Owner dapat melihat applicant,
                tetapi keputusan final dilakukan oleh Primary Owner.
              </div>
            `
          : ""
      }
    </article>
  `).join("");

  els.applicationsList
    .querySelectorAll("[data-owner-review]")
    .forEach(button=>{
      button.addEventListener("click",()=>{
        openApplicationReview(
          Number(button.dataset.ownerReview),
          button.dataset.decision
        );
      });
    });
}

async function openApplicationsModal(metricId){
  const row=state.rows.find(
    item=>item.metric_id===metricId
  );

  if(!row)return;

  state.applicationsMetricId=metricId;
  state.applications=[];

  els.applicationsModalTitle.textContent=
    row.owner_role==="primary_owner"
      ? "Review Applicants"
      : "Volunteer Applicants";

  els.applicationsModalContext.innerHTML=`
    <strong>${esc(row.kpi_id)} · ${esc(row.kpi_title)}</strong><br>
    ${esc(row.metric_id)} · ${esc(row.metric_name)}<br>
    Ownership:
    <strong>${esc(ownerRoleLabel(row.owner_role))}</strong>
  `;

  els.applicationsStatusFilter.value="pending";
  els.applicationsList.innerHTML=`
    <div class="empty-owner-state">
      Memuat applications…
    </div>
  `;

  els.applicationsModal.hidden=false;

  await loadMetricApplications(metricId);
}

function openApplicationReview(applicationId,decision){
  const app=state.applications.find(
    item=>Number(item.application_id)===Number(applicationId)
  );

  const row=applicationsMetricRow();

  if(!app||!row)return;

  if(row.owner_role!=="primary_owner"){
    window.alert(
      "Only the Primary Metric Owner can make the final decision."
    );
    return;
  }

  state.reviewApplicationId=applicationId;
  state.reviewDecision=decision;

  const approve=decision==="approved";

  els.applicationReviewEyebrow.textContent=
    approve?"APPROVE & ASSIGN":"REJECT APPLICATION";

  els.applicationReviewTitle.textContent=
    app.volunteer_name||app.volunteer_email;

  els.applicationReviewContext.innerHTML=`
    <strong>${esc(row.kpi_id)} · ${esc(row.metric_name)}</strong><br>
    Applicant offered:
    ${esc(MODE_LABELS[app.contribution_mode]||app.contribution_mode)}
    · ${esc(app.offered_hours_month)} h/month
  `;

  els.applicationApprovalFields.hidden=!approve;

  const allowed=Array.isArray(app.allowed_modes)
    ? app.allowed_modes
    : [];

  els.applicationReviewMode.innerHTML=
    allowed.map(mode=>`
      <option value="${esc(mode)}">
        ${esc(MODE_LABELS[mode]||mode)}
      </option>
    `).join("");

  if(allowed.includes(app.contribution_mode)){
    els.applicationReviewMode.value=app.contribution_mode;
  }

  els.applicationReviewHours.value=
    app.offered_hours_month||"";

  els.applicationReviewNote.value="";

  els.applicationReviewSubmit.textContent=
    approve?"Approve & Assign":"Reject Application";

  setApplicationReviewMessage("");
  els.applicationReviewModal.hidden=false;
}

async function submitApplicationReview(){
  const app=currentApplication();
  const row=applicationsMetricRow();

  if(!app||!row){
    throw new Error("Application tidak ditemukan.");
  }

  if(row.owner_role!=="primary_owner"){
    throw new Error(
      "Only the Primary Metric Owner can make the final decision."
    );
  }

  const approve=state.reviewDecision==="approved";

  if(
    approve &&
    (!els.applicationReviewMode.value ||
     Number(els.applicationReviewHours.value)<=0)
  ){
    throw new Error(
      "Contribution mode dan committed hours wajib diisi."
    );
  }

  const {error}=await myMetricsSupabase.rpc(
    "review_volunteer_application",
    {
      p_application_id:app.application_id,
      p_decision:state.reviewDecision,
      p_contribution_mode:
        approve?els.applicationReviewMode.value:null,
      p_committed_hours:
        approve?Number(els.applicationReviewHours.value):null,
      p_review_note:
        els.applicationReviewNote.value.trim()||null
    }
  );

  if(error)throw error;

  els.applicationReviewModal.hidden=true;
  state.reviewApplicationId=null;
  state.reviewDecision=null;

  await Promise.all([
    loadMetricApplications(row.metric_id),
    loadWorkspace(),
    loadVolunteerSummary(),
    loadMyApplications(),
    loadMyContributorProgressUpdates(),
    loadPendingContributorUpdateCounts()
  ]);

  renderSummary();
  renderMyApplications();
  renderMyContributions();
  renderRows();
}

function renderRows() {
  const rows = filteredRows();

  els.resultCount.textContent =
    `${rows.length} metric${rows.length === 1 ? "" : "s"}`;

  // Pure volunteers do not need an empty owner-state card.
  // Owner workspace itself is role/capability-aware in renderSummary().
  els.emptyOwnerState.hidden = true;

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
            Progress update masuk sebagai Draft dan tetap memerlukan verification.
          </span>

          ${
            row.opportunity_id &&
            row.opportunity_status === "open"
              ? `<a class="secondary-button metric-action-button"
                    href="opportunities.html?mode=kpi&opportunity=${encodeURIComponent(row.opportunity_id)}">
                   Public Opportunity
                 </a>`
              : ""
          }

          <button class="secondary-button metric-action-button"
                  type="button"
                  data-contributor-updates="${esc(row.metric_id)}">
            Contributor Updates
            ${
              Number(state.pendingContributorUpdateCounts[row.metric_id] || 0) > 0
                ? `<span class="application-count-badge">
                     ${Number(state.pendingContributorUpdateCounts[row.metric_id] || 0)}
                   </span>`
                : ""
            }
          </button>

          <button class="secondary-button metric-action-button"
                  type="button"
                  data-review-applications="${esc(row.metric_id)}">
            ${
              row.owner_role === "primary_owner"
                ? "Review Applicants"
                : "View Applicants"
            }
            ${
              Number(row.pending_applications||0)>0
                ? `<span class="application-count-badge">
                     ${Number(row.pending_applications||0)}
                   </span>`
                : ""
            }
          </button>

          <button class="secondary-button metric-action-button"
                  type="button"
                  data-share-opportunity="${esc(row.metric_id)}"
                  ${
                    !row.opportunity_id ||
                    ["closed","filled"].includes(row.opportunity_status)
                      ? "disabled"
                      : ""
                  }>
            ${
              row.opportunity_status === "open"
                ? "Share Opportunity"
                : row.opportunity_status === "paused"
                  ? "Resume & Share"
                  : "Publish & Share"
            }
          </button>

          <button class="secondary-button metric-action-button"
                  type="button"
                  data-manage-opportunity="${esc(row.metric_id)}">
            Manage Opportunity
          </button>

          <button class="secondary-button metric-action-button"
                  type="button"
                  data-manage-skills="${esc(row.metric_id)}">
            Manage Skills
          </button>

          <button class="primary-button metric-action-button"
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

  els.metricList
    .querySelectorAll("[data-manage-skills]")
    .forEach(button => {
      button.addEventListener("click", () => {
        openSkillsModal(button.dataset.manageSkills);
      });
    });

  els.metricList
    .querySelectorAll("[data-manage-opportunity]")
    .forEach(button => {
      button.addEventListener("click", async () => {
        try{
          await openOpportunityModal(
            button.dataset.manageOpportunity
          );
        }catch(error){
          console.error(error);
          window.alert(error.message);
        }
      });
    });

  els.metricList
    .querySelectorAll("[data-share-opportunity]")
    .forEach(button => {
      button.addEventListener("click", () => {
        if(button.disabled)return;
        openOwnerShareModal(button.dataset.shareOpportunity);
      });
    });

  els.metricList
    .querySelectorAll("[data-review-applications]")
    .forEach(button => {
      button.addEventListener("click", async () => {
        try{
          await openApplicationsModal(
            button.dataset.reviewApplications
          );
        }catch(error){
          console.error(error);
          window.alert(error.message);
        }
      });
    });

  els.metricList
    .querySelectorAll("[data-contributor-updates]")
    .forEach(button => {
      button.addEventListener("click", async () => {
        try{
          await openOwnerContributorUpdates(
            button.dataset.contributorUpdates
          );
        }catch(error){
          console.error(error);
          window.alert(error.message);
        }
      });
    });
}

function renderAll() {
  renderSession();
  renderSummary();
  renderMyApplications();
  renderMyContributions();
  renderRows();
}

async function enterWorkspace(session) {
  state.session = session;

  try {
    // Email-first ownership assignment becomes UID-bound here.
    await claimOwnership();
    await Promise.all([
      loadWorkspace(),
      loadSkillCatalog(),
      loadVolunteerSummary(),
      loadMyApplications(),
      loadMyContributorProgressUpdates(),
      loadPendingContributorUpdateCounts()
    ]);

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
  state.myApplications = [];
  state.volunteerSummary = null;
  state.contributorProgressUpdates = [];
  state.pendingContributorUpdateCounts = {};
  state.ownerContributorUpdates = [];

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


els.requestSkillButton.addEventListener(
  "click",
  openSkillRequestModal
);

els.skillRequestClose.addEventListener("click",()=>{
  els.skillRequestModal.hidden=true;
});

els.skillRequestModal.addEventListener("click",event=>{
  if(event.target===els.skillRequestModal){
    els.skillRequestModal.hidden=true;
  }
});

els.skillRequestType.addEventListener(
  "change",
  updateSkillRequestType
);

els.skillRequestForm.addEventListener(
  "submit",
  async event=>{
    event.preventDefault();

    try{
      setSkillRequestMessage("Submitting…");
      await submitSkillRequest();

      setSkillRequestMessage(
        "Request berhasil dikirim ke Admin Taxonomy Review.",
        "success"
      );
    }catch(error){
      console.error(error);
      setSkillRequestMessage(
        error.message,
        "error"
      );
    }
  }
);

els.skillsModalClose.addEventListener("click",()=>{els.skillsModal.hidden=true;});
els.skillsModal.addEventListener("click",event=>{if(event.target===els.skillsModal)els.skillsModal.hidden=true;});
els.skillsSearch.addEventListener("input",()=>{const row=selectedMetricRow();if(row)renderSkillsTree(row);});
els.saveSkillsButton.addEventListener("click",async()=>{
  try{
    setSkillsMessage("Saving…");
    await saveMetricSkills();
    setSkillsMessage("Skill requirements berhasil diperbarui.","success");
  }catch(error){
    console.error(error);
    setSkillsMessage(error.message,"error");
  }
});


els.opportunityModalClose.addEventListener("click",()=>{
  els.opportunityModal.hidden=true;
});

els.opportunityModal.addEventListener("click",event=>{
  if(event.target===els.opportunityModal){
    els.opportunityModal.hidden=true;
  }
});

els.opportunityStatus.addEventListener(
  "change",
  updateOpportunityStatusGuidance
);

els.opportunityForm.addEventListener("submit",async event=>{
  event.preventDefault();

  try{
    setOpportunityMessage("Saving…");
    await saveMetricOpportunity();
    setOpportunityMessage(
      "Opportunity berhasil disimpan.",
      "success"
    );
  }catch(error){
    console.error(error);
    setOpportunityMessage(error.message,"error");
  }
});


els.shareModalClose.addEventListener("click",()=>{
  els.shareModal.hidden=true;
});

els.shareModal.addEventListener("click",event=>{
  if(event.target===els.shareModal){
    els.shareModal.hidden=true;
  }
});

[
  els.shareContributionMode,
  els.shareSource,
  els.shareCampaign
].forEach(input=>{
  input.addEventListener(
    input.tagName==="SELECT"?"change":"input",
    refreshOwnerShareUrl
  );
});

els.publishShareButton.addEventListener("click",async()=>{
  try{
    setShareMessage("Publishing…");
    await publishAndCopyOwnerOpportunity();
  }catch(error){
    console.error(error);
    setShareMessage(error.message,"error");
  }
});


els.applicationsModalClose.addEventListener("click",()=>{
  els.applicationsModal.hidden=true;
});

els.applicationsModal.addEventListener("click",event=>{
  if(event.target===els.applicationsModal){
    els.applicationsModal.hidden=true;
  }
});

els.applicationsStatusFilter.addEventListener(
  "change",
  renderApplications
);

els.applicationReviewClose.addEventListener("click",()=>{
  els.applicationReviewModal.hidden=true;
});

els.applicationReviewModal.addEventListener("click",event=>{
  if(event.target===els.applicationReviewModal){
    els.applicationReviewModal.hidden=true;
  }
});

els.applicationReviewForm.addEventListener(
  "submit",
  async event=>{
    event.preventDefault();

    try{
      setApplicationReviewMessage("Processing…");
      await submitApplicationReview();
    }catch(error){
      console.error(error);
      setApplicationReviewMessage(
        error.message,
        "error"
      );
    }
  }
);


els.contributorProgressClose.addEventListener("click", () => {
  els.contributorProgressModal.hidden = true;
});

els.contributorProgressModal.addEventListener("click", event => {
  if (event.target === els.contributorProgressModal) {
    els.contributorProgressModal.hidden = true;
  }
});

els.contributorProgressForm.addEventListener(
  "submit",
  async event => {
    event.preventDefault();

    try {
      setContributorProgressMessage("Submitting…");
      await submitContributorProgress();

      setContributorProgressMessage(
        "Update terkirim ke Metric Owner.",
        "success"
      );
    } catch (error) {
      console.error(error);
      setContributorProgressMessage(
        error.message,
        "error"
      );
    }
  }
);

els.ownerContributorUpdatesClose.addEventListener(
  "click",
  () => {
    els.ownerContributorUpdatesModal.hidden = true;
  }
);

els.ownerContributorUpdatesModal.addEventListener(
  "click",
  event => {
    if (event.target === els.ownerContributorUpdatesModal) {
      els.ownerContributorUpdatesModal.hidden = true;
    }
  }
);

els.ownerContributorStatusFilter.addEventListener(
  "change",
  renderOwnerContributorUpdates
);

els.ownerContributorReviewClose.addEventListener(
  "click",
  () => {
    els.ownerContributorReviewModal.hidden = true;
  }
);

els.ownerContributorReviewModal.addEventListener(
  "click",
  event => {
    if (event.target === els.ownerContributorReviewModal) {
      els.ownerContributorReviewModal.hidden = true;
    }
  }
);

els.ownerContributorReviewForm.addEventListener(
  "submit",
  async event => {
    event.preventDefault();

    try {
      setOwnerContributorReviewMessage("Processing…");
      await submitOwnerContributorReview();
    } catch (error) {
      console.error(error);
      setOwnerContributorReviewMessage(
        error.message,
        "error"
      );
    }
  }
);

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
