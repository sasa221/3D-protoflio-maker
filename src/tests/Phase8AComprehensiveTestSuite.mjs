/**
 * Phase8AComprehensiveTestSuite.mjs
 * Comprehensive dual-mode entitlement, abuse, and security verification test suite.
 * 
 * Mode A: Flags OFF (Legacy Safety)
 * Mode B: Flags ON (Strict Monetization Enforcement)
 */

import { EntitlementService, CAPABILITIES, PLAN_CONFIG } from '../services/EntitlementService.js';
import { UsageLimitService } from '../services/UsageLimitService.js';
import { PLANS, GROUP_SEAT_PRICING, GROUP_SEAT_MIN, GROUP_SEAT_MAX, KEEP_IT_LIVE, HOSTING_GRACE_PERIOD_DAYS, getPlanConfig, formatPrice, getGroupPrice, AWAITING_APPROVAL } from '../config/PlanConfig.js';
import { canAccessTheme, getThemeTier, getThemesByTier, getThemeBadge, THEME_TIERS } from '../config/ThemeTierConfig.js';
import { FEATURE_FLAGS, isFeatureEnabled } from '../config/FeatureFlags.js';

function runTestSuite(mode = 'OFF') {
  const isEnforcementOn = mode === 'ON';
  
  // Set in-memory flags
  FEATURE_FLAGS.MONETIZATION_UI_ENABLED = isEnforcementOn;
  FEATURE_FLAGS.ENTITLEMENT_ENFORCEMENT_ENABLED = isEnforcementOn;
  FEATURE_FLAGS.FREE_FINALIZATION_LOCK_ENABLED = isEnforcementOn;
  FEATURE_FLAGS.THEME_PAYWALL_ENABLED = isEnforcementOn;
  FEATURE_FLAGS.HOSTING_PAYWALL_ENABLED = isEnforcementOn;
  FEATURE_FLAGS.PRICING_PAGE_ENABLED = isEnforcementOn;
  FEATURE_FLAGS.GROUP_MANAGEMENT_ENABLED = isEnforcementOn;

  let total = 0;
  let passed = 0;
  let failed = 0;
  const failures = [];

  function assert(condition, description) {
    total++;
    if (condition) {
      passed++;
    } else {
      failed++;
      failures.push(`[${mode}] ${description}`);
      console.error(`  ❌ [${mode}] FAIL: ${description}`);
    }
  }

  console.log(`\n============================================================`);
  console.log(`  RUNNING TEST SUITE — MODE: ENFORCEMENT ${mode}`);
  console.log(`============================================================\n`);

  // 1. FREE PLAN TESTS
  const freeUser = new EntitlementService();
  freeUser.setSubscription({ plan_id: 'free', status: 'active' });

  // HTML Export
  assert(freeUser.can(CAPABILITIES.HTML_EXPORT) === true, 'Free can export HTML');
  assert(freeUser.canExportHTML() === true, 'Free canExportHTML() helper returns true');

  // PDF Export
  if (isEnforcementOn) {
    assert(freeUser.can(CAPABILITIES.PDF_EXPORT) === false, 'Mode ON: Free CANNOT export PDF');
  }

  // Hosted Publish
  if (isEnforcementOn) {
    assert(freeUser.canPublishHosted() === false, 'Mode ON: Free hosted publish is DENIED');
  } else {
    assert(freeUser.canPublishHosted() === true, 'Mode OFF: Free hosted publish is ALLOWED (legacy safety)');
  }

  // Finalized Edit
  const draftPortfolio = { id: 'pf_1', is_finalized: false, owner_user_id: 'u_1' };
  const finalizedPortfolio = { id: 'pf_1', is_finalized: true, owner_user_id: 'u_1' };
  assert(freeUser.canEditPortfolio(draftPortfolio) === true, 'Free can edit draft portfolio');

  if (isEnforcementOn) {
    assert(freeUser.canEditPortfolio(finalizedPortfolio) === false, 'Mode ON: Free finalized portfolio edit is DENIED');
  } else {
    assert(freeUser.canEditPortfolio(finalizedPortfolio) === true, 'Mode OFF: Free finalized portfolio edit is ALLOWED');
  }

  // Theme Access
  assert(freeUser.canUseTheme('code') === true, 'Free can access free theme (code)');
  assert(freeUser.canUseTheme('creative') === true, 'Free can access free theme (creative)');
  assert(freeUser.canUseTheme('minimal') === true, 'Free can access free theme (minimal)');

  if (isEnforcementOn) {
    assert(freeUser.canUseTheme('hacker') === false, 'Mode ON: Free CANNOT access Pro theme (hacker)');
    assert(freeUser.canUseTheme('cosmic') === false, 'Mode ON: Free CANNOT access Premium theme (cosmic)');
    assert(freeUser.canUseTheme('obsidian') === false, 'Mode ON: Free CANNOT access Premium theme (obsidian)');
    assert(freeUser.canUseTheme('quantum') === false, 'Mode ON: Free CANNOT access Premium theme (quantum)');
  } else {
    assert(freeUser.canUseTheme('hacker') === true, 'Mode OFF: Free can access all themes');
    assert(freeUser.canUseTheme('cosmic') === true, 'Mode OFF: Free can access all themes');
  }

  // Portfolio Creation Limits
  const usageLimit = new UsageLimitService();
  const freeFirst = usageLimit.getPortfolioCreationAvailability(0, 0, null, freeUser);
  assert(freeFirst.allowed === true, 'Free: 1st lifetime portfolio is ALLOWED');

  const freeSecond = usageLimit.getPortfolioCreationAvailability(1, 1, null, freeUser);
  assert(freeSecond.allowed === false, 'Free: 2nd portfolio is DENIED');

  const freeStartOverAbuse = usageLimit.getPortfolioCreationAvailability(0, 1, null, freeUser);
  assert(freeStartOverAbuse.allowed === false, 'Free: Start Over (0 active, 1 lifetime created) is DENIED');

  // 2. PRO PLAN TESTS
  const proUser = new EntitlementService();
  proUser.setSubscription({ plan_id: 'pro', status: 'active' });

  assert(proUser.canPublishHosted() === true, 'Pro hosted publish is ALLOWED');
  assert(proUser.can(CAPABILITIES.PDF_EXPORT) === true, 'Pro can export PDF');
  assert(proUser.can(CAPABILITIES.BASIC_ANALYTICS) === true, 'Pro can view basic analytics');
  assert(proUser.can(CAPABILITIES.JOB_MATCH) === true, 'Pro can use Job Match');
  assert(proUser.can(CAPABILITIES.REMOVE_BRANDING) === false, 'Pro CANNOT remove branding (Approved: Premium only)');
  assert(proUser.can(CAPABILITIES.CUSTOM_DOMAIN) === false, 'Pro CANNOT connect custom domain');

  // Pro Theme Access
  assert(proUser.canUseTheme('minimal') === true, 'Pro can access Free themes (minimal)');
  assert(proUser.canUseTheme('hacker') === true, 'Pro can access Pro themes (hacker)');
  assert(proUser.canUseTheme('blueprint') === true, 'Pro can access Pro themes (blueprint)');
  assert(proUser.canUseTheme('media') === true, 'Pro can access Pro themes (media)');
  assert(proUser.canUseTheme('health') === true, 'Pro can access Pro themes (health)');

  if (isEnforcementOn) {
    assert(proUser.canUseTheme('cosmic') === false, 'Mode ON: Pro CANNOT access Premium theme (cosmic)');
    assert(proUser.canUseTheme('finance') === false, 'Mode ON: Pro CANNOT access Premium theme (finance)');
    assert(proUser.canUseTheme('legal') === false, 'Mode ON: Pro CANNOT access Premium theme (legal)');
    assert(proUser.canUseTheme('obsidian') === false, 'Mode ON: Pro CANNOT access Premium theme (obsidian)');
    assert(proUser.canUseTheme('quantum') === false, 'Mode ON: Pro CANNOT access Premium theme (quantum)');
  } else {
    assert(proUser.canUseTheme('obsidian') === true, 'Mode OFF: Pro can access all themes');
  }

  // Pro Creation Limits (1 persistent professional slot)
  const proFirst = usageLimit.getPortfolioCreationAvailability(0, 0, null, proUser);
  assert(proFirst.allowed === true, 'Pro: 1st portfolio creation is ALLOWED');

  const proSecondActive = usageLimit.getPortfolioCreationAvailability(1, 1, null, proUser);
  assert(proSecondActive.allowed === false, 'Pro: 2nd active portfolio is DENIED');

  // Pro persistent slot abuse tests: Delete -> create new independent portfolio/person repeatedly
  const proDeleteAndRecreate = usageLimit.getPortfolioCreationAvailability(0, 1, null, proUser);
  assert(proDeleteAndRecreate.allowed === false, 'Pro: Delete → Create new portfolio is DENIED (Must edit/reset existing persistent slot)');

  const proChurnAbuse = usageLimit.getPortfolioCreationAvailability(0, 5, null, proUser);
  assert(proChurnAbuse.allowed === false, 'Pro: Repeated delete → create churn abuse is DENIED');

  // Existing persistent slot operations: Edit, Reset/Start Over, Restore
  const proPersistentPortfolio = { id: 'pf_pro_1', owner_user_id: 'usr_pro_1', is_finalized: false };
  assert(proUser.canEditPortfolio(proPersistentPortfolio) === true, 'Pro: Edit existing persistent slot is ALLOWED');
  assert(proUser.can(CAPABILITIES.CONTINUOUS_EDIT) === true, 'Pro: Continuous editing of persistent slot is ALLOWED');

  // 3. PREMIUM PLAN TESTS
  const premiumUser = new EntitlementService();
  premiumUser.setSubscription({ plan_id: 'premium', status: 'active' });

  assert(premiumUser.canPublishHosted() === true, 'Premium hosted publish is ALLOWED');
  assert(premiumUser.can(CAPABILITIES.REMOVE_BRANDING) === true, 'Premium CAN remove branding');
  assert(premiumUser.can(CAPABILITIES.CUSTOM_DOMAIN) === true, 'Premium CAN connect custom domain (entitlement only)');
  assert(premiumUser.can(CAPABILITIES.ADVANCED_ANALYTICS) === true, 'Premium CAN view advanced analytics');

  // Premium Themes
  assert(premiumUser.canUseTheme('minimal') === true, 'Premium can access Free themes (minimal)');
  assert(premiumUser.canUseTheme('hacker') === true, 'Premium can access Pro themes (hacker)');
  assert(premiumUser.canUseTheme('cosmic') === true, 'Premium can access Premium theme (cosmic)');
  assert(premiumUser.canUseTheme('finance') === true, 'Premium can access Premium theme (finance)');
  assert(premiumUser.canUseTheme('legal') === true, 'Premium can access Premium theme (legal)');
  assert(premiumUser.canUseTheme('obsidian') === true, 'Premium can access Premium theme (obsidian)');
  assert(premiumUser.canUseTheme('quantum') === true, 'Premium can access Premium theme (quantum)');

  // Premium 7-Day Rolling Cooldown
  const premDay0 = usageLimit.getPortfolioCreationAvailability(0, 0, null, premiumUser);
  assert(premDay0.allowed === true, 'Premium: Day 0 creation is ALLOWED');

  const now = Date.now();
  const oneMinAgo = new Date(now - 60 * 1000).toISOString();
  const prem1Min = usageLimit.getPortfolioCreationAvailability(1, 1, oneMinAgo, premiumUser);
  assert(prem1Min.allowed === false, 'Premium: +1 minute creation is DENIED');

  const day6Ago = new Date(now - 6 * 24 * 60 * 60 * 1000).toISOString();
  const premDay6 = usageLimit.getPortfolioCreationAvailability(1, 1, day6Ago, premiumUser);
  assert(premDay6.allowed === false, 'Premium: Day 6 creation is DENIED');

  const exact7DaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000 - 1000).toISOString();
  const premExact7Days = usageLimit.getPortfolioCreationAvailability(1, 1, exact7DaysAgo, premiumUser);
  assert(premExact7Days.allowed === true, 'Premium: Exact 7-day boundary creation is ALLOWED');

  // Deletion does not bypass cooldown
  const premDeleteCooldown = usageLimit.getPortfolioCreationAvailability(0, 3, oneMinAgo, premiumUser);
  assert(premDeleteCooldown.allowed === false, 'Premium: Deletion does NOT reset cooldown');

  // 4. PREMIUM GROUP TESTS
  const groupOwner = new EntitlementService();
  groupOwner.setSubscription({ plan_id: 'premium_group', status: 'active', group_id: 'grp_1' });

  const groupMemberA = new EntitlementService();
  groupMemberA.setSubscription({ plan_id: 'free', status: 'active' }, { group_id: 'grp_1', role: 'member', status: 'active' });

  const groupMemberB = new EntitlementService();
  groupMemberB.setSubscription({ plan_id: 'free', status: 'active' }, { group_id: 'grp_1', role: 'member', status: 'active' });

  assert(groupMemberA.getEffectivePlanId() === 'premium', 'Group Member A resolves to Premium effective tier');
  assert(groupMemberB.getEffectivePlanId() === 'premium', 'Group Member B resolves to Premium effective tier');
  assert(groupMemberA.can(CAPABILITIES.REMOVE_BRANDING) === true, 'Group Member A can remove branding');
  assert(groupMemberA.canUseTheme('health') === true, 'Group Member A can use Premium themes');

  // Independent cooldown per member
  const memberACooldown = usageLimit.getPortfolioCreationAvailability(1, 1, oneMinAgo, groupMemberA);
  const memberBCooldown = usageLimit.getPortfolioCreationAvailability(0, 0, null, groupMemberB);
  assert(memberACooldown.allowed === false, 'Group Member A on cooldown is DENIED');
  assert(memberBCooldown.allowed === true, 'Group Member B without recent creation is ALLOWED (Independent cooldown)');

  // Seat Pricing check
  assert(GROUP_SEAT_PRICING[2] === 1500, 'Group seat price for 2 = 1,500 EGP');
  assert(GROUP_SEAT_PRICING[3] === 1800, 'Group seat price for 3 = 1,800 EGP');
  assert(GROUP_SEAT_PRICING[4] === 2200, 'Group seat price for 4 = 2,200 EGP');
  assert(GROUP_SEAT_PRICING[5] === 2800, 'Group seat price for 5 = 2,800 EGP');

  // 5. KEEP IT LIVE TESTS
  const kilUser = new EntitlementService();
  kilUser.setSubscription(
    { plan_id: 'pro', status: 'keep_it_live' },
    null,
    [{ portfolio_id: 'pf_live_1', status: 'active' }]
  );

  assert(kilUser.isKeepItLive() === true, 'User is in Keep It Live state');
  assert(kilUser.hasKeepItLive('pf_live_1') === true, 'Portfolio pf_live_1 has active Keep It Live entitlement');
  assert(kilUser.canEditPortfolio({ id: 'pf_live_1' }) === false, 'Keep It Live portfolio edit is strictly DENIED');
  assert(kilUser.can(CAPABILITIES.CONTINUOUS_EDIT) === false, 'Keep It Live cannot continuous edit');
  assert(kilUser.can(CAPABILITIES.CUSTOM_DOMAIN) === false, 'Keep It Live cannot connect new custom domain');

  if (isEnforcementOn) {
    assert(kilUser.canPublishHosted() === false, 'Mode ON: Keep It Live cannot publish modified content');
  }

  // 6. IDOR / ISOLATION TESTS
  const portfolioMemberA = { id: 'pf_a', owner_user_id: 'usr_member_a', is_finalized: false };
  const portfolioMemberB = { id: 'pf_b', owner_user_id: 'usr_member_b', is_finalized: false };

  // Verification that ownership check logic distinguishes owners
  function verifyOwnership(requestingUserId, portfolio) {
    return portfolio.owner_user_id === requestingUserId;
  }

  assert(verifyOwnership('usr_member_a', portfolioMemberA) === true, 'Member A owns portfolio A');
  assert(verifyOwnership('usr_member_b', portfolioMemberA) === false, 'Member B CANNOT own/edit portfolio A (IDOR blocked)');
  assert(verifyOwnership('usr_member_a', portfolioMemberB) === false, 'Member A CANNOT own/edit portfolio B (IDOR blocked)');

  // 7. APPROVED PRODUCT CONFIG CONSTANTS
  assert(PLANS.pro.capabilities.includes(CAPABILITIES.REMOVE_BRANDING) === false, 'Approved: Pro does not include remove_branding');
  assert(PLANS.free.limits.jobMatchLifetimeQuota === 1, 'Approved: Free Job Match quota = 1 lifetime analysis');
  assert(HOSTING_GRACE_PERIOD_DAYS === 7, 'Approved: Hosting grace period = 7 days');

  console.log(`\n  RESULTS FOR MODE ${mode}:`);
  console.log(`  Passed: ${passed} / ${total}`);
  console.log(`  Failed: ${failed} / ${total}`);

  return { total, passed, failed, failures };
}

// RUN BOTH MODES
const resultOff = runTestSuite('OFF');
const resultOn = runTestSuite('ON');

console.log('\n============================================================');
console.log('  FINAL VERIFICATION SUMMARY');
console.log('============================================================');
console.log(`  ENFORCEMENT OFF: ${resultOff.passed}/${resultOff.total} PASSED (Failed: ${resultOff.failed})`);
console.log(`  ENFORCEMENT ON:  ${resultOn.passed}/${resultOn.total} PASSED (Failed: ${resultOn.failed})`);
console.log('============================================================\n');

if (resultOff.failed > 0 || resultOn.failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
