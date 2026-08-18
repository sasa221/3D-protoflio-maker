/**
 * CustomDomainPanel.js
 * Studio UI Panel for Custom Domain.
 * Displays "Custom Domain — Coming Soon" transparently until full Vercel Domains API & TLS provisioning is completed.
 */

export function renderCustomDomainPanel(container) {
  if (!container) return;

  container.innerHTML = `
    <div class="custom-domain-panel" style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.07); border-radius: 16px; padding: 16px; color: #fff; margin-bottom: 14px; box-sizing: border-box; max-width: 100%;">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; flex-wrap: wrap; gap: 8px;">
        <h3 style="font-size: 0.95rem; font-weight: 800; margin: 0; display: flex; align-items: center; gap: 8px;">
          🌐 Custom Domain
        </h3>
        <span style="font-size: 0.68rem; color: #06b6d4; font-weight: 800; background: rgba(6,182,212,0.15); border: 1px solid rgba(6,182,212,0.3); border-radius: 12px; padding: 2px 10px;">
          COMING SOON
        </span>
      </div>
      <p style="font-size: 0.78rem; color: rgba(255,255,255,0.6); margin: 0; line-height: 1.5;">
        Connect your own personalized domain name (e.g. <code>portfolio.yourname.com</code>). Automated DNS & SSL integration is currently in development.
      </p>
    </div>
  `;
}
