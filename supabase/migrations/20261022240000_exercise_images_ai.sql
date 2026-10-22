-- A generated drawing fills the gaps the free library leaves (Josh, 2026-10-22):
-- a move it doesn't have, or a motion it shows with only one picture (the wall
-- ball throw). source 'ai' marks those, so the walls tag them "AI drawing" and a
-- coach knows which to check for form.
alter table public.exercise_images drop constraint if exists exercise_images_source_check;
alter table public.exercise_images
  add constraint exercise_images_source_check check (source in ('library', 'upload', 'none', 'ai'));
