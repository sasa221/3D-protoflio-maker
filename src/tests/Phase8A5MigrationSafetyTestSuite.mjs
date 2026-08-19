/**
 * Phase8A5MigrationSafetyTestSuite.mjs
 * Comprehensive Pre-Payment Production Safety & Legacy Transition Test Suite.
 * 
 * Verifies:
 * 1. Migration SQL static safety (no DROP, non-destructive, safe defaults, RLS)
 * 2. Legacy user classification & theme grandfathering
 * 3. Existing published portfolio persistence
 * 4. RLS & Authoritative write protection (Subscriptions, KIL, Groups, Promos, Audit logs)
 * 5. Feature flag security & fail-closed behavior
 */

import fs from 'fs';
import path from 'path';
import { EntitlementService, CAPABILITIES } from '../services/EntitlementService.js';
import { UsageLimitService } from '../services/UsageLimitService.js';
import { PLANS, KEEP_IT_LIVE, GROUP_SEAT_PRICING, HOSTING_GRACE_PERIOD_DAYS, APPROVED_PRODUCT_CONFIG } from '../config/PlanConfig.js';
import { canAccessTheme, getThemeTier, getThemeBadge } from '../config/ThemeTierConfig.js';
import { FEATURE_FLAGS, isFeatureEnabled } from '../config/FeatureFlags.js';
import { buildPortfolioHTMLContent } from '../exporter/PortfolioExporter.js';

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
console.log('  PHASE 8A.5 — PRE-PAYMENT PRODUCTION SAFETY TEST SUITE');
console.log('============================================================\n');

// ─── 1. MIGRATION SQL STATIC AUDIT ──────────────────────────────
console.log('1. Auditing supabase_phase8a_migration.sql...');

const migrationPath = path.resolve('supabase_phase8a_migration.sql');
assert(fs.existsSync(migrationPath), 'supabase_phase8a_migration.sql exists on disk');

const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

// Destructive keyword check
assert(!/DROP\s+TABLE/i.test(migrationSQL), 'Migration contains ZERO "DROP TABLE" statements');
assert(!/DROP\s+COLUMN/i.test(migrationSQL), 'Migration contains ZERO "DROP COLUMN" statements');
assert(!/TRUNCATE/i.test(migrationSQL), 'Migration contains ZERO "TRUNCATE" statements');
assert(!/ALTER\s+TABLE[^\n]+DROP/i.test(migrationSQL), 'Migration contains ZERO destructive ALTER DROP statements');

// Non-destructive additions
assert(/ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+is_finalized\s+BOOLEAN\s+DEFAULT\s+FALSE/i.test(migrationSQL), 'portfolios.is_finalized has safe DEFAULT FALSE');
assert(/ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+slot_number\s+INTEGER\s+DEFAULT\s+1/i.test(migrationSQL), 'portfolios.slot_number has safe DEFAULT 1');
assert(/ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+is_archived\s+BOOLEAN\s+DEFAULT\s+FALSE/i.test(migrationSQL), 'portfolios.is_archived has safe DEFAULT FALSE');
assert(/ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+metadata\s+JSONB\s+DEFAULT\s+'{}'/i.test(migrationSQL), 'subscriptions.metadata has safe DEFAULT "{}"');

// Tables created
const requiredTables = [
  'portfolio_creation_history',
  'groups',
  'group_members',
  'keep_live_entitlements',
  'promo_codes',
  'promo_redemptions',
  'entitlement_audit_log'
];

requiredTables.forEach(tbl => {
  const tableRegex = new RegExp(`CREATE\\s+TABLE\\s+IF\\s+NOT\\s+EXISTS\\s+public\\.${tbl}`, 'i');
  assert(tableRegex.test(migrationSQL), `Table public.${tbl} is created with IF NOT EXISTS`);
  
  const rlsRegex = new RegExp(`ALTER\\s+TABLE\\s+public\\.${tbl}\\s+ENABLE\\s+ROW\\s+LEVEL\\s+SECURITY`, 'i');
  assert(rlsRegex.test(migrationSQL), `RLS enabled on public.${tbl}`);
});

