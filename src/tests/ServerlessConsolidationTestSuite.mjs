/**
 * ServerlessConsolidationTestSuite.mjs
 * Regression Test Suite verifying that all consolidated Serverless Routers
 * correctly handle every route, action, and security constraint.
 */

import adminHandler from '../../api/admin.js';
import entitlementsHandler from '../../api/entitlements.js';
import analyticsHandler from '../../api/analytics.js';
import billingHandler from '../../api/billing.js';
import portfolioHandler from '../../api/portfolio.js';
import publicHandler from '../../api/public.js';

let total = 0;
let passed = 0;
let failed = 0;

function assert(condition, desc) {
  total++;
  if (condition) {
    passed++;
  } else {
    failed++;
    console.error(`  ❌ FAIL: ${desc}`);
  }
}

function mockRes() {
  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(k, v) { res.headers[k] = v; return res; },
    status(c) { res.statusCode = c; return res; },
    json(b) { res.body = b; return res; },
    send(b) { res.body = b; return res; },
    end() { return res; }
  };
  return res;
}

console.log('============================================================');
console.log('  SERVERLESS FUNCTION CONSOLIDATION TEST SUITE (6 ROUTERS)');
console.log('============================================================\n');

console.log('1. Verifying Handler Exports...');
assert(typeof adminHandler === 'function', 'api/admin.js exports default handler function');
assert(typeof entitlementsHandler === 'function', 'api/entitlements.js exports default handler function');
assert(typeof analyticsHandler === 'function', 'api/analytics.js exports default handler function');
assert(typeof billingHandler === 'function', 'api/billing.js exports default handler function');
assert(typeof portfolioHandler === 'function', 'api/portfolio.js exports default handler function');
assert(typeof publicHandler === 'function', 'api/public.js exports default handler function');

console.log('\n2. Testing OPTIONS preflight on all 6 routers...');
for (const [name, h] of Object.entries({
  admin: adminHandler,
  entitlements: entitlementsHandler,
  analytics: analyticsHandler,
  billing: billingHandler,
  portfolio: portfolioHandler,
  public: publicHandler
})) {
  const res = mockRes();
  await h({ method: 'OPTIONS', query: {}, headers: {} }, res);
  assert(res.statusCode === 200, `${name} handles OPTIONS preflight with HTTP 200`);
  assert(res.headers['Access-Control-Allow-Origin'] === '*', `${name} sets CORS header`);
}

console.log('\n3. Testing Unauthenticated Access Restrictions...');
{
  const res = mockRes();
  await entitlementsHandler({ method: 'POST', query: { action: 'check' }, headers: {}, body: {} }, res);
  assert(res.statusCode === 401, 'entitlements check without auth returns 401');
}
{
  const res = mockRes();
  await entitlementsHandler({ method: 'GET', query: { action: 'cooldown' }, headers: {}, body: {} }, res);
  assert(res.statusCode === 401, 'entitlements cooldown without auth returns 401');
}
{
  const res = mockRes();
  await portfolioHandler({ method: 'POST', query: { action: 'deploy' }, headers: {}, body: {} }, res);
  assert(res.statusCode === 401, 'portfolio deploy without auth returns 401');
}
{
  const res = mockRes();
  await portfolioHandler({ method: 'POST', query: { action: 'upload-avatar' }, headers: {}, body: {} }, res);
  assert(res.statusCode === 401, 'portfolio upload-avatar without auth returns 401');
}
{
  const res = mockRes();
  await portfolioHandler({ method: 'POST', query: { action: 'upload-resume' }, headers: {}, body: {} }, res);
  assert(res.statusCode === 401, 'portfolio upload-resume without auth returns 401');
}
{
  const res = mockRes();
  await analyticsHandler({ method: 'GET', query: { action: 'dashboard' }, headers: {} }, res);
  assert(res.statusCode === 401, 'analytics dashboard without auth returns 401');
}

console.log('\n4. Testing Input Validation on Public & Health Endpoints...');
{
  const res = mockRes();
  await publicHandler({ method: 'POST', query: { action: 'reset-password' }, headers: {}, body: { email: 'invalid-email' } }, res);
  assert(res.statusCode === 400, 'reset-password rejects invalid email with 400');
}
{
  const res = mockRes();
  await publicHandler({ method: 'GET', query: { action: 'resume', slug: 'admin' }, headers: {} }, res);
  assert(res.statusCode === 400, 'public resume rejects reserved slug "admin" with 400');
}
{
  const res = mockRes();
  await adminHandler({ method: 'GET', query: { action: 'health' }, headers: {} }, res);
  assert(res.statusCode === 200 || res.statusCode === 503, 'admin health endpoint executes and returns status code');
}

console.log('\n============================================================');
console.log(`  SUMMARY: ${passed} / ${total} assertions PASSED (Failures: ${failed})`);
console.log('============================================================\n');

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
