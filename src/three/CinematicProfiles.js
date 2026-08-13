/**
 * CinematicProfiles.js
 * Single Source of Truth for 3D Camera Shots & Continuous Scroll Profiles.
 * Shared across Studio SceneDirector and Exported Standalone Bundles.
 */

export const CINEMATIC_PROFILES = {
  data: {
    hero:         { pos: [0, 0, 85],     target: [0, 0, 0],   fov: 62, rotY: 0,    coreScale: 1.0,  parallax: 8 },
    mobileHero:   { pos: [0, -10, 105],  target: [0, -4, 0],  fov: 65, rotY: 0,    coreScale: 0.85, parallax: 4 },
    about:        { pos: [-35, 18, 65],  target: [5, -2, 0],  fov: 58, rotY: 0.35, coreScale: 1.15, parallax: 7 },
    projects:     { pos: [40, -12, 55],  target: [-8, 2, 0],  fov: 50, rotY: 0.85, coreScale: 1.35, parallax: 6 },
    skills:       { pos: [-10, 32, 58],  target: [2, -5, 0],  fov: 56, rotY: -0.6, coreScale: 1.2,  parallax: 7 },
    certs:        { pos: [22, 24, 62],   target: [-4, -2, 0], fov: 52, rotY: 0.45, coreScale: 1.05, parallax: 6 },
    contact:      { pos: [0, -25, 90],   target: [0, 5, 0],   fov: 65, rotY: 0,    coreScale: 0.9,  parallax: 5 },
    projectFocus: { pos: [0, -4, 40],    target: [0, 1, 0],   fov: 46, rotY: 0.15, coreScale: 1.45, parallax: 2 }
  },
  code: {
    hero:         { pos: [0, 0, 80],     target: [0, 0, 0],   fov: 60, rotY: 0,    coreScale: 1.0,  parallax: 7 },
    mobileHero:   { pos: [0, -12, 100],  target: [0, -3, 0],  fov: 64, rotY: 0,    coreScale: 0.8,  parallax: 3 },
    about:        { pos: [25, 15, 60],   target: [-5, 0, 0],  fov: 55, rotY: -0.4, coreScale: 1.1,  parallax: 6 },
    projects:     { pos: [0, -15, 45],   target: [0, 5, 0],   fov: 48, rotY: 0.2,  coreScale: 1.4,  parallax: 5 },
    skills:       { pos: [-30, 20, 55],  target: [5, -2, 0],  fov: 56, rotY: 0.7,  coreScale: 1.25, parallax: 6 },
    certs:        { pos: [18, -20, 62],  target: [-2, 4, 0],  fov: 52, rotY: -0.3, coreScale: 1.05, parallax: 6 },
    contact:      { pos: [0, 0, 95],     target: [0, 0, 0],   fov: 68, rotY: 0,    coreScale: 0.85, parallax: 4 },
    projectFocus: { pos: [0, -6, 38],    target: [0, 0, 0],   fov: 44, rotY: 0.05, coreScale: 1.5,  parallax: 2 }
  },
  cyber: {
    hero:         { pos: [0, 0, 78],     target: [0, 0, 0],   fov: 60, rotY: 0,    coreScale: 1.0,  parallax: 8 },
    mobileHero:   { pos: [0, -8, 98],    target: [0, -3, 0],  fov: 62, rotY: 0,    coreScale: 0.82, parallax: 4 },
    about:        { pos: [-30, -15, 62], target: [6, 3, 0],   fov: 56, rotY: 0.5,  coreScale: 1.1,  parallax: 7 },
    projects:     { pos: [32, 20, 50],   target: [-6, -4, 0], fov: 48, rotY: -0.75,coreScale: 1.3,  parallax: 5 },
    skills:       { pos: [0, -28, 56],   target: [0, 6, 0],   fov: 54, rotY: 0.4,  coreScale: 1.2,  parallax: 6 },
    certs:        { pos: [-25, 18, 64],  target: [4, -2, 0],  fov: 52, rotY: -0.5, coreScale: 1.1,  parallax: 6 },
    contact:      { pos: [0, 30, 88],    target: [0, -6, 0],  fov: 66, rotY: 0,    coreScale: 0.9,  parallax: 4 },
    projectFocus: { pos: [0, -5, 42],    target: [0, 2, 0],   fov: 45, rotY: 0.1,  coreScale: 1.4,  parallax: 2 }
  },
  default: {
    hero:         { pos: [0, 0, 80],     target: [0, 0, 0],   fov: 60, rotY: 0,    coreScale: 1.0,  parallax: 8 },
    mobileHero:   { pos: [0, -10, 100],  target: [0, -4, 0],  fov: 64, rotY: 0,    coreScale: 0.85, parallax: 4 },
    about:        { pos: [-28, 16, 62],  target: [4, -2, 0],  fov: 56, rotY: 0.3,  coreScale: 1.1,  parallax: 7 },
    projects:     { pos: [32, -12, 54],  target: [-6, 2, 0],  fov: 50, rotY: 0.7,  coreScale: 1.3,  parallax: 6 },
    skills:       { pos: [-15, 25, 58],  target: [3, -4, 0],  fov: 55, rotY: -0.5, coreScale: 1.2,  parallax: 6 },
    certs:        { pos: [20, 18, 62],   target: [-4, -2, 0], fov: 52, rotY: 0.4,  coreScale: 1.05, parallax: 6 },
    contact:      { pos: [0, -20, 88],   target: [0, 4, 0],   fov: 64, rotY: 0,    coreScale: 0.9,  parallax: 5 },
    projectFocus: { pos: [0, -5, 40],    target: [0, 1, 0],   fov: 45, rotY: 0.1,  coreScale: 1.4,  parallax: 2 }
  }
};

export function getCinematicProfileKey(themeId = '') {
  const id = (themeId || '').toLowerCase();
  if (['data', 'growth', 'marketing', 'cosmic', 'finance'].includes(id)) return 'data';
  if (['code', 'blueprint', 'legal', 'education'].includes(id)) return 'code';
  if (['hacker', 'cyber', 'media', 'health', 'creative'].includes(id)) return 'cyber';
  return 'default';
}

export function getCinematicProfile(themeId = '') {
  const key = getCinematicProfileKey(themeId);
  return CINEMATIC_PROFILES[key] || CINEMATIC_PROFILES.default;
}
