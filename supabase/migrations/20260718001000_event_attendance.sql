-- ═══════════════════════════════════════════════════════════════════
-- Event attendance (optional / situational)
-- ═══════════════════════════════════════════════════════════════════
-- Event check-ins are stored in attendance_records exactly like excursion
-- check-ins: a program_source tag ('Event') keeps them out of the 'NLA'
-- practice numbers, so counting an event's attendance never dilutes the
-- practice averages. `event_id` links the check-in to its program_events
-- row and CASCADEs on delete, so removing an event cleans up its roster.
--
-- Idempotent (IF NOT EXISTS / OR REPLACE) so it's safe to run via the SQL
-- Editor now and `supabase db push` later without erroring.
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE public.attendance_records
  ADD COLUMN IF NOT EXISTS event_id uuid REFERENCES public.program_events(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_attendance_records_event_id
  ON public.attendance_records (event_id);

-- Admin-only RPC to record a youth into an event at an explicit date.
-- Mirrors public.admin_record_excursion_attendance exactly.
CREATE OR REPLACE FUNCTION public.admin_record_event_attendance(
  _event_id uuid,
  _registration_id uuid,
  _check_in_date date
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.require_admin();

  INSERT INTO public.attendance_records (
    registration_id, check_in_date, program_source, event_id
  )
  VALUES (
    _registration_id, _check_in_date, 'Event', _event_id
  )
  ON CONFLICT DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_record_event_attendance(uuid, uuid, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_record_event_attendance(uuid, uuid, date) TO authenticated;
