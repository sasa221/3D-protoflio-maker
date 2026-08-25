import { buildCVQualityChecklist } from '../services/CVQualityScoreService.js';

const escape = value => String(value || '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));

export function renderCVQualityChecklistPanel(container, { getProfile, onFix } = {}) {
  if (!container) return { refresh: () => {} };

  const refresh = () => {
    const checklist = buildCVQualityChecklist(getProfile?.() || {});
    container.innerHTML = `<section class="cv-quality-check" aria-labelledby="cv-quality-title"><div class="cv-quality-head"><div><span class="career-studio-kicker">QUALITY CHECKLIST</span><h2 id="cv-quality-title">${escape(checklist.label)}</h2><p>${escape(checklist.disclaimer)}</p></div><div class="cv-quality-score" aria-label="CV completeness score ${checklist.score} out of 100"><strong>${checklist.score}</strong><span>/ 100</span></div></div><div class="cv-quality-meter" aria-hidden="true"><span style="width:${checklist.score}%"></span></div><div class="cv-quality-breakdown">${checklist.breakdown.map(item => `<article class="cv-quality-row cv-quality-${escape(item.tone)}"><div><strong>${escape(item.label)}</strong><span>${item.applicable ? `${item.earned}/${item.max} points` : 'Not required for this stage'}</span></div><p>${escape(item.reason)}</p><button type="button" data-cv-quality-fix="${escape(item.fixSection)}">Fix this</button></article>`).join('')}</div></section>`;
    container.querySelectorAll('[data-cv-quality-fix]').forEach(button => button.addEventListener('click', () => onFix?.(button.dataset.cvQualityFix)));
  };
  refresh();
  return { refresh };
}
