-- Removing a person, and a record of every access change.
--
-- removed_at marks a staff card as removed. The row stays so the person's
-- name still shows on what they wrote (Message Board, Agenda, sessions);
-- Staff Management and the staff pickers leave removed people out. The
-- removal itself is done by the manage-access edge function: role gone,
-- checkboxes gone, off the allowlist, login blocked.
ALTER TABLE public.staff_profiles ADD COLUMN IF NOT EXISTS removed_at timestamptz;

-- Who changed whose access, and when. Written by the server only; read by
-- the access manager only.
CREATE TABLE IF NOT EXISTS public.access_log (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  at           timestamptz NOT NULL DEFAULT now(),
  actor_email  text NOT NULL,
  action       text NOT NULL,
  target_email text,
  detail       jsonb NOT NULL DEFAULT '{}'::jsonb
);
ALTER TABLE public.access_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Access manager reads access_log" ON public.access_log;
CREATE POLICY "Access manager reads access_log" ON public.access_log
  FOR SELECT TO authenticated
  USING (public.can_manage_access());

NOTIFY pgrst, 'reload schema';
