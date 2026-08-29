import assert from 'node:assert/strict';
import { applyCors } from '../../api/_cors.js';

function response() { const headers = {}; return { headers, setHeader(key, value) { headers[key] = value; } }; }
const oldEnv = { CORS_ORIGINS: process.env.CORS_ORIGINS, VERCEL_ENV: process.env.VERCEL_ENV, NODE_ENV: process.env.NODE_ENV };
try {
  process.env.CORS_ORIGINS = 'https://staging.example.com,https://portfolio-maker-murex.vercel.app';
  process.env.VERCEL_ENV = 'production';
  process.env.NODE_ENV = 'production';
  const allowed = response(); applyCors({ headers: { origin: 'https://staging.example.com' } }, allowed);
  assert.equal(allowed.headers['Access-Control-Allow-Origin'], 'https://staging.example.com');
  const denied = response(); applyCors({ headers: { origin: 'https://evil.example.com' } }, denied);
  assert.equal(denied.headers['Access-Control-Allow-Origin'], undefined);
  const wildcard = response(); applyCors({ headers: { origin: '*' } }, wildcard);
  assert.notEqual(wildcard.headers['Access-Control-Allow-Origin'], '*');
  process.env.VERCEL_ENV = 'development'; process.env.NODE_ENV = 'development';
  const local = response(); applyCors({ headers: { origin: 'http://localhost:5173' } }, local);
  assert.equal(local.headers['Access-Control-Allow-Origin'], 'http://localhost:5173');
  console.log('CorsPolicyTestSuite: passed (exact production allowlist, local development origin, no wildcard)');
} finally {
  for (const [key, value] of Object.entries(oldEnv)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
}
