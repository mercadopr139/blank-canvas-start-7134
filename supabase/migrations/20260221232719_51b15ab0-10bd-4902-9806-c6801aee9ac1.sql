ALTER TABLE public.supporters
  ADD COLUMN IF NOT EXISTS supporter_category text DEFAULT NULL;