-- Hawk Squad form: allergies asked like asthma (Josh, 2026-09-29).
-- "Does the student have any allergies?" Yes/No, then, only on Yes, the box to
-- list them. Adds has_allergies to the registration and a has_allergies form
-- field just before the existing allergies field, which becomes conditional.
BEGIN;

ALTER TABLE public.hawk_squad_registrations
  ADD COLUMN IF NOT EXISTS has_allergies boolean;

INSERT INTO public.hawk_squad_form_fields
  (field_key, field_type, label, help_text, placeholder, required, options, sort_order, is_active, is_core, db_column, section, condition)
VALUES
  ('has_allergies', 'yes_no', 'Does the student have any allergies?', NULL, NULL, true, NULL, 145, true, true, 'has_allergies', 'Medical Information', NULL)
ON CONFLICT (field_key) DO UPDATE SET
  field_type = EXCLUDED.field_type, label = EXCLUDED.label, required = EXCLUDED.required,
  sort_order = EXCLUDED.sort_order, is_active = true, section = EXCLUDED.section;

UPDATE public.hawk_squad_form_fields SET
  label = 'List the student''s allergies',
  help_text = 'Include how severe they are. If the student needs an epinephrine injection, an up-to-date EpiPen must be provided to our coaches and will stay at the academy during program hours.',
  required = true,
  condition = '{"field":"has_allergies","op":"eq","value":"Yes"}'::jsonb
WHERE field_key = 'allergies';

COMMIT;
