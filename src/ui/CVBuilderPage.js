import { createEmptyCareerProfile, listCareerProfiles, saveCareerProfile } from '../services/CareerProfileService.js';
import { getCVTemplate } from '../config/CVTemplateConfig.js';
import { buildCVExportModel, exportCareerProfilePdf, downloadPdfBytes, recordCareerPdfExport, safeCVFileName } from '../services/CVExportService.js';
import { renderCVTargetedVariantsPanel } from './CVTargetedVariantsPanel.js';
import { renderCVImportReviewPanel } from './CVImportReviewPanel.js';

function escape(value = '') {
  return String(value).replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}

export function renderCVBuilderPage(container, { ownerUserId = 'local-dev-user', profileId = null } = {}) {
  const profile = profileId
    ? listCareerProfiles(ownerUserId).find(item => item.id === profileId)
    : listCareerProfiles(ownerUserId)[0];
  const active = profile || createEmptyCareerProfile({ ownerUserId });
  let saveTimer;
  const syncUrl = `/studio?cv_sync_profile=${encodeURIComponent(active.id)}`;

  container.innerHTML = `
    <main class="career-studio-page" data-career-studio>
      <nav class="career-product-nav" aria-label="Product navigation">
        <a href="/">Home</a><a href="/cv">CV Builder</a><a href="/studio">Portfolio Studio</a><a href="/pricing">Pricing</a><a href="/studio?account=1">Account</a>
      </nav>
      <header class="career-studio-header">
        <a href="/" class="career-studio-back">← Home</a>
        <div><span class="career-studio-kicker">CAREER STUDIO</span><h1>Build your ATS-ready CV</h1><p>Your information stays private while you edit. Nothing is published from this page.</p></div>
        <a href="/studio" class="career-studio-link">Open Portfolio Studio</a>
      </header>
      <section class="career-studio-grid">
        <form id="career-profile-form" class="career-studio-form">
          <label>Career stage
            <select name="careerStage"><option value="student" ${active.careerStage === 'student' ? 'selected' : ''}>Student / early career</option><option value="professional" ${active.careerStage === 'professional' ? 'selected' : ''}>Working professional</option></select>
          </label>
          <label>Full name<input name="name" value="${escape(active.content.contact.name)}" autocomplete="name" required></label>
          <label>Email<input name="email" type="email" value="${escape(active.content.contact.email)}" autocomplete="email"></label>
          <label>Phone<input name="phone" value="${escape(active.content.contact.phone)}" autocomplete="tel"></label>
          <label>Location<input name="location" value="${escape(active.content.contact.location)}"></label>
          <label>LinkedIn URL<input name="linkedin" type="url" value="${escape(active.content.contact.linkedin)}" placeholder="https://linkedin.com/in/you"></label>
          <label>GitHub URL<input name="github" type="url" value="${escape(active.content.contact.github)}" placeholder="https://github.com/you"></label>
          <label>Professional summary<textarea name="summary" rows="5" placeholder="Write only what is true about your experience.">${escape(active.content.summary)}</textarea></label>
          <label>Skills<input name="skills" value="${escape(active.content.skills.join(', '))}" placeholder="JavaScript, Figma, SQL"></label>
          <label>Education<textarea name="education" rows="4" placeholder="Degree — Institution — dates">${escape(active.content.education.map(item => item.text || '').join('\n'))}</textarea></label>
          <label>Experience / training<textarea name="experience" rows="6" placeholder="One role or training item per line">${escape(active.content.experience.map(item => item.text || '').join('\n'))}</textarea></label>
          <div class="career-studio-actions"><button type="submit">Save draft</button><button type="button" data-preview>ATS Preview</button><button type="button" data-export>Export PDF</button><span id="career-save-status" aria-live="polite">Draft</span></div>
          <div class="career-sync-cta"><strong>Optional next step</strong><span>Review selected CV fields before adding anything to a Portfolio.</span><a href="${syncUrl}">Create Portfolio From My CV →</a></div>
          <div id="cv-import-review-container" aria-label="Private CV import"></div>
        </form>
        <aside class="career-studio-preview" id="career-ats-preview" aria-label="ATS preview">
          <div class="ats-paper"><h2 data-preview-name>Your Name</h2><p data-preview-contact class="ats-contact"></p><div data-preview-sections></div></div>
          <small>Template: ${escape(getCVTemplate('ats-basic').name)} · private draft</small>
        </aside>
      </section>
      <section id="cv-targeted-variants-container" aria-label="Private targeted CV variants"></section>
    </main>`;

  const form = container.querySelector('#career-profile-form');
  const status = container.querySelector('#career-save-status');
  const collect = () => {
    const data = new FormData(form);
    const lines = key => String(data.get(key) || '').split('\n').map(text => text.trim()).filter(Boolean).map(text => ({ text }));
    return { ...active, careerStage: data.get('careerStage'), content: { ...active.content, contact: { ...active.content.contact, name: data.get('name') || '', email: data.get('email') || '', phone: data.get('phone') || '', location: data.get('location') || '', linkedin: data.get('linkedin') || '', github: data.get('github') || '' }, summary: data.get('summary') || '', skills: String(data.get('skills') || '').split(',').map(item => item.trim()).filter(Boolean), education: lines('education'), experience: lines('experience') } };
  };
  const updatePreview = () => {
    const next = collect();
    renderPreview(next);
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => { saveCareerProfile(next, ownerUserId); status.textContent = 'Autosaved locally'; }, 500);
  };
  form.addEventListener('input', updatePreview);
  form.addEventListener('change', updatePreview);
  form.addEventListener('submit', event => { event.preventDefault(); saveCareerProfile(collect(), ownerUserId); status.textContent = 'Saved locally'; });
  container.querySelector('[data-preview]').addEventListener('click', () => container.querySelector('#career-ats-preview').scrollIntoView({ behavior: 'smooth', block: 'center' }));
  let exportBusy = false;
  container.querySelector('[data-export]').addEventListener('click', async () => {
    if (exportBusy) return;
    exportBusy = true;
    const button = container.querySelector('[data-export]');
    button.disabled = true;
    status.textContent = 'Preparing PDF…';
    try {
      const next = saveCareerProfile(collect(), ownerUserId);
      const result = await exportCareerProfilePdf(next);
      downloadPdfBytes(result.bytes, safeCVFileName(next));
      const eventKey = `cvexp_${next.id}_${next.updatedAt}`.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 120);
      const recorded = await recordCareerPdfExport({ careerProfileId: next.id, pageCount: result.pageCount, idempotencyKey: eventKey });
      if (!recorded.success) throw new Error(recorded.error);
      status.textContent = `PDF downloaded · ${result.pageCount} page${result.pageCount === 1 ? '' : 's'}`;
    } catch (error) {
      status.textContent = error?.message || 'PDF export failed; no export was counted.';
    } finally {
      exportBusy = false;
      button.disabled = false;
    }
  });
  const renderPreview = next => {
    const model = buildCVExportModel(next);
    container.querySelector('[data-preview-name]').textContent = model.name;
    const contact = container.querySelector('[data-preview-contact]');
    contact.textContent = model.contactLines.join(' · ');
    contact.hidden = !model.contactLines.length;
    const sections = container.querySelector('[data-preview-sections]');
    sections.replaceChildren();
    for (const section of model.sections) {
      const heading = document.createElement('h3');
      heading.textContent = section.title;
      const body = document.createElement('div');
      body.className = 'ats-section-body';
      body.textContent = section.lines.join(' | ');
      sections.append(heading, body);
    }
  };
  renderPreview(active);
  if (!profile) saveCareerProfile(active, ownerUserId);
  renderCVImportReviewPanel(container.querySelector('#cv-import-review-container'), {
    ownerUserId,
    getBaseProfile: collect,
    onSaved: saved => { window.location.href = `/cv?profile=${encodeURIComponent(saved.id)}`; }
  });
  renderCVTargetedVariantsPanel(container.querySelector('#cv-targeted-variants-container'), {
    ownerUserId,
    getBaseProfile: collect
  });
}
