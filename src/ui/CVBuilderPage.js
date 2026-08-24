import { createEmptyCareerProfile, listCareerProfiles, saveCareerProfile } from '../services/CareerProfileService.js';
import { getCVTemplate } from '../config/CVTemplateConfig.js';

function escape(value = '') {
  return String(value).replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}

export function renderCVBuilderPage(container, { ownerUserId = 'local-dev-user', profileId = null } = {}) {
  const profile = profileId
    ? listCareerProfiles(ownerUserId).find(item => item.id === profileId)
    : listCareerProfiles(ownerUserId)[0];
  const active = profile || createEmptyCareerProfile({ ownerUserId });
  let saveTimer;

  container.innerHTML = `
    <main class="career-studio-page" data-career-studio>
      <header class="career-studio-header">
        <a href="/" class="career-studio-back">← Home</a>
        <div><span class="career-studio-kicker">CAREER STUDIO</span><h1>Build your ATS-ready CV</h1><p>Your information stays private while you edit.</p></div>
        <a href="/studio" class="career-studio-link">Open Portfolio Studio</a>
      </header>
      <section class="career-studio-grid">
        <form id="career-profile-form" class="career-studio-form">
          <label>Career stage
            <select name="careerStage"><option value="student" ${active.careerStage === 'student' ? 'selected' : ''}>Student / early career</option><option value="professional" ${active.careerStage === 'professional' ? 'selected' : ''}>Working professional</option></select>
          </label>
          <label>Full name<input name="name" value="${escape(active.content.contact.name)}" autocomplete="name" required></label>
          <label>Email<input name="email" type="email" value="${escape(active.content.contact.email)}" autocomplete="email"></label>
          <label>Location<input name="location" value="${escape(active.content.contact.location)}"></label>
          <label>Professional summary<textarea name="summary" rows="5" placeholder="Write only what is true about your experience.">${escape(active.content.summary)}</textarea></label>
          <label>Skills<input name="skills" value="${escape(active.content.skills.join(', '))}" placeholder="JavaScript, Figma, SQL"></label>
          <label>Education<textarea name="education" rows="4" placeholder="Degree — Institution — dates">${escape(active.content.education.map(item => item.text || '').join('\n'))}</textarea></label>
          <label>Experience / training<textarea name="experience" rows="6" placeholder="One role or training item per line">${escape(active.content.experience.map(item => item.text || '').join('\n'))}</textarea></label>
          <div class="career-studio-actions"><button type="submit">Save draft</button><button type="button" data-preview>ATS Preview</button><span id="career-save-status" aria-live="polite">Draft</span></div>
        </form>
        <aside class="career-studio-preview" id="career-ats-preview" aria-label="ATS preview">
          <div class="ats-paper"><h2 data-preview-name>${escape(active.content.contact.name || 'Your Name')}</h2><p data-preview-summary>${escape(active.content.summary || 'Your professional summary will appear here.')}</p><h3>Skills</h3><p data-preview-skills>${escape(active.content.skills.join(' · ') || 'Add your skills')}</p><h3>Education</h3><div data-preview-education>${escape(active.content.education.map(item => item.text || '').join(' | ') || 'Add your education')}</div><h3>Experience</h3><div data-preview-experience>${escape(active.content.experience.map(item => item.text || '').join(' | ') || 'Add your experience or training')}</div></div>
          <small>Template: ${escape(getCVTemplate('ats-basic').name)} · private draft</small>
        </aside>
      </section>
    </main>`;

  const form = container.querySelector('#career-profile-form');
  const status = container.querySelector('#career-save-status');
  const collect = () => {
    const data = new FormData(form);
    const lines = key => String(data.get(key) || '').split('\n').map(text => text.trim()).filter(Boolean).map(text => ({ text }));
    return { ...active, careerStage: data.get('careerStage'), content: { ...active.content, contact: { ...active.content.contact, name: data.get('name') || '', email: data.get('email') || '', location: data.get('location') || '' }, summary: data.get('summary') || '', skills: String(data.get('skills') || '').split(',').map(item => item.trim()).filter(Boolean), education: lines('education'), experience: lines('experience') } };
  };
  const updatePreview = () => {
    const next = collect();
    container.querySelector('[data-preview-name]').textContent = next.content.contact.name || 'Your Name';
    container.querySelector('[data-preview-summary]').textContent = next.content.summary || 'Your professional summary will appear here.';
    container.querySelector('[data-preview-skills]').textContent = next.content.skills.join(' · ') || 'Add your skills';
    container.querySelector('[data-preview-education]').textContent = next.content.education.map(item => item.text).join(' | ') || 'Add your education';
    container.querySelector('[data-preview-experience]').textContent = next.content.experience.map(item => item.text).join(' | ') || 'Add your experience or training';
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => { saveCareerProfile(next, ownerUserId); status.textContent = 'Autosaved locally'; }, 500);
  };
  form.addEventListener('input', updatePreview);
  form.addEventListener('change', updatePreview);
  form.addEventListener('submit', event => { event.preventDefault(); saveCareerProfile(collect(), ownerUserId); status.textContent = 'Saved locally'; });
  container.querySelector('[data-preview]').addEventListener('click', () => container.querySelector('#career-ats-preview').scrollIntoView({ behavior: 'smooth', block: 'center' }));
  if (!profile) saveCareerProfile(active, ownerUserId);
}

