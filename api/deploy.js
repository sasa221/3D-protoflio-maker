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
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseAnonKey || !supabaseSecretKey) {
    return res.status(503).json({ error: 'Publishing service is not configured' });
  }

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

    const cleanSlug = String(slug).trim().toLowerCase();
    const reservedSlugs = new Set(['admin', 'api', 'login', 'studio', 'start', 'privacy', 'terms', 'reset-password']);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(cleanSlug) || reservedSlugs.has(cleanSlug)) {
      return res.status(400).json({ error: 'Choose a valid public slug using letters, numbers, and single hyphens.' });
    }

    // 2. Server-side ownership check
    const adminClient = createClient(supabaseUrl, supabaseSecretKey);
    const { data: existingPf } = await adminClient.from('portfolios').select('owner_user_id').eq('id', portfolioId).single();

    if (existingPf && existingPf.owner_user_id !== userId) {
      return res.status(403).json({ error: 'Forbidden — You do not own this portfolio' });
    }

    const { data: subscription } = await adminClient
      .from('subscriptions')
      .select('plan_id,status')
      .eq('user_id', userId)
      .maybeSingle();

    const isPro = subscription?.plan_id === 'pro' && subscription?.status === 'active';

    if (!existingPf) {
      const { count: portfolioCount } = await adminClient
        .from('portfolios')
        .select('id', { count: 'exact', head: true })
        .eq('owner_user_id', userId);
      const portfolioLimit = isPro ? 10 : 1;
      if ((portfolioCount || 0) >= portfolioLimit) {
        return res.status(403).json({ error: `Your plan allows ${portfolioLimit} portfolio${portfolioLimit === 1 ? '' : 's'}.` });
      }
    }
    const safeMasterProfile = JSON.parse(JSON.stringify(masterProfile || {}));
    safeMasterProfile.isPro = isPro;
    safeMasterProfile.hideWatermark = isPro && Boolean(safeMasterProfile.hideWatermark);
    safeMasterProfile.hideThemeBadge = isPro && Boolean(safeMasterProfile.hideThemeBadge);

    const publishedAt = new Date().toISOString();
    const publishedSnapshot = JSON.parse(JSON.stringify(safeMasterProfile));
    delete publishedSnapshot.publishedProfile;
    safeMasterProfile.publishedProfile = publishedSnapshot;
    safeMasterProfile.publishedAt = publishedAt;

    // 3. Mark published in Supabase Postgres
    const { data: updatedPf, error: updateErr } = await adminClient.from('portfolios').upsert([
      {
        id: portfolioId,
        owner_user_id: userId,
        name: safeMasterProfile.name || 'Candidate Portfolio',
        slug: cleanSlug,
        profession: safeMasterProfile.profession || 'Developer',
        bio: safeMasterProfile.bio || '',
        theme: safeMasterProfile.theme || 'code',
        master_profile_json: safeMasterProfile,
        published_at: publishedAt,
        updated_at: publishedAt
      }
    ]).select();

    if (updateErr) {
      return res.status(500).json({ error: `Deploy failed: ${updateErr.message}` });
    }

    const publicOrigin = (process.env.PUBLIC_SITE_URL || 'https://portfolio-maker-murex.vercel.app').replace(/\/$/, '');
    const deployedUrl = `${publicOrigin}/u/${cleanSlug}`;

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
