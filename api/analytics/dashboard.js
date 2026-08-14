import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Unauthorized — Missing Auth Token' });
  }

  const token = authHeader.replace('Bearer ', '');
  const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://kupxhrfijkdlcteniqfp.supabase.co';
  const supabaseAnonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseAnonKey || !supabaseSecretKey) return res.status(503).json({ error: 'Analytics service is not configured' });

  try {
    // 1. Authenticate user JWT
    const supabaseUserClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });
    const { data: userData, error: userErr } = await supabaseUserClient.auth.getUser();

    if (userErr || !userData.user) {
      return res.status(401).json({ error: 'Unauthorized — Invalid JWT Token' });
    }

    const userId = userData.user.id;
    const portfolioId = req.query.portfolioId;

    if (!portfolioId) {
      return res.status(400).json({ error: 'Missing portfolioId parameter' });
    }

    // 2. Verify ownership of target portfolio
    const supabaseAdmin = createClient(supabaseUrl, supabaseSecretKey);
    const { data: pf, error: pfErr } = await supabaseAdmin
      .from('portfolios')
      .select('id, owner_user_id')
      .eq('id', portfolioId)
      .single();

    if (pfErr || !pf || pf.owner_user_id !== userId) {
      return res.status(403).json({ error: 'Forbidden — You do not own this portfolio' });
    }

    // 3. Query analytics events for owner
    const { data: events, error: evErr } = await supabaseAdmin
      .from('analytics_events')
      .select('*')
      .eq('portfolio_id', portfolioId);

    if (evErr) {
      return res.status(500).json({ error: evErr.message });
    }

    return res.status(200).json({ success: true, events: events || [] });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
