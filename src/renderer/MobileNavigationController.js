/**
 * MobileNavigationController.js
 * Centralized, robust event delegation controller for Mobile 3D Portfolio Navigation.
 * Handles menu opening, position calculations, ARIA attributes, scroll locking, section navigation, and Recruiter Mode toggle.
 */

export function initMobileNavigationController() {
  if (typeof window === 'undefined') return;
  if (window.__mobileNavControllerInitialized) return;
  window.__mobileNavControllerInitialized = true;

  // ─── STABLE GLOBAL EVENT DELEGATION ───
  document.addEventListener('click', function(e) {
    // 1. Mobile Menu Open Toggle Button
    const menuBtn = e.target.closest('#mobile-menu-btn, .mobile-menu-btn');
    if (menuBtn) {
      e.preventDefault();
      e.stopPropagation();
      const root = menuBtn.closest('#portfolio-scroll-container') || menuBtn.closest('#preview-scroll-viewport');
      window.toggleMobileMenu(true, root);
      return;
    }

    // 2. Mobile Menu Close Button
    const closeBtn = e.target.closest('#mobile-menu-close, .mobile-menu-close');
    if (closeBtn) {
      e.preventDefault();
      e.stopPropagation();
      const root = closeBtn.closest('#portfolio-scroll-container') || closeBtn.closest('#preview-scroll-viewport');
      window.toggleMobileMenu(false, root);
      return;
    }

    // 3. Mobile Navigation Links
    const navLink = e.target.closest('.mobile-nav-link');
    if (navLink) {
      const targetSec = navLink.getAttribute('data-section') || navLink.getAttribute('href')?.replace('#sec-', '').replace('#', '');
      if (targetSec) {
        e.preventDefault();
        
        const root = navLink.closest('#portfolio-scroll-container') || navLink.closest('#preview-scroll-viewport') || document;
        window.toggleMobileMenu(false, root);

        const targetEl = root.querySelector('#sec-' + targetSec) || root.querySelector('#' + targetSec) || document.getElementById('sec-' + targetSec) || document.getElementById(targetSec);
        if (targetEl) {
          targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
          if (window.sceneDirector) {
            window.sceneDirector.update({ section: targetSec, progress: 0 });
          }
        }
      }
    }
  }, true);

  // ─── KEYBOARD ESCAPE LISTENER ───
  window.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' || e.keyCode === 27) {
      const activePanel = document.querySelector('#mobile-menu-panel.active, .mobile-menu-panel.active');
      if (activePanel) {
        window.toggleMobileMenu(false);
      }
    }
  });
}

// ─── CORE TOGGLE & CONTROLLER API ───
export function toggleMobileMenu(forceState, contextEl) {
  const root = contextEl || document.getElementById('portfolio-scroll-container') || document.getElementById('preview-scroll-viewport') || document;
  const panel = root.querySelector('#mobile-menu-panel, .mobile-menu-panel') || document.querySelector('#mobile-menu-panel, .mobile-menu-panel');
  const btn = root.querySelector('#mobile-menu-btn, .mobile-menu-btn') || document.querySelector('#mobile-menu-btn, .mobile-menu-btn');
  const closeBtn = root.querySelector('#mobile-menu-close, .mobile-menu-close') || document.querySelector('#mobile-menu-close, .mobile-menu-close');
  const viewport = document.getElementById('preview-scroll-viewport') || document.getElementById('portfolio-scroll-container') || document.body;

  if (!panel) {
    console.error('[MobileMenu] ERROR: mobile-menu-panel element not found!');
    return;
  }

  const isActive = panel.classList.contains('active');
  const nextState = forceState !== undefined ? Boolean(forceState) : !isActive;

  if (nextState) {
    const scrollTop = viewport ? viewport.scrollTop : (window.scrollY || 0);
    const viewportHeight = viewport ? viewport.clientHeight : window.innerHeight;

    panel.style.top = scrollTop + 'px';
    panel.style.height = viewportHeight + 'px';

    panel.classList.add('active');
    panel.setAttribute('aria-hidden', 'false');
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
    panel.setAttribute('aria-hidden', 'true');
    panel.style.opacity = '0';
    panel.style.pointerEvents = 'none';
    panel.style.transform = 'scale(0.97)';

    if (btn) btn.setAttribute('aria-expanded', 'false');
    if (viewport) viewport.style.overflow = 'auto';

    if (btn && typeof btn.focus === 'function') {
      btn.focus();
    }
  }
}

export function toggleViewMode(forceMode) {
  const container = document.getElementById('portfolio-scroll-container') || document.body;
  const current = container.getAttribute('data-view-mode') || 'cinematic';
  const next = forceMode || (current === 'cinematic' ? 'recruiter' : 'cinematic');

  container.setAttribute('data-view-mode', next);
  document.body.setAttribute('data-view-mode', next);

  if (window.sceneDirector && typeof window.sceneDirector.setViewMode === 'function') {
    window.sceneDirector.setViewMode(next);
  }

  document.querySelectorAll('.view-mode-btn').forEach(btn => {
    if (next === 'recruiter') {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

}

export function openMobileMenu(contextEl) { toggleMobileMenu(true, contextEl); }
export function closeMobileMenu(contextEl) { toggleMobileMenu(false, contextEl); }

if (typeof window !== 'undefined') {
  window.toggleMobileMenu = toggleMobileMenu;
  window.openMobileMenu = openMobileMenu;
  window.closeMobileMenu = closeMobileMenu;
  window.toggleViewMode = toggleViewMode;
  window.debugOpenMobileMenu = function() { toggleMobileMenu(true); };
  initMobileNavigationController();
}
