/**
 * ThemeTierConfig.js
 * Centralized theme tier assignments for all 15 themes.
 * Single source of truth for theme access across Studio, Renderer, and APIs.
 *
 * Final distribution:
 * FREE: code, creative, minimal (3)
 * PRO: hacker, data, blueprint, media, health, marketing, education (7)
 * PREMIUM: cosmic, finance, legal, obsidian, quantum (5)
 */

import { PLAN_IDS } from './PlanConfig.js';

/**
 * Theme tier assignments.
 * Key = theme ID from ProceduralTheme.js
 * Value = minimum plan tier required ('free', 'pro', 'premium')
 */
export const THEME_TIERS = {
  // FREE tier (3)
  code: 'free',
  creative: 'free',
  minimal: 'free',

  // PRO tier (7)
  hacker: 'pro',
  data: 'pro',
  blueprint: 'pro',
  media: 'pro',
  health: 'pro',
  marketing: 'pro',
  education: 'pro',

  // PREMIUM tier (5)
  cosmic: 'premium',
  finance: 'premium',
  legal: 'premium',
  obsidian: 'premium',
  quantum: 'premium'
};

/**
 * Tier hierarchy for comparison.
 * Higher index = higher tier.
 */
const TIER_HIERARCHY = ['free', 'pro', 'premium'];

/**
 * Check if a plan tier can access a theme.
 * @param {string} userTier - The user's plan theme tier ('free', 'pro', 'premium')
 * @param {string} themeId - The theme ID to check
 * @returns {boolean}
 */
export function canAccessTheme(userTier, themeId) {
  const requiredTier = THEME_TIERS[themeId] || 'free';
  const userLevel = TIER_HIERARCHY.indexOf(userTier);
  const requiredLevel = TIER_HIERARCHY.indexOf(requiredTier);
  return userLevel >= requiredLevel;
}

/**
 * Get the required tier for a theme.
 * @param {string} themeId
 * @returns {string} 'free', 'pro', or 'premium'
 */
export function getThemeTier(themeId) {
  return THEME_TIERS[themeId] || 'free';
}

/**
 * Get all themes for a given tier.
 * @param {string} tier - 'free', 'pro', or 'premium'
 * @returns {string[]} Array of theme IDs
 */
export function getThemesByTier(tier) {
  return Object.entries(THEME_TIERS)
    .filter(([, t]) => t === tier)
    .map(([id]) => id);
}

/**
 * Get the display badge text for a theme's tier.
 * Returns null for free themes (no badge needed).
 */
export function getThemeBadge(themeId) {
  const tier = getThemeTier(themeId);
  if (tier === 'pro') return 'PRO';
  if (tier === 'premium') return 'PREMIUM';
  return null;
}
