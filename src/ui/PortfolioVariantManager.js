/**
 * PortfolioVariantManager.js
 * Studio UI Panel for Managing Portfolio Versions (Variants).
 * Allows users to create, preview, duplicate, rename, hide projects, and set default variants
 * derived from a single Master Profile without duplicating career data.
 */

import {
  ensureStableIDs,
  createDefaultVariant,
  createNewVariant,
  resolvePortfolioVariant
} from '../services/PortfolioVariantService.js';

export function renderPortfolioVariantManager(container, masterProfile, onUpdateMasterProfile) {
  if (!container) return;

  ensureStableIDs(masterProfile);

  // Initialize portfolioVariants array if empty
  if (!Array.isArray(masterProfile.portfolioVariants) || masterProfile.portfolioVariants.length === 0) {
    const defaultVariant = createDefaultVariant(masterProfile);
    masterProfile.portfolioVariants = [defaultVariant];
    masterProfile.activeVariantId = defaultVariant.id;
  }

  const variants = masterProfile.portfolioVariants;
  const activeVariantId = masterProfile.activeVariantId || variants[0].id;
  const activeVariant = variants.find(v => v.id === activeVariantId) || variants[0];

  container.innerHTML = `
    <div class="variant-manager-panel" style="padding: 20px; color: #fff;">
      <!-- HEADER -->
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px;">
        <div>
          <h2 style="font-size: 1.25rem; font-weight: 800; margin: 0; display: flex; align-items: center; gap: 8px;">
            🗂 Portfolio Versions (Variants)
          </h2>
          <p style="font-size: 0.8rem; color: rgba(255,255,255,0.6); margin: 4px 0 0 0;">
            Target different roles from <strong>One Master Profile</strong>. Source data remains centralized.
          </p>
        </div>
        <button id="btn-create-new-variant" class="btn btn-primary" style="padding: 8px 16px; font-weight: 800; font-size: 0.82rem;">
          + Create Version
        </button>
      </div>

      <!-- ACTIVE VERSION INDICATOR BANNER -->
      <div style="background: linear-gradient(135deg, rgba(124,58,237,0.18), rgba(6,182,212,0.18)); border: 1px solid rgba(124,58,237,0.4); border-radius: 14px; padding: 14px 18px; margin-bottom: 20px; display: flex; align-items: center; justify-content: space-between;">
        <div>
          <div style="font-size: 0.72rem; font-weight: 800; color: #a855f7; letter-spacing: 1.5px; text-transform: uppercase;">ACTIVE VERSION FOR PREVIEW</div>
          <div style="font-size: 1.1rem; font-weight: 900; color: #fff; margin-top: 2px;">
            ${activeVariant.name} ${activeVariant.isDefault ? '<span style="font-size: 0.7rem; color: #f59e0b; background: rgba(245,158,11,0.15); border: 1px solid rgba(245,158,11,0.3); padding: 2px 8px; border-radius: 12px; margin-left: 6px;">⭐ DEFAULT</span>' : ''}
          </div>
          <div style="font-size: 0.78rem; color: rgba(255,255,255,0.6); margin-top: 2px;">
            Target: <strong>${activeVariant.targetRole || 'General'}</strong> · Slug: <code>/${activeVariant.slug}</code>
          </div>
        </div>
        <span style="font-size: 0.72rem; font-weight: 800; color: #10b981; background: rgba(16,185,129,0.15); border: 1px solid rgba(16,185,129,0.3); border-radius: 20px; padding: 4px 12px;">
          Master Connected
        </span>
      </div>

      <!-- VERSION CARDS GRID -->
      <div style="font-size: 0.82rem; font-weight: 800; color: rgba(255,255,255,0.9); margin-bottom: 12px; letter-spacing: 1px; text-transform: uppercase;">
        Available Versions (${variants.length})
      </div>

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 14px; margin-bottom: 24px;">
        ${variants.map(v => {
          const isActive = v.id === activeVariantId;
          return `
            <div style="
              background: ${isActive ? 'rgba(124,58,237,0.12)' : 'rgba(255,255,255,0.03)'};
              border: 1px solid ${isActive ? 'rgba(124,58,237,0.5)' : 'rgba(255,255,255,0.08)'};
              border-radius: 14px; padding: 16px; position: relative; transition: all 0.2s;
            ">
              <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
                <h3 style="font-size: 0.95rem; font-weight: 800; margin: 0; color: #fff;">${v.name}</h3>
                ${v.isDefault ? '<span style="font-size: 0.68rem; color: #f59e0b; font-weight: 800;">⭐ DEFAULT</span>' : ''}
              </div>

              <div style="font-size: 0.78rem; color: rgba(255,255,255,0.6); margin-bottom: 12px;">
                Target: ${v.targetRole || 'General'}<br/>
                Theme: <span style="color: var(--primary); font-weight: 700;">${v.themeId || 'code'}</span>
              </div>

              <div style="display: flex; flex-wrap: wrap; gap: 6px; justify-content: flex-end;">
                ${!isActive ? `<button class="btn btn-primary btn-act-variant" data-id="${v.id}" style="padding: 5px 12px; font-size: 0.72rem;">👁️ Preview</button>` : '<span style="font-size: 0.72rem; color: #10b981; font-weight: 700; padding: 4px 8px;">✓ Previewing</span>'}
                <button class="btn btn-secondary btn-dup-variant" data-id="${v.id}" style="padding: 5px 10px; font-size: 0.72rem;">📋 Duplicate</button>
                ${!v.isDefault ? `<button class="btn btn-secondary btn-def-variant" data-id="${v.id}" style="padding: 5px 10px; font-size: 0.72rem;">⭐ Set Default</button>` : ''}
                ${variants.length > 1 && !v.isDefault ? `<button class="btn btn-secondary btn-del-variant" data-id="${v.id}" style="padding: 5px 10px; font-size: 0.72rem; color: #ef4444;">🗑️</button>` : ''}
              </div>
            </div>
          `;
        }).join('')}
      </div>

      <!-- ACTIVE VARIANT PROJECT VISIBILITY CONTROLS -->
      <div style="background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 16px;">
        <div style="font-size: 0.82rem; font-weight: 800; color: var(--primary, #7c3aed); margin-bottom: 8px; text-transform: uppercase; letter-spacing: 1px;">
          👁️ Project Visibility For Current Version (${activeVariant.name})
        </div>
        <p style="font-size: 0.75rem; color: rgba(255,255,255,0.6); margin-bottom: 12px;">
          Toggle projects to hide them in this version. Hidden projects remain safely preserved in your Master Profile.
        </p>

        <div style="display: flex; flex-direction: column; gap: 8px;">
          ${(masterProfile.projects || []).map(p => {
            const isHidden = (activeVariant.hiddenProjects || []).includes(p.id);
            return `
              <div style="display: flex; align-items: center; justify-content: space-between; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; padding: 10px 14px;">
                <div>
                  <span style="font-size: 0.82rem; font-weight: 700; color: ${isHidden ? 'rgba(255,255,255,0.4)' : '#fff'};">${p.name}</span>
                  ${isHidden ? '<span style="font-size: 0.68rem; color: #f59e0b; font-weight: 800; margin-left: 8px; background: rgba(245,158,11,0.15); border: 1px solid rgba(245,158,11,0.3); border-radius: 10px; padding: 2px 8px;">Hidden in this version</span>' : ''}
                </div>
                <button class="btn btn-secondary btn-toggle-proj-vis" data-proj-id="${p.id}" style="padding: 4px 12px; font-size: 0.75rem;">
                  ${isHidden ? '👁️ Show' : '🙈 Hide'}
                </button>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    </div>
  `;

  // EVENT BINDINGS
  const btnCreate = container.querySelector('#btn-create-new-variant');
  if (btnCreate) {
    btnCreate.addEventListener('click', () => {
      const name = prompt('Name this Portfolio Version (e.g. Frontend Developer Portfolio):', 'Frontend Portfolio');
      if (!name) return;
      const targetRole = prompt('Target Role Title (e.g. Front-End Developer):', 'Front-End Developer');

      createNewVariant(masterProfile, {
        name,
        targetRole: targetRole || 'Front-End Developer',
        strategy: 'optimize',
        analysisResults: masterProfile.jobTarget?.analysis
      });

      onUpdateMasterProfile(masterProfile);
    });
  }

  // Activate / Preview
  container.querySelectorAll('.btn-act-variant').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.dataset.id;
      masterProfile.activeVariantId = id;
      onUpdateMasterProfile(masterProfile);
    });
  });

  // Duplicate
  container.querySelectorAll('.btn-dup-variant').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.dataset.id;
      const target = masterProfile.portfolioVariants.find(v => v.id === id);
      if (!target) return;

      const dup = JSON.parse(JSON.stringify(target));
      dup.id = 'var_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
      dup.name = target.name + ' (Copy)';
      dup.slug = target.slug + '-copy';
      dup.isDefault = false;

      masterProfile.portfolioVariants.push(dup);
      masterProfile.activeVariantId = dup.id;
      onUpdateMasterProfile(masterProfile);
    });
  });

  // Set Default
  container.querySelectorAll('.btn-def-variant').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.dataset.id;
      masterProfile.portfolioVariants.forEach(v => {
        v.isDefault = (v.id === id);
      });
      onUpdateMasterProfile(masterProfile);
    });
  });

  // Delete
  container.querySelectorAll('.btn-del-variant').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.dataset.id;
      if (confirm('Delete this portfolio version? (Your Master Profile projects and data will NOT be deleted).')) {
        masterProfile.portfolioVariants = masterProfile.portfolioVariants.filter(v => v.id !== id);
        if (masterProfile.activeVariantId === id) {
          masterProfile.activeVariantId = masterProfile.portfolioVariants[0].id;
        }
        onUpdateMasterProfile(masterProfile);
      }
    });
  });

  // Toggle Project Visibility
  container.querySelectorAll('.btn-toggle-proj-vis').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const projId = e.currentTarget.dataset.projId;
      if (!activeVariant.hiddenProjects) activeVariant.hiddenProjects = [];

      const idx = activeVariant.hiddenProjects.indexOf(projId);
      if (idx !== -1) {
        activeVariant.hiddenProjects.splice(idx, 1);
      } else {
        activeVariant.hiddenProjects.push(projId);
      }

      onUpdateMasterProfile(masterProfile);
    });
  });
}
