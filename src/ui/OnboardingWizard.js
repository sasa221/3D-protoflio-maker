/**
 * OnboardingWizard.js
 * Dedicated /start Onboarding Route UI.
 * Fast, guided, non-technical first portfolio creation wizard.
 */

import { onboardingController } from '../services/OnboardingService.js';
import { mapCVToPortfolioData } from '../services/CVPortfolioMapper.js';
import { getThemeById } from '../three/ProceduralTheme.js';
import { generatePortfolioCSS, generatePortfolioHTMLBody } from '../renderer/PortfolioRenderer.js';
import { installProjectCinemaControls } from '../renderer/ProjectCinema.js';
import { globalEntitlements } from '../services/EntitlementService.js';
import { getThemeTier } from '../config/ThemeTierConfig.js';

let onboardingEngine = null;
let HyperEngine = null;
let onboardingThreePromise = null;

async function loadOnboardingThree() {
  onboardingThreePromise ||= import('../three/ThreeRuntimeModule.js').then(runtime => {
    HyperEngine = runtime.HyperEngine;
    return runtime;
  });
  return onboardingThreePromise;
}

export async function renderOnboardingWizard(container) {
  if (!container) return;

  window.onboardingController = onboardingController;

  container.style.display = 'block';
  container.style.height = 'auto';
  container.style.minHeight = '100vh';
  container.style.overflowY = 'auto';
  document.body.style.overflowY = 'auto';

  const state = await onboardingController.initializeForCurrentUser();

  container.innerHTML = `
    <style>
      .ob-header { padding: 18px 40px; }
      .ob-progress { display:flex; gap:24px; }
      .ob-method-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:18px; }
      .ob-theme-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:18px; }
      .ob-form-card { padding:36px; }
      @media (max-width: 760px) {
        .ob-header { padding:14px 16px !important; gap:12px; flex-wrap:wrap; }
        .ob-progress { order:3; width:100%; justify-content:center; gap:8px !important; font-size:.7rem !important; }
        .ob-method-grid, .ob-theme-grid { grid-template-columns:1fr !important; }
        .ob-form-card { padding:22px 16px !important; }
        #onboarding-step-view { align-items:flex-start !important; padding:28px 14px !important; }
      }
      @media (min-width: 761px) and (max-width: 980px) { .ob-method-grid { grid-template-columns:repeat(2,minmax(0,1fr)); } }
    </style>
    <div style="min-height: 100vh; background: #050508; color: #fff; font-family: 'Inter', sans-serif; display: flex; flex-direction: column;">
      
      <!-- TOP MINIMAL ONBOARDING HEADER -->
      <header class="ob-header" style="
        padding: 18px 40px; border-bottom: 1px solid rgba(255,255,255,0.08); display: flex;
        justify-content: space-between; align-items: center; background: rgba(5,5,12,0.85); backdrop-filter: blur(15px);
      ">
        <a href="/" style="display: flex; align-items: center; gap: 10px; text-decoration: none;">
          <div style="width: 34px; height: 34px; border-radius: 8px; background: linear-gradient(135deg,#7c3aed,#06b6d4); display: flex; align-items: center; justify-content: center; font-size: 1.1rem;">⚡</div>
          <span style="font-family: 'Outfit', sans-serif; font-size: 1.1rem; font-weight: 800; color: #fff;">3D Portfolio Maker</span>
        </a>

        <!-- PROGRESS STEPS -->
        <div class="ob-progress" style="font-size: 0.82rem; font-weight: 700;">
          <span style="color: ${state.step >= 1 ? '#a855f7' : 'rgba(255,255,255,0.4)'};">1. Your Profile</span>
          <span style="color: rgba(255,255,255,0.3);">➔</span>
          <span style="color: ${state.step >= 2 ? '#a855f7' : 'rgba(255,255,255,0.4)'};">2. Your Style</span>
          <span style="color: rgba(255,255,255,0.3);">➔</span>
          <span style="color: ${state.step >= 3 ? '#a855f7' : 'rgba(255,255,255,0.4)'};">3. Live Preview</span>
        </div>

        <a href="/login" style="color: rgba(255,255,255,0.6); font-size: 0.85rem; font-weight: 600; text-decoration:none;">Sign in</a>
      </header>

      <!-- MAIN STEP CONTAINER -->
      <main id="onboarding-step-view" style="flex: 1; display: flex; align-items: center; justify-content: center; padding: 40px 20px;">
        <!-- Step UI rendered dynamically -->
      </main>
    </div>
  `;

  renderCurrentStep();
}

