import { createClient } from '@supabase/supabase-js';
import { sendBrevoEmail } from '../src/services/BrevoDispatcher.js';
import { generatePaymentApprovedEmail, generatePaymentRejectedEmail } from '../src/services/EmailTemplates.js';

const VALID_PLANS = ['free', 'pro', 'premium', 'premium_group'];
const VALID_STATUSES = ['active', 'canceling', 'expired', 'grace', 'keep_it_live'];

async function requireAdmin(req, res) {
  const authorization = req.headers.authorization || '';
  if (!authorization.startsWith('Bearer ')) return res.status(401).json({ error: 'Authentication required' });
  const url = process.env.VITE_SUPABASE_URL || 'https://kupxhrfijkdlcteniqfp.supabase.co';
  const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const serviceKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anonKey || !serviceKey) return res.status(503).json({ error: 'Admin service is not configured' });
  
  const auth = createClient(url, anonKey, { global: { headers: { Authorization: authorization } } });
  const { data, error } = await auth.auth.getUser();
  if (error || !data?.user) return res.status(401).json({ error: 'Invalid or expired session' });
  
  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: profile } = await admin.from('profiles').select('is_admin').eq('id', data.user.id).maybeSingle();
  const allowedEmails = new Set((process.env.ADMIN_EMAILS || '').split(',').map((email) => email.trim().toLowerCase()).filter(Boolean));
  
  if (!profile?.is_admin && !allowedEmails.has((data.user.email || '').toLowerCase())) {
    return res.status(403).json({ error: 'Administrator access required' });
  }
  return { user: data.user, admin, allowedEmails };
}

