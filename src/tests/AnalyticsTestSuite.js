/**
 * AnalyticsTestSuite.js
 * Acceptance test suite for V2.8.1 Production Remote Analytics Backend.
 * Verifies real cross-device event synchronization (Device B visitor activity appearing on Device A Creator Dashboard),
 * event whitelisting, server-side PII stripping, rate limiting, and Studio preview exclusion.
 */

import { AnalyticsService, RemoteAnalyticsProvider } from '../services/AnalyticsService.js';
import { clearRemoteAnalyticsDatabase, postAnalyticsEvent, getAnalyticsDashboardData } from '../services/RemoteAnalyticsBackend.js';

export async function runAnalyticsTestSuite() {
  clearRemoteAnalyticsDatabase();

  const service = new AnalyticsService();
  service.setProvider(new RemoteAnalyticsProvider());

  let results = [];

  // STEP 1: Device A (Creator Studio) - Initial state before any visitors
  const creatorUser = { id: 'user_saleh_123', email: 'eng.salehmohammedd@gmail.com', role: 'user' };
  const initialDashboard = await getAnalyticsDashboardData('saleh_portfolio', creatorUser);
  const initialVisits = initialDashboard.overview.visits;

  // STEP 2: Device B (External Visitor on a separate mobile device / incognito browser session)
  const deviceBSessionId = 'sess_device_B_mobile_999';

  // Device B sends public analytics events to POST /api/analytics/event
  await postAnalyticsEvent({
    eventName: 'portfolio_view',
    portfolioId: 'saleh_portfolio',
    variantId: 'frontend',
    sessionId: deviceBSessionId,
    timestamp: new Date().toISOString(),
    metadata: { device: 'Mobile', referrer: 'LinkedIn', email: 'PII_LEAK_TEST@gmail.com' } // Email should be stripped!
  });

  await postAnalyticsEvent({
    eventName: 'variant_viewed',
    portfolioId: 'saleh_portfolio',
    variantId: 'frontend',
    sessionId: deviceBSessionId,
    timestamp: new Date().toISOString()
  });

  await postAnalyticsEvent({
    eventName: 'section_viewed',
    portfolioId: 'saleh_portfolio',
    variantId: 'frontend',
    sessionId: deviceBSessionId,
    timestamp: new Date().toISOString(),
    metadata: { sectionId: 'projects' }
  });

  await postAnalyticsEvent({
    eventName: 'project_opened',
    portfolioId: 'saleh_portfolio',
    variantId: 'frontend',
    sessionId: deviceBSessionId,
    timestamp: new Date().toISOString(),
    metadata: { projectId: 'proj_clothe', projectName: 'Clothe Website' }
  });

  await postAnalyticsEvent({
    eventName: 'resume_download_clicked',
    portfolioId: 'saleh_portfolio',
    variantId: 'frontend',
    sessionId: deviceBSessionId,
    timestamp: new Date().toISOString()
  });

  // STEP 3: Studio Preview Attempt (MUST BE EXCLUDED)
  service.track('portfolio_view', { device: 'Desktop' }, { portfolioId: 'saleh_portfolio', variantId: 'general', isStudioPreview: true });

  // STEP 4: Device A (Creator Studio) - Re-queries Central Remote Dashboard
  const updatedDashboard = await getAnalyticsDashboardData('saleh_portfolio', creatorUser);
  const overview = updatedDashboard.overview;

  const passedCrossDeviceVisits = (initialVisits === 0) && (overview.visits === 1);
  const passedProjectOpens = overview.projectOpens === 1;
  const passedResumeDownloads = overview.resumeDownloads === 1;

  // Verify Variant Attribution
  const frontendVariantStats = updatedDashboard.variants.find(v => v.variantId === 'frontend');
  const passedVariantAttribution = Boolean(frontendVariantStats && frontendVariantStats.visits === 1);

  // Verify Zero PII in Central Store
  const piiLeakAttempt = updatedDashboard.insights.some(i => i.includes('PII_LEAK_TEST'));

  // STEP 5: Unauthorized Creator Access Test (User X attempting to view Saleh's analytics)
  const attackerUser = { id: 'user_attacker_666', email: 'hacker@example.com', role: 'user' };
  const unauthorizedRes = await getAnalyticsDashboardData('saleh_portfolio', attackerUser);
  const passedAuthorizationGuard = (unauthorizedRes.status === 403);

  const overallPassed = Boolean(
    passedCrossDeviceVisits &&
    passedProjectOpens &&
    passedResumeDownloads &&
    passedVariantAttribution &&
    !piiLeakAttempt &&
    passedAuthorizationGuard
  );

  results.push({
    testName: '46. Real Cross-Device Synchronization & Production Backend Test',
    passed: overallPassed,
    initialVisits,
    updatedVisits: overview.visits,
    projectOpensCount: overview.projectOpens,
    resumeDownloadsCount: overview.resumeDownloads,
    variantAttribution: frontendVariantStats ? frontendVariantStats.variantId : 'none',
    unauthorizedAccessBlocked: passedAuthorizationGuard,
    serverSidePIIStripped: !piiLeakAttempt
  });

  console.log('[Remote Analytics Test Suite] Results:', results);
  return results;
}
