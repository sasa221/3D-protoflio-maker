/**
 * BillingModal.js
 * Premium Plans & Pricing Modal for Portfolio Maker Studio.
 * Coherent SaaS visual hierarchy, equal height 4-card grid, interactive group seat selector,
 * distinct CTAs, concise benefit checkmarks, and seamless single-modal lifecycle.
 */

import { globalEntitlements } from '../services/EntitlementService.js';
import { PLANS, GROUP_SEAT_PRICING, formatEGP } from '../config/PlanConfig.js';
import { submitManualPayment, getUserPaymentStatus, redeemPromoCode, getPublicPaymentConfig } from '../services/AuthService.js';
import { openGroupManagementModal } from './GroupManagementModal.js';

let modalContainer = null;
let currentSelectedGroupSeats = 2;

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export async function openBillingModal(arg1, arg2, arg3) {
  let currentUserId = null;
  let onSubscriptionUpdated = null;
  let targetPlan = null;

  if (typeof arg1 === 'object' && arg1 !== null) {
    currentUserId = arg1.currentUserId || arg1.userId || null;
    onSubscriptionUpdated = arg1.onSubscriptionUpdated || null;
    targetPlan = arg1.targetPlan || arg1.recommendedPlan || null;
  } else {
    currentUserId = arg1 || null;
    onSubscriptionUpdated = arg2 || null;
    if (typeof arg3 === 'object' && arg3 !== null) {
      targetPlan = arg3.targetPlan || arg3.recommendedPlan || null;
    } else if (typeof arg3 === 'string') {
      targetPlan = arg3;
    }
  }

  if (modalContainer) {
    modalContainer.remove();
    modalContainer = null;
  }

  modalContainer = document.createElement('div');
  modalContainer.className = 'cv-import-modal-overlay billing-modal-overlay';
  modalContainer.style.cssText = 'position: fixed; inset: 0; background: rgba(0, 0, 0, 0.88); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); display: flex; align-items: center; justify-content: center; z-index: 100000; padding: clamp(12px, 3vw, 24px); box-sizing: border-box;';

  const currentPlan = globalEntitlements.getEffectivePlanId();
  let pendingRequests = [];
  try {
    const statusData = await getUserPaymentStatus();
    pendingRequests = (statusData?.requests || []).filter(r => r.status === 'PENDING');
  } catch (_) {}

  renderBillingMainView(currentPlan, pendingRequests, onSubscriptionUpdated, targetPlan);
  document.body.appendChild(modalContainer);
}

