-- Career Studio Phase 9: additive local/development-only migration.
-- This migration is intentionally not applied to Production by this branch.

CREATE TABLE IF NOT EXISTS public.career_profiles (
  id TEXT PRIMARY KEY DEFAULT 'cp_' || md5(random()::text),
  owner_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  label TEXT NOT NULL DEFAULT 'My Career Profile',
  career_stage TEXT NOT NULL CHECK (career_stage IN ('student', 'professional')),
  content_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.career_documents (
  id TEXT PRIMARY KEY DEFAULT 'cv_' || md5(random()::text),
  career_profile_id TEXT REFERENCES public.career_profiles(id) ON DELETE CASCADE NOT NULL,
  owner_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  document_type TEXT NOT NULL DEFAULT 'base_cv' CHECK (document_type IN ('base_cv', 'targeted_cv')),
  title TEXT NOT NULL DEFAULT 'My CV',
  target_role TEXT,
  template_id TEXT NOT NULL DEFAULT 'ats-basic',
  content_override_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'ready')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_career_profiles_owner ON public.career_profiles(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_career_documents_owner ON public.career_documents(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_career_documents_profile ON public.career_documents(career_profile_id);

ALTER TABLE public.career_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.career_documents ENABLE ROW LEVEL SECURITY;

-- Supabase Local is configured with auto-exposure disabled. Grant table
-- privileges to authenticated users explicitly; RLS still limits each row.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.career_profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.career_documents TO authenticated;

DROP POLICY IF EXISTS "Users can manage own career profiles" ON public.career_profiles;
CREATE POLICY "Users can manage own career profiles" ON public.career_profiles
  FOR ALL USING (auth.uid() = owner_user_id) WITH CHECK (auth.uid() = owner_user_id);

DROP POLICY IF EXISTS "Users can manage own career documents" ON public.career_documents;
CREATE POLICY "Users can manage own career documents" ON public.career_documents
  FOR ALL USING (auth.uid() = owner_user_id) WITH CHECK (auth.uid() = owner_user_id);