function renderCurrentStep() {
  const stepView = document.getElementById('onboarding-step-view');
  if (!stepView) return;

  const state = onboardingController.getState();

  if (state.step === 1) {
    if (!state.startingMethod) {
      renderStep1ChooseMethod(stepView);
    } else if (state.startingMethod === 'cv') {
      renderStep1CVUpload(stepView);
    } else if (state.startingMethod === 'example') {
      renderStep1ManualForm(stepView, { isExample: true });
    } else {
      renderStep1ManualForm(stepView);
    }
  } else if (state.step === 2) {
    renderStep2ChooseStyle(stepView);
  } else if (state.step === 3) {
    renderStep3LivePreview(stepView);
  }
}

// Inline handlers in the generated markup need an explicit browser-global bridge.
window.renderCurrentStep = renderCurrentStep;

/** STEP 1: CHOOSE METHOD */
function renderStep1ChooseMethod(container) {
  container.innerHTML = `
    <div style="max-width: 720px; width: 100%; text-align: center;">
      <h1 style="font-family: 'Outfit', sans-serif; font-size: 2.4rem; font-weight: 900; margin-bottom: 12px;">
        How would you like to start?
      </h1>
      <p style="color: rgba(255,255,255,0.65); font-size: 1.05rem; margin-bottom: 40px;">
        Choose the fastest option for your current career materials.
      </p>

      <div class="ob-method-grid">
        <!-- OPTION A: CV IMPORT -->
        <div role="button" tabindex="0" aria-label="Import my CV" onclick="selectMethod('cv')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();selectMethod('cv')}" style="
          background: rgba(124,58,237,0.08); border: 2px solid #7c3aed; border-radius: 20px; padding: 36px 24px;
          cursor: pointer; text-align: left; transition: transform 0.2s; position: relative;
        " onmouseover="this.style.transform='translateY(-4px)'" onmouseout="this.style.transform='none'">
          <div style="
            position: absolute; top: -12px; right: 20px; background: #7c3aed; padding: 4px 12px;
            border-radius: 20px; font-size: 0.7rem; font-weight: 800; color: #fff;
          ">FASTEST — RECOMMENDED</div>
          <div style="font-size: 2.5rem; margin-bottom: 16px;">📄</div>
          <h3 style="font-size: 1.3rem; font-weight: 800; margin-bottom: 8px;">Import My CV</h3>
          <p style="font-size: 0.88rem; color: rgba(255,255,255,0.65); line-height: 1.6;">
            Upload your PDF resume. Experience, projects, education, and skills will be extracted automatically for review.
          </p>
        </div>

        <!-- OPTION B: MANUAL START -->
        <div role="button" tabindex="0" aria-label="Start manually" onclick="selectMethod('manual')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();selectMethod('manual')}" style="
          background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; padding: 36px 24px;
          cursor: pointer; text-align: left; transition: transform 0.2s;
        " onmouseover="this.style.transform='translateY(-4px)'" onmouseout="this.style.transform='none'">
          <div style="font-size: 2.5rem; margin-bottom: 16px;">✍️</div>
          <h3 style="font-size: 1.3rem; font-weight: 800; margin-bottom: 8px;">Start Manually</h3>
          <p style="font-size: 0.88rem; color: rgba(255,255,255,0.65); line-height: 1.6;">
            Enter your name, professional title, short bio, and key skills step-by-step.
          </p>
        </div>

        <!-- OPTION C: START FROM A SAFE FICTIONAL EXAMPLE -->
        <div role="button" tabindex="0" aria-label="Start from an example" onclick="selectMethod('example')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();selectMethod('example')}" style="
          background: rgba(6,182,212,0.06); border: 1px solid rgba(6,182,212,0.32); border-radius: 20px; padding: 36px 24px;
          cursor: pointer; text-align: left; transition: transform 0.2s;
        " onmouseover="this.style.transform='translateY(-4px)'" onmouseout="this.style.transform='none'">
          <div style="font-size: 2.5rem; margin-bottom: 16px;">✨</div>
          <h3 style="font-size: 1.3rem; font-weight: 800; margin-bottom: 8px;">Start from an Example</h3>
          <p style="font-size: 0.88rem; color: rgba(255,255,255,0.65); line-height: 1.6;">
            See a complete fictional portfolio first, then replace every example with your own details. Nothing is copied to your profile.
          </p>
        </div>
      </div>
    </div>
  `;

  window.selectMethod = (method) => {
    if (method === 'example') {
      onboardingController.updateProfileDraft({
        name: 'Your Name',
        profession: 'Your Professional Title',
        tagline: 'Building meaningful digital experiences',
        bio: 'Add a short introduction about your work, strengths, and the problems you love solving.',
        skills: [{ name: 'Your first skill', level: 85 }, { name: 'Your second skill', level: 85 }, { name: 'Your third skill', level: 85 }],
        experience: [], projects: [], education: [], social: { github: '', linkedin: '', email: '' }
      });
    }
    onboardingController.setStartingMethod(method);
    renderCurrentStep();
  };
}

