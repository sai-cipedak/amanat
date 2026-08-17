const volunteerAdminSupabase = supabase.createClient(
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
  profile: null,
  skills: [],
  opportunities: [],
  applications: [],
  activeContributorCount: 0,
  selectedOpportunityId: null,
  reviewApplicationId: null,
  reviewDecision: null
};

const $ = id => document.getElementById(id);

const els = {
  loginPanel: $("login-panel"),
  googleLogin: $("google-login-button"),
  loginMessage: $("login-message"),
  adminApp: $("admin-app"),
  sessionControls: $("session-controls"),
  userName: $("user-name"),
  userRole: $("user-role"),
  logout: $("logout-button"),

  openCount: $("open-count"),
  inactiveCount: $("inactive-count"),
  pendingCount: $("pending-count"),
  contributorCount: $("contributor-count"),
  pendingTabBadge: $("pending-tab-badge"),

  tabOpportunities: $("tab-opportunities"),
  tabApplications: $("tab-applications"),
  opportunityPanel: $("opportunity-panel"),
  applicationPanel: $("application-panel"),

  opportunitySearch: $("opportunity-search"),
  opportunityCluster: $("opportunity-cluster-filter"),
  opportunityStatus: $("opportunity-status-filter"),
  opportunityResultCount: $("opportunity-result-count"),
  opportunityList: $("opportunity-list"),
  opportunityEditor: $("opportunity-editor"),
  opportunityForm: $("opportunity-form"),

  editorKpiId: $("editor-kpi-id"),
  editorMetricName: $("editor-metric-name"),
  editorKpiTitle: $("editor-kpi-title"),
  editorBadges: $("editor-badges"),
  editorStatus: $("editor-status"),
  editorSlots: $("editor-slots"),
  editorTitle: $("editor-title"),
  editorDescription: $("editor-description"),
  editorMinHours: $("editor-min-hours"),
  editorMaxHours: $("editor-max-hours"),
  editorModeAdvisor: $("editor-mode-advisor"),
  editorModeOperational: $("editor-mode-operational"),
  editorModeLead: $("editor-mode-lead"),
  editorSkillTree: $("editor-skill-tree"),
  editorPublicNote: $("editor-public-note"),
  editorOwnerNote: $("editor-owner-note"),
  opportunityMessage: $("opportunity-message"),
  shareOpportunityButton: $("share-opportunity-button"),
  shareModal: $("share-modal"),
  shareClose: $("share-close"),
  shareTitle: $("share-title"),
  shareContext: $("share-context"),
  shareMode: $("share-mode"),
  shareSource: $("share-source"),
  shareCampaign: $("share-campaign"),
  shareLink: $("share-link"),
  shareMessage: $("share-message"),
  copyShareLink: $("copy-share-link"),
  publishShareButton: $("publish-share-button"),

  applicationSearch: $("application-search"),
  applicationCluster: $("application-cluster-filter"),
  applicationStatus: $("application-status-filter"),
  applicationResultCount: $("application-result-count"),
  applicationList: $("application-list"),

  reviewModal: $("review-modal"),
  reviewClose: $("review-close"),
  reviewEyebrow: $("review-eyebrow"),
  reviewTitle: $("review-title"),
  reviewContext: $("review-context"),
  reviewForm: $("review-form"),
  approvalFields: $("approval-fields"),
  reviewMode: $("review-mode"),
  reviewHours: $("review-hours"),
  reviewNote: $("review-note"),
  reviewMessage: $("review-message"),
  reviewSubmit: $("review-submit")
};

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setMessage(el, text, type = "") {
  el.textContent = text || "";
  el.className = `form-message ${type}`.trim();
}

function selectedOpportunity() {
  return state.opportunities.find(
    row => Number(row.opportunity_id) === Number(state.selectedOpportunityId)
  ) || null;
}

async function signInWithGoogle() {
  const redirectTo = `${window.location.origin}${window.location.pathname}`;

  const { error } = await volunteerAdminSupabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo }
  });

  if (error) throw error;
}

