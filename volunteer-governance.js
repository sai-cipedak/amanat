(() => {
  if (window.__GERAK_SAI_VOLUNTEER_GOVERNANCE__) return;
  window.__GERAK_SAI_VOLUNTEER_GOVERNANCE__ = true;

  if ((location.pathname.split('/').pop() || '').toLowerCase() !== 'admin.html') return;
  if (typeof supabase === 'undefined') return;
  if (typeof SUPABASE_URL === 'undefined' || typeof SUPABASE_PUBLISHABLE_KEY === 'undefined') return;

  const db = supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
  let generation = 0;

  const state = {
    role: null,
    opportunities: [],
    applications: [],
    skillRequests: [],
    skills: [],
    activeTab: 'oversight',
    resolvingRequestId: null,
    resolvingDecision: null
  };

  const esc = value => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  function formatDateTime(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    }).format(date);
  }

  function modeLabel(value) {
    return {
      advisor_sme: 'Advisor / SME',
      operational_execution: 'Operational / Execution',
      project_lead: 'Project Lead'
    }[value] || value || '—';
  }

  function installStyles() {
    if (document.getElementById('volunteer-governance-styles')) return;
    const style = document.createElement('style');
    style.id = 'volunteer-governance-styles';
    style.textContent = `
      .vg-panel{margin-top:18px}
      .vg-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:14px}
      .vg-heading h2{margin-bottom:4px}
      .vg-scope-badge{display:inline-flex;align-items:center;padding:5px 9px;border-radius:999px;background:#eef4fb;color:#15589a;font-size:10px;font-weight:850;white-space:nowrap}
      .vg-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:16px 0}
      .vg-summary-card{padding:13px 14px;border:1px solid #dce3ea;border-radius:11px;background:#f9fbfd}
      .vg-summary-card span,.vg-summary-card small{display:block;color:#66717d;font-size:10px}
      .vg-summary-card strong{display:block;margin:3px 0;font-size:22px;color:#111820}
      .vg-tabs{display:flex;gap:6px;margin:4px 0 14px;padding-bottom:10px;border-bottom:1px solid #e4e8ec}
      .vg-tab{min-height:34px;padding:7px 10px;border:0;border-radius:8px;background:transparent;color:#66717d;font-weight:800;cursor:pointer}
      .vg-tab.active{background:#eef4fb;color:#15589a}
      .vg-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
      .vg-subpanel{min-width:0;padding:14px;border:1px solid #dce3ea;border-radius:12px;background:#fff}
      .vg-subpanel-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:10px}
      .vg-subpanel-head h3{margin:0;font-size:15px}
      .vg-count{color:#66717d;font-size:11px;font-weight:800}
      .vg-list{display:grid;gap:8px;max-height:560px;overflow:auto;padding-right:2px}
      .vg-row{padding:10px 11px;border:1px solid #e1e6ea;border-radius:10px;background:#fbfcfd}
      .vg-row-main{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}
      .vg-row strong,.vg-row span{display:block}
      .vg-row strong{font-size:12px;color:#111820}
      .vg-row .vg-meta{margin-top:3px;color:#66717d;font-size:10px;overflow-wrap:anywhere}
      .vg-badges{display:flex;align-items:center;justify-content:flex-end;gap:5px;flex-wrap:wrap}
      .vg-badge{display:inline-flex;align-items:center;padding:3px 7px;border-radius:999px;background:#eef4fb;color:#15589a;font-size:9px;font-weight:850;white-space:nowrap}
      .vg-badge.open,.vg-badge.approved,.vg-badge.active{background:#edf5e8;color:#5d7305}
      .vg-badge.pending{background:#fff4d7;color:#805d18}
      .vg-badge.rejected,.vg-badge.closed{background:#fff0f0;color:#963f3f}
      .vg-empty{padding:14px;border:1px dashed #dce3ea;border-radius:10px;background:#fafbfc;color:#66717d;font-size:11px}
      .vg-skill-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:start}
      .vg-skill-actions{display:flex;gap:5px;flex-wrap:wrap;justify-content:flex-end}
      .vg-action{min-height:30px;padding:5px 8px;border:1px solid #cbd7e1;border-radius:8px;background:#fff;color:#15589a;font-size:10px;font-weight:800;cursor:pointer}
      .vg-action.primary{border-color:#15589a;background:#15589a;color:#fff}
      .vg-action.danger{border-color:#e4bcbc;color:#963f3f}
      .vg-note{margin:0;color:#66717d;font-size:11px}
      .vg-backdrop{position:fixed;inset:0;z-index:1300;display:flex;align-items:center;justify-content:center;padding:18px;background:rgba(10,20,30,.58)}
      .vg-modal{width:min(680px,100%);max-height:calc(100vh - 36px);overflow:auto;padding:20px;border-radius:15px;background:#fff;box-shadow:0 20px 60px rgba(0,0,0,.25)}
      .vg-modal-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}
      .vg-modal-head h2{margin:0}
      .vg-close{border:0;background:transparent;color:#66717d;font-size:28px;line-height:1;cursor:pointer}
      .vg-context{margin:12px 0;padding:10px 11px;border-radius:9px;background:#f5f8fb;color:#526170;font-size:11px}
      .vg-form{display:grid;gap:11px}
      .vg-form label>span{display:block;margin-bottom:5px;color:#526170;font-size:10px;font-weight:850}
      .vg-form select,.vg-form textarea{width:100%;padding:9px 10px;border:1px solid #d4dce5;border-radius:9px;background:#fff;color:#111820}
      .vg-form-actions{display:flex;align-items:center;justify-content:space-between;gap:10px;padding-top:10px;border-top:1px solid #e4e8ec}
      .vg-message{color:#66717d;font-size:10px}
      .vg-message.error{color:#963f3f}.vg-message.success{color:#315f42}
      @media(max-width:900px){.vg-summary{grid-template-columns:repeat(2,minmax(0,1fr))}.vg-grid{grid-template-columns:1fr}}
      @media(max-width:650px){.vg-heading,.vg-row-main,.vg-skill-row,.vg-form-actions{flex-direction:column;display:flex}.vg-summary{grid-template-columns:1fr 1fr}.vg-badges,.vg-skill-actions{justify-content:flex-start}}
    `;
    document.head.append(style);
  }

  function ensurePanel() {
    if (document.getElementById('volunteer-governance-panel')) return;
    const adminApp = document.getElementById('admin-app');
    if (!adminApp) return;

    const panel = document.createElement('section');
    panel.id = 'volunteer-governance-panel';
    panel.className = 'panel phase4b-panel vg-panel';
    panel.hidden = true;
    panel.innerHTML = `
      <div class="vg-heading">
        <div>
          <p class="eyebrow">VOLUNTEER GOVERNANCE</p>
          <h2>Volunteer Oversight</h2>
          <p class="vg-note">Admin oversight only. Opportunity setup, applicant decisions, dan contributor onboarding tetap dilakukan oleh Metric Owner melalui My Metrics.</p>
        </div>
        <span class="vg-scope-badge">Admin · Global Oversight</span>
      </div>

      <div class="vg-summary">
        <article class="vg-summary-card"><span>Open Opportunities</span><strong id="vg-open-count">0</strong><small id="vg-open-note">0 volunteer slots</small></article>
        <article class="vg-summary-card"><span>Pending Applications</span><strong id="vg-pending-app-count">0</strong><small>Owner action required</small></article>
        <article class="vg-summary-card"><span>Active Contributors</span><strong id="vg-active-contributor-count">0</strong><small>active metric assignments</small></article>
        <article class="vg-summary-card"><span>Pending Skill Requests</span><strong id="vg-pending-skill-count">0</strong><small>Admin taxonomy decision</small></article>
      </div>

      <nav class="vg-tabs" aria-label="Volunteer governance views">
        <button type="button" class="vg-tab active" data-vg-tab="oversight">Oversight</button>
        <button type="button" class="vg-tab" data-vg-tab="skills">Skill Requests <span id="vg-skill-tab-count"></span></button>
      </nav>

      <div id="vg-oversight-view">
        <div class="vg-grid">
          <section class="vg-subpanel">
            <div class="vg-subpanel-head"><h3>Opportunity Oversight</h3><span id="vg-opportunity-count" class="vg-count"></span></div>
            <div id="vg-opportunity-list" class="vg-list"></div>
          </section>
          <section class="vg-subpanel">
            <div class="vg-subpanel-head"><h3>Application Oversight</h3><span id="vg-application-count" class="vg-count"></span></div>
            <div id="vg-application-list" class="vg-list"></div>
          </section>
        </div>
      </div>

      <div id="vg-skills-view" hidden>
        <section class="vg-subpanel">
          <div class="vg-subpanel-head">
            <div><h3>Skill Taxonomy Requests</h3><p class="vg-note">Approve membuat canonical skill baru; Merge menghubungkan request ke skill yang sudah ada; Reject menutup request.</p></div>
            <span id="vg-skill-count" class="vg-count"></span>
          </div>
          <div id="vg-skill-list" class="vg-list"></div>
        </section>
      </div>
    `;

    const userManagement = document.getElementById('user-management-panel');
    if (userManagement?.parentNode) {
      userManagement.parentNode.insertBefore(panel, userManagement);
    } else {
      adminApp.append(panel);
    }

    panel.querySelectorAll('[data-vg-tab]').forEach(button => {
      button.addEventListener('click', () => switchTab(button.dataset.vgTab));
    });
  }

  function ensureModal() {
    if (document.getElementById('vg-resolution-modal')) return;
    const backdrop = document.createElement('div');
    backdrop.id = 'vg-resolution-modal';
    backdrop.className = 'vg-backdrop';
    backdrop.hidden = true;
    backdrop.innerHTML = `
      <section class="vg-modal" role="dialog" aria-modal="true" aria-labelledby="vg-resolution-title">
        <div class="vg-modal-head">
          <div><p class="eyebrow">SKILL TAXONOMY</p><h2 id="vg-resolution-title">Resolve Skill Request</h2></div>
          <button id="vg-resolution-close" class="vg-close" type="button" aria-label="Close">×</button>
        </div>
        <div id="vg-resolution-context" class="vg-context"></div>
        <form id="vg-resolution-form" class="vg-form">
          <label id="vg-existing-skill-field" hidden>
            <span>Merge into existing skill *</span>
            <select id="vg-existing-skill"></select>
          </label>
          <label>
            <span>Admin note</span>
            <textarea id="vg-admin-note" rows="3" placeholder="Optional governance note"></textarea>
          </label>
          <div class="vg-form-actions">
            <span id="vg-resolution-message" class="vg-message"></span>
            <button id="vg-resolution-submit" class="vg-action primary" type="submit">Confirm</button>
          </div>
        </form>
      </section>
    `;
    document.body.append(backdrop);
    backdrop.querySelector('#vg-resolution-close').addEventListener('click', closeModal);
    backdrop.addEventListener('click', event => { if (event.target === backdrop) closeModal(); });
    backdrop.querySelector('#vg-resolution-form').addEventListener('submit', resolveSkillRequest);
  }

  function switchTab(tab) {
    state.activeTab = tab === 'skills' ? 'skills' : 'oversight';
    document.querySelectorAll('[data-vg-tab]').forEach(button => {
      button.classList.toggle('active', button.dataset.vgTab === state.activeTab);
    });
    const oversight = document.getElementById('vg-oversight-view');
    const skills = document.getElementById('vg-skills-view');
    if (oversight) oversight.hidden = state.activeTab !== 'oversight';
    if (skills) skills.hidden = state.activeTab !== 'skills';
  }

  async function resolveRole() {
    const { data, error } = await db.rpc('current_admin_role');
    if (error) throw error;
    state.role = data || null;
  }

  async function loadData() {
    const [opps, apps, requests, skills] = await Promise.all([
      db.rpc('get_admin_volunteer_opportunities'),
      db.rpc('get_admin_volunteer_applications'),
      db.rpc('get_admin_skill_requests', { p_status: null }),
      db.from('skill_catalog').select('id,skill_family,skill_name,sort_order').eq('is_active', true).order('skill_family').order('sort_order').order('skill_name')
    ]);

    for (const result of [opps, apps, requests, skills]) {
      if (result.error) throw result.error;
    }

    state.opportunities = opps.data || [];
    state.applications = apps.data || [];
    state.skillRequests = requests.data || [];
    state.skills = skills.data || [];
  }

  function renderSummary() {
    const open = state.opportunities.filter(row => row.opportunity_status === 'open');
    const pendingApps = state.applications.filter(row => row.application_status === 'pending');
    const pendingSkills = state.skillRequests.filter(row => row.request_status === 'pending');
    const activeContributors = state.opportunities.reduce((sum, row) => sum + Number(row.active_contributors || 0), 0);
    const openSlots = open.reduce((sum, row) => sum + Number(row.volunteer_slots || 0), 0);

    document.getElementById('vg-open-count').textContent = open.length;
    document.getElementById('vg-open-note').textContent = `${openSlots} volunteer slots`;
    document.getElementById('vg-pending-app-count').textContent = pendingApps.length;
    document.getElementById('vg-active-contributor-count').textContent = activeContributors;
    document.getElementById('vg-pending-skill-count').textContent = pendingSkills.length;
    document.getElementById('vg-skill-tab-count').textContent = pendingSkills.length ? `(${pendingSkills.length})` : '';
  }

  function renderOpportunities() {
    const target = document.getElementById('vg-opportunity-list');
    const rows = [...state.opportunities].sort((a, b) => {
      const rank = value => ({ open: 1, draft: 2, paused: 3, filled: 4, closed: 5 }[value] || 9);
      return rank(a.opportunity_status) - rank(b.opportunity_status) || String(a.metric_id).localeCompare(String(b.metric_id));
    });
    document.getElementById('vg-opportunity-count').textContent = `${rows.length} total`;

    if (!rows.length) {
      target.innerHTML = '<div class="vg-empty">Belum ada volunteer opportunity.</div>';
      return;
    }

    target.innerHTML = rows.slice(0, 40).map(row => `
      <article class="vg-row">
        <div class="vg-row-main">
          <div>
            <strong>${esc(row.metric_id)} · ${esc(row.opportunity_title || row.metric_name)}</strong>
            <span class="vg-meta">${esc(row.kpi_id)} · ${esc(row.cluster)} · ${esc(row.metric_name)}</span>
          </div>
          <div class="vg-badges">
            <span class="vg-badge ${esc(row.opportunity_status)}">${esc(row.opportunity_status)}</span>
            <span class="vg-badge">${Number(row.active_contributors || 0)}/${Number(row.volunteer_slots || 0)} active/slots</span>
            ${Number(row.pending_applications || 0) ? `<span class="vg-badge pending">${Number(row.pending_applications)} pending</span>` : ''}
          </div>
        </div>
      </article>
    `).join('');
  }

  function renderApplications() {
    const target = document.getElementById('vg-application-list');
    const rows = [...state.applications].sort((a, b) => {
      const rank = value => ({ pending: 1, approved: 2, rejected: 3, withdrawn: 4 }[value] || 9);
      return rank(a.application_status) - rank(b.application_status) || new Date(b.application_created_at || 0) - new Date(a.application_created_at || 0);
    });
    document.getElementById('vg-application-count').textContent = `${rows.length} total`;

    if (!rows.length) {
      target.innerHTML = '<div class="vg-empty">Belum ada volunteer application.</div>';
      return;
    }

    target.innerHTML = rows.slice(0, 40).map(row => `
      <article class="vg-row">
        <div class="vg-row-main">
          <div>
            <strong>${esc(row.volunteer_name || row.volunteer_email)} · ${esc(row.metric_id)}</strong>
            <span class="vg-meta">${esc(row.volunteer_email)} · ${esc(row.cluster)} · ${esc(modeLabel(row.contribution_mode))}</span>
            <span class="vg-meta">Applied ${esc(formatDateTime(row.application_created_at))}</span>
          </div>
          <div class="vg-badges">
            <span class="vg-badge ${esc(row.application_status)}">${esc(row.application_status)}</span>
            ${row.offered_hours_month != null ? `<span class="vg-badge">${esc(row.offered_hours_month)} h/mo</span>` : ''}
          </div>
        </div>
      </article>
    `).join('');
  }

  function renderSkillRequests() {
    const target = document.getElementById('vg-skill-list');
    const rows = [...state.skillRequests].sort((a, b) => {
      const rank = value => ({ pending: 1, approved: 2, merged: 3, rejected: 4 }[value] || 9);
      return rank(a.request_status) - rank(b.request_status) || new Date(b.requested_at || 0) - new Date(a.requested_at || 0);
    });
    const pending = rows.filter(row => row.request_status === 'pending').length;
    document.getElementById('vg-skill-count').textContent = `${pending} pending · ${rows.length} total`;

    if (!rows.length) {
      target.innerHTML = '<div class="vg-empty">Belum ada skill taxonomy request.</div>';
      return;
    }

    target.innerHTML = rows.slice(0, 60).map(row => `
      <article class="vg-row vg-skill-row">
        <div>
          <strong>${esc(row.proposed_skill_family)} · ${esc(row.proposed_skill_name)}</strong>
          <span class="vg-meta">${esc(row.metric_id)} · ${esc(row.metric_name)} · ${esc(row.cluster)}</span>
          <span class="vg-meta">Requested by ${esc(row.requested_by_email)} · ${esc(formatDateTime(row.requested_at))}</span>
          ${row.rationale ? `<span class="vg-meta">${esc(row.rationale)}</span>` : ''}
          ${row.resolved_skill_name ? `<span class="vg-meta">Resolved to: ${esc(row.resolved_skill_name)}</span>` : ''}
        </div>
        <div class="vg-skill-actions">
          <span class="vg-badge ${esc(row.request_status)}">${esc(row.request_status)}</span>
          ${row.request_status === 'pending' ? `
            <button type="button" class="vg-action primary" data-vg-resolve="approve" data-request-id="${row.request_id}">Approve</button>
            <button type="button" class="vg-action" data-vg-resolve="merge" data-request-id="${row.request_id}">Merge</button>
            <button type="button" class="vg-action danger" data-vg-resolve="reject" data-request-id="${row.request_id}">Reject</button>
          ` : ''}
        </div>
      </article>
    `).join('');

    target.querySelectorAll('[data-vg-resolve]').forEach(button => {
      button.addEventListener('click', () => openResolutionModal(Number(button.dataset.requestId), button.dataset.vgResolve));
    });
  }

  function renderAll() {
    ensurePanel();
    const panel = document.getElementById('volunteer-governance-panel');
    if (!panel) return;
    panel.hidden = state.role !== 'admin';
    if (panel.hidden) return;
    renderSummary();
    renderOpportunities();
    renderApplications();
    renderSkillRequests();
    switchTab(state.activeTab);

    if (location.hash === '#volunteer-governance') {
      requestAnimationFrame(() => panel.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    }
  }

  function openResolutionModal(requestId, decision) {
    const request = state.skillRequests.find(row => Number(row.request_id) === Number(requestId));
    if (!request || request.request_status !== 'pending') return;

    ensureModal();
    state.resolvingRequestId = requestId;
    state.resolvingDecision = decision;

    const title = decision === 'approve' ? 'Approve Skill Request' : decision === 'merge' ? 'Merge Skill Request' : 'Reject Skill Request';
    document.getElementById('vg-resolution-title').textContent = title;
    document.getElementById('vg-resolution-context').innerHTML = `
      <strong>${esc(request.proposed_skill_family)} · ${esc(request.proposed_skill_name)}</strong><br>
      ${esc(request.metric_id)} · ${esc(request.metric_name)}<br>
      Requested by ${esc(request.requested_by_email)}
    `;

    const mergeField = document.getElementById('vg-existing-skill-field');
    const select = document.getElementById('vg-existing-skill');
    mergeField.hidden = decision !== 'merge';
    select.innerHTML = '<option value="">Pilih existing skill…</option>' + state.skills.map(skill =>
      `<option value="${skill.id}">${esc(skill.skill_family)} · ${esc(skill.skill_name)}</option>`
    ).join('');

    document.getElementById('vg-admin-note').value = '';
    setResolutionMessage('');
    document.getElementById('vg-resolution-submit').textContent = decision === 'reject' ? 'Reject Request' : decision === 'merge' ? 'Merge Request' : 'Approve Request';
    document.getElementById('vg-resolution-modal').hidden = false;
  }

  function closeModal() {
    const modal = document.getElementById('vg-resolution-modal');
    if (modal) modal.hidden = true;
    state.resolvingRequestId = null;
    state.resolvingDecision = null;
  }

  function setResolutionMessage(text, type = '') {
    const el = document.getElementById('vg-resolution-message');
    if (!el) return;
    el.textContent = text || '';
    el.className = `vg-message ${type}`.trim();
  }

  async function resolveSkillRequest(event) {
    event.preventDefault();
    const requestId = state.resolvingRequestId;
    const decision = state.resolvingDecision;
    if (!requestId || !decision) return;

    const submit = document.getElementById('vg-resolution-submit');
    const existingValue = document.getElementById('vg-existing-skill').value;
    if (decision === 'merge' && !existingValue) {
      setResolutionMessage('Pilih existing skill untuk merge.', 'error');
      return;
    }

    try {
      submit.disabled = true;
      setResolutionMessage('Saving…');
      const { error } = await db.rpc('resolve_skill_taxonomy_request', {
        p_request_id: requestId,
        p_decision: decision,
        p_existing_skill_id: decision === 'merge' ? Number(existingValue) : null,
        p_admin_note: document.getElementById('vg-admin-note').value.trim() || null
      });
      if (error) throw error;

      const [requests, skills] = await Promise.all([
        db.rpc('get_admin_skill_requests', { p_status: null }),
        db.from('skill_catalog').select('id,skill_family,skill_name,sort_order').eq('is_active', true).order('skill_family').order('sort_order').order('skill_name')
      ]);
      if (requests.error) throw requests.error;
      if (skills.error) throw skills.error;
      state.skillRequests = requests.data || [];
      state.skills = skills.data || [];
      renderSummary();
      renderSkillRequests();
      setResolutionMessage('Request resolved.', 'success');
      setTimeout(closeModal, 450);
    } catch (error) {
      console.error(error);
      setResolutionMessage(error.message || 'Gagal resolve request.', 'error');
    } finally {
      submit.disabled = false;
    }
  }

  async function initialize(session) {
    const run = ++generation;
    ensurePanel();
    const panel = document.getElementById('volunteer-governance-panel');
    if (!session?.user) {
      state.role = null;
      if (panel) panel.hidden = true;
      return;
    }

    try {
      await resolveRole();
      if (run !== generation) return;
      if (state.role !== 'admin') {
        if (panel) panel.hidden = true;
        return;
      }
      await loadData();
      if (run !== generation) return;
      renderAll();
    } catch (error) {
      console.error('Volunteer governance failed to load', error);
      if (panel) panel.hidden = true;
    }
  }

  installStyles();
  ensurePanel();
  db.auth.onAuthStateChange((_event, session) => initialize(session));
  db.auth.getSession().then(({ data }) => initialize(data.session)).catch(() => initialize(null));
})();