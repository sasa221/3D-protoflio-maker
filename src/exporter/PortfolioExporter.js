/**
 * PortfolioExporter.js - Pure Packaging Layer
 * Exports a 1:1 Standalone Scrollable 3D Portfolio Website with Cinematic Intro Opening Sequence.
 * Packages canonical HTML/CSS from PortfolioRenderer.js, and serializes
 * shared CinematicProfiles.js, ThemeSceneConfig.js, and IntroProfiles.js.
 */

import { encodePortfolioToURL, incrementStat } from '../services/DBService.js';
import {
  getCurrentPortfolioConfig,
  generatePortfolioCSS,
  generatePortfolioHTMLBody,
  getPortfolioScript
} from '../renderer/PortfolioRenderer.js';
import { CINEMATIC_PROFILES } from '../three/CinematicProfiles.js';
import { THEME_SCENE_CONFIG } from '../three/ThemeSceneConfig.js';
import { INTRO_PROFILES } from '../three/IntroProfiles.js';

import { resolvePortfolioVariant } from '../services/PortfolioVariantService.js';
import { globalEntitlements, CAPABILITIES } from '../services/EntitlementService.js';

function applyExportEntitlements(portfolioData = {}) {
  const canRemoveBranding = globalEntitlements.can(CAPABILITIES.REMOVE_BRANDING);
  return {
    ...portfolioData,
    isPro: canRemoveBranding,
    hideWatermark: canRemoveBranding && Boolean(portfolioData.hideWatermark),
    hideThemeBadge: canRemoveBranding && Boolean(portfolioData.hideThemeBadge)
  };
}

export async function generateShareableURL(portfolioData) {
  const resolved = resolvePortfolioVariant(applyExportEntitlements(portfolioData));
  await incrementStat('total_shares');
  return encodePortfolioToURL(resolved);
}

export function buildPortfolioHTMLContent(portfolioData, theme) {
  const resolved = resolvePortfolioVariant(applyExportEntitlements(portfolioData));
  return buildPortfolioHTML(resolved, theme);
}

