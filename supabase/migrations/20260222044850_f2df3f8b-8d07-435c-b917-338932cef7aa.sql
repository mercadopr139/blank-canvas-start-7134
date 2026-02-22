-- Add structured address columns to supporters table
-- Keep existing 'address' column for backward compatibility with historical data
ALTER TABLE public.supporters
  ADD COLUMN IF NOT EXISTS address_street text,
  ADD COLUMN IF NOT EXISTS address_city text,
  ADD COLUMN IF NOT EXISTS address_state text,
  ADD COLUMN IF NOT EXISTS address_zip text,
  ADD COLUMN IF NOT EXISTS address_country text DEFAULT 'US';