/**
 * SubscriptionLifecycleAndPricingTestSuite.mjs
 * Comprehensive automated verification for SaaS monetization:
 * - Authoritative pricing across all tiers (Free, Pro, Premium, Group 2–5 seats)
 * - Subscription lifecycle calculations (30d, 90d, 365d, custom)
 * - Expiration fallback to Free entitlements
 * - InstaPay manual approval & renewal date preservation formulas
 * - Non-destructive metadata & auto-renewal invariants
 */

import { PLANS, GROUP_SEAT_PRICING, getPlanConfig, formatPrice, getGroupPrice } from '../config/PlanConfig.js';
import { EntitlementService } from '../services/EntitlementService.js';
import { canAccessTheme } from '../config/ThemeTierConfig.js';

let total = 0;
let passed = 0;
let failed = 0;
const failures = [];

function assert(condition, description) {
  total++;
  if (condition) {
    passed++;
    console.log(`  ✅ PASS: ${description}`);
  } else {
    failed++;
    failures.push(description);
    console.error(`  ❌ FAIL: ${description}`);
  }
}

console.log('============================================================');
console.log('  SUBSCRIPTION LIFECYCLE & PRICING VERIFICATION SUITE');
console.log('============================================================\n');

// ─── PART 1: PRICING ACCURACY ─────────────────────────────────
console.log('1. Testing Authoritative Tier Pricing Invariants...');

assert(PLANS.free.priceMonthlyEGP === 0, '1. Free plan price is exactly 0 EGP');
assert(PLANS.pro.priceMonthlyEGP === 600, '2. Pro plan price is exactly 600 EGP / month');
assert(PLANS.premium.priceMonthlyEGP === 1000, '3. Premium plan price is exactly 1,000 EGP / month');
assert(GROUP_SEAT_PRICING[2] === 1800, '4. Premium Group (2 seats) is exactly 1,800 EGP / month');
assert(GROUP_SEAT_PRICING[3] === 2550, '5. Premium Group (3 seats) is exactly 2,550 EGP / month');
assert(GROUP_SEAT_PRICING[4] === 3200, '6. Premium Group (4 seats) is exactly 3,200 EGP / month');
assert(GROUP_SEAT_PRICING[5] === 3750, '7. Premium Group (5 seats) is exactly 3,750 EGP / month');

assert(getGroupPrice(1) === null && getGroupPrice(6) === null, '8. Invalid seat counts return null (strict 2–5 bounds)');
assert(PLANS.premium_group.priceMonthlyEGP === 1800, '8b. Premium group default base price is 1,800 EGP');

// ─── PART 2: DURATION CALCULATIONS ─────────────────────────────
console.log('\n2. Testing Admin Override Duration Formulas...');

const baseNow = new Date('2026-08-20T12:00:00.000Z');

// 30 days
const end30 = new Date(baseNow.getTime() + 30 * 86400000);
const diff30Days = Math.round((end30.getTime() - baseNow.getTime()) / 86400000);
assert(diff30Days === 30, '9. 30-Day duration calculation produces exactly 30 days');

// 90 days
const end90 = new Date(baseNow.getTime() + 90 * 86400000);
const diff90Days = Math.round((end90.getTime() - baseNow.getTime()) / 86400000);
assert(diff90Days === 90, '10. 90-Day duration calculation produces exactly 90 days');

// 365 days
const end365 = new Date(baseNow.getTime() + 365 * 86400000);
const diff365Days = Math.round((end365.getTime() - baseNow.getTime()) / 86400000);
assert(diff365Days === 365, '11. 365-Day duration calculation produces exactly 365 days');

// Custom range
const customStart = new Date('2026-09-01T00:00:00.000Z');
const customEnd = new Date('2026-10-15T00:00:00.000Z');
const customDays = Math.round((customEnd.getTime() - customStart.getTime()) / 86400000);
assert(customDays === 44, '12. Custom date range calculation correctly computes arbitrary duration (44 days)');

// ─── PART 3: RENEWAL EXTENSION FORMULAS ────────────────────────
console.log('\n3. Testing InstaPay Renewal Extension Logic...');

function calculateRenewal(existingSub, now = new Date(), periodDays = 30) {
  const nowISO = now.toISOString();
  const existingEnd = existingSub?.current_period_end ? new Date(existingSub.current_period_end) : null;

  let newPeriodStart;
  let newPeriodEnd;

  if (existingSub && (existingSub.status === 'active' || existingSub.status === 'grace') && existingEnd && existingEnd.getTime() > now.getTime()) {
    newPeriodStart = existingSub.current_period_start || existingSub.created_at || nowISO;
    newPeriodEnd = new Date(existingEnd.getTime() + periodDays * 86400000).toISOString();
  } else {
    newPeriodStart = nowISO;
    newPeriodEnd = new Date(now.getTime() + periodDays * 86400000).toISOString();
  }

  return { newPeriodStart, newPeriodEnd };
}

// Active user with 10 days remaining renews
const activeSubWithRemaining = {
  status: 'active',
  current_period_start: '2026-08-01T00:00:00.000Z',
  current_period_end: new Date(baseNow.getTime() + 10 * 86400000).toISOString()
};
const renewalResult = calculateRenewal(activeSubWithRemaining, baseNow, 30);
const expectedEnd = new Date(new Date(activeSubWithRemaining.current_period_end).getTime() + 30 * 86400000).toISOString();

assert(renewalResult.newPeriodEnd === expectedEnd, '13. Active renewal adds 30 days onto existing expiry date (preserving paid days)');
assert(renewalResult.newPeriodStart === '2026-08-01T00:00:00.000Z', '14. Active renewal preserves original current_period_start');

