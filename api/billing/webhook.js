import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

export const config = {
  api: {
    bodyParser: false
  }
};

async function buffer(readable) {
  const chunks = [];
  for await (const chunk of readable) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripeKey || !webhookSecret) return res.status(503).json({ error: 'Stripe webhook is not configured' });
  const stripe = new Stripe(stripeKey);

  let event;
  const buf = await buffer(req);
  const sig = req.headers['stripe-signature'];

  try {
    if (!sig) return res.status(400).json({ error: 'Missing Stripe signature' });
    event = stripe.webhooks.constructEvent(buf, sig, webhookSecret);
  } catch (err) {
    console.error(`Webhook signature verification failed: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://kupxhrfijkdlcteniqfp.supabase.co';
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const supabaseAdmin = createClient(supabaseUrl, supabaseSecretKey);

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      const userId = session.client_reference_id;
      if (userId) {
        await supabaseAdmin.from('subscriptions').upsert([
          {
            user_id: userId,
            customer_id: session.customer,
            subscription_id: session.subscription,
            plan_id: 'pro',
            status: 'active',
            updated_at: new Date().toISOString()
          }
        ], { onConflict: 'user_id' });
        console.log(`[Stripe Webhook] User ${userId} upgraded to PRO via checkout session ${session.id}`);
      }
      break;
    }
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const sub = event.data.object;
      const status = sub.status === 'active' ? 'active' : 'canceled';
      const planId = sub.status === 'active' ? 'pro' : 'free';

      const { data: existingSub } = await supabaseAdmin
        .from('subscriptions')
        .select('user_id')
        .eq('subscription_id', sub.id)
        .single();

      if (existingSub) {
        await supabaseAdmin.from('subscriptions').update({
          plan_id: planId,
          status: status,
          current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
          updated_at: new Date().toISOString()
        }).eq('subscription_id', sub.id);
      }
      break;
    }
    default:
      console.log(`Unhandled Stripe event type: ${event.type}`);
  }

  return res.status(200).json({ received: true });
}
