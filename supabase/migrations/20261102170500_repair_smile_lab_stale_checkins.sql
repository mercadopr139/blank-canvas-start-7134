-- Repair of the check-ins the ungated Smile Lab roster filed against last
-- year's rows since the gate came on (2026-09-03). Found 2026-11-02: nine
-- rows. Six belong to youth who re-registered (their 2026-27 row is linked
-- by youth_link_id, in either direction): five move to the current-year
-- row, one (Martin Perez Jr, 2026-10-06) is a duplicate of a check-in
-- already on his current row and comes off. Three belong to youth with no
-- 2026-27 registration yet (Lyla Mercado 10-13 and 10-20, Robert Feltwell
-- 10-20) and are left exactly as they are: real attendance, waiting on a
-- re-registration to link to. Every statement names its row by id and
-- checks before it acts, so this is safe to run more than once.

-- Jayla Banks, 2026-09-03 (a manual NLA add the night before her 2026-27 registration): 2025-26 b87ab2e5… → 2026-27 938898bb…
UPDATE public.attendance_records a
   SET registration_id = '938898bb-253c-460b-af83-0510c2bedfba'
 WHERE a.id = 'efe9d21b-6791-42a6-a4a5-cc0bf3569338'
   AND NOT EXISTS (SELECT 1 FROM public.attendance_records b
                    WHERE b.registration_id = '938898bb-253c-460b-af83-0510c2bedfba'
                      AND b.check_in_date = a.check_in_date AND b.program_source = a.program_source);

-- Gabriel Ayende: 2025-26 a9701142… → 2026-27 07d6f6f3…
UPDATE public.attendance_records a
   SET registration_id = '07d6f6f3-18d4-43bc-b40e-84014c5f1c9f'
 WHERE a.id IN ('38be550e-4ddc-467e-9403-63b9f019b6a9', 'cb59b91f-ed86-4d15-bab6-3841485cfb42')
   AND a.registration_id = 'a9701142-47ab-4530-87f4-8fff585e5dcb'
   AND NOT EXISTS (SELECT 1 FROM public.attendance_records b
                    WHERE b.registration_id = '07d6f6f3-18d4-43bc-b40e-84014c5f1c9f'
                      AND b.check_in_date = a.check_in_date AND b.program_source = a.program_source);

-- Noah Chavez, 2026-09-29 → 2026-27 fa5a9daa…
UPDATE public.attendance_records a
   SET registration_id = 'fa5a9daa-1b95-4641-85e2-006867c039ec'
 WHERE a.id = 'a9397b60-aa9e-445b-9e06-e570a828245e'
   AND NOT EXISTS (SELECT 1 FROM public.attendance_records b
                    WHERE b.registration_id = 'fa5a9daa-1b95-4641-85e2-006867c039ec'
                      AND b.check_in_date = a.check_in_date AND b.program_source = a.program_source);

-- Jayvian Concepcion, 2026-10-06 → 2026-27 ee0a9938…
UPDATE public.attendance_records a
   SET registration_id = 'ee0a9938-e165-4e01-b30e-df17f323752c'
 WHERE a.id = '01cd00d4-c7d6-4d41-9712-f72528588a16'
   AND NOT EXISTS (SELECT 1 FROM public.attendance_records b
                    WHERE b.registration_id = 'ee0a9938-e165-4e01-b30e-df17f323752c'
                      AND b.check_in_date = a.check_in_date AND b.program_source = a.program_source);

-- Martin Perez Jr, 2026-10-06: his current-year row already has this night's Smile Lab check-in.
DELETE FROM public.attendance_records a
 WHERE a.id = '77690aea-fff1-403d-9453-3d080a52f684'
   AND EXISTS (SELECT 1 FROM public.attendance_records b
                WHERE b.registration_id = '1c6ff117-3f36-416a-b4db-ff00c71c885a'
                  AND b.check_in_date = a.check_in_date AND b.program_source = a.program_source);

SELECT 'stale smile lab check-ins repaired' AS done;
