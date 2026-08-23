/**
 * PortfolioQualityScore
 *
 * A plan-neutral readiness check shown before export/publishing.  It is
 * intentionally pure so it can be tested without a browser or a Supabase
 * session, and it only evaluates content quality (never paid entitlements).
 */

const text = value => String(value ?? '').trim();

const hasItems = value => Array.isArray(value) && value.some(item => {
  if (typeof item === 'string') return Boolean(text(item));
  return Boolean(item && Object.values(item).some(field => text(field)));
});

const hasContact = social => {
  if (!social || typeof social !== 'object') return false;
  return ['email', 'github', 'linkedin', 'website', 'twitter'].some(key => text(social[key]));
};

export const QUALITY_CHECKS = [
  { id: 'identity', label: 'Name and professional title', weight: 12, action: 'profile' },
  { id: 'bio', label: 'A clear professional bio', weight: 10, action: 'profile' },
  { id: 'avatar', label: 'Profile photo or avatar', weight: 8, action: 'profile' },
  { id: 'skills', label: 'At least three skills', weight: 12, action: 'skills' },
  { id: 'projects', label: 'At least one project with details', weight: 14, action: 'projects' },
  { id: 'experience', label: 'Experience or education', weight: 10, action: 'profile' },
  { id: 'contact', label: 'A contact or social link', weight: 10, action: 'profile' },
  { id: 'resume', label: 'Resume/CV attached', weight: 6, action: 'profile' },
  { id: 'theme', label: 'A visual theme selected', weight: 8, action: 'design' },
  { id: 'slug', label: 'A shareable portfolio URL', weight: 10, action: 'publish' }
];

export function calculatePortfolioQualityScore(portfolio = {}) {
  const skills = Array.isArray(portfolio.skills) ? portfolio.skills.filter(item => text(typeof item === 'string' ? item : item?.name)) : [];
  const projects = Array.isArray(portfolio.projects) ? portfolio.projects.filter(project => project && (text(project.name) || text(project.title) || text(project.description))) : [];
  const draft = {
    identity: Boolean(text(portfolio.name) && text(portfolio.profession)),
    bio: Boolean(text(portfolio.bio) || text(portfolio.tagline)),
    avatar: Boolean(text(portfolio.avatar) || text(portfolio.avatarUrl) || text(portfolio.avatar_url)),
    skills: skills.length >= 3,
    projects: projects.length >= 1,
    experience: hasItems(portfolio.experience) || hasItems(portfolio.education),
    contact: hasContact(portfolio.social) || Boolean(text(portfolio.email)),
    resume: Boolean(text(portfolio.resume?.url) || text(portfolio.resume?.path) || text(portfolio.resume?.fileName)),
    theme: Boolean(text(portfolio.theme)),
    slug: Boolean(text(portfolio.slug) || text(portfolio.publicSlug) || text(portfolio.public_slug))
  };

  const earned = QUALITY_CHECKS.reduce((sum, check) => sum + (draft[check.id] ? check.weight : 0), 0);
  const checks = QUALITY_CHECKS.map(check => ({ ...check, complete: draft[check.id] }));
  const completeCount = checks.filter(check => check.complete).length;
  const level = earned >= 85 ? 'ready' : earned >= 60 ? 'good' : 'needs-work';
  return {
    score: earned,
    level,
    completeCount,
    totalCount: checks.length,
    checks,
    missing: checks.filter(check => !check.complete)
  };
}

const levelCopy = {
  ready: { label: 'Ready to share', color: '#34d399', icon: '✓' },
  good: { label: 'Almost ready', color: '#fbbf24', icon: '↗' },
  'needs-work': { label: 'Build your first impression', color: '#fb7185', icon: '!' }
};

