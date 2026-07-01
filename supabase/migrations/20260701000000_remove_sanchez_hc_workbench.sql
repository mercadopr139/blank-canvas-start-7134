-- Remove Josh Sanchez's Workbench (the 'HC' / Head Coach task manager)
-- for the whole team, at the Program Director's request.
--
-- His dashboard tile ("Josh Sanchez Task Manager") is keyed 'HC'. Deleting
-- only the dashboard_tiles row didn't stick — the dashboard's missing-tile
-- backfill re-seeds a tile for every row in task_managers on next load. The
-- durable fix is to remove the source-of-truth task_managers row (and the
-- data hanging off its key), which this migration does.
--
-- Verified against production before writing (SQL editor, 2026-07-01):
--   task_managers:  HC → "Josh Sanchez Task Manager", owner Josh Sanchez
--   focus_areas:    2 rows  (manager_type = 'HC')
--   signals:        42 rows (source LIKE 'HC:%')
--   staff_profiles: exactly ONE staffer on task_manager_type = 'HC'
--                   (Josh Sanchez, active) — no one else loses a workbench.
--
-- The 42 signals + 2 focus areas are intentionally and permanently
-- destroyed (confirmed by the PD). This is NOT reversible.
--
-- 'HC' is not a reserved legacy key (only PD/PC are), so the prefixed
-- source convention 'HC:<focus area>' applies and scopes the signal
-- delete cleanly to this workbench.
--
-- Idempotent: every statement is keyed on 'HC', so re-running after the
-- rows are gone is a harmless no-op.

-- Safety guard: refuse to run if HC has become a shared code (any other
-- staffer assigned to it). Protects against a reassignment landing before
-- this migration is applied.
DO $$
DECLARE
  other_hc_staff INT;
BEGIN
  SELECT count(*) INTO other_hc_staff
  FROM public.staff_profiles
  WHERE task_manager_type = 'HC'
    AND full_name <> 'Josh Sanchez';
  IF other_hc_staff > 0 THEN
    RAISE EXCEPTION
      'Aborting: % other staffer(s) assigned to HC — HC is no longer Sanchez-only', other_hc_staff;
  END IF;
END $$;

-- 1) Detach Sanchez's profile from the workbench being removed so it
--    isn't left pointing at a deleted manager_type (which would render an
--    empty workbench and list him as a phantom Send-to-Workbench target).
UPDATE public.staff_profiles
SET task_manager_type = NULL
WHERE task_manager_type = 'HC';

-- 2) Remove the HC workbench tile from every admin's dashboard. These
--    auto-seed from task_managers (one per admin), so delete them all;
--    removing the task_managers row in step 6 stops re-seeding.
DELETE FROM public.dashboard_tiles
WHERE href = '/admin/task-manager/HC';

-- 3) Revoke the per-manager permission.
DELETE FROM public.staff_permissions
WHERE permission_key = 'task_manager_HC';

-- 4) Delete the workbench's signals (source-namespaced 'HC:<focus area>').
--    Also matches a bare 'HC' source for safety, though the convention
--    always uses the colon-prefixed form.
DELETE FROM public.signals
WHERE source = 'HC'
   OR source LIKE 'HC:%';

-- 5) Delete the workbench's focus areas.
DELETE FROM public.focus_areas
WHERE manager_type = 'HC';

-- 6) Finally, delete the task manager registry row itself. With this gone,
--    the dashboard backfill has nothing to re-seed and the tile stays gone.
DELETE FROM public.task_managers
WHERE key = 'HC';
