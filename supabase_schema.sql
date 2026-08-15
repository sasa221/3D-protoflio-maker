-- ========================================================
-- 3D PORTFOLIO MAKER — PRODUCTION SUPABASE SQL MIGRATION (V2.11.1)
-- Improved Security, RLS Hardening, Indexing & Auth Triggers
-- Preserves 100% compatibility with JS application architecture
-- ========================================================

-- 1. PROFILES TABLE (Linked to auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  display_name TEXT,
  username TEXT UNIQUE,
  is_admin BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Safe to run when upgrading an existing database.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. PORTFOLIOS TABLE
CREATE TABLE IF NOT EXISTS public.portfolios (
  id TEXT PRIMARY KEY,
  owner_user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  profession TEXT,
  bio TEXT,
  theme TEXT DEFAULT 'code',
  master_profile_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  default_variant_id TEXT,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. PORTFOLIO VARIANTS TABLE
CREATE TABLE IF NOT EXISTS public.portfolio_variants (
  id TEXT PRIMARY KEY,
  portfolio_id TEXT REFERENCES public.portfolios(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  target_role TEXT,
  theme_id TEXT DEFAULT 'code',
  overrides_json JSONB DEFAULT '{}'::jsonb,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_variant_slug_per_portfolio UNIQUE (portfolio_id, slug)
);

-- 4. SUBSCRIPTIONS TABLE (Sole entitlement source of truth; writable by service_role only)
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id TEXT PRIMARY KEY DEFAULT ('sub_' || md5(random()::text)),
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL UNIQUE,
  provider TEXT DEFAULT 'stripe',
  customer_id TEXT,
  subscription_id TEXT UNIQUE,
  plan_id TEXT DEFAULT 'free',
  status TEXT DEFAULT 'active',
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. ANALYTICS EVENTS TABLE (Written via backend /api/analytics/event only)
CREATE TABLE IF NOT EXISTS public.analytics_events (
  id TEXT PRIMARY KEY DEFAULT ('evt_' || md5(random()::text)),
  portfolio_id TEXT REFERENCES public.portfolios(id) ON DELETE CASCADE NOT NULL,
  variant_id TEXT,
  session_id TEXT NOT NULL,
  event_name TEXT NOT NULL,
  project_id TEXT,
  device_category TEXT DEFAULT 'Desktop',
  referrer_category TEXT DEFAULT 'Direct',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. CUSTOM DOMAINS TABLE
CREATE TABLE IF NOT EXISTS public.custom_domains (
  id TEXT PRIMARY KEY DEFAULT ('dom_' || md5(random()::text)),
  portfolio_id TEXT REFERENCES public.portfolios(id) ON DELETE CASCADE NOT NULL UNIQUE,
  hostname TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'pending',
  verification_token TEXT,
  ssl_status TEXT DEFAULT 'pending',
  connected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========================================================
-- INDEXES FOR PERFORMANCE & RLS LOOKUPS
-- ========================================================
CREATE INDEX IF NOT EXISTS idx_portfolios_owner ON public.portfolios(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_portfolios_slug ON public.portfolios(slug);
CREATE INDEX IF NOT EXISTS idx_portfolio_variants_portfolio ON public.portfolio_variants(portfolio_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_variants_slug ON public.portfolio_variants(portfolio_id, slug);
CREATE INDEX IF NOT EXISTS idx_analytics_events_portfolio ON public.analytics_events(portfolio_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_session ON public.analytics_events(session_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_custom_domains_hostname ON public.custom_domains(hostname);

-- ========================================================
-- AUTOMATIC PROFILE & SUBSCRIPTION CREATION TRIGGER
-- ========================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', SPLIT_PART(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;

  INSERT INTO public.subscriptions (user_id, plan_id, status)
  VALUES (NEW.id, 'free', 'active')
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ========================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ========================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_domains ENABLE ROW LEVEL SECURITY;

-- 1. Profiles Policies
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- 2. Portfolios Policies
CREATE POLICY "Users can view own portfolios" ON public.portfolios
  FOR SELECT USING (auth.uid() = owner_user_id OR published_at IS NOT NULL);

CREATE POLICY "Users can insert own portfolios" ON public.portfolios
  FOR INSERT WITH CHECK (auth.uid() = owner_user_id);

CREATE POLICY "Users can update own portfolios" ON public.portfolios
  FOR UPDATE USING (auth.uid() = owner_user_id);

CREATE POLICY "Users can delete own portfolios" ON public.portfolios
  FOR DELETE USING (auth.uid() = owner_user_id);

-- 3. Portfolio Variants Policies
CREATE POLICY "Users can manage own portfolio variants" ON public.portfolio_variants
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.portfolios
      WHERE portfolios.id = portfolio_variants.portfolio_id
      AND (portfolios.owner_user_id = auth.uid() OR portfolios.published_at IS NOT NULL)
    )
  );

-- 4. Subscriptions Policies (READ ONLY for users; WRITE ONLY for service_role)
CREATE POLICY "Users can read own subscription" ON public.subscriptions
  FOR SELECT USING (auth.uid() = user_id);

-- 5. Analytics Events Policies (READ ONLY for portfolio owner; WRITE via backend API)
CREATE POLICY "Owners can view portfolio analytics" ON public.analytics_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.portfolios
      WHERE portfolios.id = analytics_events.portfolio_id
      AND portfolios.owner_user_id = auth.uid()
    )
  );

-- 6. Custom Domains Policies
CREATE POLICY "Users can manage own custom domains" ON public.custom_domains
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.portfolios
      WHERE portfolios.id = custom_domains.portfolio_id
      AND portfolios.owner_user_id = auth.uid()
    )
  );

-- ========================================================
-- STORAGE BUCKETS & STORAGE RLS POLICIES (V2.11.3)
-- ========================================================
INSERT INTO storage.buckets (id, name, public)
VALUES 
  ('avatars', 'avatars', true),
  ('resumes', 'resumes', false),
  ('project-media', 'project-media', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

-- 1. Storage INSERT Policy (Users can upload only to their own folder: userId/*)
CREATE POLICY "Users can upload to own storage folder" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id IN ('avatars', 'resumes', 'project-media')
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- 2. Storage SELECT Policy (Public for avatars & project-media; Owner-only for resumes)
CREATE POLICY "Public read access for avatars and project-media" ON storage.objects
  FOR SELECT USING (
    bucket_id IN ('avatars', 'project-media')
    OR (bucket_id = 'resumes' AND (storage.foldername(name))[1] = auth.uid()::text)
  );

-- 3. Storage UPDATE Policy (Users can update own files)
CREATE POLICY "Users can update own storage files" ON storage.objects
  FOR UPDATE USING (
    bucket_id IN ('avatars', 'resumes', 'project-media')
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- 4. Storage DELETE Policy (Users can delete own files)
CREATE POLICY "Users can delete own storage files" ON storage.objects
  FOR DELETE USING (
    bucket_id IN ('avatars', 'resumes', 'project-media')
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
