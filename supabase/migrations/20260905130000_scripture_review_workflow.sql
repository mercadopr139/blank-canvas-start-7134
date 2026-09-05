-- Scripture Coach: supervision / review workflow.
--
-- A session is a record of a real conversation with a child, so it does not
-- stand on one person's word. Every saved session is reviewed by someone other
-- than the mentor who ran it:
--   Josh submits    -> Chrissy reviews
--   Chrissy submits -> Josh reviews
--   anyone else     -> either of them
--
-- All three fall out of one rule enforced in the database, not just the UI:
-- nobody reviews their own session. Who can review is a permission
-- ('operations_scripture_coach_reviewer'), so adding Pastor Bill later is a
-- checkbox in Staff Management rather than a code change.
--
-- Once reviewed the record LOCKS — only a reviewer can reopen it. That is what
-- makes the sign-off mean anything: notes cannot be quietly rewritten after
-- supervision.
--
-- Plan: docs/SCRIPTURE_COACH_PLAN.md

-- ── Status ───────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'scripture_review_status') THEN
    CREATE TYPE public.scripture_review_status AS ENUM (
      'pending_review',
      'changes_requested',
      'reviewed'
    );
  END IF;
END $$;

ALTER TABLE public.scripture_sessions
  ADD COLUMN IF NOT EXISTS review_status public.scripture_review_status
    NOT NULL DEFAULT 'pending_review',
  ADD COLUMN IF NOT EXISTS reviewed_by uuid,
  ADD COLUMN IF NOT EXISTS reviewed_by_name text,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;

-- follow_up_notes was written before the review workflow existed. It is the
-- reviewer's field now, and the name should say so.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'scripture_sessions'
      AND column_name = 'follow_up_notes'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'scripture_sessions'
      AND column_name = 'review_comments'
  ) THEN
    ALTER TABLE public.scripture_sessions RENAME COLUMN follow_up_notes TO review_comments;
  END IF;
END $$;

ALTER TABLE public.scripture_sessions
  ADD COLUMN IF NOT EXISTS review_comments text;

CREATE INDEX IF NOT EXISTS scripture_sessions_review_status_idx
  ON public.scripture_sessions (review_status);

-- ── Who may review ───────────────────────────────────────────────────
-- The super admin is always a reviewer, matching the app's existing
-- super-admin rule so the workflow can never lock everybody out.
CREATE OR REPLACE FUNCTION public.is_scripture_reviewer(_user uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    EXISTS (
      SELECT 1 FROM public.staff_permissions sp
      WHERE sp.user_id = _user
        AND sp.permission_key = 'operations_scripture_coach_reviewer'
        AND sp.granted
    )
    OR EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.id = _user
        AND lower(u.email) = 'joshmercado@nolimitsboxingacademy.org'
    );
$$;

GRANT EXECUTE ON FUNCTION public.is_scripture_reviewer(uuid) TO authenticated;

-- ── The rules, enforced ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.enforce_scripture_review_rules()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _is_reviewer boolean := public.is_scripture_reviewer(auth.uid());
BEGIN
  -- 1. A signed-off session is locked to everyone but a reviewer, who can
  --    reopen it by moving it out of 'reviewed'.
  IF OLD.review_status = 'reviewed' AND NOT _is_reviewer THEN
    RAISE EXCEPTION 'This session has been reviewed and is locked. Ask a reviewer to reopen it.';
  END IF;

  -- 2. Only a reviewer writes review fields.
  IF NOT _is_reviewer AND (
       NEW.review_status IS DISTINCT FROM OLD.review_status
       OR NEW.review_comments IS DISTINCT FROM OLD.review_comments
     ) THEN
    RAISE EXCEPTION 'Only a reviewer can review a session.';
  END IF;

  -- 3. Nobody signs off their own session. This is the whole point of the
  --    workflow, so it lives here rather than in the UI.
  IF NEW.review_status = 'reviewed'
     AND OLD.review_status IS DISTINCT FROM 'reviewed'
     AND auth.uid() = OLD.coach_id THEN
    RAISE EXCEPTION 'A session must be reviewed by someone other than the mentor who ran it.';
  END IF;

  -- 4. Stamp / clear the sign-off automatically so it can't be faked.
  IF NEW.review_status = 'reviewed' AND OLD.review_status IS DISTINCT FROM 'reviewed' THEN
    NEW.reviewed_by := auth.uid();
    NEW.reviewed_at := now();
  ELSIF NEW.review_status IS DISTINCT FROM 'reviewed' THEN
    NEW.reviewed_by := NULL;
    NEW.reviewed_by_name := NULL;
    NEW.reviewed_at := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_scripture_review_rules ON public.scripture_sessions;
CREATE TRIGGER trg_scripture_review_rules
  BEFORE UPDATE ON public.scripture_sessions
  FOR EACH ROW EXECUTE FUNCTION public.enforce_scripture_review_rules();

-- A mentor cannot submit a session that is already signed off.
CREATE OR REPLACE FUNCTION public.enforce_scripture_insert_rules()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  NEW.review_status := 'pending_review';
  NEW.reviewed_by := NULL;
  NEW.reviewed_by_name := NULL;
  NEW.reviewed_at := NULL;
  NEW.review_comments := NULL;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_scripture_insert_rules ON public.scripture_sessions;
CREATE TRIGGER trg_scripture_insert_rules
  BEFORE INSERT ON public.scripture_sessions
  FOR EACH ROW EXECUTE FUNCTION public.enforce_scripture_insert_rules();
