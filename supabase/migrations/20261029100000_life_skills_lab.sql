-- "Life Lab" is now "Life Skills Lab" (Josh, 2026-10-29) — in every piece of
-- Grant Coach text already saved: Vault entries, the O.C.E.A.N. answers, the
-- Snapshot sections and the answer memory. Safe to run more than once.
-- (The heading tag inside saved Smile Lab sessions deliberately stays
-- "Life Lab — ": smile_lab_filed_at parses it.)

UPDATE public.grant_org_fields
   SET value = replace(value, 'Life Lab', 'Life Skills Lab')
 WHERE value LIKE '%Life Lab%' AND value NOT LIKE '%Life Skills Lab%';

UPDATE public.grant_checklist_items
   SET answer = replace(answer, 'Life Lab', 'Life Skills Lab')
 WHERE answer LIKE '%Life Lab%' AND answer NOT LIKE '%Life Skills Lab%';

UPDATE public.grant_year_snapshots
   SET body = replace(body, 'Life Lab', 'Life Skills Lab')
 WHERE body LIKE '%Life Lab%' AND body NOT LIKE '%Life Skills Lab%';

UPDATE public.grant_answer_memory
   SET answer = replace(answer, 'Life Lab', 'Life Skills Lab')
 WHERE answer LIKE '%Life Lab%' AND answer NOT LIKE '%Life Skills Lab%';

SELECT 'Life Skills Lab renamed' AS done;
