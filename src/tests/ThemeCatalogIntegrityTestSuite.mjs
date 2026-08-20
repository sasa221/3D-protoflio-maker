import { THEMES } from '../three/ProceduralTheme.js';
import { THEME_TIERS, canAccessTheme, getThemeTier } from '../config/ThemeTierConfig.js';
import { THEME_SCENE_CONFIG } from '../three/ThemeSceneConfig.js';

/**
 * Authoritative Locked Theme Specification
 */
export const APPROVED_THEMES = [
  // FREE (exactly 3)
  { id: 'code', name: 'Code Matrix', tier: 'free' },
  { id: 'creative', name: 'Liquid Prism', tier: 'free' },
  { id: 'minimal', name: 'Minimal Orbit', tier: 'free' },

  // PRO (exactly 7)
  { id: 'hacker', name: 'Cyber Command', tier: 'pro' },
  { id: 'data', name: 'Data Galaxy', tier: 'pro' },
  { id: 'blueprint', name: 'Blueprint CAD', tier: 'pro' },
  { id: 'media', name: 'Aperture Cinema', tier: 'pro' },
  { id: 'health', name: 'BioSphere DNA', tier: 'pro' },
  { id: 'marketing', name: 'Growth Reactor', tier: 'pro' },
  { id: 'education', name: 'Knowledge Nebula', tier: 'pro' },

  // PREMIUM (exactly 5)
  { id: 'cosmic', name: 'Cosmic Elite', tier: 'premium' },
  { id: 'finance', name: 'Golden Markets', tier: 'premium' },
  { id: 'legal', name: 'Justice Grid', tier: 'premium' },
  { id: 'obsidian', name: 'Obsidian Luxe', tier: 'premium' },
  { id: 'quantum', name: 'Quantum Aurora', tier: 'premium' }
];

export function runThemeCatalogIntegrityTestSuite() {
  console.log('============================================================');
  console.log('  THEME CATALOG INTEGRITY & REGRESSION TEST SUITE');
  console.log('============================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  // 1. Total Theme Count Assertion
  const proceduralKeys = Object.keys(THEMES);
  const tierKeys = Object.keys(THEME_TIERS);
  const sceneKeys = Object.keys(THEME_SCENE_CONFIG);

  assert(proceduralKeys.length === 15, `ProceduralTheme.js defines exactly 15 themes (found ${proceduralKeys.length})`);
  assert(tierKeys.length === 15, `ThemeTierConfig.js defines exactly 15 themes (found ${tierKeys.length})`);
  assert(sceneKeys.length === 15, `ThemeSceneConfig.js defines exactly 15 themes (found ${sceneKeys.length})`);
  assert(APPROVED_THEMES.length === 15, `Locked specification defines exactly 15 themes (found ${APPROVED_THEMES.length})`);

  // 2. Tier Count Distribution
  const freeThemes = APPROVED_THEMES.filter(t => t.tier === 'free');
  const proThemes = APPROVED_THEMES.filter(t => t.tier === 'pro');
  const premiumThemes = APPROVED_THEMES.filter(t => t.tier === 'premium');

  assert(freeThemes.length === 3, `Free tier has exactly 3 themes (found ${freeThemes.length})`);
  assert(proThemes.length === 7, `Pro tier has exactly 7 themes (found ${proThemes.length})`);
  assert(premiumThemes.length === 5, `Premium tier has exactly 5 themes (found ${premiumThemes.length})`);

  // 3. Exact ID, Name, Tier, and Registry Matching
  APPROVED_THEMES.forEach(spec => {
    const proceduralTheme = THEMES[spec.id];
    assert(Boolean(proceduralTheme), `Theme [${spec.id}] exists in ProceduralTheme registry`);
    assert(proceduralTheme?.name === spec.name, `Theme [${spec.id}] name is strictly "${spec.name}" (got "${proceduralTheme?.name}")`);
    
    const assignedTier = THEME_TIERS[spec.id];
    assert(assignedTier === spec.tier, `Theme [${spec.id}] tier in ThemeTierConfig is "${spec.tier}" (got "${assignedTier}")`);

    const sceneConfig = THEME_SCENE_CONFIG[spec.id];
    assert(Boolean(sceneConfig), `Theme [${spec.id}] exists in ThemeSceneConfig`);
  });

  // 4. Access Control Checks
  assert(canAccessTheme('free', 'code') === true, 'Free user can access "code"');
  assert(canAccessTheme('free', 'creative') === true, 'Free user can access "creative"');
  assert(canAccessTheme('free', 'minimal') === true, 'Free user can access "minimal"');
  assert(canAccessTheme('free', 'hacker') === false, 'Free user is locked out of Pro theme "hacker"');
  assert(canAccessTheme('free', 'cosmic') === false, 'Free user is locked out of Premium theme "cosmic"');

  assert(canAccessTheme('pro', 'code') === true, 'Pro user can access Free theme "code"');
  assert(canAccessTheme('pro', 'hacker') === true, 'Pro user can access Pro theme "hacker"');
  assert(canAccessTheme('pro', 'cosmic') === false, 'Pro user is locked out of Premium theme "cosmic"');

  assert(canAccessTheme('premium', 'code') === true, 'Premium user can access Free theme "code"');
  assert(canAccessTheme('premium', 'hacker') === true, 'Premium user can access Pro theme "hacker"');
  assert(canAccessTheme('premium', 'cosmic') === true, 'Premium user can access Premium theme "cosmic"');

  // 5. Check no unapproved themes exist in registries
  const unapprovedNames = [
    'Knowledge Matrix',
    'Quantum Void',
    'Neon Syndicate',
    'HyperDrive',
    'Chrono Trigger',
    'Obsidian Mirror'
  ];

  unapprovedNames.forEach(badName => {
    const foundInProcedural = Object.values(THEMES).some(t => t.name === badName);
    assert(!foundInProcedural, `Unapproved theme "${badName}" does NOT exist in ProceduralTheme registry`);
  });

  console.log(`\n============================================================`);
  console.log(`  THEME CATALOG SUITE RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('============================================================\n');

  if (failed > 0) {
    throw new Error(`Theme catalog regression test suite failed with ${failed} errors.`);
  }

  return { passed, failed };
}

// Self-run when executed directly via node
if (process.argv[1]?.endsWith('ThemeCatalogIntegrityTestSuite.mjs')) {
  runThemeCatalogIntegrityTestSuite();
}
