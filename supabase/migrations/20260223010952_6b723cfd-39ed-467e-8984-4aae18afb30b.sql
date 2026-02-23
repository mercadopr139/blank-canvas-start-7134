
ALTER TABLE public.signals
  ADD COLUMN reopened_at timestamp with time zone DEFAULT NULL,
  ADD COLUMN reopen_count integer NOT NULL DEFAULT 0;
