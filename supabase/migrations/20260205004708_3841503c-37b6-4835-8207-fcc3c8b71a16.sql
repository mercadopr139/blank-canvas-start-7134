-- Add new values to the rate_type enum
ALTER TYPE public.rate_type ADD VALUE IF NOT EXISTS 'sponsorship';
ALTER TYPE public.rate_type ADD VALUE IF NOT EXISTS 'other_service';