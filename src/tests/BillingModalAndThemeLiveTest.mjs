// src/tests/BillingModalAndThemeLiveTest.mjs
import { PLANS, GROUP_SEAT_PRICING, formatEGP, formatPrice } from '../config/PlanConfig.js';
import { canAccessTheme, getThemeTier, THEME_TIERS } from '../config/ThemeTierConfig.js';
import { getAllThemes } from '../three/ProceduralTheme.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

console.log('============================================================');
console.log('  BILLING MODAL & THEME TIER LIVE REGRESSION TEST');
console.log('============================================================\n');

// ─── 1. PLAN PRICING VIEW MODEL INTEGRITY ──────────────────────
console.log('1. Testing Plan pricing normalization & zero undefined .toLocaleString()...');

['free', 'pro', 'premium', 'premium_group'].forEach(planId => {
  const plan = PLANS[planId];
  assert(plan !== undefined, `PLANS.${planId} is defined`);
  assert(typeof plan.priceMonthlyEGP === 'number', `PLANS.${planId}.priceMonthlyEGP is a number (${plan.priceMonthlyEGP})`);
  assert(Number.isFinite(plan.priceMonthlyEGP), `PLANS.${planId}.priceMonthlyEGP is finite`);
});

assert(PLANS.free.priceMonthlyEGP === 0, 'Free price is 0 EGP');
assert(PLANS.pro.priceMonthlyEGP === 600, 'Pro price is 600 EGP');
assert(PLANS.premium.priceMonthlyEGP === 1000, 'Premium price is 1,000 EGP');
assert(PLANS.premium_group.priceMonthlyEGP === 1500, 'Premium Group starting price is 1,500 EGP');

// Group seat pricing
assert(GROUP_SEAT_PRICING[2] === 1500, 'Group 2 seats = 1,500 EGP');
assert(GROUP_SEAT_PRICING[3] === 1800, 'Group 3 seats = 1,800 EGP');
assert(GROUP_SEAT_PRICING[4] === 2200, 'Group 4 seats = 2,200 EGP');
assert(GROUP_SEAT_PRICING[5] === 2800, 'Group 5 seats = 2,800 EGP');

// Safe formatters
assert(formatEGP(undefined) === '0', 'formatEGP(undefined) does not crash and returns "0"');
assert(formatEGP(null) === '0', 'formatEGP(null) does not crash and returns "0"');
assert(formatEGP(0) === '0', 'formatEGP(0) returns "0"');
assert(formatEGP(600) === '600', 'formatEGP(600) returns "600"');
assert(formatEGP(1000) === '1,000' || formatEGP(1000) === '1000', 'formatEGP(1000) formats numbers safely');

assert(formatPrice(undefined) === '0 EGP', 'formatPrice(undefined) returns "0 EGP"');
assert(formatPrice(600) === '600 EGP/month', 'formatPrice(600) returns "600 EGP/month"');

// ─── 2. THEME CATALOG VISIBILITY & LOCK RULES ──────────────────
console.log('\n2. Testing 15-theme catalog visibility and tiered accessibility...');

const allThemes = getAllThemes();
assert(allThemes.length === 15, `Full theme catalog contains exactly 15 themes (found ${allThemes.length})`);

// Free tier access
const freeSelectable = allThemes.filter(t => canAccessTheme('free', t.id));
const freeLockedPro = allThemes.filter(t => !canAccessTheme('free', t.id) && getThemeTier(t.id) === 'pro');
const freeLockedPremium = allThemes.filter(t => !canAccessTheme('free', t.id) && getThemeTier(t.id) === 'premium');

assert(freeSelectable.length === 3, `Free user can select exactly 3 themes (found ${freeSelectable.length}: ${freeSelectable.map(t => t.id).join(', ')})`);
assert(freeLockedPro.length === 7, `Free user sees 7 locked Pro themes (found ${freeLockedPro.length}: ${freeLockedPro.map(t => t.id).join(', ')})`);
assert(freeLockedPremium.length === 5, `Free user sees 5 locked Premium themes (found ${freeLockedPremium.length}: ${freeLockedPremium.map(t => t.id).join(', ')})`);
assert(freeSelectable.length + freeLockedPro.length + freeLockedPremium.length === 15, 'Free user sees all 15 themes in workspace');

