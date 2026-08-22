/**
 * FirstRunChecklist.js
 * Dismissible first-run checklist overlay for Studio workspace.
 */

export function renderFirstRunChecklist(container, portfolioData = {}) {
  if (!container) return;

  const hasAvatar = Boolean(portfolioData.avatar);
  const hasResume = Boolean(portfolioData.resume);
  const hasProjects = Array.isArray(portfolioData.projects) && portfolioData.projects.length > 0;
  const isPublished = Boolean(portfolioData.published_at);

  const checklistEl = document.createElement('div');
  checklistEl.id = 'first-run-checklist-overlay';
  checklistEl.className = 'first-run-checklist';
  checklistEl.style.cssText = `
    position: fixed; bottom: 24px; right: 24px; z-index: 900; width: 320px;
    background: rgba(5,5,12,0.92); border: 1px solid rgba(124,58,237,0.3); border-radius: 16px;
    padding: 20px; box-shadow: 0 10px 40px rgba(0,0,0,0.8); backdrop-filter: blur(20px);
    font-family: 'Inter', sans-serif; color: #fff;
  `;

  checklistEl.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
      <div style="font-family: 'Outfit', sans-serif; font-size: 1rem; font-weight: 800; color: #fff;">
        ⚡ Launch Checklist
      </div>
      <button onclick="document.getElementById('first-run-checklist-overlay').remove()" style="background: none; border: none; color: rgba(255,255,255,0.4); cursor: pointer; font-size: 1.1rem;">✕</button>
    </div>

    <div style="display: flex; flex-direction: column; gap: 10px; font-size: 0.85rem; color: rgba(255,255,255,0.85);">
      <div style="display: flex; align-items: center; gap: 10px;">
        <span style="color: #10b981; font-weight: bold;">✓</span>
        <span>Profile & Bio Created</span>
      </div>

      <div style="display: flex; align-items: center; gap: 10px;">
        <span style="color: #10b981; font-weight: bold;">✓</span>
        <span>3D Theme Selected</span>
      </div>

      <div style="display: flex; align-items: center; gap: 10px;">
        <span style="color: ${hasProjects ? '#10b981' : 'rgba(255,255,255,0.3)'}; font-weight: bold;">${hasProjects ? '✓' : '○'}</span>
        <span>Add Project Media</span>
      </div>

      <div style="display: flex; align-items: center; gap: 10px;">
        <span style="color: ${hasResume ? '#10b981' : 'rgba(255,255,255,0.3)'}; font-weight: bold;">${hasResume ? '✓' : '○'}</span>
        <span>Upload PDF Resume</span>
      </div>

      <div style="display: flex; align-items: center; gap: 10px;">
        <span style="color: ${isPublished ? '#10b981' : 'rgba(255,255,255,0.3)'}; font-weight: bold;">${isPublished ? '✓' : '○'}</span>
        <span>Publish Live Portfolio</span>
      </div>
    </div>
  `;

  container.appendChild(checklistEl);
}