/** STEP 1: CV UPLOAD & REVIEW */
function renderStep1CVUpload(container) {
  container.innerHTML = `
    <div style="max-width: 680px; width: 100%; text-align: center;">
      <h2 style="font-family: 'Outfit', sans-serif; font-size: 2.1rem; font-weight: 900; margin-bottom: 10px;">
        Upload your CV PDF
      </h2>
      <p style="color: rgba(255,255,255,0.65); margin-bottom: 30px;">
        We'll extract your career data for your review before creating your portfolio.
      </p>

      <div id="cv-drop-zone" role="button" tabindex="0" aria-label="Upload CV PDF" style="
        border: 2px dashed rgba(124,58,237,0.5); background: rgba(124,58,237,0.05); border-radius: 20px;
        padding: 50px 30px; text-align: center; cursor: pointer; transition: background 0.2s;
      " onclick="document.getElementById('cv-file-input').click()" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();document.getElementById('cv-file-input').click()}">
        <div style="font-size: 3rem; margin-bottom: 16px;">📄</div>
        <div style="font-size: 1.1rem; font-weight: 800; margin-bottom: 8px;">Drop your CV here or click to browse</div>
        <div style="font-size: 0.82rem; color: rgba(255,255,255,0.5);">Supports PDF files up to 10MB</div>
        <input type="file" id="cv-file-input" accept=".pdf" style="display: none;" onchange="handleCVUpload(event)">
      </div>

      <div id="cv-upload-status" style="margin-top: 20px; font-weight: 700; font-size: 0.9rem; color: #a855f7;"></div>

      <div style="margin-top: 30px; display: flex; justify-content: space-between; align-items: center;">
        <button onclick="resetStartingMethod()" style="background: none; border: none; color: rgba(255,255,255,0.5); font-weight: 600; cursor: pointer;">
          ← Back
        </button>
        <button onclick="skipToManualForm()" style="background: none; border: none; color: #06b6d4; font-weight: 700; cursor: pointer;">
          Enter Details Manually Instead ➔
        </button>
      </div>
    </div>
  `;

  window.resetStartingMethod = () => {
    onboardingController.saveState({ startingMethod: null });
    renderCurrentStep();
  };

  window.skipToManualForm = () => {
    onboardingController.saveState({ startingMethod: 'manual' });
    renderCurrentStep();
  };

  window.handleCVUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const statusEl = document.getElementById('cv-upload-status');
    if (statusEl) statusEl.textContent = '⏳ Reading PDF & extracting text...';

    try {
      const [{ extractTextFromPDF }, { CVParserService }] = await Promise.all([
        import('../services/PDFTextExtractor.js'),
        import('../services/CVParserService.js')
      ]);
      const normalized = await extractTextFromPDF(file);
      if (statusEl) statusEl.textContent = '⚡ Structuring career profile...';

      const parser = new CVParserService();
      const parsed = await parser.parse(normalized);
      const mapped = mapCVToPortfolioData(parsed);

      onboardingController.updateProfileDraft(mapped);
      onboardingController.saveState({ importedFromCV: true, startingMethod: 'manual', step: 1 });
      if (statusEl) statusEl.textContent = '✓ CV Profile Ready! Review the extracted details...';

      setTimeout(() => {
        renderCurrentStep();
      }, 500);
    } catch (err) {
      if (statusEl) statusEl.textContent = '⚠ Could not parse CV automatically. You can enter details manually below.';
    }
  };
}

