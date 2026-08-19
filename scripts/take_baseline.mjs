// scripts/take_baseline.mjs
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://kupxhrfijkdlcteniqfp.supabase.co';
const supabasePublishableKey = 'sb_publishable_gILAHxBLwwDjMoNpfLUbLg_fFKiE0f5';

const supabase = createClient(supabaseUrl, supabasePublishableKey);

async function main() {
  console.log('=== TAKING PRODUCTION BASELINE ===\n');

  // 1. Profiles
  const { data: profiles, error: pErr } = await supabase.from('profiles').select('id, email, display_name, username, is_admin, created_at');
  console.log('Profiles Count:', profiles?.length || 0, pErr ? `(Error: ${pErr.message})` : '');
  
  // 2. Portfolios
  const { data: portfolios, error: portErr } = await supabase.from('portfolios').select('id, owner_user_id, name, slug, theme, published_at, created_at, updated_at');
  console.log('Portfolios Count:', portfolios?.length || 0, portErr ? `(Error: ${portErr.message})` : '');

  const published = (portfolios || []).filter(p => !!p.published_at);
  const drafts = (portfolios || []).filter(p => !p.published_at);
  const slugs = (portfolios || []).map(p => p.slug);
  const themes = (portfolios || []).map(p => p.theme);

  console.log('Published Portfolios:', published.length);
  console.log('Draft Portfolios:', drafts.length);
  console.log('Existing Slugs:', slugs);
  console.log('Existing Themes in Use:', [...new Set(themes)]);

  // Check if unmigrated tables currently exist
  const { error: gErr } = await supabase.from('groups').select('id').limit(1);
  console.log('groups table exists:', !gErr || !gErr.message.includes('does not exist'));

  const { error: kErr } = await supabase.from('keep_live_entitlements').select('id').limit(1);
  console.log('keep_live_entitlements table exists:', !kErr || !kErr.message.includes('does not exist'));

  const { error: prErr } = await supabase.from('promo_codes').select('id').limit(1);
  console.log('promo_codes table exists:', !prErr || !prErr.message.includes('does not exist'));
}

main();
