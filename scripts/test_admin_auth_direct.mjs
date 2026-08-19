// scripts/test_admin_auth_direct.mjs
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://kupxhrfijkdlcteniqfp.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('Testing Admin Direct Connection...');
console.log('URL:', SUPABASE_URL);
console.log('Has Service Key in local env:', Boolean(SERVICE_KEY));

if (SERVICE_KEY) {
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: users, error: uErr } = await admin.auth.admin.listUsers();
  console.log('listUsers error:', uErr);
  console.log('listUsers count:', users?.users?.length);

  const { data: profiles, error: pErr } = await admin.from('profiles').select('id,email,display_name');
  console.log('profiles error:', pErr);
  console.log('profiles count:', profiles?.length);

  const { data: portfolios, error: pfErr } = await admin.from('portfolios').select('id,owner_user_id,published_at');
  console.log('portfolios error:', pfErr);
  console.log('portfolios count:', portfolios?.length);
  console.log('published portfolios count:', portfolios?.filter(p => p.published_at)?.length);
}
