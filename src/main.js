/**
 * main.js - Ultra 3D Portfolio Maker (Studio App)
 */

import './index.css';
import { renderAuthPage, renderResetPasswordPage } from './AuthPage.js';
import { renderAdminPage } from './AdminPage.js';
import { supabase } from './services/SupabaseClient.js';
import { isLoggedIn, getCurrentUser, getCurrentAuthUser, isPro, logout, upgradeToPro, isAdmin, redeemPromoCode, subscribeToAuthStateChange, isEmailVerified } from './services/AuthService.js';

window.supabase = supabase;
window.getCurrentAuthUser = getCurrentAuthUser;
window.uploadAvatar = uploadAvatar;
import { HyperEngine } from './three/HyperEngine.js';
import { classifyProfession, getThemeById, getAllThemes } from './three/ProceduralTheme.js';
import { exportStandaloneHTML, generateShareableURL } from './exporter/PortfolioExporter.js';
import { globalUsageLimit } from './services/UsageLimitService.js';
import { generatePortfolioCSS, generatePortfolioHTMLBody } from './renderer/PortfolioRenderer.js';
import { installProjectCinemaControls } from './renderer/ProjectCinema.js';
import { SceneDirector } from './three/SceneDirector.js';
import { ScrollDirector } from './three/ScrollDirector.js';
import { IntroDirector } from './three/IntroDirector.js';
import { initMobileNavigationController, toggleMobileMenu } from './renderer/MobileNavigationController.js';
import {
  createPortfolio, getAllPortfolios,
  getAnalytics, saveDraft, getCurrentDraft, incrementStat,
  encodePortfolioToURL, savePortfolioDebounced,
  loadUserPortfoliosFromSupabase, fetchUserProfileAndEntitlements,
  publishPortfolio
} from './services/DBService.js';
import { uploadAvatar, uploadResume, uploadProjectMedia, getResumeAccessUrl, deleteAsset } from './services/AssetStorageService.js';
import { initCVImportModal, openCVImportModal } from './ui/CVImportModal.js';
import { mapCVToPortfolioData } from './services/CVPortfolioMapper.js';
import { renderJobTargetPanel } from './ui/JobTargetPanel.js';
import { resolvePortfolioVariant } from './services/PortfolioVariantService.js';
import { renderPortfolioVariantManager } from './ui/PortfolioVariantManager.js';
import { renderAnalyticsDashboard } from './ui/AnalyticsDashboard.js';
import { initPublicPortfolioAnalytics } from './services/AnalyticsService.js';
import { openBillingModal } from './ui/BillingModal.js';
import { globalEntitlements } from './services/EntitlementService.js';
window.globalEntitlements = globalEntitlements;
import { canAccessTheme, getThemeTier, getThemeBadge } from './config/ThemeTierConfig.js';
import { isFeatureEnabled } from './config/FeatureFlags.js';
import { PLANS } from './config/PlanConfig.js';
import { renderCustomDomainPanel } from './ui/CustomDomainPanel.js';
import { renderProductionReadinessPanel } from './ui/ProductionReadinessPanel.js';
import confetti from 'canvas-confetti';

// ─── STATE ─────────────────────────────────
let engine = null;
let sceneDirector = null;
let scrollDirector = null;
let introDirector = null;
let entitlementChannel = null;
let currentTheme = null;
let activeTab = 'profile';
let activeSection = 'hero';
let portfolioData = {
  name: '', tagline: '', profession: '', bio: '',
  location: '', avatar: '',
  social: { github: '', linkedin: '', twitter: '', email: '', website: '' },
  skills: [],
  projects: [],
  experience: [],
  education: [],
  resume: null,
  viewMode: 'cinematic',
  contactMessage: "I'm always open to new opportunities and collaborations.",
  theme: 'cosmic',
  customColors: null
};

// ─── PRESETS ───────────────────────────────
const PRESETS = {
  developer: {
    name: 'Alex Morgan', tagline: 'Building high-impact web products & 3D experiences',
    profession: 'Senior Frontend Engineer', bio: "Product-minded engineer with 5+ years of experience building high-throughput web applications, 3D interactive interfaces, and scalable component systems.",
    location: 'Cairo, Egypt',
    social: { github: 'https://github.com', linkedin: 'https://linkedin.com', email: 'alex@example.com' },
    experience: [
      {
        id: 'exp_1',
        role: 'Senior Frontend Engineer',
        company: 'Nova Labs',
        location: 'Cairo, Egypt',
        startDate: '2024',
        endDate: 'Present',
        current: true,
        description: 'Leading frontend architecture for 3D interactive web products and real-time canvas editors.',
        achievements: ['Improved page performance by 45%.', 'Engineered modular WebGL camera director pipeline.', 'Mentored 5 junior frontend developers.'],
        technologies: ['React', 'TypeScript', 'Three.js', 'Vite', 'WebGL'],
        companyUrl: 'https://novalabs.example.com'
      },
      {
        id: 'exp_2',
        role: 'Frontend Developer',
        company: 'Pixel Works',
        location: 'Remote',
        startDate: '2022',
        endDate: '2024',
        current: false,
        description: 'Developed responsive web applications, design systems, and client dashboards.',
        achievements: ['Reduced JavaScript bundle size by 30%.', 'Shipped 12+ production client web apps.'],
        technologies: ['React', 'JavaScript', 'CSS3', 'Node.js'],
        companyUrl: 'https://pixelworks.example.com'
      }
    ],
    education: [
      {
        id: 'edu_1',
        degree: 'B.Sc. Computer Science',
        field: 'Software Engineering & Computer Graphics',
        institution: 'Cairo University',
        location: 'Cairo, Egypt',
        startDate: '2020',
        endDate: '2024',
        grade: 'Excellent with Honors',
        description: 'Specialized in Software Architecture, Computer Graphics, Data Structures, and Distributed Systems.'
      }
    ],
    resume: {
      url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
      fileName: 'Alex-Morgan-Resume.pdf',
      buttonText: 'Download Resume'
    },
    skills: [
      {name:'React',level:95},{name:'Node.js',level:88},{name:'TypeScript',level:85},
      {name:'Three.js',level:82},{name:'Docker',level:78},{name:'AWS',level:72}
    ],
    projects: [
      {name:'DevFlow',description:'A real-time collaborative code editor with AI assistance and Git integration.',tech:'React · Node.js · WebSockets',url:'https://github.com'},
      {name:'CloudSync',description:'Distributed cloud synchronization platform handling 10M+ daily requests.',tech:'Go · Kubernetes · Redis',url:'https://github.com'},
      {name:'OpenAPI Kit',description:'Open-source toolkit for rapid REST API generation from database schemas.',tech:'Python · FastAPI · PostgreSQL',url:'https://github.com'}
    ],
    theme: 'code',
    viewMode: 'cinematic'
  },
  hacker: {
    name: 'Cipher X', tagline: 'Securing the Digital World',
    profession: 'Cybersecurity Engineer', bio: "Ethical hacker and security researcher with 7+ years in penetration testing, vulnerability research, and building defenses for Fortune 500 companies. CEH, OSCP certified.",
    location: 'Remote',
    social: { github: 'https://github.com', linkedin: 'https://linkedin.com', twitter: 'https://twitter.com', email: 'cipher@example.com' },
    skills: [
      {name:'Penetration Testing',level:97},{name:'Network Security',level:92},{name:'Python',level:88},
      {name:'Reverse Engineering',level:85},{name:'Cryptography',level:82},{name:'SIEM/SOC',level:80}
    ],
    projects: [
      {name:'VulnScan Pro',description:'Automated vulnerability scanner detecting 200+ CVEs across web applications.',tech:'Python · Nmap · Metasploit',url:'#'},
      {name:'NetGuard',description:'Real-time network intrusion detection system with ML anomaly detection.',tech:'C++ · TensorFlow · Wireshark',url:'#'},
      {name:'CryptShield',description:'End-to-end encrypted messaging platform with zero-knowledge proofs.',tech:'Rust · ZK-SNARKs · gRPC',url:'#'}
    ],
    theme: 'hacker'
  },
  designer: {
    name: 'Luna Artis', tagline: 'Where Design Meets Emotion',
    profession: 'UI/UX & 3D Visual Designer', bio: "Award-winning designer crafting immersive digital experiences. I believe design should evoke emotion, tell stories, and push boundaries. Creator of 50+ commercial brands and digital products.",
    location: 'Paris, France',
    social: { linkedin: 'https://linkedin.com', twitter: 'https://twitter.com', website: 'https://behance.net', email: 'luna@example.com' },
    skills: [
      {name:'Figma',level:98},{name:'After Effects',level:91},{name:'Blender 3D',level:87},
      {name:'Brand Strategy',level:85},{name:'Motion Design',level:90},{name:'Illustrator',level:94}
    ],
    projects: [
      {name:'NeoBank App',description:'Redesigned digital banking experience increasing user retention by 340%.',tech:'Figma · Prototyping · User Research',url:'#'},
      {name:'Cosmos Brand',description:'Complete 360° brand identity for a tech startup from concept to launch.',tech:'Illustrator · Brand Design',url:'#'},
      {name:'HoloCar',description:'3D interactive car configurator with real-time rendering and AR features.',tech:'Blender · Three.js · WebXR',url:'#'}
    ],
    theme: 'creative'
  },
  marketing: {
    name: 'Max Growth', tagline: 'Turning Data Into Revenue',
    profession: 'Digital Marketing Strategist', bio: "Growth hacker and marketing strategist with proven track record of scaling startups from 0 to $10M ARR. Specializing in performance marketing, SEO, and viral product strategies.",
    location: 'New York, USA',
    social: { linkedin: 'https://linkedin.com', twitter: 'https://twitter.com', email: 'max@example.com' },
    skills: [
      {name:'Growth Hacking',level:96},{name:'SEO/SEM',level:91},{name:'Content Strategy',level:88},
      {name:'Data Analytics',level:85},{name:'Paid Ads',level:92},{name:'Email Marketing',level:87}
    ],
    projects: [
      {name:'Viral Launch',description:'Engineered a product launch campaign that generated 2M impressions in 48 hours.',tech:'Content · Social · Analytics',url:'#'},
      {name:'SEO Domination',description:'Achieved 350% organic traffic growth for SaaS platform within 6 months.',tech:'SEMrush · Ahrefs · Content',url:'#'},
      {name:'Growth Engine',description:'Built automated marketing funnel converting 12% of leads to paying customers.',tech:'HubSpot · Zapier · Analytics',url:'#'}
    ],
    theme: 'marketing'
  },
  data: {
    name: 'Dr. Nova Chen', tagline: 'Finding Insights in the Noise',
    profession: 'Data Scientist & ML Engineer', bio: "PhD in Computer Science with 8+ years building ML models at scale. I turn messy data into actionable insights and deploy models that power real business decisions.",
    location: 'Seattle, WA',
    social: { github: 'https://github.com', linkedin: 'https://linkedin.com', email: 'nova@example.com' },
    skills: [
      {name:'Python',level:97},{name:'Machine Learning',level:94},{name:'Deep Learning',level:90},
      {name:'SQL',level:92},{name:'Spark/Hadoop',level:85},{name:'Statistics',level:95}
    ],
    projects: [
      {name:'PredictIQ',description:'Predictive analytics platform processing 100TB+ of e-commerce data daily.',tech:'Python · TensorFlow · BigQuery',url:'#'},
      {name:'NLP Engine',description:'Custom NLP pipeline for sentiment analysis with 96.4% accuracy on 50+ languages.',tech:'BERT · PyTorch · FastAPI',url:'#'},
      {name:'DataViz Pro',description:'Interactive dashboard reducing data-to-decision time by 70% for enterprises.',tech:'D3.js · React · PostgreSQL',url:'#'}
    ],
    theme: 'data'
  }
};

import { renderLandingPage } from './ui/LandingPage.js';
import { renderOnboardingWizard } from './ui/OnboardingWizard.js';
import { renderFirstRunChecklist } from './ui/FirstRunChecklist.js';
import { renderWorkspaceNav, renderWorkspaceHeader, setActiveWorkspace } from './ui/StudioWorkspaceLayout.js';
import { renderPrivacyPage } from './ui/PrivacyPage.js';
import { renderTermsPage } from './ui/TermsPage.js';
import { openAccountSettingsModal } from './ui/AccountSettingsModal.js';
import { setPageTitle } from './config/ProductConfig.js';

function getAppContainer() {
  let app = document.getElementById('app');
  if (!app) {
    app = document.createElement('div');
    app.id = 'app';
    document.body.appendChild(app);
  }
  return app;
}

// ─── ROUTER ─────────────────────────────────
async function router() {
  const path = window.location.pathname;

  // 1. Public Portfolio Route
  if (path.startsWith('/u/')) {
    const parts = path.split('/').filter(Boolean); // ['u', 'username', 'variantSlug']
    const username = parts[1];
    const variantSlug = parts[2] || null;

    if (username) {
      setPageTitle(username);
      handlePublicRoute(username, variantSlug);
      return;
    }
  }

  // 2. Recovery / Reset Password Route
  const isRecoveryMode = path.startsWith('/reset-password') ||
                         window.location.hash.includes('type=recovery') ||
                         window.location.search.includes('type=recovery') ||
                         window.location.search.includes('code=');

  if (isRecoveryMode) {
    setPageTitle('Set New Password');
    renderResetPasswordPage(() => {
      window.location.href = '/login';
    });
    return;
  }

  // 3. Marketing Landing Page Route
  if (path === '/' || path === '/index.html') {
    setPageTitle('');
    renderLandingPage(getAppContainer());
    return;
  }

  // 3. Privacy Policy Route
  if (path === '/privacy') {
    setPageTitle('Privacy Policy');
    renderPrivacyPage(getAppContainer());
    return;
  }

  // 4. Terms of Service Route
  if (path === '/terms') {
    setPageTitle('Terms of Service');
    renderTermsPage(getAppContainer());
    return;
  }

  // 5. Start Onboarding Route
  if (path === '/start') {
    setPageTitle('Build My Portfolio');
    renderOnboardingWizard(getAppContainer());
    return;
  }

  // 6. Login Route
  if (path === '/login') {
    setPageTitle('Sign In');
    renderAuthPage((user) => {
      const requestedNext = new URLSearchParams(window.location.search).get('next');
      const safeNext = requestedNext && requestedNext.startsWith('/') && !requestedNext.startsWith('//')
        ? requestedNext
        : '/studio';
      window.location.href = safeNext;
    });
    return;
  }

  // 7. Studio App Route
  if (path === '/studio') {
    setPageTitle('Creator Studio');
    const authUser = await getCurrentAuthUser();
    if (!authUser) {
      window.location.href = '/login';
      return;
    }
    if (!isEmailVerified(authUser)) {
      renderAuthPage(() => {
        window.location.href = '/studio';
      });
      return;
    }
    initStudio();
    return;
  }

  // 8. Server-protected Admin Dashboard
  if (path === '/admin') {
    setPageTitle('Admin Dashboard');
    const authUser = await getCurrentAuthUser();
    if (!authUser) {
      window.location.href = '/login?next=/admin';
      return;
    }
    if (!(await isAdmin())) {
      renderAdminForbidden();
      return;
    }
    await renderAdminPage();
    return;
  }

  // Unknown routes must not masquerade as a valid marketing page.
  setPageTitle('Page Not Found');
  render404Page(path);
}

function renderAdminForbidden() {
  document.body.innerHTML = `<main class="admin-forbidden"><div><span>🔒</span><h1>Admin access required</h1><p>This signed-in account does not have administrator permissions.</p><a href="/studio">Back to Studio</a></div></main>`;
}

async function handlePublicRoute(username, variantSlug) {
  document.body.innerHTML = `
    <div style="min-height:100vh;background:#050508;display:flex;align-items:center;justify-content:center;color:#fff;font-family:'Inter',sans-serif">
      <div style="text-align:center">
        <div style="font-size:3rem;margin-bottom:12px">⚡</div>
        <div style="font-size:1.2rem;font-weight:700">Loading Portfolio...</div>
      </div>
    </div>
  `;

  try {
    const query = new URLSearchParams({ slug: username.trim().toLowerCase() });
    if (variantSlug) query.set('variant', variantSlug.trim().toLowerCase());
    const response = await fetch(`/api/public/portfolio?${query.toString()}`);
    const payload = await response.json().catch(() => ({}));
    const pf = payload.portfolio;
    if (!response.ok || !pf) {
      render404Page(username);
      return;
    }

    let masterJson = pf.master_profile_json || {};
    let masterData = masterJson.publishedProfile || masterJson;
    masterData.id = pf.id;
    let activeData = masterData;

    if (variantSlug) {
      if (!payload.variant) {
        render404Page(`${username}/${variantSlug}`);
        return;
      }
      const overrides = payload.variant.overrides_json || {};
      activeData = resolvePortfolioVariant(masterData, overrides);
    }

    const theme = getThemeById(activeData.theme || 'code');
    const html = generatePortfolioHTMLBody(activeData, theme);
    let publicStyle = document.getElementById('public-portfolio-render-styles');
    if (!publicStyle) {
      publicStyle = document.createElement('style');
      publicStyle.id = 'public-portfolio-render-styles';
      document.head.appendChild(publicStyle);
    }
    publicStyle.textContent = generatePortfolioCSS(theme);

    document.body.innerHTML = `
      <canvas id="bg-canvas"></canvas>
      ${html}
    `;
    installProjectCinemaControls();

    const canvas = document.getElementById('bg-canvas');
    try {
      if (canvas && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
        engine = new HyperEngine(canvas);
        engine.init(theme);
        sceneDirector = new SceneDirector(engine);
        sceneDirector.setTheme(theme);
        scrollDirector = new ScrollDirector(window, sceneDirector);
        introDirector = new IntroDirector(engine, sceneDirector, scrollDirector);

        const syncDeviceMode = () => {
          const w = window.innerWidth;
          const dev = w <= 640 ? 'mobile' : (w <= 1024 ? 'tablet' : 'desktop');
          document.documentElement.dataset.device = dev;
          document.body.dataset.device = dev;
          const scrollContainer = document.getElementById('portfolio-scroll-container');
          if (scrollContainer) scrollContainer.dataset.device = dev;
          if (sceneDirector) sceneDirector.setDeviceMode(dev);
        };
        syncDeviceMode();
        window.addEventListener('resize', syncDeviceMode);

        introDirector.play(activeData.introMode || 'short', theme, document);
      }
    } catch (engineErr) {
      console.warn('[Public 3D] WebGL unavailable, falling back to CSS theme styling:', engineErr);
    }

    // Initialize Real Analytics Tracking for Public Visitors
    initPublicPortfolioAnalytics(pf.id, variantSlug || 'general');

  } catch (e) {
    console.error('[Public Route] Failed to load portfolio:', e);
    render404Page(username);
  }
}

