import { createClient } from '@supabase/supabase-js';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb'
    }
  }
};

const HOSTING_PLANS = new Set(['pro', 'premium', 'premium_group']);
const PLAN_PORTFOLIO_LIMITS = { free: 1, pro: 1, premium: -1, premium_group: -1 };
const JOB_FETCH_BLOCKED_MESSAGE = "This job site blocks automatic reading. Paste the job description below and we'll analyze it directly.";

function normalizeHostname(value) {
  return String(value || '').trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0].replace(/\.$/, '');
}

function getVercelDomainConfig() {
  const token = process.env.VERCEL_API_TOKEN;
  const projectId = process.env.VERCEL_PROJECT_ID;
  const teamId = process.env.VERCEL_TEAM_ID || '';
  return { token, projectId, teamId, configured: Boolean(token && projectId) };
}

async function vercelApi(path, options = {}) {
  const cfg = getVercelDomainConfig();
  if (!cfg.configured) {
    const error = new Error('Custom domain activation is temporarily unavailable.');
    error.code = 'VERCEL_CONFIG_MISSING';
    throw error;
  }
  const separator = path.includes('?') ? '&' : '?';
  const scopedPath = cfg.teamId ? `${path}${separator}teamId=${encodeURIComponent(cfg.teamId)}` : path;
  const response = await fetch(`https://api.vercel.com${scopedPath}`, {
    ...options,
    headers: { Authorization: `Bearer ${cfg.token}`, 'Content-Type': 'application/json', ...(options.headers || {}) }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data?.error?.message || 'Vercel domain operation failed.');
    error.status = response.status;
    error.code = data?.error?.code || 'VERCEL_API_ERROR';
    throw error;
  }
  return data;
}

function dnsInstructionsFor(hostname, projectDomain = {}) {
  const verification = Array.isArray(projectDomain.verification) ? projectDomain.verification : [];
  const txt = verification.find(item => item.type === 'TXT');
  if (txt) return [{ type: 'TXT', name: txt.domain || '_vercel', value: txt.value }];
  const labels = hostname.split('.');
  return labels.length === 2
    ? [{ type: 'A', name: '@', value: '76.76.21.21' }]
    : [{ type: 'CNAME', name: labels.slice(0, -2).join('.'), value: 'cname.vercel-dns.com' }];
}

