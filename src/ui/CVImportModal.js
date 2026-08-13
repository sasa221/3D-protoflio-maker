/**
 * CVImportModal.js
 * Interactive modal dialog for CV upload, processing progress, review, and import customization.
 */

import { extractTextFromPDF } from '../services/PDFTextExtractor.js';
import { CVParserService } from '../services/CVParserService.js';
import { canonicalizeCVData } from '../services/CVCanonicalizer.js';
import { recommendThemesForCandidate, mapCVToPortfolioData } from '../services/CVPortfolioMapper.js';

let modalContainer = null;
let currentCanonicalCV = null;
let currentCVFile = null;
let onImportCallback = null;

export function initCVImportModal(onImport) {
  onImportCallback = onImport;

  let existing = document.getElementById('cv-import-modal');
  if (existing) existing.remove();

  modalContainer = document.createElement('div');
  modalContainer.id = 'cv-import-modal';
  modalContainer.className = 'cv-modal-backdrop';
  modalContainer.style.cssText = `
    display: none; position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
    background: rgba(5, 5, 12, 0.85); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
    z-index: 100000; align-items: center; justify-content: center; padding: 20px;
    box-sizing: border-box; font-family: 'Plus Jakarta Sans', sans-serif; color: #fff;
  `;

  renderDropzoneStep();
  document.body.appendChild(modalContainer);
}

export function openCVImportModal() {
  if (!modalContainer) initCVImportModal(onImportCallback);
  renderDropzoneStep();
  modalContainer.style.display = 'flex';
}

export function closeCVImportModal() {
  if (modalContainer) modalContainer.style.display = 'none';
}

function renderDropzoneStep() {
  modalContainer.innerHTML = `
    <div class="cv-modal-card glass-card" style="
      width: 100%; max-width: 580px; background: rgba(15, 15, 30, 0.95);
      border: 1px solid rgba(124, 58, 237, 0.3); border-radius: 24px; padding: 32px;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.7); position: relative; max-height: 90vh; overflow-y: auto;
    ">
      <button onclick="window.closeCVImportModal()" style="
        position: absolute; top: 20px; right: 20px; background: rgba(255,255,255,0.06);
        border: 1px solid rgba(255,255,255,0.12); color: #fff; border-radius: 50%; width: 32px; height: 32px;
        font-weight: bold; cursor: pointer; display: flex; align-items: center; justify-content: center;
      ">✕</button>

      <div style="text-align: center; margin-bottom: 24px;">
        <div style="font-size: 2.8rem; margin-bottom: 8px;">📄✨</div>
        <h2 style="font-size: 1.4rem; font-weight: 800; margin: 0 0 6px 0;">Import CV & Auto-Build Portfolio</h2>
        <p style="font-size: 0.85rem; color: rgba(255,255,255,0.6); margin: 0; line-height: 1.5;">
          Upload your Resume / CV PDF to instantly extract your professional history, skills, and projects.
        </p>
      </div>

      <div id="cv-dropzone" style="
        border: 2px dashed rgba(124, 58, 237, 0.4); background: linear-gradient(135deg, rgba(124, 58, 237, 0.08), rgba(6, 182, 212, 0.05));
        border-radius: 20px; padding: 36px 20px; text-align: center; cursor: pointer; transition: all 0.3s ease;
      " ondragover="event.preventDefault(); this.style.borderColor='#7c3aed';" ondragleave="this.style.borderColor='rgba(124, 58, 237, 0.4)';" ondrop="handleDropCV(event)">
        <div style="font-size: 2.2rem; margin-bottom: 12px;">📁</div>
        <div style="font-size: 0.95rem; font-weight: 700; margin-bottom: 4px;">Drag & Drop your CV PDF here</div>
        <div style="font-size: 0.78rem; color: rgba(255,255,255,0.5); margin-bottom: 16px;">PDF format supported (Max 10MB)</div>
        <label style="
          padding: 10px 22px; background: linear-gradient(135deg, var(--primary, #7c3aed), var(--secondary, #06b6d4));
          border-radius: 30px; font-size: 0.82rem; font-weight: 800; color: #fff; cursor: pointer; display: inline-block;
        ">
          Browse Computer
          <input type="file" accept=".pdf,application/pdf" style="display: none;" onchange="handleSelectCV(this)"/>
        </label>
      </div>

      <div style="margin-top: 20px; background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.2); border-radius: 12px; padding: 12px; display: flex; align-items: center; gap: 10px;">
        <span style="font-size: 1.2rem;">🔒</span>
        <span style="font-size: 0.75rem; color: rgba(255,255,255,0.7); line-height: 1.4;">
          <strong>Privacy Guarantee:</strong> Your CV contains personal data. Processing runs securely in your browser session.
        </span>
      </div>
    </div>
  `;
}

