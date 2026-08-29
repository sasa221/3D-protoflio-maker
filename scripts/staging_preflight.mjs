import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const requiredNames = [
  'VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_SECRET_KEY',
  'AUTH_REDIRECT_URL', 'CORS_ORIGINS', 'BREVO_API_KEY', 'BREVO_SENDER_EMAIL',
  'BREVO_SENDER_NAME', 'VITE_ENABLE_BILLING_PORTAL', 'VITE_SENTRY_DSN',
  'SENTRY_AUTH_TOKEN'
];
const failures = [];
const pass = message => console.log(`PASS: ${message}`);
const fail = message => { failures.push(message); console.log(`FAIL: ${message}`); };

const runbook = fs.readFileSync(path.join(root, 'docs', 'CLOSED_BETA_STAGING_RUNBOOK.md'), 'utf8');
for (const name of requiredNames) {
  if (runbook.includes(name)) pass(`runbook documents ${name}`);
  else fail(`runbook is missing ${name}`);
}

const distRoot = path.join(root, 'dist');
const files = [];
function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const target = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(target);
    else files.push(target);
  }
}
walk(distRoot);
const distText = files.filter(file => /\.(?:js|mjs|html|css)$/.test(file)).map(file => fs.readFileSync(file, 'utf8')).join('\n');
if (/https:\/\/[a-z0-9-]+\.supabase\.co/i.test(distText)) fail('client bundle contains a concrete Supabase cloud URL');
else pass('client bundle has no concrete Supabase cloud URL');
if (/Access-Control-Allow-Origin.{0,40}\*/i.test(distText)) fail('client bundle contains wildcard CORS configuration');
else pass('client bundle has no wildcard CORS configuration');
if (/SUPABASE_SECRET_KEY\s*[:=]\s*['"][^'"]+['"]|BREVO_API_KEY\s*[:=]\s*['"][^'"]+['"]/i.test(distText)) fail('client bundle contains a server secret value');
else pass('client bundle has no server secret value');

const migrationDir = path.join(root, 'supabase', 'migrations');
const migrations = fs.existsSync(migrationDir) ? fs.readdirSync(migrationDir).filter(name => name.endsWith('.sql')).sort() : [];
for (const name of migrations) {
  if (name.includes('email_preferences_campaigns')) {
    pass(`${name} remains excluded from this staging package`);
    continue;
  }
  const sql = fs.readFileSync(path.join(migrationDir, name), 'utf8');
  if (/\bDROP\s+TABLE\b|\bDROP\s+COLUMN\b|\bTRUNCATE\b|\bDELETE\s+FROM\b/i.test(sql)) fail(`${name} contains a destructive statement`);
  else pass(`${name} has no destructive statement`);
}

if (failures.length) {
  console.error(`Staging preflight failed: ${failures.length} issue(s)`);
  process.exit(1);
}
console.log('Staging preflight passed (no external connections or mutations performed).');
