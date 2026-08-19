/**
 * Phase8AEntitlementTestSuite.js
 * Comprehensive entitlement, abuse prevention, and security tests for Phase 8A monetization.
 * Tests are pure-logic unit tests that can run in Node.js without Supabase.
 * They validate the EntitlementService, UsageLimitService, ThemeTierConfig, and PlanConfig.
 */

import { EntitlementService, CAPABILITIES, PLAN_CONFIG } from '../services/EntitlementService.js';
import { UsageLimitService } from '../services/UsageLimitService.js';
import { PLANS, PLAN_IDS, SUBSCRIPTION_STATUSES, GROUP_SEAT_PRICING, GROUP_SEAT_MIN, GROUP_SEAT_MAX, KEEP_IT_LIVE, HOSTING_GRACE_PERIOD_DAYS, APPROVED_PRODUCT_CONFIG, getPlanConfig, formatPrice, getGroupPrice, AWAITING_APPROVAL } from '../config/PlanConfig.js';
import { canAccessTheme, getThemeTier, getThemesByTier, getThemeBadge, THEME_TIERS } from '../config/ThemeTierConfig.js';
import { FEATURE_FLAGS, isFeatureEnabled, isServerFeatureEnabled } from '../config/FeatureFlags.js';

// ─── TEST HARNESS ───────────────────────────────
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failures = [];

function assert(condition, description) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✅ ${description}`);
  } else {
    failedTests++;
    failures.push(description);
    console.log(`  ❌ FAIL: ${description}`);
  }
}

function section(name) {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  ${name}`);
  console.log('═'.repeat(60));
}

// ─── PLAN CONFIG TESTS ──────────────────────────
section('PLAN CONFIG — Structure & Prices');

assert(Object.keys(PLANS).length === 4, '4 plans defined (free, pro, premium, premium_group)');
assert(PLANS.free.priceMonthlyEGP === 0, 'Free plan is 0 EGP');
assert(PLANS.pro.priceMonthlyEGP === 600, 'Pro plan is 600 EGP/month');
assert(PLANS.premium.priceMonthlyEGP === 1000, 'Premium plan is 1,000 EGP/month');
assert(PLANS.free.currency === 'EGP', 'Currency is EGP');
assert(PLANS.free.hosted === false, 'Free plan is NOT hosted');
assert(PLANS.pro.hosted === true, 'Pro plan IS hosted');
assert(PLANS.premium.hosted === true, 'Premium plan IS hosted');
assert(PLANS.premium_group.hosted === true, 'Premium Group plan IS hosted');

section('PLAN CONFIG — Portfolio Policies');

assert(PLANS.free.portfolioPolicy === 'one_lifetime_slot', 'Free: one_lifetime_slot policy');
assert(PLANS.pro.portfolioPolicy === 'one_persistent_slot', 'Pro: one_persistent_slot policy');
assert(PLANS.premium.portfolioPolicy === 'rolling_cooldown', 'Premium: rolling_cooldown policy');
assert(PLANS.premium.portfolioCreationCooldownDays === 7, 'Premium: 7-day cooldown');
assert(PLANS.premium_group.portfolioPolicy === 'rolling_cooldown', 'Premium Group: rolling_cooldown policy');

section('PLAN CONFIG — Group Pricing');

assert(GROUP_SEAT_PRICING[2] === 1800, 'Group 2 users = 1,800 EGP');
assert(GROUP_SEAT_PRICING[3] === 2550, 'Group 3 users = 2,550 EGP');
assert(GROUP_SEAT_PRICING[4] === 3200, 'Group 4 users = 3,200 EGP');
assert(GROUP_SEAT_PRICING[5] === 3750, 'Group 5 users = 3,750 EGP');
assert(GROUP_SEAT_MIN === 2, 'Min seats = 2');
assert(GROUP_SEAT_MAX === 5, 'Max seats = 5');

section('PLAN CONFIG — Keep It Live');

assert(KEEP_IT_LIVE.priceAnnualPerPortfolioEGP === 500, 'KIL: 500 EGP/year/portfolio');
assert(KEEP_IT_LIVE.hosted === true, 'KIL: hosted');
assert(KEEP_IT_LIVE.canEdit === false, 'KIL: cannot edit');
assert(KEEP_IT_LIVE.canCreate === false, 'KIL: cannot create');
assert(KEEP_IT_LIVE.canPublishNew === false, 'KIL: cannot publish new');
assert(KEEP_IT_LIVE.canChangeTheme === false, 'KIL: cannot change theme');