async function writeAuditLog(adminClient, adminUserId, targetUserId, action, prevVal, newVal, reason, metadata = {}) {
  try {
    await adminClient.from('entitlement_audit_log').insert({
      user_id: targetUserId || adminUserId,
      action,
      result: 'allowed',
      reason: reason || 'Admin operation',
      metadata: {
        admin_user_id: adminUserId,
        previous_value: prevVal,
        new_value: newVal,
        ...metadata,
        timestamp: new Date().toISOString()
      }
    });
  } catch (err) {
    console.error('Failed to write audit log:', err);
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PATCH, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  
  const action = req.query.action || 'me';

  // Health check (no auth required)
  if (req.method === 'GET' && action === 'health') {
    const url = process.env.VITE_SUPABASE_URL || 'https://kupxhrfijkdlcteniqfp.supabase.co';
    const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    let database = 'error';
    let storage = 'error';
    try {
      const client = createClient(url, key);
      const [dbResult, storageResult] = await Promise.all([
        client.from('profiles').select('count', { count: 'exact', head: true }),
        client.storage.listBuckets()
      ]);
      database = dbResult.error ? 'error' : 'connected';
      storage = storageResult.error ? 'error' : 'connected';
    } catch (_) {}
    const billing = Boolean(process.env.STRIPE_SECRET_KEY);
    const email = Boolean(process.env.BREVO_API_KEY && process.env.BREVO_SENDER_EMAIL);
    const monitoring = Boolean(process.env.SENTRY_AUTH_TOKEN || process.env.VITE_SENTRY_DSN);
    const coreHealthy = database === 'connected' && storage === 'connected';
    const launchReady = coreHealthy && billing && email && monitoring;
    return res.status(coreHealthy ? 200 : 503).json({
      status: launchReady ? 'HEALTHY' : coreHealthy ? 'DEGRADED' : 'UNHEALTHY',
      launchReady, api: 'connected', database, storage, billing: billing ? 'configured_test_mode' : 'not_connected',
      email: email ? 'configured_unverified' : 'not_connected', monitoring: monitoring ? 'connected' : 'not_connected',
      timestamp: new Date().toISOString()
    });
  }

  const context = await requireAdmin(req, res);
  if (!context?.admin) return;

  if (req.method === 'GET' && action === 'me') {
    return res.status(200).json({ isAdmin: true, user: { id: context.user.id, email: context.user.email } });
  }

  // 1. Overview Metrics
  if (req.method === 'GET' && action === 'overview') {
    const [
      profilesRes,
      subscriptionsRes,
      portfoliosRes,
      groupsRes,
      keepLivesRes,
      promosRes,
      paymentsRes
    ] = await Promise.all([
      context.admin.from('profiles').select('id,email,display_name,created_at,is_admin'),
      context.admin.from('subscriptions').select('user_id,plan_id,status,group_id,metadata'),
      context.admin.from('portfolios').select('id,owner_user_id,published_at,theme,is_finalized'),
      context.admin.from('groups').select('id,status').eq('status', 'active'),
      context.admin.from('keep_live_entitlements').select('id,status').eq('status', 'active'),
      context.admin.from('promo_codes').select('id,active').eq('active', true),
      context.admin.from('manual_payment_requests').select('id,status')
    ]);

    const usersList = profilesRes.data || [];
    const subsList = subscriptionsRes.data || [];
    const pfsList = portfoliosRes.data || [];
    const paymentsList = paymentsRes.data || [];

    const planCounts = { free: 0, pro: 0, premium: 0, premium_group: 0 };
    subsList.forEach(s => {
      const p = s.plan_id || 'free';
      if (planCounts[p] !== undefined) planCounts[p]++;
    });

    const publishedCount = pfsList.filter(p => p.published_at).length;
    const draftCount = pfsList.filter(p => !p.published_at).length;
    const finalizedFreeCount = pfsList.filter(p => p.is_finalized).length;

    const pendingPaymentsCount = paymentsRes.error ? 'N/A — Migration Pending' : paymentsList.filter(p => p.status === 'PENDING').length;
    const approvedPaymentsCount = paymentsRes.error ? 'N/A — Migration Pending' : paymentsList.filter(p => p.status === 'APPROVED').length;
    const rejectedPaymentsCount = paymentsRes.error ? 'N/A — Migration Pending' : paymentsList.filter(p => p.status === 'REJECTED').length;

    const featureFlags = {
      MONETIZATION_UI_ENABLED: process.env.FF_MONETIZATION_UI_ENABLED === 'true',
      ENTITLEMENT_ENFORCEMENT_ENABLED: process.env.FF_ENTITLEMENT_ENFORCEMENT_ENABLED === 'true',
      FREE_FINALIZATION_LOCK_ENABLED: process.env.FF_FREE_FINALIZATION_LOCK_ENABLED === 'true',
      THEME_PAYWALL_ENABLED: process.env.FF_THEME_PAYWALL_ENABLED === 'true',
      HOSTING_PAYWALL_ENABLED: process.env.FF_HOSTING_PAYWALL_ENABLED === 'true',
      GROUP_MANAGEMENT_ENABLED: process.env.FF_GROUP_MANAGEMENT_ENABLED === 'true'
    };

    const isEnforcementActive = Object.values(featureFlags).some(v => v === true);

    return res.status(200).json({
      stats: {
        totalUsers: usersList.length,
        freeUsers: planCounts.free,
        proUsers: planCounts.pro,
        premiumUsers: planCounts.premium,
        groupMembers: planCounts.premium_group,
        totalPortfolios: pfsList.length,
        publishedPortfolios: publishedCount,
        draftPortfolios: draftCount,
        finalizedFreePortfolios: finalizedFreeCount,
        hostedPortfolios: publishedCount,
        keepLivePortfolios: keepLivesRes.error ? 'N/A — Migration Pending' : (keepLivesRes.data || []).length,
        activeGroups: groupsRes.error ? 'N/A — Migration Pending' : (groupsRes.data || []).length,
        promoCodesCount: promosRes.error ? 'N/A — Migration Pending' : (promosRes.data || []).length,
        pendingPaymentsCount,
        approvedPaymentsCount,
        rejectedPaymentsCount,
        enforcementStatus: isEnforcementActive ? 'ACTIVE (SOME FLAGS ON)' : 'OFF (LEGACY MODE)',
        paymentsConnected: 'Manual InstaPay (Phase 8B active)'
      },
      featureFlags
    });
  }

  // 2. Users List with complete details
  if (req.method === 'GET' && action === 'users') {
    const [
      { data: profiles, error: pErr },
      { data: subscriptions },
      { data: portfolios },
      { data: groups },
      { data: keepLives }
    ] = await Promise.all([
      context.admin.from('profiles').select('id,email,display_name,created_at,is_admin').order('created_at', { ascending: false }).limit(500),
      context.admin.from('subscriptions').select('user_id,plan_id,status,current_period_end,grace_ends_at,metadata,group_id'),
      context.admin.from('portfolios').select('id,owner_user_id,name,slug,theme,published_at,is_finalized,created_at'),
      context.admin.from('groups').select('id,owner_user_id,seat_limit,status').catch(() => ({ data: [] })),
      context.admin.from('keep_live_entitlements').select('id,user_id,portfolio_id,status').catch(() => ({ data: [] }))
    ]);

    if (pErr) return res.status(500).json({ error: pErr.message });

    const subsMap = new Map((subscriptions || []).map(s => [s.user_id, s]));
    const pfsByUser = new Map();
    (portfolios || []).forEach(pf => {
      const list = pfsByUser.get(pf.owner_user_id) || [];
      list.push(pf);
      pfsByUser.set(pf.owner_user_id, list);
    });

    const groupsByOwner = new Map((groups || []).map(g => [g.owner_user_id, g]));
    const kilByUser = new Map((keepLives || []).map(k => [k.user_id, k]));

    const users = (profiles || []).map(profile => {
      const sub = subsMap.get(profile.id) || { plan_id: 'free', status: 'active' };
      const userPfs = pfsByUser.get(profile.id) || [];
      const hostedPfs = userPfs.filter(p => p.published_at);
      const isLegacy = sub.metadata?.legacy_access === true || new Date(profile.created_at) < new Date('2026-08-01T00:00:00Z');
      
      // Calculate latest portfolio creation and cooldown
      const sortedPfs = [...userPfs].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      const lastCreatedAt = sortedPfs[0]?.created_at || null;
      let nextAvailableAt = null;
      let cooldownRemainingMs = 0;
      if (lastCreatedAt && (sub.plan_id === 'premium' || sub.plan_id === 'premium_group')) {
        const cooldownMs = 7 * 24 * 60 * 60 * 1000;
        const nextTime = new Date(lastCreatedAt).getTime() + cooldownMs;
        if (Date.now() < nextTime) {
          nextAvailableAt = new Date(nextTime).toISOString();
          cooldownRemainingMs = nextTime - Date.now();
        }
      }

      return {
        id: profile.id,
        email: profile.email,
        name: profile.display_name || profile.email?.split('@')[0] || 'User',
        createdAt: profile.created_at,
        isAdmin: Boolean(profile.is_admin) || profile.id === context.user.id || context.allowedEmails.has((profile.email || '').toLowerCase()),
        plan: sub.plan_id || 'free',
        status: sub.status || 'active',
        currentPeriodEnd: sub.current_period_end || null,
        graceEndsAt: sub.grace_ends_at || null,
        metadata: sub.metadata || {},
        portfolioCount: userPfs.length,
        hostedCount: hostedPfs.length,
        currentTheme: sortedPfs[0]?.theme || 'code',
        isFinalized: userPfs.some(p => p.is_finalized),
        isLegacy,
        hasKIL: Boolean(kilByUser.get(profile.id)),
        groupInfo: groupsByOwner.get(profile.id) || null,
        cooldown: {
          lastCreatedAt,
          nextAvailableAt,
          remainingHours: cooldownRemainingMs > 0 ? Math.ceil(cooldownRemainingMs / (1000 * 60 * 60)) : 0
        },
        portfolios: userPfs
      };
    });

    return res.status(200).json({ users });
  }

  // 3. Portfolios List
  if (req.method === 'GET' && action === 'portfolios') {
    const { data: portfolios, error } = await context.admin
      .from('portfolios')
      .select('id,owner_user_id,name,slug,theme,published_at,is_finalized,created_at,updated_at')
      .order('created_at', { ascending: false })
      .limit(500);

    if (error) return res.status(500).json({ error: error.message });

    const ownerIds = [...new Set((portfolios || []).map(p => p.owner_user_id))];
    const { data: profiles } = ownerIds.length
      ? await context.admin.from('profiles').select('id,email,display_name').in('id', ownerIds)
      : { data: [] };

    const profileMap = new Map((profiles || []).map(p => [p.id, p]));

    const enriched = (portfolios || []).map(p => ({
      ...p,
      ownerEmail: profileMap.get(p.owner_user_id)?.email || 'Unknown',
      ownerName: profileMap.get(p.owner_user_id)?.display_name || 'User',
      isLive: Boolean(p.published_at),
      tierRequired: ['cosmic', 'finance', 'legal', 'obsidian', 'quantum'].includes(p.theme) ? 'premium' :
                    ['hacker', 'data', 'blueprint', 'media', 'health', 'marketing', 'education'].includes(p.theme) ? 'pro' : 'free'
    }));

    return res.status(200).json({ portfolios: enriched });
  }

  // 4. Groups List
  if (req.method === 'GET' && action === 'groups') {
    const { data: groups, error } = await context.admin
      .from('groups')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ groups: groups || [] });
  }

  // 5. Promo Codes List
  if (req.method === 'GET' && action === 'promos') {
    const { data: promos, error } = await context.admin
      .from('promo_codes')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ promos: promos || [] });
  }

  // 6. Audit Log
  if (req.method === 'GET' && action === 'audit-log') {
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    const { data: logs, error: logErr } = await context.admin
      .from('entitlement_audit_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (logErr) return res.status(500).json({ error: logErr.message });
    return res.status(200).json({ logs: logs || [] });
  }

  // 7. System & Pricing Reference
  if (req.method === 'GET' && action === 'system') {
    return res.status(200).json({
      featureFlags: {
        MONETIZATION_UI_ENABLED: process.env.FF_MONETIZATION_UI_ENABLED === 'true',
        ENTITLEMENT_ENFORCEMENT_ENABLED: process.env.FF_ENTITLEMENT_ENFORCEMENT_ENABLED === 'true',
        FREE_FINALIZATION_LOCK_ENABLED: process.env.FF_FREE_FINALIZATION_LOCK_ENABLED === 'true',
        THEME_PAYWALL_ENABLED: process.env.FF_THEME_PAYWALL_ENABLED === 'true',
        HOSTING_PAYWALL_ENABLED: process.env.FF_HOSTING_PAYWALL_ENABLED === 'true',
        GROUP_MANAGEMENT_ENABLED: process.env.FF_GROUP_MANAGEMENT_ENABLED === 'true'
      },
      pricingReference: {
        free: '0 EGP',
        pro: '600 EGP/month',
        premium: '1,000 EGP/month',
        group: { 2: '1,500 EGP', 3: '1,800 EGP', 4: '2,200 EGP', 5: '2,800 EGP' },
        keepItLive: '500 EGP/year/portfolio'
      },
      readOnlyNotice: 'READ ONLY: Feature flags and pricing are server/deployment authoritative.'
    });
  }

  // ─── AUDITED WRITE ACTIONS ────────────────────────────────────────

  // 8. Manual Plan Override (Audited)
  if (req.method === 'POST' && action === 'user-plan-override') {
    const { userId, targetPlanId, status, expiryDate, reason } = req.body || {};
    if (!userId || !VALID_PLANS.includes(targetPlanId)) {
      return res.status(400).json({ error: `Valid userId and targetPlanId required. Allowed plans: ${VALID_PLANS.join(', ')}` });
    }
    if (!reason || String(reason).trim().length < 3) {
      return res.status(400).json({ error: 'A mandatory audit reason (minimum 3 characters) is required for plan overrides.' });
    }

    const { data: existingSub } = await context.admin.from('subscriptions').select('*').eq('user_id', userId).maybeSingle();
    const prevPlan = existingSub?.plan_id || 'free';
    const prevStatus = existingSub?.status || 'active';

    const updateData = {
      user_id: userId,
      plan_id: targetPlanId,
      status: VALID_STATUSES.includes(status) ? status : 'active',
      current_period_end: expiryDate || existingSub?.current_period_end || null,
      metadata: {
        ...(existingSub?.metadata || {}),
        source: 'admin_override',
        overridden_by: context.user.id,
        overridden_by_email: context.user.email,
        override_reason: reason.trim(),
        overridden_at: new Date().toISOString()
      },
      updated_at: new Date().toISOString()
    };

    const { error } = await context.admin.from('subscriptions').upsert(updateData, { onConflict: 'user_id' });
    if (error) return res.status(500).json({ error: error.message });

    await writeAuditLog(
      context.admin,
      context.user.id,
      userId,
      'PLAN_OVERRIDE',
      { plan: prevPlan, status: prevStatus },
      { plan: targetPlanId, status: updateData.status, expiryDate },
      reason,
      { source: 'admin_control_center' }
    );

    return res.status(200).json({ success: true, userId, planId: targetPlanId, status: updateData.status });
  }

  // 9. Portfolio Hosting Override (Audited)
  if (req.method === 'POST' && action === 'portfolio-hosting-override') {
    const { portfolioId, hostingAction, reason } = req.body || {};
    if (!portfolioId || !['disable', 'restore'].includes(hostingAction)) {
      return res.status(400).json({ error: 'portfolioId and hostingAction ("disable"|"restore") required' });
    }
    if (!reason || String(reason).trim().length < 3) {
      return res.status(400).json({ error: 'A mandatory audit reason is required for hosting override.' });
    }

    const { data: existingPf } = await context.admin.from('portfolios').select('*').eq('id', portfolioId).maybeSingle();
    if (!existingPf) return res.status(404).json({ error: 'Portfolio not found' });

    const newPublishedAt = hostingAction === 'restore' ? new Date().toISOString() : null;
    const { error } = await context.admin
      .from('portfolios')
      .update({ published_at: newPublishedAt, updated_at: new Date().toISOString() })
      .eq('id', portfolioId);

    if (error) return res.status(500).json({ error: error.message });

    await writeAuditLog(
      context.admin,
      context.user.id,
      existingPf.owner_user_id,
      'PORTFOLIO_HOSTING_OVERRIDE',
      { published_at: existingPf.published_at },
      { published_at: newPublishedAt },
      reason,
      { portfolioId, hostingAction }
    );

    return res.status(200).json({ success: true, portfolioId, published_at: newPublishedAt });
  }

  // 10. Group Seat Override (Audited, 2-5 seats)
  if (req.method === 'POST' && action === 'group-seat-override') {
    const { groupId, seatLimit, reason } = req.body || {};
    const seats = Number(seatLimit);
    if (!groupId || isNaN(seats) || seats < 2 || seats > 5) {
      return res.status(400).json({ error: 'Valid groupId and seatLimit (between 2 and 5) required' });
    }
    if (!reason || String(reason).trim().length < 3) {
      return res.status(400).json({ error: 'A mandatory audit reason is required for group seat changes.' });
    }

    const { data: existingGroup } = await context.admin.from('groups').select('*').eq('id', groupId).maybeSingle();
    if (!existingGroup) return res.status(404).json({ error: 'Group not found' });

    const { error } = await context.admin
      .from('groups')
      .update({ seat_limit: seats, updated_at: new Date().toISOString() })
      .eq('id', groupId);

    if (error) return res.status(500).json({ error: error.message });

    await writeAuditLog(
      context.admin,
      context.user.id,
      existingGroup.owner_user_id,
      'GROUP_SEAT_CHANGE',
      { seat_limit: existingGroup.seat_limit },
      { seat_limit: seats },
      reason,
      { groupId }
    );

    return res.status(200).json({ success: true, groupId, seat_limit: seats });
  }

  // 11. Create Promo Code (Audited)
  if (req.method === 'POST' && action === 'create-promo') {
    const { code, discountType, discountValue, applicablePlans, maxRedemptions, perUserLimit, expiresAt, reason } = req.body || {};
    if (!code || !['percentage', 'fixed_amount'].includes(discountType) || Number(discountValue) <= 0) {
      return res.status(400).json({ error: 'Valid code, discountType ("percentage"|"fixed_amount"), and positive discountValue required.' });
    }
    if (!reason || String(reason).trim().length < 3) {
      return res.status(400).json({ error: 'A mandatory audit reason is required when creating a promo code.' });
    }

    const newPromo = {
      code: String(code).trim().toUpperCase(),
      discount_type: discountType,
      discount_value: Number(discountValue),
      applicable_plans: Array.isArray(applicablePlans) ? applicablePlans : ['pro', 'premium'],
      starts_at: new Date().toISOString(),
      expires_at: expiresAt || null,
      max_redemptions: maxRedemptions ? Number(maxRedemptions) : null,
      per_user_limit: perUserLimit ? Number(perUserLimit) : 1,
      active: true
    };

    const { data: created, error } = await context.admin.from('promo_codes').insert(newPromo).select().single();
    if (error) return res.status(500).json({ error: error.message });

    await writeAuditLog(
      context.admin,
      context.user.id,
      null,
      'PROMO_CREATED',
      null,
      { code: newPromo.code, discount: `${newPromo.discount_value} (${newPromo.discount_type})` },
      reason,
      { promoId: created?.id }
    );

    return res.status(200).json({ success: true, promo: created });
  }

  // 12. Disable Promo Code (Audited)
  if (req.method === 'POST' && action === 'disable-promo') {
    const { promoId, reason } = req.body || {};
    if (!promoId) return res.status(400).json({ error: 'promoId required' });
    if (!reason || String(reason).trim().length < 3) {
      return res.status(400).json({ error: 'A mandatory audit reason is required when disabling a promo code.' });
    }

    const { error } = await context.admin.from('promo_codes').update({ active: false, updated_at: new Date().toISOString() }).eq('id', promoId);
    if (error) return res.status(500).json({ error: error.message });

    await writeAuditLog(
      context.admin,
      context.user.id,
      null,
      'PROMO_DISABLED',
      { active: true },
      { active: false },
      reason,
      { promoId }
    );

    return res.status(200).json({ success: true, promoId, active: false });
  }

  // 13. Legacy Access Override (Audited)
  if (req.method === 'POST' && action === 'user-legacy-override') {
    const { userId, isLegacy, reason } = req.body || {};
    if (!userId || typeof isLegacy !== 'boolean') {
      return res.status(400).json({ error: 'userId and boolean isLegacy required' });
    }
    if (!reason || String(reason).trim().length < 3) {
      return res.status(400).json({ error: 'A mandatory audit reason is required for legacy status change.' });
    }

    const { data: existingSub } = await context.admin.from('subscriptions').select('*').eq('user_id', userId).maybeSingle();
    const prevLegacy = existingSub?.metadata?.legacy_access || false;

    const newMetadata = {
      ...(existingSub?.metadata || {}),
      legacy_access: isLegacy,
      legacy_updated_by: context.user.id,
      legacy_updated_at: new Date().toISOString()
    };

    const { error } = await context.admin
      .from('subscriptions')
      .update({ metadata: newMetadata, updated_at: new Date().toISOString() })
      .eq('user_id', userId);

    if (error) return res.status(500).json({ error: error.message });

    await writeAuditLog(
      context.admin,
      context.user.id,
      userId,
      'LEGACY_ACCESS_CHANGED',
      { legacy_access: prevLegacy },
      { legacy_access: isLegacy },
      reason,
      { source: 'admin_control_center' }
    );

    return res.status(200).json({ success: true, userId, legacy_access: isLegacy });
  }

  // 14. Payment Requests List (with customer profile & signed proof URL)
  if (req.method === 'GET' && action === 'payment-requests') {
    const statusFilter = req.query.status;
    let query = context.admin.from('manual_payment_requests').select('*').order('created_at', { ascending: false }).limit(200);
    if (statusFilter && statusFilter !== 'all') {
      query = query.eq('status', statusFilter.toUpperCase());
    }

    const { data: requests, error } = await query;
    if (error) return res.status(500).json({ error: error.message });

    const userIds = (requests || []).map(r => r.user_id);
    const { data: profiles } = await context.admin.from('profiles').select('id,email,display_name').in('id', userIds);
    const profileMap = new Map((profiles || []).map(p => [p.id, p]));

    const enriched = await Promise.all((requests || []).map(async (r) => {
      const p = profileMap.get(r.user_id) || {};
      let signedProofUrl = null;
      if (r.proof_storage_path) {
        const { data: signed } = await context.admin.storage.from('payment_proofs').createSignedUrl(r.proof_storage_path, 3600).catch(() => ({ data: null }));
        signedProofUrl = signed?.signedUrl || null;
      }
      return {
        ...r,
        userName: p.display_name || p.email?.split('@')[0] || 'User',
        userEmail: p.email || 'N/A',
        signedProofUrl
      };
    }));

    return res.status(200).json({ requests: enriched });
  }

  // 15. Review Payment (Approve or Reject with Brevo Notification & Audit)
  if (req.method === 'POST' && action === 'review-payment') {
    const { requestId, decision, reason } = req.body || {};
    if (!requestId || !['APPROVED', 'REJECTED'].includes(decision)) {
      return res.status(400).json({ error: 'requestId and decision (APPROVED|REJECTED) are required' });
    }

    const { data: request, error: reqErr } = await context.admin.from('manual_payment_requests').select('*').eq('id', requestId).maybeSingle();
    if (reqErr || !request) return res.status(404).json({ error: 'Payment request not found' });
    if (request.status !== 'PENDING') {
      return res.status(400).json({ error: `Cannot review request with status ${request.status}. Request is already resolved.` });
    }

    const { data: profile } = await context.admin.from('profiles').select('email,display_name').eq('id', request.user_id).maybeSingle();
    const userEmail = profile?.email;
    const userName = profile?.display_name || userEmail?.split('@')[0] || 'Member';
    const now = new Date().toISOString();

    if (decision === 'APPROVED') {
      // 1. Mark request APPROVED
      await context.admin.from('manual_payment_requests').update({
        status: 'APPROVED',
        reviewed_by: context.user.id,
        reviewed_at: now,
        updated_at: now
      }).eq('id', requestId);

      // 2. Activate Subscription
      const periodDays = request.plan_id === 'keep_it_live' ? 365 : 30;
      const periodEnd = new Date(Date.now() + periodDays * 24 * 60 * 60 * 1000).toISOString();

      await context.admin.from('subscriptions').upsert([{
        user_id: request.user_id,
        plan_id: request.plan_id === 'keep_it_live' ? 'free' : request.plan_id,
        status: 'active',
        current_period_end: periodEnd,
        metadata: {
          source: 'manual_instapay',
          payment_request_id: requestId,
          approved_by: context.user.id,
          amount_egp: request.expected_amount_egp,
          approved_at: now
        },
        updated_at: now
      }], { onConflict: 'user_id' });

      // Handle Group
      if (request.plan_id === 'premium_group') {
        const seats = Number(request.group_seats) || 2;
        await context.admin.from('groups').upsert([{
          owner_user_id: request.user_id,
          seat_limit: seats,
          plan_type: 'premium_group',
          status: 'active',
          updated_at: now
        }], { onConflict: 'owner_user_id' });
      }

      // Handle Keep It Live
      if (request.plan_id === 'keep_it_live' && request.portfolio_id) {
        await context.admin.from('keep_live_entitlements').upsert([{
          portfolio_id: request.portfolio_id,
          user_id: request.user_id,
          status: 'active',
          starts_at: now,
          expires_at: periodEnd,
          updated_at: now
        }], { onConflict: 'portfolio_id' });
      }

      // 3. Write Audit Log
      await writeAuditLog(
        context.admin,
        context.user.id,
        request.user_id,
        'MANUAL_PAYMENT_APPROVED',
        { status: 'PENDING' },
        { status: 'APPROVED', plan_id: request.plan_id, amount_egp: request.expected_amount_egp },
        'InstaPay transfer confirmed by admin',
        { requestId, plan: request.plan_id, seats: request.group_seats }
      );

      // 4. Send Confirmation Email via Brevo
      if (userEmail) {
        const html = generatePaymentApprovedEmail({
          firstName: userName,
          planName: request.plan_id,
          activeUntil: periodEnd,
          groupSeats: request.group_seats,
          portfolioName: request.portfolio_id ? 'Keep It Live Portfolio' : null
        });
        await sendBrevoEmail({
          to: userEmail,
          subject: `🎉 Your Portfolio Maker ${request.plan_id.toUpperCase()} Plan is Now Active!`,
          htmlContent: html
        }).catch(err => console.error('Approval email error:', err));
      }

      return res.status(200).json({ success: true, requestId, status: 'APPROVED', activeUntil: periodEnd });
    }

    if (decision === 'REJECTED') {
      const rejReason = reason && String(reason).trim().length >= 3 ? String(reason).trim() : 'Transfer receipt could not be verified.';

      // 1. Mark request REJECTED
      await context.admin.from('manual_payment_requests').update({
        status: 'REJECTED',
        reviewed_by: context.user.id,
        reviewed_at: now,
        rejection_reason: rejReason,
        updated_at: now
      }).eq('id', requestId);

      // 2. Write Audit Log
      await writeAuditLog(
        context.admin,
        context.user.id,
        request.user_id,
        'MANUAL_PAYMENT_REJECTED',
        { status: 'PENDING' },
        { status: 'REJECTED', reason: rejReason },
        rejReason,
        { requestId, plan: request.plan_id }
      );

      // 3. Send Rejection Email via Brevo
      if (userEmail) {
        const html = generatePaymentRejectedEmail({
          firstName: userName,
          planName: request.plan_id,
          reason: rejReason
        });
        await sendBrevoEmail({
          to: userEmail,
          subject: `Payment Verification Notice — Portfolio Maker`,
          htmlContent: html
        }).catch(err => console.error('Rejection email error:', err));
      }

      return res.status(200).json({ success: true, requestId, status: 'REJECTED', reason: rejReason });
    }
  }

  return res.status(405).json({ error: 'Unsupported admin action' });
}