function decodeHtmlText(value) {
  return String(value || '').replace(/&nbsp;|&#160;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>').replace(/&quot;|&#34;/gi, '"').replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

function stripJobHtml(html) {
  return decodeHtmlText(String(html || ''))
    .replace(/<(script|style|nav|footer|header|aside|noscript|svg)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<(dialog|form)\b[^>]*(?:cookie|consent|newsletter)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?\s*>|<\/p>|<\/li>|<\/div>|<\/h[1-6]>/gi, '\n')
    .replace(/<[^>]+>/g, ' ').replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();
}

function extractJobPosting(html) {
  const jsonLdBlocks = [...String(html || '').matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const match of jsonLdBlocks) {
    try {
      const parsed = JSON.parse(match[1]);
      const nodes = Array.isArray(parsed) ? parsed : parsed?.['@graph'] || [parsed];
      const posting = nodes.find(node => String(node?.['@type'] || '').toLowerCase() === 'jobposting');
      if (posting?.description) {
        return { text: stripJobHtml(posting.description), title: stripJobHtml(posting.title || '') };
      }
    } catch (_) {}
  }
  const semantic = String(html || '').match(/<(main|article)\b[^>]*>([\s\S]*?)<\/\1>/i)?.[2] || html;
  return { text: stripJobHtml(semantic), title: '' };
}

function isServerFeatureEnabled(flagName) {
  const val = process.env[`FF_${flagName}`];
  return val === 'true' || val === '1';
}

function localCareerPlanOverride() {
  if (process.env.SUPABASE_ENV !== 'local') return '';
  const value = String(process.env.CV_LOCAL_PLAN_OVERRIDE || '').trim().toLowerCase();
  return ['free', 'pro', 'premium', 'premium_group'].includes(value) ? value : '';
}

async function resolveCareerExportPlan(adminClient, userId) {
  const override = localCareerPlanOverride();
  if (override) return override;
  const { data: subscription } = await adminClient.from('subscriptions').select('plan_id,status,current_period_end').eq('user_id', userId).maybeSingle();
  let plan = subscription?.plan_id || 'free';
  const status = subscription?.status || 'active';
  if (plan !== 'free' && subscription?.current_period_end && new Date(subscription.current_period_end).getTime() <= Date.now()) plan = 'free';
  if (!['active', 'grace', 'canceling'].includes(status) && plan !== 'free') plan = 'free';
  if (plan === 'free' || plan === 'pro') {
    const { data: membership } = await adminClient.from('group_members').select('group_id').eq('user_id', userId).eq('status', 'active').maybeSingle();
    if (membership?.group_id) {
      const { data: group } = await adminClient.from('groups').select('owner_user_id,status').eq('id', membership.group_id).eq('status', 'active').maybeSingle();
      const { data: ownerSubscription } = group ? await adminClient.from('subscriptions').select('plan_id,status,current_period_end').eq('user_id', group.owner_user_id).maybeSingle() : { data: null };
      const ownerActive = group && ['active', 'grace', 'canceling'].includes(ownerSubscription?.status || '') && (!ownerSubscription?.current_period_end || new Date(ownerSubscription.current_period_end).getTime() > Date.now());
      if (ownerActive) plan = 'premium';
    }
  }
  return ['pro', 'premium', 'premium_group'].includes(plan) ? plan : 'free';
}

function cleanSyncText(value, max = 2400) {
  return String(value || '').replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, max);
}

function cleanSyncList(value, kind) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 100).map(item => {
    if (kind === 'skills') {
      const name = cleanSyncText(typeof item === 'string' ? item : item?.name, 120);
      return name ? { name } : null;
    }
    const description = cleanSyncText(typeof item === 'string' ? item : item?.description || item?.text || item?.name, 2400);
    return description ? { description } : null;
  }).filter(Boolean);
}

