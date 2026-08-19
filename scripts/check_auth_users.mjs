// scripts/check_auth_users.mjs
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://kupxhrfijkdlcteniqfp.supabase.co';
const supabasePublishableKey = 'sb_publishable_gILAHxBLwwDjMoNpfLUbLg_fFKiE0f5';
const supabase = createClient(supabaseUrl, supabasePublishableKey);

async function checkUsers() {
  console.log('Querying public profiles in database...');
  const { data: profiles, error: pErr } = await supabase.from('profiles').select('id, email, display_name, created_at');
  if (pErr) {
    console.log('Error querying profiles:', pErr.message);
  } else {
    console.log('Profiles in DB count:', profiles.length);
    profiles.forEach(p => {
      console.log(`- Profile: id=${p.id}, email="${p.email}", name="${p.display_name}"`);
    });
  }
}

checkUsers();
