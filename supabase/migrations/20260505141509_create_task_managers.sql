-- Central registry of task managers. Today only PD (Josh Mercado) and PC
-- (Chrissy Casiello) exist hardcoded in the frontend; this table makes the
-- system data-driven so new managers can be added via the admin UI without
-- code changes (e.g. HC for the head coach, JS for Josh Sanchez, etc.).
--
-- Source convention on signals:
--   PD: signals.source IS NULL or stores the raw focus area title
--       (legacy convention, kept for backward compatibility)
--   any other key: signals.source = '<KEY>:<focus area title>'
--                  e.g. 'PC:NLA', 'HC:USA Boxing'

CREATE TABLE IF NOT EXISTS public.task_managers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  subtitle TEXT,
  owner_email TEXT,
  owner_name TEXT,
  accent_color TEXT DEFAULT '#a1a1aa',
  icon_name TEXT DEFAULT 'signal',
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.task_managers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view task_managers"
  ON public.task_managers FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert task_managers"
  ON public.task_managers FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update task_managers"
  ON public.task_managers FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete task_managers"
  ON public.task_managers FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Seed the two managers that previously existed as hardcoded entries in the
-- frontend (DEFAULT_TILES in AdminDashboard.tsx, plus various JOSH_EMAIL /
-- CHRISSY_EMAIL constants). These INSERTs are idempotent on re-run thanks
-- to the unique key constraint and ON CONFLICT DO NOTHING.
INSERT INTO public.task_managers (key, display_name, subtitle, owner_email, owner_name, sort_order) VALUES
  ('PD', 'PD Task Manager', 'Focus Areas & Daily Signals', 'joshmercado@nolimitsboxingacademy.org', 'Josh Mercado', 1),
  ('PC', 'PC Task Manager', 'Focus Areas & Daily Signals', 'chrissycasiello@nolimitsboxingacademy.org', 'Chrissy Casiello', 2)
ON CONFLICT (key) DO NOTHING;

COMMENT ON TABLE public.task_managers IS
  'Central registry of task managers. Each row defines one manager (PD, PC, HC, etc.) with its display label, owner email, and visual styling. Used by AdminDashboard, AdminTaskManager, and AdminSignals to drive routing, greeting, and focus-area lock logic.';
