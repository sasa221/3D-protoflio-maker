/**
 * UsageLimitService.js
 * Metered tracking service for portfolio creation, variants, HTML exports,
 * custom domains, finalization state, and Premium cooldowns.
 * Evaluates current usage against globalEntitlements limits.
 */

import { globalEntitlements } from './EntitlementService.js';
import { PLANS } from '../config/PlanConfig.js';
import { isFeatureEnabled } from '../config/FeatureFlags.js';

export class UsageLimitService {
  canCreateVariant(currentVariantsCount) {
    const maxAllowed = globalEntitlements.getLimit('variants');
    if (maxAllowed === -1) return true;
    return currentVariantsCount < maxAllowed;
  }

  canCreatePortfolio(currentPortfoliosCount, totalCreationCount = 0, lastCreatedAt = null, entitlements = globalEntitlements) {
    const planId = entitlements.getEffectivePlanId();
    const plan = PLANS[planId] || PLANS.free;

    // Free: one lifetime slot
    if (planId === 'free') {
      // totalCreationCount includes deleted portfolios
      return totalCreationCount < 1;
    }

    // Pro: one persistent slot — allows initial creation, but prevents deleting and creating new identities repeatedly
    if (planId === 'pro') {
      if (currentPortfoliosCount >= 1) return false;
      if (totalCreationCount >= 1) return false; // Must edit / reset / restore existing slot, not create new identities
      return true;
    }

    // Premium/Premium Group: rolling cooldown
    if (planId === 'premium' || planId === 'premium_group') {
      if (!lastCreatedAt) return true;
      const cooldownDays = plan.portfolioCreationCooldownDays || 7;
      const cooldownMs = cooldownDays * 24 * 60 * 60 * 1000;
      const now = Date.now();
      const lastCreated = new Date(lastCreatedAt).getTime();
      return (now - lastCreated) >= cooldownMs;
    }

    return false;
  }

  /**
   * Get portfolio creation availability.
   * Returns { allowed, reason, nextAvailableAt }
   */
  getPortfolioCreationAvailability(currentCount, totalCreated, lastCreatedAt, entitlements = globalEntitlements) {
    const planId = entitlements.getEffectivePlanId();
    const plan = PLANS[planId] || PLANS.free;

    if (planId === 'free') {
      if (totalCreated >= 1) {
        return {
          allowed: false,
          reason: 'The Free plan includes one portfolio. Upgrade to Pro for a hosted portfolio.'
        };
      }
      return { allowed: true };
    }

    if (planId === 'pro') {
      if (currentCount >= 1) {
        return {
          allowed: false,
          reason: 'Pro includes one persistent professional portfolio slot. Upgrade to Premium for multiple portfolios.'
        };
      }
      if (totalCreated >= 1) {
        return {
          allowed: false,
          reason: 'Your Pro subscription includes one persistent portfolio slot. You can edit, reset, or restore your existing slot, or upgrade to Premium to create additional portfolios.'
        };
      }
      return { allowed: true };
    }

    if (planId === 'premium' || planId === 'premium_group') {
      if (lastCreatedAt) {
        const cooldownDays = plan.portfolioCreationCooldownDays || 7;
        const cooldownMs = cooldownDays * 24 * 60 * 60 * 1000;
        const nextAvailable = new Date(new Date(lastCreatedAt).getTime() + cooldownMs);
        if (Date.now() < nextAvailable.getTime()) {
          return {
            allowed: false,
            reason: `Your next portfolio slot becomes available on ${nextAvailable.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}.`,
            nextAvailableAt: nextAvailable.toISOString()
          };
        }
      }
      return { allowed: true };
    }

    return { allowed: false, reason: 'Portfolio creation is not available on your current plan.' };
  }

  /**
   * Check if a Free portfolio can be finalized.
   */
  canFinalizeFreePortfolio(portfolio) {
    if (!isFeatureEnabled('FREE_FINALIZATION_LOCK_ENABLED')) {
      return true; // Finalization lock not active yet
    }
    // Can finalize if not already finalized
    return !portfolio?.is_finalized;
  }

  /**
   * Check if a finalized Free portfolio can be edited.
   * Returns false for finalized Free portfolios (need upgrade).
   */
  canEditFinalizedPortfolio(portfolio) {
    if (!isFeatureEnabled('FREE_FINALIZATION_LOCK_ENABLED')) {
      return true; // Lock not active
    }
    const planId = globalEntitlements.getEffectivePlanId();
    if (planId !== 'free') return true; // Paid plans can always edit
    return !portfolio?.is_finalized; // Free can edit only if not finalized
  }

  canConnectCustomDomain(currentDomainsCount) {
    const maxAllowed = globalEntitlements.getLimit('customDomains');
    if (maxAllowed === -1) return true;
    return currentDomainsCount < maxAllowed;
  }

  getRemainingExports(currentExportsThisMonth) {
    const maxAllowed = globalEntitlements.getLimit('exportsPerMonth');
    if (maxAllowed === -1) return Infinity;
    return Math.max(0, maxAllowed - currentExportsThisMonth);
  }

  canExportHTML(currentExportsThisMonth) {
    return this.getRemainingExports(currentExportsThisMonth) > 0;
  }
}

export const globalUsageLimit = new UsageLimitService();
