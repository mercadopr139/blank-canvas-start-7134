
ALTER TABLE public.signals
  ADD COLUMN is_archived boolean NOT NULL DEFAULT false,
  ADD COLUMN archived_at timestamp with time zone;
