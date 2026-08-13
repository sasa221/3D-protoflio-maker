/**
 * PrivacyPage.js
 * Production-ready plain-language Privacy Policy page for /privacy.
 */

import { PRODUCT_CONFIG } from '../config/ProductConfig.js';

export function renderPrivacyPage(container) {
  if (!container) return;

  container.style.display = 'block';
  container.style.height = 'auto';
  container.style.minHeight = '100vh';
  container.style.overflowY = 'auto';
  document.body.style.overflowY = 'auto';

  container.innerHTML = `
    <div style="min-height: 100vh; background: #050508; color: #fff; font-family: 'Inter', sans-serif;">
      <!-- TOP NAVIGATION -->
      <header style="padding: 20px 40px; border-bottom: 1px solid rgba(255,255,255,0.08); display: flex; justify-content: space-between; align-items: center;">
        <a href="/" style="display: flex; align-items: center; gap: 10px; text-decoration: none;">
          <div style="width: 34px; height: 34px; border-radius: 8px; background: linear-gradient(135deg,#7c3aed,#06b6d4); display: flex; align-items: center; justify-content: center; font-size: 1.1rem;">⚡</div>
          <span style="font-family: 'Outfit', sans-serif; font-size: 1.1rem; font-weight: 800; color: #fff;">${PRODUCT_CONFIG.productName}</span>
        </a>
        <a href="/" style="color: rgba(255,255,255,0.7); text-decoration: none; font-size: 0.88rem; font-weight: 600;">← Return Home</a>
      </header>

      <!-- PRIVACY CONTENT -->
      <main style="max-width: 840px; margin: 0 auto; padding: 60px 20px; line-height: 1.7; color: rgba(255,255,255,0.8);">
        <div style="font-size: 0.8rem; font-weight: 800; color: #06b6d4; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 8px;">
          LEGAL & DATA PRIVACY
        </div>
        <h1 style="font-family: 'Outfit', sans-serif; font-size: 2.5rem; font-weight: 900; color: #fff; margin-bottom: 12px;">
          Privacy Policy
        </h1>
        <div style="font-size: 0.85rem; color: rgba(255,255,255,0.4); margin-bottom: 40px;">
          Last Updated: ${PRODUCT_CONFIG.legal.lastUpdated}
        </div>

        <section style="margin-bottom: 32px;">
          <h2 style="font-size: 1.3rem; font-weight: 800; color: #fff; margin-bottom: 12px;">1. Information We Collect</h2>
          <p>We collect information necessary to provide and optimize our 3D portfolio creation services:</p>
          <ul style="padding-left: 20px; margin-top: 8px;">
            <li><strong>Account Data:</strong> Email address, display name, and password credentials managed via Supabase Auth.</li>
            <li><strong>Portfolio Content:</strong> Resume files, career history, education, projects, skills, and custom images uploaded by you.</li>
            <li><strong>Visitor Analytics:</strong> Aggregated, privacy-conscious page views, project opens, and resume download clicks recorded on published portfolios.</li>
          </ul>
        </section>

        <section style="margin-bottom: 32px;">
          <h2 style="font-size: 1.3rem; font-weight: 800; color: #fff; margin-bottom: 12px;">2. Public vs. Private Information</h2>
          <p>
            <strong>Only content explicitly published in your active portfolio is visible to external public visitors.</strong>
            Draft edits, target job descriptions, resume files set to private, subscription details, and analytics dashboards are strictly confidential and protected by database Row Level Security.
          </p>
        </section>

        <section style="margin-bottom: 32px;">
          <h2 style="font-size: 1.3rem; font-weight: 800; color: #fff; margin-bottom: 12px;">3. Third-Party Infrastructure Processors</h2>
          <p>We utilize trusted enterprise infrastructure providers to operate the product securely:</p>
          <ul style="padding-left: 20px; margin-top: 8px;">
            <li><strong>Supabase:</strong> Authenticated database persistence and encrypted file storage.</li>
            <li><strong>Vercel:</strong> Global edge website hosting and serverless API execution.</li>
            <li><strong>Stripe:</strong> PCI-compliant billing and subscription management. Credit card details are never stored on our servers.</li>
            <li><strong>Resend:</strong> Secure transactional password reset email delivery.</li>
            <li><strong>Sentry:</strong> Client-side exception monitoring with automated data sanitization filters.</li>
          </ul>
        </section>

        <section style="margin-bottom: 32px;">
          <h2 style="font-size: 1.3rem; font-weight: 800; color: #fff; margin-bottom: 12px;">4. Account Deletion & Data Retention</h2>
          <p>
            You retain 100% ownership of your career data. You may request account deletion at any time through Account Settings. Deletion permanently removes your portfolios, storage assets, and variants from our servers.
          </p>
        </section>

        <section style="margin-bottom: 32px;">
          <h2 style="font-size: 1.3rem; font-weight: 800; color: #fff; margin-bottom: 12px;">5. Contact Us</h2>
          <p>
            For privacy inquiries or data rights requests, please contact our support team at <a href="mailto:${PRODUCT_CONFIG.supportEmail}" style="color: #06b6d4;">${PRODUCT_CONFIG.supportEmail}</a>.
          </p>
        </section>
      </main>
    </div>
  `;
}