window.handleSelectCV = function(input) {
  if (input.files && input.files[0]) processCVFile(input.files[0]);
};

window.handleDropCV = function(e) {
  e.preventDefault();
  if (e.dataTransfer.files && e.dataTransfer.files[0]) processCVFile(e.dataTransfer.files[0]);
};

async function processCVFile(file) {
  currentCVFile = file;

  modalContainer.querySelector('.cv-modal-card').innerHTML = `
    <div style="text-align: center; padding: 40px 20px;">
      <div style="font-size: 3rem; margin-bottom: 16px; animation: pulse 1.5s infinite;">⏳</div>
      <h3 id="cv-status-title" style="font-size: 1.2rem; font-weight: 800; margin-bottom: 8px;">Reading CV PDF...</h3>
      <div style="height: 6px; background: rgba(255,255,255,0.1); border-radius: 10px; overflow: hidden; margin: 20px 0;">
        <div id="cv-progress-bar" style="height: 100%; width: 25%; background: linear-gradient(90deg, #7c3aed, #06b6d4); border-radius: 10px; transition: width 0.4s ease;"></div>
      </div>
      <p id="cv-status-sub" style="font-size: 0.8rem; color: rgba(255,255,255,0.5);">Parsing candidate document structure...</p>
    </div>
  `;

  try {
    const updateProgress = (title, sub, pct) => {
      const tEl = document.getElementById('cv-status-title');
      const sEl = document.getElementById('cv-status-sub');
      const bEl = document.getElementById('cv-progress-bar');
      if (tEl) tEl.textContent = title;
      if (sEl) sEl.textContent = sub;
      if (bEl) bEl.style.width = pct + '%';
    };

    updateProgress('Reading CV Text...', 'Extracting raw PDF text structure...', 30);
    const normalizedCV = await extractTextFromPDF(file);

    updateProgress('Analyzing Candidate Profile...', 'Extracting experience, education, and skills...', 60);
    const service = new CVParserService();
    const rawParsed = await service.parse(normalizedCV);

    updateProgress('Canonicalizing & Disambiguating Data...', 'Separating roles, companies, dates, and skills...', 85);
    currentCanonicalCV = canonicalizeCVData(rawParsed);

    updateProgress('Building Preview Screen...', 'Recommending 3D themes and formatting data...', 100);
    setTimeout(() => {
      renderReviewStep();
    }, 400);

  } catch (err) {
    modalContainer.querySelector('.cv-modal-card').innerHTML = `
      <div style="text-align: center; padding: 24px;">
        <div style="font-size: 3rem; margin-bottom: 12px;">❌</div>
        <h3 style="font-size: 1.2rem; font-weight: 800; color: #ef4444; margin-bottom: 8px;">Could Not Read CV File</h3>
        <p style="font-size: 0.85rem; color: rgba(255,255,255,0.7); margin-bottom: 20px;">${err.message || 'Please check that the file is a valid PDF.'}</p>
        <button onclick="renderDropzoneStep()" style="padding: 10px 24px; background: rgba(124,58,237,0.3); border: 1px solid rgba(124,58,237,0.5); border-radius: 20px; color: #fff; font-weight: 700; cursor: pointer;">Try Again</button>
      </div>
    `;
  }
}

