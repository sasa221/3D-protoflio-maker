/**
 * PlanConfig.js
 * Single canonical source of truth for all commercial plans, prices, capabilities, and limits. All prices in EGP.
 */

export const EMAIL_OTP_LENGTH = 8;

export const PLAN_IDS = {
  FREE: 'free',
  PRO: 'pro',
  PREMIUM: 'premium',
  PREMIUM_GROUP: 'premium_group'
};

export const SUBSCRIPTION_STATUSES = {
  FREE: 'free',
  ACTIVE: 'active',
  CANCELING: 'canceling',
  EXPIRED: 'expired',
  GRACE: 'grace',
  KEEP_IT_LIVE: 'keep_it_live'
};

export const CAPABILITIES = {
  CV_IMPORT: 'cv_import',
  HTML_EXPORT: 'html_export',
  PDF_EXPORT: 'pdf_export',
  PUBLISH_HOSTED: 'publish_hosted',
  CONTINUOUS_EDIT: 'continuous_edit',
  CUSTOM_DOMAIN: 'custom_domain',
  REMOVE_BRANDING: 'remove_branding',
  BASIC_ANALYTICS: 'basic_analytics',
  ADVANCED_ANALYTICS: 'advanced_analytics',
  JOB_MATCH: 'job_match',
  PORTFOLIO_VARIANTS: 'portfolio_variants',
  CINEMATIC_INTRO_ADVANCED: 'cinematic_intro_advanced',
  CUSTOM_SEO: 'custom_seo'
};

export const PLANS = {
  free: {
    id: 'free',
    name: 'Free',
    priceMonthlyEGP: 0,
    priceAnnualEGP: 0,
    currency: 'EGP',
    hosted: false,
    portfolioPolicy: 'one_lifetime_slot',
    themeTier: 'free',
    maxPortfolios: 1,
    capabilities: [CAPABILITIES.CV_IMPORT, CAPABILITIES.HTML_EXPORT],
    limits: {
      portfolios: 1,
      variants: 1,
      projects: 5,
      customDomains: 0,
      analyticsDays: 0,
      jobMatchLifetimeQuota: 1, // 1 lifetime analysis per account
      exportsPerMonth: 1  // 1 standalone HTML export per month for free
    },
    description: 'Build and download your portfolio.',
    cta: 'Start Free'
  },

  pro: {
    id: 'pro',
    name: 'Pro',
    priceMonthlyEGP: 600,
    currency: 'EGP',
    badge: 'MOST POPULAR',
    hosted: true,
    portfolioPolicy: 'one_persistent_slot',
    themeTier: 'pro',
    maxPortfolios: 1,
    capabilities: [
      CAPABILITIES.CV_IMPORT,
      CAPABILITIES.HTML_EXPORT,
      CAPABILITIES.PDF_EXPORT,
      CAPABILITIES.PUBLISH_HOSTED,
      CAPABILITIES.CONTINUOUS_EDIT,
      CAPABILITIES.BASIC_ANALYTICS,
      CAPABILITIES.JOB_MATCH,
      CAPABILITIES.PORTFOLIO_VARIANTS,
      CAPABILITIES.CINEMATIC_INTRO_ADVANCED,
      CAPABILITIES.CUSTOM_SEO
      // Pro branding removal is strictly NO (Premium only)
    ],
    limits: {
      portfolios: 1,
      variants: 5,
      projects: 50,
      customDomains: 0,
      analyticsDays: 90,
      jobMatchLifetimeQuota: -1, // Unlimited for paid plans
      exportsPerMonth: -1
    },
    description: 'Put your portfolio online.',
    cta: 'Go Pro'
  },

  premium: {
    id: 'premium',
    name: 'Premium',
    priceMonthlyEGP: 1000,
    currency: 'EGP',
    hosted: true,
    portfolioPolicy: 'rolling_cooldown',
    portfolioCreationCooldownDays: 7,
    themeTier: 'premium',
    maxPortfolios: -1, // unlimited, governed by cooldown
    capabilities: [
      CAPABILITIES.CV_IMPORT,
      CAPABILITIES.HTML_EXPORT,
      CAPABILITIES.PDF_EXPORT,
      CAPABILITIES.PUBLISH_HOSTED,
      CAPABILITIES.CONTINUOUS_EDIT,
      CAPABILITIES.CUSTOM_DOMAIN,
      CAPABILITIES.REMOVE_BRANDING,
      CAPABILITIES.BASIC_ANALYTICS,
      CAPABILITIES.ADVANCED_ANALYTICS,
      CAPABILITIES.JOB_MATCH,
      CAPABILITIES.PORTFOLIO_VARIANTS,
      CAPABILITIES.CINEMATIC_INTRO_ADVANCED,
      CAPABILITIES.CUSTOM_SEO
    ],
    limits: {
      portfolios: -1,
      variants: -1,
      projects: -1,
      customDomains: 3,
      analyticsDays: 365,
      jobMatchLifetimeQuota: -1,
      exportsPerMonth: -1
    },
    description: 'Maximum control and premium features.',
    cta: 'Go Premium'
  },

  premium_group: {
    id: 'premium_group',
    name: 'Premium Group',
    priceMonthlyEGP: 1800,
    priceStartingMonthlyEGP: 1800,
    currency: 'EGP',
    hosted: true,
    portfolioPolicy: 'rolling_cooldown',
    portfolioCreationCooldownDays: 7,
    themeTier: 'premium',
    maxPortfolios: -1,
    capabilities: [/* same as premium */],
    limits: { /* same as premium */ },
    description: 'Premium access for 2–5 individual users.',
    cta: 'Create a Group'
  }
};

