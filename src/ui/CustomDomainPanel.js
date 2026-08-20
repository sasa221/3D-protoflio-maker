/**
 * CustomDomainPanel.js
 * Studio UI Panel for Custom Domain.
 * Saves a domain request and verifies DNS through the existing consolidated portfolio API.
 */
import { verifyCustomDomainDNS } from '../services/PublishService.js';

export function renderCustomDomainPanel(container, portfolioData = {}, onUpdate = () => {}) {
  if (!container) return;

  container.innerHTML = `
    <div class="custom-domain-panel" style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.07); border-radius: 16px; padding: 16px; color: #fff; margin-bottom: 14px; box-sizing: border-box; max-width: 100%;">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; flex-wrap: wrap; gap: 8px;">
        <h3 style="font-size: 0.95rem; font-weight: 800; margin: 0; display: flex; align-items: center; gap: 8px;">
          🌐 Custom Domain
        </h3>
        <span style="font-size: 0.68rem; color: #06b6d4; font-weight: 800; background: rgba(6,182,212,0.15); border: 1px solid rgba(6,182,212,0.3); border-radius: 12px; padding: 2px 10px;">
          DNS SETUP
        </span>
      </div>
      <p style="font-size: 0.78rem; color: rgba(255,255,255,0.6); margin: 0; line-height: 1.5;">
        Enter a hostname, then point its CNAME to <code>portfolio-maker-murex.vercel.app</code>. We can verify DNS now; automatic Vercel routing and SSL still require provider access.
      </p>
      <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap;">
        <input id="custom-domain-hostname" value="${portfolioData.customDomain?.hostname || ''}" placeholder="portfolio.yourname.com" style="min-width:0;flex:1 1 220px;padding:10px 12px;background:rgba(0,0,0,.3);border:1px solid rgba(255,255,255,.15);border-radius:8px;color:#fff;" />
        <button id="custom-domain-connect" type="button" class="btn btn-secondary" style="padding:10px 14px;white-space:nowrap;">Save & Verify DNS</button>
      </div>
      <div id="custom-domain-status" style="display:none;margin-top:10px;padding:9px 11px;border-radius:8px;font-size:.75rem;line-height:1.45;"></div>
    </div>
  `;

  const button = container.querySelector('#custom-domain-connect');
  const input = container.querySelector('#custom-domain-hostname');
  const status = container.querySelector('#custom-domain-status');
  button?.addEventListener('click', async () => {
    const hostname = input?.value?.trim();
    if (!hostname) return show('Enter a valid hostname first.', false);
    const portfolioId = portfolioData.id || portfolioData.portfolioId || portfolioData.portfolio_id;
    if (!portfolioId) return show('Publish or save this portfolio before connecting a domain.', false);
    button.disabled = true;
    button.textContent = 'Checking DNS…';
    try {
      const result = await verifyCustomDomainDNS(hostname, portfolioId);
      portfolioData.customDomain = { hostname: result.hostname, status: result.verified ? 'dns_verified' : 'pending_dns', sslStatus: 'not_provisioned' };
      onUpdate(portfolioData);
      show(result.verified
        ? 'DNS verified. Provider routing/SSL is not provisioned yet, so this domain is not live.'
        : `Saved. Add CNAME ${result.hostname} → ${result.cnameRecord || 'portfolio-maker-murex.vercel.app'}, then verify again.`, result.verified);
    } catch (error) {
      show(error.message || 'Unable to verify the domain.', false);
    } finally {
      button.disabled = false;
      button.textContent = 'Save & Verify DNS';
    }
  });

  function show(message, ok) {
    status.textContent = message;
    status.style.display = 'block';
    status.style.color = ok ? '#6ee7b7' : '#fde68a';
    status.style.background = ok ? 'rgba(16,185,129,.12)' : 'rgba(245,158,11,.12)';
    status.style.border = `1px solid ${ok ? 'rgba(16,185,129,.3)' : 'rgba(245,158,11,.3)'}`;
  }
}
