/**
 * IntroDirector.js
 * Manages the cinematic opening sequence, coordinating 3D camera dolly,
 * lighting ramp, and kinetic DOM element reveals.
 * Exposes skip(), scroll-intent interrupt, and seamless hand-off to ScrollDirector.
 */

import { INTRO_PROFILES, getIntroProfileKey, getIntroDuration } from './IntroProfiles.js';

export class IntroDirector {
  constructor(engine, sceneDirector, scrollDirector, options = {}) {
    this.engine = engine;
    this.sceneDirector = sceneDirector;
    this.scrollDirector = scrollDirector;
    this.options = options;

    this.isPlaying = false;
    this.isCompleted = false;
    this.mode = 'short';

    this.rafId = null;
    this.timers = [];
    this.onCompleteCallbacks = [];

    this._onKeyDown = this._onKeyDown.bind(this);
    this._onScrollOrTouch = this._onScrollOrTouch.bind(this);
  }

  play(mode = 'short', theme = {}, containerEl = document) {
    if (mode === 'off') {
      this.finishImmediately(containerEl);
      return;
    }

    this.mode = mode;
    this.isPlaying = true;
    this.isCompleted = false;

    const isMobile = typeof window !== 'undefined' && window.innerWidth <= 640;
    const reducedMotion = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const profileKey = getIntroProfileKey(theme.id);
    const profile = INTRO_PROFILES[profileKey] || INTRO_PROFILES.default;
    const durationSec = reducedMotion ? 0.8 : getIntroDuration(mode, isMobile);

    // Initial camera placement at startPos
    if (this.engine) {
      if (reducedMotion) {
        this.engine.setCameraState({
          position: { x: profile.heroPos[0], y: profile.heroPos[1], z: profile.heroPos[2] },
          target: { x: profile.heroTarget[0], y: profile.heroTarget[1], z: profile.heroTarget[2] },
          fov: profile.heroFov,
          parallaxStrength: 8
        });
      } else {
        this.engine.setCameraState({
          position: { x: profile.startPos[0], y: profile.startPos[1], z: profile.startPos[2] },
          target: { x: profile.startTarget[0], y: profile.startTarget[1], z: profile.startTarget[2] },
          fov: profile.startFov,
          parallaxStrength: 2
        });
      }
    }

    // Prepare DOM elements (hide initially for staggered reveal)
    const container = containerEl || document;
    const skipBtn = container.querySelector('.intro-skip-btn');
    if (skipBtn) skipBtn.style.display = 'flex';

    const elementsToReveal = [
      container.querySelector('.hero-avatar-wrap'),
      container.querySelector('.hero-name'),
      container.querySelector('.hero-profession'),
      container.querySelector('.hero-badge'),
      container.querySelector('.hero-tagline'),
      container.querySelector('.hero-actions'),
      container.querySelector('.portfolio-navbar'),
      container.querySelector('.scroll-indicator')
    ].filter(Boolean);

    elementsToReveal.forEach(el => {
      el.classList.add('intro-hidden');
      el.classList.remove('intro-visible');
    });

    // Listen for Escape key or scroll interrupt
    window.addEventListener('keydown', this._onKeyDown);
    if (container !== document && container.addEventListener) {
      container.addEventListener('scroll', this._onScrollOrTouch, { passive: true });
      container.addEventListener('touchstart', this._onScrollOrTouch, { passive: true });
    } else {
      window.addEventListener('scroll', this._onScrollOrTouch, { passive: true });
    }

    // Animation Loop for camera dolly
    const startTime = performance.now();
    const durationMs = durationSec * 1000;

    const animateIntro = (now) => {
      if (!this.isPlaying) return;
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / durationMs);

      // Smooth progress curve
      const t = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;

      // Dolly camera toward hero camera position
      if (this.engine && !reducedMotion) {
        const posX = profile.startPos[0] + (profile.heroPos[0] - profile.startPos[0]) * t;
        const posY = profile.startPos[1] + (profile.heroPos[1] - profile.startPos[1]) * t;
        const posZ = profile.startPos[2] + (profile.heroPos[2] - profile.startPos[2]) * t;

        const tgtX = profile.startTarget[0] + (profile.heroTarget[0] - profile.startTarget[0]) * t;
        const tgtY = profile.startTarget[1] + (profile.heroTarget[1] - profile.startTarget[1]) * t;
        const tgtZ = profile.startTarget[2] + (profile.heroTarget[2] - profile.startTarget[2]) * t;

        const fov = profile.startFov + (profile.heroFov - profile.startFov) * t;
        const parallax = 2 + (8 - 2) * t;

        this.engine.setCameraState({
          position: { x: posX, y: posY, z: posZ },
          target: { x: tgtX, y: tgtY, z: tgtZ },
          fov: fov,
          parallaxStrength: parallax
        });
      }

      // Staggered DOM reveals
      const step = 1 / (elementsToReveal.length + 1);
      elementsToReveal.forEach((el, idx) => {
        const revealThreshold = (idx + 1) * step * 0.7;
        if (progress >= revealThreshold && !el.classList.contains('intro-visible')) {
          el.classList.remove('intro-hidden');
          el.classList.add('intro-visible');
        }
      });

      if (progress < 1) {
        this.rafId = requestAnimationFrame(animateIntro);
      } else {
        this.finish(container);
      }
    };

    this.rafId = requestAnimationFrame(animateIntro);
  }

  skip(containerEl) {
    if (!this.isPlaying && this.isCompleted) return;
    this.finish(containerEl || document);
  }

  finish(containerEl) {
    this.isPlaying = false;
    this.isCompleted = true;

    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.timers.forEach(t => clearTimeout(t));
    this.timers = [];

    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('scroll', this._onScrollOrTouch);

    const container = containerEl || document;
    const skipBtn = container.querySelector('.intro-skip-btn');
    if (skipBtn) skipBtn.style.display = 'none';

    // Reveal all DOM elements
    const elementsToReveal = container.querySelectorAll('.hero-avatar-wrap, .hero-name, .hero-profession, .hero-badge, .hero-tagline, .hero-actions, .portfolio-navbar, .scroll-indicator');
    elementsToReveal.forEach(el => {
      el.classList.remove('intro-hidden');
      el.classList.add('intro-visible');
    });

    // Place camera cleanly in Hero shot state
    if (this.sceneDirector) {
      const heroShot = this.sceneDirector.getShot('hero');
      if (this.engine && heroShot) {
        this.engine.setCameraState({
          position: { x: heroShot.pos[0], y: heroShot.pos[1], z: heroShot.pos[2] },
          target: { x: heroShot.target[0], y: heroShot.target[1], z: heroShot.target[2] },
          fov: heroShot.fov,
          sceneRotationY: heroShot.rotY,
          coreScale: heroShot.coreScale,
          parallaxStrength: heroShot.parallax
        });
      }
      this.sceneDirector.update({ section: 'hero', nextSection: 'about', progress: 0 });
    }

    // Trigger completion callbacks
    this.onCompleteCallbacks.forEach(cb => {
      try { cb(); } catch (e) { console.error(e); }
    });
  }

  finishImmediately(containerEl) {
    this.finish(containerEl);
  }

  _onKeyDown(e) {
    if (e.key === 'Escape' || e.keyCode === 27) {
      this.skip();
    }
  }

  _onScrollOrTouch() {
    if (this.isPlaying) {
      this.skip();
    }
  }

  onComplete(callback) {
    if (typeof callback === 'function') {
      this.onCompleteCallbacks.push(callback);
    }
  }

  destroy() {
    this.skip();
  }
}
