-- Give Alexandra Mercado her own private Workbench by splitting her
-- off Chrissy's 'PC' code into a new 'APC' (Assistant Program
-- Coordinator) code.
--
-- Background: yesterday's migration assigned Alex task_manager_type =
-- 'PC' to share Chrissy's seeded Workbench. That broke the privacy
-- model — anyone with type=PC sees the same signals, so Alex and
-- Chrissy could see each other's tasks. Each staffer needs their own
-- unique manager_type for their Workbench to actually be private.
--
-- Existing PC signals stay where they are (visible to Chrissy on her
-- Workbench). Alex starts empty under APC — we can't split historic
-- signals between them because the signals table has no user_id
-- column to attribute them.

-- 1) Reassign Alex to APC. Guarded so re-runs are no-ops.
UPDATE public.staff_profiles
SET task_manager_type = 'APC'
WHERE full_name = 'Alexandra Mercado'
  AND task_manager_type = 'PC';

-- 2) Seed APC focus areas mirroring Chrissy's PC set (NLA, Personal,
--    USA Boxing, QUIKHIT, FCUSA, NLA Prep, Agenda). Same icons /
--    accent colors / sort orders so Alex's Workbench looks identical
--    to Chrissy's — just scoped to her instead of shared.
INSERT INTO public.focus_areas
  (key, title, subtitle, manager_type, icon_name, accent_color, sort_order, is_default)
SELECT
  src.key, src.title, src.subtitle, 'APC' AS manager_type,
  src.icon_name, src.accent_color, src.sort_order, src.is_default
FROM public.focus_areas src
WHERE src.manager_type = 'PC'
  AND NOT EXISTS (
    SELECT 1 FROM public.focus_areas existing
    WHERE existing.manager_type = 'APC' AND existing.key = src.key
  );
