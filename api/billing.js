import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

export const config = {
  api: {
    bodyParser: true
  }
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, stripe-signature');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const action = req.query.action || 'checkout';
  const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://kupxhrfijkdlcteniqfp.supabase.co';
  const supabaseAnonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  const stripeKey = process.env.STRIPE_SECRET_KEY;

  // 1. ACTION: CHECKOUT (Phase 8B placeholder)
  if (action === 'checkout') {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Unauthorized — Token required' });
    const token = authHeader.replace('Bearer ', '');

    try {
      const supabase = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: `Bearer ${token}` } } });
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr || !userData.user) return res.status(401).json({ error: 'Unauthorized user session' });

      if (!stripeKey) return res.status(503).json({ error: 'Stripe is not configured (Phase 8B pending)' });
      const stripe = new Stripe(stripeKey);

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        mode: 'subscription',
        customer_email: userData.user.email,
        client_reference_id: userData.user.id,
        line_items: [{
          price_data: {
            currency: 'egp',
            product_data: { name: 'Pro Tier Subscription', description: 'Hosted portfolio, PDF export, basic analytics' },
            unit_amount: 60000,
            recurring: { interval: 'month' }
          },
          quantity: 1
        }],
        success_url: `${req.headers.origin || 'https://portfolio-maker-murex.vercel.app'}/?billing=success`,
        cancel_url: `${req.headers.origin || 'https://portfolio-maker-murex.vercel.app'}/?billing=cancelled`
      });

      return res.status(200).json({ success: true, url: session.url, sessionId: session.id });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // 2. ACTION: PORTAL
  if (action === 'portal') {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });
    const token = authHeader.replace('Bearer ', '');

    try {
      const supabase = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: `Bearer ${token}` } } });
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) return res.status(401).json({ error: 'Invalid user session' });

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

  // 3. ACTION: WEBHOOK
  if (action === 'webhook') {
    return res.status(200).json({ received: true, note: 'Phase 8B pending' });
  }

  return res.status(400).json({ error: `Unknown billing action: ${action}` });
}
