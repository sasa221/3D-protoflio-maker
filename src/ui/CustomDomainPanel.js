/**
 * CustomDomainPanel.js
 * Studio UI Panel for Custom Domain Connection & DNS Verification Status.
 * Controlled strictly by CAPABILITIES.CUSTOM_DOMAIN.
 */

import { globalEntitlements, CAPABILITIES } from '../services/EntitlementService.js';
import { verifyCustomDomainDNS } from '../services/PublishService.js';
import { openBillingModal } from './BillingModal.js';

export function renderCustomDomainPanel(container, masterProfile, onUpdateMasterProfile) {
  if (!container) return;

  const canUseCustomDomain = globalEntitlements.can(CAPABILITIES.CUSTOM_DOMAIN);
  const currentDomain = masterProfile.customDomain || { hostname: '', status: 'unconfigured' };

  container.innerHTML = `
    <div class="custom-domain-panel" style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 18px; color: #fff; margin-bottom: 20px;">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
        <h3 style="font-size: 1rem; font-weight: 800; margin: 0; display: flex; align-items: center; gap: 8px;">
          🌐 Custom Domain Name
        </h3>
        ${canUseCustomDomain ? `
          <span style="font-size: 0.7rem; color: #10b981; font-weight: 800; background: rgba(16,185,129,0.15); border: 1px solid rgba(16,185,129,0.3); border-radius: 12px; padding: 2px 10px;">PRO FEATURE UNLOCKED</span>
        ` : `
          <span style="font-size: 0.7rem; color: #f59e0b; font-weight: 800; background: rgba(245,158,11,0.15); border: 1px solid rgba(245,158,11,0.3); border-radius: 12px; padding: 2px 10px;">💎 PRO EXCLUSIVE</span>
        `}
      </div>

      ${!canUseCustomDomain ? `
        <div style="background: rgba(124,58,237,0.08); border: 1px solid rgba(124,58,237,0.25); border-radius: 14px; padding: 16px; text-align: center;">
          <p style="font-size: 0.82rem; color: rgba(255,255,255,0.8); margin-bottom: 12px;">
            Connect your own custom domain (e.g. <code>portfolio.salehaborehab.com</code>) to your 3D portfolio.
          </p>
          <button id="btn-domain-upgrade" class="btn btn-primary" style="font-size: 0.8rem; font-weight: 800; padding: 8px 20px;">
            💎 Upgrade to Pro to Connect Custom Domain
          </button>
        </div>
      ` : `
        <div>
          <div style="display: flex; gap: 10px; margin-bottom: 12px;">
            <input id="f-custom-hostname" class="field-input" value="${currentDomain.hostname || ''}" placeholder="portfolio.yourdomain.com" style="flex: 1; font-size: 0.82rem; padding: 8px 12px;"/>
            <button id="btn-verify-domain" class="btn btn-primary" style="padding: 8px 16px; font-size: 0.8rem; font-weight: 800;">
              Connect & Verify DNS
            </button>
          </div>

          ${currentDomain.status !== 'unconfigured' ? `
            <div style="background: rgba(0,0,0,0.3); border-radius: 12px; padding: 12px; font-size: 0.78rem;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                <span style="color: rgba(255,255,255,0.6);">Connection Status:</span>
                <span style="font-weight: 800; color: ${currentDomain.status === 'active' ? '#10b981' : '#f59e0b'};">
                  ● ${currentDomain.status.toUpperCase()}
                </span>
              </div>
              <div style="display: flex; justify-content: space-between;">
                <span style="color: rgba(255,255,255,0.6);">SSL Certificate:</span>
                <span style="font-weight: 700; color: #10b981;">🔒 ${currentDomain.sslStatus || 'active'}</span>
              </div>
            </div>
          ` : ''}
        </div>
      `}
    </div>
  `;

  const btnUpgrade = container.querySelector('#btn-domain-upgrade');
  if (btnUpgrade) {
    btnUpgrade.addEventListener('click', () => openBillingModal('user_saleh_123'));
  }

  const btnVerify = container.querySelector('#btn-verify-domain');
  if (btnVerify) {
    btnVerify.addEventListener('click', async () => {
      const hostname = container.querySelector('#f-custom-hostname').value;
      btnVerify.disabled = true;
      btnVerify.textContent = 'Checking DNS...';
      try {
        const res = await verifyCustomDomainDNS(hostname, masterProfile.id);
        masterProfile.customDomain = res;
        onUpdateMasterProfile(masterProfile);
        alert(`Domain ${res.hostname}: ${res.verified ? 'DNS verified.' : 'DNS pending. Add the required CNAME record and try again.'}`);
        renderCustomDomainPanel(container, masterProfile, onUpdateMasterProfile);
      } catch (error) {
        alert(error.message);
        btnVerify.disabled = false;
        btnVerify.textContent = 'Connect & Verify DNS';
      }
    });
  }
}
