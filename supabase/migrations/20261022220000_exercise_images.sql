-- Start-and-finish pictures for every lift on the gym walls (Josh, 2026-10-22):
-- most of the youth have never done the lift, so they see the position before
-- they pick up the bar. One row per exercise name (normalized), found once by
-- the find-exercise-image edge function from the public-domain free-exercise-db
-- library, copied into our own storage so the walls never depend on GitHub,
-- and fixable by a coach (pick another, or upload our own).
create table if not exists public.exercise_images (
  name_norm      text primary key,
  exercise_id    text,             -- the library entry, or null for an upload / no picture
  exercise_name  text,
  images         text[] not null default '{}',  -- public URLs, start then finish
  source         text not null default 'library' check (source in ('library', 'upload', 'none')),
  rejected       text[] not null default '{}',  -- library ids a coach threw out for this name
  fetched_at     timestamptz not null default now()
);
alter table public.exercise_images enable row level security;
-- The walls are public: anyone may read which picture goes with a lift. Writes go through the edge function.
drop policy if exists exercise_images_read on public.exercise_images;
create policy exercise_images_read on public.exercise_images for select to anon, authenticated using (true);

-- The images themselves: a public bucket (the walls read them signed out).
insert into storage.buckets (id, name, public) values ('exercise-images', 'exercise-images', true)
on conflict (id) do update set public = true;
-- A signed-in coach may upload NLA's own picture for a lift.
drop policy if exists "Coaches upload exercise images" on storage.objects;
create policy "Coaches upload exercise images" on storage.objects for insert to authenticated
  with check (bucket_id = 'exercise-images' and (storage.foldername(name))[1] = 'uploads');
