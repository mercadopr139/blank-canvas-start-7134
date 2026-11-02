-- Jayla Banks re-registered on 2026-09-04 (2026-27 row 938898bb…, linked
-- from the new row to the old one). Her 2026-09-03 check-in — a manual NLA
-- add the night before — still sits on the 2025-26 row b87ab2e5… because
-- the earlier repair (20261102170500) ran before this was found. Move it.
-- Names its row by id and checks first; safe to run more than once.

UPDATE public.attendance_records a
   SET registration_id = '938898bb-253c-460b-af83-0510c2bedfba'
 WHERE a.id = 'efe9d21b-6791-42a6-a4a5-cc0bf3569338'
   AND NOT EXISTS (SELECT 1 FROM public.attendance_records b
                    WHERE b.registration_id = '938898bb-253c-460b-af83-0510c2bedfba'
                      AND b.check_in_date = a.check_in_date AND b.program_source = a.program_source);

SELECT 'jayla banks check-in moved' AS done;
