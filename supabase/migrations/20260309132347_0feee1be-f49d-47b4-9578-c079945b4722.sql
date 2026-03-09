
-- Add program_source to attendance_records to distinguish check-in systems
ALTER TABLE public.attendance_records ADD COLUMN program_source text NOT NULL DEFAULT 'NLA';

-- Add unique constraint per program_source per day per youth
-- First drop existing unique constraint if any on (registration_id, check_in_date)
ALTER TABLE public.attendance_records DROP CONSTRAINT IF EXISTS attendance_records_registration_id_check_in_date_key;
ALTER TABLE public.attendance_records ADD CONSTRAINT attendance_unique_per_program UNIQUE (registration_id, check_in_date, program_source);

-- Create search function for Lil Champs Corner youth (filtered by extended_program)
CREATE OR REPLACE FUNCTION public.search_lil_champs_youth(_search text)
RETURNS TABLE(id uuid, child_first_name text, child_last_name text, child_date_of_birth date, child_headshot_url text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    yr.id,
    yr.child_first_name,
    yr.child_last_name,
    yr.child_date_of_birth,
    yr.child_headshot_url
  FROM public.youth_registrations yr
  WHERE
    yr.approved_for_attendance = true
    AND yr.extended_program = 'Lil Champs Corner'
    AND _search IS NOT NULL
    AND length(trim(_search)) >= 2
    AND (
      yr.child_first_name ILIKE ('%' || trim(_search) || '%')
      OR yr.child_last_name ILIKE ('%' || trim(_search) || '%')
    )
  ORDER BY yr.child_last_name ASC, yr.child_first_name ASC
  LIMIT 20;
$$;

-- Create count function for Lil Champs Corner today
CREATE OR REPLACE FUNCTION public.get_today_lil_champs_count()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::integer
  FROM public.attendance_records
  WHERE check_in_date = (CURRENT_TIMESTAMP AT TIME ZONE 'America/New_York')::date
    AND program_source = 'Lil Champs Corner';
$$;
