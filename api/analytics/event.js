import { createClient } from '@supabase/supabase-js';

const ALLOWED_EVENTS = [
  'page_view',
  'variant_view',
  'project_open',
  'resume_download_clicked',
  'recruiter_mode_toggled',
  'cta_clicked',
  'scroll_depth'
];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { portfolioId, variantId, sessionId, eventName, projectId, deviceCategory, referrerCategory, metadata } = req.body || {};

  if (!portfolioId || !sessionId || !eventName) {
    return res.status(400).json({ error: 'Missing required analytics fields' });
  }

  if (!ALLOWED_EVENTS.includes(eventName)) {
    return res.status(400).json({ error: 'Invalid event name' });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://kupxhrfijkdlcteniqfp.supabase.co';
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseSecretKey) return res.status(503).json({ error: 'Analytics service is not configured' });

  try {
    const supabase = createClient(supabaseUrl, supabaseSecretKey);
    const { data: portfolio } = await supabase
      .from('portfolios')
      .select('id')
      .eq('id', portfolioId)
      .not('published_at', 'is', null)
      .maybeSingle();
    if (!portfolio) return res.status(404).json({ error: 'Published portfolio not found' });
    const metadataJson = metadata && typeof metadata === 'object' ? JSON.stringify(metadata) : '{}';
    const safeMetadata = metadataJson.length <= 4000 ? JSON.parse(metadataJson) : {};
    const { data, error } = await supabase.from('analytics_events').insert([
      {
        portfolio_id: portfolioId,
        variant_id: variantId || null,
        session_id: sessionId,
        event_name: eventName,
        project_id: projectId || null,
        device_category: deviceCategory || 'Desktop',
        referrer_category: referrerCategory || 'Direct',
        metadata: safeMetadata
      }
    ]).select();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ success: true, eventId: data[0]?.id });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
