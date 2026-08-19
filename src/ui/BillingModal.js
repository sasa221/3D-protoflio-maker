/**
 * BillingModal.js
 * Manual InstaPay Billing & Plan Upgrade Modal for Portfolio Maker (Phase 8B).
 * Server-authoritative pricing, manual transfer proof upload, promo discount validation,
 * and pending review status tracking.
 */

import { globalEntitlements } from '../services/EntitlementService.js';
import { PLANS, GROUP_SEAT_PRICING, formatPrice } from '../config/PlanConfig.js';
import { submitManualPayment, getUserPaymentStatus, redeemPromoCode, getPublicPaymentConfig } from '../services/AuthService.js';

let modalContainer = null;

export async function openBillingModal(currentUserId, onSubscriptionUpdated) {
  if (!currentUserId) {
    window.location.href = '/login?next=/studio';
    return;
  }
  if (modalContainer) modalContainer.remove();

  modalContainer = document.createElement('div');
  modalContainer.className = 'cv-import-modal-overlay';
  modalContainer.style.zIndex = '10000';

  const currentPlan = globalEntitlements.getPlanId();
  let pendingRequests = [];
  try {
    const statusData = await getUserPaymentStatus();
    pendingRequests = (statusData.requests || []).filter(r => r.status === 'PENDING');
  } catch (_) {}

  renderBillingMainView(currentPlan, pendingRequests, onSubscriptionUpdated);
  document.body.appendChild(modalContainer);
}

function renderBillingMainView(currentPlan, pendingRequests, onSubscriptionUpdated) {
  const cardsHTML = ['free', 'pro', 'premium', 'premium_group']
    .map(id => buildPlanCard(id, currentPlan))
    .join('');

  modalContainer.innerHTML = `
    <div class="cv-modal-card" style="max-width: 920px; text-align: left; padding: 28px; max-height: 90vh; overflow-y: auto; background: #0c0d18; border: 1px solid rgba(255,255,255,0.12); border-radius: 20px; color: #fff;">
      <button id="btn-close-billing" style="
        position: absolute; top: 20px; right: 20px; background: rgba(255,255,255,0.06);
        border: 1px solid rgba(255,255,255,0.12); color: #fff; border-radius: 50%; width: 32px; height: 32px;
        font-weight: bold; cursor: pointer; display: flex; align-items: center; justify-content: center;
      ">✕</button>

      <div style="margin-bottom: 24px; text-align: center;">
        <span style="font-size: 0.75rem; font-weight: 800; color: #8b5cf6; letter-spacing: 1.5px; text-transform: uppercase;">💎 PLANS &amp; PRICING</span>
        <h2 style="font-size: 1.6rem; font-weight: 900; margin: 6px 0 8px 0; color: #fff;">Upgrade Your 3D Portfolio Experience</h2>
        <p style="font-size: 0.85rem; color: rgba(255,255,255,0.6); max-width: 540px; margin: 0 auto;">
          Choose your plan. Payments are processed securely via manual InstaPay transfer and verified by our team.
        </p>
      </div>

      <!-- PENDING PAYMENT BANNER -->
      ${pendingRequests.length ? `
        <div style="background: rgba(234,179,8,0.1); border: 1px solid rgba(234,179,8,0.3); border-radius: 14px; padding: 16px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <strong style="color: #fde047; font-size: 14px; display: block;">⏳ Payment Verification Pending</strong>
            <span style="font-size: 12px; color: rgba(255,255,255,0.7);">
              You have a pending request for <strong>${pendingRequests[0].plan_id.toUpperCase()}</strong> (${pendingRequests[0].expected_amount_egp} EGP). Our team is reviewing your transfer.
            </span>
          </div>
          <span style="background: rgba(234,179,8,0.2); color: #fde047; font-size: 11px; font-weight: 800; padding: 4px 10px; border-radius: 6px;">PENDING REVIEW</span>
        </div>
      ` : ''}

      <!-- PRICING CARDS -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px;">
        ${cardsHTML}
      </div>
    </div>
  `;

  modalContainer.querySelector('#btn-close-billing')?.addEventListener('click', () => modalContainer.remove());

  modalContainer.querySelectorAll('.btn-trigger-checkout').forEach(btn => {
    btn.addEventListener('click', () => {
      const planId = btn.getAttribute('data-plan');
      openInstaPayModal(planId, onSubscriptionUpdated);
    });
  });
}

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

  const priceDisplay = plan.priceMonthlyEGP === 0 ? '0' : plan.priceMonthlyEGP.toLocaleString('en-EG');
  const periodDisplay = plan.priceMonthlyEGP > 0 ? '/month' : '';

  let badgeHTML = '';
  if (isCurrent) {
    badgeHTML = '<span style="position: absolute; top: 12px; right: 12px; font-size: 0.6rem; color: #10b981; font-weight: 800; background: rgba(16,185,129,0.15); border: 1px solid rgba(16,185,129,0.3); border-radius: 12px; padding: 2px 8px;">CURRENT</span>';
  } else if (plan.badge) {
    badgeHTML = '<span style="position: absolute; top: 12px; right: 12px; font-size: 0.6rem; color: #f59e0b; font-weight: 800; background: rgba(245,158,11,0.15); border: 1px solid rgba(245,158,11,0.3); border-radius: 12px; padding: 2px 8px;">' + plan.badge + '</span>';
  }

  const ctaHTML = isCurrent
    ? '<button disabled style="width: 100%; opacity: 0.6; padding: 8px; font-size: 0.8rem; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); border-radius: 8px; color: #fff;">Active Plan</button>'
    : '<button class="btn-trigger-checkout" data-plan="' + planId + '" style="width: 100%; font-weight: 900; padding: 10px; font-size: 0.82rem; background: linear-gradient(135deg, #7c3aed, #06b6d4); border: none; border-radius: 8px; color: #fff; cursor: pointer;">Pay with InstaPay</button>';

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

