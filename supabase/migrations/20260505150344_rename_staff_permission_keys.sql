-- Rename and clean up legacy staff_permissions keys to match the new
-- data-driven permission model:
--   pd_signals    -> task_manager_PD   (PD task manager access)
--   pc_signals    -> task_manager_PC   (PC task manager access)
--   driver_checkin -> dropped          (the dashboard tile was removed;
--                                        drivers reach /transport directly)
--
-- Existing GRANTED/REVOKED state is preserved on the renamed keys so no
-- staff loses or gains access from this migration alone — only the names
-- change. Future task managers (HC, JS, etc.) follow the task_manager_<KEY>
-- pattern automatically without further migration.

UPDATE public.staff_permissions
   SET permission_key = 'task_manager_PD'
 WHERE permission_key = 'pd_signals';

UPDATE public.staff_permissions
   SET permission_key = 'task_manager_PC'
 WHERE permission_key = 'pc_signals';

DELETE FROM public.staff_permissions
 WHERE permission_key = 'driver_checkin';
