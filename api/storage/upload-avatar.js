import { createClient } from '@supabase/supabase-js';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb'
    }
  }
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
    return res.status(401).json({ error: 'Unauthorized — Auth Bearer token required' });
  }

  const token = authHeader.replace(/^bearer\s+/i, '').trim();
  const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://kupxhrfijkdlcteniqfp.supabase.co';
  const supabaseAnonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey;

  try {
    // 1. Authenticate and validate user JWT token with Supabase Auth
    const adminClient = createClient(supabaseUrl, supabaseSecretKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const { data: userData, error: userErr } = await adminClient.auth.getUser(token);

    if (userErr || !userData?.user?.id) {
      return res.status(401).json({ error: `Unauthorized user session: ${userErr?.message || 'Invalid token'}` });
    }

    const userId = userData.user.id;
    const { fileBase64, portfolioId, contentType } = req.body || {};

    if (!fileBase64) {
      return res.status(400).json({ error: 'Missing image payload' });
    }

    // Convert Base64 data URL to Buffer
    const base64Data = fileBase64.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    const safePortfolioId = portfolioId && portfolioId !== 'pf_default' ? portfolioId : 'default';
    const ext = contentType?.includes('png') ? 'png' : contentType?.includes('jpeg') || contentType?.includes('jpg') ? 'jpg' : 'webp';
    const storagePath = `${userId}/${safePortfolioId}/avatar.${ext}`;

    // 2. Upload to Supabase Storage using adminClient with upsert
    const { error: uploadErr } = await adminClient.storage
      .from('avatars')
      .upload(storagePath, buffer, {
        upsert: true,
        contentType: contentType || `image/${ext}`
      });

    if (uploadErr) {
      console.error('Backend avatar upload error:', uploadErr);
      return res.status(500).json({ error: `Storage upload failed: ${uploadErr.message}` });
    }

    const { data: publicData } = adminClient.storage
      .from('avatars')
      .getPublicUrl(storagePath);

    return res.status(200).json({
      success: true,
      storageBucket: 'avatars',
      storagePath,
      publicUrl: publicData.publicUrl,
      updatedAt: new Date().toISOString()
    });

  } catch (err) {
    console.error('Serverless avatar upload handler error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
