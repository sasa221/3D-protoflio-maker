-- Phase 8A Monetization Migration
-- Non-destructive: ALTER ADD COLUMN and CREATE TABLE only.
-- No DROP statements. All backward-compatible.
-- Run against existing Supabase Postgres.

-- ============================================
-- 1. ALTER existing tables
-- ============================================

-- Add monetization columns to portfolios
ALTER TABLE public.portfolios
  ADD COLUMN IF NOT EXISTS is_finalized BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS finalized_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS slot_number INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE;

-- Add group and grace support to subscriptions
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS group_id TEXT,
  ADD COLUMN IF NOT EXISTS grace_ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- ============================================
-- 2. CREATE new tables
-- ============================================

-- Portfolio creation history (abuse prevention)
CREATE TABLE IF NOT EXISTS public.portfolio_creation_history (
  id TEXT PRIMARY KEY DEFAULT 'pch_' || md5(random()::text),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  portfolio_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  action TEXT NOT NULL DEFAULT 'create'
);

CREATE INDEX IF NOT EXISTS idx_portfolio_creation_history_user
  ON public.portfolio_creation_history(user_id);

CREATE INDEX IF NOT EXISTS idx_portfolio_creation_history_created
  ON public.portfolio_creation_history(user_id, created_at DESC);

-- Groups
CREATE TABLE IF NOT EXISTS public.groups (
  id TEXT PRIMARY KEY DEFAULT 'grp_' || md5(random()::text),
  owner_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  seat_limit INTEGER NOT NULL CHECK (seat_limit >= 2 AND seat_limit <= 5),
  plan_type TEXT NOT NULL DEFAULT 'premium_group',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_groups_owner
  ON public.groups(owner_user_id);

-- Group members
CREATE TABLE IF NOT EXISTS public.group_members (
  id TEXT PRIMARY KEY DEFAULT 'gm_' || md5(random()::text),
  group_id TEXT REFERENCES public.groups(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  status TEXT NOT NULL DEFAULT 'active',
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  joined_at TIMESTAMPTZ,
  UNIQUE(group_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_group_members_user
  ON public.group_members(user_id);

CREATE INDEX IF NOT EXISTS idx_group_members_group
  ON public.group_members(group_id);

-- Keep It Live entitlements
CREATE TABLE IF NOT EXISTS public.keep_live_entitlements (
  id TEXT PRIMARY KEY DEFAULT 'kl_' || md5(random()::text),
  portfolio_id TEXT REFERENCES public.portfolios(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  starts_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_keep_live_portfolio
  ON public.keep_live_entitlements(portfolio_id);

CREATE INDEX IF NOT EXISTS idx_keep_live_user
  ON public.keep_live_entitlements(user_id);

-- Promo codes
CREATE TABLE IF NOT EXISTS public.promo_codes (
  id TEXT PRIMARY KEY DEFAULT 'promo_' || md5(random()::text),
  code TEXT UNIQUE NOT NULL,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed_amount')),
  discount_value NUMERIC NOT NULL CHECK (discount_value > 0),
  applicable_plans TEXT[] DEFAULT '{}',
  starts_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  active BOOLEAN DEFAULT TRUE,
  max_redemptions INTEGER,
  redemption_count INTEGER DEFAULT 0,
  per_user_limit INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_promo_codes_code
  ON public.promo_codes(code);

-- Promo redemptions
CREATE TABLE IF NOT EXISTS public.promo_redemptions (
  id TEXT PRIMARY KEY DEFAULT 'pr_' || md5(random()::text),
  promo_id TEXT REFERENCES public.promo_codes(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  redeemed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(promo_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_promo_redemptions_user
  ON public.promo_redemptions(user_id);

-- Audit log for entitlement failures
CREATE TABLE IF NOT EXISTS public.entitlement_audit_log (
  id TEXT PRIMARY KEY DEFAULT 'eal_' || md5(random()::text),
  user_id UUID,
  action TEXT NOT NULL,
  result TEXT NOT NULL DEFAULT 'denied',
  reason TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_user
  ON public.entitlement_audit_log(user_id);

CREATE INDEX IF NOT EXISTS idx_audit_log_created
  ON public.entitlement_audit_log(created_at DESC);

-- ============================================
-- 3. RLS Policies for new tables
-- ============================================

ALTER TABLE public.portfolio_creation_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.keep_live_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entitlement_audit_log ENABLE ROW LEVEL SECURITY;

-- Portfolio creation history: users can view own
CREATE POLICY IF NOT EXISTS "Users can view own creation history"
  ON public.portfolio_creation_history FOR SELECT
  USING (auth.uid() = user_id);

-- Groups: owner can manage, members can view
CREATE POLICY IF NOT EXISTS "Group owners can manage own groups"
  ON public.groups FOR ALL
  USING (auth.uid() = owner_user_id);

CREATE POLICY IF NOT EXISTS "Group members can view their group"
  ON public.groups FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.group_members
      WHERE group_members.group_id = groups.id
      AND group_members.user_id = auth.uid()
      AND group_members.status = 'active'
    )
  );

-- Group members: users can view own membership
CREATE POLICY IF NOT EXISTS "Users can view own group membership"
  ON public.group_members FOR SELECT
  USING (auth.uid() = user_id);

-- Group members: owners can manage members in their group
CREATE POLICY IF NOT EXISTS "Group owners can manage members"
  ON public.group_members FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.groups
      WHERE groups.id = group_members.group_id
      AND groups.owner_user_id = auth.uid()
    )
  );

-- Keep live: users can view own
CREATE POLICY IF NOT EXISTS "Users can view own keep live entitlements"
  ON public.keep_live_entitlements FOR SELECT
  USING (auth.uid() = user_id);

-- Promo codes: no direct user access (service role only)
-- No SELECT policy = blocked for anon/authenticated

-- Promo redemptions: users can view own
CREATE POLICY IF NOT EXISTS "Users can view own promo redemptions"
  ON public.promo_redemptions FOR SELECT
  USING (auth.uid() = user_id);

-- Audit log: no direct user access (service role only)
-- No SELECT policy = blocked for anon/authenticated