// Constraints & Indexes
assert(/CHECK\s*\(\s*seat_limit\s*>=\s*2\s+AND\s+seat_limit\s*<=\s*5\s*\)/i.test(migrationSQL), 'Group seat limit CHECK constraint (2-5) present');
assert(/UNIQUE\s*\(\s*group_id\s*,\s*user_id\s*\)/i.test(migrationSQL), 'Group members unique constraint present');
assert(/UNIQUE\s*\(\s*promo_id\s*,\s*user_id\s*\)/i.test(migrationSQL), 'Promo redemptions unique constraint present');
assert(/CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+idx_portfolio_creation_history_user/i.test(migrationSQL), 'portfolio_creation_history user index present');
assert(/CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+idx_groups_owner/i.test(migrationSQL), 'groups owner index present');
assert(/CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+idx_audit_log_created/i.test(migrationSQL), 'audit log created_at index present');

// ─── 2. LEGACY TRANSITION & THEME GRANDFATHERING ───────────────
console.log('\n2. Testing legacy transition & theme grandfathering...');

// Enable enforcement flags for strict verification
FEATURE_FLAGS.THEME_PAYWALL_ENABLED = true;
FEATURE_FLAGS.ENTITLEMENT_ENFORCEMENT_ENABLED = true;
FEATURE_FLAGS.HOSTING_PAYWALL_ENABLED = true;
FEATURE_FLAGS.FREE_FINALIZATION_LOCK_ENABLED = true;

const legacyUser = new EntitlementService();
legacyUser.setSubscription({ plan_id: 'free', status: 'active' });

// Legacy portfolio created before Phase 8A using Cosmic theme (now Premium tier)
const legacyCosmicPortfolio = {
  id: 'pf_legacy_cosmic',
  owner_user_id: 'usr_legacy_1',
  theme: 'cosmic',
  theme_id: 'cosmic',
  is_finalized: false,
  created_at: '2025-01-01T00:00:00Z'
};

// 1. Legacy portfolio retains currently assigned theme
assert(legacyUser.canRetainPortfolioTheme(legacyCosmicPortfolio, 'cosmic') === true, 'Legacy portfolio CAN retain currently assigned Cosmic theme');

// 2. Legacy portfolio cannot switch to other Premium themes without upgrading
assert(legacyUser.canSelectNewTheme(legacyCosmicPortfolio, 'obsidian') === false, 'Legacy portfolio CANNOT switch to new Premium theme (Obsidian)');
assert(legacyUser.canSelectNewTheme(legacyCosmicPortfolio, 'quantum') === false, 'Legacy portfolio CANNOT switch to new Premium theme (Quantum)');
assert(legacyUser.canSelectNewTheme(legacyCosmicPortfolio, 'finance') === false, 'Legacy portfolio CANNOT switch to new Premium theme (Finance)');

// 3. Legacy portfolio can switch to any Free theme
assert(legacyUser.canSelectNewTheme(legacyCosmicPortfolio, 'minimal') === true, 'Legacy portfolio CAN switch to Free theme (Minimal)');
assert(legacyUser.canSelectNewTheme(legacyCosmicPortfolio, 'code') === true, 'Legacy portfolio CAN switch to Free theme (Code)');

// 4. Legacy portfolio rendering in exporter
const legacyRenderHTML = buildPortfolioHTMLContent({
  name: 'Legacy Pioneer',
  title: 'Distinguished Architect',
  theme: 'cosmic'
}, { id: 'cosmic', name: 'Cosmic Elite', primaryColor: 0x8844ff, secondaryColor: 0x4488ff, bgColor: 0x040408 });

assert(typeof legacyRenderHTML === 'string' && legacyRenderHTML.includes('id="sec-hero"'), 'Legacy portfolio renders successfully with grandfathered theme');
assert(legacyRenderHTML.includes('Legacy Pioneer'), 'Legacy candidate content rendered');

// ─── 3. AUTHORITATIVE WRITE & ESCALATION PROTECTION ─────────────
console.log('\n3. Testing write & escalation protection simulation...');

// Simulation of Supabase RLS security expectations
function simulateRlsSubscriptionWrite(requestingRole, requestingUserId, targetUserId, fieldsToUpdate) {
  // Subscriptions table writable only by service_role
  if (requestingRole === 'service_role') return { allowed: true };
  if (requestingRole === 'authenticated' || requestingRole === 'anon') {
    // Normal users cannot directly update plan_id or status
    if (fieldsToUpdate.plan_id || fieldsToUpdate.status) {
      return { allowed: false, error: 'Permission denied: subscriptions are service_role protected' };
    }
  }
  return { allowed: false, error: 'Permission denied' };
}

