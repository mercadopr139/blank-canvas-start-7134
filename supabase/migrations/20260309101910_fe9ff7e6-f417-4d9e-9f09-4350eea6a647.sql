UPDATE youth_registrations
SET counseling_services_name = 'Imported from Monday.com',
    counseling_services_signature_url = medical_consent_signature_url
WHERE medical_consent_name = 'Imported from Monday.com'
  AND counseling_services_name IS NULL;