async function resolveProfile(session) {
  if (!session?.user?.email) return null;

  const { data, error } = await volunteerAdminSupabase
    .from("admin_users")
    .select("email,display_name,role,is_active")
    .eq("email", session.user.email)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function loadSkills() {
  const { data, error } = await volunteerAdminSupabase
    .from("skill_catalog")
    .select("id,skill_family,skill_name,sort_order")
    .eq("is_active", true)
    .order("skill_family")
    .order("sort_order")
    .order("skill_name");

  if (error) throw error;
  state.skills = data || [];
}

async function loadOpportunities() {
  const { data, error } = await volunteerAdminSupabase
    .rpc("get_admin_volunteer_opportunities");

  if (error) throw error;
  state.opportunities = data || [];
}

async function loadApplications() {
  const { data, error } = await volunteerAdminSupabase
    .rpc("get_admin_volunteer_applications");

  if (error) throw error;
  state.applications = data || [];
}

async function loadContributorCount() {
  const { count, error } = await volunteerAdminSupabase
    .from("metric_contributors")
    .select("id", { count: "exact", head: true })
    .eq("assignment_status", "active");

  if (error) throw error;
  state.activeContributorCount = count || 0;
}

async function reloadData() {
  await Promise.all([
    loadSkills(),
    loadOpportunities(),
    loadApplications(),
    loadContributorCount()
  ]);

  populateClusterFilters();
  renderSummary();
  renderOpportunityList();
  renderApplicationList();

  if (state.selectedOpportunityId) {
    const selected = selectedOpportunity();
    if (selected) {
      renderOpportunityEditor(selected);
    } else {
      state.selectedOpportunityId = null;
      els.opportunityEditor.hidden = true;
    }
  }
}

function populateClusterFilters() {
  const clusters = [...new Set([
    ...state.opportunities.map(row => row.cluster),
    ...state.applications.map(row => row.cluster)
  ].filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "id"));

  const currentOpportunityCluster = els.opportunityCluster.value;
  const currentApplicationCluster = els.applicationCluster.value;

  const options =
    `<option value="">Semua cluster</option>` +
    clusters.map(cluster =>
      `<option value="${esc(cluster)}">${esc(cluster)}</option>`
    ).join("");

  els.opportunityCluster.innerHTML = options;
  els.applicationCluster.innerHTML = options;

  if (clusters.includes(currentOpportunityCluster)) {
    els.opportunityCluster.value = currentOpportunityCluster;
  }

  if (clusters.includes(currentApplicationCluster)) {
    els.applicationCluster.value = currentApplicationCluster;
  }
}

function renderSummary() {
  const open = state.opportunities.filter(
    row => row.opportunity_status === "open"
  ).length;

  const inactive = state.opportunities.filter(
    row => ["draft", "paused"].includes(row.opportunity_status)
  ).length;

  const pending = state.applications.filter(
    row => row.application_status === "pending"
  ).length;

  els.openCount.textContent = open;
  els.inactiveCount.textContent = inactive;
  els.pendingCount.textContent = pending;
  els.pendingTabBadge.textContent = pending;
  els.contributorCount.textContent = state.activeContributorCount;
}

function filteredOpportunities() {
  const q = els.opportunitySearch.value.trim().toLowerCase();
  const cluster = els.opportunityCluster.value;
  const status = els.opportunityStatus.value;

  return state.opportunities.filter(row => {
    const haystack = [
      row.kpi_id,
      row.kpi_title,
      row.metric_id,
      row.metric_name,
      row.opportunity_title,
      row.short_description
    ].filter(Boolean).join(" ").toLowerCase();

    return (
      (!q || haystack.includes(q)) &&
      (!cluster || row.cluster === cluster) &&
      (!status || row.opportunity_status === status)
    );
  });
}

function renderOpportunityList() {
  const rows = filteredOpportunities();

  els.opportunityResultCount.textContent =
    `${rows.length} opportunit${rows.length === 1 ? "y" : "ies"}`;

  if (!rows.length) {
    els.opportunityList.innerHTML =
      `<div class="empty-state">Tidak ada opportunity yang cocok.</div>`;
    return;
  }

  els.opportunityList.innerHTML = rows.map(row => `
    <button class="record-button ${
      Number(row.opportunity_id) === Number(state.selectedOpportunityId)
        ? "selected"
        : ""
    }" type="button" data-opportunity="${row.opportunity_id}">
      <strong>${esc(row.metric_id)} · ${esc(row.metric_name)}</strong>
      <span>${esc(row.kpi_id)} · ${esc(row.kpi_title)}</span>
      <span class="record-meta">
        <span class="badge ${esc(row.opportunity_status)}">
          ${esc(row.opportunity_status)}
        </span>
        ${row.kpi_is_priority
          ? `<span class="badge priority">★ Priority</span>`
          : ""
        }
        <span class="badge">
          ${Number(row.pending_applications || 0)} pending
        </span>
        <span class="badge">
          ${Number(row.active_contributors || 0)} contributors
        </span>
      </span>
    </button>
  `).join("");

  els.opportunityList
    .querySelectorAll("[data-opportunity]")
    .forEach(button => {
      button.addEventListener("click", () => {
        state.selectedOpportunityId = Number(button.dataset.opportunity);
        renderOpportunityList();

        const row = selectedOpportunity();
        if (row) renderOpportunityEditor(row);
      });
    });
}

function renderSkillTree(opportunity) {
  const current = new Map(
    (Array.isArray(opportunity.skills) ? opportunity.skills : [])
      .map(skill => [
        Number(skill.id),
        skill.requirement_level
      ])
  );

  const byFamily = new Map();

  for (const skill of state.skills) {
    if (!byFamily.has(skill.skill_family)) {
      byFamily.set(skill.skill_family, []);
    }
    byFamily.get(skill.skill_family).push(skill);
  }

  els.editorSkillTree.innerHTML = [...byFamily.entries()]
    .map(([family, skills]) => {
      const selectedCount = skills.filter(skill =>
        current.has(Number(skill.id))
      ).length;

      return `
        <details class="skill-family" ${selectedCount ? "open" : ""}>
          <summary>
            <span>${esc(family)}</span>
            <span class="badge">${selectedCount}/${skills.length}</span>
          </summary>

          <div class="skill-family-body">
            ${skills.map(skill => `
              <label class="skill-requirement-row">
                <span>${esc(skill.skill_name)}</span>
                <select data-skill-requirement="${skill.id}">
                  <option value=""
                    ${!current.has(Number(skill.id)) ? "selected" : ""}>
                    None
                  </option>
                  <option value="preferred"
                    ${current.get(Number(skill.id)) === "preferred" ? "selected" : ""}>
                    Preferred
                  </option>
                  <option value="required"
                    ${current.get(Number(skill.id)) === "required" ? "selected" : ""}>
                    Required
                  </option>
                </select>
              </label>
            `).join("")}
          </div>
        </details>
      `;
    })
    .join("");
}

function renderOpportunityEditor(row) {
  els.opportunityEditor.hidden = false;

  els.editorKpiId.textContent = `${row.kpi_id} · ${row.metric_id}`;
  els.editorMetricName.textContent = row.metric_name;
  els.editorKpiTitle.textContent = row.kpi_title;

  els.editorBadges.innerHTML = `
    <span class="badge ${esc(row.opportunity_status)}">
      ${esc(row.opportunity_status)}
    </span>
    ${row.kpi_is_priority
      ? `<span class="badge priority">★ Priority</span>`
      : `<span class="badge">Less Priority</span>`
    }
    ${!(row.metric_is_public && row.kpi_is_public && row.mandate_is_public)
      ? `<span class="badge rejected">Not Public</span>`
      : ""
    }
  `;

  els.editorStatus.value = row.opportunity_status || "draft";
  els.editorSlots.value = row.volunteer_slots ?? "";
  els.editorTitle.value = row.opportunity_title || row.metric_name || "";
  els.editorDescription.value = row.short_description || "";
  els.editorMinHours.value = row.min_hours_month ?? "";
  els.editorMaxHours.value = row.max_hours_month ?? "";
  els.editorPublicNote.value = row.public_note || "";
  els.editorOwnerNote.value = row.owner_note || "";

  const modes = Array.isArray(row.contribution_modes)
    ? row.contribution_modes
    : [];

  els.editorModeAdvisor.checked = modes.includes("advisor_sme");
  els.editorModeOperational.checked =
    modes.includes("operational_execution");
  els.editorModeLead.checked = modes.includes("project_lead");

  renderSkillTree(row);
  setMessage(els.opportunityMessage, "");
}

function collectSkillRequirements() {
  const required = [];
  const preferred = [];

  els.editorSkillTree
    .querySelectorAll("[data-skill-requirement]")
    .forEach(select => {
      const id = Number(select.dataset.skillRequirement);

      if (select.value === "required") {
        required.push(id);
      }

      if (select.value === "preferred") {
        preferred.push(id);
      }
    });

  return { required, preferred };
}

function collectModes() {
  const modes = [];

  if (els.editorModeAdvisor.checked) {
    modes.push("advisor_sme");
  }

  if (els.editorModeOperational.checked) {
    modes.push("operational_execution");
  }

  if (els.editorModeLead.checked) {
    modes.push("project_lead");
  }

  return modes;
}

async function saveOpportunity() {
  const row = selectedOpportunity();

  if (!row) {
    throw new Error("Pilih opportunity dulu.");
  }

  const skills = collectSkillRequirements();
  const modes = collectModes();

  const minHours =
    els.editorMinHours.value === ""
      ? null
      : Number(els.editorMinHours.value);

  const maxHours =
    els.editorMaxHours.value === ""
      ? null
      : Number(els.editorMaxHours.value);

  const slots =
    els.editorSlots.value === ""
      ? null
      : Number(els.editorSlots.value);

  const { error } = await volunteerAdminSupabase.rpc(
    "save_volunteer_opportunity",
    {
      p_opportunity_id: row.opportunity_id,
      p_status: els.editorStatus.value,
      p_opportunity_title: els.editorTitle.value.trim(),
      p_short_description: els.editorDescription.value.trim() || null,
      p_min_hours_month: minHours,
      p_max_hours_month: maxHours,
      p_volunteer_slots: slots,
      p_public_note: els.editorPublicNote.value.trim() || null,
      p_owner_note: els.editorOwnerNote.value.trim() || null,
      p_required_skill_ids: skills.required,
      p_preferred_skill_ids: skills.preferred,
      p_contribution_modes: modes
    }
  );

  if (error) throw error;

  await reloadData();
}


function normalizeShareParam(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9._-]/g, "")
    .slice(0, 80);
}