function render404Page(target) {
  const isUnknownPage = String(target || '').startsWith('/');
  const safeTarget = String(target || '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
  const heading = isUnknownPage ? '404 — Page Not Found' : '404 — Portfolio Not Found';
  const message = isUnknownPage
    ? `We couldn't find the page <code style="background:rgba(255,255,255,0.1);padding:2px 8px;border-radius:6px;color:#a855f7">${safeTarget}</code>.`
    : `We couldn't find a published portfolio for <code style="background:rgba(255,255,255,0.1);padding:2px 8px;border-radius:6px;color:#a855f7">${safeTarget}</code>.`;
  document.body.innerHTML = `
    <div style="min-height:100vh;background:#050508;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;font-family:'Inter',sans-serif;text-align:center;padding:20px">
      <div style="font-size:4rem;margin-bottom:16px">🔍</div>
      <h1 style="font-size:2.2rem;font-weight:900;margin-bottom:8px;background:linear-gradient(135deg,#7c3aed,#06b6d4);-webkit-background-clip:text;-webkit-text-fill-color:transparent">
        ${heading}
      </h1>
      <p style="color:rgba(255,255,255,0.6);max-width:460px;margin-bottom:24px;line-height:1.6">
        ${message}
      </p>
      <a href="/" style="padding:12px 24px;background:#7c3aed;color:#fff;border-radius:10px;text-decoration:none;font-weight:700">⚡ Build Your 3D Portfolio</a>
    </div>
  `;
}

// ─── INIT ───────────────────────────────────
function init() {
  router();

  subscribeToAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY') {
      setPageTitle('Set New Password');
      renderResetPasswordPage(() => {
        window.location.href = '/login';
      });
    } else if (event === 'SIGNED_OUT' || (event === 'TOKEN_REFRESHED' && !session)) {
      if (window.location.pathname === '/studio') {
        try { sessionStorage.clear(); } catch (e) {}
        window.location.href = '/login';
      }
    }
  });
}

export function resetStudioState() {
  portfolioData = {
    name: '', tagline: '', profession: '', bio: '',
    location: '', avatar: '',
    social: { github: '', linkedin: '', twitter: '', email: '', website: '' },
    skills: [],
    projects: [],
    experience: [],
    education: [],
    resume: null,
    viewMode: 'cinematic',
    contactMessage: "I'm always open to new opportunities and collaborations.",
    theme: 'code',
    customColors: null
  };
}

async function initStudio() {
  resetStudioState();
  try {
    const authUser = await getCurrentAuthUser();
    if (authUser) {
      const { profile } = await fetchUserProfileAndEntitlements(authUser);
      const cloudPortfolio = await loadUserPortfoliosFromSupabase(authUser);

      // Deterministic Identity Priority:
      // 1. current authenticated user's profile.display_name
      // 2. current authenticated user's auth metadata full_name/name
      // 3. current user's own portfolio personal.name (sanitized from legacy hardcoded strings)
      // 4. fallback: "Your Portfolio"
      const isSalehAccount = (authUser.email || '').toLowerCase().includes('saleh');
      let canonicalName = profile?.display_name || authUser.user_metadata?.full_name || authUser.user_metadata?.name;

      if (!canonicalName) {
        if (cloudPortfolio?.name && (isSalehAccount || !cloudPortfolio.name.toUpperCase().includes('SALEH MOHAMED'))) {
          canonicalName = cloudPortfolio.name;
        } else {
          canonicalName = 'Your Portfolio';
        }
      }

      if (cloudPortfolio) {
        // Scrub legacy hardcoded Saleh properties if this account does not belong to Saleh
        if (!isSalehAccount && cloudPortfolio.name && cloudPortfolio.name.toUpperCase().includes('SALEH MOHAMED')) {
          cloudPortfolio.name = canonicalName;
          cloudPortfolio.profession = '';
          cloudPortfolio.bio = '';
          cloudPortfolio.education = [];
          cloudPortfolio.experience = [];
          cloudPortfolio.projects = [];
          cloudPortfolio.skills = [];
        }
        portfolioData = { ...portfolioData, ...cloudPortfolio, name: canonicalName };
      } else {
        portfolioData.name = canonicalName;
        portfolioData.social.email = authUser.email || '';
      }
    }
  } catch (e) {
    console.warn('Supabase studio init warning:', e.message);
  }

  // Render the shell only after server-backed entitlements are known.
  portfolioData.isPro = isPro();
  if (!portfolioData.isPro) {
    portfolioData.hideWatermark = false;
    portfolioData.hideThemeBadge = false;
  }
  buildHTML();

  renderAll();
  initEngine();
  bindEvents();
  renderWorkspaceHeader();
  renderFirstRunChecklist(document.body, portfolioData);
  installEntitlementRefresh();
  window.initStudio = initStudio;
  showToast('info', '⚡', 'Studio Ready! Synced with Supabase Postgres.');
}

async function refreshStudioEntitlements({ notify = false } = {}) {
  const authUser = await getCurrentAuthUser();
  if (!authUser) return false;
  const previousPlan = globalEntitlements.getEffectivePlanId();
  await fetchUserProfileAndEntitlements(authUser);
  const nextPlan = globalEntitlements.getEffectivePlanId();
  portfolioData.isPro = nextPlan !== 'free';
  if (!portfolioData.isPro) {
    portfolioData.hideWatermark = false;
    portfolioData.hideThemeBadge = false;
  }
  // Update tier chip to show current plan
  const tierChip = document.getElementById('tier-chip');
  if (tierChip) {
    const chipConfig = {
      free: { text: '🆓 FREE', cls: 'tier-free' },
      pro: { text: '💎 PRO', cls: 'tier-pro' },
      premium: { text: '👑 PREMIUM', cls: 'tier-premium' },
      premium_group: { text: '👥 GROUP', cls: 'tier-premium' }
    };
    const chip = chipConfig[nextPlan] || chipConfig.free;
    tierChip.textContent = chip.text;
    tierChip.className = 'tier-chip ' + chip.cls;
  }
  buildThemeGrid();
  renderPublishTab();
  const variantContainer = document.getElementById('variant-manager-container');
  if (variantContainer) renderPortfolioVariantManager(variantContainer, portfolioData, (updatedMaster) => {
    portfolioData = updatedMaster;
    renderAll();
    autoSave();
  });
  const jobContainer = document.getElementById('jobtarget-panel-container');
  if (jobContainer) renderJobTargetPanel(jobContainer, portfolioData, (newData) => {
    portfolioData = newData;
    renderAll();
    autoSave();
  });
  if (notify && previousPlan !== nextPlan) {
    showToast('success', '💎', nextPlan === 'pro' ? 'Pro features are now active.' : 'Your plan was updated to Free.');
  }
  return previousPlan !== nextPlan;
}

function installEntitlementRefresh() {
  if ('BroadcastChannel' in window && !entitlementChannel) {
    entitlementChannel = new BroadcastChannel('portfolio-entitlements');
    entitlementChannel.addEventListener('message', () => refreshStudioEntitlements({ notify: true }));
  }
  window.addEventListener('focus', () => refreshStudioEntitlements({ notify: true }));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') refreshStudioEntitlements({ notify: true });
  });
}

window.switchWorkspaceNav = function(wsName) {
  document.querySelectorAll('.ws-btn').forEach(b => b.classList.remove('active'));
  const activeBtn = document.getElementById(`ws-btn-${wsName}`);
  if (activeBtn) activeBtn.classList.add('active');

  const createSubnav = document.getElementById('create-subnav-bar');
  if (createSubnav) {
    createSubnav.style.display = wsName === 'create' ? 'flex' : 'none';
  }

  setActiveWorkspace(wsName);
};

window.switchCreateSubSection = function(subId) {
  document.querySelectorAll('#create-subnav-bar .tab-btn').forEach(b => b.classList.remove('active'));
  const activeBtn = document.getElementById(`tab-${subId}`);
  if (activeBtn) activeBtn.classList.add('active');

  setActiveWorkspace('create', subId);
};

