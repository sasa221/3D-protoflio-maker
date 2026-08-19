// scripts/inspect_schema.mjs
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://kupxhrfijkdlcteniqfp.supabase.co';
const supabasePublishableKey = 'sb_publishable_gILAHxBLwwDjMoNpfLUbLg_fFKiE0f5';

const supabase = createClient(supabaseUrl, supabasePublishableKey);

async function main() {
  console.log('=== INSPECTING SCHEMA & DATA ===\n');

  // Check profiles with select('*')
  const { data: profiles, error: profErr } = await supabase.from('profiles').select('*');
  console.log('Profiles select(*):', profErr ? `Error: ${profErr.message}` : `${profiles?.length} rows`);
  if (profiles && profiles.length > 0) {
    console.log('Profile columns:', Object.keys(profiles[0]));
    console.log('Profiles count:', profiles.length);
  }

  // Check portfolios with select('*')
  const { data: portfolios, error: portErr } = await supabase.from('portfolios').select('*');
  console.log('Portfolios select(*):', portErr ? `Error: ${portErr.message}` : `${portfolios?.length} rows`);
  if (portfolios && portfolios.length > 0) {
    console.log('Portfolio columns:', Object.keys(portfolios[0]));
    console.log('Portfolios count:', portfolios.length);
    portfolios.forEach(p => {
      console.log(`- ID: ${p.id}, Owner: ${p.owner_user_id}, Name: ${p.name}, Slug: ${p.slug}, Theme: ${p.theme}, Published: ${p.published_at || 'null'}`);
    });
  }

  // Check portfolio_variants
  const { data: variants, error: vErr } = await supabase.from('portfolio_variants').select('*');
  console.log('portfolio_variants:', vErr ? `Error: ${vErr.message}` : `${variants?.length} rows`);

  // Check Phase 8A tables:
  const tables = [
    'groups',
    'group_members',
    'portfolio_creation_history',
    'keep_live_entitlements',
    'promo_codes',
    'promo_redemptions',
    'entitlement_audit_log'
  ];

  for (const t of tables) {
    const { data, error } = await supabase.from(t).select('*').limit(5);
    console.log(`Table '${t}':`, error ? `Error: ${error.message}` : `OK (${data?.length} rows)`);
  }
}

main();
