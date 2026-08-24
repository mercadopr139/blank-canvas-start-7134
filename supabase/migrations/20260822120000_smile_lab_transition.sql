-- Transition "Lil Champs Corner" → "Smile Lab"
--
-- Smile Lab is the same complimentary aftercare for Junior Boxing (Ages 7-10)
-- participants, taking over from the (now-defunded) Lil Champs Corner / Acenda
-- partnership. It keeps the same separate-attendance model.
--
-- This migration:
--   1. Re-tags currently enrolled kids so the new Smile Lab kiosk finds them.
--   2. Updates the auto-tag trigger so new Junior Boxers get 'Smile Lab'.
--   3. Adds Smile Lab search/count/roster functions (mirrors the Lil Champs ones).
--
-- HISTORY IS PRESERVED: existing attendance_records keep program_source =
-- 'Lil Champs Corner' (still visible in Attendance Reports). Only the kids'
-- program tag moves forward, and all NEW check-ins are stamped 'Smile Lab'.

-- 1. Move currently-enrolled kids onto the new tag.
update public.youth_registrations
set extended_program = 'Smile Lab'
where extended_program = 'Lil Champs Corner';

-- 2. New Junior Boxers auto-tag as Smile Lab going forward.
create or replace function public.auto_assign_lil_champs()
returns trigger
language plpgsql
security definer
set search_path = 'public'
as $$
begin
  if new.child_boxing_program = 'Junior Boxing (Ages 7-10)' then
    new.extended_program := 'Smile Lab';
  end if;
  return new;
end;
$$;

-- 3a. Smile Lab kiosk search (mirrors search_lil_champs_youth, same year gate).
create or replace function public.search_smile_lab_youth(_search text)
returns table (id uuid, child_first_name text, child_last_name text, child_date_of_birth date, child_headshot_url text)
language sql stable security definer set search_path = public
as $$
  select yr.id, yr.child_first_name, yr.child_last_name, yr.child_date_of_birth, yr.child_headshot_url
  from public.youth_registrations yr
  where yr.approved_for_attendance = true
    and yr.extended_program = 'Smile Lab'
    and public.passes_kiosk_year_gate(yr.program_year, yr.archived_at)
    and _search is not null
    and length(trim(_search)) >= 2
    and (yr.child_first_name ilike ('%' || trim(_search) || '%')
         or yr.child_last_name ilike ('%' || trim(_search) || '%'))
  order by yr.child_last_name asc, yr.child_first_name asc
  limit 20;
$$;

-- 3b. Today's Smile Lab check-in count.
create or replace function public.get_today_smile_lab_count()
returns integer
language sql stable security definer set search_path = public
as $$
  select count(*)::integer
  from public.attendance_records
  where check_in_date = (current_timestamp at time zone 'America/New_York')::date
    and program_source = 'Smile Lab';
$$;

-- 3c. Safe public roster for the "Browse by Photo" wall.
create or replace function public.get_smile_lab_roster()
returns table (id uuid, child_first_name text, child_last_name text, child_date_of_birth date, child_headshot_url text)
language sql stable security definer set search_path = public
as $$
  select yr.id, yr.child_first_name, yr.child_last_name, yr.child_date_of_birth, yr.child_headshot_url
  from public.youth_registrations yr
  where yr.approved_for_attendance = true
    and yr.extended_program = 'Smile Lab'
  order by yr.child_last_name asc, yr.child_first_name asc;
$$;

grant execute on function public.search_smile_lab_youth(text) to anon, authenticated;
grant execute on function public.get_today_smile_lab_count() to anon, authenticated;
grant execute on function public.get_smile_lab_roster() to anon, authenticated;