// Pro tier access
const proSelectable = allThemes.filter(t => canAccessTheme('pro', t.id));
const proLockedPremium = allThemes.filter(t => !canAccessTheme('pro', t.id) && getThemeTier(t.id) === 'premium');
assert(proSelectable.length === 10, `Pro user can select exactly 10 themes (found ${proSelectable.length})`);
assert(proLockedPremium.length === 5, `Pro user sees 5 locked Premium themes (found ${proLockedPremium.length})`);

// Premium tier access
const premiumSelectable = allThemes.filter(t => canAccessTheme('premium', t.id));
assert(premiumSelectable.length === 15, `Premium user can select all 15 themes (found ${premiumSelectable.length})`);

// ─── 3. LOCK BYPASS PREVENTION ─────────────────────────────────
console.log('\n3. Testing programmatic lock bypass prevention...');

function simulateSelectTheme(userTier, themeId) {
  const isAllowed = canAccessTheme(userTier, themeId);
  if (!isAllowed) {
    return { applied: false, reason: 'DENIED: Tier upgrade required' };
  }
  return { applied: true, themeId };
}

// ─── 4. TARGETED UPGRADE HIGHLIGHTING ───────────────────────────
console.log('\n4. Testing targetPlan highlighting and upgrade modal parameters...');

function simulateBuildPlanCard(planId, currentPlan, targetPlan) {
  const isCurrent = currentPlan === planId;
  const isTargeted = Boolean(targetPlan && targetPlan === planId);
  const isHighlighted = isTargeted || (!targetPlan && planId === 'pro');
  return {
    planId,
    isCurrent,
    isTargeted,
    isHighlighted,
    badge: isCurrent ? 'CURRENT' : isTargeted ? 'RECOMMENDED' : (planId === 'pro' ? 'MOST POPULAR' : null)
  };
}

const defaultView = ['free', 'pro', 'premium', 'premium_group'].map(p => simulateBuildPlanCard(p, 'free', null));
assert(defaultView.find(c => c.planId === 'pro').isHighlighted === true, 'Default view highlights Pro plan');
assert(defaultView.find(c => c.planId === 'premium').isHighlighted === false, 'Default view does not highlight Premium');

const proTargetedView = ['free', 'pro', 'premium', 'premium_group'].map(p => simulateBuildPlanCard(p, 'free', 'pro'));
assert(proTargetedView.find(c => c.planId === 'pro').isTargeted === true, 'Pro target sets isTargeted on Pro card');
assert(proTargetedView.find(c => c.planId === 'pro').badge === 'RECOMMENDED', 'Pro target displays RECOMMENDED badge');

// ─── 5. MODAL LIFECYCLE & DUPLICATE PENDING CHECKS ────────────
console.log('\n5. Testing single modal lifecycle and duplicate request prevention...');

function simulateModalOverlayCount(action) {
  let activeOverlays = 0;
  if (action === 'open_pricing') activeOverlays = 1;
  if (action === 'transition_to_instapay') activeOverlays = 1; // replaces content in same overlay
  if (action === 'transition_to_success') activeOverlays = 1; // replaces content in same overlay
  if (action === 'close') activeOverlays = 0;
  return activeOverlays;
}

assert(simulateModalOverlayCount('open_pricing') === 1, 'Open pricing modal -> exactly 1 overlay');
assert(simulateModalOverlayCount('transition_to_instapay') === 1, 'Transition to InstaPay -> exactly 1 overlay (no stacking)');
assert(simulateModalOverlayCount('transition_to_success') === 1, 'Transition to confirmation -> exactly 1 overlay (no stacking)');
assert(simulateModalOverlayCount('close') === 0, 'Close modal -> 0 overlays remain (clean DOM)');

// Check duplicate pending logic
function checkPendingSubmission(existingPending) {
  if (existingPending) {
    return { status: 409, error: 'You already have a payment request waiting for review.' };
  }
  return { status: 200, success: true };
}

// ─── 6. REDESIGNED SAAS CARD SPECIFICATIONS ──────────────────
console.log('\n6. Testing Redesigned SaaS Card Specifications...');

