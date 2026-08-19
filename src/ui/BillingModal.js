/**
 * BillingModal.js
 * Studio UI Modal for SaaS Monetization, plan comparison, and checkout triggers.
 * Phase 8A: All prices from PlanConfig.js. No real checkout connected.
 */

import { globalEntitlements } from '../services/EntitlementService.js';
import { globalBilling } from '../services/BillingService.js';
import { PLANS, formatPrice } from '../config/PlanConfig.js';
import { isFeatureEnabled } from '../config/FeatureFlags.js';

let modalContainer = null;

function buildPlanCard(planId, currentPlan) {
  const plan = PLANS[planId];
  if (!plan) return '';
  const isCurrent = currentPlan === planId;
  const isHighlighted = planId === 'pro';

  const bg = isHighlighted
    ? 'linear-gradient(135deg, rgba(124,58,237,0.15), rgba(6,182,212,0.1))'
    : 'rgba(255,255,255,0.02)';
  const border = isHighlighted
    ? '2px solid rgba(124,58,237,0.6)'
    : isCurrent
      ? '1px solid rgba(124,58,237,0.5)'
      : '1px solid rgba(255,255,255,0.08)';
  const shadow = isHighlighted ? 'box-shadow: 0 0 30px rgba(124,58,237,0.2);' : '';
  const nameColor = isHighlighted ? 'color: #a855f7;' : '';

  const priceDisplay = plan.priceMonthlyEGP === 0
    ? '0'
    : plan.priceMonthlyEGP.toLocaleString('en-EG');
  const periodDisplay = plan.priceMonthlyEGP > 0 ? '/month' : '';

  let badgeHTML = '';
  if (isCurrent) {
    badgeHTML = '<span style="position: absolute; top: 12px; right: 12px; font-size: 0.6rem; color: #10b981; font-weight: 800; background: rgba(16,185,129,0.15); border: 1px solid rgba(16,185,129,0.3); border-radius: 12px; padding: 2px 8px;">CURRENT</span>';
  } else if (plan.badge) {
    badgeHTML = '<span style="position: absolute; top: 12px; right: 12px; font-size: 0.6rem; color: #f59e0b; font-weight: 800; background: rgba(245,158,11,0.15); border: 1px solid rgba(245,158,11,0.3); border-radius: 12px; padding: 2px 8px;">' + plan.badge + '</span>';
  }

  const ctaHTML = isCurrent
    ? '<button disabled class="btn btn-secondary" style="width: 100%; opacity: 0.6; padding: 8px; font-size: 0.8rem;">Active Plan</button>'
    : '<button class="btn btn-primary btn-trigger-checkout" data-plan="' + planId + '" style="width: 100%; font-weight: 900; padding: 8px; font-size: 0.8rem;">' + plan.cta + '</button>';

  return '<div style="background: ' + bg + '; border: ' + border + '; border-radius: 18px; padding: 16px; position: relative; ' + shadow + '">'
    + badgeHTML
    + '<h3 style="font-size: 1.1rem; font-weight: 800; margin: 0 0 6px 0; ' + nameColor + '">' + plan.name.toUpperCase() + '</h3>'
    + '<div style="font-size: 1.5rem; font-weight: 900; color: #fff; margin-bottom: 12px;">'
    + priceDisplay
    + ' <span style="font-size: 0.75rem; font-weight: 400; color: rgba(255,255,255,0.5);"> EGP' + periodDisplay + '</span>'
    + '</div>'
    + '<p style="font-size: 0.75rem; color: rgba(255,255,255,0.6); min-height: 2.5em; margin-bottom: 12px;">' + plan.description + '</p>'
    + ctaHTML
    + '</div>';
}

