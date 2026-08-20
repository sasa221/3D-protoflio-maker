/**
 * PricingPage.js
 * Full pricing page with FREE, PRO, PREMIUM, PREMIUM GROUP plans.
 * All prices from PlanConfig.js.
 */

import { PLANS, GROUP_SEAT_PRICING, GROUP_SEAT_MIN, GROUP_SEAT_MAX, KEEP_IT_LIVE, formatPrice } from '../config/PlanConfig.js';
import { isFeatureEnabled } from '../config/FeatureFlags.js';

/**
 * Render the full pricing page into a container element.
 * @param {HTMLElement} container
 * @param {Object} options - { currentPlan, onSelectPlan }
 */
export function renderPricingPage(container, options = {}) {
  const { currentPlan = 'free', onSelectPlan } = options;

  container.innerHTML = `
    <div class="pricing-page">
      <div class="pricing-header">
        <h1>Choose Your Plan</h1>
        <p class="pricing-subtitle">Build a portfolio that gets you noticed. Start free, upgrade when you're ready.</p>
      </div>

      <div class="pricing-cards">
        ${renderPlanCard(PLANS.free, currentPlan, 'free')}
        ${renderPlanCard(PLANS.pro, currentPlan, 'pro')}
        ${renderPlanCard(PLANS.premium, currentPlan, 'premium')}
        ${renderGroupCard(currentPlan)}
      </div>

      <div class="pricing-keep-live">
        <div class="keep-live-card">
          <div class="keep-live-header">
            <h3>Done editing?</h3>
            <p>Keep your portfolio online without a monthly subscription.</p>
          </div>
          <div class="keep-live-price">
            <span class="keep-live-amount">${formatPrice(KEEP_IT_LIVE.priceAnnualPerPortfolioEGP, '/year')}</span>
            <span class="keep-live-per">per portfolio</span>
          </div>
          <p class="keep-live-desc">Your portfolio stays live, while editing and premium tools remain locked.</p>
          <div class="keep-live-actions">
            <button class="btn-keep-live" data-action="keep-it-live" disabled>Keep It Live</button>
            <span class="keep-live-note">Available when your subscription ends</span>
          </div>
        </div>
      </div>

      <div class="pricing-faq">
        <h2>Common Questions</h2>
        <div class="faq-grid">
          <div class="faq-item">
            <h4>Can I change plans later?</h4>
            <p>Yes. You can upgrade or downgrade at any time. Your portfolio data is always preserved.</p>
          </div>
          <div class="faq-item">
            <h4>What happens to my portfolio if I cancel?</h4>
            <p>Your data is never deleted. You can download your portfolio anytime, or use Keep It Live to keep it hosted.</p>
          </div>
          <div class="faq-item">
            <h4>Is the Free portfolio really interactive?</h4>
            <p>Yes. The Free HTML download includes full 3D rendering and interactivity. It's a real portfolio, not a preview.</p>
          </div>
          <div class="faq-item">
            <h4>How does Premium Group work?</h4>
            <p>Each member gets their own account, portfolio, and Premium features. The group owner manages billing centrally.</p>
          </div>
        </div>
      </div>
    </div>
  `;

  // Attach event listeners
  container.querySelectorAll('[data-plan-select]').forEach(btn => {
    btn.addEventListener('click', () => {
      const planId = btn.getAttribute('data-plan-select');
      if (onSelectPlan) {
        onSelectPlan(planId);
      } else {
        showCheckoutPlaceholder(planId);
      }
    });
  });

  // Group seat selector
  const seatSelector = container.querySelector('.group-seat-selector');
  if (seatSelector) {
    seatSelector.addEventListener('change', (e) => {
      const seats = Number(e.target.value);
      const priceEl = container.querySelector('.group-dynamic-price');
      if (priceEl && GROUP_SEAT_PRICING[seats]) {
        priceEl.textContent = formatPrice(GROUP_SEAT_PRICING[seats], '/month');
      }
    });
  }
}

