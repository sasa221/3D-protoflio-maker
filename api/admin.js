import { createClient } from '@supabase/supabase-js';
import { sendBrevoEmail } from '../src/services/BrevoDispatcher.js';
import {
  generateOtpEmail,
  generatePasswordResetEmail,
  generateAdminNewPaymentEmail,
  generatePaymentApprovedEmail,
  generatePaymentRejectedEmail
} from '../src/services/EmailTemplates.js';
import { INSTAPAY_CONFIG } from '../src/config/PlanConfig.js';

const VALID_PLANS = ['free', 'pro', 'premium', 'premium_group'];
const VALID_STATUSES = ['active', 'canceling', 'expired', 'grace', 'keep_it_live'];

const CANONICAL_ADMIN_EMAIL = 'saleh2005mohamed@gmail.com';

function isAllowedAdminEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const normalized = email.trim().toLowerCase();
  if (normalized === CANONICAL_ADMIN_EMAIL) return true;
  const envList = [
    ...(process.env.ADMIN_EMAILS ? process.env.ADMIN_EMAILS.split(',') : []),
    ...(process.env.ADMIN_EMAIL ? [process.env.ADMIN_EMAIL] : [])
  ]
    .map(e => e.trim().toLowerCase())
    .filter(Boolean);
  return envList.includes(normalized);
}

async function requireAdmin(req, res) {
  const authorization = req.headers.authorization || '';
  if (!authorization.startsWith('Bearer ')) return res.status(401).json({ error: 'Authentication required' });
  const token = authorization.replace('Bearer ', '').trim();
  if (!token) return res.status(401).json({ error: 'Authentication token is empty' });

  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://kupxhrfijkdlcteniqfp.supabase.co';
  const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_gILAHxBLwwDjMoNpfLUbLg_fFKiE0f5';
  const serviceKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return res.status(503).json({ error: 'Admin database service is not configured' });

  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  let user = null;
  // 1. Direct validation via admin client with token
  const { data: adminUserData, error: adminUserErr } = await admin.auth.getUser(token);
  if (adminUserData?.user && !adminUserErr) {
    user = adminUserData.user;
  } else {
    // 2. Fallback validation via user client
    const userClient = createClient(url, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } } });
    const { data: userClientData, error: userClientErr } = await userClient.auth.getUser();
    if (userClientData?.user && !userClientErr) {
      user = userClientData.user;
    }
  }

  if (!user) {
    return res.status(401).json({ error: 'Invalid or expired session. Please sign in again.' });
  }

  const userEmail = (user.email || '').trim().toLowerCase();
  if (!isAllowedAdminEmail(userEmail)) {
    return res.status(403).json({ error: `Administrator access required for ${userEmail}` });
  }

  return { user, admin };
}