// Copy premium capabilities/limits to premium_group
PLANS.premium_group.capabilities = [...PLANS.premium.capabilities];
PLANS.premium_group.limits = { ...PLANS.premium.limits };

export const GROUP_SEAT_PRICING = {
  2: 1800,
  3: 2550,
  4: 3200,
  5: 3750
};

export const GROUP_SEAT_MIN = 2;
export const GROUP_SEAT_MAX = 5;

export const HOSTING_GRACE_PERIOD_DAYS = 7;

export const KEEP_IT_LIVE = {
  priceAnnualPerPortfolioEGP: 500,
  currency: 'EGP',
  hosted: true,
  canEdit: false,
  canCreate: false,
  canPublishNew: false,
  canChangeTheme: false
};

// Approved product configuration
export const AWAITING_APPROVAL = {};
export const APPROVED_PRODUCT_CONFIG = {
  FREE_THEMES: ['code', 'creative', 'minimal'],
  PRO_THEMES: ['hacker', 'data', 'blueprint', 'media', 'health', 'marketing', 'education'],
  PREMIUM_THEMES: ['cosmic', 'finance', 'legal', 'obsidian', 'quantum'],
  PRO_BRANDING_REMOVAL: false,
  FREE_JOB_MATCH_QUOTA: 1,
  HOSTING_GRACE_PERIOD_DAYS: 7
};

/**
 * Get the plan config for a given plan ID.
 * For premium_group members, returns premium-level capabilities.
 */
export function getPlanConfig(planId) {
  return PLANS[planId] || PLANS.free;
}

/**
 * Safe currency formatter for Egyptian Pounds.
 * Validates number input and never crashes on undefined/null.
 */
export function formatEGP(amountEGP, period = '') {
  if (typeof amountEGP !== 'number' || !Number.isFinite(amountEGP)) {
    return '0';
  }
  if (amountEGP === 0) return '0';
  return amountEGP.toLocaleString('en-EG');
}

/**
 * Format price for display with currency and period suffix.
 */
export function formatPrice(amountEGP, period = '/month') {
  if (typeof amountEGP !== 'number' || !Number.isFinite(amountEGP)) {
    return '0 EGP';
  }
  if (amountEGP === 0) return '0 EGP';
  return `${amountEGP.toLocaleString('en-EG')} EGP${period}`;
}

/**
 * Get group price for a given seat count.
 */
export function getGroupPrice(seats) {
  return GROUP_SEAT_PRICING[seats] || null;
}

export const INSTAPAY_CONFIG = {
  displayName: (typeof process !== 'undefined' && process.env?.INSTAPAY_ACCOUNT_NAME) || 'SALEH MOHAMED SALEH',
  instapayAddress: (typeof process !== 'undefined' && process.env?.INSTAPAY_ADDRESS) || 'saleh2005mohamed@instapay',
  phoneNumber: (typeof process !== 'undefined' && process.env?.INSTAPAY_PHONE_NUMBER) || '01270024222',
  isConfigured: true
};
