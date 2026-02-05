-- Create enums for select fields
CREATE TYPE child_sex AS ENUM ('Male', 'Female', 'Other');
CREATE TYPE child_race_ethnicity AS ENUM (
  'American Indian or Alaska Native',
  'Asian',
  'Black or African American',
  'Hispanic or Latino',
  'Native Hawaiian or Other Pacific Islander',
  'White',
  'Two or More Races',
  'Other',
  'Prefer not to say'
);
CREATE TYPE school_district AS ENUM (
  'Cape May City',
  'Lower Cape May Regional',
  'Middle Township',
  'Ocean City',
  'Upper Township',
  'Wildwood',
  'Wildwood Crest',
  'North Wildwood',
  'West Cape May',
  'Dennis Township',
  'Woodbine',
  'Other'
);
CREATE TYPE boxing_program AS ENUM (
  'Boxing Fundamentals (Ages 7-12)',
  'Boxing Development (Ages 13-16)',
  'Boxing Advanced (Ages 17-19)',
  'Boxing Fitness Only'
);
CREATE TYPE household_income AS ENUM (
  'Under $25,000',
  '$25,000 - $49,999',
  '$50,000 - $74,999',
  '$75,000 - $99,999',
  '$100,000 - $149,999',
  '$150,000 or more',
  'Prefer not to say'
);
CREATE TYPE lunch_status AS ENUM ('Yes', 'No', 'Not Applicable');

-- Create the youth_registrations table
CREATE TABLE public.youth_registrations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Submission date
  submission_date DATE NOT NULL DEFAULT CURRENT_DATE,
  
  -- Child Information
  child_first_name TEXT NOT NULL,
  child_last_name TEXT NOT NULL,
  child_sex child_sex NOT NULL,
  child_date_of_birth DATE NOT NULL,
  child_race_ethnicity child_race_ethnicity NOT NULL,
  
  -- Parent/Guardian Information
  parent_first_name TEXT NOT NULL,
  parent_last_name TEXT NOT NULL,
  parent_phone TEXT NOT NULL,
  child_phone TEXT,
  parent_email TEXT NOT NULL,
  
  -- Address + School
  child_primary_address TEXT NOT NULL,
  child_school_district school_district NOT NULL,
  child_grade_level INTEGER,
  
  -- Program + Household
  child_boxing_program boxing_program NOT NULL,
  adults_in_household INTEGER NOT NULL,
  siblings_in_household INTEGER NOT NULL,
  
  -- Funding Questions
  household_income_range household_income NOT NULL,
  free_or_reduced_lunch lunch_status,
  
  -- Medical Info
  allergies TEXT,
  asthma_inhaler_info TEXT,
  
  -- Coach Notes
  important_child_notes TEXT,
  
  -- Waiver 1: Medical Consent
  medical_consent_name TEXT NOT NULL,
  medical_consent_signature_url TEXT NOT NULL,
  
  -- Waiver 2: Liability Waiver
  liability_waiver_name TEXT NOT NULL,
  liability_waiver_signature_url TEXT NOT NULL,
  
  -- Waiver 3: Transportation/Excursions
  transportation_excursions_waiver_name TEXT NOT NULL,
  transportation_excursions_signature_url TEXT NOT NULL,
  
  -- Waiver 4: Media Consent
  media_consent_name TEXT NOT NULL,
  media_consent_signature_url TEXT NOT NULL,
  
  -- Waiver 5: Spiritual Development Policy
  spiritual_development_policy_name TEXT NOT NULL,
  spiritual_development_policy_signature_url TEXT NOT NULL
);

-- Enable RLS
ALTER TABLE public.youth_registrations ENABLE ROW LEVEL SECURITY;

-- Public can insert (for registration form)
CREATE POLICY "Anyone can submit registration"
ON public.youth_registrations
FOR INSERT
TO public
WITH CHECK (true);

-- Only admins can view registrations
CREATE POLICY "Admins can view all registrations"
ON public.youth_registrations
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Only admins can update registrations
CREATE POLICY "Admins can update registrations"
ON public.youth_registrations
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Only admins can delete registrations
CREATE POLICY "Admins can delete registrations"
ON public.youth_registrations
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create trigger for updated_at
CREATE TRIGGER update_youth_registrations_updated_at
BEFORE UPDATE ON public.youth_registrations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for signatures
INSERT INTO storage.buckets (id, name, public) 
VALUES ('registration-signatures', 'registration-signatures', true);

-- Allow public uploads to signatures bucket
CREATE POLICY "Anyone can upload signatures"
ON storage.objects
FOR INSERT
TO public
WITH CHECK (bucket_id = 'registration-signatures');

-- Allow public to read signatures (for form confirmation)
CREATE POLICY "Anyone can view signatures"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'registration-signatures');

-- Allow admins to delete signatures
CREATE POLICY "Admins can delete signatures"
ON storage.objects
FOR DELETE
USING (bucket_id = 'registration-signatures' AND has_role(auth.uid(), 'admin'::app_role));