section('PLAN CONFIG — Approved Decisions');

assert(APPROVED_PRODUCT_CONFIG.FREE_THEMES.length === 3, 'Approved: Exactly 3 Free themes');
assert(APPROVED_PRODUCT_CONFIG.PRO_THEMES.length === 7, 'Approved: Exactly 7 Pro themes');
assert(APPROVED_PRODUCT_CONFIG.PREMIUM_THEMES.length === 5, 'Approved: Exactly 5 Premium themes');
assert(PLANS.pro.capabilities.includes(CAPABILITIES.REMOVE_BRANDING) === false, 'Approved: Pro does not include remove_branding');
assert(PLANS.free.limits.jobMatchLifetimeQuota === 1, 'Approved: Free Job Match quota = 1 lifetime analysis');
assert(HOSTING_GRACE_PERIOD_DAYS === 7, 'Approved: Hosting grace period = 7 days');

section('PLAN CONFIG — Utility Functions');

assert(getPlanConfig('free').id === 'free', 'getPlanConfig("free") returns Free plan');
assert(getPlanConfig('pro').id === 'pro', 'getPlanConfig("pro") returns Pro plan');
assert(getPlanConfig('garbage').id === 'free', 'getPlanConfig("garbage") falls back to Free');
assert(formatPrice(600, '/month') === '600 EGP/month', 'formatPrice correctly formats');
assert(formatPrice(0) === '0 EGP', 'formatPrice handles zero');
assert(getGroupPrice(2) === 1500, 'getGroupPrice(2) = 1500');
assert(getGroupPrice(10) === null, 'getGroupPrice(10) = null (invalid)');

// ─── THEME TIER CONFIG TESTS ────────────────────
section('THEME TIER CONFIG — 15 Themes Assignments & Counts');

const freeThemes = getThemesByTier('free');
const proThemes = getThemesByTier('pro');
const premiumThemes = getThemesByTier('premium');
const totalThemes = freeThemes.length + proThemes.length + premiumThemes.length;

assert(totalThemes === 15, `Total themes = 15 (got ${totalThemes})`);
assert(freeThemes.length === 3, `Free: exactly 3 themes (got ${freeThemes.length})`);
assert(proThemes.length === 7, `Pro-exclusive: exactly 7 themes (got ${proThemes.length})`);
assert(premiumThemes.length === 5, `Premium-exclusive: exactly 5 themes (got ${premiumThemes.length})`);

assert(freeThemes.includes('code'), 'code is Free');
assert(freeThemes.includes('creative'), 'creative is Free');
assert(freeThemes.includes('minimal'), 'minimal is Free');

assert(proThemes.includes('hacker'), 'hacker is Pro');
assert(proThemes.includes('data'), 'data is Pro');
assert(proThemes.includes('blueprint'), 'blueprint is Pro');
assert(proThemes.includes('media'), 'media is Pro');
assert(proThemes.includes('health'), 'health is Pro');
assert(proThemes.includes('marketing'), 'marketing is Pro');
assert(proThemes.includes('education'), 'education is Pro');

assert(premiumThemes.includes('cosmic'), 'cosmic is Premium');
assert(premiumThemes.includes('finance'), 'finance is Premium');
assert(premiumThemes.includes('legal'), 'legal is Premium');
assert(premiumThemes.includes('obsidian'), 'obsidian is Premium');
assert(premiumThemes.includes('quantum'), 'quantum is Premium');

section('THEME TIER CONFIG — Exhaustive Individual Theme Gating (15 x 3 = 45 checks)');

const all15Themes = [
  'code', 'creative', 'minimal',
  'hacker', 'data', 'blueprint', 'media', 'health', 'marketing', 'education',
  'cosmic', 'finance', 'legal', 'obsidian', 'quantum'
];

// Free tier access: exactly 3 allowed (3/15), 12 denied
all15Themes.forEach(id => {
  const expected = ['code', 'creative', 'minimal'].includes(id);
  assert(canAccessTheme('free', id) === expected, `Free plan access to ${id}: ${expected ? 'ALLOW' : 'DENY'}`);
});