async function openInstaPayModal(planId, onSubscriptionUpdated) {
  const plan = PLANS[planId] || PLANS.pro;
  let baseAmount = plan.priceMonthlyEGP || 600;
  let groupSeats = 2;
  if (planId === 'premium_group') {
    baseAmount = GROUP_SEAT_PRICING[2];
  }

  const paymentConfig = await getPublicPaymentConfig();
  const isConfigured = Boolean(paymentConfig?.configured);

  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:10002;backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;padding:16px;';

  wrapper.innerHTML = `
    <div style="background:#0e101c;border:1px solid rgba(255,255,255,0.15);border-radius:20px;max-width:540px;width:100%;max-height:92vh;overflow-y:auto;padding:28px;color:#fff;position:relative;">
      <button id="close-instapay-view" style="position:absolute;top:16px;right:16px;background:none;border:none;color:#fff;font-size:20px;cursor:pointer;">✕</button>

      <div style="text-align:center;margin-bottom:20px;">
        <span style="font-size:11px;font-weight:800;letter-spacing:1.5px;color:#c084fc;text-transform:uppercase;">MANUAL INSTAPAY TRANSFER</span>
        <h2 style="font-size:1.4rem;font-weight:900;margin:4px 0 0;">Upgrade to ${plan.name}</h2>
      </div>

      ${isConfigured ? `
        <!-- INSTAPAY DETAILS CARD -->
        <div style="background:rgba(124,58,237,0.08);border:1px solid rgba(124,58,237,0.3);border-radius:14px;padding:18px;margin-bottom:20px;font-size:13px;line-height:1.7;">
          <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
            <span style="color:rgba(255,255,255,0.6);">Account Name:</span>
            <strong>${escapeHtml(paymentConfig.displayName || 'N/A')}</strong>
          </div>
          <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
            <span style="color:rgba(255,255,255,0.6);">InstaPay ID / Address:</span>
            <strong style="font-family:monospace;color:#38bdf8;">${escapeHtml(paymentConfig.instapayAddress || 'N/A')}</strong>
          </div>
          ${paymentConfig.phoneNumber ? `
            <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
              <span style="color:rgba(255,255,255,0.6);">Phone Number:</span>
              <strong>${escapeHtml(paymentConfig.phoneNumber)}</strong>
            </div>
          ` : ''}
          ${paymentConfig.bankName ? `
            <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
              <span style="color:rgba(255,255,255,0.6);">Bank:</span>
              <span>${escapeHtml(paymentConfig.bankName)}</span>
            </div>
          ` : ''}
          <div style="display:flex;justify-content:space-between;border-top:1px solid rgba(255,255,255,0.1);padding-top:8px;margin-top:8px;">
            <span style="color:#fff;font-weight:700;">Exact Amount:</span>
            <strong id="final-amount-display" style="font-size:16px;color:#4ade80;">${baseAmount} EGP</strong>
          </div>
        </div>
      ` : `
        <!-- UNCONFIGURED STATE BANNER -->
        <div style="background:rgba(234,179,8,0.08);border:1px solid rgba(234,179,8,0.25);border-radius:14px;padding:20px;margin-bottom:20px;text-align:center;">
          <span style="font-size:24px;display:block;margin-bottom:6px;">⚠️</span>
          <strong style="color:#fde047;font-size:14px;display:block;margin-bottom:6px;">Payment setup is temporarily unavailable.</strong>
          <p style="color:rgba(255,255,255,0.7);font-size:12px;margin:0 0 10px;line-height:1.5;">
            Official InstaPay transfer destination has not been configured by the platform administrator yet.
          </p>
          <div style="font-size:13px;color:#fff;border-top:1px solid rgba(255,255,255,0.08);padding-top:10px;">
            Plan Price: <strong style="color:#4ade80;">${baseAmount} EGP</strong>
          </div>
        </div>
      `}

      <!-- GROUP SEATS SELECTOR (If Group Plan) -->
      ${planId === 'premium_group' ? `
        <div style="margin-bottom:18px;">
          <label style="font-size:12px;color:rgba(255,255,255,0.7);display:block;margin-bottom:6px;">Select Group Seats (2–5 members):</label>
          <select id="group-seats-select" style="width:100%;background:#141624;border:1px solid rgba(255,255,255,0.2);padding:10px;border-radius:10px;color:#fff;font-size:13px;">
            <option value="2">2 Seats — 1,500 EGP/month</option>
            <option value="3">3 Seats — 1,800 EGP/month</option>
            <option value="4">4 Seats — 2,200 EGP/month</option>
            <option value="5">5 Seats — 2,800 EGP/month</option>
          </select>
        </div>
      ` : ''}

      <!-- PROMO CODE INPUT -->
      <div style="margin-bottom:18px;">
        <label style="font-size:12px;color:rgba(255,255,255,0.7);display:block;margin-bottom:6px;">Promo Code (Optional):</label>
        <div style="display:flex;gap:8px;">
          <input type="text" id="promo-code-input" placeholder="e.g. LAUNCH20" style="flex:1;background:#141624;border:1px solid rgba(255,255,255,0.2);padding:10px;border-radius:10px;color:#fff;font-size:13px;text-transform:uppercase;"/>
          <button type="button" id="apply-promo-btn" style="background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);color:#fff;padding:0 16px;border-radius:10px;font-weight:700;font-size:12px;cursor:pointer;">Apply</button>
        </div>
        <div id="promo-status" style="font-size:11px;margin-top:4px;display:none;"></div>
      </div>

      <!-- PROOF UPLOAD -->
      <div style="margin-bottom:20px;">
        <label style="font-size:12px;color:rgba(255,255,255,0.7);display:block;margin-bottom:6px;">Upload Transfer Screenshot / Receipt:</label>
        <input type="file" id="proof-file-input" accept="image/png, image/jpeg, image/webp" style="display:none;"/>
        <div id="proof-upload-zone" style="border:2px dashed rgba(255,255,255,0.2);border-radius:12px;padding:20px;text-align:center;cursor:pointer;background:rgba(255,255,255,0.02);transition:all 0.2s;">
          <div id="proof-placeholder-text">
            <span style="font-size:24px;display:block;margin-bottom:4px;">📷</span>
            <span style="font-size:12px;color:rgba(255,255,255,0.7);">Click or drag screenshot here (PNG, JPG, WEBP)</span>
          </div>
          <img id="proof-preview-img" style="display:none;max-height:180px;border-radius:8px;margin:0 auto;box-shadow:0 4px 12px rgba(0,0,0,0.5);"/>
        </div>
      </div>

      <div id="submission-error" style="display:none;font-size:12px;color:#ef4444;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.2);border-radius:8px;padding:10px;margin-bottom:16px;"></div>

      <button id="submit-payment-btn" ${!isConfigured ? 'disabled' : ''} style="width:100%;padding:14px;background:${isConfigured ? 'linear-gradient(135deg,#7c3aed,#06b6d4)' : 'rgba(255,255,255,0.1)'};border:none;border-radius:12px;color:#fff;font-size:14px;font-weight:800;cursor:${isConfigured ? 'pointer' : 'not-allowed'};opacity:${isConfigured ? '1' : '0.6'};">
        ${isConfigured ? '🚀 Submit Payment for Verification' : 'Payment setup is temporarily unavailable.'}
      </button>
    </div>
  `;

  document.body.appendChild(wrapper);

  wrapper.querySelector('#close-instapay-view')?.addEventListener('click', () => wrapper.remove());

  let selectedProofBase64 = null;
  let selectedContentType = null;
  let activePromoCode = null;

  const fileInput = wrapper.querySelector('#proof-file-input');
  const uploadZone = wrapper.querySelector('#proof-upload-zone');
  const previewImg = wrapper.querySelector('#proof-preview-img');
  const placeholderText = wrapper.querySelector('#proof-placeholder-text');

  uploadZone?.addEventListener('click', () => fileInput?.click());
  fileInput?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    selectedContentType = file.type;
    const reader = new FileReader();
    reader.onload = () => {
      selectedProofBase64 = reader.result;
      if (previewImg && placeholderText) {
        previewImg.src = reader.result;
        previewImg.style.display = 'block';
        placeholderText.style.display = 'none';
      }
    };
    reader.readAsDataURL(file);
  });

  const seatsSelect = wrapper.querySelector('#group-seats-select');
  seatsSelect?.addEventListener('change', () => {
    groupSeats = Number(seatsSelect.value);
    baseAmount = GROUP_SEAT_PRICING[groupSeats] || 1500;
    updatePriceDisplay();
  });

  const applyPromoBtn = wrapper.querySelector('#apply-promo-btn');
  const promoInput = wrapper.querySelector('#promo-code-input');
  const promoStatus = wrapper.querySelector('#promo-status');

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
        const finalDisplay = wrapper.querySelector('#final-amount-display');
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
    const finalDisplay = wrapper.querySelector('#final-amount-display');
    if (finalDisplay) finalDisplay.textContent = `${baseAmount} EGP`;
  }

  const submitBtn = wrapper.querySelector('#submit-payment-btn');
  const errorBox = wrapper.querySelector('#submission-error');

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
      await submitManualPayment({
        targetPlanId: planId,
        groupSeats: planId === 'premium_group' ? groupSeats : null,
        promoCode: activePromoCode,
        proofBase64: selectedProofBase64,
        contentType: selectedContentType
      });

      wrapper.innerHTML = `
        <div style="background:#0e101c;border:1px solid #22c55e55;border-radius:20px;max-width:480px;width:100%;padding:32px;text-align:center;color:#fff;">
          <span style="font-size:36px;display:block;margin-bottom:12px;">🎉</span>
          <h2 style="font-size:1.4rem;font-weight:900;margin:0 0 8px;">Payment Proof Submitted!</h2>
          <p style="font-size:13px;color:rgba(255,255,255,0.7);line-height:1.6;margin-bottom:24px;">
            Your transfer receipt for <strong>${plan.name}</strong> has been received and is waiting for administrator review. We'll activate your plan as soon as it's verified.
          </p>
          <button id="close-success-view" style="width:100%;padding:12px;background:#7c3aed;border:none;border-radius:10px;color:#fff;font-weight:700;cursor:pointer;">
            Got it
          </button>
        </div>
      `;

      wrapper.querySelector('#close-success-view')?.addEventListener('click', () => {
        wrapper.remove();
        if (modalContainer) modalContainer.remove();
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
