-- NLA registration form: allergies asked like asthma (Josh, 2026-09-29).
-- "Does your child have any allergies?" Yes/No, then, only on Yes, the box to
-- list them. The Yes/No is a non-core field, so it lands in
-- custom_fields_data.has_allergies exactly as has_asthma does; the list still
-- goes to youth_registrations.allergies. Existing registrations are untouched:
-- their allergy text stays and the medical alert still reads it.
BEGIN;

INSERT INTO public.registration_form_fields
  (field_key, field_type, label, help_text, placeholder, required, options, sort_order, is_active, is_core, db_column, section, condition)
VALUES
  ('has_allergies', 'yes_no', 'Does your child have any allergies?', NULL, NULL, true, NULL, 185, true, false, NULL, 'Medical Information', NULL)
ON CONFLICT (field_key) DO UPDATE SET
  field_type = EXCLUDED.field_type, label = EXCLUDED.label, required = EXCLUDED.required,
  sort_order = EXCLUDED.sort_order, is_active = true, section = EXCLUDED.section;

UPDATE public.registration_form_fields SET
  label = 'List your child''s allergies',
  help_text = 'Include how severe they are. If your child needs an epinephrine injection, an up-to-date EpiPen must be provided to our coaches and will stay at the academy during program hours.',
  required = true,
  condition = '{"field":"has_allergies","op":"eq","value":"Yes"}'::jsonb
WHERE field_key = 'allergies';

COMMIT;
