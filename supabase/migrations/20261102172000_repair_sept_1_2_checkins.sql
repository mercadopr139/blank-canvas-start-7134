-- The first two nights of the 2026-27 year, Sept 1 and 2, came BEFORE the
-- kiosk gate came on (Sept 3), so the NLA kiosk still found last year's
-- rows: 35 check-ins by 28 youth sit on 2025-26 registrations (found
-- 2026-11-02; Josh: "any Sept check-in to today is for 2026-27").
--
-- Each one moves to the youth's 2026-27 row where there is one — matched by
-- the link between the two rows (either direction) or, failing that, by the
-- exact first name, last name and date of birth. Expected on 2026-11-02:
-- 32 moved, 1 duplicate removed (Jordyn Banks, Sept 1, already on her new
-- row), 2 left where they are (Aj Dahlen, Eric Matteucci: no 2026-27 row
-- yet). Scoped to those two dates and to 2025-26 rows only; the guard
-- trigger checks inserts, not these updates. Safe to run more than once.

WITH stale AS (
  SELECT a.id AS att_id, a.check_in_date, a.program_source, r.id AS old_id,
         r.child_first_name, r.child_last_name, r.child_date_of_birth, r.youth_link_id
  FROM public.attendance_records a
  JOIN public.youth_registrations r ON r.id = a.registration_id
  WHERE a.check_in_date BETWEEN '2026-09-01' AND '2026-09-02'
    AND r.program_year = '2025-2026'
), resolved AS (
  SELECT s.*,
    COALESCE(
      (SELECT t.id FROM public.youth_registrations t
        WHERE t.program_year = '2026-2027' AND t.id <> s.old_id
          AND (t.youth_link_id = s.old_id
               OR (s.youth_link_id IS NOT NULL AND (t.youth_link_id = s.youth_link_id OR t.id = s.youth_link_id)))
        ORDER BY t.created_at LIMIT 1),
      (SELECT t.id FROM public.youth_registrations t
        WHERE t.program_year = '2026-2027'
          AND lower(t.child_first_name) = lower(s.child_first_name)
          AND lower(t.child_last_name) = lower(s.child_last_name)
          AND t.child_date_of_birth = s.child_date_of_birth
        ORDER BY t.created_at LIMIT 1)
    ) AS twin_id
  FROM stale s
)
-- 1. A night already on the new row: the old copy comes off.
DELETE FROM public.attendance_records a
USING resolved x
WHERE a.id = x.att_id
  AND x.twin_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM public.attendance_records b
               WHERE b.registration_id = x.twin_id
                 AND b.check_in_date = x.check_in_date AND b.program_source = x.program_source);

WITH stale AS (
  SELECT a.id AS att_id, a.check_in_date, a.program_source, r.id AS old_id,
         r.child_first_name, r.child_last_name, r.child_date_of_birth, r.youth_link_id
  FROM public.attendance_records a
  JOIN public.youth_registrations r ON r.id = a.registration_id
  WHERE a.check_in_date BETWEEN '2026-09-01' AND '2026-09-02'
    AND r.program_year = '2025-2026'
), resolved AS (
  SELECT s.*,
    COALESCE(
      (SELECT t.id FROM public.youth_registrations t
        WHERE t.program_year = '2026-2027' AND t.id <> s.old_id
          AND (t.youth_link_id = s.old_id
               OR (s.youth_link_id IS NOT NULL AND (t.youth_link_id = s.youth_link_id OR t.id = s.youth_link_id)))
        ORDER BY t.created_at LIMIT 1),
      (SELECT t.id FROM public.youth_registrations t
        WHERE t.program_year = '2026-2027'
          AND lower(t.child_first_name) = lower(s.child_first_name)
          AND lower(t.child_last_name) = lower(s.child_last_name)
          AND t.child_date_of_birth = s.child_date_of_birth
        ORDER BY t.created_at LIMIT 1)
    ) AS twin_id
  FROM stale s
)
-- 2. Everything else with a 2026-27 row moves to it.
UPDATE public.attendance_records a
   SET registration_id = x.twin_id
  FROM resolved x
 WHERE a.id = x.att_id
   AND x.twin_id IS NOT NULL;

SELECT 'sept 1-2 check-ins moved to 2026-27 rows' AS done;
