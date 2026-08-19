import assert from 'node:assert/strict';
import { EntitlementService } from '../services/EntitlementService.js';
import { UsageLimitService } from '../services/UsageLimitService.js';
import { PLANS, PLAN_IDS, formatPrice } from '../config/PlanConfig.js';
import { canAccessTheme, getThemeTier, THEME_TIERS } from '../config/ThemeTierConfig.js';

console.log('============================================================');
console.log('  PUBLISH WORKSPACE & COMMERCIAL ENTITLEMENT TEST SUITE');
console.log('============================================================\n');

let passed = 0;
let failed = 0;

function check(name, condition) {
  try {
    assert.ok(condition, name);
    console.log(`  ✅ PASS: ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${name} -> ${err.message}`);
    failed++;
  }
}

// ─────────────────────────────────────────────────────────────
// 1. FREE USER ENTITLEMENT & PUBLISH RULES
// ─────────────────────────────────────────────────────────────
console.log('1. Testing Free User Commercial Invariants...');

const freeEntitlements = new EntitlementService();
freeEntitlements.setSubscription({ plan_id: 'free', status: 'active' });

check('Free effective plan is free', freeEntitlements.getEffectivePlanId() === 'free');
check('Free plan cannot publish hosted', !freeEntitlements.can('publish_hosted'));
check('Free plan cannot use custom domain', !freeEntitlements.can('custom_domain'));
check('Free plan cannot remove branding', !freeEntitlements.can('remove_branding'));
check('Free plan exports limit is exactly 1 per month', freeEntitlements.getLimit('exportsPerMonth') === 1);
check('Free plan max portfolios is 1', freeEntitlements.getLimit('portfolios') === 1);

// Usage limit calculation checks
const usageLimit = new UsageLimitService();
check('Free user with 0 exports has 1 remaining', usageLimit.getRemainingExports(0) === 1);
check('Free user with 0 exports can export HTML', usageLimit.canExportHTML(0) === true);
check('Free user with 1 export has 0 remaining', usageLimit.getRemainingExports(1) === 0);
check('Free user with 1 export cannot export HTML', usageLimit.canExportHTML(1) === false);
check('Free user export calculation never returns Infinity', Number.isFinite(usageLimit.getRemainingExports(0)));

// ─────────────────────────────────────────────────────────────
// 2. PRO USER ENTITLEMENT & PUBLISH RULES
// ─────────────────────────────────────────────────────────────
console.log('\n2. Testing Pro User Publishing & Export Invariants...');

const proEntitlements = new EntitlementService();
proEntitlements.setSubscription({ plan_id: 'pro', status: 'active' });

check('Pro effective plan is pro', proEntitlements.getEffectivePlanId() === 'pro');
check('Pro plan can publish hosted', proEntitlements.can('publish_hosted'));
check('Pro plan can continuous edit', proEntitlements.can('continuous_edit'));
check('Pro plan has unlimited HTML exports (-1 limit)', proEntitlements.getLimit('exportsPerMonth') === -1);
check('Pro plan price is exactly 600 EGP', PLANS.pro.priceMonthlyEGP === 600);

// ─────────────────────────────────────────────────────────────
// 3. PREMIUM & PREMIUM GROUP INVARIANTS
// ─────────────────────────────────────────────────────────────
console.log('\n3. Testing Premium & Premium Group Invariants...');

const premiumEntitlements = new EntitlementService();
premiumEntitlements.setSubscription({ plan_id: 'premium', status: 'active' });

check('Premium effective plan is premium', premiumEntitlements.getEffectivePlanId() === 'premium');
check('Premium plan can publish hosted', premiumEntitlements.can('publish_hosted'));
check('Premium plan can use custom domain', premiumEntitlements.can('custom_domain'));
check('Premium plan can remove branding', premiumEntitlements.can('remove_branding'));
check('Premium plan price is exactly 1000 EGP', PLANS.premium.priceMonthlyEGP === 1000);

const groupMemberEntitlements = new EntitlementService();
groupMemberEntitlements.setSubscription(
  { plan_id: 'free', status: 'active' },
  { status: 'active', role: 'member', group_id: 'grp_123' }
);

check('Active group member resolves to premium effective plan', groupMemberEntitlements.getEffectivePlanId() === 'premium');
check('Group member inherits custom domain capability', groupMemberEntitlements.can('custom_domain'));
check('Group member inherits publish hosted capability', groupMemberEntitlements.can('publish_hosted'));

// ─────────────────────────────────────────────────────────────
// 4. KEEP IT LIVE & GRANDFATHERED STATES
// ─────────────────────────────────────────────────────────────
console.log('\n4. Testing Keep It Live & Grandfathered States...');

const kilEntitlements = new EntitlementService();
kilEntitlements.setSubscription({ plan_id: 'free', status: 'keep_it_live' });

check('Keep It Live status detected', kilEntitlements.isKeepItLive() === true);
check('Keep It Live cannot publish new hosted portfolios', kilEntitlements.canPublishHosted() === false);

const expiredEntitlements = new EntitlementService();
expiredEntitlements.setSubscription({
  plan_id: 'pro',
  status: 'expired',
  current_period_end: new Date(Date.now() - 86400000).toISOString()
});

check('Expired Pro plan falls back to free effective plan', expiredEntitlements.getEffectivePlanId() === 'free');
check('Expired Pro plan cannot publish hosted', !expiredEntitlements.can('publish_hosted'));

// ─────────────────────────────────────────────────────────────
// 5. THEME CATALOG VISIBILITY (15 THEMES)
// ─────────────────────────────────────────────────────────────
console.log('\n5. Testing 15-Theme Catalog Visibility & Tier Hierarchy...');

const allThemeIds = Object.keys(THEME_TIERS);
check('Total theme descriptors count is exactly 15', allThemeIds.length === 15);

const freeThemes = allThemeIds.filter(id => getThemeTier(id) === 'free');
const proThemes = allThemeIds.filter(id => getThemeTier(id) === 'pro');
const premiumThemes = allThemeIds.filter(id => getThemeTier(id) === 'premium');

check('Exactly 3 themes are Free', freeThemes.length === 3);
check('Exactly 7 themes are Pro', proThemes.length === 7);
check('Exactly 5 themes are Premium', premiumThemes.length === 5);

check('Free tier can access Free themes', freeThemes.every(t => canAccessTheme('free', t)));
check('Free tier cannot access Pro themes', proThemes.every(t => !canAccessTheme('free', t)));
check('Free tier cannot access Premium themes', premiumThemes.every(t => !canAccessTheme('free', t)));

check('Pro tier can access Free and Pro themes (10 total)', [...freeThemes, ...proThemes].every(t => canAccessTheme('pro', t)));
check('Pro tier cannot access Premium themes', premiumThemes.every(t => !canAccessTheme('pro', t)));

check('Premium tier can access all 15 themes', allThemeIds.every(t => canAccessTheme('premium', t)));

console.log('\n============================================================');
console.log(`  SUMMARY: ${passed} / ${passed + failed} assertions PASSED (Failures: ${failed})`);
console.log('============================================================\n');

if (failed > 0) {
  process.exit(1);
}