// Pro tier access: exactly 10 allowed (10/15) (3 free + 7 pro), 5 premium denied
all15Themes.forEach(id => {
  const expected = !['cosmic', 'finance', 'legal', 'obsidian', 'quantum'].includes(id);
  assert(canAccessTheme('pro', id) === expected, `Pro plan access to ${id}: ${expected ? 'ALLOW' : 'DENY'}`);
});

// Premium tier access: ALL 15 allowed (15/15)
all15Themes.forEach(id => {
  assert(canAccessTheme('premium', id) === true, `Premium plan access to ${id}: ALLOW`);
});

section('THEME TIER CONFIG — Badge Display');

assert(getThemeBadge('minimal') === null, 'Free theme minimal has no badge');
assert(getThemeBadge('code') === null, 'Free theme code has no badge');
assert(getThemeBadge('creative') === null, 'Free theme creative has no badge');
assert(getThemeBadge('hacker') === 'PRO', 'Pro theme hacker badge = "PRO"');
assert(getThemeBadge('obsidian') === 'PREMIUM', 'Premium theme obsidian badge = "PREMIUM"');
assert(getThemeBadge('quantum') === 'PREMIUM', 'Premium theme quantum badge = "PREMIUM"');

// ─── ENTITLEMENT SERVICE TESTS ──────────────────
section('ENTITLEMENT SERVICE — Free Plan');

const freeUser = new EntitlementService();
freeUser.setSubscription({ plan_id: 'free', status: 'active' });

assert(freeUser.getPlanId() === 'free', 'Free user getPlanId() = free');
assert(freeUser.getEffectivePlanId() === 'free', 'Free user effective plan = free');
assert(freeUser.can(CAPABILITIES.CV_IMPORT) === true, 'Free can CV import');
assert(freeUser.can(CAPABILITIES.HTML_EXPORT) === true, 'Free can HTML export');
assert(freeUser.can(CAPABILITIES.PDF_EXPORT) === false, 'Free CANNOT PDF export');
assert(freeUser.can(CAPABILITIES.PUBLISH_HOSTED) === false, 'Free CANNOT publish hosted');
assert(freeUser.can(CAPABILITIES.CONTINUOUS_EDIT) === false, 'Free CANNOT continuous edit');
assert(freeUser.can(CAPABILITIES.CUSTOM_DOMAIN) === false, 'Free CANNOT custom domain');
assert(freeUser.can(CAPABILITIES.BASIC_ANALYTICS) === false, 'Free CANNOT basic analytics');
assert(freeUser.can(CAPABILITIES.ADVANCED_ANALYTICS) === false, 'Free CANNOT advanced analytics');
assert(freeUser.can(CAPABILITIES.JOB_MATCH) === false, 'Free CANNOT job match');
assert(freeUser.isActive() === true, 'Free user is always active');
assert(freeUser.getLimit('portfolios') === 1, 'Free limit: 1 portfolio');
assert(freeUser.getLimit('variants') === 1, 'Free limit: 1 variant');
assert(freeUser.getLimit('projects') === 5, 'Free limit: 5 projects');
assert(freeUser.getLimit('customDomains') === 0, 'Free limit: 0 custom domains');

section('ENTITLEMENT SERVICE — Free Finalization');

assert(freeUser.canEditPortfolio({ is_finalized: false }) === true, 'Free can edit non-finalized portfolio');
// Note: canEditPortfolio respects feature flag FREE_FINALIZATION_LOCK_ENABLED
// When flag is off (default), finalized portfolios are still editable
// When flag is on, finalized Free portfolios are locked

section('ENTITLEMENT SERVICE — Pro Plan');

const proUser = new EntitlementService();
proUser.setSubscription({ plan_id: 'pro', status: 'active' });

