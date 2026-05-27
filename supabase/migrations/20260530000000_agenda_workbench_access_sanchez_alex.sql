-- Give Josh Sanchez and Alexandra Mercado access to the Workbench /
-- Send-to-Workbench surface from the agenda.
--
-- Both had task_manager_type = NULL, which excluded them from every
-- per-manager-type Workbench query (focus_areas, signals filter, the
-- agenda Send picker, the floating drawer). Assigning them existing
-- manager_type codes that match their roles makes them first-class
-- Workbench recipients without inventing new types.
--
-- Assignments (based on staff_profiles.job_title):
--   - Josh Sanchez (Head Boxing & Fitness Coach) → 'HC'
--     HC already exists in focus_areas with NLA + Personal tiles, so
--     he inherits the existing Head Coach workspace.
--   - Alexandra Mercado (Assistant Program Coordinator) → 'PC'
--     Shares Chrissy's PC tile set, which matches the assistant model
--     of working off the same set as the principal.
--
-- Also: HC didn't have an Agenda focus area seeded (PC and PD got
-- theirs in earlier phases). Backfill an Agenda tile for HC and for
-- any other manager_type already in use that's missing one — so the
-- per-row Send button can route to every assigned Workbench.

-- 1) Backfill task_manager_type for the two affected staff. Conditional
--    on job_title to avoid clobbering anything that gets manually set
--    later (re-running this migration is a no-op once the type is set).
UPDATE public.staff_profiles
SET task_manager_type = 'HC'
WHERE full_name = 'Josh Sanchez'
  AND task_manager_type IS NULL;

UPDATE public.staff_profiles
SET task_manager_type = 'PC'
WHERE full_name = 'Alexandra Mercado'
  AND task_manager_type IS NULL;

-- 2) Seed the Agenda focus area for any manager_type that's currently
--    in use by an active staffer but missing one. Matches the existing
--    Agenda tile's icon/color/sort_order/subtitle so the look is
--    consistent across Workbenches. Idempotent — the NOT EXISTS guard
--    prevents duplicate rows on re-run.
INSERT INTO public.focus_areas
  (key, title, subtitle, manager_type, icon_name, accent_color, sort_order, is_default)
SELECT
  'agenda',
  'Agenda',
  'From the Weekly Agenda',
  mt.manager_type,
  'list-todo',
  '#bf0f3e',
  99,
  false
FROM (
  SELECT DISTINCT task_manager_type AS manager_type
  FROM public.staff_profiles
  WHERE task_manager_type IS NOT NULL
    AND status = 'active'
) AS mt
WHERE NOT EXISTS (
  SELECT 1 FROM public.focus_areas
  WHERE manager_type = mt.manager_type
    AND key = 'agenda'
);
