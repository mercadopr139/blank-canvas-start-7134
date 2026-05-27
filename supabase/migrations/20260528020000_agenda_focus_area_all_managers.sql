-- Backfill: ensure every task_manager_type that exists in
-- staff_profiles has an "Agenda" focus area on its Workbench.
--
-- The original agenda schema migration (20260521000000) only seeded
-- the focus area for manager_types 'PD' and 'PC', so newer task
-- managers (Sanchez, Alex, anyone added later) had nowhere for
-- "Send to Workbench" to land — the picker showed "No Workbench"
-- against their name.
--
-- This query is idempotent: ON CONFLICT (manager_type, key) DO
-- NOTHING short-circuits any row that's already seeded, including
-- the existing PD/PC ones. Future migrations don't need to repeat
-- this seed — re-running the same INSERT here also handles new
-- task managers that get added between now and then.

INSERT INTO public.focus_areas
  (key, title, subtitle, manager_type, is_default, accent_color, icon_name, sort_order)
SELECT DISTINCT
  'agenda',
  'Agenda',
  'From the Weekly Agenda',
  task_manager_type,
  false,
  '#bf0f3e',
  'list-todo',
  99
FROM public.staff_profiles
WHERE task_manager_type IS NOT NULL
ON CONFLICT (manager_type, key) DO NOTHING;
