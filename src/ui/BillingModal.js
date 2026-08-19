/**
 * BillingModal.js
 * Manual InstaPay Billing & Plan Upgrade Modal for Portfolio Maker (Phase 8C).
 * Seamless single-modal lifecycle, zero stacked overlays, mobile-responsive layout,
 * copy actions, proof file preview, promo validation, and pending confirmation.
 */

import { globalEntitlements } from '../services/EntitlementService.js';
import { PLANS, GROUP_SEAT_PRICING, formatPrice, formatEGP } from '../config/PlanConfig.js';
import { submitManualPayment, getUserPaymentStatus, redeemPromoCode, getPublicPaymentConfig } from '../services/AuthService.js';

let modalContainer = null;

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
  modalContainer.style.cssText = 'position: fixed; inset: 0; background: rgba(0, 0, 0, 0.85); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; z-index: 100000; padding: 16px; box-sizing: border-box;';

  const currentPlan = globalEntitlements.getPlanId();
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
    .map(id => buildPlanCard(id, currentPlan, targetPlan))
    .join('');

  modalContainer.innerHTML = `
    <div class="cv-modal-card" style="position: relative; max-width: 920px; width: 100%; text-align: left; padding: clamp(16px, 4vw, 28px); max-height: 90vh; overflow-y: auto; background: #0c0d18; border: 1px solid rgba(255,255,255,0.15); border-radius: 20px; color: #fff; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.8); box-sizing: border-box;">
      <button id="btn-close-billing" style="
        position: absolute; top: 16px; right: 16px; background: rgba(255,255,255,0.06);
        border: 1px solid rgba(255,255,255,0.12); color: #fff; border-radius: 50%; width: 32px; height: 32px;
        font-weight: bold; cursor: pointer; display: flex; align-items: center; justify-content: center; z-index: 10;
      ">✕</button>

      <div style="margin-bottom: 20px; text-align: center; padding: 0 24px;">
        <span style="font-size: 0.75rem; font-weight: 800; color: #8b5cf6; letter-spacing: 1.5px; text-transform: uppercase;">💎 PLANS &amp; PRICING</span>
        <h2 style="font-size: clamp(1.2rem, 3vw, 1.6rem); font-weight: 900; margin: 6px 0 8px 0; color: #fff;">Upgrade Your 3D Portfolio Experience</h2>
        <p style="font-size: 0.85rem; color: rgba(255,255,255,0.6); max-width: 540px; margin: 0 auto; line-height: 1.4;">
          Choose your plan. Payments are processed securely via manual InstaPay transfer and verified by our team.
        </p>
      </div>

      <!-- PENDING PAYMENT BANNER -->
      ${pendingRequests.length ? `
        <div style="background: rgba(234,179,8,0.1); border: 1px solid rgba(234,179,8,0.3); border-radius: 14px; padding: 14px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap;">
          <div>
            <strong style="color: #fde047; font-size: 13px; display: block;">⏳ Payment Verification Pending</strong>
            <span style="font-size: 12px; color: rgba(255,255,255,0.7);">
              You have a pending request for <strong>${escapeHtml(pendingRequests[0].plan_id.toUpperCase())}</strong> (${pendingRequests[0].expected_amount_egp} EGP). Our team is reviewing your transfer.
            </span>
          </div>
          <span style="background: rgba(234,179,8,0.2); color: #fde047; font-size: 11px; font-weight: 800; padding: 4px 10px; border-radius: 6px; white-space: nowrap;">PENDING REVIEW</span>
        </div>
      ` : ''}

      <!-- PRICING CARDS -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 14px; margin-bottom: 12px;">
        ${cardsHTML}
      </div>
    </div>
  `;

  modalContainer.querySelector('#btn-close-billing')?.addEventListener('click', () => {
    modalContainer.remove();
    modalContainer = null;
  });

  modalContainer.querySelectorAll('.btn-trigger-checkout').forEach(btn => {
    btn.addEventListener('click', () => {
      const planId = btn.getAttribute('data-plan');
      renderInstaPayView(planId, onSubscriptionUpdated, currentPlan, pendingRequests, targetPlan);
    });
  });
}

