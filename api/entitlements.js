import { createClient } from '@supabase/supabase-js';

// Feature flags helper
function isServerFeatureEnabled(flagName) {
  const val = process.env[`FF_${flagName}`];
  return val === 'true' || val === '1';
}

const THEME_TIERS = {
  code: 'free', creative: 'free', minimal: 'free',
  hacker: 'pro', data: 'pro', blueprint: 'pro', media: 'pro', health: 'pro', marketing: 'pro', education: 'pro',
  cosmic: 'premium', finance: 'premium', legal: 'premium', obsidian: 'premium', quantum: 'premium'
};
const TIER_HIERARCHY = ['free', 'pro', 'premium'];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const action = req.query.action || req.query.route || 'check';
  const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://kupxhrfijkdlcteniqfp.supabase.co';
  const supabaseAnonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const supabaseServiceKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  // ─────────────────────────────────────────────────────────────
  // 1. ACTION: CHECK (Entitlement Check)
  // ─────────────────────────────────────────────────────────────
  if (action === 'check') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Unauthorized — Auth token required' });

    const token = authHeader.replace('Bearer ', '');
    if (!supabaseAnonKey || !supabaseServiceKey) return res.status(503).json({ error: 'Entitlement service is not configured' });

    try {
      const userClient = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: `Bearer ${token}` } } });
      const { data: userData, error: userErr } = await userClient.auth.getUser();
      if (userErr || !userData.user) return res.status(401).json({ error: 'Unauthorized user session' });

      const userId = userData.user.id;
      const { action: checkAction, themeId, portfolioId, targetRole } = req.body || {};

      const adminClient = createClient(supabaseUrl, supabaseServiceKey);
      const { data: sub } = await adminClient.from('subscriptions').select('*').eq('user_id', userId).maybeSingle();
      const plan = sub?.plan_id || 'free';
      const status = sub?.status || 'active';

      let effectivePlan = plan;
      if (status !== 'active' && status !== 'grace' && status !== 'canceling') effectivePlan = 'free';

      // Check group membership
      if (effectivePlan === 'free') {
        const { data: groupMember } = await adminClient.from('group_members').select('*, groups(*)').eq('user_id', userId).eq('status', 'active').maybeSingle();
        if (groupMember && groupMember.groups?.status === 'active') effectivePlan = 'premium';
      }

      // Action: use_theme
      if (checkAction === 'use_theme') {
        if (!isServerFeatureEnabled('THEME_PAYWALL_ENABLED')) return res.status(200).json({ allowed: true, enforcement: 'disabled' });
        if (!themeId) return res.status(400).json({ error: 'Missing themeId' });

        const planTier = effectivePlan === 'pro' ? 'pro' : effectivePlan === 'premium' || effectivePlan === 'premium_group' ? 'premium' : 'free';
        const requiredTier = THEME_TIERS[themeId] || 'free';
        const allowed = TIER_HIERARCHY.indexOf(planTier) >= TIER_HIERARCHY.indexOf(requiredTier);

        if (!allowed) {
          await adminClient.from('entitlement_audit_log').insert({ user_id: userId, action: 'use_theme', result: 'denied', reason: `Theme ${themeId} requires ${requiredTier}, user has ${planTier}`, metadata: { themeId, requiredTier, userTier: planTier } });
          return res.status(403).json({ allowed: false, error: `Theme requires ${requiredTier.toUpperCase()} plan.`, requiredTier, userTier: planTier });
        }
        return res.status(200).json({ allowed: true, themeId, tier: requiredTier });
      }

      // Action: create_portfolio
      if (checkAction === 'create_portfolio') {
        if (!isServerFeatureEnabled('ENTITLEMENT_ENFORCEMENT_ENABLED')) return res.status(200).json({ allowed: true, enforcement: 'disabled' });

        if (effectivePlan === 'free') {
          const { count } = await adminClient.from('portfolio_creation_history').select('*', { count: 'exact', head: true }).eq('user_id', userId);
          if ((count || 0) >= 1) {
            await adminClient.from('entitlement_audit_log').insert({ user_id: userId, action: 'create_portfolio', result: 'denied', reason: 'Free plan lifetime limit reached', metadata: { count } });
            return res.status(403).json({ allowed: false, error: 'Free plan is limited to one portfolio lifetime.', code: 'FREE_LIMIT_REACHED' });
          }
          return res.status(200).json({ allowed: true, remainingLifetimeSlots: 1 - (count || 0) });
        }

        if (effectivePlan === 'pro') {
          const { count } = await adminClient.from('portfolio_creation_history').select('*', { count: 'exact', head: true }).eq('user_id', userId);
          if ((count || 0) >= 1) {
            return res.status(403).json({ allowed: false, error: 'Pro plan includes one persistent portfolio slot. Please edit or reset your existing portfolio.', code: 'PRO_SLOT_EXISTS' });
          }
          return res.status(200).json({ allowed: true, policy: 'one_persistent_slot' });
        }

        if (effectivePlan === 'premium' || effectivePlan === 'premium_group') {
          const { data: latest } = await adminClient.from('portfolio_creation_history').select('created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(1).maybeSingle();
          if (latest) {
            const cooldownMs = 7 * 24 * 60 * 60 * 1000;
            const nextSlot = new Date(new Date(latest.created_at).getTime() + cooldownMs);
            if (Date.now() < nextSlot.getTime()) {
              const remainingHours = Math.ceil((nextSlot.getTime() - Date.now()) / (1000 * 60 * 60));
              return res.status(403).json({ allowed: false, error: `Cooldown active: next portfolio slot available in ${remainingHours} hours.`, nextAvailableAt: nextSlot.toISOString(), remainingHours, code: 'COOLDOWN_ACTIVE' });
            }
          }
          return res.status(200).json({ allowed: true, policy: 'rolling_cooldown' });
        }
      }

      // Action: edit_portfolio
      if (checkAction === 'edit_portfolio') {
        if (!portfolioId) return res.status(400).json({ error: 'Missing portfolioId' });
        const { data: pf } = await adminClient.from('portfolios').select('is_finalized, owner_user_id').eq('id', portfolioId).maybeSingle();
        if (!pf || pf.owner_user_id !== userId) return res.status(403).json({ error: 'Not authorized for this portfolio' });

        if (isServerFeatureEnabled('FREE_FINALIZATION_LOCK_ENABLED') && effectivePlan === 'free' && pf.is_finalized) {
          return res.status(403).json({ allowed: false, error: 'This Free portfolio has been finalized and cannot be edited. Upgrade to Pro to unlock continuous editing.', code: 'FINALIZED_LOCKED' });
        }
        return res.status(200).json({ allowed: true });
      }

      // Default: general capability check
      return res.status(200).json({ allowed: true, effectivePlan, status });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 2. ACTION: COOLDOWN (Premium Cooldown Check)
  // ─────────────────────────────────────────────────────────────
  if (action === 'cooldown') {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });
    const token = authHeader.replace('Bearer ', '');

    try {
      const userClient = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: `Bearer ${token}` } } });
      const { data: userData } = await userClient.auth.getUser();
      if (!userData?.user) return res.status(401).json({ error: 'Invalid session' });

      const adminClient = createClient(supabaseUrl, supabaseServiceKey);
      const { data: latest } = await adminClient.from('portfolio_creation_history').select('created_at').eq('user_id', userData.user.id).order('created_at', { ascending: false }).limit(1).maybeSingle();

      const serverNow = new Date().toISOString();
      if (!latest) {
        return res.status(200).json({ canCreate: true, serverTime: serverNow, lastCreatedAt: null, nextAvailableAt: null, remainingHours: 0 });
      }

      const cooldownMs = 7 * 24 * 60 * 60 * 1000;
      const nextTime = new Date(new Date(latest.created_at).getTime() + cooldownMs);
      const canCreate = Date.now() >= nextTime.getTime();
      const remainingHours = canCreate ? 0 : Math.ceil((nextTime.getTime() - Date.now()) / (1000 * 60 * 60));

      return res.status(200).json({ canCreate, serverTime: serverNow, lastCreatedAt: latest.created_at, nextAvailableAt: nextTime.toISOString(), remainingHours });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 3. ACTION: GROUP-MANAGE (Premium Groups Management)
  // ─────────────────────────────────────────────────────────────
  if (action === 'group-manage' || action === 'groups') {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });
    const token = authHeader.replace('Bearer ', '');

    try {
      const userClient = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: `Bearer ${token}` } } });
      const { data: userData } = await userClient.auth.getUser();
      if (!userData?.user) return res.status(401).json({ error: 'Invalid session' });
      const userId = userData.user.id;
      const adminClient = createClient(supabaseUrl, supabaseServiceKey);

      if (req.method === 'GET') {
        const { data: group } = await adminClient.from('groups').select('*, group_members(*)').eq('owner_user_id', userId).maybeSingle();
        return res.status(200).json({ group });
      }

      if (req.method === 'POST') {
        const { subAction, memberEmail, groupId } = req.body || {};
        if (subAction === 'invite_member') {
          if (!memberEmail) return res.status(400).json({ error: 'memberEmail required' });
          const { data: targetProfile } = await adminClient.from('profiles').select('id').eq('email', memberEmail.trim().toLowerCase()).maybeSingle();
          if (!targetProfile) return res.status(404).json({ error: 'User with this email was not found' });

          const { data: group } = await adminClient.from('groups').select('*, group_members(*)').eq('owner_user_id', userId).maybeSingle();
          if (!group) return res.status(404).json({ error: 'You do not own an active Premium Group' });
          if ((group.group_members?.length || 0) >= group.seat_limit) return res.status(400).json({ error: `Group seat limit of ${group.seat_limit} reached.` });

          const { error: insErr } = await adminClient.from('group_members').insert({ group_id: group.id, user_id: targetProfile.id, role: 'member', status: 'active', joined_at: new Date().toISOString() });
          if (insErr) return res.status(500).json({ error: insErr.message });
          return res.status(200).json({ success: true, memberEmail });
        }
      }
      return res.status(400).json({ error: 'Invalid group action' });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 4. ACTION: PROMO-VALIDATE (Promo Code Validation)
  // ─────────────────────────────────────────────────────────────
  if (action === 'promo-validate' || action === 'promo') {
    const { code, targetPlan } = req.body || {};
    if (!code) return res.status(400).json({ valid: false, error: 'Promo code required' });

    try {
      const adminClient = createClient(supabaseUrl, supabaseServiceKey);
      const { data: promo } = await adminClient.from('promo_codes').select('*').eq('code', String(code).trim().toUpperCase()).maybeSingle();
      if (!promo || !promo.active) return res.status(200).json({ valid: false, error: 'Invalid or inactive promo code' });

      if (promo.expires_at && new Date(promo.expires_at) < new Date()) {
        return res.status(200).json({ valid: false, error: 'Promo code has expired' });
      }
      if (promo.max_redemptions && promo.redemption_count >= promo.max_redemptions) {
        return res.status(200).json({ valid: false, error: 'Promo code redemption limit reached' });
      }
      if (targetPlan && promo.applicable_plans?.length && !promo.applicable_plans.includes(targetPlan)) {
        return res.status(200).json({ valid: false, error: `Promo code is not applicable to the ${targetPlan} plan.` });
      }

      return res.status(200).json({ valid: true, code: promo.code, discountType: promo.discount_type, discountValue: promo.discount_value });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 5. ACTION: AUDIT-LOG (Admin Audit Log Query)
  // ─────────────────────────────────────────────────────────────
  if (action === 'audit-log' || action === 'audit') {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Authentication required' });
    const token = authHeader.replace('Bearer ', '');

    try {
      const userClient = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: `Bearer ${token}` } } });
      const { data: userData } = await userClient.auth.getUser();
      if (!userData?.user) return res.status(401).json({ error: 'Invalid session' });

      const allowedEmails = new Set((process.env.ADMIN_EMAILS || 'saleh2005mohamed@gmail.com').split(',').map(e => e.trim().toLowerCase()).filter(Boolean));
      const userEmail = (userData.user.email || '').trim().toLowerCase();
      if (!allowedEmails.has(userEmail)) {
        return res.status(403).json({ error: 'Administrator access required' });
      }

      const adminClient = createClient(supabaseUrl, supabaseServiceKey);

      const limit = Math.min(Number(req.query.limit) || 100, 500);
      const { data: logs, error: logErr } = await adminClient.from('entitlement_audit_log').select('*').order('created_at', { ascending: false }).limit(limit);
      if (logErr) return res.status(500).json({ error: logErr.message });
      return res.status(200).json({ logs: logs || [], count: (logs || []).length });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(400).json({ error: `Unknown entitlements action: ${action}` });
}
