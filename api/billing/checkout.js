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
  if (!authHeader) {
    return res.status(401).json({ error: 'Unauthorized — Token required' });
  }

  const token = authHeader.replace('Bearer ', '');
  const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://kupxhrfijkdlcteniqfp.supabase.co';
  const supabaseAnonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });
    const { data: userData, error: userErr } = await supabase.auth.getUser();

    if (userErr || !userData.user) {
      return res.status(401).json({ error: 'Unauthorized user session' });
    }

    const user = userData.user;
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) return res.status(503).json({ error: 'Stripe is not configured' });
    const stripe = new Stripe(stripeKey);

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      customer_email: user.email,
      client_reference_id: user.id,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Pro Tier Subscription',
              description: 'Unlimited variants, custom domains, 4K rendering & analytics'
            },
            unit_amount: 1900,
            recurring: { interval: 'month' }
          },
          quantity: 1
        }
      ],
      success_url: `${req.headers.origin || 'https://portfolio-maker.vercel.app'}/?billing=success`,
      cancel_url: `${req.headers.origin || 'https://portfolio-maker.vercel.app'}/?billing=cancelled`
    });

    return res.status(200).json({ success: true, url: session.url, sessionId: session.id });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
