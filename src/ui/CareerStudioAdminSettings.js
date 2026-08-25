import {
  adminUpdateCareerSettings
} from '../services/AuthService.js';

const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
}[char]));

export function renderCareerSettingsTab(settings = [], auditLogs = []) {
  const ats = settings.find(item => item.template_id === 'ats-basic') || {
    template_id: 'ats-basic', display_name: 'ATS Basic', enabled: false, free_export_limit: 2
  };
  const safeLogs = (auditLogs || []).slice(0, 50);
  return `
    <section class="career-admin-settings" style="display:grid;gap:18px">
      <div style="background:rgba(139,92,246,.12);border:1px solid rgba(139,92,246,.35);border-radius:12px;padding:18px">
        <h2 style="margin:0 0 6px;color:#fff;font-size:20px">Career Studio local settings</h2>
        <p style="margin:0;color:rgba(255,255,255,.72);font-size:13px">Template availability and the local Free export test limit only. This is not a pricing or billing decision.</p>
      </div>
      <form id="career-settings-form" style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:12px;padding:18px;max-width:680px">
        <input type="hidden" name="templateId" value="ats-basic">
        <div style="display:flex;justify-content:space-between;gap:16px;align-items:center;flex-wrap:wrap">
          <div><strong style="color:#fff;display:block">${escapeHtml(ats.display_name || 'ATS Basic')}</strong><span style="font-size:12px;color:rgba(255,255,255,.58)">Existing basic single-column template</span></div>
          <label style="display:flex;align-items:center;gap:8px;color:#fff;font-size:13px"><input type="checkbox" name="enabled" ${ats.enabled ? 'checked' : ''}> Available locally</label>
        </div>
        <label style="display:block;margin-top:18px;color:rgba(255,255,255,.8);font-size:13px">Local Free export limit per month
          <input name="freeExportLimit" type="number" min="0" max="100" step="1" value="${Number.isInteger(ats.free_export_limit) ? ats.free_export_limit : 2}" style="display:block;margin-top:7px;width:150px;background:#090b12;color:#fff;border:1px solid rgba(255,255,255,.2);border-radius:7px;padding:9px">
        </label>
        <p id="career-settings-status" style="min-height:18px;margin:14px 0 0;font-size:13px"></p>
        <button type="submit" style="margin-top:12px;background:#7c3aed;color:#fff;border:0;border-radius:8px;padding:9px 16px;font-weight:700;cursor:pointer">Save local setting</button>
      </form>
      <div style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.1);border-radius:12px;padding:18px;overflow:auto">
        <h3 style="margin:0 0 12px;color:#fff;font-size:16px">Settings audit</h3>
        <table style="width:100%;border-collapse:collapse;font-size:12px;min-width:620px"><thead><tr style="color:rgba(255,255,255,.55);text-align:left"><th style="padding:8px">Admin ID</th><th style="padding:8px">Action</th><th style="padding:8px">Template</th><th style="padding:8px">Limit</th><th style="padding:8px">Time</th><th style="padding:8px">Result</th></tr></thead><tbody>
          ${safeLogs.length ? safeLogs.map(log => `<tr style="border-top:1px solid rgba(255,255,255,.08);color:rgba(255,255,255,.82)"><td style="padding:8px;font-family:monospace">${escapeHtml(log.admin_user_id)}</td><td style="padding:8px">${escapeHtml(log.action)}</td><td style="padding:8px">${escapeHtml(log.template_id)}</td><td style="padding:8px">${escapeHtml(log.limit_value)}</td><td style="padding:8px">${escapeHtml(log.created_at)}</td><td style="padding:8px">${escapeHtml(log.result)}</td></tr>`).join('') : '<tr><td colspan="6" style="padding:12px;color:rgba(255,255,255,.55)">No settings actions recorded.</td></tr>'}
        </tbody></table>
      </div>
    </section>`;
}

export function installCareerSettingsHandlers({ onSaved } = {}) {
  const form = document.getElementById('career-settings-form');
  if (!form || form.dataset.bound === '1') return;
  form.dataset.bound = '1';
  const status = document.getElementById('career-settings-status');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = form.querySelector('button[type="submit"]');
    const templateId = form.elements.templateId.value;
    const enabled = form.elements.enabled.checked;
    const freeExportLimit = Number(form.elements.freeExportLimit.value);
    if (!Number.isInteger(freeExportLimit) || freeExportLimit < 0 || freeExportLimit > 100) {
      if (status) { status.textContent = 'Enter a whole number from 0 to 100.'; status.style.color = '#fca5a5'; }
      return;
    }
    if (button) button.disabled = true;
    if (status) { status.textContent = 'Saving…'; status.style.color = 'rgba(255,255,255,.7)'; }
    try {
      await adminUpdateCareerSettings({ templateId, enabled, freeExportLimit });
      if (status) { status.textContent = 'Saved locally and recorded in the settings audit.'; status.style.color = '#86efac'; }
      if (typeof onSaved === 'function') await onSaved();
    } catch (error) {
      if (status) { status.textContent = error.message || 'Setting was not changed.'; status.style.color = '#fca5a5'; }
    } finally {
      if (button) button.disabled = false;
    }
  });
}
