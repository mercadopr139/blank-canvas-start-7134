-- The Littles are ages 7–13 with no weights, by NLA policy (Josh, 2026-10-30):
-- body-weight work, plyometrics, endurance and flexibility. So the Non-Battle
-- Team and the Battle Team are ages 14–19. This rewrites the saved Grant Coach
-- text: the Vault's "Boxing Groups Explained", the Snapshot, every folder's
-- answers and the answer memory. Safe to run more than once.

-- 1. The Littles paragraph in the Vault, whatever its current wording.
UPDATE public.grant_org_fields
   SET value = regexp_replace(
         value,
         'The Littles \(ages 7–13\) provide the next level of participation\.[^\n]*',
         'The Littles (ages 7–13) provide the next level of participation. NLA policy bars youth ages 7–10 from lifting weights, and NLA extended that restriction to ages 11–13, creating the Littles so this age group is separated from weight training. Instead, the Littles train through body-weight work, plyometrics, endurance and flexibility, alongside boxing fundamentals, movement, coordination, discipline and teamwork. Older NLA athletes assist with coaching, reinforcing the organization''s core value of Service while serving as positive role models for younger participants.'
       )
 WHERE key = 'program_description' AND value ~ 'The Littles \(ages 7–13\) provide the next level of participation\.';

-- 2. The two teams' ages, everywhere Grant Coach saved them.
UPDATE public.grant_org_fields
   SET value = replace(replace(value, 'Non-Battle Team (ages 11–19)', 'Non-Battle Team (ages 14–19)'), 'Battle Team (ages 11–19)', 'Battle Team (ages 14–19)')
 WHERE value LIKE '%Team (ages 11–19)%';

UPDATE public.grant_year_snapshots
   SET body = replace(replace(body, 'Non-Battle Team (ages 11–19)', 'Non-Battle Team (ages 14–19)'), 'Battle Team (ages 11–19)', 'Battle Team (ages 14–19)')
 WHERE body LIKE '%Team (ages 11–19)%';

UPDATE public.grant_checklist_items
   SET answer = replace(replace(replace(answer, 'Non-Battle Team (ages 11–19)', 'Non-Battle Team (ages 14–19)'), 'Battle Team (ages 11–19)', 'Battle Team (ages 14–19)'), 'Non-Battle Team ages 11–19', 'Non-Battle Team ages 14–19')
 WHERE answer LIKE '%Team (ages 11–19)%' OR answer LIKE '%Non-Battle Team ages 11–19%';

UPDATE public.grant_answer_memory
   SET answer = replace(replace(answer, 'Non-Battle Team (ages 11–19)', 'Non-Battle Team (ages 14–19)'), 'Battle Team (ages 11–19)', 'Battle Team (ages 14–19)')
 WHERE answer LIKE '%Team (ages 11–19)%';

-- 3. What still says 11–19 next to a team name, for Josh to read by hand.
SELECT 'checklist' AS place, folder_id::text AS folder, label AS what
  FROM public.grant_checklist_items
 WHERE answer LIKE '%Battle Team%' AND answer LIKE '%11–19%'
UNION ALL
SELECT 'vault', key, left(value, 60) FROM public.grant_org_fields WHERE value LIKE '%Battle Team%' AND value LIKE '%11–19%'
UNION ALL
SELECT 'snapshot', program_year, section_key FROM public.grant_year_snapshots WHERE body LIKE '%Battle Team%' AND body LIKE '%11–19%'
UNION ALL
SELECT 'done', '', 'Littles and team ages updated';
