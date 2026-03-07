
-- Add missing school_district enum values used by the registration form
ALTER TYPE public.school_district ADD VALUE IF NOT EXISTS 'Lower Township';
ALTER TYPE public.school_district ADD VALUE IF NOT EXISTS 'Cape May Tech';
ALTER TYPE public.school_district ADD VALUE IF NOT EXISTS 'Avalon/Stone Harbor';
ALTER TYPE public.school_district ADD VALUE IF NOT EXISTS 'Wildwood Catholic Academy';
ALTER TYPE public.school_district ADD VALUE IF NOT EXISTS 'Homeschool, Hybrid, or Alternative Form of Schooling';
ALTER TYPE public.school_district ADD VALUE IF NOT EXISTS 'Cape May/West Cape May';
ALTER TYPE public.school_district ADD VALUE IF NOT EXISTS 'Wildwood/Wildwood Crest/North Wildwood';

-- Add missing household_income enum values used by the registration form
ALTER TYPE public.household_income ADD VALUE IF NOT EXISTS 'Less than $25,000';
ALTER TYPE public.household_income ADD VALUE IF NOT EXISTS 'Less than $35,000';
ALTER TYPE public.household_income ADD VALUE IF NOT EXISTS 'Less than $45,000';
ALTER TYPE public.household_income ADD VALUE IF NOT EXISTS 'Less than $65,000';
ALTER TYPE public.household_income ADD VALUE IF NOT EXISTS 'Less than $80,000';
ALTER TYPE public.household_income ADD VALUE IF NOT EXISTS 'Greater than $80,001';
