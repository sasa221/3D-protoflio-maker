import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const isWindows = process.platform === 'win32';
const npxCommand = isWindows ? (process.env.ComSpec || 'cmd.exe') : 'npx';

function supabaseCommand(subcommand) {
  return isWindows
    ? ['/d', '/s', '/c', `npx --yes supabase@latest ${subcommand}`]
    : ['--yes', 'supabase@latest', ...subcommand.split(' ')];
}

function readLocalStatus() {
  try {
    const output = execFileSync(npxCommand, supabaseCommand('status -o env'), {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    });
    const values = {};
    for (const line of output.split(/\r?\n/)) {
      const match = line.match(/^(API_URL|ANON_KEY|SERVICE_ROLE_KEY)="(.*)"$/);
      if (match) values[match[1]] = match[2];
    }
    return values;
  } catch (_) {
    return {};
  }
}

let local = readLocalStatus();
if (!/^http:\/\/(127\.0\.0\.1|localhost):54321$/.test(local.API_URL || '')) {
  // Start only the repository's Supabase Local stack; output is suppressed so
  // generated keys can never appear in test logs.
  execFileSync(npxCommand, supabaseCommand('start'), {
    cwd: root,
    stdio: 'ignore'
  });
  local = readLocalStatus();
}

if (!/^http:\/\/(127\.0\.0\.1|localhost):54321$/.test(local.API_URL || '') || !local.ANON_KEY || !local.SERVICE_ROLE_KEY) {
  throw new Error('Supabase Local is not ready. Start Docker and run `npx supabase@latest start`, then retry `npm run test:cv-real-browser`.');
}

const env = {
  ...process.env,
  SUPABASE_LOCAL_URL: local.API_URL,
  SUPABASE_LOCAL_ANON_KEY: local.ANON_KEY,
  SUPABASE_LOCAL_SERVICE_ROLE_KEY: local.SERVICE_ROLE_KEY
};

execFileSync(process.execPath, ['scripts/test_local_real_cv_import_browser.mjs'], {
  cwd: root,
  env,
  stdio: 'inherit'
});
