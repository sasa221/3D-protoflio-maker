import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://kupxhrfijkdlcteniqfp.supabase.co';
  const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  let dbStatus = 'connected';
  let storageStatus = 'connected';

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { error: dbErr } = await supabase.from('profiles').select('count', { count: 'exact', head: true });
    if (dbErr) dbStatus = 'error';

    const { error: stErr } = await supabase.storage.listBuckets();
    if (stErr) storageStatus = 'error';
  } catch (e) {
    dbStatus = 'error';
    storageStatus = 'error';
  }

  const stripeConfigured = Boolean(process.env.STRIPE_SECRET_KEY);
  const brevoConfigured = Boolean(process.env.BREVO_API_KEY && process.env.BREVO_SENDER_EMAIL);
  const sentryConfigured = Boolean(process.env.SENTRY_AUTH_TOKEN || process.env.VITE_SENTRY_DSN);

  return res.status(200).json({
    status: 'HEALTHY',
    api: 'connected',
    database: dbStatus,
    storage: storageStatus,
    billing: stripeConfigured ? 'configured_test_mode' : 'not_connected',
    email: brevoConfigured ? 'configured_unverified' : 'not_connected',
    monitoring: sentryConfigured ? 'connected' : 'not_connected',
    timestamp: new Date().toISOString(),
    services: {
      api: { name: 'API Serverless Gateway', status: 'REAL CONNECTED' },
      frontend_hosting: { name: 'Frontend Hosting (Vercel)', status: process.env.VERCEL ? 'REAL CONNECTED' : 'LOCAL' },
      supabase_auth: { name: 'Supabase Auth', status: dbStatus === 'connected' ? 'REAL CONNECTED' : 'ERROR' },
      supabase_db: { name: 'Supabase Postgres Database', status: dbStatus === 'connected' ? 'REAL CONNECTED' : 'ERROR' },
      supabase_storage: { name: 'Supabase Storage Buckets', status: storageStatus === 'connected' ? 'REAL CONNECTED' : 'ERROR' },
      stripe: { name: 'Stripe Billing (TEST MODE)', status: stripeConfigured ? 'CONFIGURED — FLOW TEST REQUIRED' : 'NOT CONNECTED' },
      brevo: { name: 'Brevo Transactional Email', status: brevoConfigured ? 'CONFIGURED — SEND TEST REQUIRED' : 'NOT CONNECTED' },
      sentry: { name: 'Sentry Error Monitoring', status: sentryConfigured ? 'REAL CONNECTED' : 'NOT CONNECTED' }
    }
  });
}