function renderBillingMainView(currentPlan, pendingRequests, onSubscriptionUpdated, targetPlan = null) {
  if (!modalContainer) return;

  const cardsHTML = ['free', 'pro', 'premium', 'premium_group']
    .map(id => buildPlanCard(id, currentPlan, targetPlan, currentSelectedGroupSeats))
    .join('');

  modalContainer.innerHTML = `
    <div class="cv-modal-card billing-modal-card" style="position: relative; max-width: 1240px; width: 100%; text-align: left; padding: clamp(20px, 3.5vw, 36px); max-height: 92vh; overflow-y: auto; background: #080911; border: 1px solid rgba(255,255,255,0.12); border-radius: 24px; color: #fff; box-shadow: 0 30px 70px -15px rgba(0,0,0,0.9); box-sizing: border-box; font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;">
      
      <!-- CLOSE BUTTON -->
      <button id="btn-close-billing" style="
        position: absolute; top: 20px; right: 20px; background: rgba(255,255,255,0.06);
        border: 1px solid rgba(255,255,255,0.14); color: #fff; border-radius: 50%; width: 34px; height: 34px;
        font-size: 14px; font-weight: bold; cursor: pointer; display: flex; align-items: center; justify-content: center; z-index: 10; transition: all 0.2s ease;
      ">✕</button>

      <!-- HEADER -->
      <div style="margin-bottom: 28px; text-align: center; padding: 0 16px;">
        <div style="display: inline-flex; align-items: center; gap: 6px; padding: 4px 12px; background: rgba(124,58,237,0.12); border: 1px solid rgba(124,58,237,0.3); border-radius: 20px; margin-bottom: 10px;">
          <span style="font-size: 0.72rem; font-weight: 800; color: #c084fc; letter-spacing: 1.5px; text-transform: uppercase;">💎 PLANS &amp; PRICING</span>
        </div>
        <h2 style="font-size: clamp(1.4rem, 3.2vw, 2.1rem); font-weight: 900; margin: 0 0 10px 0; color: #ffffff; letter-spacing: -0.5px;">
          Choose the plan that fits your portfolio
        </h2>
        <p style="font-size: clamp(0.85rem, 1.8vw, 0.95rem); color: rgba(255,255,255,0.65); max-width: 620px; margin: 0 auto; line-height: 1.5;">
          Start free. Upgrade when you're ready to publish, grow, or unlock premium features.
        </p>
      </div>

      <!-- PENDING PAYMENT BANNER (IF ACTIVE) -->
      ${pendingRequests.length ? `
        <div style="background: rgba(234,179,8,0.08); border: 1px solid rgba(234,179,8,0.28); border-radius: 16px; padding: 14px 18px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <span style="font-size: 20px;">⏳</span>
            <div>
              <strong style="color: #fde047; font-size: 13px; display: block;">Payment Verification Under Review</strong>
              <span style="font-size: 12px; color: rgba(255,255,255,0.7);">
                You have a pending request for <strong>${escapeHtml(pendingRequests[0].plan_id.toUpperCase())}</strong> (${pendingRequests[0].expected_amount_egp} EGP). Our team is verifying your transfer.
              </span>
            </div>
          </div>
          <span style="background: rgba(234,179,8,0.2); color: #fde047; font-size: 11px; font-weight: 800; padding: 4px 10px; border-radius: 6px; white-space: nowrap;">PENDING REVIEW</span>
        </div>
      ` : ''}

      <!-- 4-CARD PRICING GRID -->
      <div class="pricing-cards-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 18px; align-items: stretch;">
        ${cardsHTML}
      </div>

    </div>
  `;

  // Bind Close Button
  modalContainer.querySelector('#btn-close-billing')?.addEventListener('click', () => {
    modalContainer.remove();
    modalContainer = null;
  });

  // Bind Group Seat Selector Dynamic Price Update
  const groupSelect = modalContainer.querySelector('#card-group-seats-select');
  if (groupSelect) {
    groupSelect.addEventListener('change', (e) => {
      currentSelectedGroupSeats = Number(e.target.value) || 2;
      const priceEl = modalContainer.querySelector('#group-card-price-val');
      if (priceEl) {
        priceEl.textContent = formatEGP(GROUP_SEAT_PRICING[currentSelectedGroupSeats] || 1800);
      }
    });
  }

  // Bind Checkout Buttons
  modalContainer.querySelectorAll('.btn-trigger-checkout').forEach(btn => {
    btn.addEventListener('click', () => {
      const planId = btn.getAttribute('data-plan');
      renderInstaPayView(planId, onSubscriptionUpdated, currentPlan, pendingRequests, targetPlan, currentSelectedGroupSeats);
    });
  });

  modalContainer.querySelectorAll('.btn-manage-group').forEach(btn => {
    btn.addEventListener('click', () => {
      modalContainer?.remove();
      modalContainer = null;
      openGroupManagementModal();
    });
  });
}

