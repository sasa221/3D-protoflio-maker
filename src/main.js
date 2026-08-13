/**
 * main.js - Ultra 3D Portfolio Maker (Studio App)
 */

import './index.css';
import { renderAuthPage, renderResetPasswordPage } from './AuthPage.js';
import { renderAdminPage } from './AdminPage.js';
import { isLoggedIn, getCurrentUser, getCurrentAuthUser, isPro, logout, upgradeToPro, isAdmin, redeemPromoCode, subscribeToAuthStateChange } from './services/AuthService.js';
import { HyperEngine } from './three/HyperEngine.js';
import { classifyProfession, getThemeById, getAllThemes } from './three/ProceduralTheme.js';
import { exportStandaloneHTML, generateShareableURL } from './exporter/PortfolioExporter.js';
import { generatePortfolioCSS, generatePortfolioHTMLBody } from './renderer/PortfolioRenderer.js';
import { SceneDirector } from './three/SceneDirector.js';
import { ScrollDirector } from './three/ScrollDirector.js';
import { IntroDirector } from './three/IntroDirector.js';
import { initMobileNavigationController, toggleMobileMenu } from './renderer/MobileNavigationController.js';
import { deployToNetlify, getDeployedSites, isNetlifyConfigured } from './services/DeployService.js';
import {
  createPortfolio, getAllPortfolios,
  getAnalytics, saveDraft, getCurrentDraft, incrementStat,
  encodePortfolioToURL, savePortfolioDebounced,
  loadUserPortfoliosFromSupabase, fetchUserProfileAndEntitlements
} from './services/DBService.js';
import { runSupabaseCutoverTestSuite } from './tests/SupabaseCutoverTestSuite.js';
import { uploadAvatar, uploadResume, uploadProjectMedia, getResumeAccessUrl, deleteAsset } from './services/AssetStorageService.js';
import { initCVImportModal, openCVImportModal } from './ui/CVImportModal.js';
import { mapCVToPortfolioData } from './services/CVPortfolioMapper.js';
import { runCVParserTestSuite } from './tests/CVParserFixtures.js';
import { renderJobTargetPanel } from './ui/JobTargetPanel.js';
import { runJobTargetingTestSuite } from './tests/JobMatcherFixtures.js';
import { resolvePortfolioVariant } from './services/PortfolioVariantService.js';
import { renderPortfolioVariantManager } from './ui/PortfolioVariantManager.js';
import { runPortfolioVariantsTestSuite } from './tests/VariantResolverFixtures.js';
import { renderAnalyticsDashboard } from './ui/AnalyticsDashboard.js';
import { runAnalyticsTestSuite } from './tests/AnalyticsTestSuite.js';
import { initPublicPortfolioAnalytics } from './services/AnalyticsService.js';
import { openBillingModal } from './ui/BillingModal.js';
import { renderCustomDomainPanel } from './ui/CustomDomainPanel.js';
import { runMonetizationTestSuite } from './tests/MonetizationTestSuite.js';
import { renderProductionReadinessPanel } from './ui/ProductionReadinessPanel.js';
import { runProductionSecurityTestSuite } from './tests/ProductionSecurityTestSuite.js';
import { runProductionLaunchTestSuite } from './tests/ProductionLaunchTestSuite.js';
import confetti from 'canvas-confetti';

// ─── STATE ─────────────────────────────────
let engine = null;
let sceneDirector = null;
let scrollDirector = null;
let introDirector = null;
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
      window.location.href = '/studio';
    });
    return;
  }

  // 7. Studio App Route
  if (path === '/studio') {
    setPageTitle('Creator Studio');
    const authUser = await getCurrentAuthUser();
    if (!authUser || authUser.id === 'usr_guest') {
      window.location.href = '/login';
      return;
    }
    initStudio();
    return;
  }

  // Fallback to Landing Page
  renderLandingPage(getAppContainer());
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
    const { data: pf, error } = await supabase
      .from('portfolios')
      .select('*')
      .eq('slug', username.trim().toLowerCase())
      .single();

    if (error || !pf) {
      render404Page(username);
      return;
    }

    let masterJson = pf.master_profile_json || {};
    let masterData = masterJson.publishedProfile || masterJson;
    masterData.id = pf.id;
    let activeData = masterData;

    if (variantSlug) {
      const { data: variants } = await supabase
        .from('portfolio_variants')
        .select('*')
        .eq('portfolio_id', pf.id)
        .eq('slug', variantSlug.trim().toLowerCase());

      if (!variants || variants.length === 0) {
        render404Page(`${username}/${variantSlug}`);
        return;
      }

      const variant = variants[0];
      const overrides = variant.overrides_json || {};
      activeData = resolvePortfolioVariant(masterData, overrides);
    }

    const theme = getThemeById(activeData.theme || 'code');
    const html = generatePortfolioHTMLBody(activeData, theme);

    document.body.innerHTML = `
      <div id="canvas-container"><canvas id="bg-canvas"></canvas></div>
      <div id="app" style="overflow-y:auto;position:relative;z-index:10">${html}</div>
    `;

    const canvas = document.getElementById('bg-canvas');
    engine = new HyperEngine(canvas);
    engine.init(theme);

    // Initialize Real Analytics Tracking for Public Visitors
    initPublicPortfolioAnalytics(pf.id, variantSlug || 'general');

  } catch (e) {
    render404Page(username);
  }
}

function render404Page(target) {
  document.body.innerHTML = `
    <div style="min-height:100vh;background:#050508;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;font-family:'Inter',sans-serif;text-align:center;padding:20px">
      <div style="font-size:4rem;margin-bottom:16px">🔍</div>
      <h1 style="font-size:2.2rem;font-weight:900;margin-bottom:8px;background:linear-gradient(135deg,#7c3aed,#06b6d4);-webkit-background-clip:text;-webkit-text-fill-color:transparent">
        404 — Portfolio Not Found
      </h1>
      <p style="color:rgba(255,255,255,0.6);max-width:460px;margin-bottom:24px;line-height:1.6">
        We couldn't find a published portfolio for <code style="background:rgba(255,255,255,0.1);padding:2px 8px;border-radius:6px;color:#a855f7">${target}</code>.
      </p>
      <a href="/" style="padding:12px 24px;background:#7c3aed;color:#fff;border-radius:10px;text-decoration:none;font-weight:700">⚡ Build Your 3D Portfolio</a>
    </div>
  `;
}