assert(proUser.getPlanId() === 'pro', 'Pro user getPlanId() = pro');
assert(proUser.can(CAPABILITIES.CV_IMPORT) === true, 'Pro can CV import');
assert(proUser.can(CAPABILITIES.HTML_EXPORT) === true, 'Pro can HTML export');
assert(proUser.can(CAPABILITIES.PDF_EXPORT) === true, 'Pro CAN PDF export');
assert(proUser.can(CAPABILITIES.PUBLISH_HOSTED) === true, 'Pro CAN publish hosted');
assert(proUser.can(CAPABILITIES.CONTINUOUS_EDIT) === true, 'Pro CAN continuous edit');
assert(proUser.can(CAPABILITIES.BASIC_ANALYTICS) === true, 'Pro CAN basic analytics');
assert(proUser.can(CAPABILITIES.JOB_MATCH) === true, 'Pro CAN job match');
assert(proUser.can(CAPABILITIES.CUSTOM_DOMAIN) === false, 'Pro CANNOT custom domain');
assert(proUser.can(CAPABILITIES.REMOVE_BRANDING) === false, 'Pro CANNOT remove branding (awaiting approval)');
assert(proUser.can(CAPABILITIES.ADVANCED_ANALYTICS) === false, 'Pro CANNOT advanced analytics');
assert(proUser.canUseTheme('cosmic') === true, 'Pro can use free theme (no paywall flag)');
assert(proUser.getLimit('portfolios') === 1, 'Pro limit: 1 portfolio');
assert(proUser.getLimit('variants') === 5, 'Pro limit: 5 variants');

section('ENTITLEMENT SERVICE — Premium Plan');

const premiumUser = new EntitlementService();
premiumUser.setSubscription({ plan_id: 'premium', status: 'active' });

assert(premiumUser.getPlanId() === 'premium', 'Premium getPlanId() = premium');
assert(premiumUser.can(CAPABILITIES.PUBLISH_HOSTED) === true, 'Premium CAN publish hosted');
assert(premiumUser.can(CAPABILITIES.CUSTOM_DOMAIN) === true, 'Premium CAN custom domain');
assert(premiumUser.can(CAPABILITIES.REMOVE_BRANDING) === true, 'Premium CAN remove branding');
assert(premiumUser.can(CAPABILITIES.ADVANCED_ANALYTICS) === true, 'Premium CAN advanced analytics');
assert(premiumUser.isUnlimited('portfolios'), 'Premium portfolios unlimited');
assert(premiumUser.isUnlimited('variants'), 'Premium variants unlimited');
assert(premiumUser.isUnlimited('projects'), 'Premium projects unlimited');
assert(premiumUser.getLimit('customDomains') === 3, 'Premium limit: 3 custom domains');
assert(premiumUser.getLimit('analyticsDays') === 365, 'Premium analytics: 365 days');

section('ENTITLEMENT SERVICE — Premium Group Member');

const groupMember = new EntitlementService();
groupMember.setSubscription(
  { plan_id: 'free', status: 'active' }, // raw subscription might be free
  { group_id: 'grp_test', role: 'member', status: 'active' }, // but group membership active
  []
);

assert(groupMember.getEffectivePlanId() === 'premium', 'Group member effective plan = premium');
assert(groupMember.can(CAPABILITIES.PUBLISH_HOSTED) === true, 'Group member CAN publish hosted');
assert(groupMember.can(CAPABILITIES.ADVANCED_ANALYTICS) === true, 'Group member CAN advanced analytics');
assert(groupMember.can(CAPABILITIES.CUSTOM_DOMAIN) === true, 'Group member CAN custom domain');

section('ENTITLEMENT SERVICE — Expired Subscription');

const expiredUser = new EntitlementService();
expiredUser.setSubscription({ plan_id: 'pro', status: 'expired' });

assert(expiredUser.getPlanId() === 'free', 'Expired pro -> effective free');
assert(expiredUser.can(CAPABILITIES.PUBLISH_HOSTED) === false, 'Expired CANNOT publish hosted');
assert(expiredUser.can(CAPABILITIES.PDF_EXPORT) === false, 'Expired CANNOT PDF export');
assert(expiredUser.can(CAPABILITIES.HTML_EXPORT) === true, 'Expired CAN still HTML export (free-level)');
assert(expiredUser.isExpired() === true, 'isExpired() = true');
assert(expiredUser.canEditPortfolio({}) === false, 'Expired CANNOT edit portfolio');

section('ENTITLEMENT SERVICE — Grace Period');

const graceUser = new EntitlementService();
graceUser.setSubscription({ plan_id: 'pro', status: 'grace' });

assert(graceUser.getPlanId() === 'pro', 'Grace user retains pro plan');
assert(graceUser.can(CAPABILITIES.PUBLISH_HOSTED) === true, 'Grace CAN publish hosted');
assert(graceUser.isActive() === true, 'Grace user is active');

