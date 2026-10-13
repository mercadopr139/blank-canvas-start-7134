-- A coach can throw out an exercise's demo video from the Battle Team board's
-- Edit tonight and get a new one (Josh, 2026-10-13: "standing dumbbell press"
-- was showing a seated press). The finder remembers every video rejected for
-- an exercise so each tap brings one not seen before, and the rejected ones
-- never come back when the cache expires either.
ALTER TABLE public.exercise_videos
  ADD COLUMN IF NOT EXISTS rejected_ids text[] NOT NULL DEFAULT '{}';
