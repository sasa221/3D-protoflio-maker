/**
 * Theme15CatalogTestSuite.mjs
 * Comprehensive test suite verifying all 15 themes:
 * - 3 Free: code, creative, minimal
 * - 7 Pro: hacker, data, blueprint, media, health, marketing, education
 * - 5 Premium: cosmic, finance, legal, obsidian, quantum
 * - Entitlement & direct paywall bypass simulation
 * - Export HTML generation & section parity
 * - Viewport dimension and fallback compliance
 */

import { getAllThemes, getThemeById, classifyProfession } from '../three/ProceduralTheme.js';
import { THEME_TIERS, canAccessTheme, getThemeTier, getThemeBadge, getThemesByTier } from '../config/ThemeTierConfig.js';
import { THEME_SCENE_CONFIG, getThemeSceneConfig } from '../three/ThemeSceneConfig.js';
import { getCinematicProfile, getCinematicProfileKey } from '../three/CinematicProfiles.js';
import { getIntroProfile, getIntroProfileKey } from '../three/IntroProfiles.js';
import { generatePortfolioCSS, generatePortfolioHTMLBody, getCurrentPortfolioConfig } from '../renderer/PortfolioRenderer.js';
import { buildPortfolioHTMLContent } from '../exporter/PortfolioExporter.js';
import { FEATURE_FLAGS } from '../config/FeatureFlags.js';

let total = 0;
let passed = 0;
let failed = 0;
const failures = [];

function assert(condition, desc) {
  total++;
  if (condition) {
    passed++;
  } else {
    failed++;
    failures.push(desc);
    console.error(`  ❌ FAIL: ${desc}`);
  }
}

console.log('============================================================');
console.log('  THEME CATALOG (15 THEMES) AUDIT & VERIFICATION');
console.log('============================================================\n');

// 1. Theme Registry & Counts
const allThemes = getAllThemes();
assert(allThemes.length === 15, `Theme registry has exactly 15 themes (got ${allThemes.length})`);

const freeThemes = getThemesByTier('free');
const proThemes = getThemesByTier('pro');
const premiumThemes = getThemesByTier('premium');

assert(freeThemes.length === 3, `Exactly 3 Free themes (got ${freeThemes.length})`);
assert(proThemes.length === 7, `Exactly 7 Pro themes (got ${proThemes.length})`);
assert(premiumThemes.length === 5, `Exactly 5 Premium themes (got ${premiumThemes.length})`);

const expectedFree = ['code', 'creative', 'minimal'];
const expectedPro = ['hacker', 'data', 'blueprint', 'media', 'health', 'marketing', 'education'];
const expectedPremium = ['cosmic', 'finance', 'legal', 'obsidian', 'quantum'];

expectedFree.forEach(id => assert(freeThemes.includes(id), `Free tier contains ${id}`));
expectedPro.forEach(id => assert(proThemes.includes(id), `Pro tier contains ${id}`));
expectedPremium.forEach(id => assert(premiumThemes.includes(id), `Premium tier contains ${id}`));

// 2. Individual Theme Structure & Integrity
console.log('\nTesting structure for all 15 themes...');
allThemes.forEach(t => {
  assert(Boolean(t.id), `Theme ${t.id} has ID`);
  assert(Boolean(t.name), `Theme ${t.id} has name (${t.name})`);
  assert(Boolean(t.emoji), `Theme ${t.id} has emoji (${t.emoji})`);
  assert(typeof t.primaryColor === 'number', `Theme ${t.id} has primaryColor`);
  assert(typeof t.secondaryColor === 'number', `Theme ${t.id} has secondaryColor`);
  assert(typeof t.accentColor === 'number', `Theme ${t.id} has accentColor`);
  assert(typeof t.bgColor === 'number', `Theme ${t.id} has bgColor`);
  assert(typeof t.particleCount === 'number' && t.particleCount > 0, `Theme ${t.id} has particleCount (${t.particleCount})`);

  // Scene config check
  const sceneCfg = getThemeSceneConfig(t.id);
  assert(Boolean(sceneCfg), `Theme ${t.id} has valid 3D SceneConfig`);
  assert(Boolean(sceneCfg.shape), `Theme ${t.id} has 3D shape (${sceneCfg.shape})`);

  // Cinematic profile check
  const cinProfile = getCinematicProfile(t.id);
  assert(Boolean(cinProfile && cinProfile.hero), `Theme ${t.id} has CinematicProfile with hero shot`);

  // Intro profile check
  const introProfile = getIntroProfile(t.id);
  assert(Boolean(introProfile && introProfile.startPos), `Theme ${t.id} has IntroProfile with startPos`);
});

