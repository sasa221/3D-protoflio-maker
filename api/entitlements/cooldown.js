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
    return res.status(503).json({ error: 'Service not configured' });
  }

  try {
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return res.status(401).json({ error: 'Invalid session' });
    }

    const userId = userData.user.id;
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Get last creation timestamp
    const { data: lastCreation } = await adminClient
      .from('portfolio_creation_history')
      .select('created_at')
      .eq('user_id', userId)
      .eq('action', 'create')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!lastCreation) {
      return res.status(200).json({
        canCreate: true,
        lastCreatedAt: null,
        nextAvailableAt: null
      });
    }

    const cooldownMs = 7 * 24 * 60 * 60 * 1000;
    const lastCreatedAt = new Date(lastCreation.created_at);
    const nextAvailable = new Date(lastCreatedAt.getTime() + cooldownMs);
    const canCreate = Date.now() >= nextAvailable.getTime();

    return res.status(200).json({
      canCreate,
      lastCreatedAt: lastCreatedAt.toISOString(),
      nextAvailableAt: canCreate ? null : nextAvailable.toISOString()
    });
  } catch (e) {
    console.error('Cooldown check error:', e);
    return res.status(500).json({ error: 'Cooldown check failed' });
  }
}
