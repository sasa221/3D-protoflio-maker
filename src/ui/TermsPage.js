/**
 * TermsPage.js
 * Production-ready Terms of Service page for /terms.
 */

import { PRODUCT_CONFIG } from '../config/ProductConfig.js';

export function renderTermsPage(container) {
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

      <!-- TERMS CONTENT -->
      <main style="max-width: 840px; margin: 0 auto; padding: 60px 20px; line-height: 1.7; color: rgba(255,255,255,0.8);">
        <div style="font-size: 0.8rem; font-weight: 800; color: #7c3aed; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 8px;">
          TERMS OF SERVICE
        </div>
        <h1 style="font-family: 'Outfit', sans-serif; font-size: 2.5rem; font-weight: 900; color: #fff; margin-bottom: 12px;">
          Terms of Service
        </h1>
        <div style="font-size: 0.85rem; color: rgba(255,255,255,0.4); margin-bottom: 40px;">
          Last Updated: ${PRODUCT_CONFIG.legal.lastUpdated}
        </div>

        <section style="margin-bottom: 32px;">
          <h2 style="font-size: 1.3rem; font-weight: 800; color: #fff; margin-bottom: 12px;">1. Acceptance of Terms</h2>
          <p>
            By creating an account or accessing ${PRODUCT_CONFIG.productName}, you agree to be bound by these Terms of Service. If you do not agree to these terms, you may not access or use the platform.
          </p>
        </section>

        <section style="margin-bottom: 32px;">
          <h2 style="font-size: 1.3rem; font-weight: 800; color: #fff; margin-bottom: 12px;">2. User Content Ownership & Responsibility</h2>
          <p>
            You retain full intellectual property ownership of all career data, images, text, and documents uploaded to the platform. You are solely responsible for ensuring that published portfolio content is accurate and does not violate copyright or non-disclosure agreements.
          </p>
        </section>

        <section style="margin-bottom: 32px;">
          <h2 style="font-size: 1.3rem; font-weight: 800; color: #fff; margin-bottom: 12px;">3. Subscriptions & Billing</h2>
          <p>
            Pro subscriptions are billed on a recurring monthly or annual basis. You may cancel your subscription at any time through the Billing Portal. Cancellations take effect at the end of your current billing period, and your features remain active until that date.
          </p>
        </section>

        <section style="margin-bottom: 32px;">
          <h2 style="font-size: 1.3rem; font-weight: 800; color: #fff; margin-bottom: 12px;">4. Acceptable Use</h2>
          <p>
            You agree not to use the platform for unlawful purposes, impersonation, spam distribution, or uploading malicious code. We reserve the right to suspend accounts violating acceptable use policies.
          </p>
        </section>

        <section style="margin-bottom: 32px;">
          <h2 style="font-size: 1.3rem; font-weight: 800; color: #fff; margin-bottom: 12px;">5. Limitation of Liability</h2>
          <p>
            ${PRODUCT_CONFIG.productName} is provided "as is" without warranty of any kind. We are not liable for recruitment decisions, job application outcomes, or temporary service interruptions.
          </p>
        </section>
      </main>
    </div>
  `;
}
