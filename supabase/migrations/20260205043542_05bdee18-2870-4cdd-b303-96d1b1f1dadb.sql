-- Remove "Other" from child_race_ethnicity enum
ALTER TYPE public.child_race_ethnicity RENAME TO child_race_ethnicity_old;

CREATE TYPE public.child_race_ethnicity AS ENUM (
  'American Indian or Alaska Native',
  'Asian',
  'Black or African American',
  'Hispanic or Latino',
  'Native Hawaiian or Other Pacific Islander',
  'White',
  'Two or More Races'
);

ALTER TABLE public.youth_registrations 
ALTER COLUMN child_race_ethnicity TYPE public.child_race_ethnicity 
USING child_race_ethnicity::text::public.child_race_ethnicity;

DROP TYPE public.child_race_ethnicity_old;

-- Remove "Other" from child_sex enum
ALTER TYPE public.child_sex RENAME TO child_sex_old;

CREATE TYPE public.child_sex AS ENUM (
  'Male',
  'Female'
);

ALTER TABLE public.youth_registrations 
ALTER COLUMN child_sex TYPE public.child_sex 
USING child_sex::text::public.child_sex;

DROP TYPE public.child_sex_old;