// ─── INIT ───────────────────────────────────
function init() {
  router();

  subscribeToAuthStateChange((event) => {
    if (event === 'PASSWORD_RECOVERY') {
      setPageTitle('Set New Password');
      renderResetPasswordPage(() => {
        window.location.href = '/login';
      });
    }
  });
}

async function initStudio() {
  buildHTML();
  
  try {
    const authUser = await getCurrentAuthUser();
    if (authUser) {
      await fetchUserProfileAndEntitlements(authUser);
      const cloudPortfolio = await loadUserPortfoliosFromSupabase(authUser);
      if (cloudPortfolio) {
        Object.assign(portfolioData, cloudPortfolio);
      }
    }
  } catch (e) {
    console.warn('Supabase studio init warning:', e.message);
  }

  renderAll();
  initEngine();
  bindEvents();
  renderWorkspaceHeader();
  renderFirstRunChecklist(document.body, portfolioData);
  showToast('info', '⚡', 'Studio Ready! Synced with Supabase Postgres.');
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
      <div class="tier-chip ${isPro() ? 'tier-pro' : 'tier-free'}" id="tier-chip" onclick="handleUpgradeClick()" style="cursor:pointer">
        ${isPro() ? '💎 PRO' : '🆓 FREE'}
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

        <div class="section-label">Your Profile Photo</div>
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
                <button onclick="changeAvatarZoom(-0.15)" style="background:rgba(255,255,255,0.1);border:none;color:#fff;border-radius:50%;width:28px;height:28px;font-size:16px;font-weight:bold;cursor:pointer;display:flex;align-items:center;justify-content:center" title="تصغير">➖</button>
                <span style="font-size:0.8rem;font-weight:700;color:var(--primary);min-width:45px;text-align:center">${Math.round((portfolioData.avatarZoom || 1) * 100)}%</span>
                <button onclick="changeAvatarZoom(0.15)" style="background:rgba(255,255,255,0.1);border:none;color:#fff;border-radius:50%;width:28px;height:28px;font-size:16px;font-weight:bold;cursor:pointer;display:flex;align-items:center;justify-content:center" title="تكبير">➕</button>
              </div>

              <div style="display:flex;gap:10px;margin-top:4px">
                <label style="background:rgba(124,58,237,0.2);border:1px solid rgba(124,58,237,0.4);border-radius:8px;padding:6px 14px;color:#fff;font-size:0.75rem;font-weight:700;cursor:pointer">
                  🔄 تغيير الصورة
                  <input type="file" accept="image/*" style="display:none" onchange="uploadUserAvatar(this)"/>
                </label>
                <button onclick="updateUserAvatar('');renderAll();" style="background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.3);border-radius:8px;padding:6px 14px;color:#ef4444;font-size:0.75rem;font-weight:700;cursor:pointer">إزالة ✕</button>
              </div>
            </div>
          ` : `
            <label style="cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:8px">
              <div style="font-size:2.4rem">📷</div>
              <div style="font-size:0.95rem;font-weight:800;color:#fff">إضافة صورتك الشخصية (Profile Photo)</div>
              <div style="font-size:0.75rem;color:rgba(255,255,255,0.5)">انقر هنا لاختيار صورة من جهازك أونلاين</div>
              <span style="margin-top:6px;padding:8px 20px;background:linear-gradient(135deg,var(--primary),var(--secondary));border-radius:20px;font-size:0.8rem;font-weight:800;color:#fff">📁 اختر صورة الآن</span>
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
        <div class="section-label">3D Theme World</div>
        <div class="theme-grid" id="theme-grid"></div>

        <div class="section-label" style="margin-top:8px">Camera & Animation Speed</div>
        <div class="field-group">
          <label class="field-label">Particle Count <span id="particle-val" style="color:var(--primary)"></span></label>
          <input type="range" class="range-input" id="r-particles" min="500" max="6000" step="100" value="3000"/>
        </div>
        <div class="field-group">
          <label class="field-label">Camera Sensitivity</label>
          <input type="range" class="range-input" id="r-camera" min="1" max="10" step="1" value="5"/>
        </div>
        <div class="field-group">
          <label class="field-label">Glow Intensity</label>
          <input type="range" class="range-input" id="r-glow" min="1" max="10" step="1" value="5"/>
        </div>
      </div>

      <!-- PUBLISH TAB -->
      <div class="tab-panel" id="panel-publish">
        <div class="section-label">Publish Your Portfolio</div>
        <div id="publish-panel-content"></div>
      </div>
    </div>

    <!-- FOOTER ACTIONS -->
    <div class="sidebar-footer">
      <button class="btn btn-primary" onclick="exportHTML()">
        🚀 Export 3D Portfolio
      </button>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <button class="btn btn-secondary" onclick="saveToDB()">💾 Save Draft</button>
        <button class="btn btn-secondary" onclick="clearAll()">🗑️ Clear All</button>
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
      <span class="modal-title">✂️ تعديل وضبط صورة البروفايل</span>
      <button class="modal-close" onclick="closeAvatarCropper()">✕</button>
    </div>
    <div class="modal-body" style="display:flex;flex-direction:column;align-items:center;padding:24px">
      <div style="font-size:0.8rem;color:rgba(255,255,255,0.6);margin-bottom:16px">حرك وسجل الصورة وتأكد من ضبط وجهك في منتصف الدائرة الـ 3D:</div>
      
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
        <div style="font-size:0.75rem;font-weight:700;color:var(--primary);margin-bottom:10px">🔍 تكبير وتصغير (Zoom)</div>
        <div style="display:flex;align-items:center;justify-content:center;gap:12px;margin-bottom:16px">
          <button onclick="adjustCropZoom(-0.15)" class="btn btn-secondary" style="padding:6px 16px;font-size:1rem;font-weight:bold">➖</button>
          <span id="crop-zoom-label" style="font-size:0.9rem;font-weight:900;color:#fff;min-width:60px">100%</span>
          <button onclick="adjustCropZoom(0.15)" class="btn btn-secondary" style="padding:6px 16px;font-size:1rem;font-weight:bold">➕</button>
        </div>

        <div style="font-size:0.75rem;font-weight:700;color:var(--primary);margin-bottom:10px">🎯 ضبط موقع الوجه (Position)</div>
        <div style="display:grid;grid-template-columns:repeat(3, 45px);gap:8px;justify-content:center">
          <div></div>
          <button onclick="adjustCropPos(0, -10)" class="btn btn-secondary" style="padding:8px">⬆️</button>
          <div></div>
          <button onclick="adjustCropPos(-10, 0)" class="btn btn-secondary" style="padding:8px">⬅️</button>
          <button onclick="resetCropPos()" class="btn btn-secondary" style="padding:6px;font-size:0.7rem" title="إعادة التمركز">🎯</button>
          <button onclick="adjustCropPos(10, 0)" class="btn btn-secondary" style="padding:8px">➡️</button>
          <div></div>
          <button onclick="adjustCropPos(0, 10)" class="btn btn-secondary" style="padding:8px">⬇️</button>
          <div></div>
        </div>
      </div>

      <button class="btn btn-primary" onclick="saveAvatarCrop()" style="width:100%;padding:12px;font-size:0.95rem;font-weight:800">
        ✅ اعتماد وتطبيق على الـ 3D Portfolio
      </button>
    </div>
  </div>
</div>
`;
}

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
  engine = new HyperEngine(canvas);
  const theme = classifyProfession(portfolioData.profession);
  currentTheme = theme;
  engine.init(theme);

  // Initialize Cinematic SceneDirector & ScrollDirector
  sceneDirector = new SceneDirector(engine);
  sceneDirector.setTheme(theme);

  // Setup ResizeObserver for responsive preview scaling
  setupPreviewResizeObserver();

  // Set default Desktop (1440x900) Virtual Viewport mode & scale
  setPreviewMode('desktop');
  requestAnimationFrame(updatePreviewScale);

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
  window.openBillingModal = () => openBillingModal('user_saleh_123', () => renderAll());

  // Only run test suites in development environment or explicit debug query flag
  if (import.meta.env.DEV || window.location.search.includes('run_tests=true')) {
    runCVParserTestSuite().catch(err => console.warn('[CV Test Suite] error:', err));
    try {
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
  
  if (id === 'publish') renderPublishTab();
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
    showToast('error', '⚠️', 'حجم الصورة كبير جداً، برجاء اختيار صورة أقل من 4 ميجابايت');
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
    // Fill background
    ctx.clearRect(0, 0, size, size);

    // Apply Transformations matching user's crop selections exactly
    ctx.save();

    // Clip to smooth HD circle
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();

    // Center matrix calculations
    const scale = tempCropState.zoom;
    const dx = (tempCropState.posX / 180) * size;
    const dy = (tempCropState.posY / 180) * size;

    ctx.translate(size / 2 + dx, size / 2 + dy);
    ctx.scale(scale, scale);

    // Calculate aspect ratio cover fit
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
      showToast('info', '⏳', 'Uploading avatar to Supabase Storage...');
      try {
        const authUser = await getCurrentAuthUser();
        const userId = authUser?.id || 'usr_guest';
        const portfolioId = portfolioData.id || 'pf_default';

        const file = new File([blob], 'avatar.webp', { type: 'image/webp' });
        const avatarMeta = await uploadAvatar(file, userId, portfolioId);

        portfolioData.avatar = avatarMeta;
        portfolioData.avatarZoom = 1;
        portfolioData.avatarPosX = 0;
        portfolioData.avatarPosY = 0;

        window.closeAvatarCropper();
        renderAll();
        showToast('success', '👤', 'Avatar uploaded to Supabase Storage!');
        autoSave();
      } catch (err) {
        showToast('error', '❌', `Avatar upload failed: ${err.message}`);
      } finally {
        isAvatarUploading = false;
        if (saveBtn) {
          saveBtn.disabled = false;
          saveBtn.textContent = '💾 حفظ وتطبيق الصورة';
        }
      }
    }, 'image/webp', 0.95);
    ctx.restore();
  };
  img.onerror = function() {
    isAvatarUploading = false;
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = '💾 حفظ وتطبيق الصورة';
    }
    showToast('error', '❌', 'Failed to load avatar image for cropping.');
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
function renderPublishTab() {
  const el = document.getElementById('publish-panel-content');
  if (!el) return;
  const pro = isPro();

  if (!pro) {
    // FREE TIER UI
    el.innerHTML = `
      <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:16px;padding:18px;margin-bottom:14px">
        <div style="font-size:0.72rem;font-weight:700;color:rgba(255,255,255,0.35);letter-spacing:1.5px;text-transform:uppercase;margin-bottom:10px">🆓 الخطة المجانية</div>
        <div style="font-size:0.8rem;color:rgba(255,255,255,0.55);line-height:1.6;margin-bottom:14px">
          تنزيل ملف HTML كامل على جهازك رفعه يدويًا.<br/>
          <span style="color:rgba(239,68,68,0.8);font-size:0.75rem">⚠️ يحتوي على العلامة المائية "Built with Ultra 3D Portfolio"</span>
        </div>
        <button class="btn btn-secondary" onclick="exportHTML()" style="width:100%;margin-bottom:8px">📦 تنزيل ملف HTML</button>
        <button class="btn btn-share" onclick="copyShareableLink()" style="width:100%">🔗 نسخ رابط السريع</button>
      </div>

      <!-- IRRESISTIBLE PRO PROMO CARD -->
      <div style="background:linear-gradient(135deg,rgba(124,58,237,0.18),rgba(6,182,212,0.12));border:1px solid rgba(124,58,237,0.35);border-radius:18px;padding:22px;text-align:center;position:relative;overflow:hidden">
        <div style="position:absolute;top:10px;right:10px;background:#ef4444;color:#fff;font-size:0.65rem;font-weight:900;padding:4px 10px;border-radius:20px;letter-spacing:1px;text-transform:uppercase">🔥 خصم 60% لفترة محدودة</div>
        <div style="font-size:2.2rem;margin-bottom:6px;margin-top:10px">👑</div>
        <div style="font-size:1.1rem;font-weight:900;margin-bottom:4px;background:linear-gradient(135deg,#7c3aed,#06b6d4);-webkit-background-clip:text;-webkit-text-fill-color:transparent">الترقية إلى خطة Pro المميزة</div>
        
        <div style="margin:10px 0 16px;display:flex;align-items:center;justify-content:center;gap:10px">
          <span style="text-decoration:line-through;color:rgba(255,255,255,0.35);font-size:1rem;font-weight:700">500 ج.م</span>
          <span style="font-size:1.6rem;font-weight:900;color:#10b981;font-family:'JetBrains Mono',monospace">200 ج.م</span>
          <span style="font-size:0.75rem;color:rgba(255,255,255,0.4)">/ مدى الحياة</span>
        </div>

        <div style="display:flex;flex-direction:column;gap:8px;text-align:left;background:rgba(0,0,0,0.2);padding:14px;border-radius:12px;margin-bottom:16px;font-size:0.78rem">
          <div style="color:#10b981;font-weight:700">🚀 رفع تلقائي أوتوماتيك بنقرة واحدة ورابط حي</div>
          <div style="color:#10b981;font-weight:700">🚫 إزالة العلامة المائية باسم موقعك 100%</div>
          <div style="color:#10b981;font-weight:700">🎨 إخفاء وتخصيص شارة الثيم حسب رغبتك</div>
          <div style="color:#10b981;font-weight:700">💎 فتح جميع العوالم الـ 11 3D وبدون أي قيود</div>
        </div>

        <button class="btn btn-primary" onclick="handleUpgradeClick()" style="width:100%;padding:14px;font-size:0.95rem;font-weight:800">
          💬 اشترك الآن بـ 200 ج.م عبر InstaPay
        </button>
      </div>`;
  } else {
    // PRO TIER UI WITH WATERMARK TOGGLE
    const deployedSites = getDeployedSites();
    el.innerHTML = `
      <div style="background:rgba(16,185,129,0.06);border:1px solid rgba(16,185,129,0.25);border-radius:16px;padding:16px;margin-bottom:14px">
        <div style="font-size:0.75rem;font-weight:800;color:#10b981;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:12px">💎 Pro Branding Options</div>
        
        <label style="display:flex;align-items:center;justify-content:space-between;font-size:0.8rem;color:rgba(255,255,255,0.8);cursor:pointer;margin-bottom:10px">
          <span>🚫 إزالة العلامة المائية (Watermark)</span>
          <input type="checkbox" id="chk-hide-watermark" ${portfolioData.hideWatermark ? 'checked' : ''} onchange="toggleProBranding('hideWatermark', this.checked)"/>
        </label>
        
        <label style="display:flex;align-items:center;justify-content:space-between;font-size:0.8rem;color:rgba(255,255,255,0.8);cursor:pointer">
          <span>🎨 إخفاء شارة الثيم الـ 3D (Theme Badge)</span>
          <input type="checkbox" id="chk-hide-theme" ${portfolioData.hideThemeBadge ? 'checked' : ''} onchange="toggleProBranding('hideThemeBadge', this.checked)"/>
        </label>
      </div>

      <div style="background:linear-gradient(135deg,rgba(124,58,237,0.1),rgba(6,182,212,0.08));border:1px solid rgba(124,58,237,0.25);border-radius:16px;padding:24px;text-align:center;margin-bottom:14px">
        <div style="font-size:2.5rem;margin-bottom:10px">🚀</div>
        <div style="font-size:1rem;font-weight:800;margin-bottom:6px">Auto-Deploy Live</div>
        <div style="font-size:0.78rem;color:rgba(255,255,255,0.45);margin-bottom:20px;line-height:1.6">
          نعالج ونستضيف موقعك الـ 3D أوتوماتيكياً.<br/>
          تحصل على رابط حي فوراً بدون أي خطوات يدويّة.
        </div>
        <div id="deploy-progress" style="display:none;margin-bottom:16px">
          <div style="height:4px;background:rgba(255,255,255,0.06);border-radius:4px;overflow:hidden;margin-bottom:8px">
            <div id="deploy-progress-bar" style="height:100%;width:0%;background:linear-gradient(90deg,#7c3aed,#06b6d4);border-radius:4px;transition:width 0.6s ease"></div>
          </div>
          <div id="deploy-progress-msg" style="font-size:0.78rem;color:rgba(124,58,237,0.8)">Preparing...</div>
        </div>
        <div id="deploy-result" style="display:none;margin-bottom:16px">
          <div style="font-size:0.7rem;color:rgba(255,255,255,0.3);letter-spacing:1.5px;text-transform:uppercase;margin-bottom:8px">🌐 Your Live URL</div>
          <div id="deploy-url-box" style="background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.2);border-radius:10px;padding:12px;font-family:'JetBrains Mono',monospace;font-size:0.76rem;color:#10b981;word-break:break-all;cursor:pointer;transition:all 0.3s" onclick="copyDeployUrl()" title="Click to copy"></div>
          <div style="font-size:0.68rem;color:rgba(255,255,255,0.2);margin-top:6px">Click to copy · <a id="deploy-open-link" href="#" target="_blank" style="color:rgba(124,58,237,0.7)">Open in new tab →</a></div>
        </div>
        <div style="display:flex;flex-direction:column;gap:8px">
          <button id="deploy-btn" class="btn btn-primary" onclick="deployLive()" style="width:100%">⚡ Deploy My Portfolio Live</button>
          <button class="btn btn-secondary" onclick="copyShareableLink()" style="width:100%">🔗 Copy Instant Share Link</button>
          <button class="btn btn-secondary" onclick="exportHTML()" style="width:100%">📦 Download HTML (Backup)</button>
        </div>
      </div>`;
  }
}

window.toggleProBranding = function(prop, val) {
  portfolioData[prop] = val;
  portfolioData.isPro = isPro();
  autoSave();
  showToast('info', '⚙️', 'تحديث خيارات العلامة المائية بنجاح!');
};

// ─── DEPLOY LIVE (PRO) ────────────────────────
let currentDeployUrl = '';
window.deployLive = async function() {
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
  el.innerHTML = portfolioData.skills.map((s, i) => `
    <div class="skill-row" id="skill-${i}">
      <input value="${s.name || ''}" placeholder="Skill name..." oninput="updateSkill(${i},'name',this.value)"/>
      <input class="skill-level-input" type="number" min="0" max="100" value="${s.level || 80}" oninput="updateSkill(${i},'level',parseInt(this.value)||0)"/>
      <button class="del-btn" onclick="removeSkill(${i})">✕</button>
    </div>
  `).join('');
}

window.addSkill = function() {
  portfolioData.skills.push({ name: '', level: 80 });
  renderSkills();
  autoSave();
};
window.addSkill = function() {
  portfolioData.skills.push({ name: '', level: 80 });
  renderSkills();
  updateHUD();
  flyToSection('skills');
  autoSave();
};
window.updateSkill = function(i, key, val) {
  portfolioData.skills[i][key] = val;
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

  el.innerHTML = portfolioData.experience.map((exp, i) => `
    <div class="experience-item" style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:16px;margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <span style="font-size:0.78rem;font-weight:700;color:var(--primary)">Role 0${i+1}</span>
        <button onclick="removeExperience(${i})" style="background:none;border:none;color:#ef4444;cursor:pointer;font-weight:bold">✕ Remove</button>
      </div>
      <input class="field-input" value="${exp.role || ''}" placeholder="Job Title / Role (e.g. Senior Frontend Engineer)" oninput="updateExperience(${i},'role',this.value)" style="margin-bottom:8px;font-weight:700"/>
      <div style="display:flex;gap:8px;margin-bottom:8px">
        <input class="field-input" value="${exp.company || ''}" placeholder="Company Name" oninput="updateExperience(${i},'company',this.value)" style="flex:1"/>
        <input class="field-input" value="${exp.location || ''}" placeholder="Location (e.g. Cairo / Remote)" oninput="updateExperience(${i},'location',this.value)" style="flex:1"/>
      </div>
      <div style="display:flex;gap:8px;margin-bottom:8px;align-items:center">
        <input class="field-input" value="${exp.startDate || ''}" placeholder="Start Date (e.g. 2024)" oninput="updateExperience(${i},'startDate',this.value)" style="flex:1"/>
        <input class="field-input" value="${exp.endDate || ''}" placeholder="End Date (e.g. Present)" oninput="updateExperience(${i},'endDate',this.value)" style="flex:1" ${exp.current ? 'disabled' : ''}/>
        <label style="font-size:0.75rem;color:rgba(255,255,255,0.8);cursor:pointer;white-space:nowrap;display:flex;align-items:center;gap:4px">
          <input type="checkbox" ${exp.current ? 'checked' : ''} onchange="updateExperience(${i},'current',this.checked)"/> Current
        </label>
      </div>
      <textarea class="field-textarea" style="min-height:55px;margin-bottom:8px" placeholder="Role description & summary..." oninput="updateExperience(${i},'description',this.value)">${exp.description || ''}</textarea>
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

  el.innerHTML = portfolioData.education.map((edu, i) => `
    <div class="education-item" style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:16px;margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <span style="font-size:0.78rem;font-weight:700;color:var(--secondary)">Degree 0${i+1}</span>
        <button onclick="removeEducation(${i})" style="background:none;border:none;color:#ef4444;cursor:pointer;font-weight:bold">✕ Remove</button>
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
    const userId = authUser?.id || 'usr_guest';
    const portfolioId = portfolioData.id || 'pf_default';

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
function renderProjects() {
  const el = document.getElementById('projects-list');
  if (!el) return;
  el.innerHTML = portfolioData.projects.map((p, i) => `
    <div class="project-item" style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:16px;margin-bottom:12px">
      <div class="project-item-header" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <span class="project-num-badge" style="font-size:0.75rem;font-weight:700;color:var(--primary)">Project 0${i+1}</span>
        <button class="del-btn" onclick="removeProject(${i})" style="background:none;border:none;color:#ef4444;cursor:pointer">✕</button>
      </div>
      <input class="field-input" value="${p.name || ''}" placeholder="📌 اسم المشروع (e.g. AI E-Commerce App)" oninput="updateProject(${i},'name',this.value)" style="margin-bottom:8px;font-weight:700"/>
      <textarea class="field-textarea" style="min-height:55px;margin-bottom:8px" placeholder="📝 وصف عن المشروع ومميزاته..." oninput="updateProject(${i},'description',this.value)">${p.description || ''}</textarea>
      
      <!-- IMAGE UPLOADER SECTION -->
      <div style="margin-bottom:8px;display:flex;gap:8px;align-items:center">
        <input class="field-input" id="project-img-input-${i}" value="${p.image || ''}" placeholder="🖼️ رابط الصورة أو اختر من جهازك ←" oninput="updateProject(${i},'image',this.value)" style="flex:1"/>
        <label style="
          padding:9px 12px;background:rgba(124,58,237,0.15);border:1px solid rgba(124,58,237,0.3);
          border-radius:8px;color:#fff;font-size:0.78rem;font-weight:600;cursor:pointer;
          display:flex;align-items:center;gap:6px;white-space:nowrap;transition:all 0.2s;
        " onmouseover="this.style.background='rgba(124,58,237,0.25)'" onmouseout="this.style.background='rgba(124,58,237,0.15)'">
          📁 اختيار صورة
          <input type="file" accept="image/*" style="display:none" onchange="uploadProjectImage(${i}, this)"/>
        </label>
      </div>

      ${p.image ? `
        <div style="width:100%;height:90px;border-radius:8px;overflow:hidden;margin-bottom:8px;border:1px solid rgba(255,255,255,0.1);position:relative">
          <img src="${p.image}" style="width:100%;height:100%;object-fit:cover"/>
          <button onclick="updateProject(${i},'image','');renderProjects();updateHUD();" style="position:absolute;top:4px;right:4px;background:rgba(0,0,0,0.7);border:none;color:#fff;border-radius:50%;width:20px;height:20px;cursor:pointer;font-size:10px">✕</button>
        </div>
      ` : ''}

      <input class="field-input" value="${p.tech || ''}" placeholder="⚡ التقنيات (e.g. React · Node.js · MongoDB)" oninput="updateProject(${i},'tech',this.value)" style="margin-bottom:8px"/>
      
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
        <input class="field-input" value="${p.github || ''}" placeholder="💻 رابط GitHub Repo" oninput="updateProject(${i},'github',this.value)"/>
        <input class="field-input" value="${p.url || ''}" placeholder="🌐 رابط الموقع (Live Demo)" oninput="updateProject(${i},'url',this.value)"/>
      </div>

      <!-- ADVANCED CASE STUDY EXPANDABLE ACCORDION -->
      <details style="margin-top:8px;background:rgba(124,58,237,0.06);border:1px dashed rgba(124,58,237,0.3);border-radius:10px;padding:10px">
        <summary style="font-size:0.78rem;font-weight:700;color:var(--primary);cursor:pointer;user-select:none;display:flex;align-items:center;justify-content:space-between">
          <span>🎬 Advanced Case Study Details (Project Cinema)</span>
          <span style="font-size:0.68rem;opacity:0.7">Optional ✨</span>
        </summary>
        
        <div style="margin-top:10px;display:flex;flex-direction:column;gap:8px">
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px">
            <input class="field-input" value="${p.role || ''}" placeholder="👤 دورك (e.g. Lead Dev)" oninput="updateProject(${i},'role',this.value)"/>
            <input class="field-input" value="${p.duration || ''}" placeholder="⏱️ المدة (e.g. 3 Months)" oninput="updateProject(${i},'duration',this.value)"/>
            <input class="field-input" value="${p.team || ''}" placeholder="👥 الفريق (e.g. 4 Devs)" oninput="updateProject(${i},'team',this.value)"/>
          </div>

          <textarea class="field-textarea" style="min-height:50px" placeholder="🎯 المشكلة (The Problem statement...)" oninput="updateProject(${i},'problem',this.value)">${p.problem || ''}</textarea>
          <textarea class="field-textarea" style="min-height:50px" placeholder="💡 الحل (The Technical Solution...)" oninput="updateProject(${i},'solution',this.value)">${p.solution || ''}</textarea>
          <textarea class="field-textarea" style="min-height:50px" placeholder="⚙️ العملية والمعمارية (Process & Architecture...)" oninput="updateProject(${i},'process',this.value)">${p.process || ''}</textarea>
          <textarea class="field-textarea" style="min-height:50px" placeholder="🚀 التأثير (Business Impact...)" oninput="updateProject(${i},'impact',this.value)">${p.impact || ''}</textarea>

          <input class="field-input" value="${typeof p.metrics === 'string' ? p.metrics : (Array.isArray(p.metrics) ? p.metrics.map(m => typeof m === 'object' ? `${m.val || m.value}:${m.label}` : m).join(', ') : '')}" placeholder="📊 النتائج والأرقام (e.g. 45% Faster Response, 2M+ Daily Events)" oninput="updateProject(${i},'metrics',this.value)"/>
          <input class="field-input" value="${p.video || ''}" placeholder="🎥 رابط فيديو للمشروع (Optional Video Embed URL)" oninput="updateProject(${i},'video',this.value)"/>
        </div>
      </details>
    </div>
  `).join('');
}

window.uploadProjectImage = async function(i, inputEl) {
  const file = inputEl.files[0];
  if (!file) return;

  showToast('info', '⏳', 'Uploading project image to Supabase Storage...');

  try {
    const authUser = await getCurrentAuthUser();
    const userId = authUser?.id || 'usr_guest';
    const portfolioId = portfolioData.id || 'pf_default';
    const projectId = portfolioData.projects[i]?.id || `proj_${i}`;

    const mediaMeta = await uploadProjectMedia(file, userId, portfolioId, projectId);
    updateProject(i, 'image', mediaMeta.publicUrl);
    if (!portfolioData.projects[i].media) portfolioData.projects[i].media = [];
    portfolioData.projects[i].media.push(mediaMeta);

    renderProjects();
    updateHUD();
    autoSave();
    showToast('success', '🖼️', 'Project image uploaded to Supabase Storage!');
  } catch (err) {
    showToast('error', '❌', `Project image upload failed: ${err.message}`);
    inputEl.value = '';
  }
};

window.addProject = function() {
  portfolioData.projects.push({ name: '', description: '', tech: '', url: '', github: '', image: '' });
  renderProjects();
  updateHUD();
  flyToSection('projects');
  autoSave();
};
window.updateProject = function(i, key, val) {
  portfolioData.projects[i][key] = val;
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

  el.innerHTML = portfolioData.certs.map((c, i) => `
    <div class="cert-item" style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:16px;margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <span style="font-size:0.75rem;font-weight:700;color:#10b981">📜 Certificate 0${i+1}</span>
        <button class="del-btn" onclick="removeCert(${i})" style="background:none;border:none;color:#ef4444;cursor:pointer">✕</button>
      </div>
      <input class="field-input" value="${c.title || ''}" placeholder="📜 اسم الشهادة (e.g. AWS Certified Developer)" oninput="updateCert(${i},'title',this.value)" style="margin-bottom:8px;font-weight:700"/>
      <input class="field-input" value="${c.issuer || ''}" placeholder="🏛️ الجهة المانحة (e.g. Amazon Web Services / Google)" oninput="updateCert(${i},'issuer',this.value)" style="margin-bottom:8px"/>
      <input class="field-input" value="${c.date || ''}" placeholder="📅 سنة الاصدار (e.g. 2024)" oninput="updateCert(${i},'date',this.value)" style="margin-bottom:8px"/>
      
      <!-- CERT IMAGE UPLOADER -->
      <div style="margin-bottom:8px;display:flex;gap:8px;align-items:center">
        <input class="field-input" id="cert-img-input-${i}" value="${c.image || ''}" placeholder="🖼️ صورة الشهادة أو اختر من جهازك ←" oninput="updateCert(${i},'image',this.value)" style="flex:1"/>
        <label style="
          padding:9px 12px;background:rgba(16,185,129,0.15);border:1px solid rgba(16,185,129,0.3);
          border-radius:8px;color:#fff;font-size:0.78rem;font-weight:600;cursor:pointer;
          display:flex;align-items:center;gap:6px;white-space:nowrap;transition:all 0.2s;
        " onmouseover="this.style.background='rgba(16,185,129,0.25)'" onmouseout="this.style.background='rgba(16,185,129,0.15)'">
          📁 صورة الشهادة
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
    showToast('error', '⚠️', 'حجم صورة الشهادة كبير جداً، برجاء اختيار صورة أقل من 4 ميجابايت');
    return;
  }

  const reader = new FileReader();
  reader.onload = function(e) {
    updateCert(i, 'image', e.target.result);
    renderCerts();
    updateHUD();
    showToast('success', '📜', 'تم رفع صورة الشهادة من جهازك بنجاح!');
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
window.removeCert = function(i) {
  if (!portfolioData.certs) portfolioData.certs = [];
  portfolioData.certs.splice(i, 1);
  renderCerts();
  updateHUD();
  autoSave();
};

// ─── THEME GRID ─────────────────────────────
function buildThemeGrid() {
  const el = document.getElementById('theme-grid');
  if (!el) return;
  const themes = getAllThemes();
  el.innerHTML = themes.map(t => {
    const freeThemes = ['cosmic', 'code', 'creative', 'media'];
    const isLocked = !isPro() && !freeThemes.includes(t.id);
    return `
      <div class="theme-card ${currentTheme?.id === t.id ? 'active' : ''}" onclick="selectTheme('${t.id}', ${isLocked})">
        <span class="theme-emoji">${t.emoji}</span>
        <div class="theme-name">${t.name}${isLocked ? '<span class="pro-badge">PRO</span>' : ''}</div>
      </div>
    `;
  }).join('');
}

window.selectTheme = function(id, locked) {
  if (locked) {
    showToast('info', '💎', 'Upgrade to Pro to unlock all 11 3D themes!');
    handleUpgradeClick();
    return;
  }
  const theme = getThemeById(id);
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
  showToast('info', '⏳', 'Generating your 3D portfolio...');
  try {
    await exportStandaloneHTML(portfolioData, currentTheme);
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

window.clearAll = function() {
  if (!confirm('Clear all data and start fresh?')) return;
  portfolioData = {
    name:'',tagline:'',profession:'',bio:'',location:'',avatar:'',
    social:{github:'',linkedin:'',twitter:'',email:'',website:''},
    skills:[],projects:[],contactMessage:"I'm always open to new opportunities.",
    theme:'cosmic',customColors:null
  };
  document.querySelectorAll('input,textarea').forEach(el => el.value = '');
  renderSkills();
  renderProjects();
  const theme = getThemeById('cosmic');
  currentTheme = theme;
  engine?.applyTheme(theme);
  updateHUD();
  buildThemeGrid();
  showToast('info', '🗑️', 'Cleared! Ready for a fresh start.');
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

window.handleUpgradeClick = function() {
  if (isPro()) return;
  const user = getCurrentUser();
  const phone = '201270024222';
  
  let currentPrice = 200;
  let appliedCode = '';
  let discountPercent = 0;

  const buildWhatsappUrl = () => {
    let msgText = `أهلاً، حابب أشترك في خطة Pro (InstaPay).\nاسم الحساب: ${user?.name || ''}\nالإيميل: ${user?.email || ''}`;
    if (appliedCode) {
      msgText += `\n🏷️ كود الخصم المطبق: ${appliedCode} (${discountPercent}% OFF)\n💰 المبلغ المطلوب تحويله: ${currentPrice} جنيه مصري`;
    } else {
      msgText += `\n💰 المبلغ: 200 جنيه مصري`;
    }
    return `https://wa.me/${phone}?text=${encodeURIComponent(msgText)}`;
  };

  const modal = document.createElement('div');
  modal.id = 'pro-upgrade-modal';
  modal.style.cssText = `
    position:fixed;inset:0;z-index:99999;
    background:rgba(5,5,12,0.85);backdrop-filter:blur(20px);
    display:flex;align-items:center;justify-content:center;padding:20px;
    font-family:'Inter',sans-serif;
  `;
  modal.innerHTML = `
    <div style="
      background:rgba(15,15,30,0.95);border:1px solid rgba(124,58,237,0.3);
      border-radius:24px;padding:32px 28px;max-width:420px;width:100%;
      text-align:center;box-shadow:0 30px 60px rgba(0,0,0,0.8);position:relative;
    ">
      <button onclick="document.getElementById('pro-upgrade-modal').remove()" style="
        position:absolute;top:16px;right:16px;background:none;border:none;
        color:rgba(255,255,255,0.4);font-size:18px;cursor:pointer;
      ">✕</button>
      
      <div style="font-size:3rem;margin-bottom:12px">💎</div>
      <h3 style="font-size:1.3rem;font-weight:800;margin-bottom:6px;background:linear-gradient(135deg,#7c3aed,#06b6d4);-webkit-background-clip:text;-webkit-text-fill-color:transparent">
        الترقية لخطة Pro
      </h3>
      <div id="modal-price-display" style="font-size:1.6rem;font-weight:900;color:#10b981;margin-bottom:16px;font-family:'JetBrains Mono',monospace">
        200 جنيه مصري <span style="font-size:0.8rem;color:rgba(255,255,255,0.4);font-weight:normal">/ مدى الحياة</span>
      </div>

      <div style="text-align:left;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:14px;padding:16px;margin-bottom:20px;font-size:0.82rem;color:rgba(255,255,255,0.7);line-height:1.8">
        <div>⚡ <strong>الرفع التلقائي:</strong> موقعك يترفع أوتوماتيك ورابط حي مباشر</div>
        <div>🎨 <strong>كل الثيمات الـ 3D:</strong> فتح جميع العوالم الـ 11 </div>
        <div>♾️ <strong>مواقع غير محدودة:</strong> عمل أكثر من بروتوفوليو</div>
        <div>🚫 <strong>بدون علامة مائية:</strong> مظهر احترافي 100%</div>
      </div>

      <!-- PROMO CODE INPUT SECTION -->
      <div style="margin-bottom:16px;display:flex;gap:8px">
        <input id="input-modal-promo" type="text" placeholder="عندك كود خصم؟" style="
          flex:1;padding:10px 12px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);
          border-radius:10px;color:#fff;font-size:0.8rem;outline:none;font-family:'JetBrains Mono',monospace;
          text-transform:uppercase;
        "/>
        <button onclick="handleRedeemPromo()" style="
          padding:10px 16px;background:rgba(124,58,237,0.2);border:1px solid rgba(124,58,237,0.4);
          border-radius:10px;color:#fff;font-size:0.8rem;font-weight:700;cursor:pointer;
        ">تطبيق</button>
      </div>
      <div id="modal-promo-msg" style="display:none;font-size:0.75rem;margin-bottom:12px"></div>

      <div style="font-size:0.8rem;color:rgba(255,255,255,0.5);margin-bottom:12px">
        الدفع عن طريق <strong>InstaPay</strong> عبر تواصل سريع واتساب:
      </div>

      <a id="modal-wa-link" href="${buildWhatsappUrl()}" target="_blank" onclick="document.getElementById('pro-upgrade-modal').remove()" style="
        display:flex;align-items:center;justify-content:center;gap:10px;
        width:100%;padding:14px;background:#25D366;border-radius:12px;
        color:#fff;font-weight:700;font-size:0.95rem;text-decoration:none;
        box-shadow:0 10px 25px rgba(37,211,102,0.3);transition:all 0.3s;
      " onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='scale(1)'">
        <span>💬 تواصل واتساب للتفعيل (InstaPay)</span>
      </a>
      
      <div style="font-size:0.7rem;color:rgba(255,255,255,0.25);margin-top:12px">
        رقم الواتساب: 01270024222
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  window.handleRedeemPromo = function() {
    const code = document.getElementById('input-modal-promo')?.value;
    const msgEl = document.getElementById('modal-promo-msg');
    const priceDisplay = document.getElementById('modal-price-display');
    const waLink = document.getElementById('modal-wa-link');
    if (!code || !msgEl) return;

    const res = redeemPromoCode(code);
    msgEl.style.display = 'block';

    if (res.success) {
      msgEl.style.color = '#10b981';
      msgEl.textContent = res.message;
      appliedCode = code.trim().toUpperCase();
      discountPercent = res.discount;
      currentPrice = res.newPrice || 0;

      if (priceDisplay && res.discount < 100) {
        priceDisplay.innerHTML = `<span style="text-decoration:line-through;color:rgba(255,255,255,0.3);font-size:1.1rem;margin-right:8px">200 ج.م</span> ${currentPrice} جنيه مصري <span style="font-size:0.8rem;color:rgba(255,255,255,0.4);font-weight:normal">(${discountPercent}% الخصم)</span>`;
      }

      if (waLink) {
        waLink.href = buildWhatsappUrl();
      }

      if (res.discount === 100) {
        setTimeout(() => {
          document.getElementById('pro-upgrade-modal')?.remove();
          document.getElementById('tier-chip').textContent = '💎 PRO';
          document.getElementById('tier-chip').className = 'tier-chip tier-pro';
          buildThemeGrid();
          renderPublishTab();
          showToast('success', '💎', 'تم تفعيل حسابك كـ Pro بنجاح!');
        }, 1200);
      }
    } else {
      msgEl.style.color = '#ef4444';
      msgEl.textContent = res.error;
    }
  };
};

// ─── ADMIN DASHBOARD ─────────────────────────
window.openAdmin = function() {
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
  upgradeToPro();
  document.getElementById('tier-chip').textContent = '💎 PRO';
  document.getElementById('tier-chip').className = 'tier-chip tier-pro';
  buildThemeGrid();
  closeAdmin();
  showToast('success', '💎', 'Pro tier activated! All 11 themes unlocked!');
};

// ─── TOAST ──────────────────────────────────
function showToast(type, icon, message) {
  const container = document.getElementById('toast-container');
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

// ─── ENGINE GLOBAL WRAPPERS (for inline onclick) ────────────
window.engineBurst = () => engine?.explode();
window.engineZoomIn = () => engine?.zoomIn();
window.engineZoomOut = () => engine?.zoomOut();

// ─── START ──────────────────────────────────
init();
