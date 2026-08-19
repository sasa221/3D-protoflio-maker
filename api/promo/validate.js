import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Authentication required' });

  const token = authHeader.replace('Bearer ', '');
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const supabaseServiceKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
    return res.status(503).json({ error: 'Promo service not configured' });
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
    const { code, plan } = req.body || {};

    if (!code || typeof code !== 'string') {
      return res.status(400).json({ valid: false, reason: 'Promo code is required.' });
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Look up promo code
    const { data: promo } = await adminClient
      .from('promo_codes')
      .select('*')
      .eq('code', code.trim().toUpperCase())
      .eq('active', true)
      .maybeSingle();

    if (!promo) {
      return res.status(200).json({ valid: false, reason: 'This promo code is not valid.' });
    }

    // Check expiry
    const now = new Date();
    if (promo.starts_at && new Date(promo.starts_at) > now) {
      return res.status(200).json({ valid: false, reason: 'This promo code is not active yet.' });
    }
    if (promo.expires_at && new Date(promo.expires_at) < now) {
      return res.status(200).json({ valid: false, reason: 'This promo code has expired.' });
    }

    // Check max redemptions
    if (promo.max_redemptions && promo.redemption_count >= promo.max_redemptions) {
      return res.status(200).json({ valid: false, reason: 'This promo code has reached its usage limit.' });
    }

    // Check per-user limit
    if (promo.per_user_limit) {
      const { count: userRedemptions } = await adminClient
        .from('promo_redemptions')
        .select('id', { count: 'exact', head: true })
        .eq('promo_id', promo.id)
        .eq('user_id', userId);

      if ((userRedemptions || 0) >= promo.per_user_limit) {
        return res.status(200).json({ valid: false, reason: 'You have already used this promo code.' });
      }
    }

    // Check applicable plans
    if (plan && promo.applicable_plans && promo.applicable_plans.length > 0) {
      if (!promo.applicable_plans.includes(plan)) {
        return res.status(200).json({ valid: false, reason: 'This promo code does not apply to the selected plan.' });
      }
    }

    // Calculate discount (never trust client price)
    const PLAN_PRICES = { pro: 600, premium: 1000 };
    const basePrice = PLAN_PRICES[plan] || 0;
    let discountAmount = 0;
    if (promo.discount_type === 'percentage') {
      discountAmount = Math.round(basePrice * (promo.discount_value / 100));
    } else if (promo.discount_type === 'fixed_amount') {
      discountAmount = Math.min(promo.discount_value, basePrice);
    }
    const finalPrice = Math.max(0, basePrice - discountAmount);

    return res.status(200).json({
      valid: true,
      discount: {
        type: promo.discount_type,
        value: promo.discount_value,
        amount: discountAmount,
        finalPrice,
        currency: 'EGP'
      }
    });
  } catch (e) {
    console.error('Promo validation error:', e);
    return res.status(500).json({ error: 'Promo validation failed' });
  }
}
