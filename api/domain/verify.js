import { createClient } from '@supabase/supabase-js';
import dns from 'dns';
import { promisify } from 'util';

const resolveCname = promisify(dns.resolveCname);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { portfolioId, domain } = req.body || {};
  if (!portfolioId || !domain) return res.status(400).json({ error: 'Missing portfolioId or domain' });

  const cleanHostname = domain.toLowerCase().trim().replace(/^https?:\/\//, '');
  const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://kupxhrfijkdlcteniqfp.supabase.co';
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const adminClient = createClient(supabaseUrl, supabaseSecretKey);

  try {
    let verified = false;
    try {
      const records = await resolveCname(cleanHostname);
      verified = records.some(r => r.includes('3dportfolio.app') || r.includes('vercel.app'));
    } catch (e) {
      verified = false;
    }

    if (verified) {
      await adminClient.from('custom_domains').update({
        status: 'active',
        ssl_status: 'active',
        connected_at: new Date().toISOString()
      }).eq('portfolio_id', portfolioId);

      return res.status(200).json({ success: true, verified: true, status: 'active', sslStatus: 'active' });
    } else {
      return res.status(200).json({
        success: false,
        verified: false,
        status: 'pending_verification',
        message: 'DNS CNAME record not found or not propagated yet.'
      });
    }
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