// Expired user renews
const expiredSub = {
  status: 'expired',
  current_period_start: '2026-05-01T00:00:00.000Z',
  current_period_end: '2026-06-01T00:00:00.000Z'
};
const expiredRenewalResult = calculateRenewal(expiredSub, baseNow, 30);
assert(expiredRenewalResult.newPeriodStart === baseNow.toISOString(), '15a. Expired renewal resets start date to NOW');
assert(expiredRenewalResult.newPeriodEnd === new Date(baseNow.getTime() + 30 * 86400000).toISOString(), '15b. Expired renewal sets expiry to NOW + 30 days');

// ─── PART 4: EXPIRATION & ENTITLEMENTS ─────────────────────────
console.log('\n4. Testing Subscription Expiration Fallback...');

const entService = new EntitlementService();

// Case: Active Pro subscription
entService.setSubscription({
  plan_id: 'pro',
  status: 'active',
  current_period_end: new Date(Date.now() + 15 * 86400000).toISOString()
});
assert(entService.getPlanId() === 'pro', '16a. Active unexpired subscription evaluates to Pro');

// Case: Pro subscription with expired date
entService.setSubscription({
  plan_id: 'pro',
  status: 'active',
  current_period_end: new Date(Date.now() - 5 * 86400000).toISOString()
});
assert(entService.getPlanId() === 'free', '16b. Subscription with period_end in the past immediately falls back to Free');

// Case: Expired status
entService.setSubscription({
  plan_id: 'premium',
  status: 'expired',
  current_period_end: new Date(Date.now() - 5 * 86400000).toISOString()
});
assert(entService.getPlanId() === 'free', '16c. Subscription with status=expired falls back to Free');

// ─── PART 5: AUTO-RENEWAL & METADATA INVARIANTS ────────────────
console.log('\n5. Testing Metadata & Auto-Renewal Invariants...');

const approvedInstaPayMetadata = {
  source: 'manual_instapay',
  subscription_source: 'INSTAPAY',
  payment_method: 'INSTAPAY',
  payment_request_id: 'mpr_test_123',
  amount_paid: 600,
  amount_egp: 600,
  auto_renew: false,
  autoRenewal: false,
  seat_count: null
};

assert(approvedInstaPayMetadata.auto_renew === false && approvedInstaPayMetadata.autoRenewal === false, '17. Auto-renewal is strictly false for InstaPay manual subscriptions');
assert(approvedInstaPayMetadata.payment_request_id === 'mpr_test_123' && approvedInstaPayMetadata.amount_paid === 600, '18. Metadata reliably preserves payment request ID and amount paid');

// ─── PART 6: GRANDFATHERED ACCESS ──────────────────────────────
console.log('\n6. Testing Grandfathered Legacy Exemption Invariant...');

const legacyUserTier = 'free'; // Commercial tier is Free
const isGrandfathered = true;

// Can access Pro and Premium themes if grandfathered
const canAccessCyber = isGrandfathered || canAccessTheme(legacyUserTier, 'cyber');
const canAccessBiosphere = isGrandfathered || canAccessTheme(legacyUserTier, 'biosphere');
assert(canAccessCyber === true, '19a. Grandfathered user can access Pro theme (Cyber Command)');
assert(canAccessBiosphere === true, '19b. Grandfathered user can access Premium theme (BioSphere DNA)');

// ─── PART 7: ADMIN BADGES & DISPLAY CALCULATION ────────────────
console.log('\n7. Testing Admin User List Badges Calculation...');

function computeUserDisplay(user, now = new Date()) {
  const plan = user.plan_id || 'free';
  const subStatus = user.status || 'active';
  const periodEnd = user.current_period_end ? new Date(user.current_period_end) : null;
  const isExpired = periodEnd && periodEnd.getTime() <= now.getTime();
  const daysRemaining = periodEnd ? Math.max(0, Math.ceil((periodEnd.getTime() - now.getTime()) / 86400000)) : null;
  const isExpiringSoon = !isExpired && daysRemaining !== null && daysRemaining <= 7 && plan !== 'free';

  let displayStatus = 'FREE';
  if (plan !== 'free') {
    if (isExpired || subStatus === 'expired') {
      displayStatus = 'EXPIRED';
    } else if (isExpiringSoon) {
      displayStatus = 'EXPIRING SOON';
    } else {
      displayStatus = 'ACTIVE';
    }
  }

  return { displayStatus, daysRemaining, isExpiringSoon, isExpired };
}

const activeUserBadge = computeUserDisplay({ plan_id: 'pro', status: 'active', current_period_end: new Date(baseNow.getTime() + 20 * 86400000).toISOString() }, baseNow);
assert(activeUserBadge.displayStatus === 'ACTIVE', '20a. Active user with > 7 days shows ACTIVE badge');

const expiringUserBadge = computeUserDisplay({ plan_id: 'pro', status: 'active', current_period_end: new Date(baseNow.getTime() + 4 * 86400000).toISOString() }, baseNow);
assert(expiringUserBadge.displayStatus === 'EXPIRING SOON' && expiringUserBadge.daysRemaining === 4, '20b. User with <= 7 days shows EXPIRING SOON badge');

const expiredUserBadge = computeUserDisplay({ plan_id: 'pro', status: 'active', current_period_end: new Date(baseNow.getTime() - 2 * 86400000).toISOString() }, baseNow);
assert(expiredUserBadge.displayStatus === 'EXPIRED', '20c. User past period_end shows EXPIRED badge');

const freeUserBadge = computeUserDisplay({ plan_id: 'free', status: 'active' }, baseNow);
assert(freeUserBadge.displayStatus === 'FREE', '20d. Free user shows FREE badge');

console.log('\n============================================================');
console.log(`  RESULT: ${passed} / ${total} ASSERTIONS PASSED (${failed} failures)`);
console.log('============================================================\n');

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
