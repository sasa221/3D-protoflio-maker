// Origin allowlist for serverless endpoints. Same-origin browser requests do
// not need a CORS header; localhost is allowed only outside production.
export function applyCors(req, res, { methods = 'GET, POST, OPTIONS', headers = 'Authorization, Content-Type' } = {}) {
  const origin = String(req?.headers?.origin || '').trim();
  const configured = String(process.env.CORS_ORIGINS || process.env.ALLOWED_ORIGINS || '').split(',').map(value => value.trim()).filter(Boolean);
  const isLocal = /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/i.test(origin);
  const production = process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production';
  const allowed = configured.includes(origin) || (!production && isLocal);
  if (origin && allowed) { res.setHeader('Access-Control-Allow-Origin', origin); res.setHeader('Vary', 'Origin'); }
  res.setHeader('Access-Control-Allow-Methods', methods);
  res.setHeader('Access-Control-Allow-Headers', headers);
}
