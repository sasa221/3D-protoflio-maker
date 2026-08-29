/**
 * LandingPage.js - Ultra 3D Portfolio Maker Marketing & Product Demo Page
 * High-converting, cinematic landing page demonstrating CV -> 3D Portfolio transformation,
 * Job Targeting, Recruiter Mode, Variants, and Visitor Analytics.
 */

import { MARKETING_DEMO_PORTFOLIO } from '../demo/MarketingDemoPortfolio.js';
import { getThemeById } from '../three/ProceduralTheme.js';
import { getCurrentUser } from '../services/AuthService.js';
import { fetchUserProfileAndEntitlements } from '../services/DBService.js';
import { globalEntitlements } from '../services/EntitlementService.js';
import { PLANS, GROUP_SEAT_PRICING } from '../config/PlanConfig.js';
import { LANDING_GALLERY_FILTERS, LANDING_GALLERY_ITEMS } from '../config/LandingGalleryConfig.js';
import { getThemeTier } from '../config/ThemeTierConfig.js';
import { isFeatureEnabled } from '../config/FeatureFlags.js';
import { getCareerEntryPaths } from '../services/CareerEntryPathService.js';

let demoEngine = null;
let currentDemoThemeId = 'code';
let landingDemoInitScheduled = false;
let demoRuntimePromise;
let HyperEngine;
let generatePortfolioCSS;
let generatePortfolioHTMLBody;
let installProjectCinemaControls;

function loadDemoRuntime() {
  demoRuntimePromise ||= Promise.all([
    import('../three/HyperEngine.js'),
    import('../renderer/PortfolioRenderer.js'),
    import('../renderer/ProjectCinema.js')
  ]).then(([engine, renderer, cinema]) => {
    HyperEngine = engine.HyperEngine;
    generatePortfolioCSS = renderer.generatePortfolioCSS;
    generatePortfolioHTMLBody = renderer.generatePortfolioHTMLBody;
    installProjectCinemaControls = cinema.installProjectCinemaControls;
  });
  return demoRuntimePromise;
}