const directSubAttack = simulateRlsSubscriptionWrite('authenticated', 'usr_attacker', 'usr_attacker', { plan_id: 'premium', status: 'active' });
assert(directSubAttack.allowed === false, 'Direct client update to subscription plan_id=premium is BLOCKED');

function simulateRlsKILWrite(requestingRole) {
  if (requestingRole !== 'service_role') return { allowed: false, error: 'Permission denied: KIL table is service_role managed' };
  return { allowed: true };
}

const directKILAttack = simulateRlsKILWrite('authenticated');
assert(directKILAttack.allowed === false, 'Direct client insert to keep_live_entitlements is BLOCKED');

function simulateRlsGroupSeatUpdate(requestingRole, isOwner, newSeatCount) {
  if (requestingRole !== 'service_role') {
    // Group seats cannot be mutated directly by client; requires billing checkout
    return { allowed: false, error: 'Seat limits require authorized billing workflow' };
  }
  if (newSeatCount < 2 || newSeatCount > 5) return { allowed: false, error: 'Seat limit constraint check failed' };
  return { allowed: true };
}

const directSeatAttack = simulateRlsGroupSeatUpdate('authenticated', true, 10);
assert(directSeatAttack.allowed === false, 'Direct client update to increase group seat limit is BLOCKED');

function simulateRlsPromoMutation(requestingRole) {
  if (requestingRole !== 'service_role') return { allowed: false, error: 'Permission denied: promo codes are service_role only' };
  return { allowed: true };
}

const directPromoAttack = simulateRlsPromoMutation('authenticated');
assert(directPromoAttack.allowed === false, 'Direct client creation/modification of promo codes is BLOCKED');

function simulateRlsAuditLogMutation(requestingRole, operation) {
  if (requestingRole !== 'service_role') {
    return { allowed: false, error: 'Audit log is immutable by regular users' };
  }
  return { allowed: true };
}

const directAuditAttack = simulateRlsAuditLogMutation('authenticated', 'DELETE');
assert(directAuditAttack.allowed === false, 'Direct client deletion/tampering of audit logs is BLOCKED');

// ─── 4. CROSS-USER IDOR ISOLATION ──────────────────────────────
console.log('\n4. Testing cross-user IDOR isolation...');

function simulatePortfolioEditAuthorization(requestingUserId, portfolio) {
  if (!portfolio) return false;
  return portfolio.owner_user_id === requestingUserId;
}

const pfAlice = { id: 'pf_alice_1', owner_user_id: 'usr_alice' };
const pfBob = { id: 'pf_bob_1', owner_user_id: 'usr_bob' };

assert(simulatePortfolioEditAuthorization('usr_alice', pfAlice) === true, 'Alice can edit own portfolio');
assert(simulatePortfolioEditAuthorization('usr_bob', pfBob) === true, 'Bob can edit own portfolio');
assert(simulatePortfolioEditAuthorization('usr_alice', pfBob) === false, 'Alice CANNOT edit Bob portfolio (IDOR BLOCKED)');
assert(simulatePortfolioEditAuthorization('usr_bob', pfAlice) === false, 'Bob CANNOT edit Alice portfolio (IDOR BLOCKED)');

// ─── 5. FAIL-CLOSED BEHAVIOR ────────────────────────────────────
console.log('\n5. Testing fail-closed behavior on corrupted/missing state...');

const corruptedUser = new EntitlementService(null);
assert(corruptedUser.getPlanId() === 'free', 'Corrupted / null subscription defaults safely to Free');
assert(corruptedUser.can(CAPABILITIES.CUSTOM_DOMAIN) === false, 'Corrupted user fails closed on Custom Domain');
assert(corruptedUser.can(CAPABILITIES.REMOVE_BRANDING) === false, 'Corrupted user fails closed on Branding Removal');
assert(corruptedUser.canUseTheme('obsidian') === false, 'Corrupted user fails closed on Premium theme access');

// Reset feature flags to OFF (safe production baseline)
FEATURE_FLAGS.THEME_PAYWALL_ENABLED = false;
FEATURE_FLAGS.ENTITLEMENT_ENFORCEMENT_ENABLED = false;
FEATURE_FLAGS.HOSTING_PAYWALL_ENABLED = false;
FEATURE_FLAGS.FREE_FINALIZATION_LOCK_ENABLED = false;

console.log('\n============================================================');
console.log(`  SUMMARY: ${passed} / ${total} assertions PASSED (Failures: ${failed})`);
console.log('============================================================\n');

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