/** STEP 1: MANUAL FORM */
function renderStep1ManualForm(container, { isExample = false } = {}) {
  const currentState = onboardingController.getState();
  const draft = currentState.profileDraft;
  const isCVReview = Boolean(currentState.importedFromCV);

  container.innerHTML = `
    <div class="ob-form-card" style="max-width: 600px; width: 100%; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; padding: 36px;">
      <h2 style="font-family: 'Outfit', sans-serif; font-size: 2rem; font-weight: 900; margin-bottom: 8px;">
        ${isCVReview ? 'Review your extracted CV details' : isExample ? 'Make this example yours' : 'Tell us about yourself'}
      </h2>
      <p style="color: rgba(255,255,255,0.6); font-size: 0.9rem; margin-bottom: 24px;">
        ${isCVReview ? 'Check and edit the information before choosing your 3D style.' : isExample ? 'These are placeholders only. Replace them before saving your portfolio.' : 'Enter your core details to build your first 3D portfolio.'}
      </p>

      <form id="onboarding-manual-form" onsubmit="handleManualSubmit(event)" style="display: flex; flex-direction: column; gap: 16px;">
        <div>
          <label for="ob-name" style="display: block; font-size: 0.8rem; font-weight: 700; color: rgba(255,255,255,0.8); margin-bottom: 6px;">Your Name *</label>
          <input type="text" id="ob-name" autocomplete="name" required value="${draft.name || ''}" placeholder="e.g. Alex Rivera" style="width: 100%; padding: 12px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); border-radius: 8px; color: #fff;">
        </div>

        <div>
          <label for="ob-profession" style="display: block; font-size: 0.8rem; font-weight: 700; color: rgba(255,255,255,0.8); margin-bottom: 6px;">Professional Title *</label>
          <input type="text" id="ob-profession" required value="${draft.profession || ''}" placeholder="e.g. Front-End Developer / Data Analyst" style="width: 100%; padding: 12px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); border-radius: 8px; color: #fff;">
        </div>

        <div>
          <label for="ob-bio" style="display: block; font-size: 0.8rem; font-weight: 700; color: rgba(255,255,255,0.8); margin-bottom: 6px;">Short Bio</label>
          <textarea id="ob-bio" rows="3" placeholder="Brief summary of what you build & your core expertise..." style="width: 100%; padding: 12px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); border-radius: 8px; color: #fff; font-family: inherit;">${draft.bio || ''}</textarea>
        </div>

        <div>
          <label for="ob-skills" style="display: block; font-size: 0.8rem; font-weight: 700; color: rgba(255,255,255,0.8); margin-bottom: 6px;">Primary Skills (comma-separated)</label>
          <input type="text" id="ob-skills" value="${(draft.skills || []).map(s => typeof s === 'string' ? s : s.name).join(', ')}" placeholder="JavaScript, React, Three.js, REST APIs" style="width: 100%; padding: 12px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); border-radius: 8px; color: #fff;">
        </div>

        <div style="margin-top: 10px; display: flex; justify-content: space-between; align-items: center;">
          <button type="button" onclick="resetStartingMethod()" style="background: none; border: none; color: rgba(255,255,255,0.5); font-weight: 600; cursor: pointer;">
            ← Back
          </button>
          <button type="submit" style="padding: 12px 28px; background: linear-gradient(135deg,#7c3aed,#06b6d4); border: none; border-radius: 10px; color: #fff; font-weight: 800; cursor: pointer;">
            Continue to Style ➔
          </button>
        </div>
      </form>
    </div>
  `;

  window.handleManualSubmit = (e) => {
    e.preventDefault();
    const name = document.getElementById('ob-name').value;
    const profession = document.getElementById('ob-profession').value;
    const bio = document.getElementById('ob-bio').value;
    const skillsRaw = document.getElementById('ob-skills').value;
    const skills = skillsRaw.split(',').map(s => ({ name: s.trim(), level: 85 })).filter(s => s.name);

    onboardingController.updateProfileDraft({ name, profession, bio, skills });
    onboardingController.setStep(2);
    renderCurrentStep();
  };
}

