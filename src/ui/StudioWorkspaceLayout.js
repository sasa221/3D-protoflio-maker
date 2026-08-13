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
    title: 'Create Workspace',
    sub: 'Build and maintain your factual professional profile.',
    badge: 'MASTER PROFILE — Applies to all portfolio versions',
    badgeType: 'master'
  },
  customize: {
    title: 'Customize Workspace',
    sub: 'Control how this portfolio version looks and feels visually.',
    badge: 'THIS VERSION — Visual styling for selected version',
    badgeType: 'variant'
  },
  optimize: {
    title: 'Optimize Workspace',
    sub: 'Tailor your portfolio for specific target jobs and opportunities.',
    badge: 'JOB TARGETING & VARIANTS',
    badgeType: 'optimize'
  },
  publish: {
    title: 'Publish Workspace',
    sub: 'Preview, publish, and manage custom domains for your public portfolio.',
    badge: 'DEPLOYMENT & PUBLIC ACCESS',
    badgeType: 'publish'
  },
  measure: {
    title: 'Measure Workspace',
    sub: 'Understand how recruiters and visitors interact with your portfolio.',
    badge: 'RECRUITER BEHAVIOR ANALYTICS',
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
    <div style="display: flex; gap: 8px; font-family: 'Inter', sans-serif;">
      <button onclick="window.switchWorkspace('create')" class="ws-nav-btn ${currentWorkspace === WORKSPACES.CREATE ? 'active' : ''}">
        <span>✏️</span> <span>1. Create</span>
      </button>
      <button onclick="window.switchWorkspace('customize')" class="ws-nav-btn ${currentWorkspace === WORKSPACES.CUSTOMIZE ? 'active' : ''}">
        <span>🎨</span> <span>2. Customize</span>
      </button>
      <button onclick="window.switchWorkspace('optimize')" class="ws-nav-btn ${currentWorkspace === WORKSPACES.OPTIMIZE ? 'active' : ''}">
        <span>🎯</span> <span>3. Optimize</span>
      </button>
      <button onclick="window.switchWorkspace('publish')" class="ws-nav-btn ${currentWorkspace === WORKSPACES.PUBLISH ? 'active' : ''}">
        <span>🌐</span> <span>4. Publish</span>
      </button>
      <button onclick="window.switchWorkspace('measure')" class="ws-nav-btn ${currentWorkspace === WORKSPACES.MEASURE ? 'active' : ''}">
        <span>📊</span> <span>5. Measure</span>
      </button>
    </div>
  `;
}

export function renderWorkspaceHeader(container) {
  const target = container || document.getElementById('workspace-header-area');
  if (!target) return;

  const meta = WORKSPACE_METADATA[currentWorkspace] || WORKSPACE_METADATA.create;

  target.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; padding: 14px 20px; background: rgba(255,255,255,0.02); border-bottom: 1px solid rgba(255,255,255,0.08);">
      <div>
        <div style="font-family: 'Outfit', sans-serif; font-size: 1.25rem; font-weight: 800; color: #fff; margin-bottom: 2px;">
          ${meta.title}
        </div>
        <div style="font-size: 0.78rem; color: rgba(255,255,255,0.6);">
          ${meta.sub}
        </div>
      </div>

      <div style="
        font-size: 0.7rem; font-weight: 800; padding: 4px 12px; border-radius: 20px; font-family: 'JetBrains Mono', monospace;
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
  } else if (currentWorkspace === WORKSPACES.MEASURE) {
    const p = document.getElementById('panel-analytics');
    if (p) p.classList.add('active');
  }
}

window.switchWorkspace = function(wsName, subSection) {
  setActiveWorkspace(wsName, subSection);
};
