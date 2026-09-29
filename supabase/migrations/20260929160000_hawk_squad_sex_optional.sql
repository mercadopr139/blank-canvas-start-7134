-- Hawk Squad form: the sex question is no longer required (Josh, 2026-09-29).
-- Config only; no registration rows change.
UPDATE public.hawk_squad_form_fields
SET required = false
WHERE field_key = 'child_sex';
