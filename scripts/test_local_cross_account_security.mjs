import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_LOCAL_URL;
const anonKey = process.env.SUPABASE_LOCAL_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_LOCAL_SERVICE_ROLE_KEY;
if (!url || !anonKey || !serviceRoleKey) throw new Error('Cross-account test requires Supabase Local credentials.');
if (!/^http:\/\/(127\.0\.0\.1|localhost):54321$/.test(url)) throw new Error('Safety stop: accepts only Supabase Local.');

process.env.VITE_SUPABASE_URL = url;
process.env.VITE_SUPABASE_PUBLISHABLE_KEY = anonKey;
process.env.SUPABASE_SECRET_KEY = serviceRoleKey;
process.env.FF_CAREER_STUDIO = 'true';

const { default: portfolioHandler } = await import('../api/portfolio.js');
const { default: analyticsHandler } = await import('../api/analytics.js');
const { default: billingHandler } = await import('../api/billing.js');

const admin = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
const suffix = Date.now();
const credentials = (name) => ({ email: `security-${name}-${suffix}@example.test`, password: `LocalOnly-${name}-${suffix}!` });
const aCreds = credentials('a');
const bCreds = credentials('b');
const created = [];

function mockRes() {
  return {
    statusCode: 200,
    body: null,
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    end() { return this; }
  };
}

async function signIn(creds) {
  const client = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const result = await client.auth.signInWithPassword(creds);
  assert.ifError(result.error);
  assert.ok(result.data.session?.access_token);
  return { client, user: result.data.user, token: result.data.session.access_token };
}

const aUserResult = await admin.auth.admin.createUser({ ...aCreds, email_confirm: true });
const bUserResult = await admin.auth.admin.createUser({ ...bCreds, email_confirm: true });
assert.ifError(aUserResult.error);
assert.ifError(bUserResult.error);
const aUser = aUserResult.data.user;
const bUser = bUserResult.data.user;
created.push(aUser.id, bUser.id);
const a = await signIn(aCreds);
const b = await signIn(bCreds);

const portfolio = {
  id: `pf_security_${suffix}`,
  owner_user_id: aUser.id,
  name: 'Synthetic Private Portfolio A',
  slug: `security-a-${suffix}`,
  profession: 'Developer',
  bio: 'Synthetic fixture',
  theme: 'code',
  master_profile_json: { name: 'Owner A', privateNote: 'must-not-leak' }
};
let result = await a.client.from('portfolios').insert(portfolio).select().single();
assert.ifError(result.error);

// Draft portfolio and variant are owner-only through direct PostgREST/RLS.
result = await b.client.from('portfolios').select('*').eq('id', portfolio.id);
assert.ifError(result.error);
assert.equal(result.data.length, 0, 'User B must not read A draft portfolio');
result = await b.client.from('portfolios').update({ bio: 'hijacked' }).eq('id', portfolio.id).select();
assert.ifError(result.error);
assert.equal(result.data.length, 0, 'User B must not update A portfolio');
result = await b.client.from('portfolios').delete().eq('id', portfolio.id).select();
assert.ifError(result.error);
assert.equal(result.data.length, 0, 'User B must not delete A portfolio');
result = await b.client.from('portfolios').insert({ ...portfolio, id: `pf_forged_${suffix}`, slug: `forged-${suffix}` }).select();
assert.ok(result.error, 'User B must not insert a portfolio owned by A');

const variant = { id: `var_security_${suffix}`, portfolio_id: portfolio.id, name: 'Private Variant', slug: 'private', overrides_json: {} };
result = await a.client.from('portfolio_variants').insert(variant).select().single();
assert.ifError(result.error);
result = await b.client.from('portfolio_variants').select('*').eq('id', variant.id);
assert.ifError(result.error);
assert.equal(result.data.length, 0, 'User B must not read A private variant');
result = await b.client.from('portfolio_variants').update({ name: 'hijacked' }).eq('id', variant.id).select();
assert.ifError(result.error);
assert.equal(result.data.length, 0, 'User B must not update A variant');
result = await b.client.from('portfolio_variants').delete().eq('id', variant.id).select();
assert.ifError(result.error);
assert.equal(result.data.length, 0, 'User B must not delete A variant');

const payment = {
  id: `mpr_security_${suffix}`,
  user_id: aUser.id,
  plan_id: 'pro',
  expected_amount_egp: 600,
  final_expected_amount_egp: 600,
  payment_method: 'INSTAPAY',
  status: 'PENDING'
};
result = await a.client.from('manual_payment_requests').insert(payment).select().single();
assert.ifError(result.error);
result = await b.client.from('manual_payment_requests').select('*').eq('id', payment.id);
assert.ifError(result.error);
assert.equal(result.data.length, 0, 'User B must not read A payment request');
result = await b.client.from('manual_payment_requests').update({ status: 'CANCELLED' }).eq('id', payment.id).select();
assert.ifError(result.error);
assert.equal(result.data.length, 0, 'User B must not update A payment request');
result = await b.client.from('manual_payment_requests').delete().eq('id', payment.id).select();
assert.ok(result.error || result.data.length === 0, 'User B must not delete A payment request');
result = await b.client.from('manual_payment_requests').insert({ ...payment, id: `mpr_forged_${suffix}` }).select();
assert.ok(result.error, 'User B must not insert a payment request for A');

// Direct API checks use B's real local JWT against A's identifiers.
const deployReq = { method: 'POST', query: { action: 'deploy' }, headers: { authorization: `Bearer ${b.token}` }, body: { portfolioId: portfolio.id, slug: `hijack-${suffix}`, masterProfile: { name: 'Hijack' } } };
let response = mockRes();
await portfolioHandler(deployReq, response);
assert.equal(response.statusCode, 403, 'API deploy must reject cross-account portfolio');

const analyticsReq = { method: 'GET', query: { action: 'dashboard', portfolioId: portfolio.id }, headers: { authorization: `Bearer ${b.token}` } };
response = mockRes();
await analyticsHandler(analyticsReq, response);
assert.equal(response.statusCode, 403, 'API analytics dashboard must reject cross-account portfolio');

const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
const billingReq = { method: 'POST', query: { action: 'submit-manual-payment' }, headers: { authorization: `Bearer ${b.token}` }, body: { targetPlanId: 'pro', portfolioId: portfolio.id, proofBase64: `data:image/png;base64,${png}`, contentType: 'image/png' } };
response = mockRes();
await billingHandler(billingReq, response);
assert.equal(response.statusCode, 403, 'API payment submission must reject cross-account portfolio');

// Public portfolios are intentionally readable after publish; verify only the
// private/draft boundary here, then restore the fixture to draft before cleanup.
await admin.from('portfolios').delete().eq('id', portfolio.id);
await admin.from('manual_payment_requests').delete().eq('id', payment.id);
for (const id of created) await admin.auth.admin.deleteUser(id);
console.log('Local cross-account security passed: Portfolio, variants, payment requests, deploy API, analytics API, and billing API.');
