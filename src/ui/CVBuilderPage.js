import { createEmptyCareerProfile, listCareerProfiles, normalizeCareerProfile, saveCareerProfile } from '../services/CareerProfileService.js';
import { getCVTemplate } from '../config/CVTemplateConfig.js';
import { buildCVExportModel, exportCareerProfilePdf, downloadPdfBytes, recordCareerPdfExport, safeCVFileName } from '../services/CVExportService.js';
import { renderCVTargetedVariantsPanel } from './CVTargetedVariantsPanel.js';
import { renderCVImportReviewPanel } from './CVImportReviewPanel.js';
import { renderCVQualityChecklistPanel } from './CVQualityChecklistPanel.js';
import { getCVStageGuidance } from '../services/CVQualityScoreService.js';

function escape(value = '') {
  return String(value).replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}

const COLLECTIONS = {
  experience: { title: 'Experience', add: '+ Add experience', fields: [['role', 'Role / title', 'e.g. Front-End Developer'], ['organization', 'Organization', 'e.g. Company or client'], ['startDate', 'From', 'e.g. Jan 2024'], ['endDate', 'To', 'e.g. Present'], ['details', 'Summary', 'What you delivered and the impact', 'textarea'], ['bullets', 'Achievements / bullets', 'One achievement per line', 'textarea']] },
  education: { title: 'Education', add: '+ Add education', fields: [['institution', 'University / institution', 'e.g. Helwan University'], ['degree', 'Degree', 'e.g. Bachelor of Computer Science'], ['field', 'Field of study', 'e.g. Computer Science'], ['startDate', 'From', 'e.g. 2022'], ['endDate', 'To', 'e.g. 2026 or Present'], ['grade', 'GPA / grade', 'e.g. 3.35'], ['details', 'Details', 'Coursework or achievements', 'textarea']] },
  projects: { title: 'Projects', add: '+ Add project', fields: [['name', 'Project name', 'e.g. E-commerce website'], ['role', 'Your role', 'e.g. Front-End Developer'], ['startDate', 'From', 'e.g. Jan 2025'], ['endDate', 'To', 'e.g. Mar 2025'], ['url', 'Project link', 'https://...'], ['details', 'Details and results', 'What you built, used and achieved', 'textarea'], ['bullets', 'Highlights / bullets', 'One result per line', 'textarea']] },
  training: { title: 'Training & courses', add: '+ Add training', fields: [['name', 'Training / course name', 'e.g. Front-End Development'], ['provider', 'Provider / organization', 'e.g. NTI'], ['startDate', 'From', 'e.g. Jul 2025'], ['endDate', 'To', 'e.g. Aug 2025'], ['details', 'Details', 'Topics, practical work and achievements', 'textarea']] },
  certifications: { title: 'Certifications', add: '+ Add certification', fields: [['name', 'Certificate name', 'e.g. Meta Front-End Certificate'], ['issuer', 'Issuer', 'e.g. Coursera / Google'], ['date', 'Date', 'e.g. 2025'], ['details', 'Details', 'Credential or relevant topics', 'textarea']] },
  activities: { title: 'Activities & volunteering', add: '+ Add activity', fields: [['title', 'Role / activity', 'e.g. IEEE volunteer'], ['organization', 'Organization', 'e.g. Student chapter'], ['startDate', 'From', 'e.g. 2024'], ['endDate', 'To', 'e.g. Present'], ['details', 'Details', 'Contribution and outcomes', 'textarea'], ['bullets', 'Highlights / bullets', 'One item per line', 'textarea']] }
};

function renderSkillsSection(items = []) {
  const categories = ['Programming & Tools', 'Data Analysis', 'Interpersonal Skills', 'Languages'];
  const rows = (Array.isArray(items) ? items : []).map(item => typeof item === 'string' ? { text: item, category: categories[0] } : { text: item?.text || item?.name || '', category: item?.category || categories[0] }).filter(item => item.text);
  if (!rows.length) rows.push({ text: '', category: categories[0] });
  return `<section class="cv-entry-section cv-skills-section" data-skills-editor><div class="cv-entry-heading"><div><h2>Skills</h2><p>Group skills by category so recruiters can scan them quickly.</p></div><button type="button" data-add-skill>+ Add skill</button></div><div class="cv-skills-list">${rows.map((row, index) => `<div class="cv-skill-row" data-skill-row><select data-skill-category aria-label="Skill category">${categories.map(category => `<option ${row.category === category ? 'selected' : ''}>${escape(category)}</option>`).join('')}</select><input data-skill-name value="${escape(row.text)}" placeholder="e.g. JavaScript"><button type="button" data-remove-skill aria-label="Remove skill ${index + 1}">×</button></div>`).join('')}</div></section>`;
}