section('ENTITLEMENT SERVICE — Canceling');

const cancelingUser = new EntitlementService();
cancelingUser.setSubscription({ plan_id: 'premium', status: 'canceling' });

assert(cancelingUser.getPlanId() === 'premium', 'Canceling user retains premium plan');
assert(cancelingUser.isActive() === true, 'Canceling user is active');
assert(cancelingUser.can(CAPABILITIES.ADVANCED_ANALYTICS) === true, 'Canceling CAN advanced analytics');

section('ENTITLEMENT SERVICE — Keep It Live');

const kilUser = new EntitlementService();
kilUser.setSubscription(
  { plan_id: 'pro', status: 'keep_it_live' },
  null,
  [{ portfolio_id: 'pf_1', status: 'active' }]
);

assert(kilUser.isKeepItLive() === true, 'KIL user isKeepItLive() = true');
assert(kilUser.getPlanId() === 'free', 'KIL user effective plan = free');
assert(kilUser.can(CAPABILITIES.CV_IMPORT) === true, 'KIL CAN CV import');
assert(kilUser.can(CAPABILITIES.HTML_EXPORT) === true, 'KIL CAN HTML export');
assert(kilUser.can(CAPABILITIES.PUBLISH_HOSTED) === false, 'KIL CANNOT publish hosted');
assert(kilUser.can(CAPABILITIES.CONTINUOUS_EDIT) === false, 'KIL CANNOT continuous edit');
assert(kilUser.canEditPortfolio({}) === false, 'KIL CANNOT edit portfolio');
assert(kilUser.canPublishHosted() === true, 'KIL canPublishHosted() = true when HOSTING_PAYWALL flag is OFF (default)');
assert(kilUser.hasKeepItLive('pf_1') === true, 'KIL has active entitlement for pf_1');
assert(kilUser.hasKeepItLive('pf_other') === false, 'KIL does NOT have entitlement for pf_other');

// ─── USAGE LIMIT SERVICE TESTS ──────────────────
section('USAGE LIMIT — Free Portfolio Creation');

// Create a fresh global entitlement state for each test
const freeUsage = new UsageLimitService();
const freeEnt = new EntitlementService();
freeEnt.setSubscription({ plan_id: 'free', status: 'active' });
// Note: globalUsageLimit reads from globalEntitlements, so we test the class directly

assert(freeUsage.canCreatePortfolio !== undefined, 'UsageLimitService has canCreatePortfolio method');

section('USAGE LIMIT — Free: First Portfolio');

// We need to set globalEntitlements for the UsageLimitService to read
import { globalEntitlements } from '../services/EntitlementService.js';
globalEntitlements.setSubscription({ plan_id: 'free', status: 'active' });

const freeAvail1 = freeUsage.getPortfolioCreationAvailability(0, 0, null);
assert(freeAvail1.allowed === true, 'Free: first portfolio allowed (0 total created)');

const freeAvail2 = freeUsage.getPortfolioCreationAvailability(0, 1, null);
assert(freeAvail2.allowed === false, 'Free: second portfolio DENIED (1 total created)');
assert(freeAvail2.reason.includes('Free'), 'Free denial message mentions Free plan');

section('USAGE LIMIT — Free: Start Over Abuse');

const freeAvailAbuse = freeUsage.getPortfolioCreationAvailability(0, 1, null);
assert(freeAvailAbuse.allowed === false, 'Free: "Start Over" (0 active, 1 total) DENIED — no exploit');

section('USAGE LIMIT — Pro Portfolio Creation');

globalEntitlements.setSubscription({ plan_id: 'pro', status: 'active' });

const proAvail1 = freeUsage.getPortfolioCreationAvailability(0, 0, null);
assert(proAvail1.allowed === true, 'Pro: first portfolio allowed');

const proAvail2 = freeUsage.getPortfolioCreationAvailability(1, 1, null);
assert(proAvail2.allowed === false, 'Pro: second portfolio DENIED (1 active)');

section('USAGE LIMIT — Pro: Persistent Slot & Abuse Prevention');

