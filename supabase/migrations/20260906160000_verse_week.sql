-- ═══════════════════════════════════════════════════════════════════
-- Verse of the Week — AI-themed daily verses + team-meeting discussion
-- ═══════════════════════════════════════════════════════════════════
-- Each week the academy takes one theme. The coach generates it when building
-- the practice plan; the board shows that day's verse and, when tapped during
-- the team meeting, walks the room through context, three questions, and the
-- mentor's private guidance.
--
-- Two tables, keyed by the practice week's Monday (week_start), so it lines up
-- with the practice plan and can be built weeks ahead.
--   board_verse_weeks  the theme for a week, and whether it's live on the board.
--   board_verse_days   the five daily verses (Mon–Fri) with their discussion.
--
-- Verse TEXT is fetched from the ESV API by the generator and stored here; the
-- model is never the source of scripture text.

-- ── 1. The week + its theme ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.board_verse_weeks (
  week_start   date PRIMARY KEY,                 -- the Monday
  theme        text NOT NULL,
  is_published boolean NOT NULL DEFAULT false,   -- only published weeks reach the wall
  created_by   uuid,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- ── 2. The five daily verses ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.board_verse_days (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start date NOT NULL REFERENCES public.board_verse_weeks(week_start) ON DELETE CASCADE,
  weekday    smallint NOT NULL CHECK (weekday BETWEEN 1 AND 5),  -- Mon=1 .. Fri=5
  reference  text NOT NULL,
  text       text NOT NULL,           -- ESV text, fetched at generation
  context    text,
  questions  jsonb NOT NULL DEFAULT '[]'::jsonb,   -- three discussion questions
  answers    jsonb NOT NULL DEFAULT '[]'::jsonb,   -- three mentor model answers (hidden on the wall)
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (week_start, weekday)
);

CREATE INDEX IF NOT EXISTS board_verse_days_week_idx ON public.board_verse_days (week_start);

-- ── 3. Row-level security ────────────────────────────────────────────
ALTER TABLE public.board_verse_weeks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.board_verse_days  ENABLE ROW LEVEL SECURITY;

-- The board (a TV with no login) reads published weeks and their days. The
-- board's own query filters to published as well, so an admin previewing a
-- draft never accidentally projects it to the room.
DROP POLICY IF EXISTS "Board reads published verse weeks" ON public.board_verse_weeks;
CREATE POLICY "Board reads published verse weeks"
  ON public.board_verse_weeks FOR SELECT
  TO anon, authenticated
  USING (is_published);

DROP POLICY IF EXISTS "Admins manage verse weeks" ON public.board_verse_weeks;
CREATE POLICY "Admins manage verse weeks"
  ON public.board_verse_weeks FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Board reads published verse days" ON public.board_verse_days;
CREATE POLICY "Board reads published verse days"
  ON public.board_verse_days FOR SELECT
  TO anon, authenticated
  USING (EXISTS (
    SELECT 1 FROM public.board_verse_weeks w
    WHERE w.week_start = board_verse_days.week_start AND w.is_published
  ));

DROP POLICY IF EXISTS "Admins manage verse days" ON public.board_verse_days;
CREATE POLICY "Admins manage verse days"
  ON public.board_verse_days FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
