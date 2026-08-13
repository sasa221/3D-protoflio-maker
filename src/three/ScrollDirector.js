/**
 * ScrollDirector.js
 * Observes the portfolio scroll viewport, detects current & next section,
 * calculates normalized scroll progress (0 -> 1), and notifies SceneDirector.
 */

export class ScrollDirector {
  constructor(viewportEl, sceneDirector, options = {}) {
    this.viewport = viewportEl || window;
    this.sceneDirector = sceneDirector;
    this.options = options;
    this.sections = [];
    this.rafId = null;

    this.state = {
      section: 'hero',
      nextSection: 'about',
      progress: 0
    };

    this._onScroll = this._onScroll.bind(this);
    this._onResize = this._onResize.bind(this);

    this.init();
  }

  init() {
    this.updateSectionBounds();

    if (this.viewport === window) {
      window.addEventListener('scroll', this._onScroll, { passive: true });
      window.addEventListener('resize', this._onResize);
    } else {
      this.viewport.addEventListener('scroll', this._onScroll, { passive: true });
      window.addEventListener('resize', this._onResize);
    }

    this._onScroll();
  }

  updateSectionBounds() {
    const isWindow = this.viewport === window;
    const sectionEls = (isWindow ? document : this.viewport).querySelectorAll('.portfolio-section');
    this.sections = Array.from(sectionEls).map(el => {
      const id = el.getAttribute('data-section') || el.id.replace('sec-', '');
      const rect = el.getBoundingClientRect();
      const top = isWindow ? rect.top + window.scrollY : el.offsetTop;
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

    const isWindow = this.viewport === window;
    const scrollTop = isWindow ? window.scrollY : this.viewport.scrollTop;
    const viewportHeight = isWindow ? window.innerHeight : this.viewport.clientHeight;

    const currentScrollMiddle = scrollTop + viewportHeight * 0.4;

    let activeIdx = 0;
    for (let i = 0; i < this.sections.length; i++) {
      const sec = this.sections[i];
      if (currentScrollMiddle >= sec.top) {
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

    this.state = { section, nextSection, progress };

    if (this.sceneDirector) {
      this.sceneDirector.update(this.state);
    }

    if (window.CINEMATIC_DEBUG && typeof window.updateCinematicDebug === 'function') {
      window.updateCinematicDebug(this.state);
    }
  }

  destroy() {
    if (this.viewport === window) {
      window.removeEventListener('scroll', this._onScroll);
      window.removeEventListener('resize', this._onResize);
    } else {
      this.viewport.removeEventListener('scroll', this._onScroll);
      window.removeEventListener('resize', this._onResize);
    }
    if (this.rafId) cancelAnimationFrame(this.rafId);
  }
}