function allowedOpportunityModes(row) {
  return Array.isArray(row?.contribution_modes)
    ? row.contribution_modes
    : [];
}

function buildShareUrl() {
  const row = selectedOpportunity();
  if (!row) return "";

  const url = new URL("opportunities.html", window.location.href);
  url.searchParams.set("mode", "kpi");
  url.searchParams.set("opportunity", String(row.opportunity_id));

  const mode = els.shareMode.value;
  const source = normalizeShareParam(els.shareSource.value);
  const campaign = normalizeShareParam(els.shareCampaign.value);

  if (mode) url.searchParams.set("contribution_mode", mode);
  if (source) url.searchParams.set("source", source);
  if (campaign) url.searchParams.set("campaign", campaign);

  return url.toString();
}

function refreshShareLink() {
  els.shareLink.value = buildShareUrl();
}

function openShareModal() {
  const row = selectedOpportunity();
  if (!row) return;

  const modes = allowedOpportunityModes(row);

  els.shareTitle.textContent =
    row.opportunity_status === "open"
      ? "Share Opportunity"
      : "Publish & Share Opportunity";

  els.shareContext.innerHTML = `
    <strong>${esc(row.kpi_id)} · ${esc(row.kpi_title)}</strong><br>
    ${esc(row.metric_id)} · ${esc(row.opportunity_title)}<br>
    Current status: <strong>${esc(row.opportunity_status)}</strong>
  `;

  els.shareMode.innerHTML =
    `<option value="">Semua allowed mode</option>` +
    modes.map(mode => `
      <option value="${esc(mode)}">
        ${esc(MODE_LABELS[mode] || mode)}
      </option>
    `).join("");

  els.shareSource.value = "";
  els.shareCampaign.value = "";

  els.publishShareButton.textContent =
    row.opportunity_status === "open"
      ? "Copy Link"
      : row.opportunity_status === "paused"
        ? "Resume & Copy"
        : "Publish & Copy";

  const disabled = ["closed", "filled"].includes(row.opportunity_status);
  els.publishShareButton.disabled = disabled;
  els.copyShareLink.disabled = row.opportunity_status !== "open";

  setMessage(
    els.shareMessage,
    disabled ? "Closed / Filled opportunity tidak dapat dibagikan." : ""
  );

  refreshShareLink();
  els.shareModal.hidden = false;
}