/** STEP 2: CHOOSE YOUR STYLE */
function renderStep2ChooseStyle(container) {
  const state = onboardingController.getState();
  const selectedTheme = state.selectedTheme || 'code';
  const canUseTheme = themeId => globalEntitlements.canUseTheme(themeId);
  const themeCard = (themeId, emoji, title, subtitle) => {
    const available = canUseTheme(themeId);
    const tier = getThemeTier(themeId);
    const badge = tier === 'free' ? 'FREE' : tier.toUpperCase();
    return `
      <div role="button" tabindex="0" aria-disabled="${!available}" aria-pressed="${selectedTheme === themeId}" aria-label="${available ? `Select ${title} theme` : `${title} theme requires ${tier}`}" onclick="selectTheme('${themeId}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();selectTheme('${themeId}')}" style="
        background: ${selectedTheme === themeId ? 'rgba(124,58,237,0.15)' : 'rgba(255,255,255,0.03)'}; opacity:${available ? '1' : '.62'};
        border: 2px solid ${selectedTheme === themeId ? '#7c3aed' : 'rgba(255,255,255,0.1)'}; border-radius: 16px; padding: 20px; cursor: pointer; text-align: center; transition: all 0.2s;
      ">
        <div style="font-size: 2rem; margin-bottom: 10px;">${emoji}</div>
        <div style="font-weight: 800; font-size: 1rem; margin-bottom: 4px;">${title}</div>
        <div style="font-size: 0.72rem; color: rgba(255,255,255,0.5); margin-bottom: 12px;">${subtitle}</div>
        <span style="padding: 2px 8px; background: ${tier === 'free' ? 'rgba(16,185,129,0.2)' : 'rgba(124,58,237,0.3)'}; color: ${tier === 'free' ? '#10b981' : '#c084fc'}; border-radius: 4px; font-size: 0.68rem; font-weight: 800;">${badge}${available ? '' : ' · UPGRADE'}</span>
      </div>`;
  };

  container.innerHTML = `
    <div style="max-width: 960px; width: 100%;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h2 style="font-family: 'Outfit', sans-serif; font-size: 2.2rem; font-weight: 900; margin-bottom: 8px;">
          Choose your 3D environment style
        </h2>
        <p style="color: rgba(255,255,255,0.65);">
          Recommended style based on your profession: <strong style="color: #06b6d4;">${(state.profileDraft.profession || '').includes('Data') ? 'Data Galaxy' : 'Code Matrix'}</strong>
        </p>
      </div>

      <div class="ob-theme-grid" style="margin-bottom: 36px;">
        ${themeCard('code', '💻', 'Code Matrix', 'Web & Software')}
        ${themeCard('data', '📊', 'Data Galaxy', 'BI & Data Science')}
        ${themeCard('hacker', '🛡️', 'Cyber Command', 'Security & Infra')}
        ${themeCard('cosmic', '🌌', 'Cosmic Elite', 'Executive & General')}
      </div>

      <div style="display: flex; justify-content: space-between; align-items: center;">
        <button onclick="onboardingController.setStep(1); renderCurrentStep();" style="background: none; border: none; color: rgba(255,255,255,0.5); font-weight: 600; cursor: pointer;">
          ← Back
        </button>
        <button onclick="onboardingController.setStep(3); renderCurrentStep();" style="padding: 14px 32px; background: linear-gradient(135deg,#7c3aed,#06b6d4); border: none; border-radius: 12px; color: #fff; font-weight: 800; cursor: pointer; box-shadow: 0 4px 20px rgba(124,58,237,0.4);">
          Generate First Portfolio ➔
        </button>
      </div>
    </div>
  `;

  window.selectTheme = (themeId) => {
    if (!globalEntitlements.canUseTheme(themeId)) {
      const targetPlan = getThemeTier(themeId) === 'premium' ? 'premium' : 'pro';
      window.openBillingModal?.({ targetPlan });
      return;
    }
    onboardingController.setSelectedTheme(themeId);
    renderCurrentStep();
  };
}