function collectionRows(items = []) {
  return (Array.isArray(items) ? items : []).map(item => typeof item === 'string' ? { details: item } : { ...item, details: item?.details || item?.text || item?.description || '', bullets: Array.isArray(item?.bullets) ? item.bullets.join('\n') : (item?.bullets || '') });
}

function normalizeBulletInput(value = '') {
  if (Array.isArray(value)) return value.map(item => String(item || '').trim()).filter(Boolean);
  return String(value || '')
    .replace(/\s*\|\s*/g, '\n')
    .split(/\r?\n+/)
    .map(line => line.replace(/^[•▪◦\-*]\s*/, '').trim())
    .filter(Boolean);
}

function renderEntry(type, row = {}, index = 0) {
  const config = COLLECTIONS[type];
  return `<article class="cv-entry-card" data-entry><div class="cv-entry-card-head"><strong>${config.title} #${index + 1}</strong><button type="button" data-remove-entry>Remove</button></div><div class="cv-entry-fields">${config.fields.map(([key, label, placeholder, control]) => `<label>${label}${control === 'textarea' ? `<textarea data-entry-field="${key}" rows="3" placeholder="${placeholder}">${escape(row[key] || '')}</textarea>` : `<input data-entry-field="${key}" ${key === 'url' ? 'type="url"' : ''} value="${escape(row[key] || '')}" placeholder="${placeholder}">`}</label>`).join('')}</div></article>`;
}

function renderCollection(type, items) {
  const config = COLLECTIONS[type];
  return `<section class="cv-entry-section" data-collection="${type}"><input type="hidden" name="${type}" value="structured"><div class="cv-entry-heading"><div><h2>${config.title}</h2><p>Add each item separately so dates and details stay clear.</p></div><button type="button" data-add-entry="${type}">${config.add}</button></div><div class="cv-entry-list">${collectionRows(items).map((row, index) => renderEntry(type, row, index)).join('')}</div></section>`;
}

