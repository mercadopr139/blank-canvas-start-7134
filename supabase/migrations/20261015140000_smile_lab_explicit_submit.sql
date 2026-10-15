-- A report is handed in with a Submit button, not by a rule that guesses
-- from its contents (Josh, 2026-10-15). The caring_filed_at /
-- sharing_filed_at columns stay; the editor sets them when a coach presses
-- Submit (and clears them on Reopen). The trigger that stamped them on its
-- own goes away so it never overrides that.
DROP TRIGGER IF EXISTS smile_lab_sessions_stamp_filed ON public.smile_lab_sessions;
DROP FUNCTION IF EXISTS public.smile_lab_sessions_stamp_filed();