// ─── BUILD HTML ─────────────────────────────
function buildHTML() {
  document.body.innerHTML = `
<div id="canvas-container"><canvas id="bg-canvas"></canvas></div>
<div id="toast-container"></div>

<!-- STUDIO APP -->
<div id="app">
  <!-- SIDEBAR -->
  <aside id="sidebar">
    <!-- HEADER -->
    <div class="sidebar-header">
      <div class="logo-icon">⚡</div>
      <div class="logo-text">
        <div class="logo-name">3D Portfolio Maker</div>
        <div class="logo-sub">Ultra Studio v3.0</div>
      </div>
      <div class="tier-chip ${globalEntitlements.getEffectivePlanId() !== 'free' ? 'tier-pro' : 'tier-free'}" id="tier-chip" role="button" tabindex="0" aria-label="View plan and billing" onclick="handleUpgradeClick()" style="cursor:pointer">
        ${(() => { const p = globalEntitlements.getEffectivePlanId(); return p === 'premium' ? '👑 PREMIUM' : p === 'premium_group' ? '👥 GROUP' : p === 'pro' ? '💎 PRO' : '🆓 FREE'; })()}
      </div>
      <button class="admin-btn" id="logout-btn" title="Logout" onclick="handleLogout()" style="font-size:16px">🚪</button>
    </div>

    <!-- 5 PRIMARY WORKSPACES NAV BAR -->
    <div style="padding: 10px 14px; background: rgba(5,5,12,0.9); border-bottom: 1px solid rgba(255,255,255,0.08);">
      <div style="font-size: 0.65rem; font-weight: 800; color: rgba(255,255,255,0.4); text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 8px;">WORKSPACES</div>
      <div style="display: flex; gap: 6px; flex-wrap: wrap;">
        <button onclick="switchWorkspaceNav('create')" class="preset-chip ws-btn active" id="ws-btn-create" style="padding: 6px 12px; font-weight: 700;">✏️ 1. Create</button>
        <button onclick="switchWorkspaceNav('customize')" class="preset-chip ws-btn" id="ws-btn-customize" style="padding: 6px 12px; font-weight: 700;">🎨 2. Customize</button>
        <button onclick="switchWorkspaceNav('optimize')" class="preset-chip ws-btn" id="ws-btn-optimize" style="padding: 6px 12px; font-weight: 700;">🎯 3. Optimize</button>
        <button onclick="switchWorkspaceNav('publish')" class="preset-chip ws-btn" id="ws-btn-publish" style="padding: 6px 12px; font-weight: 700;">🌐 4. Publish</button>
        <button onclick="switchWorkspaceNav('measure')" class="preset-chip ws-btn" id="ws-btn-measure" style="padding: 6px 12px; font-weight: 700;">📊 5. Measure</button>
      </div>
    </div>

    <!-- ACTIVE WORKSPACE HEADER BANNER -->
    <div id="workspace-header-area"></div>

    <!-- CREATE SUB-SECTIONS (ONLY VISIBLE IN CREATE WORKSPACE) -->
    <div id="create-subnav-bar" class="sidebar-tabs" style="padding: 8px 12px; border-bottom: 1px solid rgba(255,255,255,0.08);">
      ${[
        {id:'profile', icon:'👤', label:'Profile'},
        {id:'experience', icon:'💼', label:'Exp'},
        {id:'education', icon:'🎓', label:'Edu'},
        {id:'skills', icon:'⚡', label:'Skills'},
        {id:'projects', icon:'🚀', label:'Projects'},
        {id:'certs', icon:'📜', label:'Certs'}
      ].map(t => `
        <button class="tab-btn ${t.id === 'profile' ? 'active' : ''}" onclick="switchCreateSubSection('${t.id}')" id="tab-${t.id}">
          <span class="tab-icon">${t.icon}</span>
          <span>${t.label}</span>
        </button>
      `).join('')}
    </div>

    <!-- CONTENT -->
    <div class="sidebar-content" id="sidebar-content">

      <!-- PROFILE TAB -->
      <div class="tab-panel active" id="panel-profile">
        <div style="background: linear-gradient(135deg, rgba(124,58,237,0.2), rgba(6,182,212,0.15)); border: 1px solid rgba(124,58,237,0.4); border-radius: 18px; padding: 16px; margin-bottom: 20px; text-align: center;">
          <div style="font-size: 0.9rem; font-weight: 800; color: #fff; margin-bottom: 4px;">🚀 Skip Manual Entry</div>
          <div style="font-size: 0.75rem; color: rgba(255,255,255,0.7); margin-bottom: 12px;">Upload your CV PDF to automatically extract experience, education, skills, and projects!</div>
          <button class="btn btn-primary" onclick="openCVImportModal()" style="width: 100%; font-weight: 800; padding: 10px;">📄 Upload CV & Auto-Build Portfolio ✨</button>
        </div>

        <div class="section-label">Profile Photo</div>
        <div style="
          background:linear-gradient(135deg,rgba(124,58,237,0.12),rgba(6,182,212,0.08));
          border:2px dashed rgba(124,58,237,0.4);border-radius:18px;padding:20px;
          text-align:center;margin-bottom:20px;position:relative;
        ">
          ${portfolioData.avatar ? `
            <div style="display:flex;flex-direction:column;align-items:center;gap:12px">
              <div style="
                width:95px;height:95px;border-radius:50%;overflow:hidden;
                border:3px solid var(--primary);box-shadow:0 0 25px rgba(124,58,237,0.5);
                position:relative;background:#000;
              ">
                <img id="profile-avatar-preview-img" src="${portfolioData.avatar}" style="width:100%;height:100%;object-fit:cover;transform:scale(${portfolioData.avatarZoom || 1});transition:transform 0.2s;"/>
              </div>

              <!-- ZOOM CONTROLS -->
              <div style="display:flex;align-items:center;gap:10px;background:rgba(0,0,0,0.3);padding:6px 14px;border-radius:30px;border:1px solid rgba(255,255,255,0.1)">
                <button onclick="changeAvatarZoom(-0.15)" style="background:rgba(255,255,255,0.1);border:none;color:#fff;border-radius:50%;width:28px;height:28px;font-size:16px;font-weight:bold;cursor:pointer;display:flex;align-items:center;justify-content:center" title="Zoom out">➖</button>
                <span style="font-size:0.8rem;font-weight:700;color:var(--primary);min-width:45px;text-align:center">${Math.round((portfolioData.avatarZoom || 1) * 100)}%</span>
                <button onclick="changeAvatarZoom(0.15)" style="background:rgba(255,255,255,0.1);border:none;color:#fff;border-radius:50%;width:28px;height:28px;font-size:16px;font-weight:bold;cursor:pointer;display:flex;align-items:center;justify-content:center" title="Zoom in">➕</button>
              </div>

              <div style="display:flex;gap:10px;margin-top:4px">
                <label style="background:rgba(124,58,237,0.2);border:1px solid rgba(124,58,237,0.4);border-radius:8px;padding:6px 14px;color:#fff;font-size:0.75rem;font-weight:700;cursor:pointer">
                  🔄 Change Photo
                  <input type="file" accept="image/*" style="display:none" onchange="uploadUserAvatar(this)"/>
                </label>
                <button onclick="updateUserAvatar('');renderAll();" style="background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.3);border-radius:8px;padding:6px 14px;color:#ef4444;font-size:0.75rem;font-weight:700;cursor:pointer">Remove ✕</button>
              </div>
            </div>
          ` : `
            <label style="cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:8px">
              <div style="font-size:2.4rem">📷</div>
              <div style="font-size:0.95rem;font-weight:800;color:#fff">Add Profile Photo</div>
              <div style="font-size:0.75rem;color:rgba(255,255,255,0.5)">Upload a clear photo to personalize your 3D portfolio.</div>
              <span style="margin-top:6px;padding:8px 20px;background:linear-gradient(135deg,var(--primary),var(--secondary));border-radius:20px;font-size:0.8rem;font-weight:800;color:#fff">📁 Choose Photo</span>
              <input type="file" accept="image/*" style="display:none" onchange="uploadUserAvatar(this)"/>
            </label>
          `}
        </div>

        <div class="section-label">Basic Info</div>
        <div class="field-group"><label class="field-label">Full Name</label>
          <input class="field-input" id="f-name" placeholder="e.g. Alex Johnson" value="${portfolioData.name}"/>
        </div>
        <div class="field-group"><label class="field-label">Profession / Job Title</label>
          <input class="field-input" id="f-profession" placeholder="e.g. Full-Stack Developer, Architect..." value="${portfolioData.profession}"/>
          <span style="font-size:0.68rem;color:var(--text-dim);margin-top:4px">🤖 Auto-detects & applies matching 3D theme!</span>
        </div>
        <div class="field-group"><label class="field-label">Tagline</label>
          <input class="field-input" id="f-tagline" placeholder="e.g. Building the Future" value="${portfolioData.tagline}"/>
        </div>
        <div class="field-group"><label class="field-label">Bio</label>
          <textarea class="field-textarea" id="f-bio" placeholder="Tell your story...">${portfolioData.bio}</textarea>
        </div>
        <div class="field-group"><label class="field-label">Location</label>
          <input class="field-input" id="f-location" placeholder="e.g. Cairo, Egypt" value="${portfolioData.location}"/>
        </div>
        <div class="field-group"><label class="field-label">Job Availability Status</label>
          <select class="field-input" id="f-availability-status" onchange="updateAvailabilityStatus(this.value)">
            <option value="none" ${(!portfolioData.availability || portfolioData.availability.status === 'none') ? 'selected' : ''}>None (Do not display status)</option>
            <option value="open" ${(portfolioData.availability?.status === 'open') ? 'selected' : ''}>🟢 Open to Opportunities</option>
            <option value="freelance" ${(portfolioData.availability?.status === 'freelance') ? 'selected' : ''}>💻 Available for Freelance / Contract</option>
            <option value="not-looking" ${(portfolioData.availability?.status === 'not-looking') ? 'selected' : ''}>🔒 Not Currently Looking</option>
          </select>
        </div>

        <div class="section-label">Social Links</div>
        ${[
          {id:'github', label:'GitHub URL', icon:'⌥'},
          {id:'linkedin', label:'LinkedIn URL', icon:'⊞'},
          {id:'twitter', label:'Twitter / X URL', icon:'⊳'},
          {id:'email', label:'Email Address', icon:'✉'},
          {id:'website', label:'Website URL', icon:'◈'}
        ].map(s => `
          <div class="field-group"><label class="field-label">${s.icon} ${s.label}</label>
            <input class="field-input" id="f-${s.id}" placeholder="${s.id === 'email' ? 'you@example.com' : 'https://'}" value="${portfolioData.social[s.id] || ''}"/>
          </div>
        `).join('')}

        <div class="field-group"><label class="field-label">Contact Message</label>
          <textarea class="field-textarea" id="f-contact" placeholder="Your contact section message...">${portfolioData.contactMessage}</textarea>
        </div>

        <div id="resume-editor-box"></div>
      </div>

      <!-- TARGET JOB & VERSIONS TAB -->
      <div class="tab-panel" id="panel-jobtarget">
        <div id="variant-manager-container" style="margin-bottom: 20px;"></div>
        <div id="jobtarget-panel-container"></div>
      </div>

      <!-- ANALYTICS TAB -->
      <div class="tab-panel" id="panel-analytics">
        <div id="analytics-panel-container"></div>
      </div>

      <!-- EXPERIENCE TAB -->
      <div class="tab-panel" id="panel-experience">
        <div class="section-label">Professional Experience</div>
        <div id="experience-list"></div>
        <button class="btn btn-secondary" onclick="addExperience()" style="margin-top:12px">+ Add Experience / Role</button>
      </div>

      <!-- EDUCATION TAB -->
      <div class="tab-panel" id="panel-education">
        <div class="section-label">Education & Degrees</div>
        <div id="education-list"></div>
        <button class="btn btn-secondary" onclick="addEducation()" style="margin-top:12px">+ Add Education / Degree</button>
      </div>

      <!-- SKILLS TAB -->
      <div class="tab-panel" id="panel-skills">
        <div class="section-label">Skills & Expertise</div>
        <div id="skills-list"></div>
        <button class="btn btn-secondary" onclick="addSkill()" style="margin-top:12px">+ Add Skill</button>
      </div>

      <!-- PROJECTS TAB -->
      <div class="tab-panel" id="panel-projects">
        <div class="section-label">Featured Projects</div>
        <div id="projects-list"></div>
        <button class="btn btn-secondary" onclick="addProject()">+ Add Project</button>
      </div>

      <!-- CERTIFICATES TAB -->
      <div class="tab-panel" id="panel-certs">
        <div class="section-label">Certificates & Credentials</div>
        <div id="certs-list"></div>
        <button class="btn btn-secondary" onclick="addCert()" style="margin-top:12px">+ Add Certificate</button>
      </div>

      <!-- DESIGN TAB -->
      <div class="tab-panel" id="panel-design">
        <div class="section-label">Choose 3D Visual Style</div>
        <div class="theme-grid" id="theme-grid"></div>

        <!-- COLLAPSED ADVANCED VISUAL SETTINGS -->
        <details style="margin-top:16px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:12px 14px">
          <summary style="font-size:0.8rem;font-weight:700;color:rgba(255,255,255,0.8);cursor:pointer;user-select:none">
            ⚙️ Advanced Visual Settings
          </summary>
          <div style="margin-top:14px;display:flex;flex-direction:column;gap:12px">
            <div class="field-group">
              <label class="field-label">Particle Density <span id="particle-val" style="color:var(--primary)"></span></label>
              <input type="range" class="range-input" id="r-particles" min="500" max="6000" step="100" value="3000"/>
            </div>
            <div class="field-group">
              <label class="field-label">Camera Motion Sensitivity</label>
              <input type="range" class="range-input" id="r-camera" min="1" max="10" step="1" value="5"/>
            </div>
            <div class="field-group">
              <label class="field-label">Glow & Lighting Intensity</label>
              <input type="range" class="range-input" id="r-glow" min="1" max="10" step="1" value="5"/>
            </div>
          </div>
        </details>
      </div>

      <!-- PUBLISH TAB -->
      <div class="tab-panel" id="panel-publish">
        <div class="section-label">Publish Your Portfolio</div>
        <div id="publish-panel-content"></div>
      </div>
    </div>

    <!-- FOOTER ACTIONS -->
    <div class="sidebar-footer">
      <button class="btn btn-primary" onclick="exportHTML()" style="padding:11px 20px;font-size:0.85rem">
        🚀 Export 3D Portfolio
      </button>
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
        <button class="btn btn-secondary" onclick="saveToDB()" style="flex:1;padding:8px 14px;font-size:0.8rem">
          💾 Save Draft
        </button>
        <button onclick="clearAll()" style="background:none;border:none;color:rgba(255,255,255,0.4);font-size:0.75rem;cursor:pointer;padding:6px 10px;text-decoration:underline">
          🗑️ Clear Form
        </button>
      </div>
    </div>
  </aside>

  <!-- PREVIEW PANEL -->
  <div id="preview-panel">
    <!-- PREVIEW HEADER CONTROLS (Outside simulated website viewport) -->
    <div class="preview-header">
      <div class="preview-label">
        <div class="live-dot"></div>
        LIVE 3D PREVIEW
      </div>

      <!-- PREVIEW MODE SWITCHER -->
      <div class="preview-mode-switch">
        <button class="mode-btn active" id="mode-btn-desktop" onclick="setPreviewMode('desktop')">💻 Desktop (1440×900)</button>
        <button class="mode-btn" id="mode-btn-tablet" onclick="setPreviewMode('tablet')">📱 Tablet (768×1024)</button>
        <button class="mode-btn" id="mode-btn-mobile" onclick="setPreviewMode('mobile')">📱 Mobile (375×812)</button>
      </div>

      <div class="preview-controls">
        <button class="ctrl-btn" onclick="replayIntro()">▶ Replay Intro</button>
        <button class="ctrl-btn" onclick="engineBurst()">💥 Burst</button>
        <button class="ctrl-btn" onclick="engineZoomIn()">🔍 Zoom In</button>
        <button class="ctrl-btn" onclick="engineZoomOut()">🔎 Zoom Out</button>
        <button class="ctrl-btn" onclick="toggleFullscreen()">⛶ Fullscreen</button>
      </div>
    </div>

    <!-- PREVIEW STAGE CONTAINER -->
    <div id="preview-stage">
      <!-- SCALER WRAPPER -->
      <div id="preview-scaler">
        <!-- VIRTUAL LOGICAL VIEWPORT -->
        <div id="virtual-viewport" class="mode-desktop">
          <canvas id="preview-canvas" style="position:absolute;inset:0;width:100%;height:100%;z-index:0;pointer-events:none"></canvas>
          <div id="preview-scroll-viewport" style="position:absolute;inset:0;z-index:10;overflow-y:auto;overflow-x:hidden;scroll-behavior:smooth">
            <!-- Generated dynamically by PortfolioRenderer.js -->
          </div>
        </div>
      </div>
    </div>
  </div>
</div>

<!-- ADMIN MODAL (hidden) -->
<div class="modal-overlay" id="admin-modal" style="display:none">
  <div class="modal-box">
    <div class="modal-header">
      <span class="modal-title">📊 Analytics Dashboard</span>
      <button class="modal-close" onclick="closeAdmin()">✕</button>
    </div>
    <div class="modal-body" id="admin-body"></div>
  </div>
</div>

<!-- AVATAR CROP & ADJUST MODAL (hidden) -->
<div class="modal-overlay" id="avatar-crop-modal" style="display:none;z-index:99999">
  <div class="modal-box" style="max-width:420px;text-align:center">
    <div class="modal-header">
      <span class="modal-title">✂️ Adjust Profile Photo</span>
      <button class="modal-close" onclick="closeAvatarCropper()">✕</button>
    </div>
    <div class="modal-body" style="display:flex;flex-direction:column;align-items:center;padding:24px">
      <div style="font-size:0.8rem;color:rgba(255,255,255,0.6);margin-bottom:16px">Center your face within the 3D circle preview:</div>
      
      <!-- CROP PREVIEW CONTAINER CIRCLE (PERFECT 1:1 CIRCLE) -->
      <div style="
        width:180px;height:180px;min-width:180px;min-height:180px;
        flex-shrink:0;aspect-ratio:1 / 1;border-radius:50%;overflow:hidden;
        border:4px solid var(--primary);box-shadow:0 0 35px var(--primary);
        position:relative;background:#000;margin:0 auto 20px;display:block;
      ">
        <img id="crop-modal-img" src="" style="
          width:100%;height:100%;object-fit:cover;
          transform-origin:center center;transition:transform 0.1s;
        "/>
      </div>

      <!-- ZOOM & POSITION CONTROLS -->
      <div style="width:100%;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:16px;margin-bottom:20px">
        <div style="font-size:0.75rem;font-weight:700;color:var(--primary);margin-bottom:10px">🔍 Zoom</div>
        <div style="display:flex;align-items:center;justify-content:center;gap:12px;margin-bottom:16px">
          <button onclick="adjustCropZoom(-0.15)" class="btn btn-secondary" style="padding:6px 16px;font-size:1rem;font-weight:bold">➖</button>
          <span id="crop-zoom-label" style="font-size:0.9rem;font-weight:900;color:#fff;min-width:60px">100%</span>
          <button onclick="adjustCropZoom(0.15)" class="btn btn-secondary" style="padding:6px 16px;font-size:1rem;font-weight:bold">➕</button>
        </div>

        <div style="font-size:0.75rem;font-weight:700;color:var(--primary);margin-bottom:10px">🎯 Position (Align Face)</div>
        <div style="display:grid;grid-template-columns:repeat(3, 45px);gap:8px;justify-content:center">
          <div></div>
          <button onclick="adjustCropPos(0, -10)" class="btn btn-secondary" style="padding:8px">⬆️</button>
          <div></div>
          <button onclick="adjustCropPos(-10, 0)" class="btn btn-secondary" style="padding:8px">⬅️</button>
          <button onclick="resetCropPos()" class="btn btn-secondary" style="padding:6px;font-size:0.7rem" title="Recenter">🎯</button>
          <button onclick="adjustCropPos(10, 0)" class="btn btn-secondary" style="padding:8px">➡️</button>
          <div></div>
          <button onclick="adjustCropPos(0, 10)" class="btn btn-secondary" style="padding:8px">⬇️</button>
          <div></div>
        </div>
      </div>

      <button class="btn btn-primary" onclick="saveAvatarCrop()" style="width:100%;padding:12px;font-size:0.95rem;font-weight:800">
        ✅ Apply to 3D Portfolio
      </button>
    </div>
  </div>
</div>
`;
}
window.buildHTML = buildHTML;

// ─── VIRTUAL PREVIEW VIEWPORT STATE & SCALING ──────
let currentPreviewMode = 'desktop';

const MODE_DIMENSIONS = {
  desktop: { width: 1440, height: 900 },
  tablet:  { width: 768,  height: 1024 },
  mobile:  { width: 375,  height: 812 }
};

window.setPreviewMode = function(mode) {
  if (!MODE_DIMENSIONS[mode]) return;
  currentPreviewMode = mode;

  document.querySelectorAll('.preview-mode-switch .mode-btn').forEach(btn => btn.classList.remove('active'));
  document.getElementById(`mode-btn-${mode}`)?.classList.add('active');

  const virtualViewport = document.getElementById('virtual-viewport');
  if (virtualViewport) {
    virtualViewport.className = `mode-${mode}`;
    virtualViewport.dataset.device = mode;
  }

  const scrollContainer = document.getElementById('portfolio-scroll-container');
  if (scrollContainer) {
    scrollContainer.dataset.device = mode;
  }

  if (sceneDirector) {
    sceneDirector.setDeviceMode(mode);
  }

  updatePreviewScale();

  // Sync Three.js camera aspect ratio & renderer resolution to exact logical viewport dimensions!
  if (engine && engine.camera && engine.renderer) {
    const dim = MODE_DIMENSIONS[mode];
    engine.camera.aspect = dim.width / dim.height;
    engine.camera.updateProjectionMatrix();
    engine.renderer.setSize(dim.width, dim.height);
  }

  if (scrollDirector) {
    scrollDirector.updateSectionBounds();
    scrollDirector._calculateProgress();
  }
};

function updatePreviewScale() {
  const stage = document.getElementById('preview-stage');
  const scaler = document.getElementById('preview-scaler');
  const viewport = document.getElementById('virtual-viewport');
  if (!stage || !scaler || !viewport) return;

  const dim = MODE_DIMENSIONS[currentPreviewMode] || MODE_DIMENSIONS.desktop;

  viewport.style.width = `${dim.width}px`;
  viewport.style.height = `${dim.height}px`;

  const stageRect = stage.getBoundingClientRect();
  const stageW = stageRect.width || stage.clientWidth;
  const stageH = stageRect.height || stage.clientHeight;

  // If container has not laid out yet, do not scale to tiny values
  if (stageW < 50 || stageH < 50) return;

  // Account for header offset (56px) and surrounding margins (32px)
  const availableW = Math.max(80, stageW - 32);
  const availableH = Math.max(80, stageH - 56 - 32);

  const scaleX = availableW / dim.width;
  const scaleY = availableH / dim.height;
  const scale = Math.min(scaleX, scaleY);

  scaler.style.width = `${dim.width}px`;
  scaler.style.height = `${dim.height}px`;
  scaler.style.flexShrink = '0';
  scaler.style.transformOrigin = 'center center';
  scaler.style.transform = `scale(${scale.toFixed(4)})`;
}

window.updatePreviewScale = updatePreviewScale;
window.addEventListener('resize', () => requestAnimationFrame(updatePreviewScale));
window.addEventListener('orientationchange', () => requestAnimationFrame(updatePreviewScale));

let previewResizeObserver = null;
function setupPreviewResizeObserver() {
  const stage = document.getElementById('preview-stage');
  const panel = document.getElementById('preview-panel');
  if (!stage) return;

  if (previewResizeObserver) {
    previewResizeObserver.disconnect();
  }

  if (typeof ResizeObserver !== 'undefined') {
    previewResizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(updatePreviewScale);
    });
    previewResizeObserver.observe(stage);
    if (panel) previewResizeObserver.observe(panel);
  }
}

// ─── ENGINE INIT ────────────────────────────
function initEngine() {
  const canvas = document.getElementById('preview-canvas');
  const theme = portfolioData.theme
    ? getThemeById(portfolioData.theme)
    : classifyProfession(portfolioData.profession);
  portfolioData.theme = theme.id;
  currentTheme = theme;

  try {
    if (canvas && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      engine = new HyperEngine(canvas);
      engine.init(theme);
    }
  } catch (engineErr) {
    console.warn('[Studio 3D] WebGL initialization fallback:', engineErr);
  }

  // Initialize Cinematic SceneDirector & ScrollDirector
  if (engine) {
    sceneDirector = new SceneDirector(engine);
    sceneDirector.setTheme(theme);
  }

  // Setup ResizeObserver for responsive preview scaling
  setupPreviewResizeObserver();

  // Set default Desktop (1440x900) Virtual Viewport mode & scale
  setPreviewMode('desktop');
  requestAnimationFrame(updatePreviewScale);
  setTimeout(updatePreviewScale, 60);
  setTimeout(updatePreviewScale, 250);

  window.uploadAvatar = uploadAvatar;

  updateHUD();

  const viewport = document.getElementById('preview-scroll-viewport');
  if (viewport) {
    if (scrollDirector) scrollDirector.destroy();
    scrollDirector = new ScrollDirector(viewport, sceneDirector);

    introDirector = new IntroDirector(engine, sceneDirector, scrollDirector);
    introDirector.play(portfolioData.introMode || 'short', theme, viewport);
  }

  buildThemeGrid();
  renderExperience();
  renderEducation();
  renderResumeUI();
  renderSkills();
  renderProjects();
  renderCerts();
  renderSaved();

  const vmContainer = document.getElementById('variant-manager-container');
  if (vmContainer) {
    renderPortfolioVariantManager(vmContainer, portfolioData, (updatedMaster) => {
      portfolioData = updatedMaster;
      renderAll();
      autoSave();
    });
  }

  const jtContainer = document.getElementById('jobtarget-panel-container');
  if (jtContainer) {
    renderJobTargetPanel(jtContainer, portfolioData, (newData) => {
      portfolioData = newData;
      renderAll();
      autoSave();
    });
  }

  const analyticsContainer = document.getElementById('analytics-panel-container');
  if (analyticsContainer) {
    renderProductionReadinessPanel(analyticsContainer);
    renderAnalyticsDashboard(analyticsContainer, portfolioData);
  }

  initCVImportModal(handleCVImportData);
  window.openCVImportModal = openCVImportModal;
  window.openBillingModal = async () => {
    const authUser = await getCurrentAuthUser();
    if (!authUser?.id || authUser.id === 'usr_guest') {
      window.location.href = '/login?next=/studio';
      return;
    }
    openBillingModal(authUser.id, () => renderAll());
  };

  // Only run test suites in browser if explicit debug query flag ?run_tests=true is set
  if (typeof window !== 'undefined' && window.location.search.includes('run_tests=true')) {
    (async () => {
      try {
      const [
        { runCVParserTestSuite },
        { runJobTargetingTestSuite },
        { runPortfolioVariantsTestSuite },
        { runAnalyticsTestSuite },
        { runMonetizationTestSuite },
        { runProductionSecurityTestSuite },
        { runProductionLaunchTestSuite },
        { runSupabaseCutoverTestSuite }
      ] = await Promise.all([
        import('./tests/CVParserFixtures.js'),
        import('./tests/JobMatcherFixtures.js'),
        import('./tests/VariantResolverFixtures.js'),
        import('./tests/AnalyticsTestSuite.js'),
        import('./tests/MonetizationTestSuite.js'),
        import('./tests/ProductionSecurityTestSuite.js'),
        import('./tests/ProductionLaunchTestSuite.js'),
        import('./tests/SupabaseCutoverTestSuite.js')
      ]);
      await runCVParserTestSuite();
      runJobTargetingTestSuite();
      runPortfolioVariantsTestSuite();
      runAnalyticsTestSuite();
      runMonetizationTestSuite();
      runProductionSecurityTestSuite();
      runProductionLaunchTestSuite();
      runSupabaseCutoverTestSuite();
      } catch (err) {
        console.warn('[Test Suite] error:', err);
      }
    })();
  }
}

