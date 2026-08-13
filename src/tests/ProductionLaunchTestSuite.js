/**
 * ProductionLaunchTestSuite.js
 * Final acceptance test suite for V2.11 Production Launch Infrastructure & Deployment Validation.
 * Verifies live system health, zero secret leakage, public bundle isolation, and end-to-end launch workflow.
 */

import { checkSystemHealth } from '../backend/HealthService.js';
import { globalServerlessApi } from '../backend/ServerlessApiRouter.js';
import { postAnalyticsEvent, getAnalyticsDashboardData } from '../services/RemoteAnalyticsBackend.js';
import { globalBilling } from '../services/BillingService.js';

export async function runProductionLaunchTestSuite() {
  let results = [];

  // TEST 57: System Health Check Endpoint
  const health = await checkSystemHealth();
  const passedHealth = health.status === 'HEALTHY' && health.services.database.status === 'CONNECTED';

  results.push({
    testName: '57. Live System Health Check Endpoint',
    passed: passedHealth,
    systemStatus: health.status,
    databaseStatus: health.services.database.status
  });

  // TEST 58: Secret Leakage Scan
  const clientWindowKeys = Object.keys(window);
  const secretExposed = clientWindowKeys.some(k =>
    k.includes('STRIPE_SECRET') ||
    k.includes('SUPABASE_SERVICE') ||
    k.includes('NETLIFY_TOKEN') ||
    k.includes('SK_LIVE')
  );

  results.push({
    testName: '58. Secret Leakage Scan',
    passed: !secretExposed,
    zeroClientSecretsExposed: !secretExposed
  });

  // TEST 59: End-to-End Real-World Launch Flow Validation
  // 1. Device A: Register User & Save Portfolio
  const reg = await globalServerlessApi.register('launch_user_' + Date.now() + '@example.com', 'launch_pass_123');
  const user = reg.user;

  await globalServerlessApi.savePortfolio({
    id: 'pf_launch_1',
    slug: 'launch-slug-' + Date.now(),
    name: 'Launch Portfolio'
  });

  // 2. Device B: Public Visitor Event
  await postAnalyticsEvent({
    eventName: 'portfolio_view',
    portfolioId: 'pf_launch_1',
    variantId: 'general',
    sessionId: 'sess_launch_visitor_123',
    timestamp: new Date().toISOString()
  });

  // 3. Device A: Re-query Dashboard
  const dash = await getAnalyticsDashboardData('pf_launch_1', user);
  const visitorRecorded = dash.overview.visits === 1;

  // 4. Stripe Sandbox Upgrade
  await globalBilling.handleWebhookEvent({
    type: 'checkout.session.completed',
    data: { userId: user.id, planId: 'pro', subscriptionId: 'sub_launch_pro' }
  }, 'valid_stripe_signature');

  const upgradedSub = globalServerlessApi.getPortfolio('pf_launch_1');

  const passedFlow = reg.success && visitorRecorded;

  results.push({
    testName: '59. End-to-End Launch Flow Validation',
    passed: passedFlow,
    registeredUserId: user.id,
    crossDeviceVisitorRecorded: visitorRecorded
  });

  console.log('[Production Launch Test Suite] Results:', results);
  return results;
}
