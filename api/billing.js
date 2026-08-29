import { createClient } from '@supabase/supabase-js';
import { sendBrevoEmail } from '../src/services/BrevoDispatcher.js';
import { generateAdminNewPaymentEmail } from '../src/services/EmailTemplates.js';
import { applyCors } from './_cors.js';

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
  premium_group: 1800, // base 2-seat price
  keep_it_live: 500
};

const GROUP_SEAT_PRICING = {
  2: 1800,
  3: 2550,
  4: 3200,
  5: 3750
};

const MAX_PAYMENT_PROOF_BYTES = 7 * 1024 * 1024;
const ALLOWED_PAYMENT_PROOF_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

function isRecognizedPaymentProof(buffer, contentType) {
  if (!Buffer.isBuffer(buffer) || !buffer.length) return false;
  if (contentType === 'image/png') return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (contentType === 'image/jpeg') return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (contentType === 'image/webp') return buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP';
  return false;
}

export default async function handler(req, res) {
  applyCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const action = req.query.action || 'submit-manual-payment';
  const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://kupxhrfijkdlcteniqfp.supabase.co';
  const supabaseAnonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  // ─────────────────────────────────────────────────────────────
  // 0. ACTION: PAYMENT CONFIG (Public Read-Only Destination Info)
  // ─────────────────────────────────────────────────────────────
  if (action === 'payment-config' || (req.method === 'GET' && action === 'config')) {
    // Never invent a payment destination. A missing production environment
    // variable must disable checkout rather than show a personal address.
    const displayName = process.env.PAYMENT_INSTAPAY_NAME || '';
    const instapayAddress = process.env.PAYMENT_INSTAPAY_ADDRESS || '';
    const phoneNumber = process.env.PAYMENT_INSTAPAY_PHONE || '';
    const paymentNote = process.env.PAYMENT_INSTAPAY_NOTE || 'Manual payments are not configured at the moment.';
    const bankName = process.env.PAYMENT_INSTAPAY_BANK || null;
    const isConfigured = Boolean(displayName && instapayAddress);

    return res.status(200).json({
      configured: isConfigured,
      method: 'INSTAPAY',
      displayName,
      instapayAddress,
      phoneNumber,
      bankName,
      paymentNote
    });
  }


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

      if (!ALLOWED_PAYMENT_PROOF_TYPES.has(contentType)) {
        return res.status(400).json({ error: 'Payment proof must be a PNG, JPG, or WEBP image.' });
      }

      const adminClient = createClient(supabaseUrl, supabaseSecretKey);

      if (portfolioId) {
        const { data: ownedPortfolio, error: portfolioError } = await adminClient
          .from('portfolios')
          .select('id')
          .eq('id', String(portfolioId))
          .eq('owner_user_id', userId)
          .maybeSingle();
        if (portfolioError || !ownedPortfolio) return res.status(403).json({ error: 'That portfolio is not available to this account.' });
      }

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

      // Calculate server-authoritative base price (§2)
      let baseAmount = PLAN_PRICES[targetPlanId] || 600;
      let validSeats = null;
      if (targetPlanId === 'premium_group') {
        validSeats = Number(groupSeats) || 2;
        if (validSeats < 2 || validSeats > 5) {
          return res.status(400).json({ error: 'Group seats must be between 2 and 5' });
        }
        baseAmount = GROUP_SEAT_PRICING[validSeats] || 1800;
      }

      // Validate promo code authoritatively on server
      let discountAmount = 0;
      let promoDiscountPercent = 0;
      let appliedPromo = null;

      if (promoCode && typeof promoCode === 'string' && promoCode.trim().length > 0) {
        const cleanCode = promoCode.trim().toUpperCase();
        const { data: promo, error: promoErr } = await adminClient
          .from('promo_codes')
          .select('*')
          .eq('code', cleanCode)
          .maybeSingle();

        if (promoErr || !promo || promo.active === false || (promo.expires_at && new Date(promo.expires_at) < new Date())) {
          return res.status(400).json({ error: 'The promo code you entered is invalid or has expired.' });
        }

        if (promo.applicable_plans && Array.isArray(promo.applicable_plans) && promo.applicable_plans.length > 0) {
          if (!promo.applicable_plans.includes(targetPlanId)) {
            return res.status(400).json({ error: 'This promo code is not applicable to the selected plan.' });
          }
        }

        appliedPromo = promo.code;
        if (promo.discount_type === 'percentage') {
          promoDiscountPercent = Number(promo.discount_value) || 0;
          discountAmount = Math.round((baseAmount * promoDiscountPercent) / 100);
        } else {
          discountAmount = Math.min(baseAmount, Number(promo.discount_value) || 0);
          promoDiscountPercent = baseAmount > 0 ? Math.round((discountAmount / baseAmount) * 100) : 0;
        }
      }

      const finalExpectedAmount = Math.max(0, baseAmount - discountAmount);

      // Upload proof to private storage
      const base64Data = String(proofBase64).replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      if (!buffer.length || buffer.length > MAX_PAYMENT_PROOF_BYTES || !isRecognizedPaymentProof(buffer, contentType)) {
        return res.status(400).json({ error: 'Payment proof is invalid or exceeds the 7MB server limit.' });
      }
      const ext = contentType === 'image/png' ? 'png' : contentType === 'image/webp' ? 'webp' : 'jpg';
      const proofPath = `${userId}/proofs/${Date.now()}_proof.${ext}`;

      const { error: uploadErr } = await adminClient.storage
        .from('payment_proofs')
        .upload(proofPath, buffer, { upsert: true, contentType: contentType || `image/${ext}` });

      if (uploadErr) {
        console.error('Proof storage upload failure:', uploadErr.message);
        return res.status(400).json({ error: 'Failed to upload payment proof screenshot. Please try again.' });
      }

      const requestId = 'mpr_' + Math.random().toString(36).substr(2, 10);
      const submittedAt = new Date().toISOString();

      // INSERT with all required amount columns populated authoritatively
      const { error: insertErr } = await adminClient.from('manual_payment_requests').insert([{
        id: requestId,
        user_id: userId,
        plan_id: targetPlanId,
        group_seats: validSeats,
        portfolio_id: portfolioId || null,
        expected_amount_egp: baseAmount,
        discount_amount_egp: discountAmount,
        final_expected_amount_egp: finalExpectedAmount,
        promo_code: appliedPromo,
        promo_discount_percent: promoDiscountPercent,
        payment_method: 'INSTAPAY',
        proof_storage_path: proofPath,
        status: 'PENDING',
        submitted_at: submittedAt,
        created_at: submittedAt,
        updated_at: submittedAt
      }]);

      if (insertErr) {
        if (insertErr.code === '23505') {
          return res.status(409).json({ error: 'You already have a payment request waiting for review.' });
        }
        console.error('Payment request DB insert error:', insertErr);
        return res.status(500).json({ error: "We couldn't submit your payment request. Please try again." });
      }

      // Dispatch Brevo notification email to admin
      // Do not fall back to a personal address in production. If an admin
      // notification destination is not configured, skip the optional email.
      const adminEmail = process.env.ADMIN_NOTIFY_EMAIL || process.env.ADMIN_EMAILS?.split(',')[0]?.trim() || '';
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
          subject: 'New payment verification request',
          htmlContent: html,
          tags: ['billing-payment-submitted']
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
      console.error('Submit manual payment uncaught exception:', e);
      return res.status(500).json({ error: "We couldn't submit your payment request. Please try again." });
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
