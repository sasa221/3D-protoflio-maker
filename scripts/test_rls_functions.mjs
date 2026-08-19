// scripts/test_rls_functions.mjs
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://kupxhrfijkdlcteniqfp.supabase.co';
const supabasePublishableKey = 'sb_publishable_gILAHxBLwwDjMoNpfLUbLg_fFKiE0f5';
const anonSupabase = createClient(supabaseUrl, supabasePublishableKey);

async function testFunctions() {
  console.log('Testing RPC / direct function execution with anon key...');
  
  const { data: memberRes, error: memberErr } = await anonSupabase.rpc('is_group_member', {
    check_group_id: 'grp_123',
    check_user_id: '00000000-0000-0000-0000-000000000000'
  });
  console.log('Anon is_group_member RPC execution:', memberErr ? `BLOCKED (${memberErr.message})` : `ALLOWED (${memberRes})`);

  const { data: ownerRes, error: ownerErr } = await anonSupabase.rpc('is_group_owner', {
    check_group_id: 'grp_123',
    check_user_id: '00000000-0000-0000-0000-000000000000'
  });
  console.log('Anon is_group_owner RPC execution:', ownerErr ? `BLOCKED (${ownerErr.message})` : `ALLOWED (${ownerRes})`);

  console.log('\nTesting direct queries on groups and group_members:');
  const { data: gData, error: gErr } = await anonSupabase.from('groups').select('*');
  console.log('Anon groups query:', gErr ? `Error: ${gErr.message}` : `Success (${gData.length} rows returned)`);

  const { data: gmData, error: gmErr } = await anonSupabase.from('group_members').select('*');
  console.log('Anon group_members query:', gmErr ? `Error: ${gmErr.message}` : `Success (${gmData.length} rows returned)`);
}

testFunctions();
