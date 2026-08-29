import { getCinematicProfileKey, getCinematicProfile } from '../three/CinematicProfiles.js';
import { getThemeSceneConfig } from '../three/ThemeSceneConfig.js';
import {
  generateProjectCinemaHTML,
  getProjectCinemaCSS,
  getProjectCinemaScript
} from './ProjectCinema.js';
import { calculateProfessionalExperience } from '../utils/ExperienceCalculator.js';

function escapeHTML(str) {
  return (str || '').replace(/[&<>"']/g, m => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }[m]));
}

// Escaping an href prevents attribute injection but does not stop a
// javascript: URL. Public portfolios are rendered from user-owned content,
// so protocol validation is required before an anchor is emitted.
function safeExternalHref(value, { allowMailto = false } = {}) {
  const href = String(value || '').trim();
  if (!href) return '';
  if (/^https?:\/\//i.test(href)) return href;
  if (allowMailto && /^mailto:[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(href)) return href;
  return '';
}

function safeResumeHref(value) {
  const href = String(value || '').trim();
  return /^(?:https?:\/\/|blob:|data:application\/pdf(?:;base64)?,)/i.test(href) ? href : '';
}

function safeImageSrc(value) {
  const src = String(value || '').trim();
  return /^(?:https?:\/\/|blob:|data:image\/(?:png|jpe?g|gif|webp);base64,)/i.test(src) ? src : '';
}

/**
 * Get Shared Canonical Portfolio Snapshot Config
 */
export function getCurrentPortfolioConfig(data = {}, theme = {}) {
  const activeTheme = theme && theme.id ? theme : {
    id: 'cosmic',
    name: 'Cosmic Elite',
    primaryColor: 0x7c3aed,
    secondaryColor: 0x06b6d4,
    accentColor: 0xff007f,
    bgColor: 0x050508
  };

  const themeId = activeTheme.id || 'cosmic';
  const cinematicProfileKey = getCinematicProfileKey(themeId);
  const cinematicProfile = getCinematicProfile(themeId);
  const sceneConfig = getThemeSceneConfig(themeId);

  const config = {
    data: { ...data },
    theme: { ...activeTheme },
    cinematicProfileKey,
    cinematicProfile,
    sceneConfig,
    isPro: Boolean(data.isPro),
    hideWatermark: Boolean(data.hideWatermark),
    hideThemeBadge: Boolean(data.hideThemeBadge),
    exportedAt: new Date().toISOString()
  };

  validatePortfolioRuntimeConfig(config);
  return config;
}

/**
 * Validate Runtime Config Parity
 */
export function validatePortfolioRuntimeConfig(config) {
  if (!config) {
    console.warn('[Portfolio Parity] Runtime config is null or undefined!');
    return false;
  }
  if (!config.theme || !config.theme.id) {
    console.warn('[Portfolio Parity] Missing theme ID in runtime config. Falling back safely.');
  }
  if (!config.cinematicProfile) {
    console.warn(`[Portfolio Parity] Missing cinematic profile for theme: ${config.theme?.id}. Falling back safely.`);
  }
  if (!config.sceneConfig) {
    console.warn(`[Portfolio Parity] Missing scene config for theme: ${config.theme?.id}. Falling back safely.`);
  }
  return true;
}

/**
 * Generate Portfolio CSS System
 */
export function generatePortfolioCSS(colors) {
  const toCssColor = (value, fallback) => {
    if (typeof value === 'number') return `#${value.toString(16).padStart(6, '0')}`;
    return value || fallback;
  };
  const primary = toCssColor(colors?.primary ?? colors?.primaryColor, '#7c3aed');
  const secondary = toCssColor(colors?.secondary ?? colors?.secondaryColor, '#06b6d4');
  const accent = toCssColor(colors?.accent ?? colors?.accentColor, '#ff007f');
  const bg = toCssColor(colors?.bg ?? colors?.bgColor, '#050508');

  return `
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --primary: ${primary};
      --secondary: ${secondary};
      --accent: ${accent};
      --bg: ${bg};
    }
    html {
      scroll-behavior: smooth;
    }
    body {
      min-height: 100vh;
      margin: 0;
      padding: 0;
      background-color: var(--bg);
      color: #f0f0f8;
      font-family: 'Inter', sans-serif;
      overflow-x: hidden;
      overflow-y: auto;
    }

    /* Fixed WebGL 3D Background Canvas */
    canvas#bg-canvas {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      z-index: 0;
      pointer-events: auto;
    }

    /* Scrollable Document Container */
    #portfolio-scroll-container {
      position: relative;
      z-index: 10;
      width: 100%;
      min-height: 100vh;
    }

    /* Sticky Top Navigation Bar */
    .portfolio-navbar {
      position: sticky;
      top: 0;
      z-index: 1000;
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 14px 32px;
      background: rgba(5, 5, 14, 0.78);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      width: 100%;
      box-sizing: border-box;
    }

    .navbar-brand {
      display: flex;
      align-items: center;
      gap: 12px;
      font-weight: 900;
      font-family: 'Outfit', sans-serif;
      font-size: 1.1rem;
      color: #fff;
      text-decoration: none;
    }

    .brand-avatar {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      border: 2px solid var(--primary);
      object-fit: cover;
      box-shadow: 0 0 15px var(--primary);
    }

    .brand-icon {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: linear-gradient(135deg, var(--primary), var(--secondary));
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 0.9rem;
      color: #fff;
    }

    .navbar-links {
      display: flex;
      gap: 8px;
      align-items: center;
    }

    .nav-link {
      padding: 8px 18px;
      min-height: 44px;
      display: inline-flex;
      align-items: center;
      border-radius: 20px;
      color: rgba(255, 255, 255, 0.7);
      text-decoration: none;
      font-size: 0.85rem;
      font-weight: 600;
      transition: all 0.3s ease;
      cursor: pointer;
    }

    .nav-link:hover, .nav-link.active {
      color: #fff;
      background: rgba(255, 255, 255, 0.12);
      border: 1px solid rgba(255, 255, 255, 0.18);
      box-shadow: 0 0 15px rgba(124, 58, 237, 0.3);
    }

    /* Sections Container Stack */
    .portfolio-main {
      display: flex;
      flex-direction: column;
      width: 100%;
    }

    .portfolio-section {
      min-height: 90vh;
      padding: 90px 24px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      position: relative;
      box-sizing: border-box;
      width: 100%;
      scroll-margin-top: 82px;
    }

    /* Hero Section Specifics */
    .hero-section {
      min-height: 94vh;
      text-align: center;
      padding-top: 60px;
    }

    .hero-content {
      max-width: 800px;
      display: flex;
      flex-direction: column;
      align-items: center;
      margin: 0 auto;
    }

    .hero-avatar-wrap {
      width: 130px;
      height: 130px;
      border-radius: 50%;
      overflow: hidden;
      margin-bottom: 20px;
      border: 3px solid var(--primary);
      box-shadow: 0 0 40px var(--primary);
      background: #000;
      transition: transform 0.4s ease;
    }

    .hero-avatar-wrap:hover {
      transform: scale(1.08) rotate(3deg);
    }

    .hero-avatar-wrap img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .hero-name {
      font-family: 'Outfit', sans-serif;
      font-size: clamp(2.5rem, 6vw, 4.5rem);
      font-weight: 900;
      background: linear-gradient(135deg, #ffffff 30%, var(--primary) 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 10px;
      line-height: 1.1;
      letter-spacing: -1px;
    }

    .hero-profession {
      font-family: 'JetBrains Mono', monospace;
      font-size: clamp(1rem, 2.5vw, 1.4rem);
      color: var(--primary);
      letter-spacing: 4px;
      text-transform: uppercase;
      margin-bottom: 14px;
      font-weight: 700;
    }

    .hero-badge {
      display: inline-block;
      padding: 6px 18px;
      border-radius: 30px;
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.12);
      backdrop-filter: blur(10px);
      font-size: 0.82rem;
      color: rgba(255, 255, 255, 0.85);
      margin-bottom: 24px;
      font-family: 'JetBrains Mono', monospace;
    }

    .hero-tagline {
      font-size: 1.1rem;
      color: rgba(255, 255, 255, 0.75);
      max-width: 600px;
      margin-bottom: 28px;
      line-height: 1.6;
    }

    .hero-actions {
      display: flex;
      gap: 14px;
      justify-content: center;
      flex-wrap: wrap;
      margin-top: 10px;
    }

    .scroll-indicator {
      margin-top: 40px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      font-size: 0.75rem;
      color: rgba(255, 255, 255, 0.5);
      letter-spacing: 2px;
      text-transform: uppercase;
      animation: bounce 2s infinite;
    }

    @keyframes bounce {
      0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
      40% { transform: translateY(-8px); }
      60% { transform: translateY(-4px); }
    }

    /* Section Cards Layout */
    .section-container {
      width: 100%;
      max-width: 1100px;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    .section-title {
      font-family: 'Outfit', sans-serif;
      font-size: clamp(1.8rem, 4vw, 2.8rem);
      font-weight: 900;
      margin-bottom: 40px;
      text-align: center;
      background: linear-gradient(135deg, #fff 40%, var(--primary) 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .glass-card {
      background: rgba(12, 12, 28, 0.85);
      backdrop-filter: blur(25px);
      -webkit-backdrop-filter: blur(25px);
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 24px;
      padding: 28px;
      box-shadow: 0 25px 60px rgba(0, 0, 0, 0.6);
      transition: transform 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease;
      transform-style: preserve-3d;
      color: #fff;
    }

    .glass-card:hover {
      transform: translateY(-8px) scale(1.01);
      border-color: var(--primary);
      box-shadow: 0 35px 80px rgba(0, 0, 0, 0.8), 0 0 30px rgba(124, 58, 237, 0.25);
    }

    /* About Section */
    .about-card {
      max-width: 700px;
      width: 100%;
      text-align: center;
    }
    .about-bio {
      font-size: 1.05rem;
      line-height: 1.8;
      color: rgba(255, 255, 255, 0.85);
    }
    .about-location {
      margin-top: 16px;
      font-size: 0.88rem;
      color: rgba(255, 255, 255, 0.55);
    }

    /* Projects Section Grid */
    .projects-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 24px;
      width: 100%;
    }

    .project-card {
      display: flex;
      flex-direction: column;
      height: 100%;
    }

    .project-img-wrap {
      width: 100%;
      height: 160px;
      border-radius: 14px;
      overflow: hidden;
      margin-bottom: 16px;
      background: rgba(255, 255, 255, 0.03);
    }

    .project-img-placeholder {
      display: flex;
      align-items: center;
      justify-content: center;
      flex-direction: column;
      gap: 6px;
      background: radial-gradient(circle at 30% 20%, rgba(124,58,237,0.35), transparent 55%), linear-gradient(135deg, rgba(6,182,212,0.18), rgba(12,12,28,0.92));
      color: rgba(255,255,255,0.72);
      letter-spacing: 0.04em;
      text-transform: uppercase;
      font-size: 0.68rem;
      font-weight: 800;
    }

    .project-placeholder-icon {
      font-size: 2rem;
      line-height: 1;
      filter: drop-shadow(0 0 14px rgba(124,58,237,0.7));
    }

    .project-img-wrap img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .project-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }

    .project-badge {
      font-size: 0.75rem;
      font-weight: 800;
      color: var(--primary);
    }

    .project-tech {
      font-size: 0.72rem;
      color: var(--primary);
      font-family: 'JetBrains Mono', monospace;
    }

    .project-name {
      font-size: 1.25rem;
      font-weight: 900;
      margin-bottom: 8px;
      color: #fff;
    }

    .project-desc {
      font-size: 0.85rem;
      color: rgba(255, 255, 255, 0.7);
      line-height: 1.6;
      margin-bottom: 20px;
      flex: 1;
    }

    .project-links {
      display: flex;
      gap: 10px;
      margin-top: auto;
      flex-wrap: wrap;
    }

    .project-links .btn {
      flex: 1 1 130px;
      min-height: 42px;
      white-space: nowrap;
    }

    .project-meta {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
      margin: -2px 0 12px;
      color: rgba(255,255,255,0.58);
      font-size: 0.75rem;
    }

    .project-role { color: var(--secondary); font-weight: 700; }

    .project-result {
      margin: 0 0 16px;
      padding: 9px 12px;
      border-left: 2px solid var(--secondary);
      border-radius: 0 10px 10px 0;
      background: rgba(6,182,212,0.08);
      color: rgba(255,255,255,0.82);
      font-size: 0.8rem;
      line-height: 1.5;
    }

    /* Skills Section Grid */
    .skills-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 18px;
      width: 100%;
    }

    .skill-card {
      padding: 18px 22px;
      border-radius: 18px;
    }

    .skill-group-card { padding: 18px 20px; }
    .skill-group-title {
      margin: 0 0 12px;
      color: #fff;
      font-size: 0.85rem;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }
    .skill-chips { display: flex; flex-wrap: wrap; gap: 8px; }
    .skill-chip {
      display: inline-flex;
      align-items: center;
      min-height: 32px;
      padding: 5px 11px;
      border-radius: 999px;
      color: rgba(255,255,255,0.92);
      background: rgba(124,58,237,0.14);
      border: 1px solid rgba(124,58,237,0.34);
      font-size: 0.8rem;
      line-height: 1.2;
    }

    .skill-header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 10px;
      font-weight: 700;
      font-size: 0.95rem;
    }

    .skill-level-val {
      color: var(--primary);
      font-family: 'JetBrains Mono', monospace;
    }

    .skill-bar-track {
      height: 8px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 4px;
      overflow: hidden;
    }

    .skill-bar-fill {
      height: 100%;
      background: linear-gradient(90deg, var(--primary), var(--secondary));
      border-radius: 4px;
      transition: width 1s ease-in-out;
    }

    /* Certs Section Grid */
    .certs-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 20px;
      width: 100%;
    }

    .cert-card {
      border-color: rgba(16, 185, 129, 0.35);
    }

    .cert-img {
      width: 100%;
      height: 130px;
      object-fit: cover;
      border-radius: 14px;
      margin-bottom: 14px;
    }

    .cert-badge {
      font-size: 0.72rem;
      font-weight: 800;
      color: #10b981;
      margin-bottom: 4px;
    }

    .cert-title {
      font-size: 1.05rem;
      font-weight: 900;
      margin-bottom: 4px;
    }

    .cert-issuer {
      font-size: 0.8rem;
      color: rgba(255, 255, 255, 0.65);
    }

    /* Contact Section */
    .contact-card {
      max-width: 550px;
      width: 100%;
      text-align: center;
    }

    .contact-msg {
      font-size: 0.95rem;
      color: rgba(255, 255, 255, 0.75);
      margin-bottom: 24px;
      line-height: 1.6;
    }

    .contact-links {
      display: flex;
      gap: 12px;
      justify-content: center;
      flex-wrap: wrap;
    }

    /* Buttons */
    .btn {
      padding: 12px 28px;
      border-radius: 30px;
      font-size: 0.9rem;
      font-weight: 700;
      text-decoration: none;
      cursor: pointer;
      transition: all 0.3s ease;
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }

    .btn-primary {
      background: linear-gradient(135deg, var(--primary), var(--secondary));
      color: #fff;
      box-shadow: 0 10px 30px rgba(124, 58, 237, 0.4);
      border: none;
    }

    .btn-primary:hover {
      transform: translateY(-3px);
      box-shadow: 0 15px 40px rgba(124, 58, 237, 0.6);
    }

    .btn-secondary {
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.2);
      color: #fff;
      backdrop-filter: blur(10px);
    }

    .btn-secondary:hover {
      background: rgba(255, 255, 255, 0.16);
      transform: translateY(-3px);
    }

    /* Footer */
    .portfolio-footer {
      padding: 40px 24px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 14px;
      border-top: 1px solid rgba(255, 255, 255, 0.08);
      font-size: 0.8rem;
      color: rgba(255, 255, 255, 0.45);
      background: rgba(5, 5, 12, 0.85);
    }

    .watermark-pill {
      background: rgba(10, 10, 22, 0.85);
      backdrop-filter: blur(12px);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 20px;
      padding: 6px 16px;
      font-size: 0.75rem;
      color: rgba(255, 255, 255, 0.7);
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .watermark-icon {
      width: 18px;
      height: 18px;
      background: linear-gradient(135deg, var(--primary), var(--secondary));
      border-radius: 4px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 10px;
      font-weight: bold;
      color: #fff;
    }

    /* ─── CINEMATIC INTRO STYLES ─── */
    .intro-skip-btn {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 1500;
      background: rgba(12, 12, 28, 0.75);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border: 1px solid rgba(255, 255, 255, 0.15);
      color: rgba(255, 255, 255, 0.9);
      padding: 8px 18px;
      border-radius: 30px;
      font-size: 0.75rem;
      font-weight: 700;
      font-family: 'JetBrains Mono', monospace;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
      box-shadow: 0 8px 25px rgba(0, 0, 0, 0.5);
      transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .intro-skip-btn:hover {
      background: rgba(124, 58, 237, 0.4);
      border-color: rgba(124, 58, 237, 0.6);
      color: #fff;
      transform: translateY(-2px);
    }

    .hero-avatar-wrap, .hero-name, .hero-profession, .hero-badge, .hero-tagline, .hero-actions, .portfolio-navbar, .scroll-indicator {
      transition: opacity 0.6s cubic-bezier(0.16, 1, 0.3, 1), transform 0.6s cubic-bezier(0.16, 1, 0.3, 1), filter 0.6s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .intro-hidden {
      opacity: 0 !important;
      transform: translateY(20px) scale(0.96);
      filter: blur(8px);
    }
    .intro-visible {
      opacity: 1 !important;
      transform: translateY(0) scale(1);
      filter: blur(0);
    }

    /* ─── ULTRA-MINIMAL MOBILE NAVBAR & CINEMATIC OVERLAY ─── */
    .portfolio-navbar {
      position: sticky;
      top: 0;
      z-index: 1000;
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 32px;
      background: rgba(5, 5, 14, 0.35);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
      width: 100%;
      height: 60px;
      box-sizing: border-box;
      transition: background 0.4s ease, border-color 0.4s ease, backdrop-filter 0.4s ease;
    }

    .portfolio-navbar.scrolled {
      background: rgba(5, 5, 14, 0.88);
      backdrop-filter: blur(25px);
      -webkit-backdrop-filter: blur(25px);
      border-bottom-color: rgba(255, 255, 255, 0.12);
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
    }

    .navbar-brand {
      display: flex;
      align-items: center;
      gap: 10px;
      font-weight: 800;
      font-family: 'Outfit', sans-serif;
      font-size: clamp(0.9rem, 3.8vw, 1.1rem);
      color: #fff;
      text-decoration: none;
      max-width: 70%;
    }

    .brand-name {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 180px;
    }

    .brand-avatar {
      width: 34px;
      height: 34px;
      min-width: 34px;
      border-radius: 50%;
      border: 2px solid var(--primary);
      object-fit: cover;
      box-shadow: 0 0 10px rgba(124, 58, 237, 0.4);
    }

    .mobile-menu-btn {
      display: none;
      width: 42px;
      height: 42px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.14);
      color: #fff;
      font-size: 1.1rem;
      cursor: pointer !important;
      pointer-events: auto !important;
      align-items: center;
      justify-content: center;
      transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
      position: relative;
      z-index: 1100;
    }
    .mobile-menu-btn:hover {
      background: rgba(124, 58, 237, 0.25);
      border-color: rgba(124, 58, 237, 0.5);
      transform: scale(1.05);
    }

    /* Full-Screen Cinematic Mobile Navigation Overlay */
    .mobile-menu-panel {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      min-height: 100svh;
      z-index: 2500 !important;
      background: rgba(5, 5, 14, 0.96) !important;
      backdrop-filter: blur(30px);
      -webkit-backdrop-filter: blur(30px);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
      padding: 20px 24px;
      box-sizing: border-box;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.3s cubic-bezier(0.16, 1, 0.3, 1), transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      transform: scale(0.97);
    }
    .mobile-menu-panel.active {
      opacity: 1 !important;
      pointer-events: auto !important;
      transform: scale(1) !important;
    }

    .mobile-menu-inner {
      width: 100%;
      max-width: 340px;
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    .mobile-menu-top {
      width: 100%;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      padding-bottom: 12px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    }

    .mobile-menu-brand {
      font-family: 'Outfit', sans-serif;
      font-size: 0.85rem;
      font-weight: 800;
      letter-spacing: 2px;
      color: var(--primary);
      text-transform: uppercase;
    }

    .mobile-menu-close {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.15);
      color: rgba(255, 255, 255, 0.9);
      font-size: 1.1rem;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.25s ease;
    }

    .mobile-menu-nav {
      display: flex;
      flex-direction: column;
      gap: 12px;
      width: 100%;
    }

    .mobile-nav-link {
      font-family: 'Outfit', sans-serif;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 16px;
      padding: 12px 18px;
      display: flex;
      align-items: center;
      gap: 16px;
      text-align: left;
      cursor: pointer;
      color: rgba(255, 255, 255, 0.92);
      text-decoration: none;
      transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
      width: 100%;
      box-sizing: border-box;
      opacity: 1 !important;
      visibility: visible !important;
    }

    .mobile-nav-link:hover, .mobile-nav-link:focus {
      background: linear-gradient(135deg, rgba(124, 58, 237, 0.25), rgba(6, 182, 212, 0.15));
      border-color: rgba(124, 58, 237, 0.4);
      transform: translateX(4px);
    }

    .nav-index {
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.85rem;
      font-weight: 700;
      color: var(--primary);
      opacity: 0.9;
    }

    .nav-text-wrap {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .nav-title {
      font-size: 1.05rem;
      font-weight: 800;
      letter-spacing: 1px;
      color: #fff;
    }

    .nav-sub {
      font-size: 0.72rem;
      color: rgba(255, 255, 255, 0.5);
      font-weight: 400;
    }

    /* ─── SHARED DEVICE MODE SELECTORS (STUDIO VIRTUAL MODE & REAL MOBILE EXPORT) ─── */
    [data-device="desktop"] .navbar-links { display: flex !important; }
    [data-device="desktop"] .mobile-menu-btn { display: none !important; }

    [data-device="mobile"] .navbar-links { display: none !important; }
    [data-device="mobile"] .mobile-menu-btn { display: flex !important; }

    [data-device="mobile"] .portfolio-navbar {
      padding: 0 16px !important;
      padding-top: env(safe-area-inset-top, 0px) !important;
      height: calc(56px + env(safe-area-inset-top, 0px)) !important;
    }

    [data-device="mobile"] .portfolio-section {
      padding-inline: clamp(16px, 5vw, 24px) !important;
      min-height: 100svh !important;
    }

    [data-device="mobile"] .hero-section {
      min-height: 100svh !important;
      justify-content: center !important;
      padding-top: 60px !important;
    }

    [data-device="mobile"] .hero-avatar-wrap {
      width: clamp(92px, 24vw, 120px) !important;
      height: clamp(92px, 24vw, 120px) !important;
      margin-bottom: 18px !important;
    }

    [data-device="mobile"] .hero-name {
      font-size: clamp(1.8rem, 8.5vw, 2.65rem) !important;
      line-height: 1.02 !important;
      text-wrap: balance !important;
      margin-bottom: 8px !important;
      word-break: normal !important;
      overflow-wrap: normal !important;
      hyphens: none !important;
      letter-spacing: -0.04em !important;
      max-width: 100% !important;
    }

    [data-device="tablet"] .navbar-links { display: none !important; }
    [data-device="tablet"] .mobile-menu-btn { display: flex !important; }
    [data-device="tablet"] .hero-name {
      font-size: clamp(2.5rem, 7vw, 4rem) !important;
      max-width: min(92%, 680px) !important;
      text-wrap: balance !important;
      word-break: normal !important;
      overflow-wrap: normal !important;
      hyphens: none !important;
    }

    [data-device="mobile"] .hero-profession {
      font-size: clamp(0.9rem, 3.8vw, 1.15rem) !important;
      line-height: 1.3 !important;
      margin-bottom: 12px !important;
      max-width: 90% !important;
    }

    [data-device="mobile"] .hero-badge {
      font-size: 0.75rem !important;
      padding: 5px 14px !important;
      margin-bottom: 14px !important;
    }

    [data-device="mobile"] .hero-tagline {
      font-size: clamp(0.88rem, 3.5vw, 1.05rem) !important;
      line-height: 1.4 !important;
      max-width: 90% !important;
      margin-bottom: 24px !important;
    }

    [data-device="mobile"] .hero-actions {
      flex-direction: column !important;
      width: 100% !important;
      gap: 10px !important;
    }

    [data-device="mobile"] .hero-actions .btn {
      width: min(100%, 320px) !important;
      height: 50px !important;
      font-size: 0.85rem !important;
    }

    [data-device="mobile"] .hero-actions .btn-secondary {
      background: rgba(255, 255, 255, 0.04) !important;
      border: 1px solid rgba(255, 255, 255, 0.16) !important;
      color: rgba(255, 255, 255, 0.9) !important;
      box-shadow: none !important;
    }

    @media (max-width: 768px) {
      .navbar-links { display: none !important; }
      .mobile-menu-btn { display: flex !important; }
      /* The exported document defaults to desktop device mode for the Studio preview.
         Viewport media queries must still win on a real narrow public page. */
      [data-device="desktop"] .navbar-links { display: none !important; }
      [data-device="desktop"] .mobile-menu-btn { display: flex !important; }
      .portfolio-navbar {
        padding: 0 14px;
        padding-top: env(safe-area-inset-top, 0px);
        height: calc(56px + env(safe-area-inset-top, 0px));
        box-sizing: border-box;
        max-width: 100vw;
      }
      .navbar-brand {
        font-size: 0.95rem;
        gap: 8px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .view-mode-btn {
        margin-left: 6px;
        padding: 5px 8px;
        font-size: 0.72rem;
      }
      @media (max-width: 480px) {
        .mode-label { display: none; }
      }
      .portfolio-section {
        padding-inline: clamp(14px, 4vw, 20px);
        min-height: 100svh;
        box-sizing: border-box;
        max-width: 100vw;
      }
      .hero-section {
        min-height: 100svh;
        justify-content: center;
        padding-top: 60px;
      }
      .hero-avatar-wrap {
        width: clamp(92px, 24vw, 120px);
        height: clamp(92px, 24vw, 120px);
        margin-bottom: 18px;
      }
      .hero-name {
        font-size: clamp(1.8rem, 8.5vw, 2.65rem);
        line-height: 1.02;
        text-wrap: balance;
        margin-bottom: 8px;
        word-break: normal;
        overflow-wrap: normal;
        hyphens: none;
        letter-spacing: -0.04em;
        max-width: 100%;
      }
      .hero-profession {
        font-size: clamp(0.9rem, 3.8vw, 1.15rem);
        line-height: 1.3;
        margin-bottom: 12px;
        max-width: 90%;
      }
      .hero-badge {
        font-size: 0.75rem;
        padding: 5px 14px;
        margin-bottom: 14px;
      }
      .hero-tagline {
        font-size: clamp(0.88rem, 3.5vw, 1.05rem);
        line-height: 1.4;
        max-width: 90%;
        margin-bottom: 24px;
      }
      .hero-actions {
        flex-direction: column;
        width: 100%;
        gap: 10px;
      }
      .hero-actions .btn {
        width: min(100%, 320px);
        height: 50px;
        font-size: 0.85rem;
      }
      .hero-actions .btn-secondary {
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid rgba(255, 255, 255, 0.16);
        color: rgba(255, 255, 255, 0.9);
        box-shadow: none;
      }
      .project-card, .glass-card {
        padding: 18px;
      }
      .project-links .btn { flex-basis: 100%; }
      .project-meta { align-items: flex-start; flex-direction: column; gap: 4px; }
      .portfolio-section { scroll-margin-top: 68px; }
    }

    /* ─── VIEW MODE SWITCHER & RECRUITER STYLES ─── */
    .view-mode-btn {
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.16);
      color: #fff;
      padding: 6px 14px;
      border-radius: 20px;
      font-size: 0.78rem;
      font-weight: 700;
      font-family: 'Outfit', sans-serif;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: all 0.25s ease;
      margin-left: 12px;
    }
    .view-mode-btn:hover, .view-mode-btn.active {
      background: linear-gradient(135deg, var(--primary), var(--secondary));
      border-color: rgba(255, 255, 255, 0.4);
      box-shadow: 0 4px 15px rgba(124, 58, 237, 0.3);
    }

    /* Recruiter Mode Container Adaptations */
    [data-view-mode="recruiter"] .portfolio-section {
      padding: 50px 24px !important;
      min-height: auto !important;
    }
    [data-view-mode="recruiter"] .glass-card {
      background: rgba(12, 12, 28, 0.85) !important;
      border-color: rgba(255, 255, 255, 0.15) !important;
    }
    [data-view-mode="recruiter"] .hero-section {
      min-height: 70vh !important;
      padding-top: 40px !important;
    }
    [data-view-mode="recruiter"] .recruiter-summary-block {
      display: flex !important;
      gap: 12px;
      flex-wrap: wrap;
      justify-content: center;
      margin: 16px 0;
    }
    .recruiter-summary-block {
      display: none;
    }
    .recruiter-badge-item {
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.12);
      padding: 6px 14px;
      border-radius: 12px;
      font-size: 0.8rem;
      color: rgba(255, 255, 255, 0.9);
      font-weight: 600;
    }

    /* ─── EXPERIENCE TIMELINE STYLES ─── */
    .experience-timeline {
      display: flex;
      flex-direction: column;
      gap: 20px;
      max-width: 800px;
      margin: 0 auto;
      position: relative;
    }
    .experience-timeline::before {
      content: '';
      position: absolute;
      left: 20px;
      top: 10px;
      bottom: 10px;
      width: 2px;
      background: linear-gradient(to bottom, var(--primary), var(--secondary), rgba(255,255,255,0.05));
    }
    .timeline-item {
      position: relative;
      padding-left: 48px !important;
      text-align: left;
    }
    .timeline-dot {
      position: absolute;
      left: 14px;
      top: 24px;
      width: 14px;
      height: 14px;
      border-radius: 50%;
      background: var(--primary);
      box-shadow: 0 0 12px var(--primary);
      border: 2px solid #05050e;
    }
    .exp-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 16px;
      flex-wrap: wrap;
      margin-bottom: 8px;
    }
    .exp-role {
      font-size: 1.25rem;
      font-weight: 800;
      color: #fff;
      margin-bottom: 4px;
    }
    .exp-company {
      font-size: 0.92rem;
      color: var(--secondary);
      font-weight: 700;
    }
    .exp-company a {
      color: var(--secondary);
      text-decoration: none;
    }
    .exp-location {
      font-size: 0.8rem;
      color: rgba(255, 255, 255, 0.6);
      margin-left: 8px;
      font-weight: normal;
    }
    .exp-dates-badge {
      background: rgba(124, 58, 237, 0.2);
      border: 1px solid rgba(124, 58, 237, 0.4);
      color: rgba(255, 255, 255, 0.95);
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 0.78rem;
      font-weight: 700;
      font-family: 'JetBrains Mono', monospace;
    }
    .exp-desc {
      font-size: 0.92rem;
      line-height: 1.5;
      color: rgba(255, 255, 255, 0.8);
      margin-bottom: 12px;
    }
    .exp-achievements {
      margin: 8px 0 12px 18px;
      padding: 0;
      color: rgba(255, 255, 255, 0.85);
      font-size: 0.88rem;
      line-height: 1.5;
    }
    .exp-achievements li {
      margin-bottom: 6px;
    }
    .exp-tech-tags {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    .tech-pill {
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.12);
      padding: 3px 10px;
      border-radius: 10px;
      font-size: 0.75rem;
      color: rgba(255, 255, 255, 0.8);
      font-family: 'JetBrains Mono', monospace;
    }

    /* ─── EDUCATION STYLES ─── */
    .education-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 20px;
      max-width: 900px;
      margin: 0 auto;
    }
    .education-card {
      text-align: left;
    }
    .edu-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 8px;
      gap: 12px;
    }
    .edu-degree {
      font-size: 1.15rem;
      font-weight: 800;
      color: #fff;
    }
    .edu-institution {
      font-size: 0.88rem;
      color: var(--secondary);
      margin-top: 2px;
    }
    .edu-dates {
      font-size: 0.78rem;
      font-family: 'JetBrains Mono', monospace;
      color: rgba(255, 255, 255, 0.6);
      background: rgba(255, 255, 255, 0.05);
      padding: 4px 10px;
      border-radius: 10px;
    }
    .edu-field {
      font-size: 0.85rem;
      color: rgba(255, 255, 255, 0.8);
      margin-bottom: 6px;
    }
    .grade-badge {
      background: rgba(16, 185, 129, 0.2);
      color: #10b981;
      border: 1px solid rgba(16, 185, 129, 0.4);
      padding: 2px 8px;
      border-radius: 8px;
      font-weight: 700;
    }

    /* ─── PRINT-FRIENDLY STYLESHEET ─── */
    @media print {
      #preview-canvas, .intro-skip-btn, .portfolio-navbar, .mobile-menu-panel, .view-mode-btn, .btn, .project-cinema-modal, .scroll-indicator {
        display: none !important;
      }
      body, #portfolio-scroll-container {
        background: #fff !important;
        color: #111 !important;
        overflow: visible !important;
      }
      .glass-card, .portfolio-section {
        background: #fff !important;
        border: 1px solid #ddd !important;
        box-shadow: none !important;
        color: #111 !important;
        page-break-inside: avoid;
        padding: 16px !important;
      }
      .hero-name, .section-title, .exp-role, .edu-degree {
        color: #111 !important;
      }
      .exp-dates-badge, .grade-badge, .tech-pill {
        border: 1px solid #999 !important;
        color: #333 !important;
        background: #eee !important;
      }
    }

    ${getProjectCinemaCSS()}
  `;
}

/**
 * Generate Complete Scrollable HTML Body Document Tree
 */
export function generatePortfolioHTMLBody(portfolioData, theme, options = {}) {
  const isProUser = portfolioData.isPro || false;
  const hideWatermark = isProUser && portfolioData.hideWatermark;
  const hideThemeBadge = isProUser && portfolioData.hideThemeBadge;
  const deviceMode = options.deviceMode || 'desktop';
  const viewMode = portfolioData.viewMode || 'cinematic';

  const primaryHex = '#' + (theme.primaryColor || 0x7c3aed).toString(16).padStart(6, '0');
  const secondaryHex = '#' + (theme.secondaryColor || 0x06b6d4).toString(16).padStart(6, '0');

  const avatarSrc = safeImageSrc(typeof portfolioData.avatar === 'object' ? portfolioData.avatar.publicUrl : (portfolioData.avatar || ''));
  const avatarImgTag = avatarSrc ? `
    <img src="${escapeHTML(avatarSrc)}" alt="${escapeHTML(portfolioData.name || 'Portfolio owner')}" style="transform: scale(${portfolioData.avatarZoom || 1}) translate(${portfolioData.avatarPosX || 0}px, ${portfolioData.avatarPosY || 0}px);"/>
  ` : '';

  const hasExperience = Array.isArray(portfolioData.experience) && portfolioData.experience.length > 0;
  const hasEducation = Array.isArray(portfolioData.education) && portfolioData.education.length > 0;
  const hasProjects = Array.isArray(portfolioData.projects) && portfolioData.projects.length > 0;
  const hasSkills = Array.isArray(portfolioData.skills) && portfolioData.skills.length > 0;
  const hasCerts = Array.isArray(portfolioData.certs) && portfolioData.certs.length > 0;
  
  const resumeURL = safeResumeHref(portfolioData.resume ? (portfolioData.resume.publicUrl || portfolioData.resume.signedUrl || portfolioData.resume.dataUrl || portfolioData.resume.url) : null);
  const hasValidResume = Boolean(resumeURL || (portfolioData.resume && portfolioData.resume.storagePath));

  const expStats = calculateProfessionalExperience(portfolioData.experience || []);
  const availabilityStatus = portfolioData.availability?.status;
  const availabilityBadgeText = availabilityStatus === 'open' ? '🟢 Open to Opportunities' :
                                (availabilityStatus === 'freelance' ? '💻 Available for Freelance' :
                                (availabilityStatus === 'custom' ? escapeHTML(portfolioData.availability?.text || '') : ''));

  const sectionsList = [
    { id: 'hero', name: 'Hero', title: 'HOME', sub: 'Return to top' },
    { id: 'about', name: 'About', title: 'ABOUT', sub: 'Who I am' },
    ...(hasExperience ? [{ id: 'experience', name: 'Experience', title: 'EXPERIENCE', sub: 'Career journey' }] : []),
    ...(hasProjects ? [{ id: 'projects', name: 'Projects', title: 'PROJECTS', sub: 'Selected work' }] : []),
    ...(hasSkills ? [{ id: 'skills', name: 'Skills', title: 'SKILLS', sub: 'Tools & expertise' }] : []),
    ...(hasEducation ? [{ id: 'education', name: 'Education', title: 'EDUCATION', sub: 'Academic degree' }] : []),
    ...(hasCerts ? [{ id: 'certs', name: 'Certs', title: 'CERTIFICATES', sub: 'Qualifications' }] : []),
    { id: 'contact', name: 'Contact', title: 'CONTACT', sub: "Let's connect" }
  ];

  return `
    <div id="portfolio-scroll-container" data-device="${deviceMode}" data-view-mode="${viewMode}">
      <button class="intro-skip-btn" onclick="skipIntro()" style="display:none;">
        <span>Skip Intro</span> ➔
      </button>

      <!-- TOP STICKY NAVBAR -->
      <header class="portfolio-navbar">
        <a href="#sec-hero" class="navbar-brand">
          ${avatarSrc ? `<img class="brand-avatar" src="${escapeHTML(avatarSrc)}" alt="${escapeHTML(portfolioData.name || 'Portfolio owner')}" style="transform: scale(${portfolioData.avatarZoom || 1}) translate(${portfolioData.avatarPosX || 0}px, ${portfolioData.avatarPosY || 0}px);"/>` : '<span class="brand-icon">✦</span>'}
          <span class="brand-name">${escapeHTML(portfolioData.name || 'Portfolio')}</span>
        </a>
        <nav class="navbar-links">
          ${sectionsList.map((sec, i) => `<a href="#sec-${sec.id}" class="nav-link ${i === 0 ? 'active' : ''}" data-section="${sec.id}">${sec.name}</a>`).join('')}
        </nav>
        <div style="display:flex;align-items:center;">
          <button class="view-mode-btn ${viewMode === 'recruiter' ? 'active' : ''}" onclick="toggleViewMode()" aria-label="Toggle Recruiter Mode" title="Switch to Recruiter View">
            <span class="mode-icon">⚡</span>
            <span class="mode-label">Recruiter View</span>
          </button>
          <button id="mobile-menu-btn" class="mobile-menu-btn" onclick="toggleMobileMenu(true)" aria-label="Toggle Navigation" aria-expanded="false" aria-controls="mobile-menu-panel">
            <span>☰</span>
          </button>
        </div>
      </header>

      <!-- DEDICATED FULL-SCREEN CINEMATIC MOBILE MENU -->
      <div id="mobile-menu-panel" class="mobile-menu-panel" role="dialog" aria-modal="true" aria-label="Mobile Navigation Menu" aria-hidden="true" inert>
        <div class="mobile-menu-inner">
          <div class="mobile-menu-top">
            <span class="mobile-menu-brand">${escapeHTML(portfolioData.name || 'PORTFOLIO')}</span>
            <button id="mobile-menu-close" class="mobile-menu-close" onclick="closeMobileMenu()" aria-label="Close navigation">✕</button>
          </div>

          <nav class="mobile-menu-nav" aria-label="Portfolio navigation">
            <button class="mobile-nav-link view-mode-btn-mobile" onclick="toggleViewMode(); closeMobileMenu();" style="background: linear-gradient(135deg, rgba(124,58,237,0.25), rgba(6,182,212,0.2)); border-color: rgba(124,58,237,0.4);">
              <span class="nav-index">⚡</span>
              <span class="nav-text-wrap">
                <span class="nav-title">RECRUITER VIEW</span>
                <span class="nav-sub">Clean scannable layout</span>
              </span>
            </button>
            ${sectionsList.map((sec, i) => `
              <button class="mobile-nav-link" data-section="${sec.id}" onclick="closeMobileMenu()">
                <span class="nav-index">0${i + 1}</span>
                <span class="nav-text-wrap">
                  <span class="nav-title">${sec.title}</span>
                  <span class="nav-sub">${sec.sub}</span>
                </span>
              </button>
            `).join('')}
          </nav>
        </div>
      </div>

      <!-- MAIN SCROLLABLE SECTIONS STACK -->
      <main class="portfolio-main">
        <!-- HERO SECTION -->
        <section id="sec-hero" class="portfolio-section hero-section" data-section="hero">
          <div class="hero-content">
            ${portfolioData.avatar ? `<div class="hero-avatar-wrap">${avatarImgTag}</div>` : ''}
            <h1 class="hero-name">${escapeHTML(portfolioData.name || 'Your Name')}</h1>
            <p class="hero-profession">${escapeHTML(portfolioData.profession || 'Your Profession')}</p>
            ${!hideThemeBadge ? `<div class="hero-badge">✦ ${escapeHTML(theme.name || '3D World')}</div>` : ''}
            ${portfolioData.tagline ? `<p class="hero-tagline">${escapeHTML(portfolioData.tagline)}</p>` : ''}
            
            <div class="recruiter-summary-block">
              ${expStats.roleCount > 0 ? `<span class="recruiter-badge-item">💼 ${expStats.roleCount} Professional Role${expStats.roleCount > 1 ? 's' : ''}</span>` : ''}
              ${expStats.label ? `<span class="recruiter-badge-item">✨ ${escapeHTML(expStats.label)}</span>` : ''}
              ${portfolioData.profession ? `<span class="recruiter-badge-item">👨‍💻 ${escapeHTML(portfolioData.profession)}</span>` : ''}
              ${portfolioData.location ? `<span class="recruiter-badge-item">📍 ${escapeHTML(portfolioData.location)}</span>` : ''}
              ${availabilityBadgeText ? `<span class="recruiter-badge-item">${availabilityBadgeText}</span>` : ''}
            </div>

            <div class="hero-actions">
              ${hasProjects ? `<a href="#sec-projects" class="btn btn-primary">Explore Projects ↓</a>` : ''}
              ${hasValidResume ? `<a href="${escapeHTML(resumeURL)}" download="${escapeHTML(portfolioData.resume.fileName || 'Resume.pdf')}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary resume-btn">📄 ${escapeHTML(portfolioData.resume.buttonText || 'Download Resume')}</a>` : ''}
              <a href="#sec-contact" class="btn btn-secondary">Get In Touch</a>
            </div>
          </div>
          <div class="scroll-indicator">
            <span>Scroll to Explore</span>
            <div class="arrow-down">↓</div>
          </div>
        </section>

        <!-- ABOUT SECTION -->
        <section id="sec-about" class="portfolio-section" data-section="about">
          <div class="section-container">
            <h2 class="section-title">About Me</h2>
            <div class="glass-card about-card">
              <p class="about-bio">${escapeHTML(portfolioData.bio || 'Welcome to my interactive 3D portfolio! Scroll down to explore my experience, projects, skills, and background.')}</p>
              ${portfolioData.location ? `<div class="about-location">📍 ${escapeHTML(portfolioData.location)}</div>` : ''}
            </div>
          </div>
        </section>

        <!-- EXPERIENCE SECTION -->
        ${generateExperienceHTML(portfolioData.experience)}

        <!-- PROJECTS SECTION -->
        ${hasProjects ? `
          <section id="sec-projects" class="portfolio-section" data-section="projects">
            <div class="section-container">
              <h2 class="section-title">Featured Projects</h2>
              <div class="projects-grid">
                ${renderProjectsHTML(portfolioData.projects, primaryHex, secondaryHex)}
              </div>
            </div>
          </section>
        ` : ''}

        <!-- SKILLS SECTION -->
        ${hasSkills ? `
          <section id="sec-skills" class="portfolio-section" data-section="skills">
            <div class="section-container">
              <h2 class="section-title">Technical Expertise</h2>
              <div class="skills-grid">
                ${renderSkillsHTML(portfolioData.skills)}
              </div>
            </div>
          </section>
        ` : ''}

        <!-- EDUCATION SECTION -->
        ${generateEducationHTML(portfolioData.education)}

        <!-- CERTS SECTION -->
        ${hasCerts ? `
          <section id="sec-certs" class="portfolio-section" data-section="certs">
            <div class="section-container">
              <h2 class="section-title">Certifications & Achievements</h2>
              <div class="certs-grid">
                ${renderCertsHTML(portfolioData.certs)}
              </div>
            </div>
          </section>
        ` : ''}

        <!-- VOLUNTEERING SECTION -->
        ${generateVolunteeringHTML(portfolioData.volunteering)}

        <!-- CONTACT SECTION -->
        <section id="sec-contact" class="portfolio-section" data-section="contact">
          <div class="section-container">
            <div class="glass-card contact-card">
              <h2 class="section-title" style="margin-bottom: 12px;">Let's Connect</h2>
              <p class="contact-msg">${escapeHTML(portfolioData.contactMessage || 'Feel free to reach out for collaborations or opportunities.')}</p>
              <div class="contact-links">
                ${safeExternalHref(`mailto:${portfolioData.social?.email || ''}`, { allowMailto: true }) ? `<a href="${escapeHTML(safeExternalHref(`mailto:${portfolioData.social.email}`, { allowMailto: true }))}" class="btn btn-primary">✉ Email Me</a>` : ''}
                ${hasValidResume ? `<a href="${escapeHTML(resumeURL)}" download="${escapeHTML(portfolioData.resume.fileName || 'Resume.pdf')}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary">📄 Download Resume</a>` : ''}
                ${safeExternalHref(portfolioData.social?.github) ? `<a href="${escapeHTML(safeExternalHref(portfolioData.social.github))}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary">💻 GitHub</a>` : ''}
                ${safeExternalHref(portfolioData.social?.linkedin) ? `<a href="${escapeHTML(safeExternalHref(portfolioData.social.linkedin))}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary">LinkedIn</a>` : ''}
                ${safeExternalHref(portfolioData.social?.twitter) ? `<a href="${escapeHTML(safeExternalHref(portfolioData.social.twitter))}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary">Twitter</a>` : ''}
                ${safeExternalHref(portfolioData.social?.website) ? `<a href="${escapeHTML(safeExternalHref(portfolioData.social.website))}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary">Website</a>` : ''}
              </div>
            </div>
          </div>
        </section>
      </main>

      <!-- FOOTER -->
      <footer class="portfolio-footer">
        ${!hideWatermark ? `
          <div class="watermark-pill">
            <span class="watermark-icon">⚡</span>
            <span>Built with <strong>Ultra 3D Portfolio Maker</strong></span>
          </div>
        ` : ''}
        <p>© ${new Date().getFullYear()} ${escapeHTML(portfolioData.name || '')}. All rights reserved.</p>
      </footer>

      ${generateProjectCinemaHTML(portfolioData.projects || [], theme)}
    </div>
  `;
}

function generateExperienceHTML(experienceList) {
  if (!Array.isArray(experienceList) || experienceList.length === 0) return '';
  const items = experienceList.map((exp, idx) => {
    const dates = exp.startDate ? `${escapeHTML(exp.startDate)} — ${exp.current ? 'Present' : escapeHTML(exp.endDate || '')}` : '';
    const achievementsList = Array.isArray(exp.achievements) && exp.achievements.length > 0 ? `
      <ul class="exp-achievements">
        ${exp.achievements.map(a => `<li>${escapeHTML(a)}</li>`).join('')}
      </ul>
    ` : '';
    const techTags = Array.isArray(exp.technologies) && exp.technologies.length > 0 ? `
      <div class="exp-tech-tags">
        ${exp.technologies.map(t => `<span class="tech-pill">${escapeHTML(t)}</span>`).join('')}
      </div>
    ` : '';

    return `
      <div class="timeline-item glass-card" data-exp-id="${exp.id || idx}">
        <div class="timeline-dot"></div>
        <div class="exp-header">
          <div>
            <h3 class="exp-role">${escapeHTML(exp.role || 'Role')}</h3>
            <div class="exp-company">${safeExternalHref(exp.companyUrl) ? `<a href="${escapeHTML(safeExternalHref(exp.companyUrl))}" target="_blank" rel="noopener noreferrer">${escapeHTML(exp.company)}</a>` : escapeHTML(exp.company || '')} ${exp.location ? `<span class="exp-location">📍 ${escapeHTML(exp.location)}</span>` : ''}</div>
          </div>
          ${dates ? `<div class="exp-dates-badge">${dates}</div>` : ''}
        </div>
        ${exp.description ? `<p class="exp-desc">${escapeHTML(exp.description)}</p>` : ''}
        ${achievementsList}
        ${techTags}
      </div>
    `;
  }).join('');

  return `
    <section id="sec-experience" class="portfolio-section experience-section" data-section="experience">
      <div class="section-container">
        <h2 class="section-title">💼 Professional Experience</h2>
        <p class="section-subtitle" style="margin-bottom: 24px; color: rgba(255,255,255,0.6); font-size: 0.9rem;">Career journey, technical impact, and leadership</p>
        <div class="experience-timeline">
          ${items}
        </div>
      </div>
    </section>
  `;
}

function generateEducationHTML(educationList) {
  if (!Array.isArray(educationList) || educationList.length === 0) return '';
  const items = educationList.map((edu, idx) => {
    const dates = edu.startDate ? `${escapeHTML(edu.startDate)} — ${escapeHTML(edu.endDate || '')}` : '';
    return `
      <div class="education-card glass-card">
        <div class="edu-header">
          <div>
            <h3 class="edu-degree">${escapeHTML(edu.degree || 'Degree')}</h3>
            <div class="edu-institution">🏛️ ${escapeHTML(edu.institution || '')} ${edu.location ? `· ${escapeHTML(edu.location)}` : ''}</div>
          </div>
          ${dates ? `<div class="edu-dates">${dates}</div>` : ''}
        </div>
        ${edu.field ? `<div class="edu-field">Field of Study: <strong>${escapeHTML(edu.field)}</strong></div>` : ''}
        ${edu.grade ? `<div class="edu-grade" style="margin-top: 6px; font-size: 0.82rem; color: rgba(255,255,255,0.85);">Honors / Grade: <span class="grade-badge">${escapeHTML(edu.grade)}</span></div>` : ''}
        ${edu.description ? `<p class="edu-desc" style="margin-top: 8px; font-size: 0.88rem; color: rgba(255,255,255,0.75); line-height: 1.5;">${escapeHTML(edu.description)}</p>` : ''}
      </div>
    `;
  }).join('');

  return `
    <section id="sec-education" class="portfolio-section education-section" data-section="education">
      <div class="section-container">
        <h2 class="section-title">🎓 Education & Academic Background</h2>
        <p class="section-subtitle" style="margin-bottom: 24px; color: rgba(255,255,255,0.6); font-size: 0.9rem;">Degrees, qualifications, and academic foundation</p>
        <div class="education-grid">
          ${items}
        </div>
      </div>
    </section>
  `;
}

function renderProjectsHTML(projects, primary, secondary) {
  if (!projects || projects.length === 0) {
    return '<div class="glass-card" style="padding: 24px; text-align: center; color: rgba(255,255,255,0.6);">No projects added yet.</div>';
  }
  return projects.map((p, i) => `
    <div class="glass-card project-card">
      ${safeImageSrc(p.image) ? `
        <div class="project-img-wrap">
        <img src="${escapeHTML(safeImageSrc(p.image))}" alt="${escapeHTML(p.name || 'Project image')}" loading="lazy" decoding="async" />
        </div>
      ` : `
        <div class="project-img-wrap project-img-placeholder" role="img" aria-label="Project preview unavailable"><span class="project-placeholder-icon">✦</span><span>Project preview</span></div>
      `}
      <div class="project-header">
        <span class="project-badge">PROJECT 0${i + 1}</span>
        ${p.tech ? `<span class="project-tech">${escapeHTML(p.tech)}</span>` : ''}
      </div>
      <div class="project-name">${escapeHTML(p.name || 'Project Name')}</div>
      ${(() => { const dates = [p.startDate, p.endDate].filter(Boolean).map(value => escapeHTML(value)).join(' — '); return (p.role || dates) ? `<div class="project-meta">${p.role ? `<span class="project-role">${escapeHTML(p.role)}</span>` : '<span></span>'}${dates ? `<span>${dates}</span>` : ''}</div>` : ''; })()}
      <div class="project-desc">${escapeHTML(p.description || '')}</div>
      ${(p.result || p.outcome) ? `<p class="project-result"><strong>Impact:</strong> ${escapeHTML(p.result || p.outcome)}</p>` : ''}
      <div class="project-links">
        ${safeExternalHref(p.github) ? `<a href="${escapeHTML(safeExternalHref(p.github))}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary project-link-btn" style="padding: 7px 14px; font-size: 0.78rem;">💻 GitHub</a>` : ''}
        ${safeExternalHref(p.url) ? `<a href="${escapeHTML(safeExternalHref(p.url))}" target="_blank" rel="noopener noreferrer" class="btn btn-primary project-link-btn" style="padding: 7px 16px; font-size: 0.78rem;">🌐 View website ↗</a>` : ''}
      </div>
      <button class="btn btn-cinema-trigger" onclick="openProjectCinema(${i})" style="width:100%;margin-top:12px;padding:9px 16px;font-size:0.8rem;background:linear-gradient(135deg,rgba(124,58,237,0.22),rgba(6,182,212,0.22));border:1px solid rgba(124,58,237,0.45);color:#fff;border-radius:12px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;transition:all 0.25s">
        🎬 View Case Study →
      </button>
    </div>
  `).join('');
}

function renderSkillsHTML(skills) {
  if (!skills || skills.length === 0) {
    return '<div class="glass-card" style="padding: 24px; text-align: center; color: rgba(255,255,255,0.6);">No skills added yet.</div>';
  }
  const groups = new Map();
  skills.forEach((rawSkill) => {
    const skill = typeof rawSkill === 'string' ? { name: rawSkill } : (rawSkill || {});
    const name = String(skill.name || skill.text || '').trim();
    if (!name) return;
    const category = String(skill.category || 'Skills').trim() || 'Skills';
    if (!groups.has(category)) groups.set(category, []);
    groups.get(category).push(name);
  });
  if (groups.size === 0) return '<div class="glass-card" style="padding: 24px; text-align: center; color: rgba(255,255,255,0.6);">No skills added yet.</div>';
  return Array.from(groups.entries()).map(([category, names]) => `
    <div class="glass-card skill-card skill-group-card">
      <h3 class="skill-group-title">${escapeHTML(category)}</h3>
      <div class="skill-chips">${names.map(name => `<span class="skill-chip">${escapeHTML(name)}</span>`).join('')}</div>
    </div>
  `).join('');
}

function generateVolunteeringHTML(volList) {
  if (!Array.isArray(volList) || volList.length === 0) return '';
  const items = volList.map((vol) => {
    const dates = vol.startDate ? `${escapeHTML(vol.startDate)} — ${escapeHTML(vol.endDate || 'Present')}` : '';
    return `
      <div class="glass-card" style="padding: 20px; margin-bottom: 12px; border-left: 3px solid var(--secondaryHex, #06b6d4);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
          <h3 style="font-size: 1rem; font-weight: 800; color: #fff; margin: 0;">${escapeHTML(vol.role || 'Member')}</h3>
          ${dates ? `<div style="font-size: 0.75rem; color: rgba(255,255,255,0.6); background: rgba(255,255,255,0.06); padding: 4px 10px; border-radius: 12px;">${dates}</div>` : ''}
        </div>
        <div style="font-size: 0.85rem; color: var(--secondaryHex, #06b6d4); font-weight: 700; margin-bottom: 8px;">🏛️ ${escapeHTML(vol.organization || '')}</div>
        ${vol.description ? `<p style="font-size: 0.85rem; color: rgba(255,255,255,0.75); line-height: 1.5; margin: 0;">${escapeHTML(vol.description)}</p>` : ''}
      </div>
    `;
  }).join('');

  return `
    <section id="sec-volunteering" class="portfolio-section" data-section="volunteering">
      <div class="section-container">
        <h2 class="section-title">🤝 Volunteering & Leadership Activities</h2>
        <div class="volunteering-list">
          ${items}
        </div>
      </div>
    </section>
  `;
}

function renderCertsHTML(certs) {
  if (!certs || certs.length === 0) {
    return '<div class="glass-card" style="padding: 24px; text-align: center; color: rgba(255,255,255,0.6);">No certificates added yet.</div>';
  }
  return certs.map((c, i) => `
    <div class="glass-card cert-card">
      ${c.image ? `<img class="cert-img" src="${escapeHTML(c.image)}" alt="${escapeHTML(c.name || c.title || 'Certificate image')}" loading="lazy" decoding="async" />` : ''}
      <div class="cert-badge">CERTIFICATE 0${i + 1}</div>
      <div class="cert-title">${escapeHTML(c.name || c.title || 'Certificate')}</div>
      <div class="cert-issuer">${escapeHTML(c.issuer || '')} ${c.date ? `(${escapeHTML(c.date)})` : ''}</div>
    </div>
  `).join('');
}

/**
 * Client-Side JavaScript for Smooth Scroll & IntersectionObserver Camera Movement
 */
export function getPortfolioScript(sectionFlyToCallbackName = 'flyToSection') {
  return `
    document.addEventListener('DOMContentLoaded', function() {
      initScrollNavigation();
    });

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      initScrollNavigation();
    }

    function initScrollNavigation() {
      const links = document.querySelectorAll('.nav-link, .hero-actions a, .navbar-brand');
      links.forEach(link => {
        link.addEventListener('click', function(e) {
          const href = this.getAttribute('href');
          if (href && href.startsWith('#')) {
            e.preventDefault();
            const targetId = href.substring(1);
            const targetEl = document.getElementById(targetId);
            if (targetEl) {
              targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
          }
        });
      });

      // 3D Parallax Mouse Tilt on Glass Cards
      document.querySelectorAll('.glass-card').forEach(card => {
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

      // IntersectionObserver for active section link & 3D Camera transitions
      const sections = document.querySelectorAll('.portfolio-section');
      const navLinks = document.querySelectorAll('.nav-link');

      const observer = new IntersectionObserver((entries) => {
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
            if (window.${sectionFlyToCallbackName} && typeof window.${sectionFlyToCallbackName} === 'function') {
              window.${sectionFlyToCallbackName}(sectionId);
            }
          }
        });
      }, { threshold: 0.35 });

      sections.forEach(sec => observer.observe(sec));

      // Header Scroll Blur Listener
      const navbar = document.querySelector('.portfolio-navbar');
      if (navbar) {
        const handleNavScroll = () => {
          const scrollY = window.scrollY || (document.getElementById('preview-scroll-viewport') ? document.getElementById('preview-scroll-viewport').scrollTop : 0);
          if (scrollY > 50) {
            navbar.classList.add('scrolled');
          } else {
            navbar.classList.remove('scrolled');
          }
        };
        window.addEventListener('scroll', handleNavScroll, { passive: true });
        const viewport = document.getElementById('preview-scroll-viewport');
        if (viewport) viewport.addEventListener('scroll', handleNavScroll, { passive: true });
      }
    }

    window.toggleMobileMenu = function(forceState) {
      const panel = document.getElementById('mobile-menu-panel');
      const btn = document.getElementById('mobile-menu-btn') || document.querySelector('.mobile-menu-btn');
      const closeBtn = document.getElementById('mobile-menu-close') || document.querySelector('.mobile-menu-close');
      const viewport = document.getElementById('preview-scroll-viewport') || document.getElementById('portfolio-scroll-container') || document.body;

      if (!panel) return;

      const isActive = panel.classList.contains('active');
      const nextState = forceState !== undefined ? Boolean(forceState) : !isActive;

      if (nextState) {
        panel.classList.add('active');
        panel.removeAttribute('inert');
        panel.setAttribute('aria-hidden', 'false');
        if (btn) btn.setAttribute('aria-expanded', 'true');
        if (viewport) viewport.style.overflow = 'hidden';
        if (closeBtn && typeof closeBtn.focus === 'function') {
          setTimeout(() => closeBtn.focus(), 50);
        }
      } else {
        panel.classList.remove('active');
        panel.setAttribute('inert', '');
        panel.setAttribute('aria-hidden', 'true');
        if (btn) btn.setAttribute('aria-expanded', 'false');
        if (viewport) viewport.style.overflow = 'auto';
        if (btn && typeof btn.focus === 'function') {
          btn.focus();
        }
      }
    };

    window.openMobileMenu = function() { window.toggleMobileMenu(true); };
    window.closeMobileMenu = function() { window.toggleMobileMenu(false); };

    window.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' || e.keyCode === 27) {
        window.closeMobileMenu();
      }
    });

    ${getProjectCinemaScript()}
  `;
}