export function renderCVBuilderPage(container, { ownerUserId = 'local-dev-user', profileId = null, openImport = false } = {}) {
  // Studio intentionally locks the viewport because its editor owns its own
  // scroll regions. Career Studio is a document page, so explicitly undo
  // those global constraints before rendering; otherwise the lower form and
  // checklist are clipped on direct navigation and wide screens.
  document.documentElement.style.height = 'auto';
  document.documentElement.style.minHeight = '100%';
  document.documentElement.style.overflowX = 'hidden';
  document.documentElement.style.overflowY = 'auto';
  document.body.style.height = 'auto';
  document.body.style.minHeight = '100vh';
  document.body.style.width = '100%';
  document.body.style.overflowX = 'hidden';
  document.body.style.overflowY = 'auto';
  container.style.display = 'block';
  container.style.width = '100%';
  container.style.maxWidth = 'none';
  container.style.height = 'auto';
  container.style.minHeight = '100vh';
  container.style.overflow = 'visible';
  const profile = profileId
    ? listCareerProfiles(ownerUserId).find(item => item.id === profileId)
    : listCareerProfiles(ownerUserId)[0];
  // Normalize again at the UI boundary so a hydrated row with a partial
  // contact object can never render blank Email/Phone inputs while Preview
  // still sees the stored values.
  const active = normalizeCareerProfile(profile || createEmptyCareerProfile({ ownerUserId }), ownerUserId);
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
          <p id="cv-stage-guidance" class="cv-stage-guidance" aria-live="polite"></p>
          <label>Full name<input name="name" value="${escape(active.content.contact.name)}" autocomplete="name" required></label>
          <label>Email<input name="email" type="email" value="${escape(active.content.contact.email)}" autocomplete="email"></label>
          <label>Phone<input name="phone" value="${escape(active.content.contact.phone)}" autocomplete="tel"></label>
          <label>Location<input name="location" value="${escape(active.content.contact.location)}"></label>
          <label>LinkedIn URL<input name="linkedin" type="url" value="${escape(active.content.contact.linkedin)}" placeholder="https://linkedin.com/in/you"></label>
          <label>GitHub URL<input name="github" type="url" value="${escape(active.content.contact.github)}" placeholder="https://github.com/you"></label>
          <label>Website / portfolio URL<input name="website" type="url" value="${escape(active.content.contact.website || '')}" placeholder="https://your-site.com"></label>
          <label>Professional summary<textarea name="summary" rows="5" placeholder="Write only what is true about your experience.">${escape(active.content.summary)}</textarea></label>
          ${renderSkillsSection(active.content.skills)}
          ${renderCollection('education', active.content.education)}
          ${renderCollection('projects', active.content.projects)}
          ${renderCollection('training', active.content.training)}
          ${renderCollection('experience', active.content.experience)}
          ${renderCollection('certifications', active.content.certifications)}
          ${renderCollection('activities', active.content.activities)}
          <div class="career-studio-actions"><button type="submit">Save draft</button><button type="button" data-preview>ATS Preview</button><button type="button" data-export>Export PDF</button><span id="career-save-status" aria-live="polite">Draft</span></div>
          <div class="career-sync-cta"><strong>Optional next step</strong><span>Review selected CV fields before adding anything to a Portfolio.</span><a href="${syncUrl}">Create Portfolio From My CV →</a></div>
          <div id="cv-import-review-container" aria-label="Private CV import"></div>
        </form>
        <aside class="career-studio-preview" id="career-ats-preview" aria-label="ATS preview">
          <div class="ats-paper"><h2 data-preview-name>Your Name</h2><p data-preview-contact class="ats-contact"></p><div data-preview-sections></div></div>
          <small>Template: ${escape(getCVTemplate('ats-basic').name)} · private draft</small>
        </aside>
      </section>
      <section id="cv-quality-container" aria-label="CV completeness checklist"></section>
      <section id="cv-targeted-variants-container" aria-label="Private targeted CV variants"></section>
    </main>`;

  const form = container.querySelector('#career-profile-form');
  const status = container.querySelector('#career-save-status');
  const hydrateFormFields = source => {
    const contact = source?.content?.contact || {};
    const values = {
      careerStage: source?.careerStage || 'professional',
      name: contact.name || '',
      email: contact.email || '',
      phone: contact.phone || '',
      location: contact.location || '',
      linkedin: contact.linkedin || '',
      github: contact.github || '',
      website: contact.website || '',
      summary: source?.content?.summary || '',
      skills: '', experience: ''
    };
    for (const [name, value] of Object.entries(values)) {
      const field = form.elements.namedItem(name);
      if (field && field.value !== String(value)) field.value = String(value);
    }
  };
  // `innerHTML` is the final binding boundary. Reapply the hydrated server
  // snapshot directly to the live controls so no stale cache/child renderer
  // can leave Email or Phone blank while Preview already has them.
  hydrateFormFields(active);
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => hydrateFormFields(active));
  const collect = () => {
    const data = new FormData(form);
    const entries = type => Array.from(form.querySelectorAll(`[data-collection="${type}"] [data-entry]`)).map(card => {
      const row = Object.fromEntries(Array.from(card.querySelectorAll('[data-entry-field]')).map(field => [field.dataset.entryField, field.value.trim()]));
      if ('bullets' in row) row.bullets = normalizeBulletInput(row.bullets);
      if ('details' in row) row.details = String(row.details || '').replace(/\s*\|\s*/g, ' ').replace(/\s+/g, ' ').trim();
      return row;
    }).filter(row => Object.values(row).some(value => Array.isArray(value) ? value.length : value));
    const skills = Array.from(form.querySelectorAll('[data-skill-row]')).map(row => ({ text: row.querySelector('[data-skill-name]')?.value.trim() || '', category: row.querySelector('[data-skill-category]')?.value || '' })).filter(item => item.text);
    return { ...active, careerStage: data.get('careerStage'), content: { ...active.content, contact: { ...active.content.contact, name: data.get('name') || '', email: data.get('email') || '', phone: data.get('phone') || '', location: data.get('location') || '', linkedin: data.get('linkedin') || '', github: data.get('github') || '', website: data.get('website') || '' }, summary: data.get('summary') || '', skills, education: entries('education'), projects: entries('projects'), training: entries('training'), experience: entries('experience'), certifications: entries('certifications'), activities: entries('activities') } };
  };
  const updatePreview = () => {
    const next = collect();
    renderPreview(next);
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => { saveCareerProfile(next, ownerUserId); status.textContent = 'Autosaved locally'; }, 500);
  };
  const qualityPanel = renderCVQualityChecklistPanel(container.querySelector('#cv-quality-container'), {
    getProfile: collect,
    onFix: section => {
      const target = form.querySelector(`[data-collection="${section}"]`) || form.elements.namedItem(section) || form.elements.namedItem(section === 'linkedin' ? 'github' : 'summary');
      target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      (target?.querySelector?.('input:not([type="hidden"]),textarea,button') || target)?.focus();
    }
  });
  const updateStageGuidance = () => {
    const guidance = getCVStageGuidance(form.elements.namedItem('careerStage')?.value);
    const target = container.querySelector('#cv-stage-guidance');
    if (target) target.textContent = guidance.message;
  };
  form.addEventListener('input', () => { updatePreview(); qualityPanel.refresh(); });
  form.addEventListener('change', () => { updatePreview(); qualityPanel.refresh(); updateStageGuidance(); });
  form.addEventListener('click', event => {
    const add = event.target.closest('[data-add-entry]');
    if (add) {
      const type = add.dataset.addEntry;
      const list = form.querySelector(`[data-collection="${type}"] .cv-entry-list`);
      list.insertAdjacentHTML('beforeend', renderEntry(type, {}, list.children.length));
      list.lastElementChild?.querySelector('input,textarea')?.focus();
      updatePreview(); qualityPanel.refresh();
      return;
    }
    const addSkill = event.target.closest('[data-add-skill]');
    if (addSkill) { const list = form.querySelector('.cv-skills-list'); list.insertAdjacentHTML('beforeend', '<div class="cv-skill-row" data-skill-row><select data-skill-category aria-label="Skill category"><option>Programming &amp; Tools</option><option>Data Analysis</option><option>Interpersonal Skills</option><option>Languages</option></select><input data-skill-name placeholder="e.g. JavaScript"><button type="button" data-remove-skill aria-label="Remove skill">×</button></div>'); list.lastElementChild?.querySelector('input')?.focus(); updatePreview(); qualityPanel.refresh(); return; }
    const removeSkill = event.target.closest('[data-remove-skill]');
    if (removeSkill) { removeSkill.closest('[data-skill-row]')?.remove(); updatePreview(); qualityPanel.refresh(); return; }
    const remove = event.target.closest('[data-remove-entry]');
    if (remove) { remove.closest('[data-entry]')?.remove(); updatePreview(); qualityPanel.refresh(); }
  });
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
    contact.replaceChildren();
    const contactParts = [model.contact.email, model.contact.phone, model.contact.location].filter(Boolean);
    contact.append(document.createTextNode(contactParts.join(' · ')));
    for (const [label, url] of [['GitHub', model.contact.github], ['LinkedIn', model.contact.linkedin], ['Website', model.contact.website]]) {
      if (!url) continue;
      if (contact.childNodes.length) contact.append(document.createTextNode(' · '));
      const link = document.createElement('a'); link.href = url; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = label; contact.append(link);
    }
    contact.hidden = !model.contactLines.length;
    const sections = container.querySelector('[data-preview-sections]');
    sections.replaceChildren();
    if (!model.sections.length) {
      const empty = document.createElement('div');
      empty.className = 'ats-empty-preview';
      empty.innerHTML = '<strong>Your CV preview will appear here</strong><span>Add a summary, skill, education, project, or experience entry to build your first draft.</span>';
      sections.append(empty);
    }
    for (const section of model.sections) {
      const heading = document.createElement('h3');
      heading.textContent = section.title;
      const body = document.createElement('div');
      body.className = 'ats-section-body';
      for (const entry of section.entries) {
        const row = document.createElement('article'); row.className = 'ats-entry';
        if (entry.title || entry.dates) {
          const header = document.createElement('div'); header.className = 'ats-entry-header';
          const headerMain = document.createElement('div'); headerMain.className = 'ats-entry-header-main';
          const title = document.createElement('strong'); title.textContent = entry.title;
          const dates = document.createElement('span'); dates.textContent = entry.dates;
          headerMain.append(title);
          if (entry.url) {
            const projectLink = document.createElement('a');
            projectLink.href = entry.url;
            projectLink.target = '_blank';
            projectLink.rel = 'noopener noreferrer';
            projectLink.textContent = ' · View website ↗';
            projectLink.setAttribute('aria-label', `View website for ${entry.title || 'project'}`);
            headerMain.append(projectLink);
          }
          header.append(headerMain, dates);
          row.append(header);
        }
        if (entry.meta) { const meta = document.createElement('div'); meta.className = 'ats-entry-meta'; meta.textContent = entry.meta; row.append(meta); }
        if (entry.grade) { const grade = document.createElement('div'); grade.className = 'ats-entry-grade'; grade.textContent = `GPA: ${entry.grade}`; row.append(grade); }
        if (entry.details) { const details = document.createElement('p'); details.textContent = entry.details; row.append(details); }
        if (entry.bullets?.length) { const list = document.createElement('ul'); list.className = 'ats-entry-bullets'; entry.bullets.forEach(value => { const li = document.createElement('li'); li.textContent = value; list.append(li); }); row.append(list); }
        if (entry.url && !entry.title) { const link = document.createElement('a'); link.href = entry.url; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = 'View project ↗'; row.append(link); }
        body.append(row);
      }
      sections.append(heading, body);
    }
  };
  renderPreview(active);
  updateStageGuidance();
  if (!profile) saveCareerProfile(active, ownerUserId);
  renderCVImportReviewPanel(container.querySelector('#cv-import-review-container'), {
    ownerUserId,
    getBaseProfile: collect,
    autoOpen: openImport,
    onSaved: saved => { window.location.href = `/cv?profile=${encodeURIComponent(saved.id)}`; }
  });
  renderCVTargetedVariantsPanel(container.querySelector('#cv-targeted-variants-container'), {
    ownerUserId,
    getBaseProfile: collect
  });
}
