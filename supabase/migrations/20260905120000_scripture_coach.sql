-- Scripture Coach + Spiritual Coach Intelligence
--
-- A youth mentor searches the kid, types what they came in with, and gets five
-- ESV passages with short context, talking points, and prayer points. The
-- mentor curates that set, journals the conversation, and saves it. Saved
-- sessions are reviewed in Spiritual Coach Intelligence.
--
-- Plan: docs/SCRIPTURE_COACH_PLAN.md

-- ── How a session was escalated, if at all ───────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'scripture_escalation') THEN
    CREATE TYPE public.scripture_escalation AS ENUM (
      'none',
      'parent_notified',
      'referred',
      'mandated_report'
    );
  END IF;
END $$;

-- ── The topic library ────────────────────────────────────────────────
-- Generated once, then served instantly on every later use. Not frozen:
-- a mentor can regenerate any passage at any time (the session keeps its
-- own snapshot, so regenerating never rewrites past records).
CREATE TABLE IF NOT EXISTS public.scripture_topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic text NOT NULL,
  -- lowercased/trimmed form used to match a repeat topic
  topic_normalized text NOT NULL,
  -- 'junior' | 'senior' — derived from the youth's age, never asked. Only
  -- separates the cache so a 9-year-old's version is never served to a 17-
  -- year-old.
  age_band text NOT NULL DEFAULT 'senior',
  -- [{ ref, esv_text, context }]
  passages jsonb NOT NULL DEFAULT '[]'::jsonb,
  talking_points jsonb NOT NULL DEFAULT '[]'::jsonb,
  prayer_points jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS scripture_topics_lookup_idx
  ON public.scripture_topics (topic_normalized, age_band);

-- ── The journal ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.scripture_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id uuid REFERENCES public.youth_registrations(id) ON DELETE SET NULL,
  -- Name is snapshotted so a session stays readable even if the
  -- registration is later archived or removed.
  youth_name text NOT NULL,
  coach_id uuid,
  coach_name text,
  topic text NOT NULL,
  topic_id uuid REFERENCES public.scripture_topics(id) ON DELETE SET NULL,
  session_date date NOT NULL DEFAULT CURRENT_DATE,
  -- This session's own copy: [{ ref, esv_text, context, kept, used }].
  -- `kept` = part of the mentor's working set. `used` = actually walked
  -- through with the youth, and the only ones that reach the PDF.
  passages jsonb NOT NULL DEFAULT '[]'::jsonb,
  talking_points jsonb NOT NULL DEFAULT '[]'::jsonb,
  prayer_points jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text,
  follow_up_notes text,
  parents_notified boolean NOT NULL DEFAULT false,
  follow_up_needed boolean NOT NULL DEFAULT false,
  escalation public.scripture_escalation NOT NULL DEFAULT 'none',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS scripture_sessions_date_idx
  ON public.scripture_sessions (session_date DESC);
CREATE INDEX IF NOT EXISTS scripture_sessions_registration_idx
  ON public.scripture_sessions (registration_id);
CREATE INDEX IF NOT EXISTS scripture_sessions_follow_up_idx
  ON public.scripture_sessions (follow_up_needed) WHERE follow_up_needed;

-- ── Suggested responses ──────────────────────────────────────────────
-- One per talking point, in the same order: what the mentor could say next
-- when a child answers something heavy and they're lost for words. Added as
-- an idempotent ALTER so this migration is safe to re-run.
ALTER TABLE public.scripture_topics
  ADD COLUMN IF NOT EXISTS responses jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.scripture_sessions
  ADD COLUMN IF NOT EXISTS responses jsonb NOT NULL DEFAULT '[]'::jsonb;

-- ── updated_at ───────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_scripture_topics_updated ON public.scripture_topics;
CREATE TRIGGER trg_scripture_topics_updated
  BEFORE UPDATE ON public.scripture_topics
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_scripture_sessions_updated ON public.scripture_sessions;
CREATE TRIGGER trg_scripture_sessions_updated
  BEFORE UPDATE ON public.scripture_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── RLS ──────────────────────────────────────────────────────────────
-- Admins read and write both tables; the anon role has no access at all.
-- Shared visibility across the mentor team is deliberate (see the plan) —
-- coach_id is still recorded on every session, so a per-mentor filter is a
-- query away if that ever needs to tighten.
ALTER TABLE public.scripture_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scripture_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage scripture topics" ON public.scripture_topics;
CREATE POLICY "Admins manage scripture topics"
  ON public.scripture_topics FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins manage scripture sessions" ON public.scripture_sessions;
CREATE POLICY "Admins manage scripture sessions"
  ON public.scripture_sessions FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
