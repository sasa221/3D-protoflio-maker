import { createClient } from '@supabase/supabase-js';

// Plan capabilities inline (serverless can't import from src/)
const HOSTING_PLANS = new Set(['pro', 'premium', 'premium_group']);
const PLAN_PORTFOLIO_LIMITS = { free: 1, pro: 1, premium: -1, premium_group: -1 };

function isServerFeatureEnabled(flagName) {
  const val = process.env[`FF_${flagName}`];
  return val === 'true' || val === '1';
}

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
    const { action, portfolioId, slug, masterProfile } = req.body || {};

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
    const { data: existingPf } = await adminClient.from('portfolios').select('owner_user_id,master_profile_json,is_finalized').eq('id', portfolioId).maybeSingle();

    if (existingPf && existingPf.owner_user_id !== userId) {
      return res.status(403).json({ error: 'Forbidden — You do not own this portfolio' });
    }

    // 3. Get subscription and determine effective plan
    const { data: subscription } = await adminClient
      .from('subscriptions')
      .select('plan_id,status,group_id')
      .eq('user_id', userId)
      .maybeSingle();

    let effectivePlan = subscription?.plan_id || 'free';
    const subStatus = subscription?.status || 'active';
    const isActiveSubscription = subStatus === 'active' || subStatus === 'grace' || subStatus === 'canceling';

    // Check group membership for premium_group resolution
    if (effectivePlan !== 'premium' && effectivePlan !== 'pro') {
      const { data: membership } = await adminClient
        .from('group_members')
        .select('group_id')
        .eq('user_id', userId)
        .eq('status', 'active')
        .maybeSingle();
      if (membership) {
        const { data: group } = await adminClient
          .from('groups')
          .select('status')
          .eq('id', membership.group_id)
          .eq('status', 'active')
          .maybeSingle();
        if (group) effectivePlan = 'premium';
      }
    }

    const isPaidPlan = HOSTING_PLANS.has(effectivePlan) && isActiveSubscription;

    // 4. Handle export consumption
    if (action === 'consume_export') {
      if (!existingPf) return res.status(404).json({ error: 'Portfolio not found' });
      if (isPaidPlan) return res.status(200).json({ success: true, unlimited: true });

      const month = new Date().toISOString().slice(0, 7);
      const storedProfile = existingPf.master_profile_json || {};
      const usage = storedProfile.exportUsage || {};
      const count = usage.month === month ? Number(usage.count || 0) : 0;
      // Free HTML export is unlimited per spec
      storedProfile.exportUsage = { month, count: count + 1 };
      const { error: usageError } = await adminClient
        .from('portfolios')
        .update({ master_profile_json: storedProfile, updated_at: new Date().toISOString() })
        .eq('id', portfolioId)
        .eq('owner_user_id', userId);
      if (usageError) return res.status(500).json({ error: 'Unable to record export usage.' });
      return res.status(200).json({ success: true, usage: storedProfile.exportUsage });
    }

    // 5. Hosting paywall enforcement
    if (isServerFeatureEnabled('HOSTING_PAYWALL_ENABLED')) {
      if (!isPaidPlan) {
        // Check Keep It Live
        const { data: kil } = await adminClient
          .from('keep_live_entitlements')
          .select('status')
          .eq('portfolio_id', portfolioId)
          .eq('user_id', userId)
          .eq('status', 'active')
          .maybeSingle();

        if (kil) {
          // Keep It Live: existing content stays, but no new publishes
          return res.status(403).json({ error: 'Publishing changes is locked. Renew your subscription to update your portfolio.' });
        }

        return res.status(403).json({ error: 'Online publishing is available with Pro.' });
      }
    }

    // 6. Free finalization check
    if (isServerFeatureEnabled('FREE_FINALIZATION_LOCK_ENABLED')) {
      if (effectivePlan === 'free' && existingPf?.is_finalized) {
        return res.status(403).json({ error: 'Editing is locked for this finalized Free portfolio. Upgrade to Pro to continue editing.' });
      }
    }

    // 7. Portfolio limit check for new portfolios
    if (!existingPf) {
      const portfolioLimit = PLAN_PORTFOLIO_LIMITS[effectivePlan] ?? 1;

      if (effectivePlan === 'free' && isServerFeatureEnabled('ENTITLEMENT_ENFORCEMENT_ENABLED')) {
        // Free: check lifetime creation history
        const { count: totalCreated } = await adminClient
          .from('portfolio_creation_history')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('action', 'create');
        if ((totalCreated || 0) >= 1) {
          return res.status(403).json({ error: 'The Free plan includes one portfolio. Upgrade to Pro for a hosted portfolio.' });
        }
      } else if (effectivePlan === 'pro' && isServerFeatureEnabled('ENTITLEMENT_ENFORCEMENT_ENABLED')) {
        // Pro: check persistent slot creation history (prevent delete -> create loop)
        const { count: totalCreated } = await adminClient
          .from('portfolio_creation_history')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('action', 'create');
        if ((totalCreated || 0) >= 1) {
          return res.status(403).json({ error: 'Your Pro subscription includes one persistent portfolio slot. You can edit, reset, or restore your existing slot, or upgrade to Premium for multiple portfolios.' });
        }
      } else if (portfolioLimit !== -1) {
        const { count: portfolioCount } = await adminClient
          .from('portfolios')
          .select('id', { count: 'exact', head: true })
          .eq('owner_user_id', userId);
        if ((portfolioCount || 0) >= portfolioLimit) {
          return res.status(403).json({ error: `Your plan allows ${portfolioLimit} portfolio${portfolioLimit === 1 ? '' : 's'}.` });
        }
      }

      // Record creation in history
      try {
        await adminClient.from('portfolio_creation_history').insert([{
          user_id: userId,
          portfolio_id: portfolioId,
          action: 'create'
        }]);
      } catch (_) {}
    }

    // 8. Build published profile
    const safeMasterProfile = JSON.parse(JSON.stringify(masterProfile || {}));
    safeMasterProfile.isPro = isPaidPlan;
    safeMasterProfile.hideWatermark = isPaidPlan && Boolean(safeMasterProfile.hideWatermark);
    safeMasterProfile.hideThemeBadge = isPaidPlan && Boolean(safeMasterProfile.hideThemeBadge);

    const publishedAt = new Date().toISOString();
    const publishedSnapshot = JSON.parse(JSON.stringify(safeMasterProfile));
    delete publishedSnapshot.publishedProfile;
    safeMasterProfile.publishedProfile = publishedSnapshot;
    safeMasterProfile.publishedAt = publishedAt;

    // 9. Mark published in Supabase Postgres
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
