/**
 * ThemeSceneConfig.js
 * Single Source of Truth for Theme-Level 3D Objects & Particle Configurations.
 * Shared across Studio HyperEngine and Exported Standalone Bundles.
 */

export const THEME_SCENE_CONFIG = {
  code: {
    shape: 'octahedron',
    particleCount: 3000,
    particleMode: 'cube',
    terminalPanels: 6,
    neonGrid: true,
    wireframe: true
  },
  hacker: {
    shape: 'icosahedron',
    particleCount: 2500,
    particleMode: 'hex',
    radar: true,
    dataStreams: 25,
    wireframe: true
  },
  data: {
    shape: 'sphere',
    particleCount: 4000,
    particleMode: 'sphere',
    barChart: true,
    orbitalRings: 3,
    wireframe: true
  },
  blueprint: {
    shape: 'box',
    particleCount: 2000,
    particleMode: 'point',
    blueprintGrid: true,
    wireframeStructures: true,
    wireframe: true
  },
  creative: {
    shape: 'sphere',
    particleCount: 3500,
    particleMode: 'rainbow',
    glassPrisms: 8,
    morphCore: true,
    wireframe: false
  },
  media: {
    shape: 'torus',
    particleCount: 2800,
    particleMode: 'ring',
    apertureBlades: 6,
    orbitalRings: 5,
    wireframe: true
  },
  health: {
    shape: 'sphere',
    particleCount: 2500,
    particleMode: 'sphere',
    dnaHelix: true,
    wireframe: true
  },
  marketing: {
    shape: 'dodecahedron',
    particleCount: 3200,
    particleMode: 'sphere',
    barChart: true,
    orbitalRings: 4,
    wireframe: true
  },
  finance: {
    shape: 'sphere',
    particleCount: 4000,
    particleMode: 'sphere',
    barChart: true,
    orbitalRings: 3,
    wireframe: true
  },
  education: {
    shape: 'sphere',
    particleCount: 4500,
    particleMode: 'galaxy',
    orbitalRings: 3,
    wireframe: true
  },
  legal: {
    shape: 'box',
    particleCount: 2000,
    particleMode: 'point',
    blueprintGrid: true,
    wireframe: true
  },
  cosmic: {
    shape: 'sphere',
    particleCount: 5000,
    particleMode: 'galaxy',
    orbitalRings: 3,
    wireframe: true
  }
};

export function getThemeSceneConfig(themeId = '') {
  const id = (themeId || 'cosmic').toLowerCase();
  return THEME_SCENE_CONFIG[id] || THEME_SCENE_CONFIG.cosmic;
}
