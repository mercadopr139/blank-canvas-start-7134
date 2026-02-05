-- Remove "Prefer not to say" from child_race_ethnicity enum
ALTER TYPE public.child_race_ethnicity RENAME TO child_race_ethnicity_old;

CREATE TYPE public.child_race_ethnicity AS ENUM (
  'American Indian or Alaska Native',
  'Asian',
  'Black or African American',
  'Hispanic or Latino',
  'Native Hawaiian or Other Pacific Islander',
  'White',
  'Two or More Races',
  'Other'
);

ALTER TABLE public.youth_registrations 
ALTER COLUMN child_race_ethnicity TYPE public.child_race_ethnicity 
USING child_race_ethnicity::text::public.child_race_ethnicity;

DROP TYPE public.child_race_ethnicity_old;

-- Remove "Prefer not to say" from household_income enum
ALTER TYPE public.household_income RENAME TO household_income_old;

CREATE TYPE public.household_income AS ENUM (
  'Under $25,000',
  '$25,000 - $49,999',
  '$50,000 - $74,999',
  '$75,000 - $99,999',
  '$100,000 - $149,999',
  '$150,000 or more'
);

ALTER TABLE public.youth_registrations 
ALTER COLUMN household_income_range TYPE public.household_income 
USING household_income_range::text::public.household_income;

DROP TYPE public.household_income_old;