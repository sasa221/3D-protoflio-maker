/**
 * RuntimeSafety.js
 *
 * Local Career Studio work must never accidentally talk to Production.
 * This module deliberately fails closed when a local build resolves a known
 * production endpoint or a server-only credential.
 */

const PRODUCTION_HOSTS = new Set([
  'portfolio-maker-murex.vercel.app',
  '3dportfolio.app',
  'www.3dportfolio.app',
  'kupxhrfijkdlcteniqfp.supabase.co'
]);

function readEnv(key) {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return import.meta.env[key];
  }
  if (typeof process !== 'undefined' && process.env) return process.env[key];
  return undefined;
}

export function isLocalRuntime() {
  const mode = readEnv('MODE') || readEnv('NODE_ENV') || 'production';
  return readEnv('VITE_LOCAL_DEV_MODE') === 'true'
    || readEnv('VITE_LOCAL_DEV_MODE') === '1'
    || mode === 'development'
    || mode === 'test';
}

export function isLocalAuthMockEnabled() {
  return isLocalRuntime() && ['true', '1'].includes(String(readEnv('VITE_LOCAL_AUTH_MOCK') || '').toLowerCase());
}

export function isProductionHost(value) {
  try {
    const hostname = new URL(value).hostname.toLowerCase();
    return PRODUCTION_HOSTS.has(hostname);
  } catch (_) {
    return false;
  }
}

export function getSafeSupabaseConfig() {
  const url = readEnv('VITE_SUPABASE_URL') || 'http://127.0.0.1:54321';
  const publishableKey = readEnv('VITE_SUPABASE_PUBLISHABLE_KEY') || 'local-dev-anon-key';
  const environment = readEnv('VITE_SUPABASE_ENV') || 'local';

  if (isLocalRuntime() && isProductionHost(url)) {
    throw new Error('Local runtime blocked: production Supabase URL detected. Configure a local or development Supabase project.');
  }
  if (!/^https?:\/\//i.test(url)) {
    throw new Error('Invalid Supabase URL. Use a local/development HTTP(S) URL.');
  }
  if (isLocalRuntime() && environment === 'production') {
    throw new Error('Local runtime blocked: VITE_SUPABASE_ENV=production is not allowed.');
  }

  return { url, publishableKey, environment };
}

export function assertNoBrowserSecretConfig() {
  const forbidden = ['SUPABASE_SECRET_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'BREVO_API_KEY', 'STRIPE_SECRET_KEY'];
  const found = forbidden.filter(key => readEnv(key));
  if (found.length) {
    throw new Error(`Browser runtime blocked: server-only credentials configured (${found.join(', ')}).`);
  }
}
