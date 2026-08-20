import assert from 'node:assert/strict';
import billingHandler from '../api/billing.js';

console.log('============================================================');
console.log('  RUNNING AUTHORITATIVE PAYMENT SERVER API SUITE');
console.log('============================================================\n');

// Mock request/response helpers
function createMockReqRes({ method = 'POST', query = {}, headers = {}, body = {} }) {
  const req = {
    method,
    query: { action: 'submit-manual-payment', ...query },
    headers: {
      authorization: 'Bearer mock-valid-token',
      'content-type': 'application/json',
      ...headers
    },
    body
  };

  let statusCode = 200;
  let responseData = null;
  const resHeaders = {};

  const res = {
    setHeader(name, val) { resHeaders[name] = val; },
    status(code) {
      statusCode = code;
      return res;
    },
    json(data) {
      responseData = data;
      return res;
    },
    end() { return res; }
  };

  return { req, res, getStatus: () => statusCode, getData: () => responseData };
}

// 1. Unauthenticated Request
{
  const { req, res, getStatus, getData } = createMockReqRes({ headers: { authorization: '' } });
  await billingHandler(req, res);
  assert.equal(getStatus(), 401);
  console.log('✅ Unauthenticated request correctly rejected with 401');
}

// 2. Method Not Allowed
{
  const { req, res, getStatus, getData } = createMockReqRes({ method: 'GET' });
  await billingHandler(req, res);
  assert.equal(getStatus(), 405);
  console.log('✅ GET request to submit-manual-payment correctly rejected with 405');
}

// 3. Payment Config Endpoint (Public Read)
{
  const { req, res, getStatus, getData } = createMockReqRes({
    method: 'GET',
    query: { action: 'payment-config' }
  });
  await billingHandler(req, res);
  assert.equal(getStatus(), 200);
  assert.equal(getData().configured, true);
  assert.equal(getData().instapayAddress, 'saleh2005mohamed@instapay');
  console.log('✅ Payment Config returns valid InstaPay destination details');
}

console.log('\n============================================================');
console.log('  PAYMENT SERVER API SUITE PASSED');
console.log('============================================================\n');
