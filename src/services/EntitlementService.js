/**
 * EntitlementService.js
 * Central capability-based entitlement system for SaaS monetization.
 * Supports: FREE, PRO, PREMIUM, PREMIUM_GROUP, KEEP_IT_LIVE.
 * All capability checks delegate to PlanConfig.js — the single source of truth.
 */

import { PLANS, CAPABILITIES, PLAN_IDS, SUBSCRIPTION_STATUSES, getPlanConfig, KEEP_IT_LIVE } from '../config/PlanConfig.js';
import { canAccessTheme, getThemeTier } from '../config/ThemeTierConfig.js';
import { isFeatureEnabled } from '../config/FeatureFlags.js';

// Re-export for backward compatibility
export { CAPABILITIES };

// Legacy compatibility: export PLAN_CONFIG mapped from new PLANS
export const PLAN_CONFIG = PLANS;

export class EntitlementService {
  constructor(subscriptionState = null) {
    this.subscription = subscriptionState || {
      planId: 'free',
      status: 'active'
    };
    this.groupMembership = null;
    this.keepLiveEntitlements = [];
  }

  /**
   * Set the current user's subscription state.
   * Called after loading from Supabase.
   */
  setSubscription(subscriptionState, groupMembership = null, keepLiveEntitlements = []) {
    const source = subscriptionState || {};
    this.subscription = {
      ...source,
      planId: source.planId || source.plan_id || 'free',
      status: source.status || 'active',
      groupId: source.groupId || source.group_id || null,
      graceEndsAt: source.graceEndsAt || source.grace_ends_at || null,
      currentPeriodEnd: source.currentPeriodEnd || source.current_period_end || null,
      cancelAtPeriodEnd: source.cancelAtPeriodEnd || source.cancel_at_period_end || false
    };
    this.groupMembership = groupMembership;
    this.keepLiveEntitlements = keepLiveEntitlements || [];
  }

  /**
   * Get the raw plan ID from subscription.
   */
  getRawPlanId() {
    return this.subscription?.planId || 'free';
  }

  /**
   * Get the effective plan ID considering subscription status.
   * Inactive subscriptions fall back to free.
   */
  getPlanId() {
    const status = this.subscription?.status;
    const planId = this.getRawPlanId();
    const periodEnd = this.subscription?.currentPeriodEnd;

    // If on a paid plan and subscription has an expired period_end, fall back to free
    if (planId !== 'free' && periodEnd) {
      const endMs = new Date(periodEnd).getTime();
      if (!isNaN(endMs) && Date.now() > endMs) {
        return 'free';
      }
    }

    // Active or grace period = plan applies
    if (status === 'active' || status === 'grace' || status === 'canceling') {
      return planId;
    }

    // Keep It Live state
    if (status === 'keep_it_live') {
      return 'free'; // capabilities are free-level, hosting handled separately
    }

    // Expired or unknown = free
    return 'free';
  }

  /**
   * Get the effective plan considering group membership.
   * Group members get premium-level entitlements.
   */
  getEffectivePlanId() {
    // If user is an active group member, they get premium entitlements
    if (this.groupMembership && this.groupMembership.status === 'active') {
      return 'premium';
    }
    return this.getPlanId();
  }

  /**
   * Get the plan config for the effective plan.
   */
  getPlanConfig() {
    return getPlanConfig(this.getEffectivePlanId());
  }

  /**
   * Check if the subscription is currently active (paid or free).
   */
  isActive() {
    const status = this.subscription?.status;
    return status === 'active' || status === 'grace' || status === 'canceling' || this.getRawPlanId() === 'free';
  }

  /**
   * Check if user is in Keep It Live state.
   */
  isKeepItLive() {
    return this.subscription?.status === 'keep_it_live';
  }

  /**
   * Check if subscription is expired.
   */
  isExpired() {
    return this.subscription?.status === 'expired';
  }

  /**
   * Check if a capability is available.
   * Respects feature flags — if enforcement is disabled, allows everything.
   */
  can(capability) {
    // If entitlement enforcement is off, allow everything (legacy behavior)
    if (!isFeatureEnabled('ENTITLEMENT_ENFORCEMENT_ENABLED')) {
      // Still enforce basic plan check for backward compat
      const planId = this.getEffectivePlanId();
      const config = getPlanConfig(planId);
      return config.capabilities.includes(capability);
    }

    // Keep It Live: very restricted
    if (this.isKeepItLive()) {
      // KIL allows HTML export and viewing, but not editing/publishing/themes
      return capability === CAPABILITIES.HTML_EXPORT || capability === CAPABILITIES.CV_IMPORT;
    }

    const config = this.getPlanConfig();
    return config.capabilities.includes(capability);
  }