function buildPlanCard(planId, currentPlan, targetPlan = null, selectedGroupSeats = 2) {
  const plan = PLANS[planId] || PLANS.free;
  const isCurrent = currentPlan === planId;
  const isTargeted = Boolean(targetPlan && targetPlan === planId);
  const isPro = planId === 'pro';
  const isPremium = planId === 'premium';
  const isGroup = planId === 'premium_group';
  const isFree = planId === 'free';

  // Coherent Single Badge System:
  // If targetPlan is active -> only targeted card gets RECOMMENDED badge.
  // If targetPlan is null -> Pro gets MOST POPULAR badge.
  let badgeText = null;
  let badgeClass = '';

  if (isCurrent) {
    badgeText = 'CURRENT PLAN';
    badgeClass = 'badge-current';
  } else if (isTargeted) {
    badgeText = 'RECOMMENDED';
    badgeClass = 'badge-recommended';
  } else if (!targetPlan && isPro) {
    badgeText = 'MOST POPULAR';
    badgeClass = 'badge-popular';
  }

  // Visual Hierarchy Styling:
  let cardBorder = '1px solid rgba(255,255,255,0.08)';
  let cardBg = 'rgba(255,255,255,0.02)';
  let cardShadow = 'none';

  if (isTargeted || (!targetPlan && isPro)) {
    cardBorder = '2px solid rgba(124,58,237,0.85)';
    cardBg = 'linear-gradient(180deg, rgba(124,58,237,0.14) 0%, rgba(12,13,24,0.95) 100%)';
    cardShadow = '0 0 35px rgba(124,58,237,0.25)';
  } else if (isPremium) {
    cardBorder = '1px solid rgba(6,182,212,0.35)';
    cardBg = 'linear-gradient(180deg, rgba(6,182,212,0.08) 0%, rgba(12,13,24,0.95) 100%)';
  } else if (isGroup) {
    cardBorder = '1px solid rgba(16,185,129,0.3)';
    cardBg = 'linear-gradient(180deg, rgba(16,185,129,0.06) 0%, rgba(12,13,24,0.95) 100%)';
  } else if (isCurrent) {
    cardBorder = '1px solid rgba(16,185,129,0.4)';
    cardBg = 'rgba(16,185,129,0.03)';
  }

  // Positioning statements
  const positioning = {
    free: 'For getting started',
    pro: 'For professionals ready to go live',
    premium: 'For maximum customization',
    premium_group: 'For teams and small studios'
  }[planId] || 'For portfolio makers';

  // Benefits
  const benefitsMap = {
    free: [
      '1 portfolio',
      '3 starter themes',
      'Build your full portfolio',
      'Export your portfolio'
    ],
    pro: [
      'Everything in Free',
      '10 professional themes',
      'Hosted portfolio',
      'Continuous editing',
      'Professional export'
    ],
    premium: [
      'Everything in Pro',
      'All 15 themes',
      'Premium themes',
      'Remove branding',
      'Custom domain support',
      'Premium capabilities'
    ],
    premium_group: [
      'Premium access for every member',
      'Individual user accounts',
      'Individual portfolio allowances',
      'Group management',
      'Centralized subscription'
    ]
  };

  const benefits = benefitsMap[planId] || [];

  // Price Calculation & Display
  let priceNumberHTML = '0';
  let periodHTML = '<span style="font-size: 0.8rem; font-weight: 500; color: rgba(255,255,255,0.6);"> /month</span>';
  let seatSelectorHTML = '';

  if (isFree) {
    priceNumberHTML = '0';
    periodHTML = '';
  } else if (isPro) {
    priceNumberHTML = '600';
    periodHTML = '<span style="font-size: 0.8rem; font-weight: 500; color: rgba(255,255,255,0.6);"> /month</span>';
  } else if (isPremium) {
    priceNumberHTML = '1,000';
    periodHTML = '<span style="font-size: 0.8rem; font-weight: 500; color: rgba(255,255,255,0.6);"> /month</span>';
  } else if (isGroup) {
    const activePrice = GROUP_SEAT_PRICING[selectedGroupSeats] || 1800;
    priceNumberHTML = `<span id="group-card-price-val">${formatEGP(activePrice)}</span>`;
    periodHTML = '<span style="font-size: 0.8rem; font-weight: 500; color: rgba(255,255,255,0.6);"> /month</span>';

    seatSelectorHTML = `
      <div style="margin: 12px 0 6px 0;">
        <label style="font-size: 11px; font-weight: 600; color: rgba(255,255,255,0.6); display: block; margin-bottom: 4px;">Select Team Seats:</label>
        <select id="card-group-seats-select" style="width: 100%; background: #121320; border: 1px solid rgba(255,255,255,0.2); padding: 7px 10px; border-radius: 8px; color: #fff; font-size: 12px; font-weight: 600; outline: none; cursor: pointer;">
          <option value="2" ${selectedGroupSeats === 2 ? 'selected' : ''}>2 Users — 1,800 EGP/mo</option>
          <option value="3" ${selectedGroupSeats === 3 ? 'selected' : ''}>3 Users — 2,550 EGP/mo</option>
          <option value="4" ${selectedGroupSeats === 4 ? 'selected' : ''}>4 Users — 3,200 EGP/mo</option>
          <option value="5" ${selectedGroupSeats === 5 ? 'selected' : ''}>5 Users — 3,750 EGP/mo</option>
        </select>
      </div>
    `;
  }

  // CTA Design
  let ctaLabel = 'Upgrade';
  let ctaClass = 'btn-pro-cta';

  if (isPro) {
    ctaLabel = 'Upgrade to Pro';
    ctaClass = 'background: linear-gradient(135deg, #7c3aed, #06b6d4); color: #fff; box-shadow: 0 4px 14px rgba(124,58,237,0.35);';
  } else if (isPremium) {
    ctaLabel = 'Go Premium';
    ctaClass = 'background: linear-gradient(135deg, #0891b2, #7c3aed); color: #fff; box-shadow: 0 4px 14px rgba(6,182,212,0.35);';
  } else if (isGroup) {
    ctaLabel = 'Choose Group';
    ctaClass = 'background: linear-gradient(135deg, #059669, #0891b2); color: #fff; box-shadow: 0 4px 14px rgba(16,185,129,0.35);';
  }

  const ctaSectionHTML = isCurrent && isGroup
    ? `
      <div style="margin-top: auto; padding-top: 18px;">
        <button class="btn-manage-group" style="width: 100%; padding: 11px; font-size: 0.85rem; font-weight: 800; background: linear-gradient(135deg,#059669,#0891b2); border: 0; border-radius: 12px; color: #fff; cursor: pointer;">Manage Team</button>
        <div style="font-size: 11px; color: rgba(255,255,255,0.45); margin-top: 6px; font-weight: 500;">Invite or replace teammates</div>
      </div>
    `
    : isCurrent
    ? `
      <div style="margin-top: auto; padding-top: 18px;">
        <button disabled style="width: 100%; padding: 11px; font-size: 0.85rem; font-weight: 700; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); border-radius: 12px; color: rgba(255,255,255,0.6); cursor: default;">Current Plan</button>
        <div style="min-height: 18px; margin-top: 6px;"></div>
      </div>
    `
    : `
      <div style="margin-top: auto; padding-top: 18px; text-align: center;">
        <button class="btn-trigger-checkout" data-plan="${planId}" style="width: 100%; padding: 11px; font-size: 0.88rem; font-weight: 800; border: none; border-radius: 12px; cursor: pointer; transition: transform 0.15s ease, box-shadow 0.15s ease; ${ctaClass}">
          ${ctaLabel}
        </button>
        <div style="font-size: 11px; color: rgba(255,255,255,0.45); margin-top: 6px; font-weight: 500;">
          via InstaPay
        </div>
      </div>
    `;

  // Badge HTML
  let badgeEl = '';
  if (badgeText) {
    let badgeStyle = 'background: rgba(255,255,255,0.1); color: #fff; border: 1px solid rgba(255,255,255,0.2);';
    if (badgeClass === 'badge-current') {
      badgeStyle = 'background: rgba(16,185,129,0.15); color: #34d399; border: 1px solid rgba(16,185,129,0.35);';
    } else if (badgeClass === 'badge-recommended') {
      badgeStyle = 'background: rgba(56,189,248,0.2); color: #38bdf8; border: 1px solid rgba(56,189,248,0.45); box-shadow: 0 0 10px rgba(56,189,248,0.3);';
    } else if (badgeClass === 'badge-popular') {
      badgeStyle = 'background: rgba(245,158,11,0.2); color: #fbbf24; border: 1px solid rgba(245,158,11,0.4);';
    }

    badgeEl = `<span style="position: absolute; top: 16px; right: 16px; font-size: 0.65rem; font-weight: 800; letter-spacing: 0.5px; border-radius: 20px; padding: 3px 9px; ${badgeStyle}">${badgeText}</span>`;
  }

  return `
    <div class="pricing-card" style="display: flex; flex-direction: column; justify-content: space-between; background: ${cardBg}; border: ${cardBorder}; border-radius: 20px; padding: 22px; position: relative; box-shadow: ${cardShadow}; box-sizing: border-box; transition: transform 0.2s ease, border-color 0.2s ease;">
      ${badgeEl}
      
      <!-- TOP: NAME, POSITIONING & PRICE -->
      <div>
        <h3 style="font-size: 1.15rem; font-weight: 900; margin: 0 0 4px 0; color: #ffffff; letter-spacing: 0.5px;">${plan.name.toUpperCase()}</h3>
        <p style="font-size: 0.78rem; color: rgba(255,255,255,0.6); margin: 0 0 14px 0; line-height: 1.3; min-height: 2em;">${positioning}</p>
        
        <div style="display: flex; align-items: baseline; gap: 4px; margin-bottom: 8px;">
          <span style="font-size: 1.85rem; font-weight: 900; color: #ffffff; letter-spacing: -0.5px;">${priceNumberHTML}</span>
          <span style="font-size: 0.85rem; font-weight: 700; color: rgba(255,255,255,0.75);">EGP</span>
          ${periodHTML}
        </div>

        ${seatSelectorHTML}

        <!-- DIVIDER -->
        <hr style="border: none; border-top: 1px solid rgba(255,255,255,0.08); margin: 14px 0;" />

        <!-- BENEFITS LIST -->
        <ul style="list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 9px;">
          ${benefits.map(b => `
            <li style="font-size: 0.8rem; color: rgba(255,255,255,0.85); display: flex; align-items: flex-start; gap: 8px; line-height: 1.35;">
              <span style="color: #38bdf8; font-weight: 900; font-size: 0.85rem; flex-shrink: 0;">✓</span>
              <span>${escapeHtml(b)}</span>
            </li>
          `).join('')}
        </ul>
      </div>

      <!-- CTA & SUB-CTA -->
      ${ctaSectionHTML}
    </div>
  `;
}

