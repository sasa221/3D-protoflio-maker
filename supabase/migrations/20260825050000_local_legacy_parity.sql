-- Local acceptance only: additive parity for legacy Portfolio/Admin queries.
-- No destructive operations and never intended for Production by this phase.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS display_name TEXT,
  ADD COLUMN IF NOT EXISTS username TEXT,
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS id TEXT DEFAULT ('sub_' || md5(random()::text)),
  ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'manual_instapay',
  ADD COLUMN IF NOT EXISTS current_period_start TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.portfolios
  ADD COLUMN IF NOT EXISTS is_finalized BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS finalized_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS slot_number INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE;

ALTER TABLE public.groups
  ADD COLUMN IF NOT EXISTS plan_type TEXT NOT NULL DEFAULT 'premium_group',
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.group_members
  ADD COLUMN IF NOT EXISTS id TEXT DEFAULT ('gm_' || md5(random()::text)),
  ADD COLUMN IF NOT EXISTS invited_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS joined_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.promo_codes (
  id TEXT PRIMARY KEY DEFAULT ('promo_' || md5(random()::text)),
  code TEXT UNIQUE NOT NULL,
  discount_type TEXT NOT NULL DEFAULT 'percentage',
  discount_value NUMERIC NOT NULL DEFAULT 0,
  applicable_plans TEXT[] DEFAULT '{}',
  starts_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  max_redemptions INTEGER,
  redemption_count INTEGER NOT NULL DEFAULT 0,
  per_user_limit INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.promo_redemptions (
  id TEXT PRIMARY KEY DEFAULT ('pr_' || md5(random()::text)),
  promo_id TEXT REFERENCES public.promo_codes(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  redeemed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(promo_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.entitlement_audit_log (
  id TEXT PRIMARY KEY DEFAULT ('eal_' || md5(random()::text)),
  user_id UUID,
  action TEXT NOT NULL,
  result TEXT NOT NULL DEFAULT 'denied',
  reason TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.manual_payment_requests (
  id TEXT PRIMARY KEY DEFAULT ('mpr_' || md5(random()::text)),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  plan_id TEXT NOT NULL,
  group_seats INTEGER,
  portfolio_id TEXT,
  expected_amount_egp NUMERIC NOT NULL,
  discount_amount_egp NUMERIC DEFAULT 0,
  final_expected_amount_egp NUMERIC NOT NULL,
  promo_code TEXT,
  promo_discount_percent NUMERIC DEFAULT 0,
  payment_method TEXT NOT NULL DEFAULT 'INSTAPAY',
  proof_storage_path TEXT,
  proof_url TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','APPROVED','REJECTED','CANCELLED')),
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

CREATE TABLE IF NOT EXISTS public.portfolio_variants (
  id TEXT PRIMARY KEY,
  portfolio_id TEXT REFERENCES public.portfolios(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL DEFAULT 'Default',
  slug TEXT NOT NULL DEFAULT 'default',
  target_role TEXT,
  theme_id TEXT DEFAULT 'code',
  overrides_json JSONB DEFAULT '{}',
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.keep_live_entitlements (
  id TEXT PRIMARY KEY DEFAULT ('kl_' || md5(random()::text)),
  portfolio_id TEXT REFERENCES public.portfolios(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  starts_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entitlement_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manual_payment_requests ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.profiles, public.subscriptions, public.portfolios, public.portfolio_variants,
  public.groups, public.group_members, public.portfolio_creation_history,
  public.keep_live_entitlements TO service_role;
GRANT ALL ON public.promo_codes, public.promo_redemptions, public.entitlement_audit_log, public.manual_payment_requests TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.manual_payment_requests TO authenticated;

DROP POLICY IF EXISTS "Users can view own payment requests" ON public.manual_payment_requests;
CREATE POLICY "Users can view own payment requests" ON public.manual_payment_requests FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can submit payment requests" ON public.manual_payment_requests;
CREATE POLICY "Users can submit payment requests" ON public.manual_payment_requests FOR INSERT WITH CHECK (auth.uid() = user_id AND status = 'PENDING');
DROP POLICY IF EXISTS "Users can cancel own pending requests" ON public.manual_payment_requests;
CREATE POLICY "Users can cancel own pending requests" ON public.manual_payment_requests FOR UPDATE USING (auth.uid() = user_id AND status = 'PENDING') WITH CHECK (status = 'CANCELLED');
