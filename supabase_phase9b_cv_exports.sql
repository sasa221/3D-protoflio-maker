-- Career Studio PR-2: private PDF export event ledger.
-- Apply only to Supabase Local/Development until release approval.

CREATE TABLE IF NOT EXISTS public.cv_export_events (
  id TEXT PRIMARY KEY DEFAULT 'cve_' || md5(random()::text),
  career_profile_id TEXT REFERENCES public.career_profiles(id) ON DELETE CASCADE NOT NULL,
  owner_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  format TEXT NOT NULL DEFAULT 'pdf' CHECK (format = 'pdf'),
  idempotency_key TEXT NOT NULL,
  page_count INTEGER NOT NULL DEFAULT 1 CHECK (page_count > 0 AND page_count <= 100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(owner_user_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_cv_export_events_owner_created
  ON public.cv_export_events(owner_user_id, created_at DESC);

ALTER TABLE public.cv_export_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own CV export events" ON public.cv_export_events;
CREATE POLICY "Users can view own CV export events" ON public.cv_export_events
  FOR SELECT USING (auth.uid() = owner_user_id);

GRANT SELECT ON public.cv_export_events TO authenticated;
GRANT SELECT, INSERT ON public.cv_export_events TO service_role;
GRANT SELECT ON public.career_profiles TO service_role;
