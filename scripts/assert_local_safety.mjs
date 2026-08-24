import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const developmentEnvPath = path.join(root, '.env.development.local');

function parseEnv(filePath) {
  if (!fs.existsSync(filePath)) return {};
  return Object.fromEntries(fs.readFileSync(filePath, 'utf8').split(/\r?\n/).flatMap(line => {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    return match ? [[match[1], match[2].replace(/^['"]|['"]$/g, '')]] : [];
  }));
}

if (!fs.existsSync(developmentEnvPath)) {
  throw new Error('Local safety check failed: create .env.development.local from .env.development.example before running the app.');
}

const env = parseEnv(developmentEnvPath);
if (!['true', '1'].includes(String(env.VITE_LOCAL_DEV_MODE).toLowerCase())) {
  throw new Error('Local safety check failed: VITE_LOCAL_DEV_MODE must be true.');
}
if (!['local', 'development'].includes(String(env.VITE_SUPABASE_ENV).toLowerCase())) {
  throw new Error('Local safety check failed: VITE_SUPABASE_ENV must be local or development.');
}
if (!env.VITE_SUPABASE_URL || /portfolio-maker-murex\.vercel\.app|kupxhrfijkdlcteniqfp\.supabase\.co|3dportfolio\.app/i.test(env.VITE_SUPABASE_URL)) {
  throw new Error('Local safety check failed: a Production host was found in the local Supabase URL.');
}

for (const key of ['SUPABASE_SECRET_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'BREVO_API_KEY', 'STRIPE_SECRET_KEY', 'VERCEL_TOKEN', 'VERCEL_OIDC_TOKEN']) {
  if (env[key]) throw new Error(`Local safety check failed: server/deployment credential ${key} is not allowed in .env.development.local.`);
}

console.log('Local safety check passed: local/development Supabase only; external email, payment, webhook, and deployment credentials are disabled.');

