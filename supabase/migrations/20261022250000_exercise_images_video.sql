-- A coach decides, per move, whether its demo video shows under the picture
-- (Josh, 2026-10-22): 'auto' (only when the picture can't show the motion),
-- 'show' (always), 'hide' (never).
alter table public.exercise_images add column if not exists video text not null default 'auto';
alter table public.exercise_images drop constraint if exists exercise_images_video_check;
alter table public.exercise_images add constraint exercise_images_video_check check (video in ('auto', 'show', 'hide'));