export async function exportStandaloneHTML(portfolioData, theme) {
  await incrementStat('total_exports');
  const resolved = resolvePortfolioVariant(applyExportEntitlements(portfolioData));
  const html = buildPortfolioHTML(resolved, theme);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${(resolved.name || 'portfolio').toLowerCase().replace(/\s+/g, '_')}_${(resolved.activeVariant?.slug || 'version')}_3d_portfolio.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function escapeHTML(str) {
  return (str || '').replace(/[&<>"']/g, m => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }[m]));
}

function buildPortfolioHTML(data, theme) {
  const resolved = resolvePortfolioVariant(data);
  const config = getCurrentPortfolioConfig(resolved, theme);
  const activeTheme = config.theme;

  const primaryHex = '#' + (activeTheme.primaryColor || 0x7c3aed).toString(16).padStart(6, '0');
  const secondaryHex = '#' + (activeTheme.secondaryColor || 0x06b6d4).toString(16).padStart(6, '0');
  const accentHex = '#' + (activeTheme.accentColor || 0xff007f).toString(16).padStart(6, '0');
  const bgHex = '#' + (activeTheme.bgColor || 0x050508).toString(16).padStart(6, '0');

  const colors = { primary: primaryHex, secondary: secondaryHex, accent: accentHex, bg: bgHex };
  const cssContent = generatePortfolioCSS(colors);
  const bodyHTML = generatePortfolioHTMLBody(config.data, activeTheme);
  const navScript = getPortfolioScript('flyToSection');

  const serializedProfiles = JSON.stringify(CINEMATIC_PROFILES);
  const serializedThemeConfigs = JSON.stringify(THEME_SCENE_CONFIG);
  const serializedIntroProfiles = JSON.stringify(INTRO_PROFILES);
  const activeProfileKey = config.cinematicProfileKey;
  const introMode = config.data.introMode || 'short';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHTML(config.data.name || 'My Portfolio')} — 3D Portfolio</title>
  <meta name="description" content="${escapeHTML(config.data.tagline || config.data.bio || '')}">
  
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700;900&family=Outfit:wght@600;800;900&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet">
  <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>

  <style>
    ${cssContent}
  </style>
</head>
<body>
  <canvas id="bg-canvas"></canvas>

  ${bodyHTML}

  <script>
    // ──────────────────────────────────────────
    // CANONICAL SERIALIZED DATA & CINEMATIC PROFILES
    // ──────────────────────────────────────────
    const CINEMATIC_PROFILES = ${serializedProfiles};
    const THEME_SCENE_CONFIG = ${serializedThemeConfigs};
    const INTRO_PROFILES = ${serializedIntroProfiles};
    const ACTIVE_PROFILE_KEY = "${activeProfileKey}";
    const ACTIVE_THEME = ${JSON.stringify(activeTheme)};
    const INTRO_MODE = "${introMode}";

    function easeInOutQuad(t) {
      return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    }

    // Standalone IntroDirector
    class StandaloneIntroDirector {
      constructor(engine, sceneDirector, scrollDirector) {
        this.engine = engine;
        this.sceneDirector = sceneDirector;
        this.scrollDirector = scrollDirector;
        this.isPlaying = false;
        this.rafId = null;

        this._onKeyDown = this._onKeyDown.bind(this);
        this._onScroll = this._onScroll.bind(this);
      }

      play(mode, theme) {
        if (mode === 'off') {
          this.finish();
          return;
        }

        this.isPlaying = true;
        const isMobile = window.innerWidth <= 640;
        const reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        const profileKey = ACTIVE_PROFILE_KEY;
        const profile = INTRO_PROFILES[profileKey] || INTRO_PROFILES.default;
        
        let durationSec = 2.0;
        if (mode === 'epic') durationSec = isMobile ? 4.0 : 7.0;
        else if (mode === 'cinematic') durationSec = isMobile ? 3.0 : 4.5;
        if (reducedMotion) durationSec = 0.8;

        if (this.engine) {
          if (reducedMotion) {
            this.engine.setCameraState({
              position: { x: profile.heroPos[0], y: profile.heroPos[1], z: profile.heroPos[2] },
              target: { x: profile.heroTarget[0], y: profile.heroTarget[1], z: profile.heroTarget[2] },
              fov: profile.heroFov, parallaxStrength: 8
            });
          } else {
            this.engine.setCameraState({
              position: { x: profile.startPos[0], y: profile.startPos[1], z: profile.startPos[2] },
              target: { x: profile.startTarget[0], y: profile.startTarget[1], z: profile.startTarget[2] },
              fov: profile.startFov, parallaxStrength: 2
            });
          }
        }

        const skipBtn = document.querySelector('.intro-skip-btn');
        if (skipBtn) skipBtn.style.display = 'flex';

        const elements = document.querySelectorAll('.hero-avatar-wrap, .hero-name, .hero-profession, .hero-badge, .hero-tagline, .hero-actions, .portfolio-navbar, .scroll-indicator');
        elements.forEach(el => {
          el.classList.add('intro-hidden');
          el.classList.remove('intro-visible');
        });

        window.addEventListener('keydown', this._onKeyDown);
        window.addEventListener('scroll', this._onScroll, { passive: true });

        const startTime = performance.now();
        const durationMs = durationSec * 1000;

        const animate = (now) => {
          if (!this.isPlaying) return;
          const elapsed = now - startTime;
          const progress = Math.min(1, elapsed / durationMs);
          const t = easeInOutQuad(progress);

          if (this.engine && !reducedMotion) {
            const posX = profile.startPos[0] + (profile.heroPos[0] - profile.startPos[0]) * t;
            const posY = profile.startPos[1] + (profile.heroPos[1] - profile.startPos[1]) * t;
            const posZ = profile.startPos[2] + (profile.heroPos[2] - profile.startPos[2]) * t;

            const tgtX = profile.startTarget[0] + (profile.heroTarget[0] - profile.startTarget[0]) * t;
            const tgtY = profile.startTarget[1] + (profile.heroTarget[1] - profile.startTarget[1]) * t;
            const tgtZ = profile.startTarget[2] + (profile.heroTarget[2] - profile.startTarget[2]) * t;

            const fov = profile.startFov + (profile.heroFov - profile.startFov) * t;

            this.engine.setCameraState({
              position: { x: posX, y: posY, z: posZ },
              target: { x: tgtX, y: tgtY, z: tgtZ },
              fov: fov, parallaxStrength: 2 + 6 * t
            });
          }

          const step = 1 / (elements.length + 1);
          elements.forEach((el, idx) => {
            if (progress >= (idx + 1) * step * 0.7 && !el.classList.contains('intro-visible')) {
              el.classList.remove('intro-hidden');
              el.classList.add('intro-visible');
            }
          });

          if (progress < 1) {
            this.rafId = requestAnimationFrame(animate);
          } else {
            this.finish();
          }
        };

        this.rafId = requestAnimationFrame(animate);
      }

      skip() {
        this.finish();
      }

      finish() {
        this.isPlaying = false;
        if (this.rafId) cancelAnimationFrame(this.rafId);
        window.removeEventListener('keydown', this._onKeyDown);
        window.removeEventListener('scroll', this._onScroll);

        const skipBtn = document.querySelector('.intro-skip-btn');
        if (skipBtn) skipBtn.style.display = 'none';

        const elements = document.querySelectorAll('.hero-avatar-wrap, .hero-name, .hero-profession, .hero-badge, .hero-tagline, .hero-actions, .portfolio-navbar, .scroll-indicator');
        elements.forEach(el => {
          el.classList.remove('intro-hidden');
          el.classList.add('intro-visible');
        });

        if (this.sceneDirector) {
          const heroShot = this.sceneDirector.getShot('hero');
          if (this.engine && heroShot) {
            this.engine.setCameraState({
              position: { x: heroShot.pos[0], y: heroShot.pos[1], z: heroShot.pos[2] },
              target: { x: heroShot.target[0], y: heroShot.target[1], z: heroShot.target[2] },
              fov: heroShot.fov, sceneRotationY: heroShot.rotY, coreScale: heroShot.coreScale, parallaxStrength: heroShot.parallax
            });
          }
          this.sceneDirector.update({ section: 'hero', nextSection: 'about', progress: 0 });
        }
      }

      _onKeyDown(e) { if (e.key === 'Escape' || e.keyCode === 27) this.skip(); }
      _onScroll() { if (this.isPlaying) this.skip(); }
    }

    // Standalone SceneDirector using serialized shared profiles
    class StandaloneSceneDirector {
      constructor(engine) {
        this.engine = engine;
        this.profiles = CINEMATIC_PROFILES;
        this.themeProfile = ACTIVE_PROFILE_KEY;
        this.isProjectFocus = false;
      }

      setProjectFocus(enable = true) {
        this.isProjectFocus = Boolean(enable);
        if (this.isProjectFocus) {
          const shot = this.getShot('projectFocus');
          this.engine?.setCameraState({
            position: { x: shot.pos[0], y: shot.pos[1], z: shot.pos[2] },
            target: { x: shot.target[0], y: shot.target[1], z: shot.target[2] },
            fov: shot.fov, sceneRotationY: shot.rotY, coreScale: shot.coreScale, parallaxStrength: shot.parallax
          });
        }
      }

      setDeviceMode(mode) {
        this.deviceMode = mode;
      }

      setViewMode(mode) {
        this.viewMode = mode;
      }

      getShot(key) {
        const p = this.profiles[this.themeProfile] || this.profiles.default;
        if (this.isProjectFocus && key === 'projects') {
          return p.projectFocus || p.projects || p.hero;
        }

        const isMobile = this.deviceMode === 'mobile' || window.innerWidth <= 640;
        if (key === 'hero' && isMobile && p.mobileHero) {
          return p.mobileHero;
        }

        return p[key] || p.hero;
      }

      update({ section, nextSection, progress }) {
        if (!this.engine || this.isProjectFocus) return;
        const shotA = this.getShot(section || 'hero');
        const shotB = this.getShot(nextSection || section || 'hero');
        const t = easeInOutQuad(Math.max(0, Math.min(1, progress || 0)));
        const isRecruiter = this.viewMode === 'recruiter';
        const motionScale = isRecruiter ? 0.35 : 1.0;

        const posX = shotA.pos[0] + (shotB.pos[0] - shotA.pos[0]) * t * motionScale;
        const posY = shotA.pos[1] + (shotB.pos[1] - shotA.pos[1]) * t * motionScale;
        const posZ = shotA.pos[2] + (shotB.pos[2] - shotA.pos[2]) * t * motionScale;

        const tgtX = shotA.target[0] + (shotB.target[0] - shotA.target[0]) * t * motionScale;
        const tgtY = shotA.target[1] + (shotB.target[1] - shotA.target[1]) * t * motionScale;
        const tgtZ = shotA.target[2] + (shotB.target[2] - shotA.target[2]) * t * motionScale;

        const fov = shotA.fov + (shotB.fov - shotA.fov) * t * motionScale;
        const rotY = (shotA.rotY + (shotB.rotY - shotA.rotY) * t) * (isRecruiter ? 0.3 : 1.0);
        const coreScale = shotA.coreScale + (shotB.coreScale - shotA.coreScale) * t;
        const parallax = (shotA.parallax + (shotB.parallax - shotA.parallax) * t) * (isRecruiter ? 0.25 : 1.0);

        this.engine.setCameraState({
          position: { x: posX, y: posY, z: posZ },
          target: { x: tgtX, y: tgtY, z: tgtZ },
          fov: fov,
          sceneRotationY: rotY,
          coreScale: coreScale,
          parallaxStrength: parallax
        });
      }
    }

    // Standalone ScrollDirector
    class StandaloneScrollDirector {
      constructor(viewport, sceneDirector) {
        this.viewport = viewport || window;
        this.sceneDirector = sceneDirector;
        this.sections = [];
        this.rafId = null;

        this._onScroll = this._onScroll.bind(this);
        this._onResize = this._onResize.bind(this);

        this.init();
      }

      init() {
        this.updateSectionBounds();
        window.addEventListener('scroll', this._onScroll, { passive: true });
        window.addEventListener('resize', this._onResize);
        this._onScroll();
      }

      updateSectionBounds() {
        const sectionEls = document.querySelectorAll('.portfolio-section');
        this.sections = Array.from(sectionEls).map(el => {
          const id = el.getAttribute('data-section') || el.id.replace('sec-', '');
          const rect = el.getBoundingClientRect();
          const top = rect.top + window.scrollY;
          const height = el.offsetHeight;
          return { id, el, top, height };
        });
      }

      _onResize() {
        this.updateSectionBounds();
        this._onScroll();
      }

      _onScroll() {
        if (this.rafId) return;
        this.rafId = requestAnimationFrame(() => {
          this.rafId = null;
          this._calculateProgress();
        });
      }

      _calculateProgress() {
        if (!this.sections || this.sections.length === 0) return;
        const scrollTop = window.scrollY;
        const viewportHeight = window.innerHeight;
        const currentScrollMiddle = scrollTop + viewportHeight * 0.4;

        let activeIdx = 0;
        for (let i = 0; i < this.sections.length; i++) {
          if (currentScrollMiddle >= this.sections[i].top) {
            activeIdx = i;
          }
        }

        const currentSec = this.sections[activeIdx];
        const nextSec = this.sections[Math.min(this.sections.length - 1, activeIdx + 1)];

        let progress = 0;
        if (currentSec && currentSec.height > 0) {
          const sectionScroll = scrollTop - currentSec.top;
          progress = Math.max(0, Math.min(1, sectionScroll / currentSec.height));
        }

        const section = currentSec ? currentSec.id : 'hero';
        const nextSection = (activeIdx < this.sections.length - 1) ? nextSec.id : section;

        if (this.sceneDirector) {
          this.sceneDirector.update({ section, nextSection, progress });
        }
      }
    }

    // Standalone 3D Engine Runtime
    let scene, camera, renderer, sceneDirector, scrollDirector, introDirector;
    let mouse = { x: 0, y: 0 };
    let baseCameraPos = new THREE.Vector3(0, 0, 85);
    let targetCameraPos = new THREE.Vector3(0, 0, 85);
    let baseCameraTarget = new THREE.Vector3(0, 0, 0);
    let targetCameraTarget = new THREE.Vector3(0, 0, 0);
    let targetFov = 62;
    let targetSceneRotY = 0;
    let targetCoreScale = 1;
    let parallaxStrength = 8;
    let coreWireMesh = null;
    let orbitalRings = [];

    const engineWrapper = {
      setCameraState: function(state) {
        if (state.position) targetCameraPos.set(state.position.x, state.position.y, state.position.z);
        if (state.target) targetCameraTarget.set(state.target.x, state.target.y, state.target.z);
        if (state.fov !== undefined) targetFov = state.fov;
        if (state.sceneRotationY !== undefined) targetSceneRotY = state.sceneRotationY;
        if (state.coreScale !== undefined) targetCoreScale = state.coreScale;
        if (state.parallaxStrength !== undefined) parallaxStrength = state.parallaxStrength;
      }
    };

    window.skipIntro = function() {
      if (introDirector) introDirector.skip();
    };

    window.toggleMobileMenu = function(forceState, contextEl) {
      const root = contextEl || document.getElementById('portfolio-scroll-container') || document.body;
      const panel = root.querySelector('#mobile-menu-panel, .mobile-menu-panel') || document.querySelector('#mobile-menu-panel, .mobile-menu-panel');
      const btn = root.querySelector('#mobile-menu-btn, .mobile-menu-btn') || document.querySelector('#mobile-menu-btn, .mobile-menu-btn');
      const closeBtn = root.querySelector('#mobile-menu-close, .mobile-menu-close') || document.querySelector('#mobile-menu-close, .mobile-menu-close');
      const viewport = document.getElementById('portfolio-scroll-container') || document.body;

      if (!panel) return;

      const isActive = panel.classList.contains('active');
      const nextState = forceState !== undefined ? Boolean(forceState) : !isActive;

      if (nextState) {
        panel.classList.add('active');
        panel.style.opacity = '1';
        panel.style.pointerEvents = 'auto';
        panel.style.transform = 'scale(1)';
        if (btn) btn.setAttribute('aria-expanded', 'true');
        if (viewport) viewport.style.overflow = 'hidden';
        if (closeBtn && typeof closeBtn.focus === 'function') {
          setTimeout(() => closeBtn.focus(), 50);
        }
      } else {
        panel.classList.remove('active');
        panel.style.opacity = '0';
        panel.style.pointerEvents = 'none';
        panel.style.transform = 'scale(0.97)';
        if (btn) btn.setAttribute('aria-expanded', 'false');
        if (viewport) viewport.style.overflow = 'auto';
        if (btn && typeof btn.focus === 'function') {
          btn.focus();
        }
      }
    };
    window.openMobileMenu = function(ctx) { window.toggleMobileMenu(true, ctx); };
    window.closeMobileMenu = function(ctx) { window.toggleMobileMenu(false, ctx); };

    window.toggleViewMode = function(forceMode) {
      const container = document.getElementById('portfolio-scroll-container') || document.body;
      const current = container.getAttribute('data-view-mode') || 'cinematic';
      const next = forceMode || (current === 'cinematic' ? 'recruiter' : 'cinematic');
      container.setAttribute('data-view-mode', next);
      document.body.setAttribute('data-view-mode', next);
      document.querySelectorAll('.view-mode-btn').forEach(btn => {
        if (next === 'recruiter') {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      });
    };

    document.addEventListener('click', function(e) {
      const menuBtn = e.target.closest('#mobile-menu-btn, .mobile-menu-btn');
      if (menuBtn) {
        e.preventDefault(); e.stopPropagation();
        window.toggleMobileMenu(true, menuBtn.closest('#portfolio-scroll-container'));
        return;
      }
      const closeBtn = e.target.closest('#mobile-menu-close, .mobile-menu-close');
      if (closeBtn) {
        e.preventDefault(); e.stopPropagation();
        window.toggleMobileMenu(false, closeBtn.closest('#portfolio-scroll-container'));
        return;
      }
      const navLink = e.target.closest('.mobile-nav-link');
      if (navLink) {
        const href = navLink.getAttribute('href');
        if (href && href.startsWith('#')) {
          e.preventDefault();
          const root = navLink.closest('#portfolio-scroll-container') || document;
          window.toggleMobileMenu(false, root);
          const targetId = href.substring(1);
          const targetEl = document.getElementById(targetId);
          if (targetEl) targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    }, true);

    window.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' || e.keyCode === 27) {
        window.closeMobileMenu();
      }
    });

    function init3D() {
      const canvas = document.getElementById('bg-canvas');
      if (!canvas) return;

      scene = new THREE.Scene();
      scene.background = new THREE.Color(ACTIVE_THEME.bgColor || 0x050508);
      scene.fog = new THREE.FogExp2(ACTIVE_THEME.bgColor || 0x050508, 0.002);

      camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 2000);
      camera.position.set(0, 0, 85);

      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

      // Lighting
      const ambient = new THREE.AmbientLight(0xffffff, 0.3);
      scene.add(ambient);

      const light1 = new THREE.PointLight(ACTIVE_THEME.primaryColor || 0x7c3aed, 2, 200);
      light1.position.set(50, 50, 50);
      scene.add(light1);

      const light2 = new THREE.PointLight(ACTIVE_THEME.secondaryColor || 0x06b6d4, 1.5, 150);
      light2.position.set(-50, -30, -50);
      scene.add(light2);

      // Build 3D Theme Scene using canonical THEME_SCENE_CONFIG
      buildThemeScene(ACTIVE_THEME);

      // Initialize Standalone SceneDirector, ScrollDirector, & IntroDirector
      sceneDirector = new StandaloneSceneDirector(engineWrapper);
      scrollDirector = new StandaloneScrollDirector(window, sceneDirector);
      introDirector = new StandaloneIntroDirector(engineWrapper, sceneDirector, scrollDirector);
      window.sceneDirector = sceneDirector;

      function syncDeviceMode() {
        const w = window.innerWidth;
        const dev = w <= 640 ? 'mobile' : (w <= 1024 ? 'tablet' : 'desktop');
        document.documentElement.dataset.device = dev;
        document.body.dataset.device = dev;
        const scrollContainer = document.getElementById('portfolio-scroll-container');
        if (scrollContainer) scrollContainer.dataset.device = dev;
        if (sceneDirector) sceneDirector.setDeviceMode(dev);
      }
      syncDeviceMode();
      window.addEventListener('resize', syncDeviceMode);

      // Play Intro Opening Sequence
      introDirector.play(INTRO_MODE, ACTIVE_THEME);

      // Animation Loop
      function animate() {
        requestAnimationFrame(animate);

        const reducedMotion = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const lerpFactor = reducedMotion ? 0.02 : 0.06;

        baseCameraPos.lerp(targetCameraPos, lerpFactor);
        baseCameraTarget.lerp(targetCameraTarget, lerpFactor);

        if (Math.abs(camera.fov - targetFov) > 0.05) {
          camera.fov += (targetFov - camera.fov) * lerpFactor;
          camera.updateProjectionMatrix();
        }

        const pStr = reducedMotion ? 2 : (parallaxStrength || 8);
        const parallaxX = mouse.x * pStr;
        const parallaxY = -mouse.y * (pStr * 0.75);

        camera.position.x = baseCameraPos.x + parallaxX;
        camera.position.y = baseCameraPos.y + parallaxY;
        camera.position.z = baseCameraPos.z;

        camera.lookAt(baseCameraTarget.x, baseCameraTarget.y, baseCameraTarget.z);

        if (scene) scene.rotation.y += (targetSceneRotY - scene.rotation.y) * lerpFactor;
        if (coreWireMesh) {
          const curS = coreWireMesh.scale.x;
          const ns = curS + (targetCoreScale - curS) * lerpFactor;
          coreWireMesh.scale.set(ns, ns, ns);
        }

        orbitalRings.forEach(ring => {
          ring.rotation.z += (ring.userData.speed || 0.01) * 0.01;
        });

        renderer.render(scene, camera);
      }
      animate();

      window.addEventListener('mousemove', e => {
        mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
        mouse.y = (e.clientY / window.innerHeight) * 2 - 1;
      });

      window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
      });
    }

    function buildThemeScene(t) {
      const themeId = (t.id || 'cosmic').toLowerCase();
      const cfg = THEME_SCENE_CONFIG[themeId] || THEME_SCENE_CONFIG.cosmic;

      // 1. Particle Cloud
      const count = cfg.particleCount || 3000;
      const geo = new THREE.BufferGeometry();
      const pos = new Float32Array(count * 3);
      for (let i = 0; i < count * 3; i += 3) {
        pos[i] = (Math.random() - 0.5) * 160;
        pos[i + 1] = (Math.random() - 0.5) * 160;
        pos[i + 2] = (Math.random() - 0.5) * 160;
      }
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const mat = new THREE.PointsMaterial({
        size: 1.2,
        color: t.primaryColor || 0x7c3aed,
        transparent: true,
        opacity: 0.75,
        blending: THREE.AdditiveBlending
      });
      scene.add(new THREE.Points(geo, mat));

      // 2. Core Geometry
      let coreGeo;
      const shape = cfg.shape || 'icosahedron';
      if (shape === 'octahedron') coreGeo = new THREE.OctahedronGeometry(10, 2);
      else if (shape === 'dodecahedron') coreGeo = new THREE.DodecahedronGeometry(10, 0);
      else if (shape === 'torus') coreGeo = new THREE.TorusGeometry(10, 2, 16, 100);
      else if (shape === 'sphere') coreGeo = new THREE.SphereGeometry(10, 32, 32);
      else coreGeo = new THREE.IcosahedronGeometry(10, 2);

      const coreMat = new THREE.MeshBasicMaterial({
        color: t.primaryColor || 0x7c3aed,
        wireframe: cfg.wireframe !== false,
        transparent: true,
        opacity: 0.45
      });
      coreWireMesh = new THREE.Mesh(coreGeo, coreMat);
      scene.add(coreWireMesh);

      // 3. Orbital Rings
      if (cfg.orbitalRings) {
        for (let i = 0; i < cfg.orbitalRings; i++) {
          const ringGeo = new THREE.TorusGeometry(18 + i * 8, 0.15, 8, 120);
          const ringMat = new THREE.MeshBasicMaterial({
            color: i % 2 === 0 ? (t.primaryColor || 0x7c3aed) : (t.accentColor || 0xff007f),
            transparent: true,
            opacity: 0.5 - i * 0.1,
            blending: THREE.AdditiveBlending
          });
          const ring = new THREE.Mesh(ringGeo, ringMat);
          ring.rotation.x = (Math.PI / 4) * (i + 1);
          ring.userData.speed = (0.3 + i * 0.15) * (i % 2 === 0 ? 1 : -1);
          scene.add(ring);
          orbitalRings.push(ring);
        }
      }

      // 4. Data Streams
      if (cfg.dataStreams) {
        for (let i = 0; i < cfg.dataStreams; i++) {
          const p1 = new THREE.Vector3((Math.random() - 0.5) * 120, (Math.random() - 0.5) * 120, (Math.random() - 0.5) * 120);
          const p2 = p1.clone().add(new THREE.Vector3(0, (Math.random() - 0.5) * 40, (Math.random() - 0.5) * 40));
          const lineGeo = new THREE.BufferGeometry().setFromPoints([p1, p2]);
          const lineMat = new THREE.LineBasicMaterial({
            color: i % 2 === 0 ? t.primaryColor : t.secondaryColor,
            transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending
          });
          scene.add(new THREE.Line(lineGeo, lineMat));
        }
      }

      // 5. Bar Charts
      if (cfg.barChart) {
        for (let i = 0; i < 8; i++) {
          const h = 5 + Math.random() * 25;
          const barGeo = new THREE.BoxGeometry(2, h, 2);
          const barMat = new THREE.MeshBasicMaterial({
            color: t.primaryColor, wireframe: true, transparent: true, opacity: 0.6
          });
          const bar = new THREE.Mesh(barGeo, barMat);
          bar.position.set(-20 + i * 6, h / 2 - 20, (Math.random() - 0.5) * 15);
          scene.add(bar);
        }
      }
    }

    init3D();

    ${navScript}
  </script>
</body>
</html>`;
}
