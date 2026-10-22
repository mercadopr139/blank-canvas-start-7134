-- A second open library, wger.de, fills the gaps (wall balls, hollow holds, a
-- two-handed kettlebell swing). Some of its pictures are CC BY-SA, which asks
-- for a credit line next to the picture; this holds it (null = none needed).
alter table public.exercise_images add column if not exists credit text;
