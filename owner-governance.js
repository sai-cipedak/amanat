(() => {
  if (window.__GERAK_SAI_OWNER_GOVERNANCE__) return;
  window.__GERAK_SAI_OWNER_GOVERNANCE__ = true;

  if ((location.pathname.split('/').pop() || '').toLowerCase() !== 'admin.html') return;
  if (typeof supabase === 'undefined') return;
  if (typeof SUPABASE_URL === 'undefined' || typeof SUPABASE_PUBLISHABLE_KEY === 'undefined') return;

  const db = supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

  const state = {
    role: null,
    ownership: [],
    metricId: null,
    initialized: false
  };

  const esc = value => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  function installStyles() {
    if (document.getElementById('owner-governance-styles')) return;
    const style = document.createElement('style');
    style.id = 'owner-governance-styles';
    style.textContent = `
      .owner-governance-panel{margin-top:16px}
      .owner-governance-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:12px}
      .owner-governance-heading h2{margin:0}
      .owner-governance-current{display:grid;gap:8px;margin:14px 0}
      .owner-governance-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:11px 12px;border:1px solid #dce3ea;border-radius:10px;background:#fff}
      .owner-governance-identity{min-width:0}
      .owner-governance-identity strong,.owner-governance-identity span{display:block}
      .owner-governance-identity span{margin-top:2px;color:#66717d;font-size:11px;overflow-wrap:anywhere}
      .owner-governance-actions{display:flex;align-items:center;gap:7px;flex-wrap:wrap;justify-content:flex-end}
      .owner-governance-badge{display:inline-flex;align-items:center;min-height:24px;padding:3px 8px;border-radius:999px;background:#eef4fb;color:#15589a;font-size:10px;font-weight:800;white-space:nowrap}
      .owner-governance-badge.supporting{background:#f1f3f1;color:#66717d}
      .owner-governance-badge.pending{background:#fff4d7;color:#805d18}
      .owner-governance-empty{padding:13px;border:1px dashed #dce3ea;border-radius:10px;color:#66717d;background:#f8fafb;font-size:12px}
      .owner-governance-manage{min-height:36px;padding:8px 12px;border:1px solid #15589a;border-radius:9px;background:#15589a;color:#fff;font-weight:800;cursor:pointer}
      .owner-governance-end{min-height:30px;padding:5px 8px;border:1px solid #e0b7b7;border-radius:8px;background:#fff;color:#963f3f;font-size:11px;font-weight:750;cursor:pointer}
      .owner-governance-note{margin:0;color:#66717d;font-size:12px}
      .owner-governance-backdrop{position:fixed;inset:0;z-index:1200;display:flex;align-items:center;justify-content:center;padding:18px;background:rgba(10,20,30,.58);overflow:auto}
      .owner-governance-modal{width:min(720px,100%);max-height:calc(100vh - 36px);overflow:auto;padding:22px;border-radius:16px;background:#fff;box-shadow:0 20px 60px rgba(0,0,0,.24)}
      .owner-governance-modal-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
      .owner-governance-modal-head h2{margin:0}
      .owner-governance-close{border:0;background:transparent;color:#66717d;font-size:28px;line-height:1;cursor:pointer}
      .owner-governance-context{margin:12px 0;padding:10px 12px;border-radius:10px;background:#f5f8fb;color:#66717d;font-size:12px}
      .owner-governance-form{display:grid;grid-template-columns:1fr 1fr;gap:11px;margin-top:14px}
      .owner-governance-form label{display:block}
      .owner-governance-form label.wide{grid-column:1/-1}
      .owner-governance-form label>span{display:block;margin-bottom:5px;color:#66717d;font-size:11px;font-weight:800}
      .owner-governance-form input,.owner-governance-form select{width:100%;min-height:41px;padding:0 10px;border:1px solid #dce3ea;border-radius:9px;background:#fff}
      .owner-governance-form-actions{grid-column:1/-1;display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:4px;padding-top:13px;border-top:1px solid #e7ebef}
      .owner-governance-message{color:#66717d;font-size:11px}
      .owner-governance-message.error{color:#963f3f}
      .owner-governance-message.success{color:#315f42}
      @media(max-width:650px){.owner-governance-row,.owner-governance-heading,.owner-governance-form-actions{align-items:stretch;flex-direction:column}.owner-governance-actions{justify-content:flex-start}.owner-governance-form{grid-template-columns:1fr}.owner-governance-form label.wide{grid-column:auto}}
    `;
    document.head.append(style);
  }

  function currentRows(metricId) {
    return state.ownership.filter(row =>
      row.metric_id === metricId &&
      ['pending', 'active'].includes(row.assignment_status)
    );
  }

  async function loadOwnership() {
    const { data, error } = await db.rpc('get_admin_metric_ownership');
    if (error) throw error;
    state.ownership = data || [];
  }

  async function resolveRole() {
    const { data, error } = await db.rpc('current_admin_role');
    if (error) throw error;
    state.role = data || null;
  }

  function roleLabel() {
    return state.role === 'admin' ? 'Admin · Global Override' : 'Cluster Lead · Scoped';
  }

  function selectedMetricContext() {
    const metricId = document.getElementById('metric-select')?.value || '';
    const kpiText = document.getElementById('metric-kpi-title')?.textContent?.trim() || '';
    const metricName = document.getElementById('metric-name')?.textContent?.trim() || '';
    return { metricId, kpiText, metricName };
  }

  function renderCurrentList(target, metricId, withEndButtons = false) {
    const rows = currentRows(metricId).sort((a, b) => {
      const ar = a.owner_role === 'primary_owner' ? 0 : 1;
      const br = b.owner_role === 'primary_owner' ? 0 : 1;
      return ar - br;
    });

    if (!rows.length) {
      target.innerHTML = '<div class="owner-governance-empty">Belum ada Primary / Supporting Metric Owner.</div>';
      return;
    }

    target.innerHTML = rows.map(owner => `
      <div class="owner-governance-row">
        <div class="owner-governance-identity">
          <strong>${esc(owner.display_name || owner.owner_email)}</strong>
          <span>${esc(owner.owner_email)}</span>
        </div>
        <div class="owner-governance-actions">
          <span class="owner-governance-badge ${owner.owner_role === 'supporting_owner' ? 'supporting' : ''}">
            ${owner.owner_role === 'primary_owner' ? 'Primary Owner' : 'Supporting Owner'}
          </span>
          <span class="owner-governance-badge ${owner.assignment_status === 'pending' ? 'pending' : ''}">
            ${esc(owner.assignment_status)}
          </span>
          ${withEndButtons ? `<button type="button" class="owner-governance-end" data-end-owner="${owner.assignment_id}">End</button>` : ''}
        </div>
      </div>
    `).join('');

    if (withEndButtons) {
      target.querySelectorAll('[data-end-owner]').forEach(button => {
        button.addEventListener('click', () => endAssignment(Number(button.dataset.endOwner), button));
      });
    }
  }

  function ensurePanel() {
    if (document.getElementById('metric-owner-governance-panel')) return;
    const overview = document.querySelector('#metric-workspace .metric-overview');
    if (!overview) return;

    const panel = document.createElement('section');
    panel.id = 'metric-owner-governance-panel';
    panel.className = 'panel owner-governance-panel';
    panel.hidden = true;
    panel.innerHTML = `
      <div class="owner-governance-heading">
        <div>
          <p class="eyebrow">ACCOUNTABILITY</p>
          <h2>Metric Owner</h2>
        </div>
        <span id="owner-governance-role" class="owner-governance-badge"></span>
      </div>
      <p id="owner-governance-note" class="owner-governance-note"></p>
      <div id="owner-governance-current" class="owner-governance-current"></div>
      <button id="owner-governance-manage" type="button" class="owner-governance-manage">Manage Metric Owner</button>
    `;

    overview.insertAdjacentElement('afterend', panel);
    panel.querySelector('#owner-governance-manage').addEventListener('click', openModal);
  }

  function ensureModal() {
    if (document.getElementById('owner-governance-modal')) return;
    const backdrop = document.createElement('div');
    backdrop.id = 'owner-governance-modal';
    backdrop.className = 'owner-governance-backdrop';
    backdrop.hidden = true;
    backdrop.innerHTML = `
      <section class="owner-governance-modal" role="dialog" aria-modal="true" aria-labelledby="owner-governance-modal-title">
        <div class="owner-governance-modal-head">
          <div>
            <p class="eyebrow">ACCOUNTABILITY</p>
            <h2 id="owner-governance-modal-title">Manage Metric Owner</h2>
          </div>
          <button id="owner-governance-close" class="owner-governance-close" type="button" aria-label="Close">×</button>
        </div>
        <div id="owner-governance-context" class="owner-governance-context"></div>
        <div id="owner-governance-modal-current" class="owner-governance-current"></div>
        <form id="owner-governance-form" class="owner-governance-form">
          <label>
            <span>Owner Role *</span>
            <select id="owner-governance-owner-role" required>
              <option value="primary_owner">Primary Owner</option>
              <option value="supporting_owner">Supporting Owner</option>
            </select>
          </label>
          <label>
            <span>Display Name</span>
            <input id="owner-governance-display-name" type="text" placeholder="Nama Metric Owner" />
          </label>
          <label class="wide">
            <span>Google / Login Email *</span>
            <input id="owner-governance-email" type="email" required placeholder="nama@gmail.com" />
          </label>
          <div class="owner-governance-form-actions">
            <span id="owner-governance-message" class="owner-governance-message"></span>
            <button id="owner-governance-submit" class="owner-governance-manage" type="submit">Assign / Change Owner</button>
          </div>
        </form>
      </section>
    `;

    document.body.append(backdrop);
    backdrop.querySelector('#owner-governance-close').addEventListener('click', closeModal);
    backdrop.addEventListener('click', event => {
      if (event.target === backdrop) closeModal();
    });
    backdrop.querySelector('#owner-governance-form').addEventListener('submit', assignOwner);
  }

  function setMessage(text, type = '') {
    const el = document.getElementById('owner-governance-message');
    if (!el) return;
    el.textContent = text || '';
    el.className = `owner-governance-message ${type}`.trim();
  }

  function renderPanel() {
    ensurePanel();
    const panel = document.getElementById('metric-owner-governance-panel');
    if (!panel) return;

    const { metricId } = selectedMetricContext();
    state.metricId = metricId || null;

    if (!state.metricId || !['admin', 'reviewer'].includes(state.role)) {
      panel.hidden = true;
      return;
    }

    panel.hidden = false;
    document.getElementById('owner-governance-role').textContent = roleLabel();
    document.getElementById('owner-governance-note').textContent =
      state.role === 'admin'
        ? 'Admin dapat menetapkan owner pada semua metric sebagai global governance override.'
        : 'Sebagai Cluster Lead, kamu dapat menetapkan Primary / Supporting Metric Owner hanya untuk metric dalam cluster yang kamu lead.';

    renderCurrentList(document.getElementById('owner-governance-current'), state.metricId, false);
  }

  function openModal() {
    if (!state.metricId) return;
    ensureModal();
    const modal = document.getElementById('owner-governance-modal');
    const { metricId, kpiText, metricName } = selectedMetricContext();
    if (!metricId) return;

    document.getElementById('owner-governance-context').innerHTML = `
      <strong>${esc(metricId)} · ${esc(metricName)}</strong><br>${esc(kpiText)}<br>
      ${state.role === 'admin' ? 'Global Admin authority' : 'Cluster Lead authority · current cluster only'}
    `;
    document.getElementById('owner-governance-owner-role').value = 'primary_owner';
    document.getElementById('owner-governance-display-name').value = '';
    document.getElementById('owner-governance-email').value = '';
    renderCurrentList(document.getElementById('owner-governance-modal-current'), metricId, true);
    setMessage('');
    modal.hidden = false;
  }

  function closeModal() {
    const modal = document.getElementById('owner-governance-modal');
    if (modal) modal.hidden = true;
  }

  async function assignOwner(event) {
    event.preventDefault();
    const submit = document.getElementById('owner-governance-submit');
    const metricId = state.metricId;
    if (!metricId) return;

    const email = document.getElementById('owner-governance-email').value.trim();
    const displayName = document.getElementById('owner-governance-display-name').value.trim();
    const role = document.getElementById('owner-governance-owner-role').value;

    if (!email) {
      setMessage('Email owner wajib diisi.', 'error');
      return;
    }

    try {
      submit.disabled = true;
      setMessage('Saving…');
      const { error } = await db.rpc('assign_metric_owner', {
        p_metric_id: metricId,
        p_owner_email: email,
        p_display_name: displayName || null,
        p_owner_role: role
      });
      if (error) throw error;

      await loadOwnership();
      renderPanel();
      renderCurrentList(document.getElementById('owner-governance-modal-current'), metricId, true);
      document.getElementById('owner-governance-display-name').value = '';
      document.getElementById('owner-governance-email').value = '';
      setMessage('Metric Owner berhasil di-assign.', 'success');
    } catch (error) {
      console.error(error);
      setMessage(error.message || 'Assignment gagal.', 'error');
    } finally {
      submit.disabled = false;
    }
  }

  async function endAssignment(assignmentId, button) {
    const owner = state.ownership.find(row => Number(row.assignment_id) === Number(assignmentId));
    if (!owner) return;
    if (!window.confirm(`End assignment untuk ${owner.display_name || owner.owner_email}?`)) return;

    try {
      button.disabled = true;
      setMessage('Saving…');
      const { error } = await db.rpc('end_metric_owner_assignment', {
        p_assignment_id: assignmentId
      });
      if (error) throw error;

      await loadOwnership();
      renderPanel();
      renderCurrentList(document.getElementById('owner-governance-modal-current'), state.metricId, true);
      setMessage('Assignment berhasil diakhiri.', 'success');
    } catch (error) {
      console.error(error);
      setMessage(error.message || 'Gagal mengakhiri assignment.', 'error');
    } finally {
      button.disabled = false;
    }
  }

  function cleanLegacyGovernanceCopy() {
    const updateGuidance = document.querySelector('.admin-role-guidance');
    if (updateGuidance) {
      updateGuidance.textContent =
        'Admin dapat membuat draft sebagai global override. Metric Owner mengirim update dari My Metrics; Cluster Lead menetapkan Metric Owner dan melakukan review dalam cluster scope.';
    }
  }

  async function init(session) {
    if (!session?.user || state.initialized) return;

    try {
      await resolveRole();
      if (!['admin', 'reviewer'].includes(state.role)) return;
      await loadOwnership();

      state.initialized = true;
      installStyles();
      ensurePanel();
      ensureModal();
      cleanLegacyGovernanceCopy();
      renderPanel();

      const metricSelect = document.getElementById('metric-select');
      metricSelect?.addEventListener('change', () => {
        setTimeout(renderPanel, 0);
      });

      const workspace = document.getElementById('metric-workspace');
      if (workspace) {
        new MutationObserver(() => {
          if (!workspace.hidden) renderPanel();
        }).observe(workspace, { attributes: true, attributeFilter: ['hidden'] });
      }
    } catch (error) {
      console.error('Metric Owner governance init failed:', error);
    }
  }

  db.auth.onAuthStateChange((_event, session) => {
    if (!session?.user) {
      state.initialized = false;
      state.role = null;
      state.ownership = [];
      const panel = document.getElementById('metric-owner-governance-panel');
      if (panel) panel.hidden = true;
      closeModal();
      return;
    }
    init(session);
  });

  db.auth.getSession()
    .then(({ data }) => init(data.session))
    .catch(error => console.error(error));
})();