export function openBillingModal(currentUserId, onSubscriptionUpdated) {
  if (!currentUserId) {
    window.location.href = '/login?next=/studio';
    return;
  }
  if (modalContainer) modalContainer.remove();

  modalContainer = document.createElement('div');
  modalContainer.className = 'cv-import-modal-overlay';
  modalContainer.style.zIndex = '10000';

  const currentPlan = globalEntitlements.getPlanId();
  const monetizationEnabled = isFeatureEnabled('MONETIZATION_UI_ENABLED');

  const cardsHTML = ['free', 'pro', 'premium', 'premium_group']
    .map(id => buildPlanCard(id, currentPlan))
    .join('');

  modalContainer.innerHTML = `
    <div class="cv-modal-card" style="max-width: 900px; text-align: left; padding: 28px; max-height: 90vh; overflow-y: auto;">
      <button id="btn-close-billing" style="
        position: absolute; top: 20px; right: 20px; background: rgba(255,255,255,0.06);
        border: 1px solid rgba(255,255,255,0.12); color: #fff; border-radius: 50%; width: 32px; height: 32px;
        font-weight: bold; cursor: pointer; display: flex; align-items: center; justify-content: center;
      ">✕</button>

      <div style="margin-bottom: 20px; text-align: center;">
        <span style="font-size: 0.75rem; font-weight: 800; color: var(--primary, #7c3aed); letter-spacing: 1.5px; text-transform: uppercase;">💎 PLANS &amp; PRICING</span>
        <h2 style="font-size: 1.6rem; font-weight: 900; margin: 6px 0 8px 0;">Upgrade Your 3D Portfolio Experience</h2>
        <p style="font-size: 0.85rem; color: rgba(255,255,255,0.6); max-width: 500px; margin: 0 auto;">
          Choose the plan that fits your career goals.
        </p>
      </div>

      <!-- PRICING CARDS -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px;">
        ${cardsHTML}
      </div>
    </div>
  `;

  document.body.appendChild(modalContainer);

  modalContainer.querySelector('#btn-close-billing').addEventListener('click', () => modalContainer.remove());

  const btnCheckouts = modalContainer.querySelectorAll('.btn-trigger-checkout');
  btnCheckouts.forEach(btn => {
    btn.addEventListener('click', async () => {
      const planId = btn.getAttribute('data-plan');

      if (!monetizationEnabled) {
        showCheckoutPlaceholder(planId);
        return;
      }

      const originalText = btn.textContent;
      btn.textContent = '⏳ Loading...';
      btn.disabled = true;
      try {
        const checkout = await globalBilling.createCheckoutSession(currentUserId, planId, 'monthly');
        if (checkout.checkoutUrl) {
          window.location.assign(checkout.checkoutUrl);
        } else {
          showCheckoutPlaceholder(planId);
        }
      } catch (error) {
        btn.disabled = false;
        btn.textContent = originalText;
        showCheckoutPlaceholder(planId);
      }
    });
  });
}

function showCheckoutPlaceholder(planId) {
  const plan = PLANS[planId];
  const priceText = plan ? plan.priceMonthlyEGP.toLocaleString('en-EG') + ' EGP/month' : '';
  const placeholder = document.createElement('div');
  placeholder.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.8);z-index:10001;display:flex;align-items:center;justify-content:center;';

  placeholder.innerHTML = `
    <div style="background: #1a1a1a; padding: 2rem; border-radius: 12px; border: 1px solid #333; text-align: center; max-width: 400px;">
      <h2 style="color: #fff; margin-bottom: 8px;">${plan?.name || planId} Plan</h2>
      <p style="font-size: 1.5rem; font-weight: bold; color: #e0a040; margin-bottom: 1rem;">${priceText}</p>
      <div style="background: #222; padding: 1rem; border-radius: 8px; margin-bottom: 1.5rem;">
        <p style="color: #ccc; margin: 4px 0;">✨ Checkout is not connected yet.</p>
        <p style="color: #ccc; margin: 4px 0;">Payment integration is coming soon!</p>
      </div>
      <button class="btn btn-primary btn-close-placeholder" style="width: 100%;">Got it</button>
    </div>
  `;

  document.body.appendChild(placeholder);
  placeholder.querySelector('.btn-close-placeholder').addEventListener('click', () => placeholder.remove());
  placeholder.addEventListener('click', (e) => { if (e.target === placeholder) placeholder.remove(); });
}
