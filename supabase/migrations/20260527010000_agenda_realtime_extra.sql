-- Add the two extra tables the Agenda realtime channel needs:
--   - signals: reverse Workbench sync (signal flip → agenda mirror)
--   - agenda_activity_log: live activity feed in the detail panel
-- The other four agenda_* tables were added in the Phase 1 migration.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'signals'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.signals';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'agenda_activity_log'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.agenda_activity_log';
  END IF;
END $$;
