/**
 * IntroProfiles.js
 * Single Source of Truth for Cinematic Portfolio Intro Opening Sequences.
 * Shared across Studio IntroDirector and Exported Standalone Bundles.
 */

export const INTRO_PROFILES = {
  data: {
    startPos: [0, 0, 160],
    heroPos: [0, 0, 85],
    startTarget: [0, 20, 0],
    heroTarget: [0, 0, 0],
    startFov: 80,
    heroFov: 62,
    particleRamp: 0.2,
    lightIntensity: 0.1,
    style: 'luminous'
  },
  code: {
    startPos: [0, -40, 140],
    heroPos: [0, 0, 80],
    startTarget: [0, -10, 0],
    heroTarget: [0, 0, 0],
    startFov: 75,
    heroFov: 60,
    particleRamp: 0.1,
    lightIntensity: 0.15,
    style: 'matrix'
  },
  cyber: {
    startPos: [0, 50, 130],
    heroPos: [0, 0, 78],
    startTarget: [0, -5, 0],
    heroTarget: [0, 0, 0],
    startFov: 70,
    heroFov: 60,
    particleRamp: 0.15,
    lightIntensity: 0.1,
    style: 'cyberScan'
  },
  default: {
    startPos: [0, 0, 150],
    heroPos: [0, 0, 80],
    startTarget: [0, 10, 0],
    heroTarget: [0, 0, 0],
    startFov: 75,
    heroFov: 60,
    particleRamp: 0.2,
    lightIntensity: 0.1,
    style: 'fade'
  }
};

export function getIntroProfileKey(themeId = '') {
  const id = (themeId || '').toLowerCase();
  if (['data', 'growth', 'marketing', 'cosmic', 'finance'].includes(id)) return 'data';
  if (['code', 'blueprint', 'legal', 'education'].includes(id)) return 'code';
  if (['hacker', 'cyber', 'media', 'health', 'creative'].includes(id)) return 'cyber';
  return 'default';
}

export function getIntroProfile(themeId = '') {
  const key = getIntroProfileKey(themeId);
  return INTRO_PROFILES[key] || INTRO_PROFILES.default;
}

export function getIntroDuration(mode = 'short', isMobile = false) {
  if (mode === 'off') return 0;
  if (isMobile) {
    if (mode === 'epic') return 4.0;
    if (mode === 'cinematic') return 3.0;
    return 1.5;
  }
  if (mode === 'epic') return 7.0;
  if (mode === 'cinematic') return 4.5;
  return 2.0; // short
}