function handleCVImportData({ parsedCV, mergeStrategy, importSections, selectedThemeId, resumeData }) {
  const updatedData = mapCVToPortfolioData(parsedCV, portfolioData, { mergeStrategy, importSections });

  if (resumeData) {
    updatedData.resume = resumeData;
  }

  portfolioData = updatedData;

  if (selectedThemeId) {
    const newTheme = getThemeById(selectedThemeId) || classifyProfession(portfolioData.profession);
    currentTheme = newTheme;
    engine?.applyTheme(newTheme);
    portfolioData.theme = newTheme.id;
  }

  renderAll();
  autoSave();
  flyToSection('hero');

  confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 }, colors: ['#7c3aed', '#06b6d4', '#10b981'] });
  showToast('success', '✨', 'Your portfolio draft is ready!');
}

window.replayIntro = function() {
  const viewport = document.getElementById('preview-scroll-viewport');
  if (!viewport || !engine) return;
  if (!introDirector) {
    introDirector = new IntroDirector(engine, sceneDirector, scrollDirector);
  }
  introDirector.play(portfolioData.introMode || 'short', currentTheme, viewport);
  showToast('info', '▶️', 'Replaying opening sequence...');
};

window.skipIntro = function() {
  const viewport = document.getElementById('preview-scroll-viewport');
  if (introDirector) {
    introDirector.skip(viewport);
  }
};

// ─── RENDER ALL ─────────────────────────────
function renderAll() {
  renderExperience();
  renderEducation();
  renderResumeUI();
  renderSkills();
  renderProjects();
  renderCerts();
  renderPublishTab();
  updateHUD();
}

// ─── HUD / VIEWPORT UPDATE ──────
let previewObserver = null;

function updateDynamicStyles() {
  let styleEl = document.getElementById('portfolio-render-styles');
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'portfolio-render-styles';
    document.head.appendChild(styleEl);
  }
  const primaryHex = '#' + (currentTheme?.primaryColor || 0x7c3aed).toString(16).padStart(6, '0');
  const secondaryHex = '#' + (currentTheme?.secondaryColor || 0x06b6d4).toString(16).padStart(6, '0');
  const accentHex = '#' + (currentTheme?.accentColor || 0xff007f).toString(16).padStart(6, '0');
  const bgHex = '#' + (currentTheme?.bgColor || 0x050508).toString(16).padStart(6, '0');

  styleEl.textContent = generatePortfolioCSS({
    primary: primaryHex,
    secondary: secondaryHex,
    accent: accentHex,
    bg: bgHex
  });
}

async function updateHUD() {
  updateDynamicStyles();

  const viewport = document.getElementById('preview-scroll-viewport');
  if (!viewport) return;

  const html = generatePortfolioHTMLBody(portfolioData, currentTheme || {});
  viewport.innerHTML = html;
  installProjectCinemaControls();

  // Bind smooth scrolling for nav links
  viewport.querySelectorAll('.nav-link, .hero-actions a, .navbar-brand').forEach(link => {
    link.addEventListener('click', function(e) {
      const href = this.getAttribute('href');
      if (href && href.startsWith('#')) {
        e.preventDefault();
        const targetId = href.substring(1);
        const targetEl = viewport.querySelector('#' + targetId);
        if (targetEl) {
          targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    });
  });

  // Bind mobile menu buttons & links inside Studio preview
  const menuBtn = viewport.querySelector('#mobile-menu-btn, .mobile-menu-btn');
  const menuCloseBtn = viewport.querySelector('#mobile-menu-close, .mobile-menu-close');

  if (menuBtn) {
    menuBtn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      window.toggleMobileMenu(true);
    });
  }

  if (menuCloseBtn) {
    menuCloseBtn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      window.toggleMobileMenu(false);
    });
  }

  viewport.querySelectorAll('.mobile-nav-link').forEach(link => {
    link.addEventListener('click', function(e) {
      const href = this.getAttribute('href');
      if (href && href.startsWith('#')) {
        e.preventDefault();
        window.toggleMobileMenu(false);
        const targetId = href.substring(1);
        const targetEl = viewport.querySelector('#' + targetId);
        if (targetEl) {
          targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
          const secName = targetId.replace('sec-', '');
          if (sceneDirector) {
            sceneDirector.update({ section: secName, progress: 0 });
          }
        }
      }
    });
  });

  // Bind 3D mouse tilt on glass cards
  bindCardTilt(viewport);

  // Bind IntersectionObserver inside Studio preview viewport
  bindPreviewObserver(viewport);

  // Update ScrollDirector section bounds
  if (scrollDirector) {
    scrollDirector.updateSectionBounds();
  }
}

function bindCardTilt(container = document) {
  container.querySelectorAll('.glass-card').forEach(card => {
    card.addEventListener('mousemove', e => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;
      card.style.transform = 'translateY(-8px) rotateX(' + (-y / 20) + 'deg) rotateY(' + (x / 20) + 'deg) scale(1.01)';
    });
    card.addEventListener('mouseleave', () => {
      card.style.transform = '';
    });
  });
}

function bindPreviewObserver(viewport) {
  if (previewObserver) previewObserver.disconnect();

  const sections = viewport.querySelectorAll('.portfolio-section');
  const navLinks = viewport.querySelectorAll('.nav-link');

  previewObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const sectionId = entry.target.getAttribute('data-section') || entry.target.id.replace('sec-', '');
        navLinks.forEach(link => {
          if (link.getAttribute('data-section') === sectionId) {
            link.classList.add('active');
          } else {
            link.classList.remove('active');
          }
        });
        activeSection = sectionId;
        engine?.flyTo(sectionId);
      }
    });
  }, { root: viewport, threshold: 0.35 });

  sections.forEach(sec => previewObserver.observe(sec));
}

// ─── BIND EVENTS ────────────────────────────
function bindEvents() {
  // Profile inputs
  const bindings = [
    ['f-name', 'name'], ['f-tagline', 'tagline'], ['f-profession', 'profession'],
    ['f-bio', 'bio'], ['f-location', 'location'], ['f-contact', 'contactMessage']
  ];
  bindings.forEach(([id, key]) => {
    document.getElementById(id)?.addEventListener('input', e => {
      portfolioData[key] = e.target.value;
      if (key === 'profession') onProfessionChange(e.target.value);
      updateHUD();
      autoSave();
    });
  });

  // Social links
  ['github','linkedin','twitter','email','website'].forEach(s => {
    document.getElementById(`f-${s}`)?.addEventListener('input', e => {
      portfolioData.social[s] = e.target.value;
      autoSave();
    });
  });

  // Admin
  document.getElementById('admin-btn')?.addEventListener('click', openAdmin);

  // User info in sidebar footer (show name)
  const user = getCurrentUser();
  if (user) {
    const footer = document.querySelector('.sidebar-footer');
    if (footer) {
      const userInfo = document.createElement('div');
      userInfo.style.cssText = 'font-size:0.72rem;color:rgba(255,255,255,0.3);text-align:center;padding-top:4px';
      userInfo.textContent = `👤 ${user.name} · ${user.email}`;
      footer.appendChild(userInfo);
    }
  }
}

// ─── PROFESSION CHANGE ──────────────────────
let professionDebounce = null;
function onProfessionChange(value) {
  clearTimeout(professionDebounce);
  professionDebounce = setTimeout(() => {
    const newTheme = classifyProfession(value);
    if (newTheme.id !== currentTheme?.id) {
      currentTheme = newTheme;
      engine?.applyTheme(newTheme);
      portfolioData.theme = newTheme.id;
      updateHUD();
      buildThemeGrid();
      showToast('success', newTheme.emoji, `3D Theme switched to ${newTheme.name}!`);
    }
  }, 600);
}

// ─── TABS ───────────────────────────────────
window.switchTab = function(id) {
  activeTab = id;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.getElementById(`tab-${id}`)?.classList.add('active');
  document.getElementById(`panel-${id}`)?.classList.add('active');
  
  const secMap = {
    profile: 'hero',
    design: 'hero',
    publish: 'hero',
    projects: 'projects',
    skills: 'skills',
    certs: 'certs'
  };
  const targetSec = secMap[id] || 'hero';
  flyToSection(targetSec);
  
  if (id === 'publish') {
    renderPublishTab();
    const sidebarFooter = document.querySelector('.sidebar-footer');
    if (sidebarFooter) sidebarFooter.style.display = 'none';
  } else {
    const sidebarFooter = document.querySelector('.sidebar-footer');
    if (sidebarFooter) sidebarFooter.style.display = '';
  }
};

window.updateUserAvatar = function(val) {
  portfolioData.avatar = val;
  const avatarInput = document.getElementById('f-avatar');
  if (avatarInput) avatarInput.value = val;
  updateHUD();
  autoSave();
};

window.updateAvatarZoom = function(val) {
  portfolioData.avatarZoom = parseFloat(val);
  const hudImg = document.getElementById('hud-avatar-img');
  if (hudImg) hudImg.style.transform = `scale(${val})`;
  const prevImg = document.getElementById('profile-avatar-preview-img');
  if (prevImg) prevImg.style.transform = `scale(${val})`;
  autoSave();
};

window.changeAvatarZoom = function(delta) {
  let current = portfolioData.avatarZoom || 1;
  let nextVal = Math.min(2.5, Math.max(1, current + delta));
  window.updateAvatarZoom(nextVal);
  renderAll();
};

let tempCropState = { src: '', zoom: 1, posX: 0, posY: 0 };

window.openAvatarCropper = function(src) {
  tempCropState = {
    src: src,
    zoom: portfolioData.avatarZoom || 1,
    posX: portfolioData.avatarPosX || 0,
    posY: portfolioData.avatarPosY || 0
  };
  const img = document.getElementById('crop-modal-img');
  if (img) img.src = src;
  updateCropPreviewTransform();
  document.getElementById('avatar-crop-modal').style.display = 'flex';
};

window.closeAvatarCropper = function() {
  document.getElementById('avatar-crop-modal').style.display = 'none';
};

window.adjustCropZoom = function(delta) {
  tempCropState.zoom = Math.min(3, Math.max(1, tempCropState.zoom + delta));
  updateCropPreviewTransform();
};

window.adjustCropPos = function(dx, dy) {
  tempCropState.posX += dx;
  tempCropState.posY += dy;
  updateCropPreviewTransform();
};

window.resetCropPos = function() {
  tempCropState.posX = 0;
  tempCropState.posY = 0;
  tempCropState.zoom = 1;
  updateCropPreviewTransform();
};

function updateCropPreviewTransform() {
  const img = document.getElementById('crop-modal-img');
  const label = document.getElementById('crop-zoom-label');
  if (img) img.style.transform = `scale(${tempCropState.zoom}) translate(${tempCropState.posX}px, ${tempCropState.posY}px)`;
  if (label) label.textContent = `${Math.round(tempCropState.zoom * 100)}%`;
}

window.uploadUserAvatar = function(inputEl) {
  const file = inputEl.files[0];
  if (!file) return;

  if (file.size > 4 * 1024 * 1024) {
    showToast('error', '⚠️', 'Image file is too large. Please select a photo under 4MB.');
    return;
  }

  const reader = new FileReader();
  reader.onload = function(e) {
    window.openAvatarCropper(e.target.result);
  };
  reader.readAsDataURL(file);
};

let isAvatarUploading = false;

window.saveAvatarCrop = function() {
  if (isAvatarUploading) return;

  const saveBtn = document.getElementById('save-avatar-btn') || document.querySelector('#avatar-crop-modal button.btn-primary');
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.textContent = '⏳ Uploading...';
  }
  isAvatarUploading = true;

  // High-Resolution 600x600 HD HTML5 Canvas Crop Engine
  const canvas = document.createElement('canvas');
  const size = 600;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = function() {
    ctx.clearRect(0, 0, size, size);
    ctx.save();
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();

    const scale = tempCropState.zoom;
    const dx = (tempCropState.posX / 180) * size;
    const dy = (tempCropState.posY / 180) * size;

    ctx.translate(size / 2 + dx, size / 2 + dy);
    ctx.scale(scale, scale);

    let drawWidth, drawHeight;
    if (img.width > img.height) {
      drawHeight = size;
      drawWidth = (img.width / img.height) * size;
    } else {
      drawWidth = size;
      drawHeight = (img.height / img.width) * size;
    }

    ctx.drawImage(img, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
    ctx.restore();

    canvas.toBlob(async (blob) => {
      showToast('info', '⏳', 'Saving profile photo...');
      try {
        const authUser = await getCurrentAuthUser();
        if (!authUser) {
          showToast('error', '🔒', 'Session expired. Redirecting to sign in...');
          window.location.href = '/login';
          return;
        }
        const userId = authUser.id;
        const portfolioId = portfolioData.id || 'default';

        const file = new File([blob], 'avatar.webp', { type: 'image/webp' });
        const avatarMeta = await uploadAvatar(file, userId, portfolioId);

        portfolioData.avatar = avatarMeta;
        portfolioData.avatarZoom = 1;
        portfolioData.avatarPosX = 0;
        portfolioData.avatarPosY = 0;

        window.closeAvatarCropper();
        renderAll();
        showToast('success', '👤', 'Profile photo updated!');
        autoSave();
      } catch (err) {
        showToast('error', '❌', `Photo upload failed: ${err.message}`);
      } finally {
        isAvatarUploading = false;
        if (saveBtn) {
          saveBtn.disabled = false;
          saveBtn.textContent = '💾 Save and Apply Photo';
        }
      }
    }, 'image/webp', 0.95);
    ctx.restore();
  };
  img.onerror = function() {
    isAvatarUploading = false;
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = '💾 Save and Apply Photo';
    }
    showToast('error', '❌', 'Failed to load photo for cropping.');
  };
  img.src = tempCropState.src;
};

window.setIntroMode = function(mode) {
  portfolioData.introMode = mode;
  autoSave();
  updateHUD();
  showToast('success', '🎬', `Opening sequence set to ${mode.toUpperCase()}!`);
};