/** STEP 3: FIRST LIVE PREVIEW & STUDIO HANDOFF */
async function renderStep3LivePreview(container) {
  const state = onboardingController.getState();
  if (!onboardingController.isProfileValid(state) || !state.selectedTheme) {
    onboardingController.setStep(onboardingController.isProfileValid(state) ? 2 : 1);
    renderCurrentStep();
    return;
  }
  container.innerHTML = `
    <div style="max-width: 1000px; width: 100%; text-align: center;">
      <div style="font-size: 0.8rem; font-weight: 800; color: #10b981; letter-spacing: 1.5px; margin-bottom: 6px;">
        ✨ YOUR PORTFOLIO PREVIEW IS READY
      </div>
      <h2 style="font-family: 'Outfit', sans-serif; font-size: 2.2rem; font-weight: 900; margin-bottom: 16px;">
        Here is your live 3D career portfolio
      </h2>

      <!-- PREVIEW VIEWPORT -->
      <div id="ob-preview-viewport" style="
        height: 480px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.12);
        background: #000; overflow: hidden; position: relative; margin-bottom: 24px;
      ">
        <canvas id="ob-preview-canvas" style="width: 100%; height: 100%; display: block;"></canvas>
        <div id="ob-preview-html" style="position: absolute; inset: 0; overflow-y: auto; z-index: 10;"></div>
        <div id="ob-preview-status" style="position:absolute;inset:0;z-index:20;display:flex;align-items:center;justify-content:center;background:#050508;color:rgba(255,255,255,.75);font-weight:700">Preparing your 3D portfolio...</div>
      </div>

      <!-- ERROR DISPLAY -->
      <div id="ob-publish-error" style="display: none; margin-top: 16px; padding: 12px 16px; background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3); border-radius: 10px; color: #ef4444; font-size: 0.85rem; font-weight: 600; text-align: center;"></div>

      <!-- HANDOFF ACTIONS -->
      <div style="display: flex; gap: 16px; justify-content: center; align-items: center; margin-top: 20px; flex-wrap: wrap;">
        <button id="btn-enter-studio" onclick="finishOnboardingAndEnterStudio(this)" style="
          padding: 16px 36px; background: linear-gradient(135deg,#7c3aed,#06b6d4); border: none; border-radius: 12px;
          color: #fff; font-size: 1rem; font-weight: 800; cursor: pointer; box-shadow: 0 8px 30px rgba(124,58,237,0.4);
        ">
          ⚡ Enter Studio Workspace
        </button>

        <button id="btn-publish-now" onclick="finishOnboardingAndPublish(this)" style="
          padding: 16px 28px; background: rgba(16,185,129,0.15); border: 1px solid rgba(16,185,129,0.4); border-radius: 12px;
          color: #10b981; font-size: 0.95rem; font-weight: 800; cursor: pointer;
        ">
          🌐 Publish Portfolio Now
        </button>
      </div>
    </div>
  `;

  // Preview validated local draft first. Persist only after an explicit user action.
  const pf = { id: state.portfolioId, slug: state.publicSlug, theme: state.selectedTheme, master_profile_json: { ...state.profileDraft, theme: state.selectedTheme } };
  initOnboardingPreview(pf);

  window.finishOnboardingAndEnterStudio = async (btn) => {
    const errContainer = document.getElementById('ob-publish-error');
    if (errContainer) errContainer.style.display = 'none';

    if (btn && btn instanceof HTMLElement) {
      btn.disabled = true;
      btn.textContent = '⏳ Saving Portfolio...';
    }

    try {
      const authUser = await window.getCurrentAuthUser?.();
      if (!authUser || authUser.id === 'usr_guest') {
        window.location.href = '/login?next=/start';
        return;
      }
      const saved = await onboardingController.saveFirstPortfolio();
      if (!saved || !saved.id) {
        throw new Error('Failed to create portfolio row in database.');
      }
      window.location.href = `/studio?portfolio=${saved.id}`;
    } catch (e) {
      if (errContainer) {
        errContainer.textContent = `❌ ${e.message || 'Saving failed.'}`;
        errContainer.style.display = 'block';
      }
      if (btn && btn instanceof HTMLElement) {
        btn.disabled = false;
        btn.textContent = '⚡ Enter Studio Workspace';
      }
    }
  };

  window.finishOnboardingAndPublish = async (btn) => {
    const errContainer = document.getElementById('ob-publish-error');
    if (errContainer) errContainer.style.display = 'none';

    if (btn && btn instanceof HTMLElement) {
      btn.disabled = true;
      btn.textContent = '⏳ Publishing Portfolio...';
    }

    try {
      const authUser = await window.getCurrentAuthUser?.();
      if (!authUser || authUser.id === 'usr_guest') {
        window.location.href = '/login?next=/start';
        return;
      }
      const saved = await onboardingController.saveFirstPortfolio();
      if (!saved || !saved.id) {
        throw new Error('Failed to create portfolio row in database.');
      }

      window.location.href = `/u/${saved.slug || 'user-a-700001'}`;
    } catch (e) {
      if (errContainer) {
        errContainer.textContent = `❌ ${e.message || 'Publishing failed.'}`;
        errContainer.style.display = 'block';
      }
      if (btn && btn instanceof HTMLElement) {
        btn.disabled = false;
        btn.textContent = '🌐 Publish Portfolio Now';
      }
    }
  };
}

