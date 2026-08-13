/**
 * BillingModal.js
 * Studio UI Modal for SaaS Monetization, Free vs Pro comparison, and checkout triggers.
 */

import { globalEntitlements, PLAN_CONFIG } from '../services/EntitlementService.js';
import { globalBilling } from '../services/BillingService.js';

let modalContainer = null;

export function openBillingModal(currentUserId = 'user_saleh_123', onSubscriptionUpdated) {
  if (modalContainer) modalContainer.remove();

  modalContainer = document.createElement('div');
  modalContainer.className = 'cv-import-modal-overlay';
  modalContainer.style.zIndex = '10000';

  const currentPlan = globalEntitlements.getPlanId();
  const isPro = currentPlan === 'pro';

  modalContainer.innerHTML = `
    <div class="cv-modal-card" style="max-width: 720px; text-align: left; padding: 28px;">
      <button id="btn-close-billing" style="
        position: absolute; top: 20px; right: 20px; background: rgba(255,255,255,0.06);
        border: 1px solid rgba(255,255,255,0.12); color: #fff; border-radius: 50%; width: 32px; height: 32px;
        font-weight: bold; cursor: pointer; display: flex; align-items: center; justify-content: center;
      ">✕</button>

      <div style="margin-bottom: 20px; text-align: center;">
        <span style="font-size: 0.75rem; font-weight: 800; color: var(--primary, #7c3aed); letter-spacing: 1.5px; text-transform: uppercase;">💎 SaaS MONETIZATION & PRICING</span>
        <h2 style="font-size: 1.6rem; font-weight: 900; margin: 6px 0 8px 0;">Upgrade Your 3D Portfolio Experience</h2>
        <p style="font-size: 0.85rem; color: rgba(255,255,255,0.6); max-width: 500px; margin: 0 auto;">
          Choose the plan that fits your career goals. Upgrade to unlock custom domains, unlimited variants, and advanced themes.
        </p>
      </div>

      <!-- PRICING CARDS -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px;">
        <!-- FREE PLAN -->
        <div style="
          background: rgba(255,255,255,0.02); border: 1px solid ${!isPro ? 'rgba(124,58,237,0.5)' : 'rgba(255,255,255,0.08)'};
          border-radius: 18px; padding: 20px; position: relative;
        ">
          ${!isPro ? '<span style="position: absolute; top: 16px; right: 16px; font-size: 0.68rem; color: #10b981; font-weight: 800; background: rgba(16,185,129,0.15); border: 1px solid rgba(16,185,129,0.3); border-radius: 12px; padding: 2px 10px;">CURRENT PLAN</span>' : ''}
          <h3 style="font-size: 1.2rem; font-weight: 800; margin: 0 0 6px 0;">FREE</h3>
          <div style="font-size: 1.8rem; font-weight: 900; color: #fff; margin-bottom: 12px;">$0 <span style="font-size: 0.8rem; font-weight: 400; color: rgba(255,255,255,0.5);">/forever</span></div>

          <ul style="font-size: 0.78rem; color: rgba(255,255,255,0.8); line-height: 1.8; margin: 0 0 20px 0; padding-left: 18px;">
            <li>1 Master Portfolio</li>
            <li>1 Portfolio Variant</li>
            <li>Basic 3D Themes & Short Intro</li>
            <li>CV Import Starter Allowance</li>
            <li>Recruiter Mode Included</li>
            <li>Platform Subdomain & Branding</li>
          </ul>

          <button disabled class="btn btn-secondary" style="width: 100%; opacity: 0.6; padding: 10px;">
            ${!isPro ? 'Active Plan' : 'Basic Plan'}
          </button>
        </div>

        <!-- PRO PLAN -->
        <div style="
          background: linear-gradient(135deg, rgba(124,58,237,0.15), rgba(6,182,212,0.1));
          border: 2px solid rgba(124,58,237,0.6); border-radius: 18px; padding: 20px; position: relative;
          box-shadow: 0 0 30px rgba(124,58,237,0.2);
        ">
          ${isPro ? '<span style="position: absolute; top: 16px; right: 16px; font-size: 0.68rem; color: #10b981; font-weight: 800; background: rgba(16,185,129,0.15); border: 1px solid rgba(16,185,129,0.3); border-radius: 12px; padding: 2px 10px;">CURRENT PLAN</span>' : '<span style="position: absolute; top: 16px; right: 16px; font-size: 0.68rem; color: #f59e0b; font-weight: 800; background: rgba(245,158,11,0.15); border: 1px solid rgba(245,158,11,0.3); border-radius: 12px; padding: 2px 10px;">RECOMMENDED</span>'}
          <h3 style="font-size: 1.2rem; font-weight: 800; margin: 0 0 6px 0; color: #a855f7;">PRO UNLIMITED</h3>
          <div style="font-size: 1.8rem; font-weight: 900; color: #fff; margin-bottom: 12px;">$12 <span style="font-size: 0.8rem; font-weight: 400; color: rgba(255,255,255,0.5);">/month</span></div>

          <ul style="font-size: 0.78rem; color: rgba(255,255,255,0.9); line-height: 1.8; margin: 0 0 20px 0; padding-left: 18px;">
            <li><strong>Up to 5 Targeted Variants</strong></li>
            <li><strong>Custom Domain Connection</strong></li>
            <li><strong>Remove Platform Branding</strong></li>
            <li><strong>Premium 3D Worlds & Epic Intros</strong></li>
            <li><strong>Job Targeting & AI Optimizer</strong></li>
            <li><strong>90-Day Advanced Analytics</strong></li>
            <li><strong>Unlimited HTML Exports</strong></li>
          </ul>

          ${!isPro ? `
            <button id="btn-trigger-checkout" class="btn btn-primary" style="width: 100%; font-weight: 900; padding: 12px;">
              🚀 Upgrade to Pro ($12/mo)
            </button>
          ` : `
            <button id="btn-downgrade-free" class="btn btn-secondary" style="width: 100%; padding: 10px; color: #ef4444;">
              Downgrade to Free
            </button>
          `}
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modalContainer);

  modalContainer.querySelector('#btn-close-billing').addEventListener('click', () => modalContainer.remove());

  const btnCheckout = modalContainer.querySelector('#btn-trigger-checkout');
  if (btnCheckout) {
    btnCheckout.addEventListener('click', async () => {
      btnCheckout.textContent = '⏳ Creating Checkout Session...';
      const checkout = await globalBilling.createCheckoutSession(currentUserId, 'pro', 'monthly');

      // Simulate Stripe Webhook Execution
      setTimeout(async () => {
        await globalBilling.handleWebhookEvent({
          type: 'checkout.session.completed',
          data: { userId: currentUserId, planId: 'pro', customerId: 'cus_saleh_pro' }
        }, 'valid_stripe_signature');

        alert('🎉 Upgrade Successful! Pro capabilities unlocked.');
        modalContainer.remove();
        if (onSubscriptionUpdated) onSubscriptionUpdated();
      }, 800);
    });
  }

  const btnDowngrade = modalContainer.querySelector('#btn-downgrade-free');
  if (btnDowngrade) {
    btnDowngrade.addEventListener('click', async () => {
      if (confirm('Downgrade to Free plan? (Your variants and projects will NOT be deleted; excess items will simply be locked).')) {
        await globalBilling.downgradeUserToFree(currentUserId);
        alert('Downgraded to Free plan. User data retained safely.');
        modalContainer.remove();
        if (onSubscriptionUpdated) onSubscriptionUpdated();
      }
    });
  }
}