function buildPlanCard(planId, currentPlan, targetPlan = null) {
  const plan = PLANS[planId] || PLANS.free;
  const isCurrent = currentPlan === planId;
  const isTargeted = Boolean(targetPlan && targetPlan === planId);
  const isHighlighted = isTargeted || (!targetPlan && planId === 'pro');

  const bg = isHighlighted
    ? 'linear-gradient(135deg, rgba(124,58,237,0.18), rgba(6,182,212,0.12))'
    : 'rgba(255,255,255,0.02)';
  const border = isHighlighted
    ? '2px solid rgba(124,58,237,0.85)'
    : isCurrent
      ? '1px solid rgba(16,185,129,0.5)'
      : '1px solid rgba(255,255,255,0.08)';
  const shadow = isHighlighted ? 'box-shadow: 0 0 35px rgba(124,58,237,0.3);' : '';
  const nameColor = isHighlighted ? 'color: #c084fc;' : '';

  let pricePrefix = '';
  let priceAmount = 0;
  let periodDisplay = '/month';

  if (planId === 'free') {
    priceAmount = 0;
    periodDisplay = '';
  } else if (planId === 'pro') {
    priceAmount = 600;
  } else if (planId === 'premium') {
    priceAmount = 1000;
  } else if (planId === 'premium_group') {
    pricePrefix = 'From ';
    priceAmount = 1500;
  }

  const priceDisplay = pricePrefix + formatEGP(priceAmount);

  let badgeHTML = '';
  if (isCurrent) {
    badgeHTML = '<span style="position: absolute; top: 12px; right: 12px; font-size: 0.6rem; color: #10b981; font-weight: 800; background: rgba(16,185,129,0.15); border: 1px solid rgba(16,185,129,0.3); border-radius: 12px; padding: 2px 8px;">CURRENT</span>';
  } else if (isTargeted) {
    badgeHTML = '<span style="position: absolute; top: 12px; right: 12px; font-size: 0.6rem; color: #38bdf8; font-weight: 800; background: rgba(56,189,248,0.2); border: 1px solid rgba(56,189,248,0.4); border-radius: 12px; padding: 2px 8px;">RECOMMENDED</span>';
  } else if (plan.badge) {
    badgeHTML = '<span style="position: absolute; top: 12px; right: 12px; font-size: 0.6rem; color: #f59e0b; font-weight: 800; background: rgba(245,158,11,0.15); border: 1px solid rgba(245,158,11,0.3); border-radius: 12px; padding: 2px 8px;">' + plan.badge + '</span>';
  }

  const ctaHTML = isCurrent
    ? '<button disabled style="width: 100%; opacity: 0.6; padding: 8px; font-size: 0.8rem; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); border-radius: 8px; color: #fff;">Active Plan</button>'
    : '<button class="btn-trigger-checkout" data-plan="' + planId + '" style="width: 100%; font-weight: 900; padding: 10px; font-size: 0.82rem; background: linear-gradient(135deg, #7c3aed, #06b6d4); border: none; border-radius: 8px; color: #fff; cursor: pointer;">Pay with InstaPay</button>';

  return '<div style="background: ' + bg + '; border: ' + border + '; border-radius: 18px; padding: 16px; position: relative; ' + shadow + '">'
    + badgeHTML
    + '<h3 style="font-size: 1.1rem; font-weight: 800; margin: 0 0 6px 0; ' + nameColor + '">' + plan.name.toUpperCase() + '</h3>'
    + '<div style="font-size: 1.4rem; font-weight: 900; color: #fff; margin-bottom: 10px;">'
    + priceDisplay
    + ' <span style="font-size: 0.75rem; font-weight: 400; color: rgba(255,255,255,0.5);"> EGP' + periodDisplay + '</span>'
    + '</div>'
    + '<p style="font-size: 0.75rem; color: rgba(255,255,255,0.6); min-height: 2.5em; margin-bottom: 12px; line-height: 1.3;">' + plan.description + '</p>'
    + ctaHTML
    + '</div>';
}

