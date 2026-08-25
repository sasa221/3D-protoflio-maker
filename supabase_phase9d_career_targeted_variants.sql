-- Copy of the PR-5 local-only migration for review.
-- Apply through Supabase Local migrations; never apply to Production without release approval.

CREATE TABLE IF NOT EXISTS public.career_targeted_variants (
  id TEXT PRIMARY KEY DEFAULT 'cvv_' || md5(random()::text),
  career_profile_id TEXT NOT NULL REFERENCES public.career_profiles(id) ON DELETE CASCADE,
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Targeted CV Draft',
  target_role TEXT NOT NULL DEFAULT '',
  company_name TEXT NOT NULL DEFAULT '',
  job_description TEXT NOT NULL CHECK (char_length(job_description) BETWEEN 15 AND 30000),
  job_fit_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  content_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status = 'draft'),
  idempotency_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(owner_user_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_career_targeted_variants_owner
  ON public.career_targeted_variants(owner_user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_career_targeted_variants_profile
  ON public.career_targeted_variants(career_profile_id, updated_at DESC);

ALTER TABLE public.career_targeted_variants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "No direct client access to targeted CV variants" ON public.career_targeted_variants;
REVOKE ALL ON public.career_targeted_variants FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.career_targeted_variants TO service_role;
