-- ═══════════════════════════════════════════════════════════════════
-- Program Highlights — saved report history
-- ═══════════════════════════════════════════════════════════════════
-- Each row is a generated Program Highlights report, kept so staff have a
-- durable history: the same date range always has its saved report, and a
-- regeneration never silently replaces it. Reports are editable + deletable.
--
-- Idempotent (IF NOT EXISTS / OR REPLACE) so it's safe to run via the SQL
-- Editor or `supabase db push`.
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.program_highlights_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  period_from DATE NOT NULL,
  period_to DATE NOT NULL,
  period_label TEXT NOT NULL,
  narrative TEXT NOT NULL DEFAULT '',
  activity_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_php_reports_created_at
  ON public.program_highlights_reports (created_at DESC);

ALTER TABLE public.program_highlights_reports ENABLE ROW LEVEL SECURITY;

-- Admin-only, mirroring the program_events policies exactly.
DROP POLICY IF EXISTS "Admins can view highlights reports" ON public.program_highlights_reports;
CREATE POLICY "Admins can view highlights reports" ON public.program_highlights_reports
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins can insert highlights reports" ON public.program_highlights_reports;
CREATE POLICY "Admins can insert highlights reports" ON public.program_highlights_reports
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins can update highlights reports" ON public.program_highlights_reports;
CREATE POLICY "Admins can update highlights reports" ON public.program_highlights_reports
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins can delete highlights reports" ON public.program_highlights_reports;
CREATE POLICY "Admins can delete highlights reports" ON public.program_highlights_reports
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Keep updated_at fresh on every edit (same trigger fn the rest of the app uses).
DROP TRIGGER IF EXISTS update_php_reports_updated_at ON public.program_highlights_reports;
CREATE TRIGGER update_php_reports_updated_at
  BEFORE UPDATE ON public.program_highlights_reports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
