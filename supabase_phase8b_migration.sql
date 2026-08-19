-- Phase 8B Manual InstaPay Billing & Payment Review Migration
-- Non-destructive: CREATE TABLE IF NOT EXISTS, ALTER ADD COLUMN IF NOT EXISTS, and idempotent storage policies.
-- Safe to re-run and partially execute without data loss.
-- Run against Supabase Postgres in SQL Editor when approved.

-- ============================================
-- 1. Manual Payment Requests Table
-- ============================================
CREATE TABLE IF NOT EXISTS public.manual_payment_requests (
  id TEXT PRIMARY KEY DEFAULT 'mpr_' || md5(random()::text),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  plan_id TEXT NOT NULL,
  group_seats INTEGER DEFAULT NULL,
  portfolio_id TEXT DEFAULT NULL,
  expected_amount_egp NUMERIC NOT NULL,
  discount_amount_egp NUMERIC DEFAULT 0,
  final_expected_amount_egp NUMERIC NOT NULL,
  promo_code TEXT DEFAULT NULL,
  promo_discount_percent NUMERIC DEFAULT 0,
  payment_method TEXT NOT NULL DEFAULT 'INSTAPAY',
  proof_storage_path TEXT,
  proof_url TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')),
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  admin_reason TEXT,
  approved_period_start TIMESTAMPTZ,
  approved_period_end TIMESTAMPTZ,
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
-- 2. RLS Security Policies for Payment Requests
-- ============================================
ALTER TABLE public.manual_payment_requests ENABLE ROW LEVEL SECURITY;

-- Users can view only their own payment requests
DROP POLICY IF EXISTS "Users can view own payment requests" ON public.manual_payment_requests;
CREATE POLICY "Users can view own payment requests"
  ON public.manual_payment_requests FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own payment requests strictly with status=PENDING
DROP POLICY IF EXISTS "Users can submit payment requests" ON public.manual_payment_requests;
CREATE POLICY "Users can submit payment requests"
  ON public.manual_payment_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id AND status = 'PENDING');

-- Users can only cancel their own PENDING requests (cannot self-approve, reject, or modify amounts)
DROP POLICY IF EXISTS "Users can cancel own pending requests" ON public.manual_payment_requests;
CREATE POLICY "Users can cancel own pending requests"
  ON public.manual_payment_requests FOR UPDATE
  USING (auth.uid() = user_id AND status = 'PENDING')
  WITH CHECK (status = 'CANCELLED');

-- ============================================
-- 3. Storage Bucket & Policies for Payment Proofs
-- ============================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('payment_proofs', 'payment_proofs', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- Users can upload proof strictly to their own folder: <user_id>/proofs/*
DROP POLICY IF EXISTS "Users can upload own payment proofs" ON storage.objects;
CREATE POLICY "Users can upload own payment proofs"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'payment_proofs'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Users can read only their own payment proofs
DROP POLICY IF EXISTS "Users can read own payment proofs" ON storage.objects;
CREATE POLICY "Users can read own payment proofs"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'payment_proofs'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