// Pro persistent slot: delete and recreate is DENIED (must edit/reset existing slot, cannot build for different people)
globalEntitlements.setSubscription({ plan_id: 'pro', status: 'active' });
const proRecreate = freeUsage.getPortfolioCreationAvailability(0, 1, null);
assert(proRecreate.allowed === false, 'Pro: Delete → Create new portfolio is DENIED (persistent slot)');

const proChurnAbuse = freeUsage.getPortfolioCreationAvailability(0, 5, null);
assert(proChurnAbuse.allowed === false, 'Pro: Repeated delete → create churn abuse is DENIED');

section('USAGE LIMIT — Premium Cooldown');

globalEntitlements.setSubscription({ plan_id: 'premium', status: 'active' });

const premAvail1 = freeUsage.getPortfolioCreationAvailability(3, 3, null);
assert(premAvail1.allowed === true, 'Premium: first create with no history allowed');

const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString();
const premAvailRecent = freeUsage.getPortfolioCreationAvailability(3, 3, oneMinuteAgo);
assert(premAvailRecent.allowed === false, 'Premium: create 1 minute after last = DENIED');

const sixDaysAgo = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString();
const premAvail6d = freeUsage.getPortfolioCreationAvailability(3, 3, sixDaysAgo);
assert(premAvail6d.allowed === false, 'Premium: create at Day 6 = DENIED');

const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000 - 1000).toISOString();
const premAvail7d = freeUsage.getPortfolioCreationAvailability(3, 3, sevenDaysAgo);
assert(premAvail7d.allowed === true, 'Premium: create at Day 7+ = ALLOWED');

section('USAGE LIMIT — Premium Deletion Does Not Reset Cooldown');

// Even if user deletes portfolio, cooldown is based on creation history not active count
const premAfterDelete = freeUsage.getPortfolioCreationAvailability(0, 5, oneMinuteAgo);
assert(premAfterDelete.allowed === false, 'Premium: deletion does NOT reset cooldown (lastCreatedAt still recent)');

section('USAGE LIMIT — Variants');

globalEntitlements.setSubscription({ plan_id: 'free', status: 'active' });
assert(freeUsage.canCreateVariant(0) === true, 'Free: first variant allowed');
assert(freeUsage.canCreateVariant(1) === false, 'Free: second variant DENIED (limit 1)');

globalEntitlements.setSubscription({ plan_id: 'pro', status: 'active' });
assert(freeUsage.canCreateVariant(4) === true, 'Pro: 5th variant allowed (limit 5)');
assert(freeUsage.canCreateVariant(5) === false, 'Pro: 6th variant DENIED');

globalEntitlements.setSubscription({ plan_id: 'premium', status: 'active' });
assert(freeUsage.canCreateVariant(100) === true, 'Premium: unlimited variants');

section('USAGE LIMIT — Custom Domains');

globalEntitlements.setSubscription({ plan_id: 'free', status: 'active' });
assert(freeUsage.canConnectCustomDomain(0) === false, 'Free: 0 custom domains allowed');

globalEntitlements.setSubscription({ plan_id: 'premium', status: 'active' });
assert(freeUsage.canConnectCustomDomain(2) === true, 'Premium: 3rd domain allowed');
assert(freeUsage.canConnectCustomDomain(3) === false, 'Premium: 4th domain DENIED');

// ─── SECURITY TESTS ────────────────────────────
section('SECURITY — Fake Plan Injection');

const fakePlanUser = new EntitlementService();
fakePlanUser.setSubscription({ plan_id: 'super_mega_plan', status: 'active' });

assert(fakePlanUser.getPlanId() === 'super_mega_plan', 'Fake plan stored but...');
assert(fakePlanUser.can(CAPABILITIES.PUBLISH_HOSTED) === false, 'Fake plan CANNOT publish (unknown plan has no capabilities)');
assert(fakePlanUser.can(CAPABILITIES.PDF_EXPORT) === false, 'Fake plan CANNOT PDF export');

section('SECURITY — Null/Undefined Subscription');

const nullUser = new EntitlementService();
nullUser.setSubscription(null);

assert(nullUser.getPlanId() === 'free', 'Null subscription defaults to free');
assert(nullUser.can(CAPABILITIES.HTML_EXPORT) === true, 'Null sub still gets free capabilities');
assert(nullUser.can(CAPABILITIES.PUBLISH_HOSTED) === false, 'Null sub CANNOT publish');

