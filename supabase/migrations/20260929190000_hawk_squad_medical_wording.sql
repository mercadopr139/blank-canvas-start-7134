-- Hawk Squad form: calmer wording for the medical questions (Josh, 2026-09-29).
-- Config only: labels and help text in hawk_squad_form_fields. No registration
-- rows change, and the NLA form is untouched.
BEGIN;

UPDATE public.hawk_squad_form_fields SET
  label = 'Allergies',
  help_text = 'List any allergies, or leave blank if none. If the student needs an epinephrine injection, an up-to-date EpiPen must be provided to our coaches and will stay at the academy during program hours.'
WHERE field_key = 'allergies';

UPDATE public.hawk_squad_form_fields SET
  label = 'Which inhaler does the student use before exercise?',
  help_text = NULL
WHERE field_key = 'asthma_inhaler_info';

UPDATE public.hawk_squad_form_fields SET
  label = 'Does the student receive free or reduced-price lunch at school?',
  help_text = 'Asked for grant reporting only. It does not affect participation.'
WHERE field_key = 'free_or_reduced_lunch';

UPDATE public.hawk_squad_form_fields SET
  help_text = 'For example, recent life changes, social challenges, or medical needs. Leave blank if nothing applies.'
WHERE field_key = 'important_child_notes';

COMMIT;
