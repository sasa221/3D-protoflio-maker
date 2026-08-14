/**
 * ProjectCinema.js - Project Cinema Case Study Experience Module
 * Renders an immersive, cinematic case-study overlay for portfolio projects.
 * Supports rich case-study data (Role, Problem, Solution, Process, Impact, Metrics, Screenshots, Video)
 * with graceful fallbacks for simple projects.
 */

function escapeHTML(str) {
  return (str || '').replace(/[&<>"']/g, m => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }[m]));
}

/**
 * Generate Project Cinema Modal HTML Structure
 */
export function generateProjectCinemaHTML(projects = [], theme = {}) {
  if (!projects || projects.length === 0) return '';

  const modalCards = projects.map((p, i) => {
    const role = p.role || '';
    const problem = p.problem || '';
    const solution = p.solution || '';
    const process = p.process || '';
    const impact = p.impact || '';
    const duration = p.duration || '';
    const team = p.team || '';
    const video = p.video || '';
    const images = Array.isArray(p.images) ? p.images : (p.image ? [p.image] : []);
    
    // Parse metrics (supports array or newline/comma string)
    let metrics = [];
    if (Array.isArray(p.metrics)) {
      metrics = p.metrics;
    } else if (typeof p.metrics === 'string' && p.metrics.trim()) {
      metrics = p.metrics.split(/[\n,]+/).map(m => {
        const parts = m.trim().split(':');
        if (parts.length > 1) {
          return { val: parts[0].trim(), label: parts.slice(1).join(':').trim() };
        }
        return { val: m.trim(), label: 'Key Result' };
      });
    }

    const hasDetailedCaseStudy = Boolean(problem || solution || process || impact || metrics.length > 0);

    return `
      <div class="cinema-card" id="cinema-card-${i}" style="display:none;" data-project-idx="${i}">
        <!-- HEADER BAR -->
        <div class="cinema-header">
          <div class="cinema-meta-left">
            <span class="cinema-num-badge">CASE STUDY ${String(i + 1).padStart(2, '0')} / ${String(projects.length).padStart(2, '0')}</span>
            ${role ? `<span class="cinema-role-badge">👤 ${escapeHTML(role)}</span>` : ''}
            ${duration ? `<span class="cinema-tag-badge">⏱️ ${escapeHTML(duration)}</span>` : ''}
            ${team ? `<span class="cinema-tag-badge">👥 ${escapeHTML(team)}</span>` : ''}
          </div>
          <button class="cinema-close-btn" onclick="closeProjectCinema()" aria-label="Close Project Cinema">
            <span>Close</span> <span class="kbd-hint">ESC</span> ✕
          </button>
        </div>

        <!-- TITLE & TAGLINE -->
        <div class="cinema-hero-title">
          <h2 class="cinema-project-title">${escapeHTML(p.name || 'Untitled Project')}</h2>
          ${p.description ? `<p class="cinema-project-tagline">${escapeHTML(p.description)}</p>` : ''}
        </div>

        <!-- MEDIA STAGE -->
        <div class="cinema-media-stage">
          ${video ? `
            <div class="cinema-video-wrap">
              <iframe src="${escapeHTML(video)}" frameborder="0" allowfullscreen></iframe>
            </div>
          ` : images.length > 0 ? `
            <div class="cinema-gallery-wrap">
              <div class="cinema-main-img-box">
                <img id="cinema-main-img-${i}" src="${escapeHTML(images[0])}" alt="${escapeHTML(p.name)}" />
              </div>
              ${images.length > 1 ? `
                <div class="cinema-thumb-strip">
                  ${images.map((imgUrl, imgIdx) => `
                    <button class="cinema-thumb-btn ${imgIdx === 0 ? 'active' : ''}" onclick="switchCinemaImage(${i}, '${escapeHTML(imgUrl)}', this)">
                      <img src="${escapeHTML(imgUrl)}" alt="Screenshot ${imgIdx + 1}" />
                    </button>
                  `).join('')}
                </div>
              ` : ''}
            </div>
          ` : `
            <div class="cinema-media-fallback">
              <div class="cinema-fallback-icon">🚀</div>
              <div class="cinema-fallback-label">${escapeHTML(p.name || 'Project Stage')}</div>
            </div>
          `}
        </div>

        <!-- METRICS HIGHLIGHT SECTION (If present) -->
        ${metrics.length > 0 ? `
          <div class="cinema-metrics-section">
            <div class="cinema-section-title">📊 KEY IMPACT & RESULTS</div>
            <div class="cinema-metrics-grid">
              ${metrics.map(m => `
                <div class="cinema-metric-card">
                  <div class="cinema-metric-val">${escapeHTML(typeof m === 'object' ? (m.val || m.value || '') : m)}</div>
                  <div class="cinema-metric-label">${escapeHTML(typeof m === 'object' ? (m.label || 'Impact') : 'Metric')}</div>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}

        <!-- DETAILED CASE STUDY STORY GRID -->
        ${hasDetailedCaseStudy ? `
          <div class="cinema-story-grid">
            ${problem ? `
              <div class="cinema-story-card story-problem">
                <div class="cinema-story-label">🎯 THE PROBLEM</div>
                <p class="cinema-story-text">${escapeHTML(problem)}</p>
              </div>
            ` : ''}

            ${solution ? `
              <div class="cinema-story-card story-solution">
                <div class="cinema-story-label">💡 THE SOLUTION</div>
                <p class="cinema-story-text">${escapeHTML(solution)}</p>
              </div>
            ` : ''}

            ${process ? `
              <div class="cinema-story-card story-process">
                <div class="cinema-story-label">⚙️ ARCHITECTURE & PROCESS</div>
                <p class="cinema-story-text">${escapeHTML(process)}</p>
              </div>
            ` : ''}

            ${impact ? `
              <div class="cinema-story-card story-impact">
                <div class="cinema-story-label">🚀 BUSINESS IMPACT</div>
                <p class="cinema-story-text">${escapeHTML(impact)}</p>
              </div>
            ` : ''}
          </div>
        ` : ''}

        <!-- TECH STACK & FOOTER CTAS -->
        <div class="cinema-footer">
          ${p.tech ? `
            <div class="cinema-tech-wrap">
              <span class="cinema-tech-label">STACK:</span>
              <div class="cinema-tech-tags">
                ${p.tech.split(',').map(t => `<span class="cinema-tech-pill">${escapeHTML(t.trim())}</span>`).join('')}
              </div>
            </div>
          ` : '<div></div>'}

          <div class="cinema-action-btns">
            ${p.github ? `<a href="${escapeHTML(p.github)}" target="_blank" class="cinema-btn cinema-btn-sec">💻 GitHub Code</a>` : ''}
            ${p.url ? `<a href="${escapeHTML(p.url)}" target="_blank" class="cinema-btn cinema-btn-pri">🌐 Live Demo →</a>` : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');

  return `
    <div id="project-cinema-modal" class="cinema-modal-overlay" style="display:none;" role="dialog" aria-modal="true">
      <div class="cinema-modal-backdrop" onclick="closeProjectCinema()"></div>
      <div class="cinema-modal-container">
        ${modalCards}
      </div>
    </div>
  `;
}

/**
 * Generate Project Cinema CSS System
 */
export function getProjectCinemaCSS() {
  return `
    /* ─── PROJECT CINEMA MODAL ─── */
    .cinema-modal-overlay {
      position: fixed;
      inset: 0;
      z-index: 2000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.35s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .cinema-modal-overlay.active {
      opacity: 1;
      pointer-events: auto;
    }

    .cinema-modal-backdrop {
      position: absolute;
      inset: 0;
      background: rgba(3, 3, 10, 0.82);
      backdrop-filter: blur(25px) saturate(1.8);
      -webkit-backdrop-filter: blur(25px) saturate(1.8);
    }

    .cinema-modal-container {
      position: relative;
      z-index: 10;
      width: 100%;
      max-width: 1000px;
      max-height: 88vh;
      overflow-y: auto;
      overflow-x: hidden;
      background: rgba(12, 12, 24, 0.92);
      border: 1px solid rgba(255, 255, 255, 0.14);
      box-shadow: 0 30px 100px rgba(0, 0, 0, 0.9), 0 0 50px rgba(124, 58, 237, 0.2);
      border-radius: 24px;
      padding: 36px;
      transform: translateY(30px) scale(0.96);
      transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
      scrollbar-width: thin;
      scrollbar-color: rgba(255,255,255,0.2) transparent;
    }
    .cinema-modal-overlay.active .cinema-modal-container {
      transform: translateY(0) scale(1);
    }

    /* ─── CINEMA HEADER ─── */
    .cinema-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 24px;
      padding-bottom: 16px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      flex-wrap: wrap;
      gap: 12px;
    }
    .cinema-meta-left {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }
    .cinema-num-badge {
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.7rem;
      font-weight: 700;
      color: var(--accent, #06b6d4);
      background: rgba(6, 182, 212, 0.12);
      border: 1px solid rgba(6, 182, 212, 0.3);
      padding: 4px 12px;
      border-radius: 20px;
      letter-spacing: 1px;
    }
    .cinema-role-badge, .cinema-tag-badge {
      font-size: 0.72rem;
      color: rgba(255, 255, 255, 0.75);
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.1);
      padding: 4px 12px;
      border-radius: 20px;
    }
    .cinema-close-btn {
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.15);
      color: #fff;
      padding: 8px 16px;
      border-radius: 30px;
      font-size: 0.8rem;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
      transition: all 0.25s ease;
    }
    .cinema-close-btn:hover {
      background: rgba(239, 68, 68, 0.2);
      border-color: rgba(239, 68, 68, 0.5);
      color: #ef4444;
      transform: scale(1.04);
    }
    .kbd-hint {
      font-size: 0.6rem;
      font-family: 'JetBrains Mono', monospace;
      background: rgba(255, 255, 255, 0.1);
      padding: 2px 6px;
      border-radius: 4px;
      color: rgba(255, 255, 255, 0.6);
    }

    /* ─── TITLE & HERO ─── */
    .cinema-hero-title {
      margin-bottom: 24px;
    }
    .cinema-project-title {
      font-family: 'Outfit', sans-serif;
      font-size: 2.2rem;
      font-weight: 900;
      color: #fff;
      line-height: 1.2;
      margin-bottom: 8px;
      background: linear-gradient(135deg, #ffffff, rgba(255,255,255,0.7));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .cinema-project-tagline {
      font-size: 1.05rem;
      color: rgba(255, 255, 255, 0.7);
      line-height: 1.6;
    }

    /* ─── MEDIA STAGE ─── */
    .cinema-media-stage {
      margin-bottom: 32px;
      border-radius: 16px;
      overflow: hidden;
      border: 1px solid rgba(255, 255, 255, 0.1);
      background: rgba(0, 0, 0, 0.4);
    }
    .cinema-main-img-box {
      width: 100%;
      max-height: 460px;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #05050a;
    }
    .cinema-main-img-box img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      transition: transform 0.4s ease;
    }
    .cinema-thumb-strip {
      display: flex;
      gap: 10px;
      padding: 12px;
      background: rgba(0, 0, 0, 0.6);
      overflow-x: auto;
    }
    .cinema-thumb-btn {
      width: 70px;
      height: 50px;
      border-radius: 8px;
      overflow: hidden;
      border: 2px solid transparent;
      padding: 0;
      background: transparent;
      cursor: pointer;
      opacity: 0.6;
      transition: all 0.25s ease;
      flex-shrink: 0;
    }
    .cinema-thumb-btn.active, .cinema-thumb-btn:hover {
      border-color: var(--primary, #7c3aed);
      opacity: 1;
      transform: scale(1.05);
    }
    .cinema-thumb-btn img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .cinema-video-wrap {
      position: relative;
      padding-bottom: 56.25%;
      height: 0;
      overflow: hidden;
    }
    .cinema-video-wrap iframe {
      position: absolute;
      top: 0; left: 0; width: 100%; height: 100%;
    }

    .cinema-media-fallback {
      padding: 60px 20px;
      text-align: center;
      background: linear-gradient(135deg, rgba(124,58,237,0.1), rgba(6,182,212,0.05));
    }
    .cinema-fallback-icon { font-size: 3.5rem; margin-bottom: 10px; }
    .cinema-fallback-label { font-size: 1rem; color: rgba(255,255,255,0.5); font-weight: 600; }

    /* ─── METRICS SECTION ─── */
    .cinema-metrics-section {
      margin-bottom: 32px;
      padding: 20px;
      background: linear-gradient(135deg, rgba(124, 58, 237, 0.08), rgba(6, 182, 212, 0.06));
      border: 1px solid rgba(124, 58, 237, 0.2);
      border-radius: 16px;
    }
    .cinema-section-title {
      font-size: 0.72rem;
      font-family: 'JetBrains Mono', monospace;
      letter-spacing: 2px;
      color: var(--accent, #06b6d4);
      margin-bottom: 14px;
      font-weight: 700;
    }
    .cinema-metrics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 16px;
    }
    .cinema-metric-card {
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 12px;
      padding: 16px;
      text-align: center;
    }
    .cinema-metric-val {
      font-family: 'Outfit', sans-serif;
      font-size: 1.8rem;
      font-weight: 900;
      color: #10b981;
      margin-bottom: 4px;
    }
    .cinema-metric-label {
      font-size: 0.75rem;
      color: rgba(255, 255, 255, 0.65);
    }

    /* ─── STORY GRID ─── */
    .cinema-story-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin-bottom: 32px;
    }
    @media (max-width: 768px) {
      .cinema-story-grid { grid-template-columns: 1fr; }
    }
    .cinema-story-card {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 16px;
      padding: 20px;
    }
    .cinema-story-label {
      font-size: 0.7rem;
      font-family: 'JetBrains Mono', monospace;
      letter-spacing: 1.5px;
      color: var(--primary, #7c3aed);
      margin-bottom: 8px;
      font-weight: 700;
    }
    .cinema-story-text {
      font-size: 0.92rem;
      color: rgba(255, 255, 255, 0.85);
      line-height: 1.65;
      white-space: pre-line;
    }

    /* ─── FOOTER ─── */
    .cinema-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-top: 20px;
      border-top: 1px solid rgba(255, 255, 255, 0.08);
      flex-wrap: wrap;
      gap: 16px;
    }
    .cinema-tech-wrap {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }
    .cinema-tech-label {
      font-size: 0.68rem;
      font-family: 'JetBrains Mono', monospace;
      color: rgba(255, 255, 255, 0.4);
    }
    .cinema-tech-tags {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }
    .cinema-tech-pill {
      font-size: 0.72rem;
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.1);
      color: rgba(255, 255, 255, 0.8);
      padding: 3px 10px;
      border-radius: 12px;
    }

    .cinema-action-btns {
      display: flex;
      gap: 10px;
    }
    .cinema-btn {
      padding: 10px 20px;
      border-radius: 30px;
      font-size: 0.82rem;
      font-weight: 600;
      text-decoration: none;
      transition: all 0.25s ease;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    .cinema-btn-pri {
      background: linear-gradient(135deg, var(--primary, #7c3aed), var(--accent, #06b6d4));
      color: #fff;
      box-shadow: 0 4px 15px rgba(124, 58, 237, 0.3);
    }
    .cinema-btn-pri:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 25px rgba(124, 58, 237, 0.5);
    }
    .cinema-btn-sec {
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.15);
      color: #fff;
    }
    .cinema-btn-sec:hover {
      background: rgba(255, 255, 255, 0.12);
      border-color: rgba(255, 255, 255, 0.3);
    }

    /* ─── MOBILE RESPONSIVE ─── */
    @media (max-width: 640px) {
      .cinema-modal-container {
        padding: 20px;
        max-height: 94vh;
        border-radius: 16px;
      }
      .cinema-project-title { font-size: 1.6rem; }
      .cinema-footer { flex-direction: column; align-items: stretch; }
      .cinema-action-btns { flex-direction: column; }
      .cinema-btn { width: 100%; text-align: center; }
    }
  `;
}

/**
 * Client-Side JavaScript for Project Cinema Control & Keyboard Accessibility
 */
export function getProjectCinemaScript() {
  return `
    let currentCinemaIndex = -1;
    let savedScrollTop = 0;
    let lastActiveElement = null;

    window.openProjectCinema = function(index) {
      const modal = document.getElementById('project-cinema-modal');
      if (!modal) return;

      lastActiveElement = document.activeElement;

      // Save scroll position
      const viewport = document.getElementById('preview-scroll-viewport') || document.documentElement || document.body;
      savedScrollTop = window.scrollY || viewport.scrollTop || 0;

      // Hide all cards, show requested index
      const cards = modal.querySelectorAll('.cinema-card');
      cards.forEach((c, idx) => {
        c.style.display = idx === index ? 'block' : 'none';
      });

      currentCinemaIndex = index;

      // Show modal overlay
      modal.style.display = 'flex';
      setTimeout(() => {
        modal.classList.add('active');
      }, 20);

      // Lock underlying portfolio scroll
      if (document.body) document.body.style.overflow = 'hidden';
      const scrollVp = document.getElementById('preview-scroll-viewport');
      if (scrollVp) scrollVp.style.overflow = 'hidden';

      // Trigger 3D Camera projectFocus Mode
      if (window.sceneDirector && typeof window.sceneDirector.setProjectFocus === 'function') {
        window.sceneDirector.setProjectFocus(true);
      } else if (window.engine && typeof window.engine.setCameraState === 'function') {
        window.engine.setCameraState({
          position: { x: 0, y: -5, z: 40 },
          target: { x: 0, y: 1, z: 0 },
          fov: 45,
          parallaxStrength: 2
        });
      }

      // Accessibility: Focus close button
      const closeBtn = cards[index]?.querySelector('.cinema-close-btn');
      if (closeBtn) closeBtn.focus();
    };

    window.closeProjectCinema = function() {
      const modal = document.getElementById('project-cinema-modal');
      if (!modal) return;

      modal.classList.remove('active');

      setTimeout(() => {
        modal.style.display = 'none';

        // Unlock scroll
        if (document.body) document.body.style.overflow = '';
        const scrollVp = document.getElementById('preview-scroll-viewport');
        if (scrollVp) scrollVp.style.overflow = 'auto';

        // Restore scroll position
        const viewport = document.getElementById('preview-scroll-viewport');
        if (viewport) {
          viewport.scrollTop = savedScrollTop;
        } else {
          window.scrollTo(0, savedScrollTop);
        }

        // Restore 3D Camera
        if (window.sceneDirector && typeof window.sceneDirector.setProjectFocus === 'function') {
          window.sceneDirector.setProjectFocus(false);
        }

        // Restore focus
        if (lastActiveElement && typeof lastActiveElement.focus === 'function') {
          lastActiveElement.focus();
        }
      }, 350);
    };

    window.switchCinemaImage = function(projectIdx, imgUrl, btnEl) {
      const img = document.getElementById('cinema-main-img-' + projectIdx);
      if (img) img.src = imgUrl;

      const parent = btnEl.parentElement;
      if (parent) {
        parent.querySelectorAll('.cinema-thumb-btn').forEach(b => b.classList.remove('active'));
      }
      btnEl.classList.add('active');
    };

    // Keyboard ESC listener
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' || e.keyCode === 27) {
        const modal = document.getElementById('project-cinema-modal');
        if (modal && modal.classList.contains('active')) {
          closeProjectCinema();
        }
      }
    });
  `;
}

/**
 * Install the generated cinema controls after portfolio HTML is mounted with innerHTML.
 * Inline scripts inserted through innerHTML do not execute, so interactive previews and
 * public portfolios must initialize the trusted renderer script explicitly.
 */
export function installProjectCinemaControls() {
  try {
    Function(getProjectCinemaScript())();
    return true;
  } catch (error) {
    console.error('[Project Cinema] Failed to initialize controls:', error);
    return false;
  }
}
