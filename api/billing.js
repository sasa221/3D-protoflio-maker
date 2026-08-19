import { createClient } from '@supabase/supabase-js';
import { sendBrevoEmail } from '../src/services/BrevoDispatcher.js';
import { generateAdminNewPaymentEmail } from '../src/services/EmailTemplates.js';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb'
    }
  }
};

const PLAN_PRICES = {
  free: 0,
  pro: 600,
  premium: 1000,
  premium_group: 1500, // base 2-seat price
  keep_it_live: 500
};

const GROUP_SEAT_PRICING = {
  2: 1500,
  3: 1800,
  4: 2200,
  5: 2800
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const action = req.query.action || 'submit-manual-payment';
  const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://kupxhrfijkdlcteniqfp.supabase.co';
  const supabaseAnonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  // ─────────────────────────────────────────────────────────────
  // 1. ACTION: SUBMIT MANUAL INSTAPAY PAYMENT
  // ─────────────────────────────────────────────────────────────
  if (action === 'submit-manual-payment') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Unauthorized — Auth token required' });
    const token = authHeader.replace('Bearer ', '');

    if (!supabaseSecretKey) return res.status(503).json({ error: 'Billing database access is not configured' });

    try {
      const userClient = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: `Bearer ${token}` } } });
      const { data: userData, error: userErr } = await userClient.auth.getUser();
      if (userErr || !userData?.user) return res.status(401).json({ error: 'Unauthorized user session' });

      if (!userData.user.email_confirmed_at && !userData.user.confirmed_at && !userData.user.user_metadata?.email_verified) {
        return res.status(403).json({ error: 'Email verification required before submitting payment requests' });
      }

      const userId = userData.user.id;
      const userEmail = userData.user.email || '';
      const userName = userData.user.user_metadata?.full_name || userData.user.user_metadata?.name || userEmail.split('@')[0];

      const { targetPlanId, groupSeats, portfolioId, promoCode, proofBase64, contentType } = req.body || {};
      if (!targetPlanId || !['pro', 'premium', 'premium_group', 'keep_it_live'].includes(targetPlanId)) {
        return res.status(400).json({ error: 'Invalid target plan' });
      }

      if (!proofBase64) {
        return res.status(400).json({ error: 'Payment transfer proof screenshot is required' });
      }

      const adminClient = createClient(supabaseUrl, supabaseSecretKey);

      // Prevent duplicate pending requests
      const { data: existingPending } = await adminClient
        .from('manual_payment_requests')
        .select('id,plan_id,status,created_at')
        .eq('user_id', userId)
        .eq('status', 'PENDING')
        .maybeSingle();

      if (existingPending) {
        return res.status(409).json({
          error: 'You already have a payment request waiting for review.',
          pendingRequestId: existingPending.id,
          plan: existingPending.plan_id
        });
      }

      // Calculate server-authoritative base price
      let baseAmount = PLAN_PRICES[targetPlanId] || 600;
      let validSeats = null;
      if (targetPlanId === 'premium_group') {
        validSeats = Number(groupSeats) || 2;
        if (validSeats < 2 || validSeats > 5) return res.status(400).json({ error: 'Group seats must be between 2 and 5' });
        baseAmount = GROUP_SEAT_PRICING[validSeats] || 1500;
      }

      // Validate promo code on server
      let discountAmount = 0;
      let appliedPromo = null;
      if (promoCode) {
        const cleanCode = String(promoCode).trim().toUpperCase();
        const { data: promo } = await adminClient.from('promo_codes').select('*').eq('code', cleanCode).maybeSingle();
        if (promo && promo.active && (!promo.expires_at || new Date(promo.expires_at) >= new Date())) {
          if (!promo.applicable_plans?.length || promo.applicable_plans.includes(targetPlanId)) {
            appliedPromo = promo.code;
            if (promo.discount_type === 'percentage') {
              discountAmount = Math.round((baseAmount * Number(promo.discount_value)) / 100);
            } else {
              discountAmount = Number(promo.discount_value);
            }
          }
        }
      }

      const finalExpectedAmount = Math.max(0, baseAmount - discountAmount);

      // Upload proof to private storage
      const base64Data = proofBase64.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      const ext = contentType?.includes('png') ? 'png' : contentType?.includes('webp') ? 'webp' : 'jpg';
      const proofPath = `${userId}/proofs/${Date.now()}_proof.${ext}`;

      const { error: uploadErr } = await adminClient.storage
        .from('payment_proofs')
        .upload(proofPath, buffer, { upsert: true, contentType: contentType || `image/${ext}` });

      if (uploadErr) {
        console.warn('Proof upload fallback notice:', uploadErr.message);
      }

      const requestId = 'mpr_' + Math.random().toString(36).substr(2, 10);
      const submittedAt = new Date().toISOString();

      const { error: insertErr } = await adminClient.from('manual_payment_requests').insert([{
        id: requestId,
        user_id: userId,
        plan_id: targetPlanId,
        expected_amount_egp: finalExpectedAmount,
        discount_amount_egp: discountAmount,
        promo_code: appliedPromo,
        group_seats: validSeats,
        portfolio_id: portfolioId || null,
        proof_storage_path: proofPath,
        status: 'PENDING',
        created_at: submittedAt,
        updated_at: submittedAt
      }]);

      if (insertErr) return res.status(500).json({ error: `Failed to record payment request: ${insertErr.message}` });

      // Dispatch Brevo notification email to admin
      const adminEmail = process.env.ADMIN_NOTIFY_EMAIL || process.env.ADMIN_EMAILS?.split(',')[0]?.trim() || process.env.BREVO_SENDER_EMAIL;
      if (adminEmail) {
        const html = generateAdminNewPaymentEmail({
          userName,
          userEmail,
          planName: targetPlanId,
          amountEGP: finalExpectedAmount,
          requestId,
          submittedAt
        });
        await sendBrevoEmail({
          to: adminEmail,
          subject: `🔔 New Payment Verification Request — ${targetPlanId.toUpperCase()} (${finalExpectedAmount} EGP)`,
          htmlContent: html
        }).catch(err => console.error('Admin email error:', err));
      }

      return res.status(200).json({
        success: true,
        requestId,
        status: 'PENDING',
        plan: targetPlanId,
        expectedAmountEGP: finalExpectedAmount
      });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 2. ACTION: GET USER PAYMENT STATUS
  // ─────────────────────────────────────────────────────────────
  if (action === 'get-payment-status' || (req.method === 'GET' && action === 'status')) {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });
    const token = authHeader.replace('Bearer ', '');

    try {
      const userClient = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: `Bearer ${token}` } } });
      const { data: userData } = await userClient.auth.getUser();
      if (!userData?.user) return res.status(401).json({ error: 'Invalid session' });

      const adminClient = createClient(supabaseUrl, supabaseSecretKey);
      const { data: requests, error } = await adminClient
        .from('manual_payment_requests')
        .select('*')
        .eq('user_id', userData.user.id)
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ requests: requests || [] });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(400).json({ error: `Unknown billing action: ${action}` });
}