  /**
   * Check if user can use a specific theme.
   */
  canUseTheme(themeId) {
    if (!isFeatureEnabled('THEME_PAYWALL_ENABLED')) {
      return true; // Paywall not active yet
    }
    const config = this.getPlanConfig();
    return canAccessTheme(config.themeTier, themeId);
  }

  /**
   * Check if a portfolio can retain its currently assigned theme (Legacy grandfathering).
   * Grandfathers the current theme for existing portfolios, without granting permission
   * to freely switch to all higher-tier themes.
   */
  canRetainPortfolioTheme(portfolio, themeId) {
    if (!isFeatureEnabled('THEME_PAYWALL_ENABLED')) return true;
    if (portfolio && (portfolio.theme === themeId || portfolio.theme_id === themeId)) {
      return true; // Grandfather existing assigned theme
    }
    return this.canUseTheme(themeId);
  }

  /**
   * Check if user can switch to a new theme.
   * New theme selection strictly requires appropriate tier access.
   */
  canSelectNewTheme(portfolio, newThemeId) {
    if (!isFeatureEnabled('THEME_PAYWALL_ENABLED')) return true;
    if (portfolio && (portfolio.theme === newThemeId || portfolio.theme_id === newThemeId)) {
      return true; // Already on this theme
    }
    return this.canUseTheme(newThemeId);
  }

  /**
   * Check if user can publish a hosted portfolio.
   */
  canPublishHosted() {
    if (this.isKeepItLive()) {
      return false; // KIL is read-only, no new publishes
    }
    if (!isFeatureEnabled('HOSTING_PAYWALL_ENABLED')) {
      return true; // Hosting paywall not active yet
    }
    return this.can(CAPABILITIES.PUBLISH_HOSTED);
  }

  /**
   * Check if user can edit a portfolio.
   * Considers finalization state for Free users.
   */
  canEditPortfolio(portfolio) {
    // Keep It Live = no editing
    if (this.isKeepItLive()) return false;

    // Expired subscription = no editing
    if (this.isExpired()) return false;

    // Free finalized portfolio
    if (isFeatureEnabled('FREE_FINALIZATION_LOCK_ENABLED')) {
      const effectivePlan = this.getEffectivePlanId();
      if (effectivePlan === 'free' && portfolio?.is_finalized) {
        return false;
      }
    }

    return true;
  }

  /**
   * Check if user can export PDF.
   */
  canExportPDF() {
    return this.can(CAPABILITIES.PDF_EXPORT);
  }

  /**
   * Check if user can export HTML.
   */
  canExportHTML() {
    return this.can(CAPABILITIES.HTML_EXPORT);
  }

  /**
   * Check if user can view basic analytics.
   */
  canViewBasicAnalytics() {
    return this.can(CAPABILITIES.BASIC_ANALYTICS);
  }

  /**
   * Check if user can view advanced analytics.
   */
  canViewAdvancedAnalytics() {
    return this.can(CAPABILITIES.ADVANCED_ANALYTICS);
  }

  /**
   * Check if user can use custom domain.
   */
  canUseCustomDomain() {
    return this.can(CAPABILITIES.CUSTOM_DOMAIN);
  }

  /**
   * Check if user can remove branding.
   */
  canRemoveBranding() {
    return this.can(CAPABILITIES.REMOVE_BRANDING);
  }

  /**
   * Check if user can use Job Match.
   */
  canUseJobMatch() {
    return this.can(CAPABILITIES.JOB_MATCH);
  }

  /**
   * Get a specific limit value.
   */
  getLimit(limitKey) {
    const config = this.getPlanConfig();
    return config.limits[limitKey] !== undefined ? config.limits[limitKey] : 0;
  }

  /**
   * Check if a limit is unlimited (-1).
   */
  isUnlimited(limitKey) {
    return this.getLimit(limitKey) === -1;
  }

  /**
   * Check if a portfolio has active Keep It Live.
   */
  hasKeepItLive(portfolioId) {
    return this.keepLiveEntitlements.some(
      kl => kl.portfolio_id === portfolioId && kl.status === 'active'
    );
  }

  /**
   * Get human-friendly plan display name.
   */
  getPlanDisplayName() {
    const config = this.getPlanConfig();
    return config.name || 'Free';
  }

  /**
   * Get the theme tier for the current plan.
   */
  getThemeTier() {
    const config = this.getPlanConfig();
    return config.themeTier || 'free';
  }
}

export const globalEntitlements = new EntitlementService();
