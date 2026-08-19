import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Authentication required' });

  const token = authHeader.replace('Bearer ', '');
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const supabaseServiceKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
    return res.status(503).json({ error: 'Audit service not configured' });
  }

  try {
    // Authenticate
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return res.status(401).json({ error: 'Invalid session' });
    }

    // Admin check
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: profile } = await adminClient
      .from('profiles')
      .select('is_admin')
      .eq('id', userData.user.id)
      .maybeSingle();

    const allowedEmails = new Set(
      (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean)
    );

    if (!profile?.is_admin && !allowedEmails.has((userData.user.email || '').toLowerCase())) {
      return res.status(403).json({ error: 'Administrator access required' });
    }

    // Query audit log
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    const { data: logs, error: logErr } = await adminClient
      .from('entitlement_audit_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (logErr) {
      return res.status(500).json({ error: logErr.message });
    }

    return res.status(200).json({ logs: logs || [], count: (logs || []).length });
  } catch (e) {
    console.error('Audit log error:', e);
    return res.status(500).json({ error: 'Audit log query failed' });
  }
}
