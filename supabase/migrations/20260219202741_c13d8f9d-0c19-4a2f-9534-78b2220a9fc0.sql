
ALTER TABLE public.supporters
  ADD COLUMN IF NOT EXISTS story text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS supporter_type text NOT NULL DEFAULT 'Donor';
