-- "Adjustment" is a Partner Service rate type (Josh, 2026-11-20): the form has
-- offered it since the 2026-11-20 billing change, but this check still listed
-- the old values, so saving one failed with client_services_rate_type_check.
-- Same list as before plus 'adjustment'.
ALTER TABLE public.client_services
  DROP CONSTRAINT IF EXISTS client_services_rate_type_check;

ALTER TABLE public.client_services
  ADD CONSTRAINT client_services_rate_type_check
  CHECK (rate_type IN (
    'per_day',
    'per_session',
    'per_hour',
    'flat_monthly',
    'sponsorship',
    'adjustment',
    'other_service'
  ));
