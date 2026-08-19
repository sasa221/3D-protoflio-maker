import { createClient } from '@supabase/supabase-js';

// Plan capabilities (copied from PlanConfig since serverless can't import src/)
const PLAN_CAPABILITIES = {
  free: ['cv_import', 'html_export'],
  pro: ['cv_import', 'html_export', 'pdf_export', 'publish_hosted', 'continuous_edit', 'basic_analytics', 'job_match', 'portfolio_variants', 'cinematic_intro_advanced', 'custom_seo'],
  premium: ['cv_import', 'html_export', 'pdf_export', 'publish_hosted', 'continuous_edit', 'custom_domain', 'remove_branding', 'basic_analytics', 'advanced_analytics', 'job_match', 'portfolio_variants', 'cinematic_intro_advanced', 'custom_seo'],
  premium_group: null // same as premium, resolved below
};
PLAN_CAPABILITIES.premium_group = [...PLAN_CAPABILITIES.premium];

const PLAN_PORTFOLIO_POLICY = {
  free: 'one_lifetime_slot',
  pro: 'one_persistent_slot',
  premium: 'rolling_cooldown',
  premium_group: 'rolling_cooldown'
};

function isServerFeatureEnabled(flagName) {
  const val = process.env[`FF_${flagName}`];
  return val === 'true' || val === '1';
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Authentication required' });

  const token = authHeader.replace('Bearer ', '');
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const supabaseServiceKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
    return res.status(503).json({ error: 'Entitlement service is not configured' });
  }

  try {
    // Authenticate user
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return res.status(401).json({ error: 'Invalid session' });
    }

    const userId = userData.user.id;
    const { action, portfolioId, themeId } = req.body || {};

    if (!action) {
      return res.status(400).json({ error: 'Missing action parameter' });
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Get subscription
    const { data: sub } = await adminClient
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    const planId = sub?.plan_id || 'free';
    const status = sub?.status || 'active';
    const isActive = status === 'active' || status === 'grace' || status === 'canceling';

    // Check group membership for premium_group
    let effectivePlan = planId;
    if (planId !== 'premium') {
      const { data: membership } = await adminClient
        .from('group_members')
        .select('group_id, role, status')
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
        if (group) {
          effectivePlan = 'premium';
        }
      }
    }

    // If enforcement is disabled, allow everything
    if (!isServerFeatureEnabled('ENTITLEMENT_ENFORCEMENT_ENABLED')) {
      return res.status(200).json({ allowed: true, plan: effectivePlan, enforcement: 'disabled' });
    }

    const capabilities = PLAN_CAPABILITIES[effectivePlan] || PLAN_CAPABILITIES.free;
    const policy = PLAN_PORTFOLIO_POLICY[effectivePlan] || 'one_lifetime_slot';

    // Audit log helper
    async function auditLog(result, reason) {
      try {
        await adminClient.from('entitlement_audit_log').insert([{
          user_id: userId,
          action,
          result,
          reason,
          metadata: { planId: effectivePlan, portfolioId, themeId }
        }]);
      } catch (_) {}
    }

    // Handle specific actions
    switch (action) {
      case 'create_portfolio': {
        // Count creation history (includes deleted)
        const { count: totalCreated } = await adminClient
          .from('portfolio_creation_history')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('action', 'create');

        // Count active portfolios
        const { count: activeCount } = await adminClient
          .from('portfolios')
          .select('id', { count: 'exact', head: true })
          .eq('owner_user_id', userId)
          .eq('is_archived', false);

        if (policy === 'one_lifetime_slot') {
          if ((totalCreated || 0) >= 1) {
            await auditLog('denied', 'Free lifetime slot exhausted');
            return res.status(200).json({ allowed: false, reason: 'The Free plan includes one portfolio. Upgrade to Pro for a hosted portfolio.' });
          }
        } else if (policy === 'one_persistent_slot') {
          if ((activeCount || 0) >= 1) {
            await auditLog('denied', 'Pro persistent slot occupied');
            return res.status(200).json({ allowed: false, reason: 'Pro includes one persistent portfolio slot. Upgrade to Premium for multiple portfolios.' });
          }
          if ((totalCreated || 0) >= 1) {
            await auditLog('denied', 'Pro lifetime slot already initialized');
            return res.status(200).json({ allowed: false, reason: 'Your Pro subscription includes one persistent portfolio slot. You can edit, reset, or restore your existing slot, or upgrade to Premium for multiple portfolios.' });
          }
        } else if (policy === 'rolling_cooldown') {
          // Check cooldown from last creation
          const { data: lastCreation } = await adminClient
            .from('portfolio_creation_history')
            .select('created_at')
            .eq('user_id', userId)
            .eq('action', 'create')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (lastCreation) {
            const cooldownMs = 7 * 24 * 60 * 60 * 1000;
            const nextAvailable = new Date(new Date(lastCreation.created_at).getTime() + cooldownMs);
            if (Date.now() < nextAvailable.getTime()) {
              await auditLog('denied', 'Premium cooldown active');
              return res.status(200).json({
                allowed: false,
                reason: `Your next portfolio slot becomes available on ${nextAvailable.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}.`,
                nextAvailableAt: nextAvailable.toISOString()
              });
            }
          }
        }

        return res.status(200).json({ allowed: true });
      }

      case 'edit_portfolio': {
        // Check Keep It Live
        if (status === 'keep_it_live') {
          await auditLog('denied', 'Keep It Live is read-only');
          return res.status(200).json({ allowed: false, reason: 'Editing is locked. Renew your subscription to make changes.' });
        }
        // Check expired
        if (status === 'expired') {
          await auditLog('denied', 'Subscription expired');
          return res.status(200).json({ allowed: false, reason: 'Your subscription has expired. Renew to continue editing.' });
        }
        // Check finalized Free
        if (effectivePlan === 'free' && portfolioId && isServerFeatureEnabled('FREE_FINALIZATION_LOCK_ENABLED')) {
          const { data: pf } = await adminClient
            .from('portfolios')
            .select('is_finalized')
            .eq('id', portfolioId)
            .eq('owner_user_id', userId)
            .maybeSingle();
          if (pf?.is_finalized) {
            await auditLog('denied', 'Free portfolio finalized');
            return res.status(200).json({ allowed: false, reason: 'Editing is locked for this finalized Free portfolio. Upgrade to Pro to continue editing.' });
          }
        }
        // Check ownership
        if (portfolioId) {
          const { data: owned } = await adminClient
            .from('portfolios')
            .select('id')
            .eq('id', portfolioId)
            .eq('owner_user_id', userId)
            .maybeSingle();
          if (!owned) {
            await auditLog('denied', 'IDOR: not portfolio owner');
            return res.status(200).json({ allowed: false, reason: "You don't have permission to edit this portfolio." });
          }
        }
        return res.status(200).json({ allowed: true });
      }

      case 'publish_hosted': {
        if (!isServerFeatureEnabled('HOSTING_PAYWALL_ENABLED')) {
          return res.status(200).json({ allowed: true, enforcement: 'disabled' });
        }
        if (!capabilities.includes('publish_hosted')) {
          await auditLog('denied', 'Plan lacks publish_hosted');
          return res.status(200).json({ allowed: false, reason: 'Online publishing is available with Pro.' });
        }
        if (status === 'keep_it_live') {
          await auditLog('denied', 'Keep It Live cannot publish new changes');
          return res.status(200).json({ allowed: false, reason: 'Publishing changes is locked. Renew your subscription to update your portfolio.' });
        }
        return res.status(200).json({ allowed: true });
      }

      case 'use_theme': {
        if (!isServerFeatureEnabled('THEME_PAYWALL_ENABLED')) {
          return res.status(200).json({ allowed: true, enforcement: 'disabled' });
        }
        if (!themeId) return res.status(400).json({ error: 'Missing themeId' });
        // Theme tier config (inline copy for all 15 themes)
        const THEME_TIERS = {
          code: 'free', creative: 'free', minimal: 'free',
          hacker: 'pro', data: 'pro', blueprint: 'pro', media: 'pro', health: 'pro', marketing: 'pro', education: 'pro',
          cosmic: 'premium', finance: 'premium', legal: 'premium', obsidian: 'premium', quantum: 'premium'
        };
        const TIER_HIERARCHY = ['free', 'pro', 'premium'];
        const planTier = effectivePlan === 'pro' ? 'pro' : effectivePlan === 'premium' || effectivePlan === 'premium_group' ? 'premium' : 'free';
        const requiredTier = THEME_TIERS[themeId] || 'free';
        if (TIER_HIERARCHY.indexOf(planTier) < TIER_HIERARCHY.indexOf(requiredTier)) {
          const tierName = requiredTier.charAt(0).toUpperCase() + requiredTier.slice(1);
          await auditLog('denied', `Theme ${themeId} requires ${requiredTier}`);
          return res.status(200).json({ allowed: false, reason: `This theme is available with ${tierName}.` });
        }
        return res.status(200).json({ allowed: true });
      }

      case 'export_pdf': {
        if (!capabilities.includes('pdf_export')) {
          await auditLog('denied', 'Plan lacks pdf_export');
          return res.status(200).json({ allowed: false, reason: 'PDF export is available with Pro.' });
        }
        return res.status(200).json({ allowed: true });
      }

      case 'view_basic_analytics':
      case 'view_advanced_analytics': {
        const cap = action === 'view_basic_analytics' ? 'basic_analytics' : 'advanced_analytics';
        if (!capabilities.includes(cap)) {
          const label = action === 'view_basic_analytics' ? 'Basic analytics is available with Pro.' : 'Advanced analytics is available with Premium.';
          await auditLog('denied', `Plan lacks ${cap}`);
          return res.status(200).json({ allowed: false, reason: label });
        }
        return res.status(200).json({ allowed: true });
      }

      case 'use_custom_domain': {
        if (!capabilities.includes('custom_domain')) {
          await auditLog('denied', 'Plan lacks custom_domain');
          return res.status(200).json({ allowed: false, reason: 'Custom domains are available with Premium.' });
        }
        return res.status(200).json({ allowed: true });
      }

      case 'remove_branding': {
        if (!capabilities.includes('remove_branding')) {
          await auditLog('denied', 'Plan lacks remove_branding');
          return res.status(200).json({ allowed: false, reason: 'Branding removal is available with Premium.' });
        }
        return res.status(200).json({ allowed: true });
      }

      default:
        return res.status(400).json({ error: `Unknown action: ${action}` });
    }
  } catch (e) {
    console.error('Entitlement check error:', e);
    return res.status(500).json({ error: 'Entitlement verification failed' });
  }
}
