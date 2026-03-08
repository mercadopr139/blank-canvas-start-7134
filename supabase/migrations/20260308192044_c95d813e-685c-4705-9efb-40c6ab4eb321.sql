
-- Create registration_form_fields table
CREATE TABLE public.registration_form_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  field_key text NOT NULL UNIQUE,
  field_type text NOT NULL DEFAULT 'short_text',
  label text NOT NULL,
  help_text text,
  placeholder text,
  required boolean NOT NULL DEFAULT false,
  options jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  is_core boolean NOT NULL DEFAULT false,
  db_column text,
  default_value text,
  section text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.registration_form_fields ENABLE ROW LEVEL SECURITY;

-- Anyone can read form fields (needed for public registration form)
CREATE POLICY "Anyone can read form fields"
ON public.registration_form_fields FOR SELECT
USING (true);

CREATE POLICY "Admins can insert form fields"
ON public.registration_form_fields FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update form fields"
ON public.registration_form_fields FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete form fields"
ON public.registration_form_fields FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add custom_fields_data jsonb to youth_registrations for custom field storage
ALTER TABLE public.youth_registrations ADD COLUMN IF NOT EXISTS custom_fields_data jsonb DEFAULT '{}'::jsonb;

-- Seed existing form fields
INSERT INTO public.registration_form_fields (field_key, field_type, label, help_text, placeholder, required, options, sort_order, is_active, is_core, db_column, section) VALUES
('child_first_name', 'short_text', 'First Name of Child', NULL, NULL, true, NULL, 10, true, true, 'child_first_name', 'Child Information'),
('child_last_name', 'short_text', 'Last Name of Child', NULL, NULL, true, NULL, 20, true, true, 'child_last_name', 'Child Information'),
('child_sex', 'dropdown', 'Child''s Sex', NULL, 'Select...', true, '["Male","Female"]', 30, true, true, 'child_sex', 'Child Information'),
('child_date_of_birth', 'date', 'Child''s Date of Birth', NULL, NULL, true, NULL, 40, true, true, 'child_date_of_birth', 'Child Information'),
('child_race_ethnicity', 'dropdown', 'Child''s Race / Ethnicity', NULL, 'Select...', true, '["American Indian or Alaska Native","Asian","Black or African American","Hispanic or Latino","Native Hawaiian or Other Pacific Islander","White","Two or More Races"]', 50, true, true, 'child_race_ethnicity', 'Child Information'),
('child_headshot', 'file_upload', 'Please upload a picture of your participant', 'Upload a clear headshot photo of your child.', NULL, true, NULL, 55, true, true, 'child_headshot_url', 'Child Information'),
('parent_first_name', 'short_text', 'Parent/Guardian First Name', NULL, NULL, true, NULL, 60, true, true, 'parent_first_name', 'Parent/Guardian Information'),
('parent_last_name', 'short_text', 'Parent/Guardian Last Name', NULL, NULL, true, NULL, 70, true, true, 'parent_last_name', 'Parent/Guardian Information'),
('parent_phone', 'phone', 'Parent/Guardian Cell Phone #', NULL, '(555) 555-5555', true, NULL, 80, true, true, 'parent_phone', 'Parent/Guardian Information'),
('child_phone', 'phone', 'Child''s Cell Phone #', 'If no cell phone, SKIP', '(555) 555-5555', false, NULL, 90, true, true, 'child_phone', 'Parent/Guardian Information'),
('parent_email', 'email', 'Parent/Guardian Email', NULL, NULL, true, NULL, 100, true, true, 'parent_email', 'Parent/Guardian Information'),
('child_primary_address', 'address', 'Child''s Primary Address', 'MUST BE FULL MAILING ADDRESS', NULL, true, NULL, 110, true, true, 'child_primary_address', 'Parent/Guardian Information'),
('child_school_district', 'dropdown', 'Child''s School District', NULL, 'Select...', true, '["Wildwood Catholic Academy","Lower Township","Cape May Tech","Avalon/Stone Harbor","Homeschool, Hybrid, or Alternative Form of Schooling","Upper Township","Cape May/West Cape May","Woodbine","Middle Township","Ocean City","Wildwood/Wildwood Crest/North Wildwood","Other"]', 120, true, true, 'child_school_district', 'School & Program'),
('child_grade_level', 'dropdown', 'Child''s Grade Level', 'Skip if not applicable', 'Select grade level', false, '["1","2","3","4","5","6","7","8","9","10","11","12","Not Applicable"]', 130, true, true, 'child_grade_level', 'School & Program'),
('child_boxing_program', 'dropdown', 'Child''s Boxing Program', NULL, 'Select...', true, '["Junior Boxing (Ages 7-10)","Senior Boxing (Ages 11-19)"]', 140, true, true, 'child_boxing_program', 'School & Program'),
('adults_in_household', 'dropdown', 'Adult(s) in Child''s primary household', NULL, 'Select...', true, '["Dad and Mom","Dad Only","Dad + Partner","Mom Only","Mom + Partner","Grandparent(s)","Other"]', 150, true, true, 'adults_in_household', 'Household Information'),
('siblings_in_household', 'dropdown', 'How many siblings in Child''s primary household?', NULL, 'Select...', true, '["Only child","Child + 1 sibling","Child + 2 siblings","Child + 3 siblings","Child + 4 siblings","Child + 5 siblings","Child + 6 siblings","Other"]', 160, true, true, 'siblings_in_household', 'Household Information'),
('household_income_range', 'dropdown', 'For Program funding purposes, please indicate which below reflects your total household income.', 'This information is completely confidential and is used for data collection.', 'Select...', true, '["Less than $25,000","Less than $35,000","Less than $45,000","Less than $65,000","Less than $80,000","Greater than $80,001"]', 170, true, true, 'household_income_range', 'Household Information'),
('free_or_reduced_lunch', 'dropdown', 'Does your Child receive free or reduced lunch at school?', 'Skip if not applicable', 'Select...', false, '["Yes","No"]', 180, true, true, 'free_or_reduced_lunch', 'Household Information'),
('allergies', 'long_text', 'What allergies does your child have?', 'If your child requires an epinephrine injection, YOU MUST PROVIDE No Limits Academy Coaches with an up-to-date epi-pen. NO EXCEPTIONS.', NULL, false, NULL, 190, true, true, 'allergies', 'Medical Information'),
('asthma_inhaler_info', 'long_text', 'Asthma / Inhaler Information', 'If your child has asthma, provide the name of the inhaler. YOU MUST PROVIDE an inhaler that will remain at the facility. NO EXCEPTIONS.', NULL, false, NULL, 200, true, true, 'asthma_inhaler_info', 'Medical Information'),
('important_child_notes', 'long_text', 'Please share any important information about your child that would help our coaches support them.', 'Ex: Recent life changes, social challenges, medical needs, etc. Skip if not applicable.', NULL, false, NULL, 210, true, true, 'important_child_notes', 'Medical Information');
