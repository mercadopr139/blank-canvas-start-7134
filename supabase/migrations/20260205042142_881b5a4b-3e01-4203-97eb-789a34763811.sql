-- Update boxing_program enum to match Monday.com form exactly
ALTER TYPE public.boxing_program RENAME TO boxing_program_old;

CREATE TYPE public.boxing_program AS ENUM (
  'Junior Boxing (Ages 7-10)',
  'Senior Boxing (Ages 11-19)',
  'Grit & Grace (Ages 11-19)'
);

-- Update the column to use the new enum
ALTER TABLE public.youth_registrations 
ALTER COLUMN child_boxing_program TYPE public.boxing_program 
USING child_boxing_program::text::public.boxing_program;

-- Drop the old enum type
DROP TYPE public.boxing_program_old;