async function writeAuditLog(adminClient, adminUserId, targetUserId, action, prevVal, newVal, reason, metadata = {}) {
  try {
    await adminClient.from('entitlement_audit_log').insert([{
      user_id: targetUserId,
      action: action,
      result: 'override_applied',
      reason: reason || 'Admin override',
      metadata: {
        admin_id: adminUserId,
        previous_value: prevVal,
        new_value: newVal,
        ...metadata
      }
    }]);
  } catch (e) {
    console.warn('[Audit Log] Failed to write audit log entry:', e.message);
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const action = req.query.action || (req.method === 'GET' ? 'overview' : 'me');

  // Health endpoint for public/monitoring verification
  if (action === 'health' || (req.method === 'GET' && action === 'ping')) {
    const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://kupxhrfijkdlcteniqfp.supabase.co';
    const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_gILAHxBLwwDjMoNpfLUbLg_fFKiE0f5';
    const serviceKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    const database = (url && serviceKey) ? 'connected' : 'not_connected';
    const storage = (url && anonKey) ? 'connected' : 'not_connected';
    // The product's active billing path is manual InstaPay, not Stripe/Paymob.
    // api/billing.js exposes the official fallback destination when the optional
    // PAYMENT_INSTAPAY_* overrides are absent, so health must report that real
    // path instead of a stale Stripe-only dependency.
    const manualInstaPayBilling = Boolean(INSTAPAY_CONFIG?.isConfigured);
    const billing = manualInstaPayBilling || Boolean(process.env.STRIPE_SECRET_KEY || process.env.PAYMOB_API_KEY || process.env.VITE_ENABLE_BILLING_PORTAL);
    const email = Boolean(process.env.BREVO_API_KEY && process.env.BREVO_SENDER_EMAIL);
    const monitoring = Boolean(process.env.SENTRY_AUTH_TOKEN || process.env.VITE_SENTRY_DSN);
    const coreHealthy = database === 'connected' && storage === 'connected';
    const launchReady = coreHealthy && billing && email && monitoring;
    return res.status(coreHealthy ? 200 : 503).json({
      status: launchReady ? 'HEALTHY' : coreHealthy ? 'DEGRADED' : 'UNHEALTHY',
      launchReady, api: 'connected', database, storage, billing: billing ? 'configured' : 'not_connected',
      email: email ? 'configured' : 'not_connected', monitoring: monitoring ? 'connected' : 'not_connected',
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
    let usersList = [];
    let authUsersError = null;

    try {
      const { data: authUsersRes, error: authUsersErr } = await context.admin.auth.admin.listUsers({ perPage: 1000 });
      if (authUsersErr) {
        console.error('[Admin Overview] auth.admin.listUsers error:', authUsersErr);
        authUsersError = authUsersErr.message;
      } else if (authUsersRes?.users) {
        usersList = authUsersRes.users.map(u => ({
          id: u.id,
          email: u.email || '',
          name: u.user_metadata?.full_name || u.user_metadata?.name || u.email?.split('@')[0] || 'User',
          display_name: u.user_metadata?.full_name || u.user_metadata?.name || u.email?.split('@')[0] || 'User',
          createdAt: u.created_at,
          created_at: u.created_at,
          isAdmin: Boolean(u.user_metadata?.is_admin || u.app_metadata?.is_admin || isAllowedAdminEmail(u.email)),
          is_admin: Boolean(u.user_metadata?.is_admin || u.app_metadata?.is_admin || isAllowedAdminEmail(u.email))
        }));
      }
    } catch (e) {
      console.error('[Admin Overview] listUsers exception:', e);
      authUsersError = e.message;
    }

    try {
      const { data: dbProfiles, error: pErr } = await context.admin.from('profiles').select('id,email,display_name,username,is_admin,created_at');
      if (dbProfiles && dbProfiles.length > 0) {
        const existingIds = new Set(usersList.map(u => u.id));
        dbProfiles.forEach(p => {
          if (!existingIds.has(p.id)) {
            usersList.push({
              id: p.id,
              email: p.email || '',
              name: p.display_name || p.username || p.email?.split('@')[0] || 'User',
              display_name: p.display_name || p.username || p.email?.split('@')[0] || 'User',
              createdAt: p.created_at,
              created_at: p.created_at,
              isAdmin: Boolean(p.is_admin || isAllowedAdminEmail(p.email)),
              is_admin: Boolean(p.is_admin || isAllowedAdminEmail(p.email))
            });
          } else {
            const target = usersList.find(u => u.id === p.id);
            if (target && p.display_name && (target.display_name === 'User' || !target.display_name)) {
              target.name = p.display_name;
              target.display_name = p.display_name;
            }
          }
        });
      }
    } catch (e) {
      console.error('[Admin Overview] profiles exception:', e);
    }

    if (usersList.length === 0 && authUsersError) {
      return res.status(500).json({ error: `Failed to load users: ${authUsersError}` });
    }

    const [
      subscriptionsRes,
      portfoliosRes,
      groupsRes,
      keepLivesRes,
      promosRes,
      paymentsRes
    ] = await Promise.all([
      context.admin.from('subscriptions').select('user_id,plan_id,status,group_id,metadata'),
      context.admin.from('portfolios').select('id,owner_user_id,name,slug,theme,published_at,is_finalized,created_at'),
      context.admin.from('groups').select('id,status').eq('status', 'active'),
      context.admin.from('keep_live_entitlements').select('id,status').eq('status', 'active'),
      context.admin.from('promo_codes').select('id,active').eq('active', true),
      context.admin.from('manual_payment_requests').select('id,status')
    ]);

    if (portfoliosRes.error) {
      console.error('[Admin Overview] portfolios error:', portfoliosRes.error);
      return res.status(500).json({ error: `Failed to load portfolios: ${portfoliosRes.error.message}` });
    }

    const subsList = subscriptionsRes.data || [];
    const pfsList = portfoliosRes.data || [];
    const paymentsList = paymentsRes.data || [];

    const activePaidUsers = new Set();
    let proCount = 0;
    let premiumCount = 0;
    let groupMemberCount = 0;

    subsList.forEach(s => {
      const plan = s.plan_id || 'free';
      const status = s.status || 'active';
      if (status === 'active' || status === 'grace' || status === 'canceling') {
        if (plan === 'pro') {
          proCount++;
          activePaidUsers.add(s.user_id);
        } else if (plan === 'premium') {
          premiumCount++;
          activePaidUsers.add(s.user_id);
        } else if (plan === 'premium_group') {
          groupMemberCount++;
          activePaidUsers.add(s.user_id);
        }
      }
    });

    const totalUsersCount = usersList.length;
    const freeUsersCount = Math.max(0, totalUsersCount - activePaidUsers.size);

    const publishedCount = pfsList.filter(p => Boolean(p.published_at)).length;
    const draftCount = pfsList.filter(p => !p.published_at).length;
    const finalizedFreeCount = pfsList.filter(p => Boolean(p.is_finalized)).length;
    const keepLiveCount = (keepLivesRes.data || []).length;
    const activeGroupsCount = (groupsRes.data || []).length;
    const activePromosCount = (promosRes.data || []).length;

    const pendingPaymentsCount = paymentsRes.error ? 'N/A' : paymentsList.filter(p => p.status === 'PENDING').length;
    const approvedPaymentsCount = paymentsRes.error ? 'N/A' : paymentsList.filter(p => p.status === 'APPROVED').length;
    const rejectedPaymentsCount = paymentsRes.error ? 'N/A' : paymentsList.filter(p => p.status === 'REJECTED').length;

    return res.status(200).json({
      stats: {
        totalUsers: totalUsersCount,
        freeUsers: freeUsersCount,
        proUsers: proCount,
        premiumUsers: premiumCount,
        groupMembers: groupMemberCount,
        totalPortfolios: pfsList.length,
        publishedPortfolios: publishedCount,
        draftPortfolios: draftCount,
        finalizedFreePortfolios: finalizedFreeCount,
        keepLivePortfolios: keepLiveCount,
        activeGroups: activeGroupsCount,
        promoCodesCount: activePromosCount,
        pendingPaymentsCount,
        approvedPaymentsCount,
        rejectedPaymentsCount,
        enforcementStatus: process.env.FF_ENTITLEMENT_ENFORCEMENT_ENABLED === 'true' ? 'ACTIVE (ENFORCED)' : 'OFF (LEGACY MODE)'
      }
    });
  }

  // 2. Users List with complete details
  if (req.method === 'GET' && action === 'users') {
    let usersList = [];
    let authUsersError = null;

    try {
      const { data: authUsersRes, error: authUsersErr } = await context.admin.auth.admin.listUsers({ perPage: 1000 });
      if (authUsersErr) {
        console.error('[Admin Users] listUsers error:', authUsersErr);
        authUsersError = authUsersErr.message;
      } else if (authUsersRes?.users) {
        usersList = authUsersRes.users.map(u => ({
          id: u.id,
          email: u.email || '',
          name: u.user_metadata?.full_name || u.user_metadata?.name || u.email?.split('@')[0] || 'User',
          display_name: u.user_metadata?.full_name || u.user_metadata?.name || u.email?.split('@')[0] || 'User',
          createdAt: u.created_at,
          created_at: u.created_at,
          isAdmin: Boolean(u.user_metadata?.is_admin || u.app_metadata?.is_admin || isAllowedAdminEmail(u.email)),
          is_admin: Boolean(u.user_metadata?.is_admin || u.app_metadata?.is_admin || isAllowedAdminEmail(u.email))
        }));
      }
    } catch (e) {
      console.error('[Admin Users] listUsers exception:', e);
      authUsersError = e.message;
    }

    try {
      const { data: dbProfiles, error: pErr } = await context.admin.from('profiles').select('id,email,display_name,username,is_admin,created_at');
      if (dbProfiles && dbProfiles.length > 0) {
        const existingIds = new Set(usersList.map(u => u.id));
        dbProfiles.forEach(p => {
          if (!existingIds.has(p.id)) {
            usersList.push({
              id: p.id,
              email: p.email || '',
              name: p.display_name || p.username || p.email?.split('@')[0] || 'User',
              display_name: p.display_name || p.username || p.email?.split('@')[0] || 'User',
              createdAt: p.created_at,
              created_at: p.created_at,
              isAdmin: Boolean(p.is_admin || isAllowedAdminEmail(p.email)),
              is_admin: Boolean(p.is_admin || isAllowedAdminEmail(p.email))
            });
          } else {
            const target = usersList.find(u => u.id === p.id);
            if (target && p.display_name && (target.display_name === 'User' || !target.display_name)) {
              target.name = p.display_name;
              target.display_name = p.display_name;
            }
          }
        });
      }
    } catch (e) {
      console.error('[Admin Users] profiles exception:', e);
    }

    if (usersList.length === 0 && authUsersError) {
      return res.status(500).json({ error: `Failed to load users: ${authUsersError}` });
    }

    const [
      subscriptionsRes,
      portfoliosRes,
      groupsRes,
      keepLivesRes,
      paymentsRes
    ] = await Promise.all([
      context.admin.from('subscriptions').select('user_id,plan_id,status,current_period_start,current_period_end,grace_ends_at,metadata,group_id,created_at,updated_at'),
      context.admin.from('portfolios').select('id,owner_user_id,name,slug,theme,published_at,is_finalized,created_at'),
      context.admin.from('groups').select('id,owner_user_id,seat_limit,status'),
      context.admin.from('keep_live_entitlements').select('id,user_id,portfolio_id,status'),
      context.admin.from('manual_payment_requests').select('id,user_id,plan_id,expected_amount_egp,payment_method,status,reviewed_at,created_at,group_seats').order('created_at', { ascending: false })
    ]);

    const subsMap = new Map((subscriptionsRes.data || []).map(s => [s.user_id, s]));
    const pfsByUser = new Map();
    (portfoliosRes.data || []).forEach(pf => {
      const list = pfsByUser.get(pf.owner_user_id) || [];
      list.push(pf);
      pfsByUser.set(pf.owner_user_id, list);
    });

    const groupsByOwner = new Map((groupsRes.data || []).map(g => [g.owner_user_id, g]));
    const kilByUser = new Map((keepLivesRes.data || []).map(k => [k.user_id, k]));
    
    // Map latest payment request per user
    const paymentsByUser = new Map();
    (paymentsRes.data || []).forEach(pmt => {
      if (!paymentsByUser.has(pmt.user_id)) {
        paymentsByUser.set(pmt.user_id, pmt);
      }
    });

    const now = Date.now();

    const users = usersList.map(profile => {
      const sub = subsMap.get(profile.id) || { plan_id: 'free', status: 'active' };
      const userPfs = pfsByUser.get(profile.id) || [];
      const hostedPfs = userPfs.filter(p => Boolean(p.published_at));
      const isLegacy = Boolean(sub.metadata?.legacy_access === true || (profile.createdAt ? new Date(profile.createdAt) < new Date('2026-08-01T00:00:00Z') : false));
      const latestPayment = paymentsByUser.get(profile.id);

      const rawPlan = sub.plan_id || 'free';
      const periodStart = sub.current_period_start || sub.metadata?.period_start || latestPayment?.reviewed_at || null;
      const periodEnd = sub.current_period_end || null;

      let daysRemaining = null;
      let isExpired = false;
      let isExpiringSoon = false;

      if (rawPlan !== 'free' && periodEnd) {
        const endMs = new Date(periodEnd).getTime();
        if (!isNaN(endMs)) {
          const diffMs = endMs - now;
          daysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
          if (diffMs <= 0) {
            isExpired = true;
          } else if (daysRemaining <= 7) {
            isExpiringSoon = true;
          }
        }
      }

      const effectivePlan = isExpired ? 'free' : rawPlan;
      let displayStatus = 'FREE';
      if (rawPlan !== 'free') {
        if (isExpired) displayStatus = 'EXPIRED';
        else if (isExpiringSoon) displayStatus = 'EXPIRING SOON';
        else displayStatus = (sub.status || 'ACTIVE').toUpperCase();
      }

      const amountPaid = latestPayment?.expected_amount_egp
        ? `${latestPayment.expected_amount_egp.toLocaleString()} EGP`
        : (sub.metadata?.amount_paid || sub.metadata?.amount_egp ? `${Number(sub.metadata.amount_paid || sub.metadata.amount_egp).toLocaleString()} EGP` : '—');

      return {
        ...profile,
        name: profile.name || profile.display_name || profile.email?.split('@')[0] || 'User',
        email: profile.email || '',
        plan: effectivePlan,
        rawPlan,
        status: sub.status || 'active',
        displayStatus,
        periodStart,
        periodEnd,
        daysRemaining,
        isExpired,
        isExpiringSoon,
        billingPeriod: sub.plan_id === 'keep_it_live' ? 'Annual' : (rawPlan !== 'free' ? 'Monthly' : '—'),
        subscriptionSource: sub.metadata?.source ? sub.metadata.source.toUpperCase() : (rawPlan !== 'free' ? 'INSTAPAY' : 'FREE'),
        amountPaid,
        autoRenewal: false,
        lastPaymentDate: latestPayment?.reviewed_at || sub.metadata?.approved_at || null,
        paymentRequestId: latestPayment?.id || sub.metadata?.payment_request_id || '—',
        isLegacy,
        legacyExemption: isLegacy ? 'GRANDFATHERED' : 'NONE',
        portfolioCount: userPfs.length,
        hostedCount: hostedPfs.length,
        hasKIL: Boolean(kilByUser.get(profile.id)),
        groupInfo: groupsByOwner.get(profile.id) || null
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

    if (error) {
      console.error('[Admin Portfolios] error:', error);
      return res.status(500).json({ error: error.message });
    }

    const ownerIds = [...new Set((portfolios || []).map(p => p.owner_user_id).filter(Boolean))];
    const { data: profiles } = ownerIds.length
      ? await context.admin.from('profiles').select('id,email,display_name').in('id', ownerIds)
      : { data: [] };

    const profileMap = new Map((profiles || []).map(p => [p.id, p]));

    const enriched = (portfolios || []).map(p => ({
      ...p,
      ownerUserId: p.owner_user_id,
      ownerEmail: profileMap.get(p.owner_user_id)?.email || 'Unknown',
      ownerName: profileMap.get(p.owner_user_id)?.display_name || 'User',
      isLive: Boolean(p.published_at),
      isFinalized: Boolean(p.is_finalized),
      createdAt: p.created_at,
      updatedAt: p.updated_at,
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
        group: { 2: '1,800 EGP', 3: '2,550 EGP', 4: '3,200 EGP', 5: '3,750 EGP' },
        keepItLive: '500 EGP/year/portfolio'
      },
      readOnlyNotice: 'READ ONLY: Feature flags and pricing are server/deployment authoritative.'
    });
  }

  // ─── AUDITED WRITE ACTIONS ────────────────────────────────────────

  // 8. Manual Plan Override (Audited with Duration)
  if (req.method === 'POST' && action === 'user-plan-override') {
    const { userId, targetPlanId, status, durationDays, startDate, endDate, groupSeats, reason } = req.body || {};
    if (!userId || !VALID_PLANS.includes(targetPlanId)) {
      return res.status(400).json({ error: `Valid userId and targetPlanId required. Allowed plans: ${VALID_PLANS.join(', ')}` });
    }
    if (!reason || String(reason).trim().length < 3) {
      return res.status(400).json({ error: 'A mandatory audit reason (minimum 3 characters) is required for plan overrides.' });
    }

    const now = new Date();
    let calculatedStart = null;
    let calculatedEnd = null;

    if (targetPlanId !== 'free') {
      if (startDate && endDate) {
        calculatedStart = new Date(startDate).toISOString();
        calculatedEnd = new Date(endDate).toISOString();
      } else {
        const days = Number(durationDays) || 30;
        calculatedStart = now.toISOString();
        calculatedEnd = new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
      }
    }

    const { data: existingSub } = await context.admin.from('subscriptions').select('*').eq('user_id', userId).maybeSingle();
    const prevPlan = existingSub?.plan_id || 'free';
    const prevStatus = existingSub?.status || 'active';

    const updateData = {
      user_id: userId,
      plan_id: targetPlanId,
      status: VALID_STATUSES.includes(status) ? status : 'active',
      current_period_start: calculatedStart,
      current_period_end: calculatedEnd,
      metadata: {
        ...(existingSub?.metadata || {}),
        source: 'admin_override',
        duration_days: durationDays || (calculatedStart && calculatedEnd ? Math.round((new Date(calculatedEnd) - new Date(calculatedStart)) / 86400000) : null),
        overridden_by: context.user.id,
        overridden_by_email: context.user.email,
        override_reason: reason.trim(),
        overridden_at: now.toISOString()
      },
      updated_at: now.toISOString()
    };

    const { error } = await context.admin.from('subscriptions').upsert(updateData, { onConflict: 'user_id' });
    if (error) return res.status(500).json({ error: error.message });

    if (targetPlanId === 'premium_group') {
      const seats = Number(groupSeats) || 2;
      await context.admin.from('groups').upsert([{
        owner_user_id: userId,
        seat_limit: seats,
        plan_type: 'premium_group',
        status: 'active',
        updated_at: now.toISOString()
      }], { onConflict: 'owner_user_id' });
    }

    await writeAuditLog(
      context.admin,
      context.user.id,
      userId,
      'PLAN_OVERRIDE',
      { plan: prevPlan, status: prevStatus },
      { plan: targetPlanId, status: updateData.status, periodStart: calculatedStart, periodEnd: calculatedEnd },
      reason,
      { source: 'admin_control_center', durationDays, startDate: calculatedStart, endDate: calculatedEnd }
    );

    return res.status(200).json({
      success: true,
      userId,
      planId: targetPlanId,
      status: updateData.status,
      periodStart: calculatedStart,
      periodEnd: calculatedEnd
    });
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
    const now = new Date();
    const nowISO = now.toISOString();

    if (decision === 'APPROVED') {
      // 1. Mark request APPROVED
      await context.admin.from('manual_payment_requests').update({
        status: 'APPROVED',
        reviewed_by: context.user.id,
        reviewed_at: nowISO,
        updated_at: nowISO
      }).eq('id', requestId);

      // 2. Fetch existing subscription for authoritative renewal calculation (Task 6)
      const { data: existingSub } = await context.admin.from('subscriptions').select('*').eq('user_id', request.user_id).maybeSingle();
      const periodDays = request.plan_id === 'keep_it_live' ? 365 : 30;

      let newPeriodStart;
      let newPeriodEnd;

      const existingEnd = existingSub?.current_period_end ? new Date(existingSub.current_period_end) : null;

      // If existing subscription is ACTIVE/GRACE and period_end > NOW (still has remaining days)
      if (existingSub && (existingSub.status === 'active' || existingSub.status === 'grace') && existingEnd && existingEnd.getTime() > now.getTime()) {
        // Renewal before expiry: keep original start, extend from existing expiry date
        newPeriodStart = existingSub.current_period_start || existingSub.created_at || nowISO;
        newPeriodEnd = new Date(existingEnd.getTime() + periodDays * 24 * 60 * 60 * 1000).toISOString();
      } else {
        // Renewal after expiry or brand new subscription: starts from current server time
        newPeriodStart = nowISO;
        newPeriodEnd = new Date(now.getTime() + periodDays * 24 * 60 * 60 * 1000).toISOString();
      }

      const seats = request.plan_id === 'premium_group' ? (Number(request.group_seats) || 2) : null;

      await context.admin.from('subscriptions').upsert([{
        user_id: request.user_id,
        plan_id: request.plan_id === 'keep_it_live' ? 'free' : request.plan_id,
        status: 'active',
        current_period_start: newPeriodStart,
        current_period_end: newPeriodEnd,
        metadata: {
          source: 'manual_instapay',
          subscription_source: 'INSTAPAY',
          payment_method: 'INSTAPAY',
          payment_request_id: requestId,
          amount_paid: request.expected_amount_egp,
          amount_egp: request.expected_amount_egp,
          auto_renew: false,
          autoRenewal: false,
          seat_count: seats,
          approved_by: context.user.id,
          approved_at: nowISO
        },
        updated_at: nowISO
      }], { onConflict: 'user_id' });

      // Handle Group
      if (request.plan_id === 'premium_group') {
        await context.admin.from('groups').upsert([{
          owner_user_id: request.user_id,
          seat_limit: seats || 2,
          plan_type: 'premium_group',
          status: 'active',
          updated_at: nowISO
        }], { onConflict: 'owner_user_id' });
      }

      // Handle Keep It Live
      if (request.plan_id === 'keep_it_live' && request.portfolio_id) {
        await context.admin.from('keep_live_entitlements').upsert([{
          portfolio_id: request.portfolio_id,
          user_id: request.user_id,
          status: 'active',
          starts_at: newPeriodStart,
          expires_at: newPeriodEnd,
          updated_at: nowISO
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
          subject: 'Your 3D Portfolio Maker plan is now active',
          htmlContent: html,
          tags: ['billing-payment-approved']
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
          subject: 'Payment verification update',
          htmlContent: html,
          tags: ['billing-payment-rejected']
        }).catch(err => console.error('Rejection email error:', err));
      }

      return res.status(200).json({ success: true, requestId, status: 'REJECTED', reason: rejReason });
    }
  }

  // 16. Visual Email Previews for Admin
  if (req.method === 'GET' && action === 'email-previews') {
    const otpPreview = generateOtpEmail({ firstName: 'Alex', otpCode: '48291083' });
    const resetPreview = generatePasswordResetEmail({ firstName: 'Alex', actionUrl: 'https://portfolio-maker-murex.vercel.app/reset-password?token=preview_token' });
    const adminPaymentPreview = generateAdminNewPaymentEmail({
      userName: 'Alex Morgan',
      userEmail: 'alex@example.com',
      planName: 'premium',
      amountEGP: 1000,
      requestId: 'mpr_sample_123',
      submittedAt: new Date().toISOString()
    });
    const approvedPreview = generatePaymentApprovedEmail({
      firstName: 'Alex',
      planName: 'premium',
      activeUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      groupSeats: null
    });
    const rejectedPreview = generatePaymentRejectedEmail({
      firstName: 'Alex',
      planName: 'pro',
      reason: 'The transfer screenshot did not clearly show the transaction reference ID or date.'
    });

    return res.status(200).json({
      previews: {
        otp: otpPreview,
        reset: resetPreview,
        adminPayment: adminPaymentPreview,
        approved: approvedPreview,
        rejected: rejectedPreview
      }
    });
  }

  return res.status(405).json({ error: 'Unsupported admin action' });
}
