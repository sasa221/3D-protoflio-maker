import { createClient } from '@supabase/supabase-js';

async function requireAdmin(req, res) {
  const authorization = req.headers.authorization || '';
  if (!authorization.startsWith('Bearer ')) return res.status(401).json({ error: 'Authentication required' });
  const url = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const serviceKey = process.env.SUPABASE_SECRET_KEY;
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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  const action = req.query.action || 'me';
  if (req.method === 'GET' && action === 'health') {
    const url = process.env.VITE_SUPABASE_URL || 'https://kupxhrfijkdlcteniqfp.supabase.co';
    const key = process.env.SUPABASE_SECRET_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
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
    return res.status(coreHealthy ? 200 : 503).json({ status: launchReady ? 'HEALTHY' : coreHealthy ? 'DEGRADED' : 'UNHEALTHY',
      launchReady, api: 'connected', database, storage, billing: billing ? 'configured_test_mode' : 'not_connected',
      email: email ? 'configured_unverified' : 'not_connected', monitoring: monitoring ? 'connected' : 'not_connected',
      timestamp: new Date().toISOString() });
  }
  const context = await requireAdmin(req, res);
  if (!context || res.headersSent) return;

  if (req.method === 'GET' && action === 'me') {
    return res.status(200).json({ isAdmin: true, user: { id: context.user.id, email: context.user.email } });
  }
  if (req.method === 'GET' && action === 'overview') {
    let { data: profiles, error } = await context.admin.from('profiles')
      .select('id,email,display_name,created_at,is_admin').order('created_at', { ascending: false }).limit(500);
    if (error?.message?.includes('is_admin')) {
      const fallback = await context.admin.from('profiles').select('id,email,display_name,created_at').order('created_at', { ascending: false }).limit(500);
      profiles = (fallback.data || []).map((profile) => ({ ...profile, is_admin: false }));
      error = fallback.error;
    }
    if (error) return res.status(500).json({ error: error.message });
    const ids = (profiles || []).map((profile) => profile.id);
    const [{ data: subscriptions }, { data: portfolios }] = await Promise.all([
      ids.length ? context.admin.from('subscriptions').select('user_id,plan_id,status').in('user_id', ids) : { data: [] },
      context.admin.from('portfolios').select('owner_user_id')
    ]);
    const plans = new Map((subscriptions || []).map((item) => [item.user_id, item]));
    const counts = (portfolios || []).reduce((all, item) => ({ ...all, [item.owner_user_id]: (all[item.owner_user_id] || 0) + 1 }), {});
    const users = (profiles || []).map((profile) => ({ id: profile.id, email: profile.email,
      name: profile.display_name || profile.email?.split('@')[0] || 'User', createdAt: profile.created_at,
      isAdmin: Boolean(profile.is_admin) || profile.id === context.user.id || context.allowedEmails.has((profile.email || '').toLowerCase()),
      plan: plans.get(profile.id)?.plan_id || 'free',
      status: plans.get(profile.id)?.status || 'active', portfolioCount: counts[profile.id] || 0 }));
    return res.status(200).json({ users, stats: { users: users.length, proUsers: users.filter((u) => u.plan === 'pro').length,
      admins: users.filter((u) => u.isAdmin).length, portfolios: (portfolios || []).length } });
  }
  if (req.method === 'PATCH' && action === 'user-plan') {
    const { userId, planId } = req.body || {};
    if (!userId || !['free', 'pro'].includes(planId)) return res.status(400).json({ error: 'A valid user and plan are required' });
    const { error } = await context.admin.from('subscriptions').upsert({ user_id: userId, plan_id: planId,
      status: 'active', updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true, userId, planId });
  }
  return res.status(405).json({ error: 'Unsupported admin action' });
}
