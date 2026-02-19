
-- Add revenue_type enum
CREATE TYPE public.revenue_type AS ENUM ('Donation', 'Fundraising', 'Fee for Service', 'Re-Grant');

-- Update donation_method enum to include Venmo and Square
ALTER TYPE public.donation_method ADD VALUE IF NOT EXISTS 'Venmo';
ALTER TYPE public.donation_method ADD VALUE IF NOT EXISTS 'Square';

-- Add new columns to donations table
ALTER TABLE public.donations
  ADD COLUMN IF NOT EXISTS revenue_type public.revenue_type NOT NULL DEFAULT 'Donation',
  ADD COLUMN IF NOT EXISTS deposit_date date,
  ADD COLUMN IF NOT EXISTS source_name text,
  ADD COLUMN IF NOT EXISTS source_email text,
  ADD COLUMN IF NOT EXISTS vendor_name text,
  ADD COLUMN IF NOT EXISTS program_name text,
  ADD COLUMN IF NOT EXISTS service_month text,
  ADD COLUMN IF NOT EXISTS partner_name text,
  ADD COLUMN IF NOT EXISTS grant_date date,
  ADD COLUMN IF NOT EXISTS event_name text,
  ADD COLUMN IF NOT EXISTS revenue_description text;