const undefinedUser = new EntitlementService();
undefinedUser.setSubscription(undefined);

assert(undefinedUser.getPlanId() === 'free', 'Undefined subscription defaults to free');

section('SECURITY — Status Manipulation');

const fakeActiveUser = new EntitlementService();
fakeActiveUser.setSubscription({ plan_id: 'premium', status: 'expired' });

assert(fakeActiveUser.getPlanId() === 'free', 'Expired premium resolves to free');
assert(fakeActiveUser.can(CAPABILITIES.ADVANCED_ANALYTICS) === false, 'Expired premium CANNOT advanced analytics');

section('SECURITY — Group Membership Spoofing');

const fakeGroupUser = new EntitlementService();
fakeGroupUser.setSubscription(
  { plan_id: 'free', status: 'active' },
  { group_id: 'grp_fake', role: 'member', status: 'removed' }, // removed membership
  []
);

assert(fakeGroupUser.getEffectivePlanId() === 'free', 'Removed group member stays free');

const pendingGroupUser = new EntitlementService();
pendingGroupUser.setSubscription(
  { plan_id: 'free', status: 'active' },
  { group_id: 'grp_test', role: 'member', status: 'pending' }, // pending status
  []
);

assert(pendingGroupUser.getEffectivePlanId() === 'free', 'Pending group member stays free');

section('SECURITY — Theme Access with Fake Tier');

assert(canAccessTheme('super_admin', 'health') === false, 'Unknown tier CANNOT access premium theme');
assert(getThemeTier('nonexistent_theme') === 'free', 'Unknown theme defaults to free tier');

// ─── FEATURE FLAG TESTS ────────────────────────
section('FEATURE FLAGS — Default State');

assert(FEATURE_FLAGS.MONETIZATION_UI_ENABLED === false, 'MONETIZATION_UI_ENABLED defaults to false');
assert(FEATURE_FLAGS.ENTITLEMENT_ENFORCEMENT_ENABLED === false, 'ENTITLEMENT_ENFORCEMENT_ENABLED defaults to false');
assert(FEATURE_FLAGS.FREE_FINALIZATION_LOCK_ENABLED === false, 'FREE_FINALIZATION_LOCK_ENABLED defaults to false');
assert(FEATURE_FLAGS.THEME_PAYWALL_ENABLED === false, 'THEME_PAYWALL_ENABLED defaults to false');
assert(FEATURE_FLAGS.HOSTING_PAYWALL_ENABLED === false, 'HOSTING_PAYWALL_ENABLED defaults to false');
assert(FEATURE_FLAGS.PRICING_PAGE_ENABLED === false, 'PRICING_PAGE_ENABLED defaults to false');
assert(FEATURE_FLAGS.GROUP_MANAGEMENT_ENABLED === false, 'GROUP_MANAGEMENT_ENABLED defaults to false');

// ─── BACKWARD COMPATIBILITY TESTS ──────────────
section('BACKWARD COMPATIBILITY');

assert(PLAN_CONFIG !== undefined, 'PLAN_CONFIG re-exported from EntitlementService');
assert(PLAN_CONFIG.free !== undefined, 'PLAN_CONFIG.free exists');
assert(PLAN_CONFIG.pro !== undefined, 'PLAN_CONFIG.pro exists');
assert(CAPABILITIES.CV_IMPORT === 'cv_import', 'CAPABILITIES enum values unchanged');

// ─── LEGACY USER IMPACT ────────────────────────
section('LEGACY USER IMPACT — Safety');

console.log('  ⚠️  LEGACY USER IMPACT: NOT VERIFIED');
console.log('  ⚠️  All enforcement flags default to FALSE');
console.log('  ⚠️  Existing users will NOT be affected until flags are enabled');
console.log('  ⚠️  When flags are enabled, all existing Free users will need migration analysis');

// ─── SUMMARY ────────────────────────────────────
section('TEST RESULTS');

console.log(`\n  Total:  ${totalTests}`);
console.log(`  Passed: ${passedTests}`);
console.log(`  Failed: ${failedTests}`);

if (failures.length > 0) {
  console.log('\n  FAILURES:');
  failures.forEach(f => console.log(`    ❌ ${f}`));
}

console.log(`\n  STATUS: ${failedTests === 0 ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}\n`);

if (failedTests > 0) process.exit(1);
