/**
 * FeatureFlags.js
 * Simple feature flag configuration for staged monetization rollout.
 * All flags default to false for safety.
 * Server-side flags read from process.env, client-side from import.meta.env.
 */

function envBool(key) {
  // Client-side (Vite)
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    const val = import.meta.env[`VITE_FF_${key}`];
    return val === 'true' || val === '1';
  }
  // Server-side (Node)
  if (typeof process !== 'undefined' && process.env) {
    const val = process.env[`FF_${key}`];
    return val === 'true' || val === '1';
  }
  return false;
}

export const FEATURE_FLAGS = {
  /** Career Studio is opt-in while it is developed locally. */
  CAREER_STUDIO: envBool('CAREER_STUDIO'),
  /** Show new pricing UI (plans, prices, CTAs) */
  MONETIZATION_UI_ENABLED: envBool('MONETIZATION_UI_ENABLED'),

  /** Enforce entitlement checks server-side */
  ENTITLEMENT_ENFORCEMENT_ENABLED: envBool('ENTITLEMENT_ENFORCEMENT_ENABLED'),

  /** Enforce Free portfolio finalization lock */
  FREE_FINALIZATION_LOCK_ENABLED: envBool('FREE_FINALIZATION_LOCK_ENABLED'),

  /** Enforce theme tier paywalls */
  THEME_PAYWALL_ENABLED: envBool('THEME_PAYWALL_ENABLED'),

  /** Enforce hosting paywall (deny Free publish) */
  HOSTING_PAYWALL_ENABLED: envBool('HOSTING_PAYWALL_ENABLED'),

  /** Show pricing page */
  PRICING_PAGE_ENABLED: envBool('PRICING_PAGE_ENABLED'),

  /** Enable group management features */
  GROUP_MANAGEMENT_ENABLED: envBool('GROUP_MANAGEMENT_ENABLED')
};

/**
 * Check if a feature flag is enabled.
 * @param {string} flagName - Key from FEATURE_FLAGS
 * @returns {boolean}
 */
export function isFeatureEnabled(flagName) {
  return FEATURE_FLAGS[flagName] === true;
}

/**
 * Server-side feature flag check.
 * Reads directly from process.env for serverless functions.
 */
export function isServerFeatureEnabled(flagName) {
  if (typeof process !== 'undefined' && process.env) {
    const val = process.env[`FF_${flagName}`];
    return val === 'true' || val === '1';
  }
  return false;
}