function renderReviewStep() {
  if (!currentCanonicalCV) return;

  const themes = recommendThemesForCandidate(currentCanonicalCV);
  let selectedThemeId = themes[0]?.theme?.id || 'code';

  const card = modalContainer.querySelector('.cv-modal-card');
  card.style.maxWidth = '750px';

  const expCount = currentCanonicalCV.experience?.length || 0;
  const eduCount = currentCanonicalCV.education?.length || 0;
  const skillCount = currentCanonicalCV.skills?.length || 0;
  const projCount = currentCanonicalCV.projects?.length || 0;
  const certCount = currentCanonicalCV.certifications?.length || 0;
  const langCount = currentCanonicalCV.languages?.length || 0;

  card.innerHTML = `
    <button onclick="window.closeCVImportModal()" style="
      position: absolute; top: 20px; right: 20px; background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.12); color: #fff; border-radius: 50%; width: 32px; height: 32px;
      font-weight: bold; cursor: pointer; display: flex; align-items: center; justify-content: center;
    ">✕</button>

    <div style="margin-bottom: 20px;">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
        <span style="font-size: 0.72rem; font-weight: 800; color: var(--primary, #7c3aed); letter-spacing: 1.5px; text-transform: uppercase;">✨ Canonical Candidate Model</span>
        <span style="font-size: 0.7rem; color: #10b981; font-weight: 700; background: rgba(16,185,129,0.1); border: 1px solid rgba(16,185,129,0.25); border-radius: 20px; padding: 2px 10px;">Validated & Ready</span>
      </div>
      <h2 style="font-size: 1.3rem; font-weight: 800; margin: 4px 0 12px 0;">Verify & Correct Pre-Import Mapping</h2>

      <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px;">
        <div style="background: rgba(124,58,237,0.15); border: 1px solid rgba(124,58,237,0.3); border-radius: 20px; padding: 6px 14px; font-size: 0.78rem; font-weight: 700;">👤 ${currentCanonicalCV.personal?.name || 'Candidate'}</div>
        <div style="background: rgba(6,182,212,0.15); border: 1px solid rgba(6,182,212,0.3); border-radius: 20px; padding: 6px 14px; font-size: 0.78rem; font-weight: 700;">💼 ${expCount} Role${expCount !== 1 ? 's' : ''}</div>
        <div style="background: rgba(16,185,129,0.15); border: 1px solid rgba(16,185,129,0.3); border-radius: 20px; padding: 6px 14px; font-size: 0.78rem; font-weight: 700;">🎓 ${eduCount} Degree${eduCount !== 1 ? 's' : ''}</div>
        <div style="background: rgba(245,158,11,0.15); border: 1px solid rgba(245,158,11,0.3); border-radius: 20px; padding: 6px 14px; font-size: 0.78rem; font-weight: 700;">⚡ ${skillCount} Tech Skills</div>
        ${langCount > 0 ? `<div style="background: rgba(168,85,247,0.15); border: 1px solid rgba(168,85,247,0.3); border-radius: 20px; padding: 6px 14px; font-size: 0.78rem; font-weight: 700;">🌐 ${langCount} Languages</div>` : ''}
      </div>

      ${currentCanonicalCV.warnings && currentCanonicalCV.warnings.length > 0 ? `
        <div style="background: rgba(245,158,11,0.1); border: 1px solid rgba(245,158,11,0.3); border-radius: 12px; padding: 10px 14px; font-size: 0.78rem; color: #f59e0b; margin-bottom: 16px;">
          ${currentCanonicalCV.warnings.map(w => `<div>⚠️ ${w}</div>`).join('')}
        </div>
      ` : ''}
    </div>

    <!-- PRE-IMPORT MAPPING PREVIEW & INLINE EDITING -->
    <div style="background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 16px; margin-bottom: 20px; max-height: 280px; overflow-y: auto;">
      <div style="font-size: 0.82rem; font-weight: 800; color: var(--primary, #7c3aed); margin-bottom: 12px; letter-spacing: 1px; text-transform: uppercase;">🔍 Exact Pre-Import Mapping Preview (Edit / Swap Below)</div>

      <!-- PERSONAL PREVIEW -->
      <div style="margin-bottom: 14px; padding-bottom: 10px; border-bottom: 1px solid rgba(255,255,255,0.06);">
        <div style="font-size: 0.75rem; font-weight: 700; color: rgba(255,255,255,0.5); margin-bottom: 6px;">PROFILE INFO</div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
          <input class="field-input" id="can-name" value="${currentCanonicalCV.personal.name || ''}" placeholder="Candidate Name" oninput="currentCanonicalCV.personal.name=this.value" style="font-size: 0.8rem; padding: 6px 10px; font-weight: 700;"/>
          <input class="field-input" id="can-headline" value="${currentCanonicalCV.personal.headline || ''}" placeholder="Job Title / Profession" oninput="currentCanonicalCV.personal.headline=this.value" style="font-size: 0.8rem; padding: 6px 10px;"/>
        </div>
      </div>

      <!-- EXPERIENCE MAPPING PREVIEW WITH SWAP BUTTON -->
      <div style="margin-bottom: 14px; padding-bottom: 10px; border-bottom: 1px solid rgba(255,255,255,0.06);">
        <div style="font-size: 0.75rem; font-weight: 700; color: rgba(255,255,255,0.5); margin-bottom: 8px;">EXPERIENCE ROLES (${expCount})</div>
        ${currentCanonicalCV.experience.map((exp, idx) => `
          <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 10px; margin-bottom: 8px;">
            <div style="display: flex; gap: 8px; margin-bottom: 6px; align-items: center;">
              <input class="field-input" id="exp-role-${idx}" value="${exp.role || ''}" placeholder="Role Title" oninput="currentCanonicalCV.experience[${idx}].role=this.value" style="flex: 1; font-size: 0.78rem; padding: 6px 8px; font-weight: 700; color: var(--primary);"/>
              <button onclick="window.swapRoleCompany(${idx})" style="background: rgba(124,58,237,0.2); border: 1px solid rgba(124,58,237,0.4); border-radius: 6px; color: #fff; font-size: 0.7rem; font-weight: 700; padding: 6px 10px; cursor: pointer; white-space: nowrap;" title="Swap Role and Company">🔀 Swap Role/Company</button>
            </div>
            <div style="display: flex; gap: 8px;">
              <input class="field-input" id="exp-company-${idx}" value="${exp.company || ''}" placeholder="Company Name" oninput="currentCanonicalCV.experience[${idx}].company=this.value" style="flex: 1; font-size: 0.78rem; padding: 6px 8px;"/>
              <input class="field-input" value="${exp.startDate || ''}${exp.endDate ? ` — ${exp.endDate}` : ''}" placeholder="Dates" oninput="currentCanonicalCV.experience[${idx}].startDate=this.value" style="width: 140px; font-size: 0.75rem; padding: 6px 8px;"/>
            </div>
          </div>
        `).join('')}
      </div>

      <!-- EDUCATION PREVIEW -->
      ${eduCount > 0 ? `
        <div style="margin-bottom: 14px; padding-bottom: 10px; border-bottom: 1px solid rgba(255,255,255,0.06);">
          <div style="font-size: 0.75rem; font-weight: 700; color: rgba(255,255,255,0.5); margin-bottom: 8px;">EDUCATION DEGREES (${eduCount})</div>
          ${currentCanonicalCV.education.map((edu, idx) => `
            <div style="display: flex; gap: 8px; margin-bottom: 6px;">
              <input class="field-input" value="${edu.degree || ''}" placeholder="Degree" oninput="currentCanonicalCV.education[${idx}].degree=this.value" style="flex: 1; font-size: 0.78rem; padding: 6px 8px; font-weight: 700;"/>
              <input class="field-input" value="${edu.institution || ''}" placeholder="University / College" oninput="currentCanonicalCV.education[${idx}].institution=this.value" style="flex: 1; font-size: 0.78rem; padding: 6px 8px;"/>
            </div>
          `).join('')}
        </div>
      ` : ''}

      <!-- SKILLS & LANGUAGES PREVIEW -->
      <div>
        <div style="font-size: 0.75rem; font-weight: 700; color: rgba(255,255,255,0.5); margin-bottom: 6px;">TECHNICAL SKILLS (${skillCount})</div>
        <div style="display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px;">
          ${currentCanonicalCV.skills.map(s => `<span style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); border-radius: 12px; padding: 3px 10px; font-size: 0.72rem;">${s.name}</span>`).join('')}
        </div>
        ${langCount > 0 ? `
          <div style="font-size: 0.75rem; font-weight: 700; color: rgba(168,85,247,0.8); margin-bottom: 4px;">NATURAL LANGUAGES (${langCount})</div>
          <div style="display: flex; flex-wrap: wrap; gap: 6px;">
            ${currentCanonicalCV.languages.map(l => `<span style="background: rgba(168,85,247,0.15); border: 1px solid rgba(168,85,247,0.3); border-radius: 12px; padding: 3px 10px; font-size: 0.72rem; color: #a855f7;">🌐 ${l.language} (${l.proficiency})</span>`).join('')}
          </div>
        ` : ''}
      </div>
    </div>

    <!-- SELECTIVE IMPORT & MERGE OPTIONS -->
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px;">
      <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 12px;">
        <label style="font-size: 0.78rem; font-weight: 800; color: rgba(255,255,255,0.9); display: block; margin-bottom: 6px;">Select Categories To Import:</label>
        <div style="display: flex; flex-direction: column; gap: 4px;">
          <label style="font-size: 0.75rem; cursor: pointer;"><input type="checkbox" id="chk-import-personal" checked/> Profile & Personal</label>
          <label style="font-size: 0.75rem; cursor: pointer;"><input type="checkbox" id="chk-import-summary" checked/> Summary & Bio</label>
          <label style="font-size: 0.75rem; cursor: pointer;"><input type="checkbox" id="chk-import-exp" checked/> Experience (${expCount})</label>
          <label style="font-size: 0.75rem; cursor: pointer;"><input type="checkbox" id="chk-import-edu" checked/> Education (${eduCount})</label>
          <label style="font-size: 0.75rem; cursor: pointer;"><input type="checkbox" id="chk-import-skills" checked/> Skills (${skillCount})</label>
        </div>
      </div>
      <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 12px;">
        <label style="font-size: 0.78rem; font-weight: 800; color: rgba(255,255,255,0.9); display: block; margin-bottom: 6px;">Merge Strategy:</label>
        <select id="cv-merge-strategy" class="field-input" style="width: 100%; background: rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.15); color: #fff; padding: 8px; border-radius: 8px; font-size: 0.78rem;">
          <option value="empty_only" selected>Fill Empty Fields Only</option>
          <option value="merge">Merge Data (Add New Items)</option>
          <option value="replace">Replace Portfolio Data</option>
        </select>
      </div>
    </div>

    <!-- THEME RECOMMENDATIONS -->
    <div style="margin-bottom: 20px;">
      <label style="font-size: 0.8rem; font-weight: 800; color: rgba(255,255,255,0.9); display: block; margin-bottom: 8px;">3. Recommended 3D World Theme:</label>
      <div style="display: flex; flex-direction: column; gap: 8px;">
        ${themes.map((t, idx) => `
          <label style="
            display: flex; align-items: center; justify-content: space-between; padding: 12px 14px;
            background: ${idx === 0 ? 'rgba(124,58,237,0.15)' : 'rgba(255,255,255,0.03)'};
            border: 1px solid ${idx === 0 ? 'rgba(124,58,237,0.4)' : 'rgba(255,255,255,0.08)'};
            border-radius: 12px; cursor: pointer; transition: all 0.2s;
          ">
            <div style="display: flex; align-items: center; gap: 10px;">
              <input type="radio" name="recommended-theme" value="${t.theme.id}" ${idx === 0 ? 'checked' : ''} onchange="selectedThemeId='${t.theme.id}'"/>
              <div>
                <div style="font-size: 0.85rem; font-weight: 700;">${t.theme.emoji} ${t.theme.name} ${idx === 0 ? '<span style="font-size: 0.68rem; color: #10b981; font-weight: 800; margin-left: 6px;">BEST MATCH</span>' : ''}</div>
                <div style="font-size: 0.72rem; color: rgba(255,255,255,0.5);">${t.reason}</div>
              </div>
            </div>
          </label>
        `).join('')}
      </div>
    </div>

    <!-- RESUME PDF ATTACHMENT OPTION -->
    <div style="margin-bottom: 24px; background: rgba(124,58,237,0.08); border: 1px solid rgba(124,58,237,0.2); border-radius: 12px; padding: 12px;">
      <label style="display: flex; align-items: center; gap: 8px; font-size: 0.8rem; cursor: pointer;">
        <input type="checkbox" id="chk-attach-resume-pdf" checked/>
        <span>📄 Use this uploaded PDF as downloadable Resume CTA asset</span>
      </label>
    </div>

    <!-- ACTIONS -->
    <div style="display: flex; gap: 12px; justify-content: flex-end;">
      <button onclick="window.closeCVImportModal()" class="btn btn-secondary" style="padding: 10px 20px;">Cancel</button>
      <button onclick="executeCVImport('${selectedThemeId}')" class="btn btn-primary" style="padding: 10px 24px; font-weight: 800;">🚀 Import & Build Portfolio Draft</button>
    </div>
  `;
}

window.swapRoleCompany = function(idx) {
  if (!currentCanonicalCV || !currentCanonicalCV.experience[idx]) return;
  const exp = currentCanonicalCV.experience[idx];
  const temp = exp.role;
  exp.role = exp.company;
  exp.company = temp;

  const roleInput = document.getElementById(`exp-role-${idx}`);
  const companyInput = document.getElementById(`exp-company-${idx}`);
  if (roleInput) roleInput.value = exp.role;
  if (companyInput) companyInput.value = exp.company;
};

window.executeCVImport = async function(themeId) {
  if (!currentCanonicalCV || !onImportCallback) return;

  const mergeStrategy = document.getElementById('cv-merge-strategy')?.value || 'empty_only';
  const attachPDF = document.getElementById('chk-attach-resume-pdf')?.checked;

  const importSections = {
    personal: document.getElementById('chk-import-personal')?.checked ?? true,
    summary: document.getElementById('chk-import-summary')?.checked ?? true,
    experience: document.getElementById('chk-import-exp')?.checked ?? true,
    education: document.getElementById('chk-import-edu')?.checked ?? true,
    skills: document.getElementById('chk-import-skills')?.checked ?? true,
    projects: document.getElementById('chk-import-projects')?.checked ?? true,
    certifications: document.getElementById('chk-import-certs')?.checked ?? true
  };

  const selectedThemeRadio = document.querySelector('input[name="recommended-theme"]:checked');
  if (selectedThemeRadio) themeId = selectedThemeRadio.value;

  let resumeData = null;
  if (attachPDF && currentCVFile) {
    const reader = new FileReader();
    const dataUrl = await new Promise((resolve) => {
      reader.onload = (e) => resolve(e.target.result);
      reader.readAsDataURL(currentCVFile);
    });
    resumeData = {
      dataUrl,
      fileName: currentCVFile.name,
      mimeType: currentCVFile.type || 'application/pdf',
      size: currentCVFile.size,
      buttonText: 'Download Resume'
    };
  }

  onImportCallback({
    parsedCV: currentCanonicalCV,
    mergeStrategy,
    importSections,
    selectedThemeId: themeId,
    resumeData
  });

  closeCVImportModal();
};

window.renderDropzoneStep = renderDropzoneStep;
window.closeCVImportModal = closeCVImportModal;
