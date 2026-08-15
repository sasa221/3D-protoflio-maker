import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });

  const token = authHeader.replace('Bearer ', '');
  const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://kupxhrfijkdlcteniqfp.supabase.co';
  const supabaseAnonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });
    const { data: userData } = await supabase.auth.getUser();

    if (!userData?.user) return res.status(401).json({ error: 'Invalid user session' });

    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) return res.status(503).json({ error: 'Stripe is not configured' });
    if (!supabaseSecretKey) return res.status(503).json({ error: 'Billing database access is not configured' });
    const supabaseAdmin = createClient(supabaseUrl, supabaseSecretKey);
    const { data: subscription, error: subscriptionError } = await supabaseAdmin
      .from('subscriptions')
      .select('customer_id')
      .eq('user_id', userData.user.id)
      .single();
    if (subscriptionError || !subscription?.customer_id) {
      return res.status(404).json({ error: 'No billing account was found for this user' });
    }
    const stripe = new Stripe(stripeKey);

    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.customer_id,
      return_url: `${req.headers.origin || 'https://portfolio-maker-murex.vercel.app'}/`
    });

    return res.status(200).json({ success: true, url: session.url });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
