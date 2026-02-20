
ALTER TABLE public.supporters
  ADD COLUMN IF NOT EXISTS primary_revenue_stream text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS status text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS relationship_owner text DEFAULT NULL;