async function initOnboardingPreview(pf) {
  const canvas = document.getElementById('ob-preview-canvas');
  const htmlContainer = document.getElementById('ob-preview-html');
  if (!canvas || !htmlContainer) return;

  try {
    const theme = getThemeById(pf.theme || 'code');
    let styleTag = document.getElementById('onboarding-portfolio-preview-style');
    if (!styleTag) {
      styleTag = document.createElement('style');
      styleTag.id = 'onboarding-portfolio-preview-style';
      document.head.appendChild(styleTag);
    }
    styleTag.textContent = generatePortfolioCSS(theme);
    if (!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      await loadOnboardingThree();
      onboardingEngine = new HyperEngine(canvas);
      onboardingEngine.init(theme);
    }

    const html = generatePortfolioHTMLBody(pf.master_profile_json || pf, theme, { deviceMode: 'desktop' });
    htmlContainer.innerHTML = html;
    installProjectCinemaControls();
    document.getElementById('ob-preview-status')?.remove();
  } catch (e) {
    console.warn('[OnboardingWizard] Preview error:', e.message);
    const status = document.getElementById('ob-preview-status');
    if (status) status.innerHTML = `<div style="max-width:420px;padding:24px"><div style="font-size:1.1rem;margin-bottom:8px">3D preview could not start</div><div style="font-size:.85rem;color:rgba(255,255,255,.55);margin-bottom:16px">Your portfolio content is safe. Try the preview again.</div><button onclick="renderCurrentStep()" style="padding:10px 18px;border:0;border-radius:8px;background:#7c3aed;color:white;font-weight:700;cursor:pointer">Retry preview</button></div>`;
  }
}