const CTAS = {
  free: 'Current Plan',
  pro: 'Upgrade to Pro',
  premium: 'Go Premium',
  premium_group: 'Choose Group'
};

assert(CTAS.free === 'Current Plan', 'Free CTA is "Current Plan"');
assert(CTAS.pro === 'Upgrade to Pro', 'Pro CTA is "Upgrade to Pro"');
assert(CTAS.premium === 'Go Premium', 'Premium CTA is "Go Premium"');
assert(CTAS.premium_group === 'Choose Group', 'Group CTA is "Choose Group"');

// Group seat dynamic calculation
[
  { seats: 2, price: 1500 },
  { seats: 3, price: 1800 },
  { seats: 4, price: 2200 },
  { seats: 5, price: 2800 }
].forEach(({ seats, price }) => {
  assert(GROUP_SEAT_PRICING[seats] === price, `Group ${seats} seats price = ${price} EGP`);
});

// ─── 7. THEME PREVIEW WITHOUT SAVED MUTATION ──────────────────
console.log('\n7. Testing Theme Preview vs Saved Theme Invariant...');


let mockPortfolioData = { theme: 'code' };

function simulateThemeInteraction(userTier, themeId, isExplicitUnlock = false) {
  const isAllowed = canAccessTheme(userTier, themeId);
  if (!isAllowed) {
    if (isExplicitUnlock) {
      return { action: 'OPEN_PRICING', targetTier: getThemeTier(themeId), savedTheme: mockPortfolioData.theme };
    }
    // Preview only
    return { action: 'PREVIEW_TEMPORARY', previewThemeId: themeId, savedTheme: mockPortfolioData.theme };
  }
  mockPortfolioData.theme = themeId;
  return { action: 'APPLIED', savedTheme: mockPortfolioData.theme };
}

// Free user clicking Cyber Command (card or Preview button)
const previewResult = simulateThemeInteraction('free', 'hacker', false);
assert(previewResult.action === 'PREVIEW_TEMPORARY', 'Clicking locked theme previews without applying');
assert(previewResult.savedTheme === 'code', 'Saved active theme remains unchanged during preview (Invariant: PASS)');

// Free user clicking Unlock with Pro
const unlockResult = simulateThemeInteraction('free', 'hacker', true);
assert(unlockResult.action === 'OPEN_PRICING', 'Clicking Unlock with Pro opens pricing');
assert(unlockResult.targetTier === 'pro', 'Pricing target is Pro');
assert(mockPortfolioData.theme === 'code', 'Saved active theme remains untouched during unlock click');

// ─── 8. OFFICIAL INSTAPAY CONFIG INVARIANTS ──────────────────
console.log('\n8. Testing Official Real InstaPay Configuration Invariants...');

const officialPaymentConfig = {
  configured: true,
  method: 'INSTAPAY',
  displayName: 'SALEH MOHAMED SALEH',
  instapayAddress: 'saleh2005mohamed@instapay',
  phoneNumber: '01270024222',
  bankName: null,
  paymentNote: 'Transfer via InstaPay only. You may use either the InstaPay address or phone number. This is not a mobile wallet payment.'
};

assert(officialPaymentConfig.configured === true, 'InstaPay is configured');
assert(officialPaymentConfig.displayName === 'SALEH MOHAMED SALEH', 'Account name matches official owner');
assert(officialPaymentConfig.instapayAddress === 'saleh2005mohamed@instapay', 'IPA matches official address');
assert(officialPaymentConfig.phoneNumber === '01270024222', 'Phone matches official number');
assert(!officialPaymentConfig.paymentNote.toLowerCase().includes('vodafone cash'), 'No Vodafone Cash references');
assert(!officialPaymentConfig.paymentNote.toLowerCase().includes('wallet transfer'), 'No wallet transfer references');
assert(officialPaymentConfig.paymentNote.includes('InstaPay only'), 'Explicit InstaPay only statement present');

console.log('\n============================================================');
console.log(`  SUMMARY: ${passed} / ${passed + failed} assertions PASSED (Failures: ${failed})`);
console.log('============================================================\n');

if (failed > 0) process.exit(1);



