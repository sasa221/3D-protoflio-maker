-- Phase 8B Manual InstaPay Billing & Payment Review Migration
-- Non-destructive: CREATE TABLE and ALTER ADD COLUMN only.
-- Run against Supabase Postgres when migration is approved.

-- ============================================
-- 1. Manual Payment Requests Table
-- ============================================
CREATE TABLE IF NOT EXISTS public.manual_payment_requests (
  id TEXT PRIMARY KEY DEFAULT 'mpr_' || md5(random()::text),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  plan_id TEXT NOT NULL,
  expected_amount_egp NUMERIC NOT NULL,
  discount_amount_egp NUMERIC DEFAULT 0,
  promo_code TEXT,
  group_seats INTEGER DEFAULT NULL,
  portfolio_id TEXT DEFAULT NULL,
  proof_storage_path TEXT,
  proof_url TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')),
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_manual_payments_user
  ON public.manual_payment_requests(user_id);

CREATE INDEX IF NOT EXISTS idx_manual_payments_status
  ON public.manual_payment_requests(status);

CREATE INDEX IF NOT EXISTS idx_manual_payments_created
  ON public.manual_payment_requests(created_at DESC);

-- ============================================
-- 2. RLS Security Policies
-- ============================================
ALTER TABLE public.manual_payment_requests ENABLE ROW LEVEL SECURITY;

-- Users can view only their own payment requests
CREATE POLICY IF NOT EXISTS "Users can view own payment requests"
  ON public.manual_payment_requests FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own payment requests with status=PENDING
CREATE POLICY IF NOT EXISTS "Users can submit payment requests"
  ON public.manual_payment_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id AND status = 'PENDING');

-- Users can cancel their own PENDING requests
CREATE POLICY IF NOT EXISTS "Users can cancel own pending requests"
  ON public.manual_payment_requests FOR UPDATE
  USING (auth.uid() = user_id AND status = 'PENDING')
  WITH CHECK (status = 'CANCELLED');