function mergeSyncList(existing, incoming) {
  const output = Array.isArray(existing) ? existing.map(item => ({ ...item })) : [];
  const keys = new Set(output.map(item => cleanSyncText(item?.name || item?.role || item?.degree || item?.description, 2400).toLowerCase()).filter(Boolean));
  for (const item of incoming) {
    const key = cleanSyncText(item?.name || item?.description, 2400).toLowerCase();
    if (key && !keys.has(key)) { output.push(item); keys.add(key); }
  }
  return output;
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

  // Career Studio is opt-in and local/development-only until a separate release approval.
  if (action === 'cv-sync') {
    if (!isServerFeatureEnabled('CAREER_STUDIO')) return res.status(404).json({ error: 'Career Studio is not enabled.' });
    if (process.env.SUPABASE_ENV === 'local' && !/^http:\/\/(127\.0\.0\.1|localhost):54321$/.test(supabaseUrl)) {
      return res.status(500).json({ error: 'Local Career Studio blocked: non-local Supabase URL configured.' });
    }
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const authHeader = req.headers.authorization || req.headers.Authorization;
    if (!authHeader) return res.status(401).json({ error: 'Unauthorized — Auth token required' });
    const token = authHeader.replace(/^Bearer\s+/i, '');
    try {
      const userClient = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: `Bearer ${token}` } } });
      const { data: userData, error: userErr } = await userClient.auth.getUser();
      if (userErr || !userData.user) return res.status(401).json({ error: 'Unauthorized user session' });
      const userId = userData.user.id;
      const { portfolioId, careerProfileId, sourceOwnerId, selectedFields = [], patch = {}, overwriteExisting = false, confirmSensitive = false } = req.body || {};
      if (!portfolioId || !/^[A-Za-z0-9_-]{3,160}$/.test(String(portfolioId))) return res.status(400).json({ error: 'Invalid Portfolio.' });
      if (sourceOwnerId && sourceOwnerId !== userId) return res.status(403).json({ error: 'Forbidden — Career profile owner mismatch.' });
      const allowedFields = new Set(['name', 'bio', 'location', 'social.email', 'social.phone', 'social.linkedin', 'social.github', 'skills', 'education', 'experience', 'projects']);
      const fields = [...new Set(Array.isArray(selectedFields) ? selectedFields.map(String) : [])];
      if (!fields.length || fields.some(field => !allowedFields.has(field))) return res.status(400).json({ error: 'Select valid CV fields before syncing.' });
      const sensitiveFields = fields.filter(field => ['location', 'social.email', 'social.phone', 'social.linkedin', 'social.github'].includes(field));
      if (sensitiveFields.length && confirmSensitive !== true) return res.status(400).json({ error: 'Sensitive CV fields require explicit confirmation.' });
      const adminClient = createClient(supabaseUrl, supabaseSecretKey);
      if (careerProfileId) {
        const { data: sourceProfile, error: sourceErr } = await adminClient.from('career_profiles').select('owner_user_id').eq('id', String(careerProfileId)).maybeSingle();
        if (sourceErr) return res.status(500).json({ error: 'Career profile ownership lookup failed.' });
        if (!sourceProfile || sourceProfile.owner_user_id !== userId) return res.status(403).json({ error: 'Forbidden — Career profile is not owned by this account.' });
      }
      const { data: portfolio, error: portfolioErr } = await adminClient.from('portfolios').select('id,owner_user_id,name,bio,master_profile_json').eq('id', String(portfolioId)).maybeSingle();
      if (portfolioErr) return res.status(500).json({ error: 'Portfolio ownership lookup failed.' });
      if (!portfolio) return res.status(404).json({ error: 'Portfolio not found.' });
      if (portfolio.owner_user_id !== userId) return res.status(403).json({ error: 'Forbidden — Portfolio is not owned by this account.' });
      const current = portfolio.master_profile_json && typeof portfolio.master_profile_json === 'object' ? portfolio.master_profile_json : {};
      const next = JSON.parse(JSON.stringify(current));
      next.social = { ...(next.social || {}) };
      const changedFields = [];
      const skippedFields = [];
      const scalarValues = { name: cleanSyncText(patch.name, 180), bio: cleanSyncText(patch.bio), location: cleanSyncText(patch.location, 180) };
      for (const field of fields) {
        if (field.startsWith('social.')) {
          const key = field.slice(7);
          const value = cleanSyncText(patch.social?.[key], 320);
          if (!value) continue;
          if (next.social[key] && !overwriteExisting) { skippedFields.push(field); continue; }
          next.social[key] = value; changedFields.push(field);
        } else if (['name', 'bio', 'location'].includes(field)) {
          const value = scalarValues[field];
          if (!value) continue;
          if (next[field] && !overwriteExisting) { skippedFields.push(field); continue; }
          next[field] = value; changedFields.push(field);
        } else {
          const values = cleanSyncList(patch[field], field === 'skills' ? 'skills' : 'text');
          if (!values.length) continue;
          const merged = mergeSyncList(next[field], values);
          if (JSON.stringify(merged) !== JSON.stringify(next[field] || [])) { next[field] = merged; changedFields.push(field); }
        }
      }
      if (!changedFields.length) return res.status(200).json({ success: true, changedFields, skippedFields, unchanged: true });
      const { error: updateErr } = await adminClient.from('portfolios').update({ name: next.name || portfolio.name || '', bio: next.bio || portfolio.bio || '', master_profile_json: next, updated_at: new Date().toISOString() }).eq('id', String(portfolioId)).eq('owner_user_id', userId);
      if (updateErr) return res.status(500).json({ error: 'Portfolio sync could not be saved.' });
      return res.status(200).json({ success: true, changedFields, skippedFields, portfolio: { id: portfolio.id, owner_user_id: userId, ...next } });
    } catch (_) {
      return res.status(500).json({ error: 'Portfolio sync service is temporarily unavailable.' });
    }
  }

  if (action === 'cv-export') {
    if (!isServerFeatureEnabled('CAREER_STUDIO')) return res.status(404).json({ error: 'Career Studio is not enabled.' });
    if (process.env.SUPABASE_ENV === 'local' && !/^http:\/\/(127\.0\.0\.1|localhost):54321$/.test(supabaseUrl)) {
      return res.status(500).json({ error: 'Local Career Studio blocked: non-local Supabase URL configured.' });
    }
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const authHeader = req.headers.authorization || req.headers.Authorization;
    if (!authHeader) return res.status(401).json({ error: 'Unauthorized — Auth token required' });
    const token = authHeader.replace(/^Bearer\s+/i, '');
    try {
      const userClient = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: `Bearer ${token}` } } });
      const { data: userData, error: userErr } = await userClient.auth.getUser();
      if (userErr || !userData.user) return res.status(401).json({ error: 'Unauthorized user session' });
      const userId = userData.user.id;
      const { careerProfileId, pageCount, idempotencyKey, format } = req.body || {};
      if (!careerProfileId || !/^[A-Za-z0-9_-]{3,160}$/.test(String(careerProfileId))) return res.status(400).json({ error: 'Invalid career profile.' });
      if (format !== 'pdf') return res.status(400).json({ error: 'Only private PDF exports are supported.' });
      const pages = Number(pageCount);
      if (!Number.isInteger(pages) || pages < 1 || pages > 100) return res.status(400).json({ error: 'Invalid PDF page count.' });
      if (!/^[A-Za-z0-9_-]{8,160}$/.test(String(idempotencyKey || ''))) return res.status(400).json({ error: 'Invalid export request.' });

      const adminClient = createClient(supabaseUrl, supabaseSecretKey);
      const { data: profile, error: profileErr } = await adminClient.from('career_profiles').select('id,owner_user_id').eq('id', String(careerProfileId)).maybeSingle();
      if (profileErr) return res.status(500).json({ error: 'Career profile lookup failed.' });
      if (!profile) return res.status(404).json({ error: 'Career profile not found.' });
      if (profile.owner_user_id !== userId) return res.status(403).json({ error: 'Forbidden — You do not own this career profile.' });

      const { data: existingEvent } = await adminClient.from('cv_export_events').select('id,page_count').eq('owner_user_id', userId).eq('idempotency_key', String(idempotencyKey)).maybeSingle();
      if (existingEvent) return res.status(200).json({ success: true, duplicate: true, eventId: existingEvent.id, pageCount: existingEvent.page_count, plan: await resolveCareerExportPlan(adminClient, userId) });

      const plan = await resolveCareerExportPlan(adminClient, userId);
      if (plan === 'free') {
        const configuredLimit = Number.parseInt(process.env.CV_FREE_EXPORT_LIMIT || '2', 10);
        const limit = Number.isFinite(configuredLimit) && configuredLimit >= 0 ? configuredLimit : 2;
        const monthStart = new Date();
        monthStart.setUTCDate(1); monthStart.setUTCHours(0, 0, 0, 0);
        const { count, error: countErr } = await adminClient.from('cv_export_events').select('id', { count: 'exact', head: true }).eq('owner_user_id', userId).gte('created_at', monthStart.toISOString());
        if (countErr) return res.status(500).json({ error: 'CV export quota lookup failed.' });
        if ((count || 0) >= limit) return res.status(429).json({ error: 'Your local Free CV export limit has been reached.', limit, used: count || 0 });
      }

      const { data: event, error: eventErr } = await adminClient.from('cv_export_events').insert({
        id: `cve_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        career_profile_id: String(careerProfileId), owner_user_id: userId, format: 'pdf',
        idempotency_key: String(idempotencyKey), page_count: pages
      }).select('id,page_count').single();
      if (eventErr) {
        if (eventErr.code === '23505') {
          const { data: duplicate } = await adminClient.from('cv_export_events').select('id,page_count').eq('owner_user_id', userId).eq('idempotency_key', String(idempotencyKey)).maybeSingle();
          if (duplicate) return res.status(200).json({ success: true, duplicate: true, eventId: duplicate.id, pageCount: duplicate.page_count, plan });
        }
        return res.status(500).json({ error: 'CV export event could not be recorded.' });
      }
      return res.status(200).json({ success: true, eventId: event.id, pageCount: event.page_count, plan });
    } catch (_) {
      return res.status(500).json({ error: 'CV export service is temporarily unavailable.' });
    }
  }

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
          const { data: group } = await adminClient.from('groups').select('status,owner_user_id').eq('id', membership.group_id).eq('status', 'active').maybeSingle();
          const { data: ownerSub } = group ? await adminClient.from('subscriptions').select('status,current_period_end').eq('user_id', group.owner_user_id).maybeSingle() : { data: null };
          const ownerActive = group && ['active', 'grace', 'canceling'].includes(ownerSub?.status || '') && (!ownerSub?.current_period_end || new Date(ownerSub.current_period_end).getTime() > Date.now());
          if (ownerActive) effectivePlan = 'premium';
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
  // 3. ACTION: UPLOAD-RESUME
  // ─────────────────────────────────────────────────────────────
  // Resume files stay private in Supabase Storage. The server issues a
  // one-time signed upload token, so large PDFs never pass through Vercel
  // and the browser never needs direct INSERT permissions on storage.objects.
  if (action === 'upload-resume') {
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

      const { portfolioId, fileName } = req.body || {};
      const safePortfolioId = String(portfolioId || 'default').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80) || 'default';
      const sanitizedFileName = String(fileName || 'resume.pdf').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 160) || 'resume.pdf';
      const userId = userData.user.id;
      const storagePath = `${userId}/${safePortfolioId}/resume.pdf`;

      const { data: signedData, error: signedErr } = await adminClient.storage
        .from('resumes')
        .createSignedUploadUrl(storagePath, { upsert: true });
      if (signedErr || !signedData?.token) {
        return res.status(500).json({ error: `Storage upload preparation failed: ${signedErr?.message || 'Unable to create signed upload URL'}` });
      }

      return res.status(200).json({
        success: true,
        storageBucket: 'resumes',
        storagePath,
        uploadToken: signedData.token,
        fileName: sanitizedFileName,
        mimeType: 'application/pdf',
        updatedAt: new Date().toISOString()
      });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 4. ACTION: DOMAIN-CONNECT
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

      const cleanHostname = normalizeHostname(domain);
      if (!/^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(cleanHostname)) {
        return res.status(400).json({ error: 'Enter a valid hostname such as portfolio.example.com' });
      }

      const adminClient = createClient(supabaseUrl, supabaseSecretKey);
      const { data: portfolio } = await adminClient.from('portfolios').select('owner_user_id').eq('id', portfolioId).maybeSingle();
      if (!portfolio || portfolio.owner_user_id !== userData.user.id) return res.status(403).json({ error: 'You do not own this portfolio' });

      const { data: subscription } = await adminClient.from('subscriptions').select('plan_id,status').eq('user_id', userData.user.id).maybeSingle();
      let canUseCustomDomain = subscription?.plan_id === 'premium' && ['active', 'grace', 'canceling'].includes(subscription?.status || 'active');
      if (!canUseCustomDomain) {
        const { data: membership } = await adminClient.from('group_members').select('group_id').eq('user_id', userData.user.id).eq('status', 'active').maybeSingle();
        if (membership) {
          const { data: group } = await adminClient.from('groups').select('id,owner_user_id').eq('id', membership.group_id).eq('status', 'active').maybeSingle();
          const { data: ownerSub } = group ? await adminClient.from('subscriptions').select('status,current_period_end').eq('user_id', group.owner_user_id).maybeSingle() : { data: null };
          canUseCustomDomain = Boolean(group && ['active', 'grace', 'canceling'].includes(ownerSub?.status || '') && (!ownerSub?.current_period_end || new Date(ownerSub.current_period_end).getTime() > Date.now()));
        }
      }
      if (!canUseCustomDomain) return res.status(403).json({ error: 'Custom domains require an active Premium plan.' });

      const { data: claimedDomain } = await adminClient.from('custom_domains').select('portfolio_id,hostname').eq('hostname', cleanHostname).maybeSingle();
      if (claimedDomain && claimedDomain.portfolio_id !== portfolioId) {
        return res.status(409).json({ error: 'This domain is already connected to another portfolio.', code: 'DOMAIN_ALREADY_CLAIMED' });
      }
      const { data: currentDomain } = await adminClient.from('custom_domains').select('hostname').eq('portfolio_id', portfolioId).maybeSingle();

      let projectDomain;
      try {
        projectDomain = await vercelApi(`/v10/projects/${encodeURIComponent(getVercelDomainConfig().projectId)}/domains`, {
          method: 'POST', body: JSON.stringify({ name: cleanHostname })
        });
      } catch (error) {
        if (error.code === 'VERCEL_CONFIG_MISSING') {
          return res.status(503).json({ error: error.message, code: error.code, requiredEnvVars: ['VERCEL_API_TOKEN', 'VERCEL_PROJECT_ID', 'VERCEL_TEAM_ID (optional)'] });
        }
        if (error.code !== 'domain_already_in_use' && error.code !== 'DOMAIN_ALREADY_EXISTS') {
          return res.status(error.status || 502).json({ error: 'Custom domain activation is temporarily unavailable.', code: error.code });
        }
        projectDomain = await vercelApi(`/v9/projects/${encodeURIComponent(getVercelDomainConfig().projectId)}/domains/${encodeURIComponent(cleanHostname)}`);
      }

      if (currentDomain?.hostname && currentDomain.hostname !== cleanHostname) {
        await vercelApi(`/v9/projects/${encodeURIComponent(getVercelDomainConfig().projectId)}/domains/${encodeURIComponent(currentDomain.hostname)}`, { method: 'DELETE' }).catch(() => null);
      }

      const dnsInstructions = dnsInstructionsFor(cleanHostname, projectDomain);
      const verificationToken = projectDomain?.verification?.[0]?.value || null;
      const { error: domainSaveError } = await adminClient.from('custom_domains').upsert([{
        portfolio_id: portfolioId, hostname: cleanHostname, status: 'awaiting_dns', verification_token: verificationToken,
        ssl_status: 'provisioning', connected_at: null
      }], { onConflict: 'portfolio_id' });
      if (domainSaveError) return res.status(500).json({ error: 'Unable to save domain state.' });

      return res.status(200).json({ success: true, domain: cleanHostname, status: 'AWAITING_DNS', verified: Boolean(projectDomain.verified), dnsInstructions });
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
      const cleanHostname = normalizeHostname(domain);
      const token = authHeader.replace(/^Bearer\s+/i, '').trim();
      const adminClient = createClient(supabaseUrl, supabaseSecretKey);
      const { data: userData } = await adminClient.auth.getUser(token);
      if (!userData?.user?.id) return res.status(401).json({ error: 'Invalid user session' });
      const { data: portfolio } = await adminClient.from('portfolios').select('owner_user_id').eq('id', portfolioId).maybeSingle();
      if (!portfolio || portfolio.owner_user_id !== userData.user.id) return res.status(403).json({ error: 'You do not own this portfolio' });
      const { data: storedDomain } = await adminClient.from('custom_domains').select('hostname').eq('portfolio_id', portfolioId).maybeSingle();
      if (!storedDomain || storedDomain.hostname !== cleanHostname) return res.status(404).json({ error: 'Connect this domain before verifying it.' });

      let projectDomain;
      let domainConfig;
      try {
        projectDomain = await vercelApi(`/v9/projects/${encodeURIComponent(getVercelDomainConfig().projectId)}/domains/${encodeURIComponent(cleanHostname)}`);
        if (!projectDomain.verified) {
          projectDomain = await vercelApi(`/v9/projects/${encodeURIComponent(getVercelDomainConfig().projectId)}/domains/${encodeURIComponent(cleanHostname)}/verify`, { method: 'POST' });
        }
        domainConfig = await vercelApi(`/v6/domains/${encodeURIComponent(cleanHostname)}/config`);
      } catch (error) {
        if (error.code === 'VERCEL_CONFIG_MISSING') {
          return res.status(503).json({ error: error.message, code: error.code, requiredEnvVars: ['VERCEL_API_TOKEN', 'VERCEL_PROJECT_ID', 'VERCEL_TEAM_ID (optional)'] });
        }
        return res.status(error.status || 502).json({ error: 'Domain verification is temporarily unavailable.', code: error.code });
      }

      const verified = Boolean(projectDomain?.verified);
      const configured = domainConfig?.misconfigured === false;
      let serving = false;
      if (verified && configured) {
        try {
          const servingResponse = await fetch(`https://${cleanHostname}`, { method: 'HEAD', redirect: 'manual', signal: AbortSignal.timeout(6000) });
          serving = servingResponse.status > 0 && servingResponse.status < 500 && Boolean(servingResponse.headers.get('x-vercel-id') || /vercel/i.test(servingResponse.headers.get('server') || ''));
        } catch (_) { serving = false; }
      }
      const active = verified && configured && serving;
      const status = active ? 'active' : verified && configured ? 'verified' : 'awaiting_dns';
      const sslStatus = active ? 'ready' : verified && configured ? 'provisioning' : 'pending';
      await adminClient.from('custom_domains').update({ status, ssl_status: sslStatus, connected_at: active ? new Date().toISOString() : null }).eq('portfolio_id', portfolioId).eq('hostname', cleanHostname);
      return res.status(200).json({
        success: true, domain: cleanHostname, status: status.toUpperCase(), verified, configured, active, serving,
        sslStatus, dnsInstructions: dnsInstructionsFor(cleanHostname, projectDomain), url: active ? `https://${cleanHostname}` : null
      });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 5. ACTION: EXTRACT-JOB (SSRF-Protected Job URL Extraction)
  // ─────────────────────────────────────────────────────────────
  if (action === 'extract-job') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const { url } = req.body || {};
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'Valid Job Posting URL is required.' });
    }

    try {
      const parsedUrl = new URL(url.trim());
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        return res.status(400).json({ error: 'Invalid URL protocol. Only HTTP and HTTPS are supported.' });
      }

      const hostname = parsedUrl.hostname.toLowerCase();

      // Strict SSRF hostname protection
      const isPrivateOrLocal =
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname === '0.0.0.0' ||
        hostname === '::1' ||
        hostname === '[::1]' ||
        hostname.endsWith('.localhost') ||
        hostname.endsWith('.local') ||
        hostname.endsWith('.internal') ||
        /^127\./.test(hostname) ||
        /^10\./.test(hostname) ||
        /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname) ||
        /^192\.168\./.test(hostname) ||
        /^169\.254\./.test(hostname); // Link-local

      if (isPrivateOrLocal) return res.status(200).json({ success: false, blocked: true, code: 'FETCH_BLOCKED', error: JOB_FETCH_BLOCKED_MESSAGE });

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(parsedUrl.toString(), {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8'
        }
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        return res.status(200).json({
          success: false,
          blocked: true,
          code: 'FETCH_BLOCKED',
          error: JOB_FETCH_BLOCKED_MESSAGE
        });
      }

      const contentType = response.headers.get('content-type') || '';
      if (!/text\/html|application\/xhtml\+xml|text\/plain/i.test(contentType)) {
        return res.status(200).json({ success: false, blocked: true, code: 'FETCH_BLOCKED', error: JOB_FETCH_BLOCKED_MESSAGE });
      }

      const rawHtml = await response.text();
      const extracted = extractJobPosting(rawHtml);
      const cleanText = extracted.text.slice(0, 15000);
      const looksBlocked = cleanText.length < 120 || /captcha|access denied|sign in to continue|enable javascript|cloudflare ray id/i.test(cleanText);
      if (looksBlocked) return res.status(200).json({ success: false, blocked: true, code: 'FETCH_BLOCKED', error: JOB_FETCH_BLOCKED_MESSAGE });

      // Extract title from HTML title tag if available
      const titleMatch = rawHtml.match(/<title[^>]*>([^<]+)<\/title>/i);
      const pageTitle = extracted.title || (titleMatch ? stripJobHtml(titleMatch[1]).split(/[-|•–—]/)[0].trim() : '');

      return res.status(200).json({
        success: true,
        extractedText: cleanText,
        suggestedTitle: pageTitle
      });
    } catch (err) {
      return res.status(200).json({
        success: false,
        blocked: true,
        code: 'FETCH_BLOCKED',
        error: JOB_FETCH_BLOCKED_MESSAGE
      });
    }
  }

  return res.status(400).json({ error: `Unknown portfolio action: ${action}` });
}
