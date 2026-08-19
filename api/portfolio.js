import { createClient } from '@supabase/supabase-js';
import dns from 'dns';
import { promisify } from 'util';

const resolveCname = promisify(dns.resolveCname);

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb'
    }
  }
};

const HOSTING_PLANS = new Set(['pro', 'premium', 'premium_group']);
const PLAN_PORTFOLIO_LIMITS = { free: 1, pro: 1, premium: -1, premium_group: -1 };

function isServerFeatureEnabled(flagName) {
  const val = process.env[`FF_${flagName}`];
  return val === 'true' || val === '1';
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const action = req.query.action || 'deploy';
  const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://kupxhrfijkdlcteniqfp.supabase.co';
  const supabaseAnonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey;

  // ─────────────────────────────────────────────────────────────
  // 1. ACTION: DEPLOY (Publish Portfolio)
  // ─────────────────────────────────────────────────────────────
  if (action === 'deploy') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Unauthorized — Auth token required' });
    const token = authHeader.replace('Bearer ', '');

    try {
      const userClient = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: `Bearer ${token}` } } });
      const { data: userData, error: userErr } = await userClient.auth.getUser();
      if (userErr || !userData.user) return res.status(401).json({ error: 'Unauthorized user session' });

      if (!userData.user.email_confirmed_at && !userData.user.confirmed_at && !userData.user.user_metadata?.email_verified) {
        return res.status(403).json({ error: 'Email verification required before deploying portfolios' });
      }

      const userId = userData.user.id;
      const { action: deployAction, portfolioId, slug, masterProfile } = req.body || {};
      if (!portfolioId || !slug) return res.status(400).json({ error: 'Missing portfolioId or slug' });

      const cleanSlug = String(slug).trim().toLowerCase();
      const reservedSlugs = new Set(['admin', 'api', 'login', 'studio', 'start', 'privacy', 'terms', 'reset-password']);
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(cleanSlug) || reservedSlugs.has(cleanSlug)) {
        return res.status(400).json({ error: 'Choose a valid public slug using letters, numbers, and single hyphens.' });
      }

      const adminClient = createClient(supabaseUrl, supabaseSecretKey);
      const { data: existingPf } = await adminClient.from('portfolios').select('owner_user_id,master_profile_json,is_finalized').eq('id', portfolioId).maybeSingle();
      if (existingPf && existingPf.owner_user_id !== userId) {
        return res.status(403).json({ error: 'Forbidden — You do not own this portfolio' });
      }

      const { data: subscription } = await adminClient.from('subscriptions').select('plan_id,status,group_id').eq('user_id', userId).maybeSingle();
      let effectivePlan = subscription?.plan_id || 'free';
      const subStatus = subscription?.status || 'active';
      const isActiveSubscription = subStatus === 'active' || subStatus === 'grace' || subStatus === 'canceling';

      if (effectivePlan !== 'premium' && effectivePlan !== 'pro') {
        const { data: membership } = await adminClient.from('group_members').select('group_id').eq('user_id', userId).eq('status', 'active').maybeSingle();
        if (membership) {
          const { data: group } = await adminClient.from('groups').select('status').eq('id', membership.group_id).eq('status', 'active').maybeSingle();
          if (group) effectivePlan = 'premium';
        }
      }

      const isPaidPlan = HOSTING_PLANS.has(effectivePlan) && isActiveSubscription;

      if (deployAction === 'consume_export') {
        if (!existingPf) return res.status(404).json({ error: 'Portfolio not found' });
        if (isPaidPlan) return res.status(200).json({ success: true, unlimited: true });

        const month = new Date().toISOString().slice(0, 7);
        const storedProfile = existingPf.master_profile_json || {};
        const usage = storedProfile.exportUsage || {};
        const count = usage.month === month ? Number(usage.count || 0) : 0;
        storedProfile.exportUsage = { month, count: count + 1 };
        await adminClient.from('portfolios').update({ master_profile_json: storedProfile, updated_at: new Date().toISOString() }).eq('id', portfolioId).eq('owner_user_id', userId);
        return res.status(200).json({ success: true, usage: storedProfile.exportUsage });
      }

      if (isServerFeatureEnabled('HOSTING_PAYWALL_ENABLED') && !isPaidPlan) {
        const { data: kil } = await adminClient.from('keep_live_entitlements').select('status').eq('portfolio_id', portfolioId).eq('user_id', userId).eq('status', 'active').maybeSingle();
        if (kil) return res.status(403).json({ error: 'Publishing changes is locked. Renew your subscription to update your portfolio.' });
        return res.status(403).json({ error: 'Online publishing is available with Pro.' });
      }

      if (isServerFeatureEnabled('FREE_FINALIZATION_LOCK_ENABLED') && effectivePlan === 'free' && existingPf?.is_finalized) {
        return res.status(403).json({ error: 'Editing is locked for this finalized Free portfolio. Upgrade to Pro to continue editing.' });
      }

      if (!existingPf) {
        const portfolioLimit = PLAN_PORTFOLIO_LIMITS[effectivePlan] ?? 1;
        if (effectivePlan === 'free' && isServerFeatureEnabled('ENTITLEMENT_ENFORCEMENT_ENABLED')) {
          const { count } = await adminClient.from('portfolio_creation_history').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('action', 'create');
          if ((count || 0) >= 1) return res.status(403).json({ error: 'The Free plan includes one portfolio. Upgrade to Pro for a hosted portfolio.' });
        } else if (effectivePlan === 'pro' && isServerFeatureEnabled('ENTITLEMENT_ENFORCEMENT_ENABLED')) {
          const { count } = await adminClient.from('portfolio_creation_history').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('action', 'create');
          if ((count || 0) >= 1) return res.status(403).json({ error: 'Your Pro subscription includes one persistent portfolio slot. You can edit, reset, or restore your existing slot, or upgrade to Premium for multiple portfolios.' });
        }
        try {
          await adminClient.from('portfolio_creation_history').insert([{ user_id: userId, portfolio_id: portfolioId, action: 'create' }]);
        } catch (_) {}
      }

      const safeMasterProfile = JSON.parse(JSON.stringify(masterProfile || {}));
      safeMasterProfile.isPro = isPaidPlan;
      safeMasterProfile.hideWatermark = isPaidPlan && Boolean(safeMasterProfile.hideWatermark);
      safeMasterProfile.hideThemeBadge = isPaidPlan && Boolean(safeMasterProfile.hideThemeBadge);

      const publishedAt = new Date().toISOString();
      const publishedSnapshot = JSON.parse(JSON.stringify(safeMasterProfile));
      delete publishedSnapshot.publishedProfile;
      safeMasterProfile.publishedProfile = publishedSnapshot;
      safeMasterProfile.publishedAt = publishedAt;

      const { data: updatedPf, error: updateErr } = await adminClient.from('portfolios').upsert([{
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
      }]).select();

      if (updateErr) return res.status(500).json({ error: `Deploy failed: ${updateErr.message}` });
      const publicOrigin = (process.env.PUBLIC_SITE_URL || 'https://portfolio-maker-murex.vercel.app').replace(/\/$/, '');
      return res.status(200).json({ success: true, url: `${publicOrigin}/u/${cleanSlug}`, publishedAt, portfolio: updatedPf[0] });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 2. ACTION: UPLOAD-AVATAR
  // ─────────────────────────────────────────────────────────────
  if (action === 'upload-avatar') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const authHeader = req.headers.authorization || req.headers.Authorization;
    if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
      return res.status(401).json({ error: 'Unauthorized — Auth Bearer token required' });
    }
    const token = authHeader.replace(/^bearer\s+/i, '').trim();

    try {
      const adminClient = createClient(supabaseUrl, supabaseSecretKey, { auth: { autoRefreshToken: false, persistSession: false } });
      const { data: userData, error: userErr } = await adminClient.auth.getUser(token);
      if (userErr || !userData?.user?.id) return res.status(401).json({ error: 'Unauthorized user session' });

      if (!userData.user.email_confirmed_at && !userData.user.confirmed_at && !userData.user.user_metadata?.email_verified) {
        return res.status(403).json({ error: 'Email verification required before uploading media assets' });
      }

      const userId = userData.user.id;
      const { fileBase64, portfolioId, contentType } = req.body || {};
      if (!fileBase64) return res.status(400).json({ error: 'Missing image payload' });

      const base64Data = fileBase64.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      const safePortfolioId = portfolioId && portfolioId !== 'pf_default' ? portfolioId : 'default';
      const ext = contentType?.includes('png') ? 'png' : contentType?.includes('jpeg') || contentType?.includes('jpg') ? 'jpg' : 'webp';
      const storagePath = `${userId}/${safePortfolioId}/avatar.${ext}`;

      const { error: uploadErr } = await adminClient.storage.from('avatars').upload(storagePath, buffer, { upsert: true, contentType: contentType || `image/${ext}` });
      if (uploadErr) return res.status(500).json({ error: `Storage upload failed: ${uploadErr.message}` });

      const { data: publicData } = adminClient.storage.from('avatars').getPublicUrl(storagePath);
      return res.status(200).json({ success: true, storageBucket: 'avatars', storagePath, publicUrl: publicData.publicUrl, updatedAt: new Date().toISOString() });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 3. ACTION: DOMAIN-CONNECT
  // ─────────────────────────────────────────────────────────────
  if (action === 'domain-connect') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });
    const token = authHeader.replace('Bearer ', '');

    try {
      const userClient = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: `Bearer ${token}` } } });
      const { data: userData } = await userClient.auth.getUser();
      if (!userData?.user) return res.status(401).json({ error: 'Invalid user session' });

      const { portfolioId, domain } = req.body || {};
      if (!portfolioId || !domain) return res.status(400).json({ error: 'Missing portfolioId or domain' });

      const cleanHostname = domain.toLowerCase().trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
      if (!/^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(cleanHostname)) {
        return res.status(400).json({ error: 'Enter a valid hostname such as portfolio.example.com' });
      }

      const adminClient = createClient(supabaseUrl, supabaseSecretKey);
      const { data: portfolio } = await adminClient.from('portfolios').select('owner_user_id').eq('id', portfolioId).maybeSingle();
      if (!portfolio || portfolio.owner_user_id !== userData.user.id) return res.status(403).json({ error: 'You do not own this portfolio' });

      const verificationToken = `verify_cname_${Math.random().toString(36).substr(2, 10)}`;
      await adminClient.from('custom_domains').upsert([{ portfolio_id: portfolioId, hostname: cleanHostname, status: 'pending_verification', verification_token: verificationToken, ssl_status: 'pending' }], { onConflict: 'portfolio_id' });

      return res.status(200).json({ success: true, domain: cleanHostname, verificationToken, cnameRecord: 'cname.3dportfolio.app', status: 'pending_verification' });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 4. ACTION: DOMAIN-VERIFY
  // ─────────────────────────────────────────────────────────────
  if (action === 'domain-verify') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });

    const { portfolioId, domain } = req.body || {};
    if (!portfolioId || !domain) return res.status(400).json({ error: 'Missing portfolioId or domain' });

    try {
      const cleanHostname = domain.toLowerCase().trim().replace(/^https?:\/\//, '');
      let verified = false;
      try {
        const records = await resolveCname(cleanHostname);
        verified = records.some(r => r.includes('3dportfolio.app') || r.includes('vercel.app'));
      } catch (_) {
        verified = false;
      }

      return res.status(200).json({ success: verified, verified, status: verified ? 'active' : 'pending_verification' });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(400).json({ error: `Unknown portfolio action: ${action}` });
}
