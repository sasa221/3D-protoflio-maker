/**
 * BillingService.js
 * Billing provider abstraction with subscription state machine.
 * Phase 8A: No real payment processing. Stripe endpoints disabled behind feature flags.
 * Server is the sole source of truth for paid entitlements.
 */

import { globalEntitlements } from './EntitlementService.js';
import { supabase } from './SupabaseClient.js';
import { PLANS, PLAN_IDS, SUBSCRIPTION_STATUSES, GROUP_SEAT_PRICING, KEEP_IT_LIVE, formatPrice, getGroupPrice } from '../config/PlanConfig.js';
import { isFeatureEnabled } from '../config/FeatureFlags.js';

/**
 * Valid subscription state transitions.
 */
const VALID_TRANSITIONS = {
  free:        ['active'],
  active:      ['canceling', 'expired', 'grace'],
  canceling:   ['expired', 'active', 'grace'],
  grace:       ['active', 'expired', 'keep_it_live'],
  expired:     ['active', 'keep_it_live', 'free'],
  keep_it_live: ['active', 'expired', 'free']
};

export class BillingService {
  /**
   * Check if a state transition is valid.
   */
  isValidTransition(fromStatus, toStatus) {
    const allowed = VALID_TRANSITIONS[fromStatus];
    return allowed ? allowed.includes(toStatus) : false;
  }

  /**
   * Get available plan transitions for current plan.
   */
  getAvailableUpgrades(currentPlanId) {
    const upgrades = [];
    if (currentPlanId === 'free') {
      upgrades.push('pro', 'premium', 'premium_group');
    } else if (currentPlanId === 'pro') {
      upgrades.push('premium', 'premium_group');
    } else if (currentPlanId === 'premium') {
      upgrades.push('premium_group');
    }
    return upgrades;
  }

  /**
   * Get Keep It Live options for a user with expiring/expired subscription.
   */
  getKeepItLiveOptions(portfolios = []) {
    return portfolios.map(p => ({
      portfolioId: p.id,
      portfolioName: p.name,
      priceAnnualEGP: KEEP_IT_LIVE.priceAnnualPerPortfolioEGP,
      priceDisplay: formatPrice(KEEP_IT_LIVE.priceAnnualPerPortfolioEGP, '/year')
    }));
  }

  /**
   * Create checkout session (placeholder for Phase 8B).
   * Currently routes to "Coming Soon" unless MONETIZATION_UI_ENABLED.
   */
  async createCheckoutSession(userId, targetPlanId = 'pro', interval = 'monthly') {
    if (!userId) {
      throw new Error('User authentication required for billing checkout.');
    }

    // Phase 8A: No real checkout
    if (!isFeatureEnabled('MONETIZATION_UI_ENABLED')) {
      return {
        checkoutUrl: null,
        message: 'Checkout is not connected yet. Coming soon!',
        plan: PLANS[targetPlanId],
        price: PLANS[targetPlanId]?.priceMonthlyEGP
      };
    }

    // Future Phase 8B: Real payment provider integration
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('Please sign in again before upgrading.');
    }

    const response = await fetch('/api/billing/checkout', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ targetPlanId, interval })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.url) {
      throw new Error(payload.error || 'Checkout is temporarily unavailable.');
    }

    return { ...payload, checkoutUrl: payload.url };
  }

  /**
   * Create billing portal session.
   */
  async createBillingPortalSession(userId) {
    if (!userId) throw new Error('User authentication required for billing.');
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error('Please sign in again to manage billing.');

    const response = await fetch('/api/billing/portal', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.url) {
      throw new Error(payload.error || 'Billing portal is temporarily unavailable.');
    }
    return payload;
  }

  /**
   * Get all plan information for pricing display.
   */
  getAllPlans() {
    return {
      free: PLANS.free,
      pro: PLANS.pro,
      premium: PLANS.premium,
      premiumGroup: PLANS.premium_group,
      groupPricing: GROUP_SEAT_PRICING,
      keepItLive: KEEP_IT_LIVE
    };
  }

  /**
   * Get the formatted price string for a plan.
   */
  getPlanPrice(planId) {
    const plan = PLANS[planId];
    if (!plan) return '0 EGP';
    return formatPrice(plan.priceMonthlyEGP);
  }

  /**
   * Server-Side Entitlement Verification.
   * Prevents localStorage tampering.
   */
  async verifyServerSideCapability(userId, capability) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        return { allowed: false, error: 'Authentication required.' };
      }

      const response = await fetch('/api/entitlements/check', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action: capability })
      });

      const result = await response.json().catch(() => ({}));
      return { allowed: result.allowed === true, reason: result.reason };
    } catch (e) {
      return { allowed: false, error: e.message };
    }
  }
}

export const globalBilling = new BillingService();