// ─── PUBLISH TAB RENDERER ─────────────────────
export function renderPublishTab() {
  const el = document.getElementById('publish-panel-content');
  if (!el) return;

  const effectivePlan = globalEntitlements.getEffectivePlanId();
  const isGrandfathered = Boolean(portfolioData.isLegacy || portfolioData.is_legacy);
  const isKeepItLive = globalEntitlements.isKeepItLive() || Boolean(portfolioData.hasKIL || portfolioData.has_kil);

  const hasHostedPublishRights = effectivePlan === 'pro' || effectivePlan === 'premium' || effectivePlan === 'premium_group' || isGrandfathered;
  const isPremiumOrGroup = effectivePlan === 'premium' || effectivePlan === 'premium_group';
  const isPublished = Boolean(portfolioData.publishedAt || portfolioData.published_at);

  const slug = portfolioData.slug || (portfolioData.name ? portfolioData.name.toLowerCase().replace(/[^a-z0-9]/g, '-') : 'portfolio');
  const publicUrl = `${window.location.origin}/u/${slug}`;

  const monthKey = new Date().toISOString().slice(0, 7);
  const usage = portfolioData.exportUsage || {};
  const exportsThisMonth = usage.month === monthKey ? Number(usage.count || 0) : 0;
  const maxFreeExports = 1;
  const isFreeExportExhausted = exportsThisMonth >= maxFreeExports;

  // Real reset date calculation: 1st of next month
  const now = new Date();
  const resetDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const resetDateStr = resetDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  // ──────────────────────────────────────────────
  // CASE 1: FREE USER (No hosted rights)
  // ──────────────────────────────────────────────
  if (!hasHostedPublishRights && !isKeepItLive) {
    el.innerHTML = `
      <div style="font-family:'Inter',sans-serif;color:#fff;">
        
        <!-- HEADER -->
        <div style="margin-bottom: 20px;">
          <h2 style="font-family:'Outfit',sans-serif;font-size:1.25rem;font-weight:800;color:#fff;margin:0 0 6px 0;">Publish & Export</h2>
          <p style="font-size:0.82rem;color:rgba(255,255,255,0.65);margin:0;line-height:1.5;">
            Your portfolio is ready. Export it for free, or upgrade when you're ready to publish it online.
          </p>
        </div>

        <!-- CARD A: FREE EXPORT -->
        <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.1);border-radius:18px;padding:20px;margin-bottom:16px;box-shadow:0 8px 24px rgba(0,0,0,0.2);">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
            <h3 style="font-size:0.98rem;font-weight:800;color:#fff;margin:0;display:flex;align-items:center;gap:8px;">
              <span>📦</span> Export Your Portfolio
            </h3>
            <span style="font-size:0.68rem;font-weight:800;color:#94a3b8;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);border-radius:12px;padding:2px 10px;letter-spacing:0.5px;">
              FREE
            </span>
          </div>

          <p style="font-size:0.8rem;color:rgba(255,255,255,0.7);line-height:1.5;margin:0 0 14px 0;">
            Download a standalone version of your portfolio that you can keep, share, or host yourself.
          </p>

          <div style="background:rgba(0,0,0,0.25);border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:12px 14px;margin-bottom:16px;font-size:0.78rem;color:rgba(255,255,255,0.8);line-height:1.8;">
            <div>• Standalone HTML Export</div>
            <div>• 1 export per month</div>
            <div>• Platform branding included</div>
          </div>

          <!-- CTA BUTTON -->
          <button id="btn-free-download-portfolio" class="btn btn-secondary" onclick="exportHTML()" ${isFreeExportExhausted ? 'disabled aria-disabled="true"' : ''} style="width:100%;padding:12px;font-size:0.85rem;font-weight:700;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.2);color:#fff;border-radius:10px;cursor:${isFreeExportExhausted ? 'not-allowed' : 'pointer'};display:flex;align-items:center;justify-content:center;gap:8px;">
            <span>📥</span> Download Portfolio (.html)
          </button>

          <!-- USAGE METER -->
          <div style="margin-top:10px;text-align:center;font-size:0.75rem;color:rgba(255,255,255,0.55);">
            ${isFreeExportExhausted ? '1 of 1 exports used this month' : '0 of 1 exports used this month'}
          </div>
          ${isFreeExportExhausted ? `
            <div style="margin-top:6px;text-align:center;font-size:0.72rem;color:#fde047;font-weight:600;">
              Your free export allowance resets on ${resetDateStr}
            </div>
          ` : ''}
        </div>

        <!-- CARD B: ONLINE PUBLISHING (UPGRADE TO PRO) -->
        <div style="background:linear-gradient(135deg,rgba(124,58,237,0.14),rgba(6,182,212,0.08));border:1px solid rgba(124,58,237,0.35);border-radius:18px;padding:22px;box-shadow:0 12px 30px rgba(124,58,237,0.15);position:relative;overflow:hidden;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
            <h3 style="font-size:1.02rem;font-weight:800;color:#fff;margin:0;display:flex;align-items:center;gap:8px;">
              <span>🌐</span> Publish Your Portfolio Online
            </h3>
            <span style="font-size:0.68rem;font-weight:800;color:#c084fc;background:rgba(124,58,237,0.2);border:1px solid rgba(124,58,237,0.4);border-radius:12px;padding:2px 10px;letter-spacing:0.5px;">
              PRO
            </span>
          </div>

          <p style="font-size:0.8rem;color:rgba(255,255,255,0.75);line-height:1.5;margin:0 0 16px 0;">
            Get your own live portfolio link, keep it updated, and share it anywhere.
          </p>

          <div style="display:grid;grid-template-columns:1fr;gap:8px;margin-bottom:18px;font-size:0.78rem;color:rgba(255,255,255,0.85);">
            <div style="display:flex;align-items:center;gap:6px;"><span style="color:#4ade80;font-weight:900;">✓</span> Your live /u/username link</div>
            <div style="display:flex;align-items:center;gap:6px;"><span style="color:#4ade80;font-weight:900;">✓</span> Publish instantly</div>
            <div style="display:flex;align-items:center;gap:6px;"><span style="color:#4ade80;font-weight:900;">✓</span> Update anytime</div>
            <div style="display:flex;align-items:center;gap:6px;"><span style="color:#4ade80;font-weight:900;">✓</span> Unlimited exports</div>
            <div style="display:flex;align-items:center;gap:6px;"><span style="color:#4ade80;font-weight:900;">✓</span> 10 professional themes</div>
            <div style="display:flex;align-items:center;gap:6px;"><span style="color:#4ade80;font-weight:900;">✓</span> Professional portfolio sharing</div>
          </div>

          <button id="btn-upgrade-pro-publish" class="btn btn-primary" onclick="openBillingModal('pro')" style="width:100%;padding:13px;font-size:0.88rem;font-weight:800;background:linear-gradient(135deg,#7c3aed,#06b6d4);color:#fff;border-radius:10px;box-shadow:0 6px 18px rgba(124,58,237,0.35);cursor:pointer;">
            Upgrade to Pro — 600 EGP/month
          </button>
        </div>

      </div>
    `;
    return;
  }

  // ──────────────────────────────────────────────
  // CASE 2: KEEP IT LIVE STATE
  // ──────────────────────────────────────────────
  if (isKeepItLive && !hasHostedPublishRights) {
    el.innerHTML = `
      <div style="font-family:'Inter',sans-serif;color:#fff;">
        <div style="margin-bottom: 20px;">
          <h2 style="font-family:'Outfit',sans-serif;font-size:1.25rem;font-weight:800;color:#fff;margin:0 0 6px 0;">Publish & Retention</h2>
          <p style="font-size:0.82rem;color:rgba(255,255,255,0.65);margin:0;line-height:1.5;">
            Your portfolio is retained online via Keep It Live.
          </p>
        </div>

        <div style="background:rgba(6,182,212,0.06);border:1px solid rgba(6,182,212,0.3);border-radius:18px;padding:20px;margin-bottom:16px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
            <span style="font-size:0.75rem;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:#06b6d4;">
              🟢 Live (Keep It Live)
            </span>
          </div>

          <div style="background:rgba(0,0,0,0.35);border:1px solid rgba(255,255,255,0.1);border-radius:10px;padding:10px 12px;margin-bottom:12px;">
            <span style="font-family:'JetBrains Mono',monospace;font-size:0.78rem;color:#06b6d4;word-break:break-all;">${publicUrl}</span>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px;">
            <button id="btn-copy-public-url" class="btn btn-secondary" onclick="copyPublicPortfolioUrl()" style="font-size:0.78rem;padding:8px;font-weight:700;">
              📋 Copy Link
            </button>
            <a id="link-open-public-portfolio" href="${publicUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary" style="font-size:0.78rem;padding:8px;text-align:center;text-decoration:none;display:flex;align-items:center;justify-content:center;font-weight:700;">
              🌐 Open Portfolio ↗
            </a>
          </div>

          <div style="background:rgba(234,179,8,0.06);border:1px solid rgba(234,179,8,0.2);border-radius:10px;padding:12px;font-size:0.76rem;color:rgba(255,255,255,0.8);line-height:1.5;margin-bottom:16px;">
            ℹ️ Your hosted portfolio remains online for visitors. Live editing and new theme changes are restricted under the Keep It Live retention policy.
          </div>

          <button class="btn btn-primary" onclick="openBillingModal('pro')" style="width:100%;padding:11px;font-size:0.84rem;font-weight:800;background:linear-gradient(135deg,#7c3aed,#06b6d4);">
            Reactivate Full Pro Plan — 600 EGP/month
          </button>
        </div>
      </div>
    `;
    return;
  }

  // ──────────────────────────────────────────────
  // CASE 3: ACTIVE PRO / PREMIUM / GRANDFATHERED
  // ──────────────────────────────────────────────
  const planDisplayName = isGrandfathered ? 'GRANDFATHERED' : (isPremiumOrGroup ? (effectivePlan === 'premium_group' ? 'PREMIUM GROUP' : 'PREMIUM') : 'PRO');
  const publishedTimestamp = (portfolioData.publishedAt || portfolioData.published_at) ? new Date(portfolioData.publishedAt || portfolioData.published_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : null;
  const updatedTimestamp = (portfolioData.updatedAt || portfolioData.updated_at) ? new Date(portfolioData.updatedAt || portfolioData.updated_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : null;

  el.innerHTML = `
    <div style="font-family:'Inter',sans-serif;color:#fff;">

      <!-- HEADER -->
      <div style="margin-bottom: 20px;">
        <h2 style="font-family:'Outfit',sans-serif;font-size:1.25rem;font-weight:800;color:#fff;margin:0 0 6px 0;">Publish & Share</h2>
        <p style="font-size:0.82rem;color:rgba(255,255,255,0.65);margin:0;line-height:1.5;">
          Manage your live 3D portfolio, public web link, and export options.
        </p>
      </div>

      <!-- CARD 1: LIVE PUBLISHING DASHBOARD -->
      <div style="background:${isPublished ? 'rgba(16,185,129,0.05)' : 'rgba(245,158,11,0.05)'};border:1px solid ${isPublished ? 'rgba(16,185,129,0.25)' : 'rgba(245,158,11,0.25)'};border-radius:18px;padding:20px;margin-bottom:16px;box-shadow:0 8px 24px rgba(0,0,0,0.2);">
        
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
          <span style="font-size:0.75rem;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:${isPublished ? '#10b981' : '#f59e0b'};">
            ${isPublished ? '🟢 LIVE' : '🟡 DRAFT'}
          </span>
          <span style="font-size:0.68rem;font-weight:800;color:#c084fc;background:rgba(124,58,237,0.15);border:1px solid rgba(124,58,237,0.3);border-radius:10px;padding:2px 8px;">
            ${planDisplayName}
          </span>
        </div>

        <div style="font-size:0.8rem;color:rgba(255,255,255,0.75);line-height:1.5;margin-bottom:14px;">
          ${isPublished 
            ? 'Your 3D portfolio is published and accessible to visitors worldwide.' 
            : 'Publish your portfolio to get your live personal 3D link to share with recruiters.'}
        </div>

        ${isPublished ? `
          <!-- PUBLIC URL DISPLAY -->
          <div style="background:rgba(0,0,0,0.35);border:1px solid rgba(255,255,255,0.1);border-radius:10px;padding:10px 12px;margin-bottom:12px;display:flex;align-items:center;justify-content:space-between;gap:8px;">
            <span id="public-url-text" style="font-family:'JetBrains Mono',monospace;font-size:0.78rem;color:#06b6d4;word-break:break-all;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${publicUrl}</span>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px;">
            <button id="btn-copy-public-url" class="btn btn-secondary" onclick="copyPublicPortfolioUrl()" style="font-size:0.78rem;padding:9px;font-weight:700;">
              📋 Copy Link
            </button>
            <a id="link-open-public-portfolio" href="${publicUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary" style="font-size:0.78rem;padding:9px;text-align:center;text-decoration:none;font-weight:700;display:flex;align-items:center;justify-content:center;">
              🌐 Open Portfolio ↗
            </a>
          </div>
        ` : ''}

        <!-- PRIMARY PUBLISH / UPDATE ACTION -->
        <button id="btn-publish-portfolio" class="btn btn-primary" onclick="handlePublishPortfolio()" style="width:100%;padding:12px;font-size:0.88rem;font-weight:800;background:linear-gradient(135deg,#7c3aed,#06b6d4);color:#fff;border-radius:10px;cursor:pointer;margin-bottom:14px;">
          ${isPublished ? '🚀 Update Live Portfolio' : '🚀 Publish Portfolio Live'}
        </button>

        <!-- SLUG SETTING -->
        <div style="border-top:1px solid rgba(255,255,255,0.08);padding-top:14px;margin-top:14px;">
          <label style="font-size:0.72rem;font-weight:800;color:rgba(255,255,255,0.7);letter-spacing:0.8px;text-transform:uppercase;display:block;margin-bottom:6px;">
            Change Portfolio URL
          </label>
          <div style="display:flex;align-items:center;gap:6px;">
            <span style="font-family:'JetBrains Mono',monospace;font-size:0.76rem;color:rgba(255,255,255,0.4);">/u/</span>
            <input id="f-publish-slug" class="field-input" value="${portfolioData.slug || ''}" placeholder="my-portfolio-slug" style="font-family:'JetBrains Mono',monospace;font-size:0.78rem;padding:8px 10px;flex:1;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.15);border-radius:8px;color:#fff;outline:none;" onchange="updatePortfolioSlug(this.value)"/>
          </div>
        </div>

        <!-- METADATA FOOTER -->
        ${isPublished ? `
          <div style="display:flex;justify-content:space-between;align-items:center;border-top:1px solid rgba(255,255,255,0.08);padding-top:12px;margin-top:14px;font-size:0.72rem;color:rgba(255,255,255,0.5);flex-wrap:wrap;gap:8px;">
            <div>Last Published: <strong style="color:rgba(255,255,255,0.8);">${publishedTimestamp || 'Recently'}</strong></div>
            ${updatedTimestamp ? `<div>Last Updated: <strong style="color:rgba(255,255,255,0.8);">${updatedTimestamp}</strong></div>` : ''}
          </div>
        ` : ''}
      </div>

      <!-- CARD 2: STANDALONE EXPORT & BACKUP -->
      <div style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.08);border-radius:18px;padding:20px;margin-bottom:16px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
          <h3 style="font-size:0.95rem;font-weight:800;color:#fff;margin:0;display:flex;align-items:center;gap:8px;">
            <span>📦</span> Standalone Export & Backup
          </h3>
          <span style="font-size:0.68rem;font-weight:800;color:#4ade80;background:rgba(34,197,94,0.15);border:1px solid rgba(34,197,94,0.3);border-radius:10px;padding:2px 8px;">
            INCLUDED
          </span>
        </div>
        <p style="font-size:0.78rem;color:rgba(255,255,255,0.65);line-height:1.5;margin:0 0 14px 0;">
          Download an independent HTML website file for offline use, backup, or self-hosting. Unlimited exports are included with your plan.
        </p>
        <button id="btn-export-independent-site" class="btn btn-secondary" onclick="exportHTML()" style="width:100%;padding:10px;font-size:0.82rem;font-weight:700;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.18);color:#fff;border-radius:8px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;">
          <span>📥</span> Download Portfolio (.html)
        </button>
      </div>

      <!-- CARD 3: CUSTOM DOMAIN (PREMIUM ONLY) -->
      ${isPremiumOrGroup ? `
        <div style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.08);border-radius:18px;padding:20px;margin-bottom:16px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:8px;">
            <h3 style="font-size:0.95rem;font-weight:800;color:#fff;margin:0;display:flex;align-items:center;gap:8px;">
              <span>🌐</span> Custom Domain
            </h3>
            <div style="display:flex;align-items:center;gap:6px;">
              <span style="font-size:0.68rem;font-weight:800;color:#c084fc;background:rgba(124,58,237,0.15);border:1px solid rgba(124,58,237,0.3);border-radius:10px;padding:2px 8px;">
                PREMIUM
              </span>
              <span style="font-size:0.68rem;font-weight:800;color:#06b6d4;background:rgba(6,182,212,0.15);border:1px solid rgba(6,182,212,0.3);border-radius:10px;padding:2px 8px;">
                COMING SOON
              </span>
            </div>
          </div>
          <p style="font-size:0.78rem;color:rgba(255,255,255,0.65);line-height:1.5;margin:0;">
            Connect your own personalized domain name (e.g. <code>portfolio.yourname.com</code>) when custom domain publishing becomes available.
          </p>
        </div>
      ` : ''}

    </div>
  `;
}

window.renderPublishTab = renderPublishTab;

window.handlePublishPortfolio = async function() {
  const effectivePlan = globalEntitlements.getEffectivePlanId();
  const isGrandfathered = Boolean(portfolioData.isLegacy || portfolioData.is_legacy);
  const hasHostedPublishRights = effectivePlan === 'pro' || effectivePlan === 'premium' || effectivePlan === 'premium_group' || isGrandfathered;
  if (!hasHostedPublishRights) {
    showToast('error', '🔒', 'Publishing online requires a Pro or Premium plan.');
    if (typeof window.openBillingModal === 'function') {
      window.openBillingModal('pro');
    }
    return;
  }

  if (!portfolioData.name?.trim()) {
    showToast('error', '!', 'Add your name before publishing your portfolio.');
    switchTab('profile');
    return;
  }
  if (!portfolioData.slug?.trim()) {
    showToast('error', '!', 'Choose a public slug before publishing.');
    return;
  }
  const btn = document.getElementById('btn-publish-portfolio');
  if (btn) {
    btn.disabled = true;
    btn.textContent = '⏳ Publishing to Supabase...';
  }

  try {
    const res = await publishPortfolio(portfolioData);
    if (res.success) {
      portfolioData.publishedAt = res.publishedAt;
      portfolioData.published_at = res.publishedAt;
      if (res.url) portfolioData.publicUrl = res.url;
      showToast('success', '🚀', 'Portfolio published live to Supabase!');
      renderPublishTab();
      if (typeof confetti === 'function') {
        confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
      }
    } else {
      showToast('error', '❌', `Publish failed: ${res.error}`);
    }
  } catch (err) {
    showToast('error', '❌', `Publish error: ${err.message}`);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = '🚀 Update Live Portfolio';
    }
  }
};

window.copyPublicPortfolioUrl = function() {
  const effectivePlan = globalEntitlements.getEffectivePlanId();
  const isGrandfathered = Boolean(portfolioData.isLegacy || portfolioData.is_legacy);
  const isKeepItLive = globalEntitlements.isKeepItLive() || Boolean(portfolioData.hasKIL || portfolioData.has_kil);
  const hasHostedPublishRights = effectivePlan === 'pro' || effectivePlan === 'premium' || effectivePlan === 'premium_group' || isGrandfathered;
  
  if (!hasHostedPublishRights && !isKeepItLive) {
    showToast('error', '🔒', 'Live portfolio links are available with Pro.');
    if (typeof window.openBillingModal === 'function') {
      window.openBillingModal('pro');
    }
    return;
  }

  const slug = portfolioData.slug || (portfolioData.name ? portfolioData.name.toLowerCase().replace(/[^a-z0-9]/g, '-') : 'portfolio');
  const url = `${window.location.origin}/u/${slug}`;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url).then(() => {
      showToast('success', '📋', 'Public portfolio link copied to clipboard!');
    }).catch(() => {
      showToast('info', '🔗', url);
    });
  } else {
    showToast('info', '🔗', url);
  }
};

window.updatePortfolioSlug = function(val) {
  const effectivePlan = globalEntitlements.getEffectivePlanId();
  const isGrandfathered = Boolean(portfolioData.isLegacy || portfolioData.is_legacy);
  const hasHostedPublishRights = effectivePlan === 'pro' || effectivePlan === 'premium' || effectivePlan === 'premium_group' || isGrandfathered;
  
  if (!hasHostedPublishRights) {
    showToast('error', '🔒', 'Custom portfolio URLs are available with Pro.');
    if (typeof window.openBillingModal === 'function') {
      window.openBillingModal('pro');
    }
    renderPublishTab();
    return;
  }

  const clean = (val || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
  const reserved = new Set(['admin', 'api', 'login', 'studio', 'start', 'privacy', 'terms', 'reset-password']);
  if (!clean || reserved.has(clean)) {
    showToast('error', '⚠️', 'Choose another public slug using letters, numbers, and hyphens.');
    renderPublishTab();
    return;
  }
  portfolioData.slug = clean;
  autoSave();
  renderPublishTab();
  showToast('info', '🔗', `Public URL slug updated to: /u/${clean}`);
};

window.toggleProBranding = function(prop, val) {
  if (!isPro()) {
    portfolioData.hideWatermark = false;
    portfolioData.hideThemeBadge = false;
    handleUpgradeClick();
    return;
  }
  portfolioData[prop] = val;
  portfolioData.isPro = isPro();
  autoSave();
  showToast('info', '⚙️', 'Branding options updated successfully!');
};

// ─── DEPLOY LIVE (PRO) ────────────────────────
let currentDeployUrl = '';
window.deployLive = async function() {
  // Keep legacy buttons on the same secure, plan-aware publishing path.
  return window.handlePublishPortfolio();
  /* istanbul ignore next -- retained temporarily for old cached markup */
  if (!isPro()) { handleUpgradeClick(); return; }
  if (!portfolioData.name) {
    showToast('error', '⚠️', 'Please enter your name first!');
    switchTab('profile');
    return;
  }

  const btn = document.getElementById('deploy-btn');
  const progress = document.getElementById('deploy-progress');
  const result = document.getElementById('deploy-result');
  const bar = document.getElementById('deploy-progress-bar');
  const msg = document.getElementById('deploy-progress-msg');

  btn.disabled = true;
  btn.textContent = '⏳ Deploying...';
  progress.style.display = 'block';
  result.style.display = 'none';

  try {
    // Generate the portfolio HTML
    const { buildPortfolioHTMLContent } = await import('./exporter/PortfolioExporter.js');
    const html = buildPortfolioHTMLContent(portfolioData, currentTheme);

    // Try Netlify auto-deploy
    let liveUrl;
    if (isNetlifyConfigured()) {
      const res = await deployToNetlify(html, portfolioData.name, (message, percent) => {
        if (msg) msg.textContent = message;
        if (bar) bar.style.width = percent + '%';
      });
      liveUrl = res.url;
    } else {
      // Fallback: generate a data URL (works locally for demo)
      const blob = new Blob([html], { type: 'text/html' });
      liveUrl = URL.createObjectURL(blob);
      if (msg) msg.textContent = 'Generated local preview URL...';
      if (bar) bar.style.width = '100%';
      showToast('info', 'ℹ️', 'Add VITE_NETLIFY_TOKEN to .env for real live URLs!');
    }

    currentDeployUrl = liveUrl;

    // Show result
    progress.style.display = 'none';
    result.style.display = 'block';
    const urlBox = document.getElementById('deploy-url-box');
    const openLink = document.getElementById('deploy-open-link');
    if (urlBox) urlBox.textContent = liveUrl;
    if (openLink) { openLink.href = liveUrl; }

    btn.textContent = '🔄 Re-Deploy';
    btn.disabled = false;

    // Celebrate!
    confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 }, colors: ['#7c3aed','#06b6d4','#10b981'] });
    showToast('success', '🎉', 'Your 3D portfolio is LIVE!');
    await incrementStat('total_deploys');
    renderPublishTab();

  } catch (err) {
    progress.style.display = 'none';
    btn.textContent = '⚡ Deploy My Portfolio Live';
    btn.disabled = false;
    showToast('error', '❌', `Deploy failed: ${err.message}`);
    console.error(err);
  }
};