function renderPlanCard(plan, currentPlan, planId) {
  const isCurrent = currentPlan === planId;
  const isPopular = plan.badge === 'MOST POPULAR';

  const features = getPlanFeatures(planId);

  return `
    <div class="pricing-card ${isPopular ? 'pricing-card--popular' : ''} ${isCurrent ? 'pricing-card--current' : ''}">
      ${isPopular ? '<div class="pricing-badge">MOST POPULAR</div>' : ''}
      ${isCurrent ? '<div class="pricing-badge pricing-badge--current">CURRENT PLAN</div>' : ''}
      <div class="pricing-card-header">
        <h2>${plan.name}</h2>
        <p class="pricing-card-desc">${plan.description}</p>
      </div>
      <div class="pricing-card-price">
        <span class="price-amount">${formatEGP(plan.priceMonthlyEGP)}</span>
        <span class="price-currency">EGP</span>
        ${plan.priceMonthlyEGP > 0 ? '<span class="price-period">/month</span>' : ''}
      </div>
      <ul class="pricing-features">
        ${features.map(f => `<li>${f}</li>`).join('')}
      </ul>
      <div class="pricing-card-cta">
        ${isCurrent
          ? '<button class="btn-plan btn-plan--current" disabled>Current Plan</button>'
          : \`<button class="btn-plan ${isPopular ? 'btn-plan--primary' : ''}" data-plan-select="${planId}">${plan.cta}</button>\`
        }
      </div>
    </div>
  `;
}

function renderGroupCard(currentPlan) {
  const plan = PLANS.premium_group;
  const isCurrent = currentPlan === 'premium_group';
  const defaultSeats = GROUP_SEAT_MIN;
  const defaultPrice = GROUP_SEAT_PRICING[defaultSeats];

  return `
    <div class="pricing-card pricing-card--group ${isCurrent ? 'pricing-card--current' : ''}">
      ${isCurrent ? '<div class="pricing-badge pricing-badge--current">CURRENT PLAN</div>' : ''}
      <div class="pricing-card-header">
        <h2>${plan.name}</h2>
        <p class="pricing-card-desc">${plan.description}</p>
      </div>
      <div class="pricing-card-price">
        <span class="price-label">From</span>
        <span class="group-dynamic-price">${formatPrice(defaultPrice, '/month')}</span>
      </div>
      <div class="group-seat-control">
        <label for="group-seats">Team size:</label>
        <select id="group-seats" class="group-seat-selector">
          ${Object.entries(GROUP_SEAT_PRICING).map(([seats, price]) =>
            \`<option value="${seats}">${seats} users — ${formatPrice(price, '/month')}</option>\`
          ).join('')}
        </select>
      </div>
      <ul class="pricing-features">
        <li>Separate accounts & portfolios</li>
        <li>Premium features per member</li>
        <li>Central group billing</li>
        <li>Individual creation cooldowns</li>
        <li>All themes included</li>
      </ul>
      <p class="group-note">Need more than 5 seats? <a href="mailto:support@3dportfolio.app">Contact us.</a></p>
      <div class="pricing-card-cta">
        ${isCurrent
          ? '<button class="btn-plan btn-plan--current" disabled>Current Plan</button>'
          : \`<button class="btn-plan" data-plan-select="premium_group">${plan.cta}</button>\`
        }
      </div>
    </div>
  `;
}

function getPlanFeatures(planId) {
  switch (planId) {
    case 'free':
      return [
        '1 portfolio',
        '3 basic themes',
        'Interactive 3D portfolio',
        'HTML download',
        'Edit until finalization',
        'CV import & review'
      ];
    case 'pro':
      return [
        '1 hosted portfolio',
        'Shareable online link',
        'Professional themes',
        'Continuous editing',
        'Job Fit Analyzer',
        'Basic analytics',
        'PDF export',
        'New Pro themes'
      ];
    case 'premium':
      return [
        'Create multiple portfolios',
        'New slot every 7 days',
        'All themes',
        'Premium themes',
        'Advanced analytics',
        'Custom Domain (coming soon)',
        'Remove branding',
        'Hosting included'
      ];
    default:
      return [];
  }
}

