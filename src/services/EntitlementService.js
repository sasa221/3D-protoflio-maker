/**
 * EntitlementService.js
 * Central capability-based entitlement system for SaaS monetization.
 * Replaces scattered `if (plan === 'pro')` checks with centralized capability evaluation.
 */

export const CAPABILITIES = {
  CUSTOM_DOMAIN: 'custom_domain',
  REMOVE_BRANDING: 'remove_branding',
  CINEMATIC_INTRO_ADVANCED: 'cinematic_intro_advanced',
  ADVANCED_THEMES: 'advanced_themes',
  CV_IMPORT: 'cv_import',
  JOB_OPTIMIZER: 'job_optimizer',
  PORTFOLIO_VARIANTS: 'portfolio_variants',
  ADVANCED_ANALYTICS: 'advanced_analytics',
  HTML_EXPORT: 'html_export',
  CUSTOM_SEO: 'custom_seo'
};

export const PLAN_CONFIG = {
  free: {
    name: 'Free',
    priceMonthly: 0,
    priceAnnual: 0,
    limits: {
      portfolios: 1,
      variants: 1,
      projects: 5,
      customDomains: 0,
      analyticsDays: 7,
      exportsPerMonth: 1
    },
    capabilities: [
      CAPABILITIES.CV_IMPORT,
      CAPABILITIES.HTML_EXPORT
    ]
  },

  pro: {
    name: 'Pro',
    priceMonthly: 12,
    priceAnnual: 99,
    limits: {
      portfolios: 10,
      variants: 5,
      projects: 50,
      customDomains: 3,
      analyticsDays: 90,
      exportsPerMonth: -1 // Unlimited
    },
    capabilities: [
      CAPABILITIES.CUSTOM_DOMAIN,
      CAPABILITIES.REMOVE_BRANDING,
      CAPABILITIES.CINEMATIC_INTRO_ADVANCED,
      CAPABILITIES.ADVANCED_THEMES,
      CAPABILITIES.CV_IMPORT,
      CAPABILITIES.JOB_OPTIMIZER,
      CAPABILITIES.PORTFOLIO_VARIANTS,
      CAPABILITIES.ADVANCED_ANALYTICS,
      CAPABILITIES.HTML_EXPORT,
      CAPABILITIES.CUSTOM_SEO
    ]
  }
};

export class EntitlementService {
  constructor(subscriptionState = null) {
    this.subscription = subscriptionState || {
      planId: 'free',
      status: 'active'
    };
  }

  setSubscription(subscriptionState) {
    this.subscription = subscriptionState || { planId: 'free', status: 'active' };
  }

  getPlanId() {
    if (!this.subscription || this.subscription.status !== 'active') {
      return 'free';
    }
    return this.subscription.planId || 'free';
  }

  getPlanConfig() {
    const planId = this.getPlanId();
    return PLAN_CONFIG[planId] || PLAN_CONFIG.free;
  }

  can(capability) {
    const config = this.getPlanConfig();
    return config.capabilities.includes(capability);
  }

  getLimit(limitKey) {
    const config = this.getPlanConfig();
    return config.limits[limitKey] !== undefined ? config.limits[limitKey] : 0;
  }

  isUnlimited(limitKey) {
    return this.getLimit(limitKey) === -1;
  }
}

export const globalEntitlements = new EntitlementService();