window.copyDeployUrl = function() {
  if (!currentDeployUrl) return;
  navigator.clipboard.writeText(currentDeployUrl).then(() => {
    showToast('success', '✅', 'Live URL copied to clipboard!');
  });
};

// ─── SKILLS ─────────────────────────────────
function renderSkills() {
  const el = document.getElementById('skills-list');
  if (!el) return;
  if (!Array.isArray(portfolioData.skills)) portfolioData.skills = [];

  if (!portfolioData.skills.length) {
    el.innerHTML = `
      <div style="background:rgba(255,255,255,0.02);border:1px dashed rgba(255,255,255,0.12);border-radius:12px;padding:20px 16px;text-align:center;color:rgba(255,255,255,0.6);margin-bottom:12px">
        <div style="font-size:1.3rem;margin-bottom:4px">⚡</div>
        <div style="font-size:0.85rem;font-weight:700;color:rgba(255,255,255,0.85);margin-bottom:4px">No skills added yet</div>
        <div style="font-size:0.75rem;margin-bottom:10px">Add your primary technical and professional skills.</div>
        <button class="btn btn-secondary" onclick="addSkill()" style="margin:0 auto;padding:6px 16px;font-size:0.78rem">+ Add Skill</button>
      </div>
    `;
    return;
  }

  el.innerHTML = portfolioData.skills.map((s, i) => `
    <div class="skill-row" id="skill-${i}" style="display:flex;gap:6px;align-items:center;margin-bottom:8px">
      <input class="field-input" value="${s.name || ''}" placeholder="Skill name (e.g. JavaScript, React)..." oninput="updateSkill(${i},'name',this.value)" style="flex:1"/>
      <input class="skill-level-input field-input" type="number" min="0" max="100" value="${s.level || 80}" oninput="updateSkill(${i},'level',parseInt(this.value)||0)" style="width:58px;text-align:center"/>
      <div style="display:flex;gap:2px">
        <button onclick="moveSkill(${i},-1)" style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:#fff;border-radius:4px;width:24px;height:24px;cursor:pointer;font-size:0.7rem;display:flex;align-items:center;justify-content:center" title="Move Up" ${i === 0 ? 'disabled style="opacity:0.3;cursor:not-allowed"' : ''}>↑</button>
        <button onclick="moveSkill(${i},1)" style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:#fff;border-radius:4px;width:24px;height:24px;cursor:pointer;font-size:0.7rem;display:flex;align-items:center;justify-content:center" title="Move Down" ${i === portfolioData.skills.length - 1 ? 'disabled style="opacity:0.3;cursor:not-allowed"' : ''}>↓</button>
      </div>
      <button class="del-btn" onclick="removeSkill(${i})" style="background:none;border:none;color:#ef4444;cursor:pointer;padding:4px 8px">✕</button>
    </div>
  `).join('');
}

window.addSkill = function() {
  if (!Array.isArray(portfolioData.skills)) portfolioData.skills = [];
  portfolioData.skills.push({ name: '', level: 80 });
  renderSkills();
  updateHUD();
  flyToSection('skills');
  autoSave();
};
window.updateSkill = function(i, key, val) {
  if (portfolioData.skills[i]) {
    portfolioData.skills[i][key] = val;
    updateHUD();
    autoSave();
  }
};
window.moveSkill = function(i, dir) {
  const targetIdx = i + dir;
  if (!portfolioData.skills || targetIdx < 0 || targetIdx >= portfolioData.skills.length) return;
  const temp = portfolioData.skills[i];
  portfolioData.skills[i] = portfolioData.skills[targetIdx];
  portfolioData.skills[targetIdx] = temp;
  renderSkills();
  updateHUD();
  autoSave();
};
window.removeSkill = function(i) {
  portfolioData.skills.splice(i, 1);
  renderSkills();
  updateHUD();
  autoSave();
};

// ─── EXPERIENCE ──────────────────────────────
function renderExperience() {
  const el = document.getElementById('experience-list');
  if (!el) return;
  if (!Array.isArray(portfolioData.experience)) portfolioData.experience = [];

  if (!portfolioData.experience.length) {
    el.innerHTML = `
      <div style="background:rgba(255,255,255,0.02);border:1px dashed rgba(255,255,255,0.12);border-radius:12px;padding:20px 16px;text-align:center;color:rgba(255,255,255,0.6);margin-bottom:12px">
        <div style="font-size:1.3rem;margin-bottom:4px">💼</div>
        <div style="font-size:0.85rem;font-weight:700;color:rgba(255,255,255,0.85);margin-bottom:4px">No experience added yet</div>
        <div style="font-size:0.75rem;margin-bottom:10px">Add your past or current roles to highlight your career.</div>
        <button class="btn btn-secondary" onclick="addExperience()" style="margin:0 auto;padding:6px 16px;font-size:0.78rem">+ Add Experience</button>
      </div>
    `;
    return;
  }

  el.innerHTML = portfolioData.experience.map((exp, i) => `
    <div class="experience-item" style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:16px;margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <span style="font-size:0.78rem;font-weight:700;color:var(--primary)">Role 0${i+1}</span>
        <div style="display:flex;align-items:center;gap:6px">
          <button onclick="moveExperience(${i},-1)" style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:#fff;border-radius:6px;padding:2px 8px;cursor:pointer;font-size:0.75rem" title="Move Up" ${i === 0 ? 'disabled style="opacity:0.3;cursor:not-allowed"' : ''}>↑</button>
          <button onclick="moveExperience(${i},1)" style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:#fff;border-radius:6px;padding:2px 8px;cursor:pointer;font-size:0.75rem" title="Move Down" ${i === portfolioData.experience.length - 1 ? 'disabled style="opacity:0.3;cursor:not-allowed"' : ''}>↓</button>
          <button onclick="removeExperience(${i})" style="background:none;border:none;color:#ef4444;cursor:pointer;font-weight:bold;margin-left:4px">✕ Remove</button>
        </div>
      </div>
      <input class="field-input" value="${exp.role || ''}" placeholder="Job Title / Role (e.g. Senior Frontend Engineer)" oninput="updateExperience(${i},'role',this.value)" style="margin-bottom:8px;font-weight:700"/>
      <div style="display:flex;gap:8px;margin-bottom:8px">
        <input class="field-input" value="${exp.company || ''}" placeholder="Company Name" oninput="updateExperience(${i},'company',this.value)" style="flex:1"/>
        <input class="field-input" value="${exp.location || ''}" placeholder="Location (e.g. Remote / Cairo)" oninput="updateExperience(${i},'location',this.value)" style="flex:1"/>
      </div>
      <div style="display:flex;gap:8px;margin-bottom:8px;align-items:center">
        <input class="field-input" value="${exp.startDate || ''}" placeholder="Start Date (e.g. 2024)" oninput="updateExperience(${i},'startDate',this.value)" style="flex:1"/>
        <input class="field-input" value="${exp.endDate || ''}" placeholder="End Date (e.g. Present)" oninput="updateExperience(${i},'endDate',this.value)" style="flex:1" ${exp.current ? 'disabled' : ''}/>
        <label style="font-size:0.75rem;color:rgba(255,255,255,0.8);cursor:pointer;white-space:nowrap;display:flex;align-items:center;gap:4px">
          <input type="checkbox" ${exp.current ? 'checked' : ''} onchange="updateExperience(${i},'current',this.checked)"/> Current
        </label>
      </div>
      <textarea class="field-textarea" style="min-height:55px;margin-bottom:8px" placeholder="Role description and achievements..." oninput="updateExperience(${i},'description',this.value)">${exp.description || ''}</textarea>
      <input class="field-input" value="${Array.isArray(exp.achievements) ? exp.achievements.join(' ; ') : ''}" placeholder="Key Achievements (separated by semicolons ';')" oninput="updateExperienceAchievements(${i},this.value)" style="margin-bottom:8px"/>
      <input class="field-input" value="${Array.isArray(exp.technologies) ? exp.technologies.join(', ') : ''}" placeholder="Technologies used (comma separated, e.g. React, Three.js)" oninput="updateExperienceTechnologies(${i},this.value)"/>
    </div>
  `).join('');
}

window.addExperience = function() {
  if (!Array.isArray(portfolioData.experience)) portfolioData.experience = [];
  portfolioData.experience.push({
    id: 'exp_' + Date.now(),
    role: '', company: '', location: '', startDate: '', endDate: '', current: true,
    description: '', achievements: [], technologies: [], companyUrl: ''
  });
  renderExperience();
  updateHUD();
  flyToSection('experience');
  autoSave();
};

window.updateExperience = function(i, key, val) {
  if (portfolioData.experience[i]) {
    portfolioData.experience[i][key] = val;
    updateHUD();
    autoSave();
  }
};

window.updateExperienceAchievements = function(i, text) {
  if (portfolioData.experience[i]) {
    portfolioData.experience[i].achievements = text.split(';').map(s => s.trim()).filter(Boolean);
    updateHUD();
    autoSave();
  }
};

window.updateExperienceTechnologies = function(i, text) {
  if (portfolioData.experience[i]) {
    portfolioData.experience[i].technologies = text.split(',').map(s => s.trim()).filter(Boolean);
    updateHUD();
    autoSave();
  }
};

window.moveExperience = function(i, dir) {
  const targetIdx = i + dir;
  if (!portfolioData.experience || targetIdx < 0 || targetIdx >= portfolioData.experience.length) return;
  const temp = portfolioData.experience[i];
  portfolioData.experience[i] = portfolioData.experience[targetIdx];
  portfolioData.experience[targetIdx] = temp;
  renderExperience();
  updateHUD();
  autoSave();
};

window.removeExperience = function(i) {
  portfolioData.experience.splice(i, 1);
  renderExperience();
  updateHUD();
  autoSave();
};

// ─── EDUCATION ───────────────────────────────
function renderEducation() {
  const el = document.getElementById('education-list');
  if (!el) return;
  if (!Array.isArray(portfolioData.education)) portfolioData.education = [];

  if (!portfolioData.education.length) {
    el.innerHTML = `
      <div style="background:rgba(255,255,255,0.02);border:1px dashed rgba(255,255,255,0.12);border-radius:12px;padding:20px 16px;text-align:center;color:rgba(255,255,255,0.6);margin-bottom:12px">
        <div style="font-size:1.3rem;margin-bottom:4px">🎓</div>
        <div style="font-size:0.85rem;font-weight:700;color:rgba(255,255,255,0.85);margin-bottom:4px">No education records yet</div>
        <div style="font-size:0.75rem;margin-bottom:10px">Add your degrees, certifications, or educational background.</div>
        <button class="btn btn-secondary" onclick="addEducation()" style="margin:0 auto;padding:6px 16px;font-size:0.78rem">+ Add Education</button>
      </div>
    `;
    return;
  }

  el.innerHTML = portfolioData.education.map((edu, i) => `
    <div class="education-item" style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:16px;margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <span style="font-size:0.78rem;font-weight:700;color:var(--secondary)">Degree 0${i+1}</span>
        <div style="display:flex;align-items:center;gap:6px">
          <button onclick="moveEducation(${i},-1)" style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:#fff;border-radius:6px;padding:2px 8px;cursor:pointer;font-size:0.75rem" title="Move Up" ${i === 0 ? 'disabled style="opacity:0.3;cursor:not-allowed"' : ''}>↑</button>
          <button onclick="moveEducation(${i},1)" style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:#fff;border-radius:6px;padding:2px 8px;cursor:pointer;font-size:0.75rem" title="Move Down" ${i === portfolioData.education.length - 1 ? 'disabled style="opacity:0.3;cursor:not-allowed"' : ''}>↓</button>
          <button onclick="removeEducation(${i})" style="background:none;border:none;color:#ef4444;cursor:pointer;font-weight:bold;margin-left:4px">✕ Remove</button>
        </div>
      </div>
      <input class="field-input" value="${edu.degree || ''}" placeholder="Degree (e.g. B.Sc. Computer Science)" oninput="updateEducation(${i},'degree',this.value)" style="margin-bottom:8px;font-weight:700"/>
      <div style="display:flex;gap:8px;margin-bottom:8px">
        <input class="field-input" value="${edu.institution || ''}" placeholder="Institution / University" oninput="updateEducation(${i},'institution',this.value)" style="flex:1"/>
        <input class="field-input" value="${edu.location || ''}" placeholder="Location" oninput="updateEducation(${i},'location',this.value)" style="flex:1"/>
      </div>
      <div style="display:flex;gap:8px;margin-bottom:8px">
        <input class="field-input" value="${edu.startDate || ''}" placeholder="Start Year" oninput="updateEducation(${i},'startDate',this.value)" style="flex:1"/>
        <input class="field-input" value="${edu.endDate || ''}" placeholder="End Year" oninput="updateEducation(${i},'endDate',this.value)" style="flex:1"/>
        <input class="field-input" value="${edu.grade || ''}" placeholder="Grade / Honors" oninput="updateEducation(${i},'grade',this.value)" style="flex:1"/>
      </div>
      <textarea class="field-textarea" style="min-height:50px" placeholder="Field of study or details..." oninput="updateEducation(${i},'description',this.value)">${edu.description || ''}</textarea>
    </div>
  `).join('');
}

window.addEducation = function() {
  if (!Array.isArray(portfolioData.education)) portfolioData.education = [];
  portfolioData.education.push({
    id: 'edu_' + Date.now(),
    degree: '', institution: '', field: '', location: '', startDate: '', endDate: '', grade: '', description: ''
  });
  renderEducation();
  updateHUD();
  flyToSection('education');
  autoSave();
};

window.updateEducation = function(i, key, val) {
  if (portfolioData.education[i]) {
    portfolioData.education[i][key] = val;
    updateHUD();
    autoSave();
  }
};

window.moveEducation = function(i, dir) {
  const targetIdx = i + dir;
  if (!portfolioData.education || targetIdx < 0 || targetIdx >= portfolioData.education.length) return;
  const temp = portfolioData.education[i];
  portfolioData.education[i] = portfolioData.education[targetIdx];
  portfolioData.education[targetIdx] = temp;
  renderEducation();
  updateHUD();
  autoSave();
};

window.removeEducation = function(i) {
  portfolioData.education.splice(i, 1);
  renderEducation();
  updateHUD();
  autoSave();
};

// ─── RESUME CV ───────────────────────────────
function renderResumeUI() {
  const el = document.getElementById('resume-editor-box');
  if (!el) return;

  const hasFile = portfolioData.resume && (portfolioData.resume.url || portfolioData.resume.fileName);

  el.innerHTML = `
    <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.1);border-radius:14px;padding:16px;margin-top:16px">
      <div style="font-size:0.85rem;font-weight:800;color:var(--primary);margin-bottom:6px">📄 Resume / CV Attachment</div>
      <div style="font-size:0.75rem;color:rgba(255,255,255,0.6);margin-bottom:12px">Upload your PDF resume to add a Download Resume CTA button in your portfolio.</div>
      
      ${hasFile ? `
        <div style="display:flex;align-items:center;justify-content:space-between;background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.3);border-radius:10px;padding:10px 14px;margin-bottom:10px">
          <div style="font-size:0.82rem;color:#10b981;font-weight:700">📄 ${portfolioData.resume.fileName || 'Resume.pdf'}</div>
          <button onclick="removeResume()" style="background:none;border:none;color:#ef4444;font-size:0.78rem;font-weight:700;cursor:pointer">Remove ✕</button>
        </div>
      ` : ''}

      <div style="display:flex;gap:8px">
        <label style="flex:1;background:rgba(124,58,237,0.15);border:1px solid rgba(124,58,237,0.3);border-radius:10px;padding:10px;text-align:center;color:#fff;font-size:0.8rem;font-weight:700;cursor:pointer">
          📁 ${hasFile ? 'Replace PDF' : 'Upload Resume PDF'}
          <input type="file" accept=".pdf,application/pdf" style="display:none" onchange="handleResumeUpload(this)"/>
        </label>
      </div>
    </div>
  `;
}

window.updateAvailabilityStatus = function(val) {
  if (!portfolioData.availability) portfolioData.availability = {};
  portfolioData.availability.status = val;
  updateHUD();
  autoSave();
};

