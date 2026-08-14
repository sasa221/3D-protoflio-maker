import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const slug = String(req.query.slug || req.query.username || '').trim().toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return res.status(400).json({ error: 'Invalid portfolio slug' });

  const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://kupxhrfijkdlcteniqfp.supabase.co';
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseSecretKey) return res.status(503).json({ error: 'Resume service is not configured' });
  const adminClient = createClient(supabaseUrl, supabaseSecretKey);

  try {
    // 1. Query portfolio by published slug
    const { data: pf, error: pfErr } = await adminClient
      .from('portfolios')
      .select('master_profile_json, published_at')
      .eq('slug', slug)
      .not('published_at', 'is', null)
      .maybeSingle();

    if (pfErr || !pf) {
      return res.status(404).json({ error: 'Portfolio not found' });
    }

    const masterProfile = pf.master_profile_json || {};
    const resume = masterProfile.resume;

    // 2. Check if resume is enabled / visible
    if (!resume || resume.hidden === true || !resume.storagePath) {
      return res.status(403).json({ error: 'Private resume — Download is disabled by owner' });
    }

    // 3. Generate 1-hour signed URL for private bucket
    const { data: signedData, error: signErr } = await adminClient.storage
      .from('resumes')
      .createSignedUrl(resume.storagePath, 3600);

    if (signErr || !signedData?.signedUrl) {
      return res.status(500).json({ error: 'Failed to generate secure resume URL' });
    }

    // Redirect to signed download URL
    return res.redirect(302, signedData.signedUrl);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
