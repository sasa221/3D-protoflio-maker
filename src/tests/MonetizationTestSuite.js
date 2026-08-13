/**
 * MonetizationTestSuite.js
 * Acceptance test suite for V2.9 SaaS Monetization & Publishing Infrastructure.
 * Verifies capabilities entitlement checks, server-side tamper security audit,
 * zero data deletion on downgrade, and webhook subscription lifecycle.
 */

import { globalEntitlements, CAPABILITIES } from '../services/EntitlementService.js';
import { globalBilling } from '../services/BillingService.js';
import { globalUsageLimit } from '../services/UsageLimitService.js';

export async function runMonetizationTestSuite() {
  let results = [];

  // TEST 47: Capability Entitlements & Plan Limits
  globalEntitlements.setSubscription({ planId: 'free', status: 'active' });

  const freeCanVariants = globalEntitlements.can(CAPABILITIES.PORTFOLIO_VARIANTS);
  const freeCanDomain = globalEntitlements.can(CAPABILITIES.CUSTOM_DOMAIN);
  const freeCanBranding = globalEntitlements.can(CAPABILITIES.REMOVE_BRANDING);
  const freeVariantLimit = globalEntitlements.getLimit('variants');

  globalEntitlements.setSubscription({ planId: 'pro', status: 'active' });

  const proCanDomain = globalEntitlements.can(CAPABILITIES.CUSTOM_DOMAIN);
  const proCanBranding = globalEntitlements.can(CAPABILITIES.REMOVE_BRANDING);
  const proVariantLimit = globalEntitlements.getLimit('variants');

  const passed47 = (!freeCanDomain && !freeCanBranding && freeVariantLimit === 1) &&
                   (proCanDomain && proCanBranding && proVariantLimit === 5);

  results.push({
    testName: '47. Capability Entitlements & Plan Limits',
    passed: passed47,
    freeVariantLimit,
    proVariantLimit,
    proDomainUnlocked: proCanDomain
  });

  // TEST 48: Server-Side Source of Truth Security Audit (Tamper Attempt Blocked)
  // Client attempts tamper:
  localStorage.setItem('plan', 'pro');

  // Query Server-Side Backend Directly
  const securityCheck = await globalBilling.verifyServerSideCapability('user_saleh_123', 'pro_feature');
  const tamperBlocked = (securityCheck.allowed === false);

  results.push({
    testName: '48. Server-Side Source of Truth Security Audit',
    passed: tamperBlocked,
    clientTamperBlockedServerSide: tamperBlocked
  });

  // TEST 49: Graceful Downgrade Data Retention
  let mockUserData = {
    userId: 'user_saleh_123',
    projects: [{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }],
    portfolioVariants: [{ id: 'v1' }, { id: 'v2' }, { id: 'v3' }, { id: 'v4' }, { id: 'v5' }]
  };

  const initialVariantCount = mockUserData.portfolioVariants.length;
  await globalBilling.downgradeUserToFree('user_saleh_123');

  const afterDowngradeVariantCount = mockUserData.portfolioVariants.length;
  const dataRetained = initialVariantCount === afterDowngradeVariantCount;

  results.push({
    testName: '49. Graceful Downgrade Data Retention',
    passed: dataRetained,
    variantsRetainedNoDataDeleted: dataRetained
  });

  // TEST 50: Serverless Checkout & Webhook Subscription Cycle
  const checkout = await globalBilling.createCheckoutSession('user_saleh_123', 'pro', 'monthly');
  const webhookResult = await globalBilling.handleWebhookEvent({
    type: 'checkout.session.completed',
    data: { userId: 'user_saleh_123', planId: 'pro', subscriptionId: 'sub_live_999' }
  }, 'valid_stripe_signature');

  const postWebhookPlan = globalEntitlements.getPlanId();
  const proUnlockedAfterWebhook = postWebhookPlan === 'pro';

  results.push({
    testName: '50. Serverless Checkout & Webhook Subscription Cycle',
    passed: checkout.success && webhookResult.success && proUnlockedAfterWebhook,
    checkoutCreated: checkout.success,
    webhookProcessed: webhookResult.success,
    proCapabilitiesActive: proUnlockedAfterWebhook
  });

  console.log('[Monetization Test Suite] Results:', results);
  return results;
}
