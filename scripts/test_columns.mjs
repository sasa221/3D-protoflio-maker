// scripts/test_columns.mjs
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://kupxhrfijkdlcteniqfp.supabase.co';
const supabasePublishableKey = 'sb_publishable_gILAHxBLwwDjMoNpfLUbLg_fFKiE0f5';
const supabase = createClient(supabaseUrl, supabasePublishableKey);

async function testCols() {
  console.log('Testing specific columns on public.portfolios...');
  const { error: colErr } = await supabase.from('portfolios').select('is_finalized, slot_number, is_archived').limit(1);
  console.log('portfolios columns (is_finalized, slot_number, is_archived):', colErr ? `MISSING (${colErr.message})` : 'EXISTS');

  const { error: subErr } = await supabase.from('subscriptions').select('group_id, grace_ends_at, metadata').limit(1);
  console.log('subscriptions columns (group_id, grace_ends_at, metadata):', subErr ? `MISSING (${subErr.message})` : 'EXISTS');
}

testCols();
