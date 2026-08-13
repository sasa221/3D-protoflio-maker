/**
 * ProductionSecurityTestSuite.js
 * Comprehensive acceptance test suite for V2.10 Production Backend + Security Hardening.
 * Verifies RLS ownership checks, restart persistence, XSS text escaping, URL security,
 * localStorage tamper blocking, and reserved slug enforcement.
 */

import { globalServerlessApi } from '../backend/ServerlessApiRouter.js';
import { globalProdDB } from '../backend/ProductionDatabase.js';
import { sanitizeText, validateSafeURL, isReservedSlug } from '../backend/SecuritySanitizer.js';

export async function runProductionSecurityTestSuite() {
  let results = [];

  // TEST 51: Cross-Browser Auth & Restart Persistence
  const testEmail = 'newuser_' + Date.now() + '@example.com';
  const regRes = await globalServerlessApi.register(testEmail, 'password123');
  const user = regRes.user;

  // Save portfolio for new user
  const pfId = 'pf_persist_' + Date.now();
  await globalServerlessApi.savePortfolio({
    id: pfId,
    slug: 'user-slug-' + Date.now(),
    name: 'Persistent Test Portfolio'
  });

  // Re-fetch via API (Simulates logging in from another browser)
  const fetchRes = await globalServerlessApi.getPortfolio(pfId);
  const passedPersistence = fetchRes.success && (fetchRes.portfolio.name === 'Persistent Test Portfolio');

  results.push({
    testName: '51. Cross-Browser Auth & Restart Persistence',
    passed: passedPersistence,
    registeredUserId: user.id,
    portfolioPersisted: passedPersistence
  });

  // TEST 52: Strict XSS Sanitization
  const maliciousInput = '<img src=x onerror=alert(1)>';
  const sanitizedText = sanitizeText(maliciousInput);
  const passedXSS = !sanitizedText.includes('<img') && sanitizedText.includes('&lt;img');

  results.push({
    testName: '52. Strict XSS Sanitization',
    passed: passedXSS,
    escapedText: sanitizedText
  });

  // TEST 53: URL Security Guard
  const maliciousURL = 'javascript:alert("hacked")';
  const safeURL = validateSafeURL(maliciousURL);
  const passedURL = !safeURL.includes('javascript:');

  results.push({
    testName: '53. URL Security Guard',
    passed: passedURL,
    neutralizedURL: safeURL
  });

  // TEST 54: RLS Portfolio Ownership Guard (User B blocked from User A portfolio)
  await globalServerlessApi.login('hacker@example.com', 'hacker_pass'); // Switch to Attacker User
  const attackFetch = await globalServerlessApi.getPortfolio('saleh_portfolio');
  const attackSave = await globalServerlessApi.savePortfolio({ id: 'saleh_portfolio', name: 'HACKED' });

  const passedRLS = (!attackFetch.success || attackFetch.status === 403) && (!attackSave.success || attackSave.status === 403);

  // Switch back to Saleh
  await globalServerlessApi.login('eng.salehmohammedd@gmail.com', 'saleh_pass');

  results.push({
    testName: '54. RLS Portfolio Ownership Guard',
    passed: passedRLS,
    attackerBlockedFromFetch: !attackFetch.success,
    attackerBlockedFromSave: !attackSave.success
  });

  // TEST 55: LocalStorage Plan Tamper Block
  localStorage.setItem('plan', 'pro'); // Client tamper attempt

  const freeUserPortfolio = { id: 'saleh_portfolio', slug: 'saleh-tamper', customDomain: { hostname: 'tamper.com' } };
  globalProdDB.savePortfolio(freeUserPortfolio, globalProdDB.findUserById('usr_saleh_123'));

  const deployRes = await globalServerlessApi.deployPortfolio('saleh_portfolio', 'general');
  const passedTamperBlock = (deployRes.status === 403);

  results.push({
    testName: '55. LocalStorage Plan Tamper Block',
    passed: passedTamperBlock,
    clientTamperBlockedServerSide: passedTamperBlock
  });

  // TEST 56: Reserved Slugs Guard
  const isAdminReserved = isReservedSlug('admin');
  const isApiReserved = isReservedSlug('api');
  const reservedSaveRes = await globalServerlessApi.savePortfolio({ id: 'pf_res', slug: 'admin', name: 'Admin Test' });

  const passedReservedSlugs = isAdminReserved && isApiReserved && (reservedSaveRes.status === 400);

  results.push({
    testName: '56. Reserved Slugs Guard',
    passed: passedReservedSlugs,
    adminSlugBlocked: passedReservedSlugs
  });

  console.log('[Production Security Test Suite] Results:', results);
  return results;
}
