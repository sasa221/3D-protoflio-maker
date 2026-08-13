import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });

  const token = authHeader.replace('Bearer ', '');
  const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://kupxhrfijkdlcteniqfp.supabase.co';
  const supabaseAnonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY || supabaseAnonKey;

  try {
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });
    const { data: userData } = await userClient.auth.getUser();
    if (!userData?.user) return res.status(401).json({ error: 'Invalid user session' });

    const { portfolioId, domain } = req.body || {};
    if (!portfolioId || !domain) return res.status(400).json({ error: 'Missing portfolioId or domain' });

    const cleanHostname = domain.toLowerCase().trim().replace(/^https?:\/\//, '');
    const verificationToken = `verify_cname_${Math.random().toString(36).substr(2, 10)}`;

    const adminClient = createClient(supabaseUrl, supabaseSecretKey);
    const { data, error } = await adminClient.from('custom_domains').upsert([
      {
        portfolio_id: portfolioId,
        hostname: cleanHostname,
        status: 'pending_verification',
        verification_token: verificationToken,
        ssl_status: 'pending'
      }
    ], { onConflict: 'portfolio_id' }).select();

    if (error) return res.status(500).json({ error: error.message });

    return res.status(200).json({
      success: true,
      domain: cleanHostname,
      verificationToken: verificationToken,
      cnameRecord: 'cname.3dportfolio.app',
      status: 'pending_verification'
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
