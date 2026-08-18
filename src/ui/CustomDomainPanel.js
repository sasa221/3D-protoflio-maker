/**
 * CustomDomainPanel.js
 * Studio UI Panel for Custom Domain Connection with a simple, guided 4-step user experience.
 */

import { globalEntitlements, CAPABILITIES } from '../services/EntitlementService.js';
import { verifyCustomDomainDNS } from '../services/PublishService.js';

export function renderCustomDomainPanel(container, masterProfile, onUpdateMasterProfile) {
  if (!container) return;

  const canUseCustomDomain = globalEntitlements.can(CAPABILITIES.CUSTOM_DOMAIN);
  const currentDomain = masterProfile.customDomain || { hostname: '', status: 'unconfigured' };

  container.innerHTML = `
    <div class="custom-domain-panel" style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 18px; color: #fff; margin-bottom: 20px; box-sizing: border-box; max-width: 100%;">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; flex-wrap: wrap; gap: 8px;">
        <h3 style="font-size: 1rem; font-weight: 800; margin: 0; display: flex; align-items: center; gap: 8px;">
          🌐 Custom Domain
        </h3>
        ${canUseCustomDomain ? `
          <span style="font-size: 0.7rem; color: #10b981; font-weight: 800; background: rgba(16,185,129,0.15); border: 1px solid rgba(16,185,129,0.3); border-radius: 12px; padding: 2px 10px;">PRO FEATURE</span>
        ` : `
          <span style="font-size: 0.7rem; color: #f59e0b; font-weight: 800; background: rgba(245,158,11,0.15); border: 1px solid rgba(245,158,11,0.3); border-radius: 12px; padding: 2px 10px;">💎 PRO FEATURE</span>
        `}
      </div>

      ${!canUseCustomDomain ? `
        <div style="background: rgba(124,58,237,0.08); border: 1px solid rgba(124,58,237,0.25); border-radius: 14px; padding: 16px; text-align: center;">
          <p style="font-size: 0.82rem; color: rgba(255,255,255,0.8); margin-bottom: 12px; line-height: 1.5;">
            Use your own custom web address (e.g. <code>portfolio.yourname.com</code>) for your 3D portfolio.
          </p>
          <button id="btn-domain-upgrade" class="btn btn-primary" style="font-size: 0.8rem; font-weight: 800; padding: 8px 20px; width: 100%; max-width: 320px; margin: 0 auto;">
            💎 Upgrade to Pro to Connect Domain
          </button>
        </div>
      ` : `
        <!-- STEP-BY-STEP GUIDED FLOW -->
        <div style="display: flex; flex-direction: column; gap: 14px;">
          <!-- STEP 1: DOMAIN INPUT -->
          <div>
            <label for="f-custom-hostname" style="display: block; font-size: 0.75rem; font-weight: 700; color: rgba(255,255,255,0.7); margin-bottom: 6px;">
              Step 1: Enter your domain name
            </label>
            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
              <input id="f-custom-hostname" class="field-input" value="${currentDomain.hostname || ''}" placeholder="portfolio.yourname.com" style="flex: 1; min-width: 200px; font-size: 0.82rem; padding: 8px 12px;"/>
              <button id="btn-connect-domain" class="btn btn-primary" style="padding: 8px 16px; font-size: 0.8rem; font-weight: 800; white-space: nowrap;">
                Connect Domain
              </button>
            </div>
          </div>

          <!-- STEP 2: DNS RECORDS (Shown when hostname is entered) -->
          ${currentDomain.hostname ? `
            <div id="domain-dns-instructions" style="background: rgba(0,0,0,0.35); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 14px;">
              <div style="font-size: 0.78rem; font-weight: 800; color: #06b6d4; margin-bottom: 8px;">
                Step 2: Add this DNS record at your domain provider (e.g. GoDaddy, Namecheap, Cloudflare)
              </div>
              
              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 8px; margin-bottom: 12px;">
                <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 8px;">
                  <div style="font-size: 0.68rem; color: rgba(255,255,255,0.5);">Type</div>
                  <div style="font-family: 'JetBrains Mono', monospace; font-size: 0.82rem; font-weight: 700; color: #fff;">CNAME</div>
                </div>
                <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 8px; display: flex; justify-content: space-between; align-items: center;">
                  <div>
                    <div style="font-size: 0.68rem; color: rgba(255,255,255,0.5);">Name / Host</div>
                    <div style="font-family: 'JetBrains Mono', monospace; font-size: 0.82rem; font-weight: 700; color: #fff;">${currentDomain.hostname.split('.')[0] || 'portfolio'}</div>
                  </div>
                  <button onclick="navigator.clipboard.writeText('${currentDomain.hostname.split('.')[0] || 'portfolio'}');alert('Copied name!');" style="background:none;border:none;color:#06b6d4;font-size:0.75rem;cursor:pointer;">📋</button>
                </div>
                <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 8px; display: flex; justify-content: space-between; align-items: center;">
                  <div>
                    <div style="font-size: 0.68rem; color: rgba(255,255,255,0.5);">Target / Value</div>
                    <div style="font-family: 'JetBrains Mono', monospace; font-size: 0.78rem; font-weight: 700; color: #fff;">cname.3dportfolio.app</div>
                  </div>
                  <button onclick="navigator.clipboard.writeText('cname.3dportfolio.app');alert('Copied target!');" style="background:none;border:none;color:#06b6d4;font-size:0.75rem;cursor:pointer;">📋</button>
                </div>
              </div>

              <!-- STEP 3: VERIFY BUTTON -->
              <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
                <button id="btn-check-dns" class="btn btn-secondary" style="font-size: 0.8rem; font-weight: 800; padding: 8px 16px;">
                  I've Added This — Check Connection
                </button>
                ${currentDomain.status === 'active' ? `
                  <span style="color: #10b981; font-weight: 800; font-size: 0.8rem;">✅ Connected</span>
                ` : currentDomain.status === 'pending_verification' ? `
                  <span style="color: #f59e0b; font-size: 0.75rem;">⏳ Pending DNS verification</span>
                ` : ''}
              </div>
            </div>
          ` : ''}

          <!-- STEP 4: STATUS MESSAGE -->
          ${currentDomain.status === 'active' ? `
            <div style="background: rgba(16,185,129,0.08); border: 1px solid rgba(16,185,129,0.3); border-radius: 10px; padding: 12px; font-size: 0.8rem; color: #10b981;">
              ✓ Your portfolio is connected and live at <strong>https://${currentDomain.hostname}</strong>
            </div>
          ` : ''}
        </div>
      `}
    </div>
  `;

  const btnUpgrade = container.querySelector('#btn-domain-upgrade');
  if (btnUpgrade) {
    btnUpgrade.addEventListener('click', () => window.openBillingModal?.());
  }

  const btnConnect = container.querySelector('#btn-connect-domain');
  if (btnConnect) {
    btnConnect.addEventListener('click', async () => {
      const hostnameInput = container.querySelector('#f-custom-hostname');
      const hostname = hostnameInput?.value?.trim();
      if (!hostname) {
        alert('Please enter a domain name.');
        return;
      }
      btnConnect.disabled = true;
      btnConnect.textContent = 'Saving...';
      try {
        masterProfile.customDomain = { hostname, status: 'pending_verification' };
        onUpdateMasterProfile(masterProfile);
        renderCustomDomainPanel(container, masterProfile, onUpdateMasterProfile);
      } finally {
        btnConnect.disabled = false;
        btnConnect.textContent = 'Connect Domain';
      }
    });
  }

  const btnCheck = container.querySelector('#btn-check-dns');
  if (btnCheck) {
    btnCheck.addEventListener('click', async () => {
      const hostname = currentDomain.hostname;
      btnCheck.disabled = true;
      btnCheck.textContent = 'Checking connection...';
      try {
        const res = await verifyCustomDomainDNS(hostname, masterProfile.id);
        masterProfile.customDomain = res;
        onUpdateMasterProfile(masterProfile);
        if (res.verified) {
          alert(`Success! Domain ${hostname} is connected.`);
        } else {
          alert("We haven't detected the DNS change yet. DNS updates can take a few minutes to propagate. Please try again shortly.");
        }
        renderCustomDomainPanel(container, masterProfile, onUpdateMasterProfile);
      } catch (error) {
        alert(error.message || "We haven't detected the DNS change yet. Please verify the CNAME record at your provider.");
        btnCheck.disabled = false;
        btnCheck.textContent = "I've Added This — Check Connection";
      }
    });
  }
}
