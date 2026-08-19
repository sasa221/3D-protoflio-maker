// scripts/test_phase8b_details.mjs
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://kupxhrfijkdlcteniqfp.supabase.co';
const supabasePublishableKey = 'sb_publishable_gILAHxBLwwDjMoNpfLUbLg_fFKiE0f5';
const supabase = createClient(supabaseUrl, supabasePublishableKey);

async function testDetails() {
  console.log('=== VERIFYING MANUAL_PAYMENT_REQUESTS COLUMNS ===');
  const { data, error } = await supabase.from('manual_payment_requests').select(`
    id,
    user_id,
    plan_id,
    group_seats,
    portfolio_id,
    expected_amount_egp,
    discount_amount_egp,
    final_expected_amount_egp,
    promo_code,
    promo_discount_percent,
    payment_method,
    proof_storage_path,
    proof_url,
    status,
    submitted_at,
    reviewed_by,
    reviewed_at,
    admin_reason,
    approved_period_start,
    approved_period_end,
    metadata,
    created_at,
    updated_at
  `).limit(1);

  if (error) {
    console.log('Columns verification ERROR:', error.message);
  } else {
    console.log('Columns verification: ALL 23 COLUMNS EXIST AND QUERYABLE (0 errors)');
  }

  console.log('\n=== VERIFYING STORAGE BUCKETS ===');
  const { data: buckets, error: bErr } = await supabase.storage.listBuckets();
  if (bErr) {
    console.log('listBuckets error:', bErr.message);
  } else {
    console.log('Buckets listed:', buckets.map(b => ({ id: b.id, name: b.name, public: b.public })));
  }

  console.log('\n=== TESTING ANON PROOF ACCESS ===');
  const { data: downloadData, error: dlErr } = await supabase.storage.from('payment_proofs').download('unauthorized/test.png');
  console.log('Anon proof download result:', dlErr ? `BLOCKED (${dlErr.message})` : 'ALLOWED');
}

testDetails();
