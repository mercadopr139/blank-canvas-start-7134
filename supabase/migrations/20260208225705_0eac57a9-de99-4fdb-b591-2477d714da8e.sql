-- Add CHECK constraints for text length limits on youth_registrations
ALTER TABLE public.youth_registrations 
ADD CONSTRAINT reasonable_text_lengths CHECK (
  length(child_first_name) <= 100 AND 
  length(child_last_name) <= 100 AND
  length(parent_first_name) <= 100 AND
  length(parent_last_name) <= 100 AND
  length(parent_email) <= 255 AND 
  length(child_primary_address) <= 500 AND
  length(allergies) <= 1000 AND 
  length(asthma_inhaler_info) <= 1000 AND
  length(important_child_notes) <= 2000 AND
  length(parent_phone) <= 20 AND
  (child_phone IS NULL OR length(child_phone) <= 20)
);

-- Add CHECK constraints for reasonable value ranges
ALTER TABLE public.youth_registrations 
ADD CONSTRAINT reasonable_ranges CHECK (
  (child_grade_level IS NULL OR (child_grade_level >= 0 AND child_grade_level <= 12)) AND
  adults_in_household >= 1 AND adults_in_household <= 20 AND
  siblings_in_household >= 0 AND siblings_in_household <= 20
);

-- Add email format validation using regex
ALTER TABLE public.youth_registrations 
ADD CONSTRAINT email_format CHECK (
  parent_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
);