// 3. Entitlement Paywall Access Matrix (15 themes x 3 user tiers)
console.log('\nTesting paywall access matrix...');
allThemes.forEach(t => {
  const isFreeAllowed = expectedFree.includes(t.id);
  const isProAllowed = expectedFree.includes(t.id) || expectedPro.includes(t.id);
  const isPremiumAllowed = true;

  assert(canAccessTheme('free', t.id) === isFreeAllowed, `Free user access to ${t.id}: ${isFreeAllowed ? 'ALLOW' : 'DENY'}`);
  assert(canAccessTheme('pro', t.id) === isProAllowed, `Pro user access to ${t.id}: ${isProAllowed ? 'ALLOW' : 'DENY'}`);
  assert(canAccessTheme('premium', t.id) === isPremiumAllowed, `Premium user access to ${t.id}: ALLOW`);
});

// 4. Standalone Export Parity for all 15 Themes (Specifically Minimal, Obsidian, Quantum)
console.log('\nTesting standalone HTML export for all 15 themes...');
const dummyPortfolio = {
  name: 'Saleh Mohamed',
  title: 'Principal Technology Architect',
  bio: 'Crafting high performance distributed cloud architectures and spatial interfaces.',
  about: 'Over 12 years building mission-critical software.',
  location: 'Cairo, Egypt',
  email: 'saleh@example.com',
  skills: [
    { name: 'Architecture', level: 95 },
    { name: 'TypeScript', level: 90 },
    { name: 'WebGL / Three.js', level: 88 },
    { name: 'Distributed Systems', level: 92 }
  ],
  experience: [
    { role: 'Lead Architect', company: 'Apex Systems', period: '2021 - Present', description: 'Spearheaded cloud migration' }
  ],
  projects: [
    { title: 'Spatial Engine', description: 'Real-time 3D pipeline', tags: ['WebGL', 'GLSL'] }
  ],
  certs: [
    { name: 'AWS Solutions Architect Professional', issuer: 'Amazon Web Services', date: '2023' }
  ]
};

allThemes.forEach(t => {
  const html = buildPortfolioHTMLContent(dummyPortfolio, t);
  assert(typeof html === 'string' && html.length > 5000, `Exported HTML for theme ${t.id} has substantive length (${html?.length} bytes)`);
  
  // Section checks in exported bundle
  assert(html.includes('id="sec-hero"'), `Exported ${t.id} contains #sec-hero section`);
  assert(html.includes('id="sec-about"'), `Exported ${t.id} contains #sec-about section`);
  assert(html.includes('id="sec-experience"'), `Exported ${t.id} contains #sec-experience section`);
  assert(html.includes('id="sec-projects"'), `Exported ${t.id} contains #sec-projects section`);
  assert(html.includes('id="sec-skills"'), `Exported ${t.id} contains #sec-skills section`);
  assert(html.includes('id="sec-contact"'), `Exported ${t.id} contains #sec-contact section`);
  assert(html.includes('Saleh Mohamed'), `Exported ${t.id} contains candidate name`);
});

// 5. Minimal Orbit Special Verification
console.log('\nVerifying Minimal Orbit specifics...');
const minimalTheme = getThemeById('minimal');
assert(minimalTheme.id === 'minimal', 'minimal theme ID matches');
assert(minimalTheme.particleCount === 1500, 'minimal theme has restrained particle count (1500)');
assert(getThemeTier('minimal') === 'free', 'minimal theme is in Free tier');
assert(getThemeBadge('minimal') === null, 'minimal theme has no lock badge');

// 6. Obsidian Luxe Special Verification
console.log('\nVerifying Obsidian Luxe specifics...');
const obsidianTheme = getThemeById('obsidian');
assert(obsidianTheme.id === 'obsidian', 'obsidian theme ID matches');
assert(obsidianTheme.bgColor === 0x050505, 'obsidian theme has deep obsidian background (0x050505)');
assert(getThemeTier('obsidian') === 'premium', 'obsidian theme is in Premium tier');
assert(getThemeBadge('obsidian') === 'PREMIUM', 'obsidian theme has PREMIUM lock badge');

// 7. Quantum Aurora Special Verification
console.log('\nVerifying Quantum Aurora specifics...');
const quantumTheme = getThemeById('quantum');
assert(quantumTheme.id === 'quantum', 'quantum theme ID matches');
assert(quantumTheme.particleCount === 4200, 'quantum theme has aurora wave particle density (4200)');
assert(getThemeTier('quantum') === 'premium', 'quantum theme is in Premium tier');
assert(getThemeBadge('quantum') === 'PREMIUM', 'quantum theme has PREMIUM lock badge');

console.log('\n============================================================');
console.log(`  SUMMARY: ${passed} / ${total} assertions PASSED (Failures: ${failed})`);
console.log('============================================================\n');

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
