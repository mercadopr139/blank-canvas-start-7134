-- Drop the per-manager-type "Agenda" focus_area tiles.
--
-- These were seeded so agenda items pushed via Send-to-Workbench had a
-- dedicated landing tile. The privacy redesign moved all agenda pushes
-- to each user's NLA tile (so other tiles stay private), making these
-- tiles unused.
--
-- Verified before deletion: zero signals reference these tiles
-- (source = 'Agenda' or '<TYPE>:Agenda' returned 0 rows). No data lost.

DELETE FROM public.focus_areas
WHERE key = 'agenda';