async function copyText(value) {
  if (!value) throw new Error("Link belum tersedia.");

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

async function publishAndCopy() {
  const row = selectedOpportunity();
  if (!row) throw new Error("Pilih opportunity dulu.");

  if (["closed", "filled"].includes(row.opportunity_status)) {
    throw new Error("Closed / Filled opportunity tidak dapat dipublish.");
  }

  if (row.opportunity_status !== "open") {
    const skills = collectSkillRequirements();
    const modes = collectModes();

    const minHours = els.editorMinHours.value === ""
      ? null : Number(els.editorMinHours.value);
    const maxHours = els.editorMaxHours.value === ""
      ? null : Number(els.editorMaxHours.value);
    const slots = els.editorSlots.value === ""
      ? null : Number(els.editorSlots.value);

    const { error } = await volunteerAdminSupabase.rpc(
      "save_volunteer_opportunity",
      {
        p_opportunity_id: row.opportunity_id,
        p_status: "open",
        p_opportunity_title: els.editorTitle.value.trim(),
        p_short_description: els.editorDescription.value.trim() || null,
        p_min_hours_month: minHours,
        p_max_hours_month: maxHours,
        p_volunteer_slots: slots,
        p_public_note: els.editorPublicNote.value.trim() || null,
        p_owner_note: els.editorOwnerNote.value.trim() || null,
        p_required_skill_ids: skills.required,
        p_preferred_skill_ids: skills.preferred,
        p_contribution_modes: modes
      }
    );

    if (error) throw error;
    await reloadData();
  }

  refreshShareLink();
  await copyText(els.shareLink.value);

  setMessage(
    els.shareMessage,
    "Opportunity sudah Open dan link berhasil dicopy.",
    "success"
  );
}

function filteredApplications() {
  const q = els.applicationSearch.value.trim().toLowerCase();
  const cluster = els.applicationCluster.value;
  const status = els.applicationStatus.value;

  return state.applications.filter(row => {
    const haystack = [
      row.volunteer_name,
      row.volunteer_email,
      row.professional_background,
      row.kpi_id,
      row.kpi_title,
      row.metric_id,
      row.metric_name,
      row.opportunity_title
    ].filter(Boolean).join(" ").toLowerCase();

    return (
      (!q || haystack.includes(q)) &&
      (!cluster || row.cluster === cluster) &&
      (!status || row.application_status === status)
    );
  });
}

function skillTags(skills) {
  if (!Array.isArray(skills) || !skills.length) {
    return `<span class="muted">No saved skills</span>`;
  }

  return skills.map(skill =>
    `<span class="tag">${esc(skill.skill_name)}</span>`
  ).join("");
}

function modeTags(modes) {
  if (!Array.isArray(modes) || !modes.length) {
    return `<span class="muted">No preference</span>`;
  }

  return modes.map(mode =>
    `<span class="tag">${esc(MODE_LABELS[mode] || mode)}</span>`
  ).join("");
}

function renderApplicationList() {
  const rows = filteredApplications();

  els.applicationResultCount.textContent =
    `${rows.length} application${rows.length === 1 ? "" : "s"}`;

  if (!rows.length) {
    els.applicationList.innerHTML =
      `<div class="empty-state">Tidak ada application yang cocok.</div>`;
    return;
  }

  els.applicationList.innerHTML = rows.map(row => `
    <article class="application-card">
      <div class="application-card-top">
        <div>
          <h3>${esc(row.volunteer_name || row.volunteer_email)}</h3>
          <p class="email">${esc(row.volunteer_email)}</p>
        </div>

        <div class="badge-row">
          <span class="badge ${esc(row.application_status)}">
            ${esc(row.application_status)}
          </span>
          ${row.kpi_is_priority
            ? `<span class="badge priority">★ Priority</span>`
            : ""
          }
        </div>
      </div>

      <div class="application-project">
        <strong>${esc(row.kpi_id)} · ${esc(row.kpi_title)}</strong><br>
        ${esc(row.metric_id)} · ${esc(row.opportunity_title)}
        ${row.application_source || row.campaign
          ? `<br><small>
               Source: ${esc(row.application_source || "—")}
               ${row.campaign ? ` · Campaign: ${esc(row.campaign)}` : ""}
             </small>`
          : ""
        }
      </div>

      <div class="application-grid">
        <div class="application-block">
          <strong>Applied As</strong>
          <p>
            ${esc(MODE_LABELS[row.contribution_mode] || row.contribution_mode)}
            · ${esc(row.offered_hours_month)} h/month
          </p>
        </div>

        <div class="application-block">
          <strong>Profile Capacity</strong>
          <p>
            ${esc(row.available_hours_month ?? "—")} h/month
            ${row.current_organization
              ? ` · ${esc(row.current_organization)}`
              : ""
            }
          </p>
        </div>

        <div class="application-block">
          <strong>Background</strong>
          <p>${esc(row.professional_background || "—")}</p>
        </div>

        <div class="application-block">
          <strong>Motivation</strong>
          <p>${esc(row.motivation || "—")}</p>
        </div>

        <div class="application-block">
          <strong>Skills</strong>
          <div class="tag-row">${skillTags(row.volunteer_skills)}</div>
        </div>

        <div class="application-block">
          <strong>Preferred Modes</strong>
          <div class="tag-row">${modeTags(row.volunteer_modes)}</div>
        </div>
      </div>

      ${row.review_note
        ? `<div class="application-project">
             <strong>Review Note</strong><br>
             ${esc(row.review_note)}
             ${row.reviewed_by ? `<br><small>${esc(row.reviewed_by)}</small>` : ""}
           </div>`
        : ""
      }

      ${row.application_status === "pending"
        ? `
          <div class="application-actions">
            <button class="reject-button"
                    type="button"
                    data-review="${row.application_id}"
                    data-decision="rejected">
              Reject
            </button>
            <button class="primary-button"
                    type="button"
                    data-review="${row.application_id}"
                    data-decision="approved">
              Approve & Assign
            </button>
          </div>
        `
        : ""
      }
    </article>
  `).join("");

  els.applicationList
    .querySelectorAll("[data-review]")
    .forEach(button => {
      button.addEventListener("click", () => {
        openReviewModal(
          Number(button.dataset.review),
          button.dataset.decision
        );
      });
    });
}

function openReviewModal(applicationId, decision) {
  const row = state.applications.find(
    item => Number(item.application_id) === Number(applicationId)
  );

  if (!row) return;

  state.reviewApplicationId = applicationId;
  state.reviewDecision = decision;

  const approve = decision === "approved";

  els.reviewEyebrow.textContent =
    approve ? "APPROVE & ASSIGN" : "REJECT APPLICATION";

  els.reviewTitle.textContent =
    row.volunteer_name || row.volunteer_email;

  els.reviewContext.innerHTML = `
    <strong>${esc(row.kpi_id)} · ${esc(row.kpi_title)}</strong><br>
    ${esc(row.metric_id)} · ${esc(row.opportunity_title)}<br>
    Applicant offered:
    ${esc(MODE_LABELS[row.contribution_mode] || row.contribution_mode)}
    · ${esc(row.offered_hours_month)} h/month
  `;

  els.approvalFields.hidden = !approve;

  const allowedModes = Array.isArray(row.allowed_modes)
    ? row.allowed_modes
    : [];

  els.reviewMode.innerHTML = allowedModes.map(mode =>
    `<option value="${esc(mode)}">
      ${esc(MODE_LABELS[mode] || mode)}
    </option>`
  ).join("");

  if (allowedModes.includes(row.contribution_mode)) {
    els.reviewMode.value = row.contribution_mode;
  }

  els.reviewHours.value = row.offered_hours_month || "";
  els.reviewNote.value = "";
  els.reviewSubmit.textContent =
    approve ? "Approve & Assign" : "Reject Application";

  setMessage(els.reviewMessage, "");
  els.reviewModal.hidden = false;
}

async function submitReview() {
  const row = state.applications.find(
    item =>
      Number(item.application_id) === Number(state.reviewApplicationId)
  );

  if (!row) {
    throw new Error("Application tidak ditemukan.");
  }

  const approve = state.reviewDecision === "approved";

  const { error } = await volunteerAdminSupabase.rpc(
    "review_volunteer_application",
    {
      p_application_id: row.application_id,
      p_decision: state.reviewDecision,
      p_contribution_mode: approve
        ? els.reviewMode.value
        : null,
      p_committed_hours: approve
        ? Number(els.reviewHours.value)
        : null,
      p_review_note: els.reviewNote.value.trim() || null
    }
  );

  if (error) throw error;

  els.reviewModal.hidden = true;
  state.reviewApplicationId = null;
  state.reviewDecision = null;

  await reloadData();
}

function setTab(tab) {
  const applications = tab === "applications";

  els.tabOpportunities.classList.toggle("active", !applications);
  els.tabApplications.classList.toggle("active", applications);

  els.opportunityPanel.hidden = applications;
  els.applicationPanel.hidden = !applications;
}

async function enterAdmin(session) {
  const profile = await resolveProfile(session);

  if (
    !profile ||
    !profile.is_active ||
    !["editor", "admin"].includes(profile.role)
  ) {
    await volunteerAdminSupabase.auth.signOut({ scope: "local" });

    state.session = null;
    state.profile = null;

    els.loginPanel.hidden = false;
    els.adminApp.hidden = true;
    els.sessionControls.hidden = true;

    setMessage(
      els.loginMessage,
      "Akun Google ini tidak memiliki akses Editor/Admin.",
      "error"
    );

    return;
  }

  state.profile = profile;

  els.loginPanel.hidden = true;
  els.adminApp.hidden = false;
  els.sessionControls.hidden = false;

  els.userName.textContent =
    profile.display_name || session.user.email;

  els.userRole.textContent = profile.role;

  await reloadData();
}

async function exitAdmin() {
  state.session = null;
  state.profile = null;
  state.opportunities = [];
  state.applications = [];
  state.selectedOpportunityId = null;

  els.userName.textContent = "";
  els.userRole.textContent = "";
  els.sessionControls.hidden = true;
  els.adminApp.hidden = true;
  els.loginPanel.hidden = false;
}

// ----------------------------------------------------------
// Events
// ----------------------------------------------------------
els.googleLogin.addEventListener("click", async () => {
  try {
    els.googleLogin.disabled = true;
    els.googleLogin.textContent = "Opening Google…";
    await signInWithGoogle();
  } catch (error) {
    console.error(error);
    setMessage(els.loginMessage, error.message, "error");
    els.googleLogin.disabled = false;
    els.googleLogin.textContent = "Continue with Google";
  }
});

els.logout.addEventListener("click", async () => {
  await volunteerAdminSupabase.auth.signOut({ scope: "local" });
  await exitAdmin();
});

els.tabOpportunities.addEventListener("click", () =>
  setTab("opportunities")
);

els.tabApplications.addEventListener("click", () =>
  setTab("applications")
);

[
  els.opportunitySearch,
  els.opportunityCluster,
  els.opportunityStatus
].forEach(input => {
  input.addEventListener(
    input.tagName === "INPUT" ? "input" : "change",
    renderOpportunityList
  );
});

[
  els.applicationSearch,
  els.applicationCluster,
  els.applicationStatus
].forEach(input => {
  input.addEventListener(
    input.tagName === "INPUT" ? "input" : "change",
    renderApplicationList
  );
});

els.opportunityForm.addEventListener("submit", async event => {
  event.preventDefault();
  setMessage(els.opportunityMessage, "Saving…");

  try {
    await saveOpportunity();
    setMessage(
      els.opportunityMessage,
      "Opportunity berhasil disimpan.",
      "success"
    );
  } catch (error) {
    console.error(error);
    setMessage(els.opportunityMessage, error.message, "error");
  }
});

els.reviewClose.addEventListener("click", () => {
  els.reviewModal.hidden = true;
});

els.reviewModal.addEventListener("click", event => {
  if (event.target === els.reviewModal) {
    els.reviewModal.hidden = true;
  }
});

els.reviewForm.addEventListener("submit", async event => {
  event.preventDefault();

  setMessage(els.reviewMessage, "Processing…");

  try {
    await submitReview();
  } catch (error) {
    console.error(error);
    setMessage(els.reviewMessage, error.message, "error");
  }
});


els.shareOpportunityButton.addEventListener("click", openShareModal);

[els.shareMode, els.shareSource, els.shareCampaign].forEach(input => {
  input.addEventListener(
    input.tagName === "SELECT" ? "change" : "input",
    refreshShareLink
  );
});

els.shareClose.addEventListener("click", () => {
  els.shareModal.hidden = true;
});

els.shareModal.addEventListener("click", event => {
  if (event.target === els.shareModal) {
    els.shareModal.hidden = true;
  }
});

els.copyShareLink.addEventListener("click", async () => {
  try {
    refreshShareLink();
    await copyText(els.shareLink.value);
    setMessage(els.shareMessage, "Link berhasil dicopy.", "success");
  } catch (error) {
    setMessage(els.shareMessage, error.message, "error");
  }
});

els.publishShareButton.addEventListener("click", async () => {
  try {
    setMessage(els.shareMessage, "Publishing…");
    await publishAndCopy();
  } catch (error) {
    console.error(error);
    setMessage(els.shareMessage, error.message, "error");
  }
});

volunteerAdminSupabase.auth.onAuthStateChange(
  async (_event, session) => {
    state.session = session;

    if (session) {
      try {
        await enterAdmin(session);
      } catch (error) {
        console.error(error);
        setMessage(els.loginMessage, error.message, "error");
      }
    } else {
      await exitAdmin();
    }
  }
);

// ----------------------------------------------------------
// Init
// ----------------------------------------------------------
(async function init() {
  try {
    const { data, error } =
      await volunteerAdminSupabase.auth.getSession();

    if (error) throw error;

    state.session = data.session;

    if (state.session) {
      await enterAdmin(state.session);
    } else {
      await exitAdmin();
    }
  } catch (error) {
    console.error(error);
    setMessage(els.loginMessage, error.message, "error");
  }
})();