window.handleResumeUpload = async function(input) {
  const file = input.files[0];
  if (!file) return;

  showToast('info', '⏳', 'Uploading resume to Supabase Storage...');

  try {
    const authUser = await getCurrentAuthUser();
    if (!authUser) {
      showToast('error', '🔒', 'Session expired. Please sign in.');
      window.location.href = '/login';
      return;
    }
    const userId = authUser.id;
    const portfolioId = portfolioData.id || 'default';

    const resumeMeta = await uploadResume(file, userId, portfolioId);
    portfolioData.resume = {
      ...resumeMeta,
      buttonText: 'Download Resume'
    };

    renderResumeUI();
    updateHUD();
    autoSave();
    showToast('success', '📄', 'Resume uploaded to Supabase Storage!');
  } catch (err) {
    showToast('error', '❌', `Resume upload failed: ${err.message}`);
    input.value = '';
  }
};

window.removeResume = function() {
  portfolioData.resume = null;
  renderResumeUI();
  updateHUD();
  autoSave();
  showToast('info', '🗑️', 'Resume removed.');
};

// ─── PROJECTS ────────────────────────────────
function renderProjects() {
  const el = document.getElementById('projects-list');
  if (!el) return;
  if (!Array.isArray(portfolioData.projects)) portfolioData.projects = [];

  if (!portfolioData.projects.length) {
    el.innerHTML = `
      <div style="background:rgba(255,255,255,0.02);border:1px dashed rgba(255,255,255,0.12);border-radius:12px;padding:20px 16px;text-align:center;color:rgba(255,255,255,0.6);margin-bottom:12px">
        <div style="font-size:1.3rem;margin-bottom:4px">🚀</div>
        <div style="font-size:0.85rem;font-weight:700;color:rgba(255,255,255,0.85);margin-bottom:4px">No projects added yet</div>
        <div style="font-size:0.75rem;margin-bottom:10px">Add the projects and case studies you are most proud of.</div>
        <button class="btn btn-secondary" onclick="addProject()" style="margin:0 auto;padding:6px 16px;font-size:0.78rem">+ Add Project</button>
      </div>
    `;
    return;
  }

  el.innerHTML = portfolioData.projects.map((p, i) => `
    <div class="project-item" style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:16px;margin-bottom:12px">
      <div class="project-item-header" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <span class="project-num-badge" style="font-size:0.75rem;font-weight:700;color:var(--primary)">Project 0${i+1}</span>
        <div style="display:flex;align-items:center;gap:6px">
          <button onclick="moveProject(${i},-1)" style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:#fff;border-radius:6px;padding:2px 8px;cursor:pointer;font-size:0.75rem" title="Move Up" ${i === 0 ? 'disabled style="opacity:0.3;cursor:not-allowed"' : ''}>↑</button>
          <button onclick="moveProject(${i},1)" style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:#fff;border-radius:6px;padding:2px 8px;cursor:pointer;font-size:0.75rem" title="Move Down" ${i === portfolioData.projects.length - 1 ? 'disabled style="opacity:0.3;cursor:not-allowed"' : ''}>↓</button>
          <button class="del-btn" onclick="removeProject(${i})" style="background:none;border:none;color:#ef4444;cursor:pointer;margin-left:4px">✕ Remove</button>
        </div>
      </div>
      <input class="field-input" value="${p.name || ''}" placeholder="Project Name (e.g. AI E-Commerce Platform)" oninput="updateProject(${i},'name',this.value)" style="margin-bottom:8px;font-weight:700"/>
      <textarea class="field-textarea" style="min-height:55px;margin-bottom:8px" placeholder="Brief summary of what this project does and key achievements..." oninput="updateProject(${i},'description',this.value)">${p.description || ''}</textarea>
      
      <!-- IMAGE UPLOADER SECTION -->
      <div style="margin-bottom:8px;display:flex;gap:8px;align-items:center">
        <input class="field-input" id="project-img-input-${i}" value="${p.image || ''}" placeholder="Project image URL or choose file ←" oninput="updateProject(${i},'image',this.value)" style="flex:1"/>
        <label style="
          padding:9px 12px;background:rgba(124,58,237,0.15);border:1px solid rgba(124,58,237,0.3);
          border-radius:8px;color:#fff;font-size:0.78rem;font-weight:600;cursor:pointer;
          display:flex;align-items:center;gap:6px;white-space:nowrap;transition:all 0.2s;
        " onmouseover="this.style.background='rgba(124,58,237,0.25)'" onmouseout="this.style.background='rgba(124,58,237,0.15)'">
          📁 Choose File
          <input type="file" accept="image/*" style="display:none" onchange="uploadProjectImage(${i}, this)"/>
        </label>
      </div>

      ${p.image ? `
        <div style="width:100%;height:90px;border-radius:8px;overflow:hidden;margin-bottom:8px;border:1px solid rgba(255,255,255,0.1);position:relative">
          <img src="${p.image}" style="width:100%;height:100%;object-fit:cover"/>
          <button onclick="updateProject(${i},'image','');renderProjects();updateHUD();" style="position:absolute;top:4px;right:4px;background:rgba(0,0,0,0.7);border:none;color:#fff;border-radius:50%;width:20px;height:20px;cursor:pointer;font-size:10px">✕</button>
        </div>
      ` : ''}

      <input class="field-input" value="${p.tech || ''}" placeholder="Technologies used (e.g. React · Three.js · Node.js)" oninput="updateProject(${i},'tech',this.value)" style="margin-bottom:8px"/>
      
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
        <input class="field-input" value="${p.github || ''}" placeholder="GitHub URL (Optional)" oninput="updateProject(${i},'github',this.value)"/>
        <input class="field-input" value="${p.url || ''}" placeholder="Live Demo URL (Optional)" oninput="updateProject(${i},'url',this.value)"/>
      </div>

      <!-- ADVANCED CASE STUDY EXPANDABLE ACCORDION -->
      <details style="margin-top:8px;background:rgba(124,58,237,0.06);border:1px dashed rgba(124,58,237,0.3);border-radius:10px;padding:10px">
        <summary style="font-size:0.78rem;font-weight:700;color:var(--primary);cursor:pointer;user-select:none;display:flex;align-items:center;justify-content:space-between">
          <span>🎬 Case Study & Cinema Details</span>
          <span style="font-size:0.68rem;opacity:0.7">Optional ✨</span>
        </summary>
        
        <div style="margin-top:10px;display:flex;flex-direction:column;gap:8px">
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px">
            <input class="field-input" value="${p.role || ''}" placeholder="Your Role (e.g. Lead Dev)" oninput="updateProject(${i},'role',this.value)"/>
            <input class="field-input" value="${p.duration || ''}" placeholder="Duration (e.g. 3 Months)" oninput="updateProject(${i},'duration',this.value)"/>
            <input class="field-input" value="${p.team || ''}" placeholder="Team Size (e.g. 4 Devs)" oninput="updateProject(${i},'team',this.value)"/>
          </div>

          <textarea class="field-textarea" style="min-height:50px" placeholder="The Problem (What challenge did this solve?)" oninput="updateProject(${i},'problem',this.value)">${p.problem || ''}</textarea>
          <textarea class="field-textarea" style="min-height:50px" placeholder="The Technical Solution (Architecture & stack choices...)" oninput="updateProject(${i},'solution',this.value)">${p.solution || ''}</textarea>
          <textarea class="field-textarea" style="min-height:50px" placeholder="Engineering Process & Implementation notes..." oninput="updateProject(${i},'process',this.value)">${p.process || ''}</textarea>
          <textarea class="field-textarea" style="min-height:50px" placeholder="Business Impact & Key Outcomes..." oninput="updateProject(${i},'impact',this.value)">${p.impact || ''}</textarea>

          <input class="field-input" value="${typeof p.metrics === 'string' ? p.metrics : (Array.isArray(p.metrics) ? p.metrics.map(m => typeof m === 'object' ? `${m.val || m.value}:${m.label}` : m).join(', ') : '')}" placeholder="Key Metrics (e.g. 45% Faster Load, 2M+ Daily Events)" oninput="updateProject(${i},'metrics',this.value)"/>
          <input class="field-input" value="${p.video || ''}" placeholder="Video Demo URL (Optional)" oninput="updateProject(${i},'video',this.value)"/>
        </div>
      </details>
    </div>
  `).join('');
}

window.uploadProjectImage = async function(i, inputEl) {
  const file = inputEl.files[0];
  if (!file) return;

  showToast('info', '⏳', 'Uploading project image...');

  try {
    const authUser = await getCurrentAuthUser();
    if (!authUser) {
      showToast('error', '🔒', 'Session expired. Please sign in.');
      window.location.href = '/login';
      return;
    }
    const userId = authUser.id;
    const portfolioId = portfolioData.id || 'default';
    const projectId = portfolioData.projects[i]?.id || `proj_${i}`;

    const mediaMeta = await uploadProjectMedia(file, userId, portfolioId, projectId);
    updateProject(i, 'image', mediaMeta.publicUrl);
    if (!portfolioData.projects[i].media) portfolioData.projects[i].media = [];
    portfolioData.projects[i].media.push(mediaMeta);

    renderProjects();
    updateHUD();
    autoSave();
    showToast('success', '🖼️', 'Project image uploaded!');
  } catch (err) {
    showToast('error', '❌', `Project image upload failed: ${err.message}`);
    inputEl.value = '';
  }
};

window.addProject = function() {
  if (!Array.isArray(portfolioData.projects)) portfolioData.projects = [];
  portfolioData.projects.push({ name: '', description: '', tech: '', url: '', github: '', image: '' });
  renderProjects();
  updateHUD();
  flyToSection('projects');
  autoSave();
};
window.updateProject = function(i, key, val) {
  if (portfolioData.projects[i]) {
    portfolioData.projects[i][key] = val;
    updateHUD();
    autoSave();
  }
};
window.moveProject = function(i, dir) {
  const targetIdx = i + dir;
  if (!portfolioData.projects || targetIdx < 0 || targetIdx >= portfolioData.projects.length) return;
  const temp = portfolioData.projects[i];
  portfolioData.projects[i] = portfolioData.projects[targetIdx];
  portfolioData.projects[targetIdx] = temp;
  renderProjects();
  updateHUD();
  autoSave();
};
window.removeProject = function(i) {
  portfolioData.projects.splice(i, 1);
  renderProjects();
  updateHUD();
  autoSave();
};

// ─── CERTIFICATES ─────────────────────────────
function renderCerts() {
  const el = document.getElementById('certs-list');
  if (!el) return;
  if (!portfolioData.certs) portfolioData.certs = [];

  if (!portfolioData.certs.length) {
    el.innerHTML = `
      <div style="background:rgba(255,255,255,0.02);border:1px dashed rgba(255,255,255,0.12);border-radius:12px;padding:20px 16px;text-align:center;color:rgba(255,255,255,0.6);margin-bottom:12px">
        <div style="font-size:1.3rem;margin-bottom:4px">📜</div>
        <div style="font-size:0.85rem;font-weight:700;color:rgba(255,255,255,0.85);margin-bottom:4px">No certificates added yet</div>
        <div style="font-size:0.75rem;margin-bottom:10px">Add relevant licenses, certifications, or credentials.</div>
        <button class="btn btn-secondary" onclick="addCert()" style="margin:0 auto;padding:6px 16px;font-size:0.78rem">+ Add Certificate</button>
      </div>
    `;
    return;
  }

  el.innerHTML = portfolioData.certs.map((c, i) => `
    <div class="cert-item" style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:16px;margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <span style="font-size:0.75rem;font-weight:700;color:#10b981">📜 Certificate 0${i+1}</span>
        <div style="display:flex;align-items:center;gap:6px">
          <button onclick="moveCert(${i},-1)" style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:#fff;border-radius:6px;padding:2px 8px;cursor:pointer;font-size:0.75rem" title="Move Up" ${i === 0 ? 'disabled style="opacity:0.3;cursor:not-allowed"' : ''}>↑</button>
          <button onclick="moveCert(${i},1)" style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:#fff;border-radius:6px;padding:2px 8px;cursor:pointer;font-size:0.75rem" title="Move Down" ${i === portfolioData.certs.length - 1 ? 'disabled style="opacity:0.3;cursor:not-allowed"' : ''}>↓</button>
          <button class="del-btn" onclick="removeCert(${i})" style="background:none;border:none;color:#ef4444;cursor:pointer;margin-left:4px">✕ Remove</button>
        </div>
      </div>
      <input class="field-input" value="${c.title || ''}" placeholder="Certificate Title (e.g. AWS Certified Developer)" oninput="updateCert(${i},'title',this.value)" style="margin-bottom:8px;font-weight:700"/>
      <input class="field-input" value="${c.issuer || ''}" placeholder="Issuing Organization (e.g. Amazon Web Services / Google)" oninput="updateCert(${i},'issuer',this.value)" style="margin-bottom:8px"/>
      <input class="field-input" value="${c.date || ''}" placeholder="Issue Year / Date (e.g. 2024)" oninput="updateCert(${i},'date',this.value)" style="margin-bottom:8px"/>
      
      <!-- CERT IMAGE UPLOADER -->
      <div style="margin-bottom:8px;display:flex;gap:8px;align-items:center">
        <input class="field-input" id="cert-img-input-${i}" value="${c.image || ''}" placeholder="Certificate image URL or choose file ←" oninput="updateCert(${i},'image',this.value)" style="flex:1"/>
        <label style="
          padding:9px 12px;background:rgba(16,185,129,0.15);border:1px solid rgba(16,185,129,0.3);
          border-radius:8px;color:#fff;font-size:0.78rem;font-weight:600;cursor:pointer;
          display:flex;align-items:center;gap:6px;white-space:nowrap;transition:all 0.2s;
        " onmouseover="this.style.background='rgba(16,185,129,0.25)'" onmouseout="this.style.background='rgba(16,185,129,0.15)'">
          📁 Choose File
          <input type="file" accept="image/*" style="display:none" onchange="uploadCertImage(${i}, this)"/>
        </label>
      </div>

      ${c.image ? `
        <div style="width:100%;height:90px;border-radius:8px;overflow:hidden;margin-bottom:8px;border:1px solid rgba(255,255,255,0.1);position:relative">
          <img src="${c.image}" style="width:100%;height:100%;object-fit:cover"/>
          <button onclick="updateCert(${i},'image','');renderCerts();updateHUD();" style="position:absolute;top:4px;right:4px;background:rgba(0,0,0,0.7);border:none;color:#fff;border-radius:50%;width:20px;height:20px;cursor:pointer;font-size:10px">✕</button>
        </div>
      ` : ''}
    </div>
  `).join('');
}

window.uploadCertImage = function(i, inputEl) {
  const file = inputEl.files[0];
  if (!file) return;

  if (file.size > 4 * 1024 * 1024) {
    showToast('error', '⚠️', 'File size exceeds 4MB. Please choose a smaller image.');
    return;
  }

  const reader = new FileReader();
  reader.onload = function(e) {
    updateCert(i, 'image', e.target.result);
    renderCerts();
    updateHUD();
    showToast('success', '📜', 'Certificate image attached!');
  };
  reader.readAsDataURL(file);
};

window.addCert = function() {
  if (!portfolioData.certs) portfolioData.certs = [];
  portfolioData.certs.push({ title: '', issuer: '', date: '', image: '' });
  renderCerts();
  updateHUD();
  flyToSection('certs');
  autoSave();
};
window.updateCert = function(i, key, val) {
  if (!portfolioData.certs) portfolioData.certs = [];
  portfolioData.certs[i][key] = val;
  updateHUD();
  autoSave();
};
window.moveCert = function(i, dir) {
  const targetIdx = i + dir;
  if (!portfolioData.certs || targetIdx < 0 || targetIdx >= portfolioData.certs.length) return;
  const temp = portfolioData.certs[i];
  portfolioData.certs[i] = portfolioData.certs[targetIdx];
  portfolioData.certs[targetIdx] = temp;
  renderCerts();
  updateHUD();
  autoSave();
};
window.removeCert = function(i) {
  if (!portfolioData.certs) portfolioData.certs = [];
  portfolioData.certs.splice(i, 1);
  renderCerts();
  updateHUD();
  autoSave();
};

// ─── THEME GRID ─────────────────────────────
const THEME_DESCRIPTORS = {
  code: { tag: 'Tech & Dev', desc: 'Code matrix neon flow' },
  creative: { tag: 'Creative UI', desc: 'Vibrant fluid prism' },
  minimal: { tag: 'Universal Minimal', desc: 'Subtle orbital geometry & calm space' },
  hacker: { tag: 'Cybersecurity', desc: 'Command shield and stream' },
  data: { tag: 'Data & AI', desc: 'Dense galactic orbital chart' },
  blueprint: { tag: 'Engineering', desc: 'Precision structural grid' },
  media: { tag: 'Cinema & Media', desc: 'Aperture camera ring' },
  health: { tag: 'Health & Bio', desc: 'Double-helix cellular pulse' },
  marketing: { tag: 'Growth & Biz', desc: 'Dynamic ascending energy' },
  education: { tag: 'Academia', desc: 'Cosmic nebula knowledge flow' },
  cosmic: { tag: 'Cosmic Nebula', desc: 'Starlight atmospheric depth' },
  finance: { tag: 'Finance & Fintech', desc: 'Golden metrics & orbital rings' },
  legal: { tag: 'Prestige & Legal', desc: 'Understated structured lines' },
  obsidian: { tag: 'Executive Luxury', desc: 'Deep obsidian crystal & gold chrome' },
  quantum: { tag: 'Quantum Deep-Tech', desc: 'Layered aurora ribbons & spatial energy' }
};