async function renderInstaPayView(planId, onSubscriptionUpdated, previousPlan, pendingRequests, targetPlan) {
  if (!modalContainer) return;

  const plan = PLANS[planId] || PLANS.pro;
  let baseAmount = plan.priceMonthlyEGP || 600;
  let groupSeats = 2;
  if (planId === 'premium_group') {
    baseAmount = GROUP_SEAT_PRICING[2] || 1500;
  }

  const paymentConfig = await getPublicPaymentConfig().catch(() => ({ configured: false }));
  const isConfigured = Boolean(paymentConfig?.configured);

  modalContainer.innerHTML = `
    <div class="cv-modal-card" style="background:#0e101c;border:1px solid rgba(255,255,255,0.15);border-radius:20px;max-width:540px;width:100%;max-height:92vh;overflow-y:auto;padding:clamp(16px,4vw,28px);color:#fff;position:relative;box-shadow:0 25px 50px -12px rgba(0,0,0,0.8);box-sizing:border-box;">
      
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <button id="btn-back-to-plans" style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.15);color:#fff;border-radius:8px;padding:6px 12px;font-size:12px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:6px;">
          ← Back to Plans
        </button>
        <button id="close-instapay-view" style="background:none;border:none;color:rgba(255,255,255,0.6);font-size:20px;cursor:pointer;padding:4px 8px;">✕</button>
      </div>

      <div style="text-align:center;margin-bottom:18px;">
        <span style="font-size:11px;font-weight:800;letter-spacing:1.5px;color:#c084fc;text-transform:uppercase;">MANUAL INSTAPAY TRANSFER</span>
        <h2 style="font-size:clamp(1.2rem, 3vw, 1.4rem);font-weight:900;margin:4px 0 0;">Upgrade to ${plan.name}</h2>
      </div>

      ${isConfigured ? `
        <!-- INSTAPAY DETAILS CARD -->
        <div style="background:rgba(124,58,237,0.08);border:1px solid rgba(124,58,237,0.3);border-radius:14px;padding:16px;margin-bottom:18px;font-size:13px;line-height:1.7;">
          ${paymentConfig.displayName ? `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;gap:8px;flex-wrap:wrap;">
              <span style="color:rgba(255,255,255,0.6);">Account Name:</span>
              <strong>${escapeHtml(paymentConfig.displayName)}</strong>
            </div>
          ` : ''}
          ${paymentConfig.instapayAddress ? `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;gap:8px;flex-wrap:wrap;">
              <span style="color:rgba(255,255,255,0.6);">InstaPay Address / IPA:</span>
              <div style="display:flex;align-items:center;gap:6px;">
                <strong style="font-family:monospace;color:#38bdf8;">${escapeHtml(paymentConfig.instapayAddress)}</strong>
                <button type="button" id="btn-copy-address" style="background:rgba(56,189,248,0.15);border:1px solid rgba(56,189,248,0.3);color:#38bdf8;padding:2px 8px;border-radius:6px;font-size:11px;cursor:pointer;font-weight:700;">Copy</button>
              </div>
            </div>
          ` : ''}
          ${paymentConfig.phoneNumber ? `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;gap:8px;flex-wrap:wrap;">
              <span style="color:rgba(255,255,255,0.6);">Phone Number:</span>
              <strong>${escapeHtml(paymentConfig.phoneNumber)}</strong>
            </div>
          ` : ''}
          ${paymentConfig.bankName ? `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;gap:8px;flex-wrap:wrap;">
              <span style="color:rgba(255,255,255,0.6);">Bank:</span>
              <span>${escapeHtml(paymentConfig.bankName)}</span>
            </div>
          ` : ''}
          ${paymentConfig.paymentNote ? `
            <div style="margin-top:6px;padding-top:6px;border-top:1px dashed rgba(255,255,255,0.1);font-size:11px;color:rgba(255,255,255,0.7);">
              ℹ️ ${escapeHtml(paymentConfig.paymentNote)}
            </div>
          ` : ''}
          <div style="display:flex;justify-content:space-between;align-items:center;border-top:1px solid rgba(255,255,255,0.1);padding-top:8px;margin-top:8px;">
            <span style="color:#fff;font-weight:700;">Exact Amount:</span>
            <div style="display:flex;align-items:center;gap:8px;">
              <strong id="final-amount-display" style="font-size:16px;color:#4ade80;">${baseAmount} EGP</strong>
              <button type="button" id="btn-copy-amount" style="background:rgba(74,222,128,0.15);border:1px solid rgba(74,222,128,0.3);color:#4ade80;padding:2px 8px;border-radius:6px;font-size:11px;cursor:pointer;font-weight:700;">Copy</button>
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
            <option value="2">2 Seats — 1,500 EGP/month</option>
            <option value="3">3 Seats — 1,800 EGP/month</option>
            <option value="4">4 Seats — 2,200 EGP/month</option>
            <option value="5">5 Seats — 2,800 EGP/month</option>
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
    const addr = paymentConfig?.instapayAddress || '';
    if (addr && navigator.clipboard) {
      navigator.clipboard.writeText(addr);
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
    baseAmount = GROUP_SEAT_PRICING[groupSeats] || 1500;
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
        <div class="cv-modal-card" style="background:#0e101c;border:1px solid #22c55e55;border-radius:20px;max-width:480px;width:100%;padding:clamp(20px,5vw,32px);text-align:center;color:#fff;box-shadow:0 25px 50px -12px rgba(0,0,0,0.8);box-sizing:border-box;">
          <span style="font-size:40px;display:block;margin-bottom:12px;">🎉</span>
          <h2 style="font-size:1.4rem;font-weight:900;margin:0 0 8px;color:#4ade80;">Payment Submitted Successfully!</h2>
          <div style="background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.25);border-radius:12px;padding:14px;margin:16px 0;text-align:left;font-size:13px;line-height:1.8;">
            <div style="display:flex;justify-content:space-between;"><span style="color:rgba(255,255,255,0.6);">Plan:</span> <strong>${plan.name}</strong></div>
            <div style="display:flex;justify-content:space-between;"><span style="color:rgba(255,255,255,0.6);">Amount:</span> <strong>${submitRes.expectedAmountEGP || baseAmount} EGP</strong></div>
            <div style="display:flex;justify-content:space-between;"><span style="color:rgba(255,255,255,0.6);">Status:</span> <span style="color:#fde047;font-weight:800;">PENDING REVIEW</span></div>
            <div style="display:flex;justify-content:space-between;"><span style="color:rgba(255,255,255,0.6);">Request ID:</span> <span style="font-family:monospace;font-size:11px;color:#a78bfa;">${submitRes.requestId || 'mpr_pending'}</span></div>
          </div>
          <p style="font-size:12px;color:rgba(255,255,255,0.7);line-height:1.5;margin-bottom:20px;">
            We'll email you once your transfer is reviewed and verified by our team.
          </p>
          <button id="close-success-view" style="width:100%;padding:12px;background:#7c3aed;border:none;border-radius:10px;color:#fff;font-weight:700;cursor:pointer;font-size:14px;">
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
