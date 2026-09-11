(() => {
  if (window.__GERAK_SAI_MY_METRICS_GOVERNANCE__) return;
  window.__GERAK_SAI_MY_METRICS_GOVERNANCE__ = true;

  if ((location.pathname.split('/').pop() || '').toLowerCase() !== 'my-metrics.html') return;
  if (typeof supabase === 'undefined') return;
  if (typeof SUPABASE_URL === 'undefined' || typeof SUPABASE_PUBLISHABLE_KEY === 'undefined') return;

  const db = supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
  let currentMetricId = null;
  let renderQueued = false;

  const esc = value => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  function installStyles() {
    if (document.getElementById('my-metrics-governance-styles')) return;
    const style = document.createElement('style');
    style.id = 'my-metrics-governance-styles';
    style.textContent = `
      .contributor-governance-backdrop{position:fixed;inset:0;z-index:1500;display:flex;align-items:center;justify-content:center;padding:18px;background:rgba(10,20,30,.58);overflow:auto}
      .contributor-governance-modal{width:min(760px,100%);max-height:calc(100vh - 36px);overflow:auto;padding:22px;border-radius:16px;background:#fff;box-shadow:0 20px 60px rgba(0,0,0,.24)}
      .contributor-governance-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
      .contributor-governance-head h2{margin:0}
      .contributor-governance-close{border:0;background:transparent;color:#66717d;font-size:28px;line-height:1;cursor:pointer}
      .contributor-governance-context{margin:12px 0;padding:10px 12px;border-radius:10px;background:#f5f8fb;color:#66717d;font-size:12px}
      .contributor-governance-list{display:grid;gap:9px;margin-top:12px}
      .contributor-governance-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px;border:1px solid #dce3ea;border-radius:10px;background:#fff}
      .contributor-governance-person{min-width:0}
      .contributor-governance-person strong,.contributor-governance-person span{display:block}
      .contributor-governance-person span{margin-top:2px;color:#66717d;font-size:11px;overflow-wrap:anywhere}
      .contributor-governance-actions{display:flex;align-items:center;justify-content:flex-end;gap:7px;flex-wrap:wrap}
      .contributor-governance-end{min-height:30px;padding:5px 8px;border:1px solid #e0b7b7;border-radius:8px;background:#fff;color:#963f3f;font-size:11px;font-weight:750;cursor:pointer}
      .contributor-governance-empty{padding:13px;border:1px dashed #dce3ea;border-radius:10px;color:#66717d;background:#f8fafb;font-size:12px}
      .contributor-governance-message{min-height:18px;margin-top:10px;color:#66717d;font-size:11px}
      .contributor-governance-message.error{color:#963f3f}.contributor-governance-message.success{color:#315f42}
      @media(max-width:650px){.contributor-governance-row,.contributor-governance-head{align-items:stretch;flex-direction:column}.contributor-governance-actions{justify-content:flex-start}}
    `;
    document.head.append(style);
  }

  function ensureModal() {
    if (document.getElementById('contributor-governance-modal')) return;
    const backdrop = document.createElement('div');
    backdrop.id = 'contributor-governance-modal';
    backdrop.className = 'contributor-governance-backdrop';
    backdrop.hidden = true;
    backdrop.innerHTML = `
      <section class="contributor-governance-modal" role="dialog" aria-modal="true" aria-labelledby="contributor-governance-title">
        <div class="contributor-governance-head">
          <div>
            <p class="eyebrow">CONTRIBUTOR GOVERNANCE</p>
            <h2 id="contributor-governance-title">Manage Contributors</h2>
          </div>
          <button type="button" class="contributor-governance-close" aria-label="Close">×</button>
        </div>
        <div id="contributor-governance-context" class="contributor-governance-context"></div>
        <div id="contributor-governance-list" class="contributor-governance-list"></div>
        <div id="contributor-governance-message" class="contributor-governance-message" role="status"></div>
      </section>
    `;
    document.body.append(backdrop);
    backdrop.querySelector('.contributor-governance-close').addEventListener('click', closeModal);
    backdrop.addEventListener('click', event => { if (event.target === backdrop) closeModal(); });
  }

  function setMessage(text, type = '') {
    const el = document.getElementById('contributor-governance-message');
    if (!el) return;
    el.textContent = text || '';
    el.className = `contributor-governance-message ${type}`.trim();
  }

  function closeModal() {
    const modal = document.getElementById('contributor-governance-modal');
    if (modal) modal.hidden = true;
    currentMetricId = null;
  }

  function metricLabel(card, metricId) {
    const eyebrow = card?.querySelector('.metric-title-block .eyebrow')?.textContent?.trim();
    const name = card?.querySelector('.metric-title-block h3')?.textContent?.trim();
    return [eyebrow || metricId, name].filter(Boolean).join(' · ');
  }

  async function loadContributors(metricId) {
    const { data, error } = await db.rpc('get_metric_contributors', { p_metric_id: metricId });
    if (error) throw error;
    return data || [];
  }

  function updateActiveCount(metricId, rows) {
    const anchor = document.querySelector(`[data-contributor-updates="${CSS.escape(metricId)}"]`);
    const card = anchor?.closest('.metric-card');
    if (!card) return;
    const pipeline = [...card.querySelectorAll('.metric-section')].find(section =>
      section.querySelector(':scope > strong')?.textContent?.trim() === 'Volunteer Pipeline'
    );
    if (!pipeline) return;
    const activeStat = [...pipeline.querySelectorAll('.metric-stat')].find(stat =>
      stat.querySelector('span')?.textContent?.trim() === 'Active'
    );
    const value = activeStat?.querySelector('strong');
    if (value) value.textContent = String(rows.filter(row => row.assignment_status === 'active').length);
  }

  function renderContributors(metricId, rows) {
    const list = document.getElementById('contributor-governance-list');
    if (!list) return;
    if (!rows.length) {
      list.innerHTML = '<div class="contributor-governance-empty">Belum ada contributor assignment untuk metric ini.</div>';
      updateActiveCount(metricId, rows);
      return;
    }

    list.innerHTML = rows.map(row => `
      <article class="contributor-governance-row">
        <div class="contributor-governance-person">
          <strong>${esc(row.volunteer_name || row.volunteer_email)}</strong>
          <span>${esc(row.volunteer_email || '')}</span>
          <span>${esc(row.contribution_mode || '—')} · ${esc(row.committed_hours_month ?? '—')} h/month</span>
          ${row.assignment_status === 'ended' && row.end_reason ? `<span>Ended: ${esc(row.end_reason)}</span>` : ''}
        </div>
        <div class="contributor-governance-actions">
          <span class="badge ${esc(row.assignment_status)}">${esc(row.assignment_status)}</span>
          ${row.assignment_status === 'active' ? `<button type="button" class="contributor-governance-end" data-end-contributor="${row.contributor_id}">End Assignment</button>` : ''}
        </div>
      </article>
    `).join('');

    list.querySelectorAll('[data-end-contributor]').forEach(button => {
      button.addEventListener('click', () => endContributor(Number(button.dataset.endContributor), button));
    });
    updateActiveCount(metricId, rows);
  }

  async function refreshContributors() {
    if (!currentMetricId) return;
    const rows = await loadContributors(currentMetricId);
    renderContributors(currentMetricId, rows);
  }

  async function openModal(metricId, card) {
    currentMetricId = metricId;
    ensureModal();
    document.getElementById('contributor-governance-context').innerHTML = `
      <strong>${esc(metricLabel(card, metricId))}</strong><br>
      Primary dan Supporting Metric Owner dapat mengakhiri contributor assignment. Lifecycle contributor hanya Active / Ended.
    `;
    document.getElementById('contributor-governance-list').innerHTML = '<div class="contributor-governance-empty">Memuat contributors…</div>';
    setMessage('');
    document.getElementById('contributor-governance-modal').hidden = false;
    try {
      await refreshContributors();
    } catch (error) {
      console.error(error);
      setMessage(error.message || 'Gagal memuat contributor assignments.', 'error');
    }
  }

  async function endContributor(contributorId, button) {
    if (!window.confirm('End contributor assignment ini?')) return;
    const reason = window.prompt('Alasan mengakhiri contributor assignment:')?.trim() || '';
    if (!reason) {
      setMessage('Assignment tidak diakhiri karena alasan wajib diisi.', 'error');
      return;
    }

    try {
      button.disabled = true;
      setMessage('Saving…');
      const { error } = await db.rpc('end_metric_contributor_assignment', {
        p_contributor_id: contributorId,
        p_reason: reason
      });
      if (error) throw error;
      await refreshContributors();
      setMessage('Contributor assignment berhasil diakhiri.', 'success');
    } catch (error) {
      console.error(error);
      setMessage(error.message || 'Gagal mengakhiri contributor assignment.', 'error');
    } finally {
      button.disabled = false;
    }
  }

  function enhanceCards() {
    document.querySelectorAll('.metric-card').forEach(card => {
      const contributorUpdates = card.querySelector('[data-contributor-updates]');
      if (!contributorUpdates) return; // read-only reviewer cards are intentionally ignored.

      const supporting = Boolean(card.querySelector('.badge.supporting'));
      const skillButton = card.querySelector('[data-manage-skills]');
      if (supporting && skillButton) skillButton.hidden = true;

      if (card.querySelector('[data-manage-contributors]')) return;
      const metricId = contributorUpdates.dataset.contributorUpdates;
      if (!metricId) return;

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'secondary-button metric-action-button';
      button.dataset.manageContributors = metricId;
      button.textContent = 'Manage Contributors';
      button.addEventListener('click', () => openModal(metricId, card));
      contributorUpdates.insertAdjacentElement('afterend', button);
    });
  }

  function queueEnhance() {
    if (renderQueued) return;
    renderQueued = true;
    requestAnimationFrame(() => {
      renderQueued = false;
      enhanceCards();
    });
  }

  installStyles();
  ensureModal();
  queueEnhance();
  new MutationObserver(queueEnhance).observe(document.body, { childList: true, subtree: true });
})();