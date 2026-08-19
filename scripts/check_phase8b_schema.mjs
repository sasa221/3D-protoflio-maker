// scripts/check_phase8b_schema.mjs
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://kupxhrfijkdlcteniqfp.supabase.co';
const supabasePublishableKey = 'sb_publishable_gILAHxBLwwDjMoNpfLUbLg_fFKiE0f5';
const supabase = createClient(supabaseUrl, supabasePublishableKey);

async function checkPhase8B() {
  console.log('=== PHASE 8B SCHEMA INSPECTION ===\n');

  const { data, error } = await supabase.from('manual_payment_requests').select('*').limit(1);
  if (error) {
    console.log('manual_payment_requests status: NOT FOUND or ERROR:', error.message);
  } else {
    console.log('manual_payment_requests status: EXISTS (0 errors, query successful)');
  }

  const { data: bucketData, error: bErr } = await supabase.storage.getBucket('payment_proofs');
  if (bErr) {
    console.log('payment_proofs bucket status:', bErr.message);
  } else {
    console.log('payment_proofs bucket status: EXISTS, public =', bucketData.public);
  }
}

checkPhase8B();