/** Returns static markup only; user-entered text is never interpolated. */
export function renderPortfolioQualityScore(portfolio = {}) {
  const result = calculatePortfolioQualityScore(portfolio);
  const copy = levelCopy[result.level];
  const missing = result.missing.slice(0, 3);
  const remainder = Math.max(0, result.missing.length - missing.length);
  const actionMarkup = missing.map(check => `
    <li class="quality-score__item quality-score__item--missing">
      <span aria-hidden="true">○</span>
      <span>${check.label}</span>
      <button type="button" class="quality-score__action" onclick="window.handlePortfolioQualityAction('${check.action}')">Improve</button>
    </li>
  `).join('');
  const completeMarkup = result.checks.filter(check => check.complete).slice(0, 2).map(check => `
    <li class="quality-score__item quality-score__item--complete"><span aria-hidden="true">✓</span><span>${check.label}</span></li>
  `).join('');

  return `
    <section id="portfolio-quality-score" class="quality-score quality-score--${result.level}" aria-labelledby="portfolio-quality-title" data-score="${result.score}">
      <div class="quality-score__head">
        <div>
          <p class="quality-score__eyebrow">PUBLISH CHECK</p>
          <h3 id="portfolio-quality-title">Portfolio quality score</h3>
          <p class="quality-score__summary">${result.completeCount} of ${result.totalCount} essentials are complete.</p>
        </div>
        <div class="quality-score__circle" style="--quality-score:${result.score};--quality-color:${copy.color}" aria-label="${result.score} out of 100">
          <strong>${result.score}</strong><span>/100</span>
        </div>
      </div>
      <div class="quality-score__bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${result.score}" aria-label="Portfolio quality score">
        <span style="width:${result.score}%"></span>
      </div>
      <div class="quality-score__status" style="color:${copy.color}"><span aria-hidden="true">${copy.icon}</span> ${copy.label}</div>
      <ul class="quality-score__list">
        ${actionMarkup || '<li class="quality-score__item quality-score__item--complete"><span aria-hidden="true">✓</span><span>All key sections are complete.</span></li>'}
        ${completeMarkup}
      </ul>
      ${remainder ? `<p class="quality-score__more">+${remainder} more item${remainder === 1 ? '' : 's'} to review</p>` : ''}
      <p class="quality-score__hint">This is a helpful checklist, not a paywall. Your plan limits remain unchanged.</p>
    </section>
  `;
}

export function getPortfolioQualityScoreStyles() {
  return `
    .quality-score{margin:0 0 16px;padding:18px;border:1px solid rgba(124,58,237,.3);border-radius:18px;background:linear-gradient(135deg,rgba(124,58,237,.12),rgba(6,182,212,.05));color:#fff;box-shadow:0 10px 28px rgba(0,0,0,.16)}
    .quality-score__head{display:flex;align-items:center;justify-content:space-between;gap:14px}.quality-score__eyebrow{margin:0 0 5px;font-size:.65rem;font-weight:900;letter-spacing:1.4px;color:#c084fc}.quality-score h3{margin:0 0 4px;font-size:1rem}.quality-score__summary,.quality-score__hint,.quality-score__more{margin:0;color:rgba(255,255,255,.62);font-size:.75rem;line-height:1.45}.quality-score__circle{width:62px;height:62px;flex:0 0 62px;border:3px solid var(--quality-color);border-radius:50%;display:flex;flex-direction:column;align-items:center;justify-content:center;box-shadow:0 0 18px color-mix(in srgb,var(--quality-color),transparent 65%)}.quality-score__circle strong{font-size:1.2rem;line-height:1}.quality-score__circle span{font-size:.58rem;color:rgba(255,255,255,.6)}.quality-score__bar{height:7px;margin:14px 0 8px;overflow:hidden;border-radius:10px;background:rgba(255,255,255,.1)}.quality-score__bar span{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#7c3aed,#06b6d4);transition:width .35s ease}.quality-score__status{font-size:.76rem;font-weight:800;margin-bottom:8px}.quality-score__list{display:grid;gap:6px;margin:0 0 8px;padding:0;list-style:none}.quality-score__item{display:flex;align-items:center;gap:7px;min-height:28px;font-size:.74rem;color:rgba(255,255,255,.76)}.quality-score__item--missing>span:first-child{color:#fb7185}.quality-score__item--complete>span:first-child{color:#34d399;font-weight:900}.quality-score__action{margin-left:auto;min-height:32px;padding:5px 10px;border:1px solid rgba(255,255,255,.16);border-radius:7px;background:rgba(255,255,255,.06);color:#fff;font-size:.68rem;font-weight:800;cursor:pointer}.quality-score__action:hover{border-color:#a855f7;background:rgba(124,58,237,.2)}
    @media (max-width:560px){.quality-score{padding:15px}.quality-score__head{align-items:flex-start}.quality-score__circle{width:54px;height:54px;flex-basis:54px}.quality-score__item{font-size:.72rem}.quality-score__action{min-height:36px;padding:6px 9px}.quality-score__hint{font-size:.68rem}}
  `;
}

