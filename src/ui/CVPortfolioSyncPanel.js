import { applySelectedPortfolioSync, buildPortfolioSyncReview, getSyncFieldValueForDisplay } from '../services/CVPortfolioSyncService.js';

function esc(value = '') {
  return String(value).replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}

export function openCVPortfolioSyncReview({ careerProfile, portfolio, onApplied }) {
  const review = buildPortfolioSyncReview({ careerProfile, portfolio });
  const existing = document.getElementById('cv-portfolio-sync-overlay');
  if (existing) existing.remove();
  const overlay = document.createElement('div');
  overlay.id = 'cv-portfolio-sync-overlay';
  overlay.className = 'cv-sync-overlay';
  overlay.innerHTML = `
    <section class="cv-sync-card" role="dialog" aria-modal="true" aria-labelledby="cv-sync-title">
      <header class="cv-sync-header"><div><span class="career-studio-kicker">PRIVATE REVIEW</span><h2 id="cv-sync-title">Create Portfolio From My CV</h2><p>Nothing will be published or replaced automatically. Choose exactly what you want to review and transfer.</p></div><button type="button" data-sync-close aria-label="Close review">×</button></header>
      <div class="cv-sync-notice"><strong>Privacy first:</strong> contact details, phone, and location are off by default. Existing projects and experience are merged only as new entries; they are never deleted or replaced.</div>
      <div class="cv-sync-fields" role="group" aria-label="CV to Portfolio fields">
        ${review.map(field => `<label class="cv-sync-field ${field.status === 'empty' ? 'is-empty' : ''}"><input type="checkbox" data-sync-field="${esc(field.id)}" ${field.status === 'empty' ? 'disabled' : ''}><span class="cv-sync-field-copy"><strong>${esc(field.label)}${field.sensitive ? ' · sensitive' : ''}</strong><small>${esc(field.target)} · ${esc(field.status)}</small><span class="cv-sync-values"><em>CV:</em> ${esc(getSyncFieldValueForDisplay(field.sourceValue) || '—')}<br><em>Portfolio:</em> ${esc(getSyncFieldValueForDisplay(field.targetValue) || '—')}</span></span></label>`).join('')}
      </div>
      <label class="cv-sync-option"><input type="checkbox" data-sync-sensitive> I explicitly approve transferring selected sensitive contact details.</label>
      <label class="cv-sync-option"><input type="checkbox" data-sync-overwrite> Allow selected text fields to replace existing values. Lists will still be merged.</label>
      <p class="cv-sync-error" data-sync-error role="alert" hidden></p>
      <footer class="cv-sync-actions"><button type="button" class="cv-sync-cancel" data-sync-close>Cancel</button><button type="button" class="cv-sync-apply" data-sync-apply>Review and apply selected fields</button></footer>
    </section>`;
  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  overlay.querySelectorAll('[data-sync-close]').forEach(button => button.addEventListener('click', close));
  overlay.addEventListener('click', event => { if (event.target === overlay) close(); });
  overlay.querySelector('[data-sync-apply]').addEventListener('click', async () => {
    const selectedFields = [...overlay.querySelectorAll('[data-sync-field]:checked')].map(input => input.dataset.syncField);
    const error = overlay.querySelector('[data-sync-error]');
    if (!selectedFields.length) {
      error.hidden = false;
      error.textContent = 'Select at least one field to continue. Your Portfolio is unchanged.';
      return;
    }
    const button = overlay.querySelector('[data-sync-apply]');
    button.disabled = true;
    error.hidden = true;
    try {
      const result = applySelectedPortfolioSync({
        careerProfile,
        portfolio,
        selectedFields,
        overwriteExisting: overlay.querySelector('[data-sync-overwrite]').checked,
        confirmSensitive: overlay.querySelector('[data-sync-sensitive]').checked,
        ownerUserId: portfolio.owner_user_id || portfolio.ownerUserId
      });
      if (!result.changedFields.length) {
        error.hidden = false;
        error.textContent = result.skippedFields.length ? 'Existing values were kept. Enable replacement if you explicitly want to change them.' : 'No selected fields would change this Portfolio.';
        button.disabled = false;
        return;
      }
      if (typeof onApplied === 'function') await onApplied(result);
      close();
    } catch (syncError) {
      error.hidden = false;
      error.textContent = `${syncError.message || 'Sync was not applied.'} No Portfolio data was changed.`;
      button.disabled = false;
    }
  });
  return { close, review };
}