function renderThemeCard(t, userTier) {
  const requiredTier = getThemeTier(t.id);
  const isLocked = !canAccessTheme(userTier, t.id);
  const isActive = currentTheme?.id === t.id;
  const meta = THEME_DESCRIPTORS[t.id] || { tag: 'Visual Theme', desc: t.name };

  let badgeHTML = '';
  if (requiredTier === 'pro') {
    badgeHTML = '<span class="pro-badge" style="font-size:0.62rem;padding:2px 7px;background:rgba(124,58,237,0.2);color:#c084fc;border:1px solid rgba(124,58,237,0.45);border-radius:6px;font-weight:800;letter-spacing:0.5px;">🔒 PRO</span>';
  } else if (requiredTier === 'premium') {
    badgeHTML = '<span class="pro-badge" style="font-size:0.62rem;padding:2px 7px;background:rgba(6,182,212,0.2);color:#38bdf8;border:1px solid rgba(6,182,212,0.45);border-radius:6px;font-weight:800;letter-spacing:0.5px;">💎 PREMIUM</span>';
  } else {
    badgeHTML = '<span style="font-size:0.58rem;padding:2px 6px;background:rgba(56,189,248,0.1);color:#38bdf8;border:1px solid rgba(56,189,248,0.25);border-radius:6px;font-weight:700;">FREE</span>';
  }

  const ctaButtons = !isLocked
    ? `
      <button type="button" class="theme-action-btn btn-apply-theme" onclick="event.stopPropagation(); selectTheme('${t.id}')" style="width: 100%; padding: 6px 10px; border-radius: 8px; background: ${isActive ? 'rgba(124,58,237,0.3)' : 'rgba(255,255,255,0.06)'}; border: 1px solid ${isActive ? '#7c3aed' : 'rgba(255,255,255,0.12)'}; color: #fff; font-size: 0.72rem; font-weight: 700; cursor: pointer; transition: all 0.2s ease;">
        ${isActive ? '✓ Active Theme' : 'Apply Theme'}
      </button>
    `
    : `
      <div style="display: flex; gap: 6px; width: 100%;">
        <button type="button" class="theme-action-btn btn-preview-theme" onclick="event.stopPropagation(); previewTheme('${t.id}')" style="flex: 1; padding: 6px 8px; border-radius: 8px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.15); color: #fff; font-size: 0.68rem; font-weight: 700; cursor: pointer; transition: all 0.2s ease;">
          👁️ Preview
        </button>
        <button type="button" class="theme-action-btn btn-unlock-theme" onclick="event.stopPropagation(); handleUpgradeClick('${requiredTier}')" style="flex: 1.3; padding: 6px 8px; border-radius: 8px; background: ${requiredTier === 'premium' ? 'linear-gradient(135deg, #0891b2, #7c3aed)' : 'linear-gradient(135deg, #7c3aed, #06b6d4)'}; border: none; color: #fff; font-size: 0.68rem; font-weight: 800; cursor: pointer; transition: all 0.2s ease; white-space: nowrap;">
          ${requiredTier === 'premium' ? 'Unlock Premium' : 'Unlock with Pro'}
        </button>
      </div>
    `;

  return `
    <div class="theme-card ${isActive ? 'active' : ''} ${isLocked ? 'theme-card--locked' : ''}" data-theme-id="${t.id}" onclick="${isLocked ? `previewTheme('${t.id}')` : `selectTheme('${t.id}')`}" style="display:flex;flex-direction:column;gap:4px;padding:12px 10px;text-align:left;position:relative;cursor:pointer;border-radius:12px;transition:all 0.2s ease;">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <span class="theme-emoji" style="font-size:1.4rem;">${t.emoji}</span>
        ${badgeHTML}
      </div>
      <div class="theme-name" style="font-size:0.82rem;font-weight:800;color:#fff;margin-top:2px;display:flex;align-items:center;justify-content:space-between;gap:4px;">
        <span>${t.name}</span>
        <span style="font-size:0.58rem;font-weight:700;color:var(--primary);background:rgba(124,58,237,0.12);padding:1px 5px;border-radius:6px;">${meta.tag}</span>
      </div>
      <div style="font-size:0.68rem;color:rgba(255,255,255,0.55);line-height:1.35;margin-bottom:6px;">${meta.desc}</div>
      <div style="margin-top:auto;padding-top:4px;">
        ${ctaButtons}
      </div>
    </div>
  `;
}

function buildThemeGrid() {
  const el = document.getElementById('theme-grid');
  if (!el) return;
  const userTier = globalEntitlements.getThemeTier();

  const starterIds = ['code', 'creative', 'minimal'];
  const proIds = ['hacker', 'data', 'blueprint', 'media', 'health', 'marketing', 'education'];
  const premiumIds = ['cosmic', 'finance', 'legal', 'obsidian', 'quantum'];

  const starterCards = starterIds.map(id => renderThemeCard(getThemeById(id), userTier)).join('');
  const proCards = proIds.map(id => renderThemeCard(getThemeById(id), userTier)).join('');
  const premiumCards = premiumIds.map(id => renderThemeCard(getThemeById(id), userTier)).join('');

  el.innerHTML = `
    <div class="theme-catalog-container" style="display: flex; flex-direction: column; gap: 20px; width: 100%;">
      <!-- STARTER THEMES -->
      <div>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; padding-bottom: 4px; border-bottom: 1px solid rgba(255,255,255,0.08);">
          <div style="font-size: 0.72rem; font-weight: 800; letter-spacing: 1px; color: #38bdf8; text-transform: uppercase;">🌟 Starter Themes</div>
          <span style="font-size: 0.62rem; color: rgba(255,255,255,0.5); font-weight: 700;">3 Included</span>
        </div>
        <div class="theme-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
          ${starterCards}
        </div>
      </div>

      <!-- PRO THEMES -->
      <div>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; padding-bottom: 4px; border-bottom: 1px solid rgba(255,255,255,0.08);">
          <div style="font-size: 0.72rem; font-weight: 800; letter-spacing: 1px; color: #c084fc; text-transform: uppercase;">⚡ Pro Themes</div>
          <span style="font-size: 0.62rem; color: rgba(255,255,255,0.5); font-weight: 700;">7 Professional Themes</span>
        </div>
        <div class="theme-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
          ${proCards}
        </div>
      </div>

      <!-- PREMIUM THEMES -->
      <div>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; padding-bottom: 4px; border-bottom: 1px solid rgba(255,255,255,0.08);">
          <div style="font-size: 0.72rem; font-weight: 800; letter-spacing: 1px; color: #34d399; text-transform: uppercase;">👑 Premium Themes</div>
          <span style="font-size: 0.62rem; color: rgba(255,255,255,0.5); font-weight: 700;">5 Exclusive Themes</span>
        </div>
        <div class="theme-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
          ${premiumCards}
        </div>
      </div>
    </div>
  `;
}

window.getCurrentPortfolioTheme = function() {
  return portfolioData?.theme || 'minimal';
};
window.portfolioData = portfolioData;

window.previewTheme = function(id) {
  const theme = getThemeById(id);
  if (!theme) return;
  engine?.applyTheme(theme);
  sceneDirector?.setTheme(theme);
  showToast('info', '👁️', `Previewing ${theme.name} (Temporary 3D Preview). Upgrade to apply permanently.`);
};


window.selectTheme = function(id) {
  const userTier = globalEntitlements.getThemeTier();
  const requiredTier = getThemeTier(id);
  const isAllowed = canAccessTheme(userTier, id);

  if (!isAllowed) {
    window.previewTheme(id);
    return;
  }
  const theme = getThemeById(id);
  if (!theme) return;
  currentTheme = theme;
  portfolioData.theme = id;
  engine?.applyTheme(theme);
  sceneDirector?.setTheme(theme);
  updateHUD();
  buildThemeGrid();
  showToast('success', theme.emoji, `${theme.name} World activated!`);
  autoSave();
};


// ─── PRESETS ────────────────────────────────
window.loadPreset = function(key) {
  const preset = PRESETS[key];
  if (!preset) return;
  Object.assign(portfolioData, preset);

  // Update all inputs
  [['f-name','name'],['f-tagline','tagline'],['f-profession','profession'],
   ['f-bio','bio'],['f-location','location'],['f-contact','contactMessage']
  ].forEach(([id, k]) => {
    const el = document.getElementById(id);
    if (el) el.value = portfolioData[k] || '';
  });
  ['github','linkedin','twitter','email','website'].forEach(s => {
    const el = document.getElementById(`f-${s}`);
    if (el) el.value = portfolioData.social[s] || '';
  });

  // Apply theme
  const theme = getThemeById(preset.theme);
  currentTheme = theme;
  engine?.applyTheme(theme);
  updateHUD();
  buildThemeGrid();
  renderSkills();
  renderProjects();
  engine?.explode();

  showToast('success', theme.emoji, `${preset.profession} preset loaded!`);
  autoSave();
};

// ─── RANDOMIZE ───────────────────────────────
window.randomize3D = function() {
  const themes = getAllThemes();
  const random = themes[Math.floor(Math.random() * themes.length)];
  currentTheme = random;
  portfolioData.theme = random.id;
  engine?.applyTheme(random);
  engine?.explode();
  updateHUD();
  buildThemeGrid();
  showToast('success', random.emoji, `🎲 Randomized to ${random.name}!`);
};

// ─── SECTION NAV ─────────────────────────────
window.flyToSection = function(section) {
  activeSection = section;
  const viewport = document.getElementById('preview-scroll-viewport');
  if (viewport) {
    const targetEl = viewport.querySelector('#sec-' + section) || viewport.querySelector('#' + section);
    if (targetEl) {
      targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
  engine?.flyTo(section);
};

// ─── FULLSCREEN ──────────────────────────────
window.toggleFullscreen = function() {
  if (!document.fullscreenElement) {
    document.getElementById('preview-panel')?.requestFullscreen();
  } else {
    document.exitFullscreen();
  }
};

// ─── EXPORT ──────────────────────────────────
window.exportHTML = async function() {
  if (!currentTheme) return;

  const monthKey = new Date().toISOString().slice(0, 7);
  const exportUsage = portfolioData.exportUsage || { month: monthKey, count: 0 };
  const currentMonthExports = exportUsage.month === monthKey ? Number(exportUsage.count || 0) : 0;
  if (!globalUsageLimit.canExportHTML(currentMonthExports)) {
    showToast('error', '🔒', 'Free plan includes 1 HTML export per month. Upgrade to Pro for unlimited exports.');
    handleUpgradeClick();
    return;
  }

  showToast('info', '⏳', 'Generating your 3D portfolio...');
  try {
    const { consumeExportAllowance } = await import('./services/DBService.js');
    const allowance = await consumeExportAllowance(portfolioData);
    if (!allowance.success) {
      showToast('error', '🔒', allowance.error || 'Export limit reached.');
      if (!isPro()) handleUpgradeClick();
      return;
    }
    await exportStandaloneHTML(portfolioData, currentTheme);
    portfolioData.exportUsage = allowance.usage || { month: monthKey, count: currentMonthExports + 1 };
    autoSave();
    // Celebrate! 🎉
    confetti({
      particleCount: 200,
      spread: 100,
      origin: { y: 0.5 },
      colors: ['#7c3aed', '#06b6d4', '#f59e0b', '#10b981'],
      ticks: 300
    });
    engine?.explode();
    showToast('success', '🎉', 'Your 3D portfolio is ready! Check your downloads.');
    await createPortfolio({ ...portfolioData, themeId: currentTheme.id });
    renderSaved();
  } catch (e) {
    showToast('error', '❌', 'Export failed. Please try again.');
    console.error(e);
  }
};

// ─── SHARE ───────────────────────────────────
window.copyShareableLink = async function() {
  const url = await generateShareableURL(portfolioData);
  if (!url) return;
  try {
    await navigator.clipboard.writeText(url);
    showToast('success', '✅', 'Shareable link copied to clipboard!');
  } catch {
    // Fallback
    const ta = document.createElement('textarea');
    ta.value = url;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    showToast('success', '✅', 'Link copied!');
  }
};

// ─── SAVE/LOAD ───────────────────────────────
window.saveToDB = async function() {
  await createPortfolio({ ...portfolioData, themeId: currentTheme?.id });
  renderSaved();
  showToast('success', '💾', 'Portfolio saved successfully!');
};

let lastClearedBackup = null;

window.clearAll = function() {
  if (!confirm('Clear all data and start fresh?')) return;
  lastClearedBackup = JSON.parse(JSON.stringify(portfolioData));
  portfolioData = {
    name:'',tagline:'',profession:'',bio:'',location:'',avatar:'',
    social:{github:'',linkedin:'',twitter:'',email:'',website:''},
    skills:[],projects:[],experience:[],education:[],certs:[],
    contactMessage:"I'm always open to new opportunities.",
    theme:'cosmic',customColors:null
  };
  document.querySelectorAll('input,textarea').forEach(el => el.value = '');
  renderSkills();
  renderProjects();
  renderExperience();
  renderEducation();
  renderCerts();
  const theme = getThemeById('cosmic');
  currentTheme = theme;
  engine?.applyTheme(theme);
  updateHUD();
  buildThemeGrid();
  showToast('info', '🗑️', 'Cleared! <button onclick="window.restoreClearedPortfolio()" style="background:none;border:none;color:#06b6d4;font-weight:700;cursor:pointer;text-decoration:underline;margin-left:6px">Undo</button>');
};

window.restoreClearedPortfolio = function() {
  if (!lastClearedBackup) return;
  portfolioData = JSON.parse(JSON.stringify(lastClearedBackup));
  renderAll();
  updateHUD();
  autoSave();
  showToast('success', '✨', 'Portfolio content restored!');
};

function autoSave() {
  savePortfolioDebounced(portfolioData, (statusText) => {
    const saveIndicator = document.getElementById('save-status-indicator');
    if (saveIndicator) {
      saveIndicator.textContent = statusText;
      saveIndicator.style.color = statusText === 'Saved' ? '#10b981' : statusText.includes('Offline') ? '#f59e0b' : '#3b82f6';
    }
  });
}

function renderSaved() {
  const el = document.getElementById('saved-list');
  if (!el) return;
  const all = getAllPortfolios();
  if (all.length === 0) {
    el.innerHTML = `<div style="font-size:0.8rem;color:var(--text-dim);text-align:center;padding:12px">No saved portfolios yet.</div>`;
    return;
  }
  el.innerHTML = all.slice(-5).reverse().map(p => `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-sm)">
      <div>
        <div style="font-size:0.82rem;font-weight:600">${p.name || 'Unnamed'}</div>
        <div style="font-size:0.68rem;color:var(--text-dim)">${p.profession || ''} · ${new Date(p.createdAt).toLocaleDateString()}</div>
      </div>
      <span style="font-size:0.65rem;color:var(--primary);font-family:'JetBrains Mono',monospace">${p.id.slice(0,8)}</span>
    </div>
  `).join('');
}

// ─── LOGOUT & UPGRADE ───────────────────────
window.handleLogout = function() {
  if (confirm('Sign out of the Studio?')) {
    logout();
    router();
  }
};

window.handleUpgradeClick = async function(targetPlanId = null) {
  const user = await getCurrentAuthUser().catch(() => null);
  openBillingModal({
    currentUserId: user?.id,
    targetPlan: targetPlanId,
    onSubscriptionUpdated: () => {
      refreshStudioEntitlements({ notify: true });
    }
  });
};

if (typeof document !== 'undefined') {
  document.addEventListener('click', (e) => {
    const chip = e.target.closest('#tier-chip, .tier-chip, [data-action="open-billing"]');
    if (chip) {
      e.stopPropagation();
      window.handleUpgradeClick();
    }
  });

  document.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target && (e.target.id === 'tier-chip' || e.target.classList?.contains('tier-chip'))) {
      e.preventDefault();
      window.handleUpgradeClick();
    }
  });
}

// ─── ADMIN DASHBOARD ─────────────────────────
window.openAdmin = async function() {
  if (!(await isAdmin())) {
    showToast('error', '🔒', 'This account does not have administrator access.');
    return;
  }
  window.location.href = '/admin';
  return;
  const modal = document.getElementById('admin-modal');
  const body = document.getElementById('admin-body');
  const stats = getAnalytics();
  modal.style.display = 'flex';

  const profs = Object.entries(stats.profession_breakdown || {}).sort((a,b)=>b[1]-a[1]);
  const maxProf = Math.max(...profs.map(p=>p[1]), 1);

  body.innerHTML = `
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-num">${stats.total_portfolios}</div>
        <div class="stat-label">Total Portfolios</div>
      </div>
      <div class="stat-card">
        <div class="stat-num">${stats.total_exports}</div>
        <div class="stat-label">Exports</div>
      </div>
      <div class="stat-card">
        <div class="stat-num">${stats.total_shares}</div>
        <div class="stat-label">Shares</div>
      </div>
      <div class="stat-card">
        <div class="stat-num">${(stats.tier_breakdown?.pro || 0)}</div>
        <div class="stat-label">Pro Users</div>
      </div>
    </div>
    ${profs.length > 0 ? `
      <div>
        <div class="section-label">Top Professions</div>
        <div class="prof-list" style="margin-top:12px">
          ${profs.slice(0,6).map(([k,v]) => `
            <div class="prof-row">
              <span style="min-width:120px;font-size:0.78rem;text-transform:capitalize">${k.replace(/_/g,' ')}</span>
              <div class="prof-bar-bg"><div class="prof-bar" style="width:${(v/maxProf)*100}%"></div></div>
              <span style="min-width:24px;text-align:right;font-size:0.78rem;color:var(--primary);font-family:'JetBrains Mono',monospace">${v}</span>
            </div>
          `).join('')}
        </div>
      </div>
    ` : ''}
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:4px">
      <button class="btn btn-secondary" onclick="upgradeToPro()">💎 Upgrade to Pro</button>
      <button class="btn btn-secondary" onclick="closeAdmin()">Close</button>
    </div>
    ${stats.last_activity ? `<div style="font-size:0.68rem;color:var(--text-dim);text-align:center">Last activity: ${new Date(stats.last_activity).toLocaleString()}</div>` : ''}
  `;
};

window.closeAdmin = function() {
  document.getElementById('admin-modal').style.display = 'none';
};

window.upgradeToPro = function() {
  closeAdmin();
  openBillingModal();
  return;
  upgradeToPro();
  document.getElementById('tier-chip').textContent = '💎 PRO';
  document.getElementById('tier-chip').className = 'tier-chip tier-pro';
  buildThemeGrid();
  closeAdmin();
  showToast('success', '💎', 'Pro tier activated! All 11 themes unlocked!');
};

// ─── TOAST ──────────────────────────────────
function showToast(type, icon, message) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span class="toast-icon">${icon}</span><span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.transition = 'all 0.4s';
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(30px)';
    setTimeout(() => toast.remove(), 400);
  }, 3500);
}

window.showToast = showToast;
window.openBillingModal = openBillingModal;

// ─── ENGINE GLOBAL WRAPPERS (for inline onclick) ────────────
window.engineBurst = () => engine?.explode();
window.engineZoomIn = () => engine?.zoomIn();
window.engineZoomOut = () => engine?.zoomOut();

// ─── START ──────────────────────────────────
init();

