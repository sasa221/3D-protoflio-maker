import { createClient } from '@supabase/supabase-js';

const RESERVED_SLUGS = new Set([
  'admin', 'api', 'login', 'studio', 'start', 'privacy', 'terms', 'reset-password'
]);

function validSlug(value) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) && !RESERVED_SLUGS.has(value);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const slug = String(req.query.slug || '').trim().toLowerCase();
  const variantSlug = String(req.query.variant || '').trim().toLowerCase();
  if (!validSlug(slug) || (variantSlug && !validSlug(variantSlug))) {
    return res.status(400).json({ error: 'Invalid portfolio path' });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://kupxhrfijkdlcteniqfp.supabase.co';
  const secretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secretKey) return res.status(503).json({ error: 'Public portfolio service is not configured' });

  try {
    const adminClient = createClient(supabaseUrl, secretKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
    const { data: portfolio, error } = await adminClient
      .from('portfolios')
      .select('id,slug,theme,master_profile_json,published_at,updated_at')
      .eq('slug', slug)
      .not('published_at', 'is', null)
      .maybeSingle();

    if (error) return res.status(500).json({ error: 'Unable to load portfolio' });
    if (!portfolio) return res.status(404).json({ error: 'Portfolio not found' });

    let variant = null;
    if (variantSlug) {
      const { data, error: variantError } = await adminClient
        .from('portfolio_variants')
        .select('slug,overrides_json')
        .eq('portfolio_id', portfolio.id)
        .eq('slug', variantSlug)
        .maybeSingle();
      if (variantError) return res.status(500).json({ error: 'Unable to load portfolio variant' });
      if (!data) return res.status(404).json({ error: 'Portfolio variant not found' });
      variant = data;
    }

    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
    return res.status(200).json({ portfolio, variant });
  } catch (_error) {
    return res.status(500).json({ error: 'Unable to load portfolio' });
  }
}
