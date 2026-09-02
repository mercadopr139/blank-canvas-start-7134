-- Cache of auto-found demo videos, one per exercise name (normalized).
-- Populated by the find-exercise-video edge function; read/written only by it
-- (service role), so no client-facing RLS policies are needed.
CREATE TABLE IF NOT EXISTS public.exercise_videos (
  name_norm   text PRIMARY KEY,      -- lower/trimmed exercise name
  youtube_id  text,                  -- null = searched, nothing embeddable found
  title       text,
  fetched_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.exercise_videos ENABLE ROW LEVEL SECURITY;
-- (No policies: only the edge function's service-role key touches this table.)
