// scripts/test_live_admin_endpoints.mjs
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://kupxhrfijkdlcteniqfp.supabase.co';
const ANON_KEY = 'sb_publishable_gILAHxBLwwDjMoNpfLUbLg_fFKiE0f5';
const BASE_URL = 'https://portfolio-maker-murex.vercel.app';

const supabase = createClient(SUPABASE_URL, ANON_KEY);

async function testAdmin() {
  console.log('Logging in as canonical admin...');
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'saleh2005mohamed@gmail.com',
    password: 'Saleh@2025'
  });

  if (error || !data?.session) {
    console.error('Login error:', error);
    return;
  }

  const token = data.session.access_token;
  console.log('Login successful! User ID:', data.user.id);
  console.log('Token length:', token.length);

  const endpoints = [
    '/api/admin?action=me',
    '/api/admin?action=overview',
    '/api/admin?action=users',
    '/api/admin?action=portfolios',
    '/api/admin?action=groups',
    '/api/admin?action=promos',
    '/api/admin?action=payment-requests'
  ];

  for (const ep of endpoints) {
    console.log(`\n----------------------------------------`);
    console.log(`Calling ${BASE_URL}${ep}...`);
    try {
      const res = await fetch(`${BASE_URL}${ep}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      console.log('HTTP Status:', res.status);
      const body = await res.json();
      console.log('Response Body:', JSON.stringify(body, null, 2));
    } catch (e) {
      console.error('Fetch failed:', e);
    }
  }
}

testAdmin().catch(console.error);
