import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Unauthorized — Auth token required' });

  const token = authHeader.replace('Bearer ', '');
  const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://kupxhrfijkdlcteniqfp.supabase.co';
  const supabaseAnonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY || supabaseAnonKey;

  try {
    // 1. Authenticate JWT session
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();

    if (userErr || !userData.user) {
      return res.status(401).json({ error: 'Unauthorized user session' });
    }

    const userId = userData.user.id;
    const { portfolioId, slug, masterProfile } = req.body || {};

    if (!portfolioId || !slug) {
      return res.status(400).json({ error: 'Missing portfolioId or slug' });
    }

    // 2. Server-side ownership check
    const adminClient = createClient(supabaseUrl, supabaseSecretKey);
    const { data: existingPf } = await adminClient.from('portfolios').select('owner_user_id').eq('id', portfolioId).single();

    if (existingPf && existingPf.owner_user_id !== userId) {
      return res.status(403).json({ error: 'Forbidden — You do not own this portfolio' });
    }

    const publishedAt = new Date().toISOString();

    // 3. Mark published in Supabase Postgres
    const { data: updatedPf, error: updateErr } = await adminClient.from('portfolios').upsert([
      {
        id: portfolioId,
        owner_user_id: userId,
        name: masterProfile?.name || 'Candidate Portfolio',
        slug: slug,
        profession: masterProfile?.profession || 'Developer',
        bio: masterProfile?.bio || '',
        theme: masterProfile?.theme || 'code',
        master_profile_json: masterProfile || {},
        published_at: publishedAt,
        updated_at: publishedAt
      }
    ]).select();

    if (updateErr) {
      return res.status(500).json({ error: `Deploy failed: ${updateErr.message}` });
    }

    const deployedUrl = `https://portfolio-maker.vercel.app/u/${slug}`;

    return res.status(200).json({
      success: true,
      url: deployedUrl,
      publishedAt: publishedAt,
      portfolio: updatedPf[0]
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
