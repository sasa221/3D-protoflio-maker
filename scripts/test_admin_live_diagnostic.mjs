// scripts/test_admin_live_diagnostic.mjs
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://kupxhrfijkdlcteniqfp.supabase.co';
// Read from local env or process
const ANON_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('=== ADMIN DIAGNOSTIC RUNNER ===');
console.log('SUPABASE_URL:', SUPABASE_URL);
console.log('ANON_KEY present:', Boolean(ANON_KEY));
console.log('SERVICE_KEY present:', Boolean(SERVICE_KEY));

async function runDirectDbAudit() {
  if (!SERVICE_KEY) {
    console.log('No local SERVICE_KEY in process.env, checking local .env or fallback...');
  }
}

runDirectDbAudit().catch(console.error);
