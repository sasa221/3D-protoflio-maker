-- Add an explicit public rollout mode while retaining the database master
-- switch as an immediate kill switch. The safe default remains allowlist.
ALTER TABLE public.career_studio_rollout_config
  ADD COLUMN IF NOT EXISTS access_mode TEXT NOT NULL DEFAULT 'allowlist';

ALTER TABLE public.career_studio_rollout_config
  DROP CONSTRAINT IF EXISTS career_studio_rollout_config_access_mode_check;
ALTER TABLE public.career_studio_rollout_config
  ADD CONSTRAINT career_studio_rollout_config_access_mode_check
  CHECK (access_mode IN ('allowlist', 'all'));

ALTER TABLE public.career_studio_rollout_audit_log
  DROP CONSTRAINT IF EXISTS career_studio_rollout_audit_log_action_check;
ALTER TABLE public.career_studio_rollout_audit_log
  ADD CONSTRAINT career_studio_rollout_audit_log_action_check
  CHECK (action IN ('rollout_user_updated', 'master_switch_updated', 'access_mode_updated'));

CREATE OR REPLACE FUNCTION public.career_studio_access_allowed(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() = p_user_id
    AND COALESCE((SELECT enabled FROM public.career_studio_rollout_config WHERE id = TRUE), FALSE)
    AND COALESCE((
      SELECT access_mode = 'all'
        OR EXISTS (
          SELECT 1 FROM public.career_studio_rollout_users
          WHERE user_id = p_user_id AND enabled = TRUE
        )
      FROM public.career_studio_rollout_config
      WHERE id = TRUE
    ), FALSE);
$$;

CREATE OR REPLACE FUNCTION public.career_studio_service_access_allowed(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_user_id IS NOT NULL
    AND COALESCE((SELECT enabled FROM public.career_studio_rollout_config WHERE id = TRUE), FALSE)
    AND COALESCE((
      SELECT access_mode = 'all'
        OR EXISTS (
          SELECT 1 FROM public.career_studio_rollout_users
          WHERE user_id = p_user_id AND enabled = TRUE
        )
      FROM public.career_studio_rollout_config
      WHERE id = TRUE
    ), FALSE);
$$;

CREATE OR REPLACE FUNCTION public.admin_set_career_studio_access_mode(
  p_access_mode TEXT,
  p_admin_user_id UUID
)
RETURNS public.career_studio_rollout_config
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  config_row public.career_studio_rollout_config;
BEGIN
  IF p_admin_user_id IS NULL THEN
    RAISE EXCEPTION 'Admin user is required';
  END IF;
  IF p_access_mode NOT IN ('allowlist', 'all') THEN
    RAISE EXCEPTION 'Invalid Career Studio access mode';
  END IF;

  UPDATE public.career_studio_rollout_config
  SET access_mode = p_access_mode, updated_at = NOW(), updated_by = p_admin_user_id
  WHERE id = TRUE
  RETURNING * INTO config_row;

  IF config_row IS NULL THEN
    RAISE EXCEPTION 'Career Studio rollout config not found';
  END IF;

  INSERT INTO public.career_studio_rollout_audit_log
    (admin_user_id, action, enabled, result, metadata_json)
  VALUES
    (p_admin_user_id, 'access_mode_updated', config_row.enabled, 'success',
     jsonb_build_object('scope', 'career_studio', 'access_mode', p_access_mode));

  RETURN config_row;
END;
$$;

REVOKE ALL ON FUNCTION public.career_studio_access_allowed(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.career_studio_access_allowed(UUID) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.career_studio_service_access_allowed(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.career_studio_service_access_allowed(UUID) TO service_role;
REVOKE ALL ON FUNCTION public.admin_set_career_studio_access_mode(TEXT, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_career_studio_access_mode(TEXT, UUID) TO service_role;
