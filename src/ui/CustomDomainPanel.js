/**
 * CustomDomainPanel.js
 * Studio UI Panel for Custom Domain.
 * Saves a domain request and verifies DNS through the existing consolidated portfolio API.
 */
import { connectCustomDomain, verifyCustomDomainDNS } from '../services/PublishService.js';

export function renderCustomDomainPanel(container, portfolioData = {}, onUpdate = () => {}) {
  if (!container) return;

  let domainState = portfolioData.customDomain || null;
  container.innerHTML = `
    <div class="custom-domain-panel" style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.07); border-radius: 16px; padding: 16px; color: #fff; margin-bottom: 14px; box-sizing: border-box; max-width: 100%;">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; flex-wrap: wrap; gap: 8px;">
        <h3 style="font-size: 0.95rem; font-weight: 800; margin: 0; display: flex; align-items: center; gap: 8px;">
          🌐 Custom Domain
        </h3>
        <span id="custom-domain-badge" style="font-size: 0.68rem; color: #06b6d4; font-weight: 800; background: rgba(6,182,212,0.15); border: 1px solid rgba(6,182,212,0.3); border-radius: 12px; padding: 2px 10px;">
          ${String(domainState?.status || 'NOT CONNECTED').replaceAll('_', ' ').toUpperCase()}
        </span>
      </div>
      <p style="font-size: 0.78rem; color: rgba(255,255,255,0.6); margin: 0; line-height: 1.5;">
        Connect a domain you own. Vercel will return the exact DNS record required before activation.
      </p>
      <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap;">
        <input id="custom-domain-hostname" value="${portfolioData.customDomain?.hostname || ''}" placeholder="portfolio.yourname.com" style="min-width:0;flex:1 1 220px;padding:10px 12px;background:rgba(0,0,0,.3);border:1px solid rgba(255,255,255,.15);border-radius:8px;color:#fff;" />
        <button id="custom-domain-connect" type="button" class="btn btn-secondary" style="padding:10px 14px;white-space:nowrap;">Connect Domain</button>
      </div>
      <div id="custom-domain-dns" style="display:none;margin-top:10px;"></div>
      <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;">
        <button id="custom-domain-verify" type="button" class="btn btn-secondary" style="display:${domainState?.hostname ? 'inline-flex' : 'none'};padding:9px 13px;">Verify Domain</button>
        <a id="custom-domain-open" href="${domainState?.status === 'active' ? `https://${domainState.hostname}` : '#'}" target="_blank" rel="noopener noreferrer" style="display:${domainState?.status === 'active' ? 'inline-flex' : 'none'};padding:9px 13px;color:#6ee7b7;text-decoration:none;">Open Domain ↗</a>
      </div>
      <div id="custom-domain-status" style="display:none;margin-top:10px;padding:9px 11px;border-radius:8px;font-size:.75rem;line-height:1.45;"></div>
    </div>
  `;

  const button = container.querySelector('#custom-domain-connect');
  const input = container.querySelector('#custom-domain-hostname');
  const status = container.querySelector('#custom-domain-status');
  const verifyButton = container.querySelector('#custom-domain-verify');
  const badge = container.querySelector('#custom-domain-badge');
  const dnsBox = container.querySelector('#custom-domain-dns');
  const openLink = container.querySelector('#custom-domain-open');
  button?.addEventListener('click', async () => {
    const hostname = input?.value?.trim();
    if (!hostname) return show('Enter a valid hostname first.', false);
    const portfolioId = portfolioData.id || portfolioData.portfolioId || portfolioData.portfolio_id;
    if (!portfolioId) return show('Publish or save this portfolio before connecting a domain.', false);
    button.disabled = true;
    button.textContent = 'Adding Domain…';
    setBadge('VERIFYING');
    try {
      const result = await connectCustomDomain(hostname, portfolioId);
      domainState = { hostname: result.domain, status: result.status.toLowerCase(), sslStatus: 'provisioning', dnsInstructions: result.dnsInstructions };
      portfolioData.customDomain = domainState;
      onUpdate(portfolioData);
      renderDns(result.dnsInstructions);
      verifyButton.style.display = 'inline-flex';
      setBadge(result.status);
      show('Domain added. Apply the DNS record below, then click Verify Domain.', true);
    } catch (error) {
      setBadge('ERROR');
      show(error.code === 'VERCEL_CONFIG_MISSING' ? 'Custom domain activation is temporarily unavailable.' : (error.message || 'Unable to connect the domain.'), false);
    } finally {
      button.disabled = false;
      button.textContent = 'Connect Domain';
    }
  });

  verifyButton?.addEventListener('click', async () => {
    const hostname = input?.value?.trim();
    const portfolioId = portfolioData.id || portfolioData.portfolioId || portfolioData.portfolio_id;
    if (!hostname || !portfolioId) return show('Connect this domain first.', false);
    verifyButton.disabled = true;
    verifyButton.textContent = 'Verifying…';
    setBadge('VERIFYING');
    try {
      const result = await verifyCustomDomainDNS(hostname, portfolioId);
      domainState = { hostname: result.domain, status: result.status.toLowerCase(), sslStatus: result.sslStatus, dnsInstructions: result.dnsInstructions };
      portfolioData.customDomain = domainState;
      onUpdate(portfolioData);
      renderDns(result.dnsInstructions);
      setBadge(result.status);
      if (result.active) {
        openLink.href = result.url;
        openLink.style.display = 'inline-flex';
        show('Domain is active and serving securely through Vercel.', true);
      } else {
        show(result.verified && result.configured ? 'DNS is verified. Vercel is still provisioning SSL/serving.' : 'Awaiting the required DNS change.', false);
      }
    } catch (error) {
      setBadge('ERROR');
      show(error.code === 'VERCEL_CONFIG_MISSING' ? 'Custom domain activation is temporarily unavailable.' : (error.message || 'Unable to verify the domain.'), false);
    } finally {
      verifyButton.disabled = false;
      verifyButton.textContent = 'Verify Domain';
    }
  });

  if (domainState?.dnsInstructions) renderDns(domainState.dnsInstructions);

  function setBadge(value) { badge.textContent = String(value || 'ERROR').replaceAll('_', ' ').toUpperCase(); }
  function renderDns(records = []) {
    if (!records.length) return;
    dnsBox.innerHTML = records.map((record, index) => `<div style="display:grid;grid-template-columns:auto 1fr;gap:4px 10px;padding:10px;background:rgba(0,0,0,.25);border-radius:8px;font-size:.73rem;margin-top:6px;"><strong>Type</strong><span>${record.type}</span><strong>Name</strong><span style="word-break:break-all;">${record.name}</span><strong>Value</strong><span style="word-break:break-all;">${record.value}</span><button type="button" data-copy-dns="${index}" style="grid-column:1/-1;margin-top:5px;padding:6px;border-radius:6px;">Copy Value</button></div>`).join('');
    dnsBox.style.display = 'block';
    dnsBox.querySelectorAll('[data-copy-dns]').forEach(copy => copy.addEventListener('click', async () => {
      await navigator.clipboard.writeText(records[Number(copy.dataset.copyDns)].value);
      copy.textContent = 'Copied';
    }));
  }

  function show(message, ok) {
    status.textContent = message;
    status.style.display = 'block';
    status.style.color = ok ? '#6ee7b7' : '#fde68a';
    status.style.background = ok ? 'rgba(16,185,129,.12)' : 'rgba(245,158,11,.12)';
    status.style.border = `1px solid ${ok ? 'rgba(16,185,129,.3)' : 'rgba(245,158,11,.3)'}`;
  }
}