async function renderInstaPayView(planId, onSubscriptionUpdated, previousPlan, pendingRequests, targetPlan, groupSeatsCount = 2) {
  if (!modalContainer) return;

  const plan = PLANS[planId] || PLANS.pro;
  let baseAmount = plan.priceMonthlyEGP || 600;
  let groupSeats = groupSeatsCount || 2;
  if (planId === 'premium_group') {
    baseAmount = GROUP_SEAT_PRICING[groupSeats] || 1800;
  }

  const paymentConfig = await getPublicPaymentConfig().catch(() => ({ configured: false }));
  const isConfigured = Boolean(paymentConfig?.configured);

  modalContainer.innerHTML = `
    <div class="cv-modal-card" style="background:#0a0b14;border:1px solid rgba(255,255,255,0.14);border-radius:22px;max-width:560px;width:100%;max-height:92vh;overflow-y:auto;padding:clamp(18px,4vw,32px);color:#fff;position:relative;box-shadow:0 30px 70px -15px rgba(0,0,0,0.9);box-sizing:border-box;font-family:'Inter',sans-serif;">
      
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <button id="btn-back-to-plans" style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.15);color:#fff;border-radius:8px;padding:6px 12px;font-size:12px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:6px;transition:all 0.2s;">
          ← Back to Plans
        </button>
        <button id="close-instapay-view" style="background:none;border:none;color:rgba(255,255,255,0.6);font-size:20px;cursor:pointer;padding:4px 8px;">✕</button>
      </div>

      <div style="text-align:center;margin-bottom:18px;">
        <span style="font-size:11px;font-weight:800;letter-spacing:1.5px;color:#c084fc;text-transform:uppercase;">MANUAL INSTAPAY TRANSFER</span>
        <h2 style="font-size:clamp(1.2rem, 3vw, 1.45rem);font-weight:900;margin:4px 0 0;color:#fff;">Upgrade to ${plan.name}</h2>
      </div>

      ${isConfigured ? `
        <!-- INSTAPAY DETAILS CARD -->
        <div style="background:rgba(124,58,237,0.08);border:1px solid rgba(124,58,237,0.3);border-radius:16px;padding:18px;margin-bottom:18px;font-size:13px;line-height:1.7;">
          <div style="font-size:11px;font-weight:800;color:#c084fc;letter-spacing:1px;text-transform:uppercase;margin-bottom:12px;">
            ⚡ Pay via InstaPay
          </div>

          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;gap:8px;flex-wrap:wrap;">
            <span style="color:rgba(255,255,255,0.6);">Account Name:</span>
            <strong style="color:#fff;">${escapeHtml(paymentConfig.displayName || 'SALEH MOHAMED SALEH')}</strong>
          </div>

          <!-- OPTION 1: INSTAPAY ADDRESS -->
          <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:10px 12px;margin-bottom:8px;">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;">
              <span style="color:rgba(255,255,255,0.6);font-size:12px;">InstaPay Address (IPA):</span>
              <div style="display:flex;align-items:center;gap:6px;">
                <strong style="font-family:monospace;color:#38bdf8;font-size:13px;">${escapeHtml(paymentConfig.instapayAddress || 'saleh2005mohamed@instapay')}</strong>
                <button type="button" id="btn-copy-address" style="background:rgba(56,189,248,0.15);border:1px solid rgba(56,189,248,0.3);color:#38bdf8;padding:3px 8px;border-radius:6px;font-size:11px;cursor:pointer;font-weight:700;">Copy</button>
              </div>
            </div>
          </div>

          <div style="text-align:center;font-size:11px;font-weight:800;color:rgba(255,255,255,0.4);letter-spacing:2px;margin:4px 0;">─── OR ───</div>

          <!-- OPTION 2: PHONE NUMBER -->
          <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:10px 12px;margin-bottom:12px;">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;">
              <span style="color:rgba(255,255,255,0.6);font-size:12px;">Phone Number:</span>
              <div style="display:flex;align-items:center;gap:6px;">
                <strong style="font-family:monospace;color:#38bdf8;font-size:13px;">${escapeHtml(paymentConfig.phoneNumber || '01270024222')}</strong>
                <button type="button" id="btn-copy-phone" style="background:rgba(56,189,248,0.15);border:1px solid rgba(56,189,248,0.3);color:#38bdf8;padding:3px 8px;border-radius:6px;font-size:11px;cursor:pointer;font-weight:700;">Copy</button>
              </div>
            </div>
          </div>

          <!-- EXPLICIT APPROVED INSTAPAY NOTES -->
          <div style="background:rgba(234,179,8,0.06);border:1px solid rgba(234,179,8,0.2);border-radius:10px;padding:10px 12px;margin-bottom:12px;font-size:11.5px;color:rgba(255,255,255,0.85);line-height:1.5;">
            <div style="margin-bottom:4px;">ℹ️ <strong>Both options transfer to the same InstaPay account.</strong></div>
            <div style="color:#fde047;">⚠️ <strong>Important: This is an InstaPay transfer, not a mobile wallet transfer.</strong></div>
          </div>

          <div style="display:flex;justify-content:space-between;align-items:center;border-top:1px solid rgba(255,255,255,0.1);padding-top:10px;margin-top:10px;">
            <span style="color:#fff;font-weight:700;">Exact Amount:</span>
            <div style="display:flex;align-items:center;gap:8px;">
              <strong id="final-amount-display" style="font-size:17px;color:#4ade80;">${baseAmount} EGP</strong>
              <button type="button" id="btn-copy-amount" style="background:rgba(74,222,128,0.15);border:1px solid rgba(74,222,128,0.3);color:#4ade80;padding:3px 8px;border-radius:6px;font-size:11px;cursor:pointer;font-weight:700;">Copy</button>
            </div>
          </div>
        </div>
      ` : `
        <!-- UNCONFIGURED STATE BANNER -->
        <div style="background:rgba(234,179,8,0.08);border:1px solid rgba(234,179,8,0.25);border-radius:14px;padding:18px;margin-bottom:18px;text-align:center;">
          <span style="font-size:24px;display:block;margin-bottom:6px;">⚠️</span>
          <strong style="color:#fde047;font-size:14px;display:block;margin-bottom:6px;">Payment setup is temporarily unavailable.</strong>
          <p style="color:rgba(255,255,255,0.7);font-size:12px;margin:0 0 10px;line-height:1.5;">
            Official InstaPay transfer destination has not been configured by the platform administrator yet.
          </p>
          <div style="font-size:13px;color:#fff;border-top:1px solid rgba(255,255,255,0.08);padding-top:8px;">
            Plan Price: <strong style="color:#4ade80;">${baseAmount} EGP</strong>
          </div>
        </div>
      `}

      <!-- GROUP SEATS SELECTOR (If Group Plan) -->
      ${planId === 'premium_group' ? `
        <div style="margin-bottom:16px;">
          <label style="font-size:12px;color:rgba(255,255,255,0.7);display:block;margin-bottom:6px;">Select Group Seats (2–5 members):</label>
          <select id="group-seats-select" style="width:100%;background:#141624;border:1px solid rgba(255,255,255,0.2);padding:10px;border-radius:10px;color:#fff;font-size:13px;outline:none;">
            <option value="2" ${groupSeats === 2 ? 'selected' : ''}>2 Seats — 1,800 EGP/month</option>
            <option value="3" ${groupSeats === 3 ? 'selected' : ''}>3 Seats — 2,550 EGP/month</option>
            <option value="4" ${groupSeats === 4 ? 'selected' : ''}>4 Seats — 3,200 EGP/month</option>
            <option value="5" ${groupSeats === 5 ? 'selected' : ''}>5 Seats — 3,750 EGP/month</option>
          </select>
        </div>
      ` : ''}

      <!-- PROMO CODE INPUT -->
      <div style="margin-bottom:16px;">
        <label style="font-size:12px;color:rgba(255,255,255,0.7);display:block;margin-bottom:6px;">Promo Code (Optional):</label>
        <div style="display:flex;gap:8px;">
          <input type="text" id="promo-code-input" placeholder="e.g. LAUNCH20" style="flex:1;background:#141624;border:1px solid rgba(255,255,255,0.2);padding:10px;border-radius:10px;color:#fff;font-size:13px;text-transform:uppercase;outline:none;"/>
          <button type="button" id="apply-promo-btn" style="background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);color:#fff;padding:0 16px;border-radius:10px;font-weight:700;font-size:12px;cursor:pointer;">Apply</button>
        </div>
        <div id="promo-status" style="font-size:11px;margin-top:4px;display:none;"></div>
      </div>

      <!-- PROOF UPLOAD -->
      <div style="margin-bottom:18px;">
        <label style="font-size:12px;color:rgba(255,255,255,0.7);display:block;margin-bottom:6px;">Upload Transfer Screenshot / Receipt:</label>
        <input type="file" id="proof-file-input" accept="image/png, image/jpeg, image/webp" style="display:none;"/>
        <div id="proof-upload-zone" style="border:2px dashed rgba(255,255,255,0.2);border-radius:12px;padding:16px;text-align:center;cursor:pointer;background:rgba(255,255,255,0.02);transition:all 0.2s;">
          <div id="proof-placeholder-text">
            <span style="font-size:24px;display:block;margin-bottom:4px;">📷</span>
            <span style="font-size:12px;color:rgba(255,255,255,0.7);">Click to upload screenshot (PNG, JPG, WEBP — Max 10MB)</span>
          </div>
          <div id="proof-selected-container" style="display:none;align-items:center;justify-content:space-between;gap:12px;padding:4px 8px;">
            <div style="display:flex;align-items:center;gap:10px;overflow:hidden;">
              <img id="proof-preview-img" style="width:40px;height:40px;object-fit:cover;border-radius:6px;border:1px solid rgba(255,255,255,0.2);flex-shrink:0;"/>
              <div style="text-align:left;overflow:hidden;">
                <div id="proof-filename" style="font-size:12px;font-weight:700;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:220px;">file.png</div>
                <div id="proof-filesize" style="font-size:10px;color:rgba(255,255,255,0.5);">0 KB</div>
              </div>
            </div>
            <button type="button" id="btn-remove-proof" style="background:rgba(239,68,68,0.2);border:1px solid rgba(239,68,68,0.4);color:#fca5a5;padding:4px 8px;border-radius:6px;font-size:11px;cursor:pointer;">Replace</button>
          </div>
        </div>
      </div>

      <div id="submission-error" style="display:none;font-size:12px;color:#ef4444;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.2);border-radius:8px;padding:10px;margin-bottom:14px;"></div>

      <button id="submit-payment-btn" ${!isConfigured ? 'disabled' : ''} style="width:100%;padding:13px;background:${isConfigured ? 'linear-gradient(135deg,#7c3aed,#06b6d4)' : 'rgba(255,255,255,0.1)'};border:none;border-radius:12px;color:#fff;font-size:14px;font-weight:800;cursor:${isConfigured ? 'pointer' : 'not-allowed'};opacity:${isConfigured ? '1' : '0.6'};">
        ${isConfigured ? '🚀 Submit Payment for Verification' : 'Payment setup is temporarily unavailable.'}
      </button>
    </div>
  `;

  // Back to plans handler
  modalContainer.querySelector('#btn-back-to-plans')?.addEventListener('click', () => {
    renderBillingMainView(previousPlan, pendingRequests, onSubscriptionUpdated, targetPlan);
  });

  // Close modal handler
  modalContainer.querySelector('#close-instapay-view')?.addEventListener('click', () => {
    modalContainer.remove();
    modalContainer = null;
  });

  // Copy InstaPay address
  modalContainer.querySelector('#btn-copy-address')?.addEventListener('click', (e) => {
    const addr = paymentConfig?.instapayAddress || 'saleh2005mohamed@instapay';
    if (addr && navigator.clipboard) {
      navigator.clipboard.writeText(addr);
      e.target.textContent = '✓ Copied!';
      setTimeout(() => { if (e.target) e.target.textContent = 'Copy'; }, 2000);
    }
  });

  // Copy Phone Number
  modalContainer.querySelector('#btn-copy-phone')?.addEventListener('click', (e) => {
    const phone = paymentConfig?.phoneNumber || '01270024222';
    if (phone && navigator.clipboard) {
      navigator.clipboard.writeText(phone);
      e.target.textContent = '✓ Copied!';
      setTimeout(() => { if (e.target) e.target.textContent = 'Copy'; }, 2000);
    }
  });

  // Copy Amount
  modalContainer.querySelector('#btn-copy-amount')?.addEventListener('click', (e) => {
    const amt = String(baseAmount);
    if (amt && navigator.clipboard) {
      navigator.clipboard.writeText(amt);
      e.target.textContent = '✓ Copied!';
      setTimeout(() => { if (e.target) e.target.textContent = 'Copy'; }, 2000);
    }
  });


  let selectedProofBase64 = null;
  let selectedContentType = null;
  let activePromoCode = null;

  const fileInput = modalContainer.querySelector('#proof-file-input');
  const uploadZone = modalContainer.querySelector('#proof-upload-zone');
  const previewImg = modalContainer.querySelector('#proof-preview-img');
  const placeholderText = modalContainer.querySelector('#proof-placeholder-text');
  const selectedContainer = modalContainer.querySelector('#proof-selected-container');
  const filenameEl = modalContainer.querySelector('#proof-filename');
  const filesizeEl = modalContainer.querySelector('#proof-filesize');
  const removeProofBtn = modalContainer.querySelector('#btn-remove-proof');

  uploadZone?.addEventListener('click', (e) => {
    if (e.target === removeProofBtn) return;
    fileInput?.click();
  });

  removeProofBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    fileInput?.click();
  });

  fileInput?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    selectedContentType = file.type;
    const reader = new FileReader();
    reader.onload = () => {
      selectedProofBase64 = reader.result;
      if (previewImg && placeholderText && selectedContainer) {
        previewImg.src = reader.result;
        filenameEl.textContent = file.name;
        filesizeEl.textContent = `${(file.size / 1024).toFixed(1)} KB`;
        selectedContainer.style.display = 'flex';
        placeholderText.style.display = 'none';
      }
    };
    reader.readAsDataURL(file);
  });

  const seatsSelect = modalContainer.querySelector('#group-seats-select');
  seatsSelect?.addEventListener('change', () => {
    groupSeats = Number(seatsSelect.value);
    baseAmount = GROUP_SEAT_PRICING[groupSeats] || 1800;
    updatePriceDisplay();
  });

  const applyPromoBtn = modalContainer.querySelector('#apply-promo-btn');
  const promoInput = modalContainer.querySelector('#promo-code-input');
  const promoStatus = modalContainer.querySelector('#promo-status');

  applyPromoBtn?.addEventListener('click', async () => {
    const code = promoInput?.value?.trim();
    if (!code) return;
    try {
      const res = await redeemPromoCode(code);
      if (res.valid) {
        activePromoCode = res.code;
        let discount = 0;
        if (res.discountType === 'percentage') {
          discount = Math.round((baseAmount * Number(res.discountValue)) / 100);
        } else {
          discount = Number(res.discountValue);
        }
        const finalPrice = Math.max(0, baseAmount - discount);
        if (promoStatus) {
          promoStatus.textContent = `✅ Promo applied: ${res.discountValue}${res.discountType === 'percentage' ? '%' : ' EGP'} OFF`;
          promoStatus.style.color = '#4ade80';
          promoStatus.style.display = 'block';
        }
        const finalDisplay = modalContainer.querySelector('#final-amount-display');
        if (finalDisplay) finalDisplay.textContent = `${finalPrice} EGP (was ${baseAmount} EGP)`;
      } else {
        if (promoStatus) {
          promoStatus.textContent = `❌ ${res.error || 'Invalid promo code'}`;
          promoStatus.style.color = '#f87171';
          promoStatus.style.display = 'block';
        }
      }
    } catch (_) {}
  });

  function updatePriceDisplay() {
    const finalDisplay = modalContainer.querySelector('#final-amount-display');
    if (finalDisplay) finalDisplay.textContent = `${baseAmount} EGP`;
  }

  const submitBtn = modalContainer.querySelector('#submit-payment-btn');
  const errorBox = modalContainer.querySelector('#submission-error');

  submitBtn?.addEventListener('click', async () => {
    if (!selectedProofBase64) {
      if (errorBox) {
        errorBox.textContent = 'Please upload a screenshot of your transfer confirmation.';
        errorBox.style.display = 'block';
      }
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Submitting Transfer Proof...';
    }
    if (errorBox) errorBox.style.display = 'none';

    try {
      const submitRes = await submitManualPayment({
        targetPlanId: planId,
        groupSeats: planId === 'premium_group' ? groupSeats : null,
        promoCode: activePromoCode,
        proofBase64: selectedProofBase64,
        contentType: selectedContentType
      });

      modalContainer.innerHTML = `
        <div class="cv-modal-card" style="background:#0a0b14;border:1px solid #22c55e55;border-radius:22px;max-width:480px;width:100%;padding:clamp(20px,5vw,34px);text-align:center;color:#fff;box-shadow:0 30px 70px -15px rgba(0,0,0,0.9);box-sizing:border-box;font-family:'Inter',sans-serif;">
          <span style="font-size:42px;display:block;margin-bottom:12px;">🎉</span>
          <h2 style="font-size:1.35rem;font-weight:900;margin:0 0 8px;color:#4ade80;">Payment submitted successfully — Pending verification.</h2>
          <div style="background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.25);border-radius:14px;padding:16px;margin:18px 0;text-align:left;font-size:13px;line-height:1.8;">
            <div style="display:flex;justify-content:space-between;"><span style="color:rgba(255,255,255,0.6);">Plan:</span> <strong>${plan.name}</strong></div>
            <div style="display:flex;justify-content:space-between;"><span style="color:rgba(255,255,255,0.6);">Amount:</span> <strong>${submitRes.expectedAmountEGP || baseAmount} EGP</strong></div>
            <div style="display:flex;justify-content:space-between;"><span style="color:rgba(255,255,255,0.6);">Status:</span> <span style="color:#fde047;font-weight:800;">PENDING REVIEW</span></div>
            <div style="display:flex;justify-content:space-between;"><span style="color:rgba(255,255,255,0.6);">Request ID:</span> <span style="font-family:monospace;font-size:11px;color:#a78bfa;">${submitRes.requestId || 'mpr_pending'}</span></div>
          </div>
          <p style="font-size:12px;color:rgba(255,255,255,0.7);line-height:1.5;margin-bottom:22px;">
            We'll email you once your transfer is reviewed and verified by our team.
          </p>
          <button id="close-success-view" style="width:100%;padding:13px;background:linear-gradient(135deg,#7c3aed,#06b6d4);border:none;border-radius:12px;color:#fff;font-weight:800;cursor:pointer;font-size:14px;">
            Done
          </button>
        </div>
      `;

      modalContainer.querySelector('#close-success-view')?.addEventListener('click', () => {
        modalContainer.remove();
        modalContainer = null;
        if (onSubscriptionUpdated) onSubscriptionUpdated();
      });
    } catch (err) {
      if (errorBox) {
        errorBox.textContent = `❌ ${err.message || 'Submission failed'}`;
        errorBox.style.display = 'block';
      }
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = '🚀 Submit Payment for Verification';
      }
    }
  });
}
