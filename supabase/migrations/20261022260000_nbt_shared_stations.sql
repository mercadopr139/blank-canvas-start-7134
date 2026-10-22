-- The Cardio Stations are ONE shared block for the room (Josh, 2026-10-22:
-- "cardio stations should only be one track because it's shared"). They were
-- stored twice, under work.alpha and a copy under work.bravo, and the copies
-- had drifted apart — the wall only ever read Alpha's. Move each stations
-- day's lines into work.shared (from Alpha, the copy the wall showed) and
-- clear the two track copies. Days with a per-track circuit are untouched.

-- A copy of every week first, in case anything needs putting back.
create table if not exists public.nbt_weeks_backup_20261022 as
  select id, days, now() as backed_up_at from public.nbt_weeks;
alter table public.nbt_weeks_backup_20261022 enable row level security;

update public.nbt_weeks w
set days = (
  select jsonb_object_agg(
    d.key,
    case
      when d.value -> 'work' -> 'shared' is null
       and (d.value -> 'work' -> 'alpha' ->> 0) ~* '^[0-9]+ stations'
      then jsonb_set(
             jsonb_set(
               jsonb_set(d.value, '{work,shared}', d.value -> 'work' -> 'alpha'),
               '{work,alpha}', '[]'::jsonb),
             '{work,bravo}', '[]'::jsonb)
      else d.value
    end
  )
  from jsonb_each(w.days) d
)
where w.days is not null and jsonb_typeof(w.days) = 'object';
