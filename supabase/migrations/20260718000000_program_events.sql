-- ═══════════════════════════════════════════════════════════════════
-- Program Events
-- ═══════════════════════════════════════════════════════════════════
-- An "event" is an on-site program activity (e.g. "Banking & Boxing")
-- that staff write up for grant Program Highlights. It's a lighter
-- cousin of an excursion: same name + overview + debrief narrative, but
-- NO transportation (no vehicles / drivers / ride assignments).
--
-- Like an excursion, an event is an ADD-ON attached to a calendar day —
-- a day can be a practice day AND host an event. It never changes the
-- day's practice/non-practice status.
--
-- `count_attendance` is the situational switch: some events should feed
-- the attendance numbers (kids checked in), others are narrative-only.
-- Defaults to false so a new event never silently moves attendance math.
--
-- Written idempotently (IF NOT EXISTS / DROP-then-CREATE) so it is safe
-- whether applied via the Supabase SQL Editor first or `supabase db push`
-- later — running it twice will not error.
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.program_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL,
  name TEXT NOT NULL,
  details TEXT,            -- "Overview" — the few words that seed the grant narrative
  notes TEXT,             -- optional debrief — how it went
  count_attendance BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_program_events_date ON public.program_events (date);

ALTER TABLE public.program_events ENABLE ROW LEVEL SECURITY;

-- Admin-only, mirroring the excursions policies exactly.
DROP POLICY IF EXISTS "Admins can view program_events" ON public.program_events;
CREATE POLICY "Admins can view program_events" ON public.program_events
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins can insert program_events" ON public.program_events;
CREATE POLICY "Admins can insert program_events" ON public.program_events
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins can update program_events" ON public.program_events;
CREATE POLICY "Admins can update program_events" ON public.program_events
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins can delete program_events" ON public.program_events;
CREATE POLICY "Admins can delete program_events" ON public.program_events
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Keep updated_at fresh on every edit (same trigger fn the rest of the app uses).
DROP TRIGGER IF EXISTS update_program_events_updated_at ON public.program_events;
CREATE TRIGGER update_program_events_updated_at
  BEFORE UPDATE ON public.program_events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