export async function renderLandingPage(container) {
  if (!container) return;

  // The static H1 is for non-JavaScript crawlers. Once the landing page mounts,
  // retain the visible hero heading as the document's single H1.
  document.querySelector('.seo-fallback')?.remove();

  container.style.display = 'block';
  container.style.height = 'auto';
  container.style.minHeight = '100vh';
  container.style.overflowY = 'auto';
  // The shared Studio shell defaults the document to a fixed 100vh viewport.
  // Reset those constraints for the marketing page so every section remains
  // reachable with the normal document scrollbar after direct navigation.
  document.documentElement.style.height = 'auto';
  document.documentElement.style.minHeight = '100%';
  document.documentElement.style.overflowX = 'hidden';
  document.documentElement.style.overflowY = 'auto';
  document.body.style.height = 'auto';
  document.body.style.minHeight = '100vh';
  document.body.style.width = '100%';
  document.body.style.overflowY = 'auto';
  document.body.style.overflowX = 'hidden';
  container.style.background = '#050508';
  container.style.color = '#fff';

  // Render from the safe session cache immediately. Network-backed account
  // refresh must never hold the public hero behind a full-page loading shell.
  const authUser = getCurrentUser();
  const isAuthenticated = Boolean(authUser && authUser.id && authUser.id !== 'usr_guest');
  const careerStudioEnabled = isFeatureEnabled('CAREER_STUDIO');
  const careerPaths = getCareerEntryPaths(isAuthenticated);
  // Load the authoritative subscription before rendering the CTA. A paid
  // Premium Group owner should manage invitations, not submit payment again.
  let isPremiumGroupOwner = false;
  if (isAuthenticated) {
    isPremiumGroupOwner = globalEntitlements.getPlanId() === 'premium_group';
    fetchUserProfileAndEntitlements(authUser).catch(() => null);
  }
  const planCheckoutPath = (planId) => isAuthenticated
    ? `/pricing?plan=${encodeURIComponent(planId)}`
    : `/login?next=${encodeURIComponent(`/pricing?plan=${planId}`)}`;

  let responsiveStyle = document.getElementById('landing-responsive-style');
  if (!responsiveStyle) {
    responsiveStyle = document.createElement('style');
    responsiveStyle.id = 'landing-responsive-style';
    document.head.appendChild(responsiveStyle);
  }
  responsiveStyle.textContent = `
    html, body, #app { width: 100%; max-width: 100vw; overflow-x: hidden; }
    @media (max-width: 768px) {
      #landing-navbar { padding: 14px 18px !important; }
      #landing-primary-nav { display: none !important; }
      #landing-auth-actions > a:first-child:not(:only-child) { display: none !important; }
      #landing-auth-actions a { padding: 9px 12px !important; font-size: .76rem !important; white-space: nowrap; }
      #landing-navbar > a span { font-size: .95rem !important; max-width: 92px; line-height: 1.05; }
      
      /* Hero: stack to single column */
      #app section:first-of-type, section:first-of-type { grid-template-columns: 1fr !important; }
      /* How it works: stack 3 columns */
      #features > div:last-child { grid-template-columns: 1fr !important; }
      /* Themes: stack 2 columns */
      #themes > div { grid-template-columns: 1fr !important; }
      /* Job targeting: stack */
      #targeting > div { grid-template-columns: 1fr !important; }
      /* Recruiter comparison and analytics: stack */
      #recruiter-mode > div > div:last-child, #analytics > div { grid-template-columns: 1fr !important; }
      /* Pricing: stack to 2 then 1 */
      #pricing > div:last-child { grid-template-columns: repeat(2, 1fr) !important; }
    }
    @media (max-width: 900px) {
      #portfolio-gallery-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
    }
    @media (max-width: 480px) {
      /* All grids to 1 column */
      #pricing > div:last-child { grid-template-columns: 1fr !important; }
      #portfolio-gallery-grid { grid-template-columns: 1fr !important; }
    }
  `;

  container.innerHTML = `
    <!-- MARKETING NAVBAR -->
    <header id="landing-navbar" style="
      position: sticky; top: 0; z-index: 1000; display: flex; justify-content: space-between; align-items: center;
      padding: 16px 36px; background: rgba(5, 5, 12, 0.85); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
      border-bottom: 1px solid rgba(255, 255, 255, 0.08); font-family: 'Inter', sans-serif;
    ">
      <a href="/" style="display: flex; align-items: center; gap: 10px; text-decoration: none; min-height: 44px;">
        <div style="
          width: 38px; height: 38px; border-radius: 10px; background: linear-gradient(135deg, #7c3aed, #06b6d4);
          display: flex; align-items: center; justify-content: center; font-size: 1.2rem; box-shadow: 0 0 20px rgba(124,58,237,0.4);
        ">⚡</div>
        <span style="font-family: 'Outfit', sans-serif; font-size: 1.15rem; font-weight: 800; color: #fff; letter-spacing: -0.5px;">
          3D Portfolio Maker
        </span>
      </a>

      <nav id="landing-primary-nav" style="display: flex; gap: 28px; font-size: 0.88rem; font-weight: 600; color: rgba(255,255,255,0.75);">
        <a href="#features" style="color: inherit; text-decoration: none; transition: color 0.2s;" onmouseover="this.style.color='#fff'" onmouseout="this.style.color='rgba(255,255,255,0.75)'">Features</a>
        <a href="#themes" style="color: inherit; text-decoration: none; transition: color 0.2s;" onmouseover="this.style.color='#fff'" onmouseout="this.style.color='rgba(255,255,255,0.75)'">3D Themes</a>
        <a href="#targeting" style="color: inherit; text-decoration: none; transition: color 0.2s;" onmouseover="this.style.color='#fff'" onmouseout="this.style.color='rgba(255,255,255,0.75)'">Job Targeting</a>
        <a href="#pricing" style="color: inherit; text-decoration: none; transition: color 0.2s;" onmouseover="this.style.color='#fff'" onmouseout="this.style.color='rgba(255,255,255,0.75)'">Pricing</a>
      </nav>

      <div id="landing-auth-actions" style="display: flex; align-items: center; gap: 14px;">
        ${careerStudioEnabled && isAuthenticated ? `
          <a href="/studio" style="
            padding: 10px 20px; min-height: 44px; display: inline-flex; align-items: center; background: linear-gradient(135deg, #7c3aed, #06b6d4); border-radius: 10px;
            color: #fff; font-size: 0.85rem; font-weight: 700; text-decoration: none; box-shadow: 0 4px 15px rgba(124,58,237,0.3);
          ">⚡ Open Studio</a>
          <a href="/cv/new" style="
            padding: 10px 16px; min-height: 44px; display: inline-flex; align-items: center; background: rgba(6,182,212,.1); border: 1px solid rgba(6,182,212,.3); border-radius: 10px;
            color: #67e8f9; font-size: 0.82rem; font-weight: 800; text-decoration: none;
          ">Build My CV</a>
        ` : careerStudioEnabled ? `
          <a href="/login" style="color: rgba(255,255,255,0.85); min-height: 44px; display: inline-flex; align-items: center; font-size: 0.85rem; font-weight: 600; text-decoration: none; margin-right: 6px;">Sign In</a>
          <a href="/login?next=%2Fstart" style="
            padding: 10px 20px; min-height: 44px; display: inline-flex; align-items: center; background: linear-gradient(135deg, #7c3aed, #06b6d4); border-radius: 10px;
            color: #fff; font-size: 0.85rem; font-weight: 700; text-decoration: none; box-shadow: 0 4px 15px rgba(124,58,237,0.3);
          ">Build My Portfolio</a>
          <a href="${careerPaths.buildCV}" style="
            padding: 10px 16px; min-height: 44px; display: inline-flex; align-items: center; background: rgba(6,182,212,.1); border: 1px solid rgba(6,182,212,.3); border-radius: 10px;
            color: #67e8f9; font-size: 0.82rem; font-weight: 800; text-decoration: none;
          ">Build My CV</a>
        ` : `
          <a href="/login" style="color: rgba(255,255,255,0.85); min-height: 44px; display: inline-flex; align-items: center; font-size: 0.85rem; font-weight: 600; text-decoration: none; margin-right: 6px;">Sign In</a>
          <a href="/login?next=%2Fstart" style="
            padding: 10px 20px; min-height: 44px; display: inline-flex; align-items: center; background: linear-gradient(135deg, #7c3aed, #06b6d4); border-radius: 10px;
            color: #fff; font-size: 0.85rem; font-weight: 700; text-decoration: none; box-shadow: 0 4px 15px rgba(124,58,237,0.3);
          ">Build My Portfolio</a>
        `}
      </div>
    </header>

    <!-- MAIN LANDING CONTAINER -->
    <div style="background: #050508; color: #fff; font-family: 'Inter', sans-serif; overflow-x: hidden;">
      
      <!-- 1. HERO SECTION -->
      <section style="
        min-height: calc(100vh - 70px); display: grid; grid-template-columns: 1fr 1.08fr; gap: 36px; align-items: center;
        padding: 0 48px 24px 48px; max-width: 1440px; margin: 0 auto; position: relative;
      ">
        <!-- HERO TEXT CONTENT -->
        <div style="z-index: 10;">
          <div style="
            display: inline-flex; align-items: center; gap: 8px; padding: 6px 16px; border-radius: 30px;
            background: rgba(124,58,237,0.12); border: 1px solid rgba(124,58,237,0.3); color: #a855f7;
            font-size: 0.8rem; font-weight: 700; margin-bottom: 20px; font-family: 'JetBrains Mono', monospace;
          ">
            <span>✨ Build and share a 3D portfolio</span>
          </div>

          <h1 style="
            font-family: 'Outfit', sans-serif; font-size: clamp(2.4rem, 4.5vw, 3.6rem); font-weight: 900;
            line-height: 1.1; margin-bottom: 18px; background: linear-gradient(135deg, #ffffff 40%, var(--primary, #a855f7) 100%);
            -webkit-background-clip: text; -webkit-text-fill-color: transparent; letter-spacing: -1px;
          ">
            Build a 3D portfolio recruiters remember.
          </h1>

          <p style="font-size: 1.05rem; color: rgba(255,255,255,0.7); line-height: 1.6; max-width: 540px; margin-bottom: 28px;">
            Build your Portfolio directly from scratch, import an existing CV to speed up your data entry, or create a standalone CV when you need one. CV-to-Portfolio transfer is always optional and reviewed by you.
          </p>

          <div style="display: flex; gap: 16px; align-items: center; flex-wrap: wrap; margin-bottom: 24px;">
            <a data-career-hero data-career-cta="portfolio" href="${careerPaths.portfolio}" style="
              padding: 16px 32px; background: linear-gradient(135deg, #7c3aed, #06b6d4); border-radius: 12px;
              color: #fff; font-size: 1rem; font-weight: 800; text-decoration: none; box-shadow: 0 10px 30px rgba(124,58,237,0.4);
              transition: transform 0.2s; display: inline-flex; align-items: center; gap: 10px;
            " onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='none'">
              <span>⚡ Build My Portfolio</span>
              <span>➔</span>
            </a>

            ${careerStudioEnabled ? `<a data-career-cta="cv" href="${careerPaths.buildCV}" style="
              padding: 16px 24px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12);
              border-radius: 12px; color: #fff; font-size: 0.95rem; font-weight: 700; text-decoration: none;
              backdrop-filter: blur(10px); transition: background 0.2s;
            ">Build My CV</a><a data-career-cta="import" href="${careerPaths.importCV}" style="padding: 10px 4px;color:#67e8f9;font-size:.82rem;font-weight:800;text-decoration:none;">Import Existing CV →</a>` : ''}

            <a href="#hero-demo" style="
              padding: 16px 24px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12);
              border-radius: 12px; color: #fff; font-size: 0.95rem; font-weight: 700; text-decoration: none;
              backdrop-filter: blur(10px); transition: background 0.2s;
            " onmouseover="this.style.background='rgba(255,255,255,0.1)'" onmouseout="this.style.background='rgba(255,255,255,0.06)'">
              ▶ Watch Live Demo
            </a>
          </div>

          <div style="font-size: 0.78rem; color: rgba(255,255,255,0.45); display: flex; align-items: center; gap: 16px;">
            <span>✓ No coding required</span>
            <span>•</span>
            <span>✓ Recruiter-ready formatting</span>
            <span>•</span>
            <span>✓ Mobile responsive</span>
          </div>
        </div>

        <!-- HERO RIGHT: LIVE MINI 3D SHOWCASE -->
        <div id="hero-demo" style="
          position: relative; height: 550px; border-radius: 20px; overflow: hidden;
          border: 1px solid rgba(255,255,255,0.18); background: #050508;
          box-shadow: 0 25px 70px rgba(0,0,0,0.9); display: flex; flex-direction: column;
        ">
          <!-- BROWSER FRAME TITLEBAR -->
          <div style="
            height: 36px; background: rgba(15,15,25,0.95); border-bottom: 1px solid rgba(255,255,255,0.1);
            display: flex; align-items: center; justify-content: space-between; padding: 0 16px; z-index: 30;
          ">
            <div style="display: flex; gap: 6px;">
              <span style="width: 10px; height: 10px; border-radius: 50%; background: #ff5f56;"></span>
              <span style="width: 10px; height: 10px; border-radius: 50%; background: #ffbd2e;"></span>
              <span style="width: 10px; height: 10px; border-radius: 50%; background: #27c93f;"></span>
            </div>
            <div style="
              font-size: 0.72rem; font-family: 'JetBrains Mono', monospace; color: rgba(255,255,255,0.6);
              background: rgba(255,255,255,0.05); padding: 3px 14px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.08);
            ">
              Interactive Portfolio Demo
            </div>
            <div id="landing-demo-state" style="font-size: 0.7rem; color: rgba(255,255,255,0.72);">READY TO LOAD</div>
          </div>

          <div style="position: relative; flex: 1; overflow: hidden;">
            <canvas id="landing-hero-canvas" style="position: absolute; inset: 0; width: 100%; height: 100%; z-index: 0;"></canvas>
            <div id="landing-hero-viewport" style="position: absolute; inset: 0; z-index: 10; overflow: hidden;">
              <div data-landing-demo-placeholder style="height:100%;display:grid;place-items:center;text-align:center;padding:30px;color:rgba(255,255,255,.72);background:radial-gradient(circle at 50% 40%,rgba(124,58,237,.2),transparent 58%);">
                <div><div style="font-size:2.5rem;margin-bottom:10px">⚡</div><strong style="display:block;font-size:1.2rem;color:#fff">See your portfolio in motion</strong><span style="display:block;margin-top:8px;font-size:.85rem">Interactive 3D preview loads when you open the demo.</span><button type="button" data-load-landing-demo style="margin-top:18px;border:1px solid rgba(103,232,249,.5);border-radius:999px;padding:10px 18px;background:rgba(6,182,212,.12);color:#67e8f9;font-weight:800;cursor:pointer">Load interactive demo</button></div>
              </div>
            </div>
          </div>

          <!-- DEMO INTERACTION FLOATING CHIP -->
          <div style="
            position: absolute; bottom: 16px; left: 16px; z-index: 40; background: rgba(5,5,12,0.9);
            backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.18); border-radius: 30px;
            padding: 8px 18px; font-size: 0.75rem; font-weight: 700; color: #10b981; display: flex; align-items: center; gap: 8px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.6);
          ">
            <span style="width: 8px; height: 8px; border-radius: 50%; background: #10b981; animation: pulse 1.5s infinite;"></span>
            <span id="landing-demo-chip-label">▶ LOAD DEMO</span>
          </div>
        </div>
      </section>

      <!-- 2. FROM CV TO PORTFOLIO (3-STEP STORY) -->
      <section id="features" style="padding: clamp(60px, 8vw, 85px) 48px; max-width: 1300px; margin: 0 auto; text-align: center;">
        <div style="font-size: 0.75rem; font-weight: 800; color: #06b6d4; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 12px;">
          HOW IT WORKS
        </div>
        <h2 style="font-family: 'Outfit', sans-serif; font-size: 2.5rem; font-weight: 900; margin-bottom: 16px;">
          From PDF to portfolio in minutes.
        </h2>
        <p style="color: rgba(255,255,255,0.65); max-width: 620px; margin: 0 auto 50px auto; font-size: 1.05rem;">
          Import your resume, review structured career data, select a 3D environment, and deploy your live portfolio.
        </p>

        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 28px; text-align: left; position: relative;">
          <!-- STEP 1 -->
          <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 18px; padding: 28px;">
            <div style="font-size: 2rem; margin-bottom: 14px;">📄</div>
            <div style="font-size: 0.75rem; font-weight: 800; color: #a855f7; margin-bottom: 8px;">STEP 01</div>
            <h3 style="font-size: 1.2rem; font-weight: 800; margin-bottom: 10px;">Structure Career Data</h3>
            <p style="font-size: 0.88rem; color: rgba(255,255,255,0.6); line-height: 1.6;">
              Upload your existing CV. We structure your experience, projects, education, and skills for your review before publishing.
            </p>
          </div>

          <!-- STEP 2 -->
          <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 18px; padding: 28px;">
            <div style="font-size: 2rem; margin-bottom: 14px;">🎯</div>
            <div style="font-size: 0.75rem; font-weight: 800; color: #06b6d4; margin-bottom: 8px;">STEP 02</div>
            <h3 style="font-size: 1.2rem; font-weight: 800; margin-bottom: 10px;">Target Jobs & Themes</h3>
            <p style="font-size: 0.88rem; color: rgba(255,255,255,0.6); line-height: 1.6;">
              Analyze skill overlaps against target job descriptions and pair your profile with a high-impact 3D theme.
            </p>
          </div>

          <!-- STEP 3 -->
          <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 18px; padding: 28px;">
            <div style="font-size: 2rem; margin-bottom: 14px;">🌐</div>
            <div style="font-size: 0.75rem; font-weight: 800; color: #10b981; margin-bottom: 8px;">STEP 03</div>
            <h3 style="font-size: 1.2rem; font-weight: 800; margin-bottom: 10px;">Deploy & Measure</h3>
            <p style="font-size: 0.88rem; color: rgba(255,255,255,0.6); line-height: 1.6;">
              Publish your portfolio to a shareable URL (custom domains are available on Premium). Track project opens and resume download engagement.
            </p>
          </div>
        </div>
      </section>

      <!-- 3. CINEMATIC THEMES SHOWCASE -->
      <section id="themes" style="padding: clamp(60px, 8vw, 85px) 48px; background: rgba(255,255,255,0.015); border-y: 1px solid rgba(255,255,255,0.06);">
        <div style="max-width: 1300px; margin: 0 auto; display: grid; grid-template-columns: 1fr 1.5fr; gap: 40px; align-items: center;">
          <div>
            <div style="font-size: 0.75rem; font-weight: 800; color: #a855f7; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 12px;">
              PROCEDURAL 3D WORLDS
            </div>
            <h2 style="font-family: 'Outfit', sans-serif; font-size: 2.3rem; font-weight: 900; margin-bottom: 16px;">
              Choose a cinematic environment that fits your work.
            </h2>
            <p style="color: rgba(255,255,255,0.7); font-size: 1rem; line-height: 1.6; margin-bottom: 24px;">
              Every profession gets a custom hardware-accelerated 3D environment with dynamic camera movement and thematic lighting.
            </p>

            <!-- THEME SWITCHER BUTTONS -->
            <div style="display: flex; flex-direction: column; gap: 10px;" id="theme-selector-group">
              <button onclick="switchDemoTheme('code')" id="theme-btn-code" class="demo-theme-btn active" style="
                display: flex; align-items: center; justify-content: space-between; padding: 14px 18px;
                background: rgba(124,58,237,0.2); border: 1px solid #7c3aed; border-radius: 12px;
                color: #fff; font-weight: 700; cursor: pointer; text-align: left; transition: all 0.2s;
              ">
                <span>💻 Code Matrix (Web & Software Engineers)</span>
                <span style="font-size: 0.75rem; color: #a855f7;">ACTIVE</span>
              </button>

              <button onclick="switchDemoTheme('data')" id="theme-btn-data" class="demo-theme-btn" style="
                display: flex; align-items: center; justify-content: space-between; padding: 14px 18px;
                background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px;
                color: #fff; font-weight: 700; cursor: pointer; text-align: left; transition: all 0.2s;
              ">
                <span>📊 Data Galaxy (Data Analysts & BI)</span>
                <span style="font-size: 0.75rem; color: rgba(255,255,255,0.72);">SELECT</span>
              </button>

              <button onclick="switchDemoTheme('cyber')" id="theme-btn-cyber" class="demo-theme-btn" style="
                display: flex; align-items: center; justify-content: space-between; padding: 14px 18px;
                background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px;
                color: #fff; font-weight: 700; cursor: pointer; text-align: left; transition: all 0.2s;
              ">
                <span>🛡️ Cyber Command (Cybersecurity & Infra)</span>
                <span style="font-size: 0.75rem; color: rgba(255,255,255,0.72);">SELECT</span>
              </button>

              <button onclick="switchDemoTheme('cosmic')" id="theme-btn-cosmic" class="demo-theme-btn" style="
                display: flex; align-items: center; justify-content: space-between; padding: 14px 18px;
                background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px;
                color: #fff; font-weight: 700; cursor: pointer; text-align: left; transition: all 0.2s;
              ">
                <span>🌌 Cosmic Elite (Executives & General)</span>
                <span style="font-size: 0.75rem; color: rgba(255,255,255,0.72);">SELECT</span>
              </button>
            </div>
          </div>

          <!-- DYNAMIC 3D THEME CANVAS SHOWCASE -->
          <div style="
            position: relative; height: 380px; border-radius: 20px; overflow: hidden;
            border: 1px solid rgba(255,255,255,0.18); background: #050508;
            box-shadow: 0 25px 60px rgba(0,0,0,0.9); display: flex; flex-direction: column;
          ">
            <canvas id="theme-showcase-canvas" style="position: absolute; inset: 0; width: 100%; height: 100%; z-index: 0;"></canvas>
            <div data-theme-showcase-placeholder class="theme-showcase-placeholder" role="status">
              <strong>Choose a world to preview</strong>
              <span>The interactive 3D scene loads when this section is visible.</span>
            </div>
            
            <div style="
              position: absolute; bottom: 16px; left: 16px; right: 16px; z-index: 10;
              background: rgba(5,5,12,0.88); backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.18);
              border-radius: 14px; padding: 12px 18px; display: flex; justify-content: space-between; align-items: center;
              box-shadow: 0 10px 30px rgba(0,0,0,0.6);
            ">
              <div>
                <div id="theme-preview-badge" style="font-size: 0.78rem; font-weight: 800; color: #06b6d4; font-family: 'JetBrains Mono', monospace; text-transform: uppercase;">
                  CURRENT ENVIRONMENT: CODE MATRIX
                </div>
                <div id="theme-preview-desc" style="font-size: 0.78rem; color: rgba(255,255,255,0.7); margin-top: 2px;">
                  Interactive 3D particle fields and glowing grid systems.
                </div>
              </div>
              <div style="font-size: 0.72rem; color: #10b981; font-weight: 700; background: rgba(16,185,129,0.12); border: 1px solid rgba(16,185,129,0.25); padding: 4px 12px; border-radius: 20px;">
                ✨ Select a world to preview live
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- 4. PORTFOLIO GALLERY -->
      <section id="gallery" aria-labelledby="gallery-title" style="padding: clamp(60px, 8vw, 85px) 48px; max-width: 1300px; margin: 0 auto;">
        <div style="text-align: center; max-width: 760px; margin: 0 auto 32px auto;">
          <div style="font-size: 0.75rem; font-weight: 800; color: #06b6d4; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 12px;">
            PORTFOLIO GALLERY
          </div>
          <h2 id="gallery-title" style="font-family: 'Outfit', sans-serif; font-size: 2.3rem; font-weight: 900; margin-bottom: 16px;">
            See what your work could look like before you sign up.
          </h2>
          <p style="color: rgba(255,255,255,0.7); font-size: 1rem; line-height: 1.6; margin: 0 auto;">
            Explore fictional examples by profession, preview the 3D world, then start your own portfolio with the plan that fits you.
          </p>
        </div>

        <div id="portfolio-gallery-filters" role="tablist" aria-label="Filter portfolio examples" style="display: flex; justify-content: center; gap: 10px; flex-wrap: wrap; margin-bottom: 28px;">
          ${LANDING_GALLERY_FILTERS.map((filter, index) => `
            <button type="button" role="tab" aria-selected="${index === 0 ? 'true' : 'false'}" data-gallery-filter="${filter.id}" style="
              min-height: 44px; padding: 10px 16px; border-radius: 999px; cursor: pointer; font-weight: 700;
              color: #fff; background: ${index === 0 ? 'linear-gradient(135deg, #7c3aed, #06b6d4)' : 'rgba(255,255,255,0.04)'};
              border: 1px solid ${index === 0 ? 'transparent' : 'rgba(255,255,255,0.12)'}; transition: all 0.2s;
            ">${filter.label}</button>
          `).join('')}
        </div>

        <div id="portfolio-gallery-grid" style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 18px;">
          ${renderGalleryCards(isAuthenticated ? '/studio' : '/login?next=%2Fstart')}
        </div>
        <p id="portfolio-gallery-empty" hidden style="text-align: center; color: rgba(255,255,255,0.68); margin: 28px 0 0;">
          No examples in this category yet.
        </p>
      </section>

      <!-- 4. JOB TARGETING SECTION -->
      <section id="targeting" style="padding: clamp(60px, 8vw, 85px) 48px; max-width: 1300px; margin: 0 auto;">
        <div style="display: grid; grid-template-columns: 1fr 1.2fr; gap: 40px; align-items: center;">
          <div>
            <div style="font-size: 0.75rem; font-weight: 800; color: #06b6d4; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 12px;">
              TRUTHFUL JOB MATCHING
            </div>
            <h2 style="font-family: 'Outfit', sans-serif; font-size: 2.3rem; font-weight: 900; margin-bottom: 16px;">
              One profile. Targeted versions for every role.
            </h2>
            <p style="color: rgba(255,255,255,0.7); font-size: 1.05rem; line-height: 1.6; margin-bottom: 22px;">
              Paste any target job description. The Job Optimizer analyzes skill overlap, highlights verified strengths, and shows evidence gaps without fabricating experience.
            </p>
            <div style="background: rgba(124,58,237,0.08); border-left: 3px solid #7c3aed; padding: 14px 18px; border-radius: 0 10px 10px 0; font-size: 0.85rem; color: rgba(255,255,255,0.85);">
              "Tailor the presentation. Keep the truth." — Maintain one Master Profile while generating target-specific portfolio versions.
            </div>
          </div>

          <!-- JOB TARGETING WIDGET MOCK -->
          <div style="
            background: rgba(10,10,20,0.8); border: 1px solid rgba(255,255,255,0.15); border-radius: 20px;
            padding: 30px; position: relative; box-shadow: 0 20px 50px rgba(0,0,0,0.6);
          ">
            <div style="
              position: absolute; top: 16px; right: 16px; font-size: 0.68rem; font-weight: 800;
              color: rgba(255,255,255,0.72); background: rgba(255,255,255,0.06); padding: 3px 10px;
              border-radius: 10px; font-family: 'JetBrains Mono', monospace; letter-spacing: 1px;
            ">
              EXAMPLE ANALYSIS
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
              <div>
                <div style="font-size: 0.75rem; color: rgba(255,255,255,0.72);">Target Job Role:</div>
                <div style="font-size: 1.2rem; font-weight: 800; color: #fff;">Senior Frontend Engineer</div>
              </div>
              <div style="text-align: right; margin-right: 80px;">
                <div style="font-size: 2rem; font-weight: 900; color: #10b981; font-family: 'JetBrains Mono', monospace;">88%</div>
                <div style="font-size: 0.7rem; color: #10b981; font-weight: 700;">HIGH MATCH SCORE</div>
              </div>
            </div>

            <div style="margin-bottom: 18px;">
              <div style="font-size: 0.8rem; font-weight: 700; color: #10b981; margin-bottom: 8px;">✓ Verified Strengths (Matched Skills):</div>
              <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                <span style="padding: 5px 12px; background: rgba(16,185,129,0.15); border: 1px solid rgba(16,185,129,0.3); border-radius: 6px; font-size: 0.78rem; color: #10b981; font-weight: 600;">JavaScript</span>
                <span style="padding: 5px 12px; background: rgba(16,185,129,0.15); border: 1px solid rgba(16,185,129,0.3); border-radius: 6px; font-size: 0.78rem; color: #10b981; font-weight: 600;">HTML5 & CSS3</span>
                <span style="padding: 5px 12px; background: rgba(16,185,129,0.15); border: 1px solid rgba(16,185,129,0.3); border-radius: 6px; font-size: 0.78rem; color: #10b981; font-weight: 600;">REST APIs</span>
              </div>
            </div>

            <div>
              <div style="font-size: 0.8rem; font-weight: 700; color: #f59e0b; margin-bottom: 8px;">⚠ Evidence Required (Skill Gaps):</div>
              <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                <span style="padding: 5px 12px; background: rgba(245,158,11,0.15); border: 1px solid rgba(245,158,11,0.3); border-radius: 6px; font-size: 0.78rem; color: #f59e0b; font-weight: 600;">TypeScript (Missing project proof)</span>
                <span style="padding: 5px 12px; background: rgba(245,158,11,0.15); border: 1px solid rgba(245,158,11,0.3); border-radius: 6px; font-size: 0.78rem; color: #f59e0b; font-weight: 600;">GraphQL</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- 6. RECRUITER MODE VISUAL COMPARISON -->
      <section id="recruiter-mode" style="padding: clamp(60px, 8vw, 85px) 48px; background: rgba(255,255,255,0.015); border-y: 1px solid rgba(255,255,255,0.06); text-align: center;">
        <div style="max-width: 1200px; margin: 0 auto;">
          <div style="font-size: 0.75rem; font-weight: 800; color: #a855f7; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 12px;">
            DUAL PRESENTATION MODE
          </div>
          <h2 style="font-family: 'Outfit', sans-serif; font-size: 2.3rem; font-weight: 900; margin-bottom: 16px;">
            Impress when they browse. Inform when they scan.
          </h2>
          <p style="color: rgba(255,255,255,0.65); max-width: 600px; margin: 0 auto 40px auto; font-size: 1.05rem;">
            Give visitors the full immersive 3D experience or switch to Recruiter View for fast 30-second candidate scanning.
          </p>

          <!-- SIDE-BY-SIDE VISUAL MINI-PREVIEWS -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 28px; text-align: left;">
            <!-- MODE A: CINEMATIC 3D VIEW -->
            <div style="
              background: linear-gradient(135deg, rgba(20,10,35,0.9), rgba(5,5,15,0.95));
              border: 1px solid rgba(124,58,237,0.35); border-radius: 20px; padding: 24px;
              box-shadow: 0 15px 40px rgba(124,58,237,0.15); display: flex; flex-direction: column; justify-content: space-between;
            ">
              <div>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
                  <span style="font-size: 0.75rem; font-weight: 800; color: #a855f7; letter-spacing: 1px;">🎬 MODE A: CINEMATIC 3D VIEW</span>
                  <span style="font-size: 0.68rem; padding: 3px 8px; background: rgba(124,58,237,0.2); color: #a855f7; border-radius: 6px; font-weight: 700;">3D Interactive</span>
                </div>
                
                <!-- MINI PORTFOLIO PREVIEW HERO -->
                <div style="
                  background: rgba(12,12,28,0.85); border: 1px solid rgba(255,255,255,0.15); border-radius: 14px;
                  padding: 18px; margin-bottom: 16px; backdrop-filter: blur(15px); text-align: center;
                ">
                  <div style="width: 48px; height: 48px; border-radius: 50%; border: 2px solid #7c3aed; margin: 0 auto 10px auto; background: #000; overflow: hidden;">
                    <img src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80" alt="Portfolio creator" style="width:100%;height:100%;object-fit:cover;" />
                  </div>
                  <div style="font-size: 1.1rem; font-weight: 900; color: #fff;">Alex Morgan</div>
                  <div style="font-size: 0.78rem; color: #a855f7; font-weight: 700; margin-bottom: 10px;">Frontend Developer</div>
                  <span style="padding: 6px 16px; background: linear-gradient(135deg, #7c3aed, #06b6d4); border-radius: 20px; color: #fff; font-size: 0.72rem; font-weight: 800;">▶ Project Cinema Preview</span>
                </div>
              </div>
              <div style="font-size: 0.8rem; color: rgba(255,255,255,0.6); line-height: 1.5;">
                Full immersive particle worlds, dynamic WebGL camera moves, ambient music triggers, and visual project showcases.
              </div>
            </div>

            <!-- MODE B: RECRUITER FAST-SCAN VIEW -->
            <div style="
              background: linear-gradient(135deg, rgba(5,20,30,0.9), rgba(5,5,15,0.95));
              border: 1px solid rgba(6,182,212,0.35); border-radius: 20px; padding: 24px;
              box-shadow: 0 15px 40px rgba(6,182,212,0.15); display: flex; flex-direction: column; justify-content: space-between;
            ">
              <div>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
                  <span style="font-size: 0.75rem; font-weight: 800; color: #06b6d4; letter-spacing: 1px;">⚡ MODE B: RECRUITER FAST-SCAN</span>
                  <span style="font-size: 0.68rem; padding: 3px 8px; background: rgba(6,182,212,0.2); color: #06b6d4; border-radius: 6px; font-weight: 700;">High Density</span>
                </div>
                
                <!-- MINI RECRUITER CARD PREVIEW -->
                <div style="
                  background: rgba(10,20,30,0.9); border: 1px solid rgba(6,182,212,0.25); border-radius: 14px;
                  padding: 16px; margin-bottom: 16px;
                ">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 8px;">
                    <div>
                      <div style="font-size: 0.95rem; font-weight: 800; color: #fff;">Alex Morgan</div>
                      <div style="font-size: 0.72rem; color: #06b6d4; font-weight: 700;">Senior Frontend Engineer</div>
                    </div>
                    <span style="padding: 5px 12px; background: #06b6d4; border-radius: 6px; color: #000; font-size: 0.72rem; font-weight: 800;">📄 Resume PDF Action</span>
                  </div>
                  <div style="display: flex; gap: 4px; flex-wrap: wrap;">
                    <span style="padding: 2px 6px; background: rgba(255,255,255,0.06); border-radius: 4px; font-size: 0.68rem; color: rgba(255,255,255,0.7);">JavaScript</span>
                    <span style="padding: 2px 6px; background: rgba(255,255,255,0.06); border-radius: 4px; font-size: 0.68rem; color: rgba(255,255,255,0.7);">Three.js</span>
                    <span style="padding: 2px 6px; background: rgba(255,255,255,0.06); border-radius: 4px; font-size: 0.68rem; color: rgba(255,255,255,0.7);">TypeScript</span>
                  </div>
                </div>
              </div>
              <div style="font-size: 0.8rem; color: rgba(255,255,255,0.6); line-height: 1.5;">
                Scannable layout, instant role summary, scannable skills grid, and prominent one-click Resume PDF download button.
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- 7. ANALYTICS SECTION -->
      <section id="analytics" style="padding: clamp(60px, 8vw, 85px) 48px; max-width: 1300px; margin: 0 auto;">
        <div style="display: grid; grid-template-columns: 1.1fr 1fr; gap: 40px; align-items: center;">
          <!-- REALISTIC DEMO ANALYTICS DASHBOARD -->
          <div style="background: rgba(10,10,20,0.85); border: 1px solid rgba(255,255,255,0.15); border-radius: 20px; padding: 30px; position: relative;">
            <div style="
              position: absolute; top: 16px; right: 16px; font-size: 0.68rem; font-weight: 800;
              color: rgba(255,255,255,0.72); background: rgba(255,255,255,0.06); padding: 3px 10px;
              border-radius: 10px; font-family: 'JetBrains Mono', monospace; letter-spacing: 1px;
            ">
              DEMO ANALYTICS
            </div>

            <div style="font-size: 0.75rem; font-weight: 800; color: #10b981; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 16px;">
              📊 VISITOR ENGAGEMENT METRICS
            </div>
            
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 20px;">
              <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 16px; text-align: center;">
                <div style="font-size: 1.8rem; font-weight: 900; color: #fff; font-family: 'JetBrains Mono', monospace;">142</div>
                <div style="font-size: 0.72rem; color: rgba(255,255,255,0.72);">Total Visits</div>
              </div>
              <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 16px; text-align: center;">
                <div style="font-size: 1.8rem; font-weight: 900; color: #a855f7; font-family: 'JetBrains Mono', monospace;">58</div>
                <div style="font-size: 0.72rem; color: rgba(255,255,255,0.72);">Project Opens</div>
              </div>
              <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 16px; text-align: center;">
                <div style="font-size: 1.8rem; font-weight: 900; color: #10b981; font-family: 'JetBrains Mono', monospace;">19</div>
                <div style="font-size: 0.72rem; color: rgba(255,255,255,0.72);">Resume Downloads</div>
              </div>
            </div>

            <div style="font-size: 0.82rem; color: rgba(255,255,255,0.8); background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); padding: 14px; border-radius: 10px;">
              💡 <strong>Top Performing Variant:</strong> Frontend Portfolio (38% Project Open CTR)
            </div>
          </div>

          <div>
            <div style="font-size: 0.75rem; font-weight: 800; color: #10b981; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 12px;">
              VISITOR BEHAVIOR INTELLIGENCE
            </div>
            <h2 style="font-family: 'Outfit', sans-serif; font-size: 2.3rem; font-weight: 900; margin-bottom: 16px;">
              See what visitors actually engage with.
            </h2>
            <p style="color: rgba(255,255,255,0.7); font-size: 1.05rem; line-height: 1.6; margin-bottom: 24px;">
              Privacy-conscious analytics track real visitor behavior—which projects get opened, whether visitors download your resume, and how far down the portfolio they scroll.
            </p>
          </div>
        </div>
      </section>

      <!-- 8. PRICING SECTION -->
      <section id="pricing" style="padding: clamp(60px, 8vw, 85px) 48px; max-width: 1200px; margin: 0 auto; text-align: center;">
        <div style="font-size: 0.75rem; font-weight: 800; color: #a855f7; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 12px;">
          TRANSPARENT PRICING
        </div>
        <h2 style="font-family: 'Outfit', sans-serif; font-size: 2.4rem; font-weight: 900; margin-bottom: 16px;">
          Simple plans for every stage of your career.
        </h2>
        <p style="color: rgba(255,255,255,0.65); max-width: 540px; margin: 0 auto 40px auto; font-size: 1.05rem;">
          Start free with no credit card required. Upgrade anytime for custom domains and targeted portfolio versions.
        </p>

        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 28px; text-align: left; max-width: 1200px; margin: 0 auto;">
          <!-- FREE PLAN CARD -->
          <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; padding: 32px; display: flex; flex-direction: column; justify-content: space-between;">
            <div>
              <div style="font-size: 1.3rem; font-weight: 800; margin-bottom: 6px;">Free Plan</div>
              <div style="font-size: 2.2rem; font-weight: 900; color: #fff; margin-bottom: 18px; font-family: 'JetBrains Mono', monospace;">
                0 EGP
              </div>
              <ul style="list-style: none; padding: 0; margin: 0 0 28px 0; font-size: 0.88rem; color: rgba(255,255,255,0.75); line-height: 2;">
                <li>✓ 1 Portfolio</li>
                <li>✓ 3 Free Themes</li>
                <li>✓ Cinematic 3D Rendering</li>
                <li>✓ 1 HTML Export/month</li>
                <li>✓ Resume PDF Upload</li>
              </ul>
            </div>
            <a href="${isAuthenticated ? '/studio' : '/login?next=%2Fstart'}" style="
              display: block; width: 100%; padding: 14px; text-align: center; background: rgba(255,255,255,0.08);
              border: 1px solid rgba(255,255,255,0.15); border-radius: 10px; color: #fff; font-weight: 700; text-decoration: none;
            ">Get Started Free</a>
          </div>

          <!-- PRO PLAN CARD -->
          <div style="background: rgba(124,58,237,0.08); border: 2px solid #7c3aed; border-radius: 20px; padding: 32px; display: flex; flex-direction: column; justify-content: space-between; position: relative;">
            <div style="
              position: absolute; top: -14px; right: 24px; background: linear-gradient(135deg, #7c3aed, #06b6d4);
              padding: 4px 14px; border-radius: 20px; font-size: 0.7rem; font-weight: 800; color: #fff; letter-spacing: 1px;
            ">MOST POPULAR</div>
            <div>
              <div style="font-size: 1.3rem; font-weight: 800; margin-bottom: 6px;">Pro Plan</div>
              <div style="font-size: 2.2rem; font-weight: 900; color: #10b981; margin-bottom: 18px; font-family: 'JetBrains Mono', monospace;">
                ${PLANS.pro.priceMonthlyEGP} EGP <span style="font-size: 0.9rem; color: rgba(255,255,255,0.72); font-weight: normal;">/ month</span>
              </div>
              <ul style="list-style: none; padding: 0; margin: 0 0 28px 0; font-size: 0.88rem; color: rgba(255,255,255,0.85); line-height: 2;">
                <li>✓ Everything in Free</li>
                <li>✓ 10 Professional Themes</li>
                <li>✓ Publish Online with /u/username</li>
                <li>✓ Continuous Editing</li>
                <li>✓ Unlimited Exports</li>
                <li>✓ Job Fit Analysis</li>
              </ul>
            </div>
            <a href="${planCheckoutPath('pro')}" style="
              display: block; width: 100%; padding: 14px; text-align: center; background: linear-gradient(135deg, #7c3aed, #06b6d4);
              border-radius: 10px; color: #fff; font-weight: 800; text-decoration: none; box-shadow: 0 8px 25px rgba(124,58,237,0.4);
            ">Upgrade to Pro</a>
          </div>

          <!-- PREMIUM PLAN CARD -->
          <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; padding: 32px; display: flex; flex-direction: column; justify-content: space-between;">
            <div>
              <div style="font-size: 1.3rem; font-weight: 800; margin-bottom: 6px;">Premium Plan</div>
              <div style="font-size: 2.2rem; font-weight: 900; color: #fff; margin-bottom: 18px; font-family: 'JetBrains Mono', monospace;">
                ${PLANS.premium.priceMonthlyEGP} EGP <span style="font-size: 0.9rem; color: rgba(255,255,255,0.72); font-weight: normal;">/ month</span>
              </div>
              <ul style="list-style: none; padding: 0; margin: 0 0 28px 0; font-size: 0.88rem; color: rgba(255,255,255,0.75); line-height: 2;">
                <li>✓ Everything in Pro</li>
                <li>✓ All 15 Themes</li>
                <li>✓ Remove Branding</li>
                <li>✓ Custom Domain connection</li>
                <li>✓ Advanced Analytics</li>
              </ul>
            </div>
            <a href="${planCheckoutPath('premium')}" style="
              display: block; width: 100%; padding: 14px; text-align: center; background: rgba(255,255,255,0.08);
              border: 1px solid rgba(255,255,255,0.15); border-radius: 10px; color: #fff; font-weight: 700; text-decoration: none;
            ">Go Premium</a>
          </div>

          <!-- PREMIUM GROUP PLAN CARD -->
          <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; padding: 32px; display: flex; flex-direction: column; justify-content: space-between;">
            <div>
              <div style="font-size: 1.3rem; font-weight: 800; margin-bottom: 6px;">Premium Group</div>
              <div style="font-size: 2.2rem; font-weight: 900; color: #fff; margin-bottom: 18px; font-family: 'JetBrains Mono', monospace;">
                <span style="font-size: 1rem; color: rgba(255,255,255,0.72);">From</span> ${PLANS.premium_group.priceStartingMonthlyEGP} EGP <span style="font-size: 0.9rem; color: rgba(255,255,255,0.72); font-weight: normal;">/ month</span>
              </div>
              <ul style="list-style: none; padding: 0; margin: 0 0 28px 0; font-size: 0.88rem; color: rgba(255,255,255,0.75); line-height: 2;">
                <li>✓ Premium for 2–5 team members</li>
                <li>✓ Individual portfolios per member</li>
                <li>✓ Centralized billing</li>
              </ul>
            </div>
            <a href="${isPremiumGroupOwner ? '/studio?manage_group=1' : isAuthenticated ? '/pricing?plan=premium_group' : '/login?next=%2Fpricing%3Fplan%3Dpremium_group'}" style="
              display: block; width: 100%; padding: 14px; text-align: center; background: rgba(255,255,255,0.08);
              border: 1px solid rgba(255,255,255,0.15); border-radius: 10px; color: #fff; font-weight: 700; text-decoration: none;
            ">${isPremiumGroupOwner ? 'Invite Teammates' : 'Choose Group'}</a>
          </div>
        </div>
      </section>

      <!-- 9. TRUTHFUL FAQ -->
      <section style="padding: clamp(60px, 8vw, 85px) 48px; max-width: 900px; margin: 0 auto;">
        <h2 style="font-family: 'Outfit', sans-serif; font-size: 2.2rem; font-weight: 900; text-align: center; margin-bottom: 32px;">
          Frequently Asked Questions
        </h2>

        <div style="display: flex; flex-direction: column; gap: 14px;">
          <details style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 16px; cursor: pointer;">
            <summary style="font-weight: 700; font-size: 1rem; color: #fff;">Can I import my existing PDF CV?</summary>
            <p style="margin-top: 10px; font-size: 0.9rem; color: rgba(255,255,255,0.65); line-height: 1.6;">
              Yes! Upload your PDF CV and the platform structures your experience, education, projects, and skills into a Master Profile for your review.
            </p>
          </details>

          <details style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 16px; cursor: pointer;">
            <summary style="font-weight: 700; font-size: 1rem; color: #fff;">Can I edit imported information before publishing?</summary>
            <p style="margin-top: 10px; font-size: 0.9rem; color: rgba(255,255,255,0.65); line-height: 1.6;">
              Absolutely. You have full control in the Studio to add, edit, or remove any career details before making your portfolio live.
            </p>
          </details>

          <details style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 16px; cursor: pointer;">
            <summary style="font-weight: 700; font-size: 1rem; color: #fff;">Can I create versions for different job applications?</summary>
            <p style="margin-top: 10px; font-size: 0.9rem; color: rgba(255,255,255,0.65); line-height: 1.6;">
              Yes. Pro users can create up to 5 targeted portfolio versions tailored to specific job descriptions without duplicating their core data.
            </p>
          </details>

          <details style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 16px; cursor: pointer;">
            <summary style="font-weight: 700; font-size: 1rem; color: #fff;">Does the platform fabricate skills I don't have?</summary>
            <p style="margin-top: 10px; font-size: 0.9rem; color: rgba(255,255,255,0.65); line-height: 1.6;">
              No. We strictly adhere to truthfulness. The Job Optimizer highlights verified skill matches and flags evidence gaps without falsifying experience.
            </p>
          </details>

          <details style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 16px; cursor: pointer;">
            <summary style="font-weight: 700; font-size: 1rem; color: #fff;">Can I use my own custom domain?</summary>
              <p style="margin-top: 10px; font-size: 0.9rem; color: rgba(255,255,255,0.65); line-height: 1.6;">
                Custom domains are a Premium feature. Vercel provides the required DNS record and activates the domain only after verification and secure serving are ready.
              </p>
          </details>

          <details style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 16px; cursor: pointer;">
            <summary style="font-weight: 700; font-size: 1rem; color: #fff;">Which plan should I choose?</summary>
            <p style="margin-top: 10px; font-size: 0.9rem; color: rgba(255,255,255,0.65); line-height: 1.6;">
              Choose Free to build and download one portfolio. Choose Pro when you need a hosted link, continuous editing, PDF export, and targeted versions. Choose Premium for all themes, custom domains, no branding, and advanced analytics. Premium Group gives the same Premium access to 2–5 individual accounts under one subscription.
            </p>
          </details>

          <details style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 16px; cursor: pointer;">
            <summary style="font-weight: 700; font-size: 1rem; color: #fff;">Can visitors download my resume?</summary>
            <p style="margin-top: 10px; font-size: 0.9rem; color: rgba(255,255,255,0.65); line-height: 1.6;">
              Yes. You can upload a PDF resume, and visitors can download it directly from your portfolio navbar or Recruiter View.
            </p>
          </details>

          <details style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 16px; cursor: pointer;">
            <summary style="font-weight: 700; font-size: 1rem; color: #fff;">Does it work on mobile devices?</summary>
            <p style="margin-top: 10px; font-size: 0.9rem; color: rgba(255,255,255,0.65); line-height: 1.6;">
              Yes. Portfolios feature responsive layouts optimized for all screen sizes from mobile phones to high-resolution desktop displays.
            </p>
          </details>
        </div>
      </section>

      <!-- 10. FINAL CALL TO ACTION -->
      <section style="padding: 80px 48px; text-align: center; background: linear-gradient(180deg, rgba(5,5,12,0) 0%, rgba(124,58,237,0.1) 100%); border-t: 1px solid rgba(255,255,255,0.08);">
        <h2 style="font-family: 'Outfit', sans-serif; font-size: 2.6rem; font-weight: 900; margin-bottom: 16px;">
          Your experience deserves more than a PDF.
        </h2>
        <p style="color: rgba(255,255,255,0.7); max-width: 580px; margin: 0 auto 32px auto; font-size: 1.05rem;">
          Turn your career story into an interactive 3D portfolio built for the jobs you want.
        </p>
        <a href="${isAuthenticated ? '/studio' : '/login?next=%2Fstart'}" style="
          padding: 18px 40px; background: linear-gradient(135deg, #7c3aed, #06b6d4); border-radius: 14px;
          color: #fff; font-size: 1.1rem; font-weight: 800; text-decoration: none; box-shadow: 0 10px 35px rgba(124,58,237,0.4);
          display: inline-block; transition: transform 0.2s;
        " onmouseover="this.style.transform='scale(1.04)'" onmouseout="this.style.transform='scale(1)'">
          ⚡ ${isAuthenticated ? 'Open Studio Workspace' : 'Build My Portfolio Now'}
        </a>
      </section>

      <!-- FOOTER -->
      <footer style="
        padding: 28px 48px; border-top: 1px solid rgba(255,255,255,0.08); text-align: center;
        font-size: 0.8rem; color: rgba(255,255,255,0.72); font-family: 'Inter', sans-serif;
        display: flex; justify-content: space-between; align-items: center; max-width: 1300px; margin: 0 auto;
      ">
        <div>© ${new Date().getFullYear()} 3D Portfolio Maker. Built for ambitious careers.</div>
        <div style="display: flex; gap: 20px;">
          <a href="/privacy" style="color: rgba(255,255,255,0.72); min-height: 44px; display: inline-flex; align-items: center; text-decoration: none;">Privacy</a>
          <a href="/terms" style="color: rgba(255,255,255,0.72); min-height: 44px; display: inline-flex; align-items: center; text-decoration: none;">Terms</a>
          <a href="mailto:support@3dportfolio.app" style="color: rgba(255,255,255,0.72); min-height: 44px; display: inline-flex; align-items: center; text-decoration: none;">Support</a>
        </div>
      </footer>
    </div>
  `;

  setupLandingGallery();

  // Marketing pages stay lightweight: 3D code is fetched only after an
  // explicit interaction with the demo (or a theme switcher button).
  document.querySelector('[data-load-landing-demo]')?.addEventListener('click', () => initLandingHeroDemo(), { once: true });
}

function renderGalleryCards(buildHref) {
  const tierLabels = { free: 'Free theme', pro: 'Pro theme', premium: 'Premium theme' };
  const tierColors = { free: '#10b981', pro: '#a855f7', premium: '#06b6d4' };

  return LANDING_GALLERY_ITEMS.map(item => {
    const theme = getThemeById(item.themeId);
    const tier = getThemeTier(item.themeId);
    const themeName = theme?.name || item.themeId;
    const themeEmoji = theme?.emoji || '✨';
    const color = tierColors[tier] || tierColors.free;
    return `
      <article data-gallery-card data-gallery-filters="${item.filters.join(',')}" style="
        display: flex; flex-direction: column; min-width: 0; background: linear-gradient(145deg, rgba(255,255,255,0.065), rgba(255,255,255,0.02));
        border: 1px solid rgba(255,255,255,0.12); border-radius: 18px; padding: 22px; min-height: 250px;
      ">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 20px;">
          <span style="font-size: 1.8rem;" aria-hidden="true">${themeEmoji}</span>
          <span style="font-size: 0.68rem; font-weight: 800; letter-spacing: 0.6px; color: ${color}; background: ${color}1c; border: 1px solid ${color}55; padding: 5px 9px; border-radius: 999px; white-space: nowrap;">
            ${tierLabels[tier]}
          </span>
        </div>
        <div style="font-size: 0.75rem; color: ${color}; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 7px;">${item.role}</div>
        <h3 style="font-family: 'Outfit', sans-serif; font-size: 1.35rem; margin: 0 0 9px;">${item.title}</h3>
        <p style="font-size: 0.88rem; color: rgba(255,255,255,0.68); line-height: 1.55; margin: 0 0 20px; flex: 1;">${item.description}</p>
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap;">
          <button type="button" data-gallery-preview="${item.themeId}" style="
            min-height: 44px; padding: 10px 12px; border: 1px solid rgba(255,255,255,0.15); border-radius: 10px;
            color: rgba(255,255,255,0.86); background: rgba(255,255,255,0.05); cursor: pointer; font-weight: 700;
          ">Preview ${themeName}</button>
          <a href="${buildHref}" data-gallery-build style="
            min-height: 44px; padding: 10px 12px; display: inline-flex; align-items: center; border-radius: 10px;
            color: #fff; background: linear-gradient(135deg, #7c3aed, #06b6d4); text-decoration: none; font-weight: 800;
          ">Build this style</a>
        </div>
      </article>
    `;
  }).join('');
}

function setupLandingGallery() {
  const filterButtons = [...document.querySelectorAll('[data-gallery-filter]')];
  const cards = [...document.querySelectorAll('[data-gallery-card]')];
  const emptyState = document.getElementById('portfolio-gallery-empty');
  if (!filterButtons.length || !cards.length) return;

  const applyFilter = (filterId) => {
    let visibleCount = 0;
    cards.forEach(card => {
      const matches = filterId === 'all' || card.dataset.galleryFilters.split(',').includes(filterId);
      // Set both the semantic hidden state and an explicit display state. The
      // latter keeps the filter deterministic when a global stylesheet or a
      // browser extension overrides the user-agent `[hidden]` rule.
      card.hidden = !matches;
      card.style.display = matches ? '' : 'none';
      card.setAttribute('aria-hidden', String(!matches));
      if (matches) visibleCount += 1;
    });
    if (emptyState) emptyState.hidden = visibleCount > 0;
    filterButtons.forEach(button => {
      const active = button.dataset.galleryFilter === filterId;
      button.setAttribute('aria-selected', String(active));
      button.style.background = active ? 'linear-gradient(135deg, #7c3aed, #06b6d4)' : 'rgba(255,255,255,0.04)';
      button.style.borderColor = active ? 'transparent' : 'rgba(255,255,255,0.12)';
    });
  };

  filterButtons.forEach(button => {
    button.addEventListener('click', () => applyFilter(button.dataset.galleryFilter));
  });

  document.querySelectorAll('[data-gallery-preview]').forEach(button => {
    button.addEventListener('click', async () => {
      try {
        await window.switchDemoTheme?.(button.dataset.galleryPreview);
      } catch (error) {
        // Theme preview is progressive enhancement; the gallery remains
        // usable even if the optional 3D runtime cannot load.
        console.warn('[Landing Gallery] Theme preview unavailable:', error?.message || error);
      }
      document.getElementById('themes')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  applyFilter('all');
}

function scheduleLandingHeroDemo() {
  if (landingDemoInitScheduled) return;
  landingDemoInitScheduled = true;
  const start = () => initLandingHeroDemo();
  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(start, { timeout: 1600 });
  } else {
    window.setTimeout(start, 350);
  }
}

function updateLandingDemoScale() {
  const viewport = document.getElementById('landing-hero-viewport');
  const scaleWrapper = document.getElementById('landing-demo-scale-wrapper');
  if (!viewport || !scaleWrapper) return;

  const rect = viewport.getBoundingClientRect();
  const logicalW = 1280;
  const logicalH = 800;
  const scale = Math.min(rect.width / logicalW, rect.height / logicalH);

  scaleWrapper.style.transform = `scale(${scale.toFixed(4)})`;
  const leftOffset = Math.max(0, (rect.width - logicalW * scale) / 2);
  const topOffset = Math.max(0, (rect.height - logicalH * scale) / 2);
  scaleWrapper.style.left = `${leftOffset}px`;
  scaleWrapper.style.top = `${topOffset}px`;
}

function renderScaledDemoHTML(viewport, html) {
  viewport.innerHTML = `
    <div id="landing-demo-scale-wrapper" style="
      width: 1280px; height: 800px; position: absolute; top: 0; left: 0;
      transform-origin: top left; pointer-events: none; box-sizing: border-box; overflow: hidden;
    ">
      ${html}
    </div>
  `;
  viewport.scrollTop = 0;
  const demoHeroHeading = viewport.querySelector('.hero-name');
  if (demoHeroHeading?.tagName === 'H1') {
    const replacement = document.createElement('h2');
    for (const attribute of demoHeroHeading.attributes) replacement.setAttribute(attribute.name, attribute.value);
    replacement.innerHTML = demoHeroHeading.innerHTML;
    demoHeroHeading.replaceWith(replacement);
  }
  installProjectCinemaControls();
  updateLandingDemoScale();
}

let themeShowcaseEngine = null;

function initThemeShowcaseCanvas(theme) {
  const canvas = document.getElementById('theme-showcase-canvas');
  if (!canvas) return;
  const placeholder = document.querySelector('[data-theme-showcase-placeholder]');
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  try {
    if (!themeShowcaseEngine) {
      themeShowcaseEngine = new HyperEngine(canvas);
      themeShowcaseEngine.init(theme);
    } else {
      themeShowcaseEngine.applyTheme(theme);
    }
    placeholder?.setAttribute('hidden', '');
  } catch (e) {
    if (placeholder) {
      placeholder.hidden = false;
      placeholder.querySelector('strong').textContent = '3D preview unavailable';
      placeholder.querySelector('span').textContent = 'You can still explore every theme and build your portfolio without WebGL.';
    }
    console.warn('[Landing Page] Theme showcase fallback:', e.message);
  }
}

function initThemeShowcaseWhenVisible(theme) {
  const canvas = document.getElementById('theme-showcase-canvas');
  if (!canvas) return;
  if (!('IntersectionObserver' in window)) {
    initThemeShowcaseCanvas(theme);
    return;
  }
  const observer = new IntersectionObserver((entries) => {
    if (entries.some(entry => entry.isIntersecting)) {
      observer.disconnect();
      initThemeShowcaseCanvas(theme);
    }
  }, { rootMargin: '240px 0px' });
  observer.observe(canvas);
}

async function initLandingHeroDemo() {
  const canvas = document.getElementById('landing-hero-canvas');
  const viewport = document.getElementById('landing-hero-viewport');

  if (!canvas || !viewport) return;

  try {
    const stateLabel = document.getElementById('landing-demo-state');
    const chipLabel = document.getElementById('landing-demo-chip-label');
    if (stateLabel) stateLabel.textContent = 'LOADING 3D…';
    if (chipLabel) chipLabel.textContent = '⏳ LOADING';
    await loadDemoRuntime();
    // Hero demo is FIXED to Code Matrix ('code') and is completely independent
    const heroTheme = getThemeById('code');

    // Inject Portfolio CSS into document head for hero preview
    let styleTag = document.getElementById('portfolio-demo-style');
    if (!styleTag) {
      styleTag = document.createElement('style');
      styleTag.id = 'portfolio-demo-style';
      document.head.appendChild(styleTag);
    }
    styleTag.textContent = generatePortfolioCSS(heroTheme);

    if (!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      demoEngine = new HyperEngine(canvas);
      demoEngine.init(heroTheme);
    }

    // Initialize the below-the-fold showcase only when it is near the viewport.
    const showcaseTheme = getThemeById('code');
    initThemeShowcaseWhenVisible(showcaseTheme);

    const html = generatePortfolioHTMLBody(MARKETING_DEMO_PORTFOLIO, heroTheme, { deviceMode: 'desktop' });
    renderScaledDemoHTML(viewport, html);
    viewport.removeAttribute('aria-hidden');
    viewport.removeAttribute('inert');
    if (stateLabel) stateLabel.textContent = '⚡ 3D LIVE';
    if (chipLabel) chipLabel.textContent = '⚡ 3D LIVE';

    window.removeEventListener('resize', updateLandingDemoScale);
    window.addEventListener('resize', updateLandingDemoScale);
  } catch (e) {
    const stateLabel = document.getElementById('landing-demo-state');
    const chipLabel = document.getElementById('landing-demo-chip-label');
    if (stateLabel) stateLabel.textContent = '2D PREVIEW';
    if (chipLabel) chipLabel.textContent = '✓ PREVIEW READY';
    console.warn('[Landing Page] Hero 3D demo fallback:', e.message);
  }
}

window.switchDemoTheme = async function(themeId) {
  await loadDemoRuntime();
  const normalizedThemeId = themeId === 'cyber' ? 'hacker' : themeId;
  const theme = getThemeById(normalizedThemeId);

  // 1. Update Theme Showcase badge and description
  const badge = document.getElementById('theme-preview-badge');
  if (badge) {
    badge.textContent = `CURRENT ENVIRONMENT: ${theme.name.toUpperCase()}`;
  }

  const desc = document.getElementById('theme-preview-desc');
  if (desc) {
    const descriptions = {
      code: 'Interactive 3D particle fields and glowing grid systems.',
      data: 'Orbital data node networks and analytical galaxy fields.',
      cyber: 'High-contrast security matrices and futuristic command grids.',
      cosmic: 'Deep space cosmic particle fields and executive ambiance.'
    };
    desc.textContent = descriptions[themeId] || 'Procedural 3D environment.';
  }

  // 2. Update button active UI states
  document.querySelectorAll('.demo-theme-btn').forEach(btn => {
    btn.style.background = 'rgba(255,255,255,0.03)';
    btn.style.borderColor = 'rgba(255,255,255,0.08)';
    const spanTag = btn.querySelector('span:last-child');
    if (spanTag) {
      spanTag.textContent = 'SELECT';
      spanTag.style.color = 'rgba(255,255,255,0.72)';
    }
  });

  const activeBtn = document.getElementById(`theme-btn-${themeId}`);
  if (activeBtn) {
    activeBtn.style.background = 'rgba(124,58,237,0.2)';
    activeBtn.style.borderColor = '#7c3aed';
    const spanTag = activeBtn.querySelector('span:last-child');
    if (spanTag) {
      spanTag.textContent = 'ACTIVE';
      spanTag.style.color = '#a855f7';
    }
  }

  // 3. ONLY apply theme to Theme Showcase canvas (Hero remains independent Code Matrix)
  if (themeShowcaseEngine) {
    themeShowcaseEngine.applyTheme(theme);
  }
};
