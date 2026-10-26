-- Daily Duties: the history is never lost, and the check-in rule lives in the
-- database (Josh, 2026-10-26 review).
--
-- 1. Deleting a job used to CASCADE: every night that job was ever logged
--    vanished, even though the admin screen promised "its past history is
--    kept". Now the database refuses; the admin screen hides the job instead.
-- 2. Deleting a registration did the same to that youth's duty history. Now
--    it is refused while history exists; the duplicates merge
--    (admin_merge_youth_registrations) already moves duties to the keeper
--    before it deletes, so merging still works.
-- 3. assign_duty only accepts a youth who checked in at NLA tonight and is
--    approved, on an active job. That was enforced only by the board's search
--    box; the funder numbers now rest on the database.

ALTER TABLE public.duty_assignments DROP CONSTRAINT IF EXISTS duty_assignments_job_id_fkey;
ALTER TABLE public.duty_assignments
  ADD CONSTRAINT duty_assignments_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.duty_jobs(id) ON DELETE RESTRICT;

ALTER TABLE public.duty_assignments DROP CONSTRAINT IF EXISTS duty_assignments_registration_id_fkey;
ALTER TABLE public.duty_assignments
  ADD CONSTRAINT duty_assignments_registration_id_fkey FOREIGN KEY (registration_id) REFERENCES public.youth_registrations(id) ON DELETE RESTRICT;

CREATE OR REPLACE FUNCTION public.assign_duty(_job_id uuid, _registration_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _today date := (now() AT TIME ZONE 'America/New_York')::date;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.duty_jobs WHERE id = _job_id AND is_active) THEN
    RAISE EXCEPTION 'That job is no longer on the board.';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.attendance_records ar
    JOIN public.youth_registrations yr ON yr.id = ar.registration_id
    WHERE ar.registration_id = _registration_id
      AND ar.check_in_date = _today
      AND ar.program_source = 'NLA'
      AND yr.approved_for_attendance = true
  ) THEN
    RAISE EXCEPTION 'Only youth who checked in tonight can be put on a job.';
  END IF;
  INSERT INTO public.duty_assignments (job_id, registration_id, duty_date)
  VALUES (_job_id, _registration_id, _today)
  ON CONFLICT (job_id, registration_id, duty_date) DO NOTHING;
END;
$$;
GRANT EXECUTE ON FUNCTION public.assign_duty(uuid, uuid) TO anon, authenticated;
