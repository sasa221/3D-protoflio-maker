/**
 * StudioWorkspaceLayout.js
 * V3.0.3 Simplified 5-Workspace Studio UI Manager.
 * Organizes Studio into: CREATE, CUSTOMIZE, OPTIMIZE, PUBLISH, MEASURE.
 */

export const WORKSPACES = {
  CREATE: 'create',
  CUSTOMIZE: 'customize',
  OPTIMIZE: 'optimize',
  PUBLISH: 'publish',
  MEASURE: 'measure'
};

export const WORKSPACE_METADATA = {
  create: {
    title: 'Profile Content',
    sub: 'Edit your core profile, experience, education, projects, and skills.',
    badge: 'PROFILE',
    badgeType: 'master'
  },
  customize: {
    title: '3D Visual Style',
    sub: 'Choose your 3D environment, colors, lighting, and theme styling.',
    badge: 'STYLE',
    badgeType: 'variant'
  },
  optimize: {
    title: 'Job Fit Analyzer',
    sub: 'Calculate your evidence-based fit for specific job postings and identify genuine gaps.',
    badge: 'JOB FIT',
    badgeType: 'optimize'
  },
  publish: {
    title: 'Publish & Share',
    sub: 'Get your public web link, share your portfolio, and export offline files.',
    badge: 'PUBLISH',
    badgeType: 'publish'
  },
  measure: {
    title: 'Visitor Insights',
    sub: 'See who visits your portfolio and which projects they explore.',
    badge: 'INSIGHTS',
    badgeType: 'measure'
  }
};

let currentWorkspace = WORKSPACES.CREATE;
let currentSubSection = 'profile';

export function getActiveWorkspace() {
  return currentWorkspace;
}

export function setActiveWorkspace(ws, subSection = null) {
  if (Object.values(WORKSPACES).includes(ws)) {
    currentWorkspace = ws;
    if (subSection) currentSubSection = subSection;
    renderWorkspaceHeader();
    renderWorkspaceNav();
    showActiveWorkspacePanels();

    // Trigger responsive preview recalculation for active workspace
    if (typeof window.updatePreviewScale === 'function') {
      requestAnimationFrame(() => window.updatePreviewScale());
      setTimeout(() => window.updatePreviewScale(), 60);
      setTimeout(() => window.updatePreviewScale(), 200);
    }
  }
}

export function renderWorkspaceNav(container) {
  const target = container || document.getElementById('workspace-nav-bar');
  if (!target) return;

  target.innerHTML = `
    <div style="display: flex; gap: 6px; font-family: 'Inter', sans-serif; overflow-x: auto; -webkit-overflow-scrolling: touch; padding-bottom: 2px; max-width: 100%;">
      <button onclick="window.switchWorkspace('create')" class="ws-nav-btn ${currentWorkspace === WORKSPACES.CREATE ? 'active' : ''}" style="white-space: nowrap; flex-shrink: 0; padding: 8px 12px; font-size: 0.78rem;">
        <span>✏️</span> <span>1. Content</span>
      </button>
      <button onclick="window.switchWorkspace('customize')" class="ws-nav-btn ${currentWorkspace === WORKSPACES.CUSTOMIZE ? 'active' : ''}" style="white-space: nowrap; flex-shrink: 0; padding: 8px 12px; font-size: 0.78rem;">
        <span>🎨</span> <span>2. Style</span>
      </button>
      <button onclick="window.switchWorkspace('optimize')" class="ws-nav-btn ${currentWorkspace === WORKSPACES.OPTIMIZE ? 'active' : ''}" style="white-space: nowrap; flex-shrink: 0; padding: 8px 12px; font-size: 0.78rem;">
        <span>🎯</span> <span>3. Job Fit</span>
      </button>
      <button onclick="window.switchWorkspace('publish')" class="ws-nav-btn ${currentWorkspace === WORKSPACES.PUBLISH ? 'active' : ''}" style="white-space: nowrap; flex-shrink: 0; padding: 8px 12px; font-size: 0.78rem;">
        <span>🌐</span> <span>4. Publish</span>
      </button>
      <button onclick="window.switchWorkspace('measure')" class="ws-nav-btn ${currentWorkspace === WORKSPACES.MEASURE ? 'active' : ''}" style="white-space: nowrap; flex-shrink: 0; padding: 8px 12px; font-size: 0.78rem;">
        <span>📊</span> <span>5. Insights</span>
      </button>
    </div>
  `;
}

export function renderWorkspaceHeader(container) {
  const target = container || document.getElementById('workspace-header-area');
  if (!target) return;

  const meta = WORKSPACE_METADATA[currentWorkspace] || WORKSPACE_METADATA.create;

  target.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: rgba(255,255,255,0.02); border-bottom: 1px solid rgba(255,255,255,0.08); flex-wrap: wrap; gap: 8px;">
      <div>
        <div style="font-family: 'Outfit', sans-serif; font-size: 1.15rem; font-weight: 800; color: #fff; margin-bottom: 2px;">
          ${meta.title}
        </div>
        <div style="font-size: 0.76rem; color: rgba(255,255,255,0.6);">
          ${meta.sub}
        </div>
      </div>

      <div style="
        font-size: 0.68rem; font-weight: 800; padding: 3px 10px; border-radius: 20px; font-family: 'JetBrains Mono', monospace;
        ${meta.badgeType === 'master' ? 'background: rgba(124,58,237,0.2); border: 1px solid rgba(124,58,237,0.4); color: #a855f7;' :
          meta.badgeType === 'variant' ? 'background: rgba(6,182,212,0.2); border: 1px solid rgba(6,182,212,0.4); color: #06b6d4;' :
          'background: rgba(16,185,129,0.2); border: 1px solid rgba(16,185,129,0.4); color: #10b981;'}
      ">
        ${meta.badge}
      </div>
    </div>
  `;
}

export function showActiveWorkspacePanels() {
  const panels = document.querySelectorAll('.tab-panel');
  panels.forEach(p => p.classList.remove('active'));

  // Map workspace to corresponding tab panels
  if (currentWorkspace === WORKSPACES.CREATE) {
    const p = document.getElementById(`panel-${currentSubSection}`) || document.getElementById('panel-profile');
    if (p) p.classList.add('active');
  } else if (currentWorkspace === WORKSPACES.CUSTOMIZE) {
    const p = document.getElementById('panel-design');
    if (p) p.classList.add('active');
  } else if (currentWorkspace === WORKSPACES.OPTIMIZE) {
    const p = document.getElementById('panel-jobtarget');
    if (p) p.classList.add('active');
  } else if (currentWorkspace === WORKSPACES.PUBLISH) {
    const p = document.getElementById('panel-publish');
    if (p) p.classList.add('active');
    if (typeof window.renderPublishTab === 'function') {
      window.renderPublishTab();
    }
  } else if (currentWorkspace === WORKSPACES.MEASURE) {
    const p = document.getElementById('panel-analytics');
    if (p) p.classList.add('active');
    if (typeof window.renderAnalyticsDashboardGlobal === 'function') {
      window.renderAnalyticsDashboardGlobal();
    }
  }

  // Hide redundant global footer actions specifically when in Publish workspace
  const sidebarFooter = document.querySelector('.sidebar-footer');
  if (sidebarFooter) {
    if (currentWorkspace === WORKSPACES.PUBLISH) {
      sidebarFooter.style.display = 'none';
    } else {
      sidebarFooter.style.display = '';
    }
  }
}

window.switchWorkspace = function(wsName, subSection) {
  setActiveWorkspace(wsName, subSection);
};