function showCheckoutPlaceholder(planId) {
  const plan = PLANS[planId];
  const modal = document.createElement('div');
  modal.className = 'checkout-placeholder-overlay';
  modal.innerHTML = `
    <div class="checkout-placeholder-modal">
      <button class="checkout-close" aria-label="Close">&times;</button>
      <h2>${plan?.name || planId} Plan</h2>
      <p class="checkout-price">${plan ? formatPrice(plan.priceMonthlyEGP, '/month') : ''}</p>
      <div class="checkout-notice">
        <p>✨ Checkout is not connected yet.</p>
        <p>Payment integration is coming soon!</p>
      </div>
      <button class="btn-plan checkout-ok">Got it</button>
    </div>
  `;
  document.body.appendChild(modal);

  const close = () => modal.remove();
  modal.querySelector('.checkout-close').addEventListener('click', close);
  modal.querySelector('.checkout-ok').addEventListener('click', close);
  modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
}

/**
 * Get the CSS styles for the pricing page.
 * Call this and inject into document head or stylesheet.
 */
export function getPricingStyles() {
  return `
    .pricing-page {
      max-width: 1200px;
      margin: 0 auto;
      padding: 3rem 1.5rem;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    }

    .pricing-header {
      text-align: center;
      margin-bottom: 3rem;
    }

    .pricing-header h1 {
      font-size: 2.5rem;
      font-weight: 700;
      color: #f0f0f0;
      margin-bottom: 0.75rem;
      letter-spacing: -0.02em;
    }

    .pricing-subtitle {
      font-size: 1.125rem;
      color: #999;
      max-width: 500px;
      margin: 0 auto;
    }

    .pricing-cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 1.5rem;
      margin-bottom: 3rem;
    }

    .pricing-card {
      background: #1a1a1a;
      border: 1px solid #2a2a2a;
      border-radius: 16px;
      padding: 2rem;
      position: relative;
      display: flex;
      flex-direction: column;
      transition: border-color 0.2s, transform 0.2s;
    }

    .pricing-card:hover {
      border-color: #444;
      transform: translateY(-2px);
    }

    .pricing-card--popular {
      border-color: #e0a040;
      background: #1c1a16;
    }

    .pricing-card--current {
      border-color: #4a9;
    }

    .pricing-badge {
      position: absolute;
      top: -12px;
      left: 50%;
      transform: translateX(-50%);
      background: #e0a040;
      color: #000;
      padding: 4px 16px;
      border-radius: 12px;
      font-size: 0.75rem;
      font-weight: 700;
      letter-spacing: 0.05em;
      white-space: nowrap;
    }

    .pricing-badge--current {
      background: #4a9;
    }

    .pricing-card-header h2 {
      font-size: 1.5rem;
      font-weight: 600;
      color: #f0f0f0;
      margin-bottom: 0.5rem;
    }

    .pricing-card-desc {
      font-size: 0.875rem;
      color: #888;
      min-height: 2.5em;
    }

    .pricing-card-price {
      margin: 1.5rem 0;
      display: flex;
      align-items: baseline;
      gap: 4px;
    }

    .price-amount {
      font-size: 2.5rem;
      font-weight: 700;
      color: #f0f0f0;
      letter-spacing: -0.02em;
    }

    .price-currency {
      font-size: 1rem;
      color: #888;
      font-weight: 500;
    }

    .price-period {
      font-size: 0.875rem;
      color: #666;
    }

    .price-label {
      font-size: 0.875rem;
      color: #888;
      margin-right: 4px;
    }

    .pricing-features {
      list-style: none;
      padding: 0;
      margin: 0 0 2rem 0;
      flex: 1;
    }

    .pricing-features li {
      padding: 0.5rem 0;
      font-size: 0.875rem;
      color: #ccc;
      border-bottom: 1px solid #222;
      padding-left: 1.5rem;
      position: relative;
    }

    .pricing-features li::before {
      content: '\\2713';
      position: absolute;
      left: 0;
      color: #4a9;
      font-weight: 700;
    }

    .pricing-card-cta {
      margin-top: auto;
    }

    .btn-plan {
      width: 100%;
      padding: 0.875rem;
      border: 1px solid #444;
      border-radius: 10px;
      background: transparent;
      color: #f0f0f0;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s, border-color 0.2s;
    }

    .btn-plan:hover {
      background: #2a2a2a;
      border-color: #666;
    }

    .btn-plan--primary {
      background: #e0a040;
      color: #000;
      border-color: #e0a040;
    }

    .btn-plan--primary:hover {
      background: #d09030;
    }

    .btn-plan--current {
      background: #1a2a1a;
      border-color: #4a9;
      color: #4a9;
      cursor: default;
    }

    .group-seat-control {
      margin: 1rem 0;
    }

    .group-seat-control label {
      display: block;
      font-size: 0.8rem;
      color: #888;
      margin-bottom: 0.5rem;
    }

    .group-seat-selector {
      width: 100%;
      padding: 0.625rem;
      background: #222;
      border: 1px solid #333;
      border-radius: 8px;
      color: #f0f0f0;
      font-size: 0.875rem;
    }

    .group-note {
      font-size: 0.8rem;
      color: #888;
      margin-top: 0.5rem;
    }

    .group-note a {
      color: #e0a040;
    }

    .group-dynamic-price {
      font-size: 1.5rem;
      font-weight: 700;
      color: #f0f0f0;
    }

    /* Keep It Live */
    .pricing-keep-live {
      margin-bottom: 3rem;
    }

    .keep-live-card {
      background: #1a1a1a;
      border: 1px solid #2a2a2a;
      border-radius: 16px;
      padding: 2rem;
      display: flex;
      flex-wrap: wrap;
      gap: 2rem;
      align-items: center;
    }

    .keep-live-header {
      flex: 1;
      min-width: 200px;
    }

    .keep-live-header h3 {
      font-size: 1.25rem;
      color: #f0f0f0;
      margin-bottom: 0.25rem;
    }

    .keep-live-header p {
      font-size: 0.875rem;
      color: #888;
    }

    .keep-live-price {
      text-align: center;
    }

    .keep-live-amount {
      font-size: 1.75rem;
      font-weight: 700;
      color: #f0f0f0;
    }

    .keep-live-per {
      display: block;
      font-size: 0.8rem;
      color: #888;
    }

    .keep-live-desc {
      flex-basis: 100%;
      font-size: 0.875rem;
      color: #999;
    }

    .keep-live-actions {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .btn-keep-live {
      padding: 0.625rem 1.5rem;
      border: 1px solid #444;
      border-radius: 8px;
      background: transparent;
      color: #f0f0f0;
      font-size: 0.875rem;
      cursor: pointer;
    }

    .btn-keep-live:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .keep-live-note {
      font-size: 0.75rem;
      color: #666;
    }

    /* FAQ */
    .pricing-faq {
      margin-bottom: 3rem;
    }

    .pricing-faq h2 {
      font-size: 1.5rem;
      color: #f0f0f0;
      margin-bottom: 1.5rem;
      text-align: center;
    }

    .faq-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 1.5rem;
    }

    .faq-item {
      background: #1a1a1a;
      border: 1px solid #2a2a2a;
      border-radius: 12px;
      padding: 1.5rem;
    }

    .faq-item h4 {
      font-size: 0.95rem;
      color: #f0f0f0;
      margin-bottom: 0.5rem;
    }

    .faq-item p {
      font-size: 0.85rem;
      color: #999;
      line-height: 1.5;
    }

    /* Checkout placeholder */
    .checkout-placeholder-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
    }

    .checkout-placeholder-modal {
      background: #1a1a1a;
      border: 1px solid #333;
      border-radius: 16px;
      padding: 2.5rem;
      max-width: 400px;
      text-align: center;
      position: relative;
    }

    .checkout-placeholder-modal h2 {
      color: #f0f0f0;
      margin-bottom: 0.5rem;
    }

    .checkout-price {
      font-size: 1.5rem;
      font-weight: 700;
      color: #e0a040;
      margin-bottom: 1.5rem;
    }

    .checkout-notice {
      background: #222;
      border-radius: 10px;
      padding: 1.25rem;
      margin-bottom: 1.5rem;
    }

    .checkout-notice p {
      color: #ccc;
      font-size: 0.9rem;
      margin: 0.25rem 0;
    }

    .checkout-close {
      position: absolute;
      top: 12px;
      right: 16px;
      background: none;
      border: none;
      color: #888;
      font-size: 1.5rem;
      cursor: pointer;
    }

    .checkout-ok {
      width: 100%;
    }

    /* Responsive */
    @media (max-width: 768px) {
      .pricing-cards {
        grid-template-columns: 1fr;
      }
      .pricing-header h1 {
        font-size: 1.75rem;
      }
      .keep-live-card {
        flex-direction: column;
        text-align: center;
      }
    }
  \`;
}
