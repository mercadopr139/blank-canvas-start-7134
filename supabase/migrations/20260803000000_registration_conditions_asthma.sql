-- Conditional questions for the youth registration form + a structured asthma
-- flow. Adds a generic `condition` column (show-if logic, mirrors the standalone
-- form builder's shape) so a field can be shown/required only when another
-- field has a given answer. The registration renderer + required-check honor it.
--
-- Asthma flow:
--   • "Does your child have asthma?"  (Yes/No, required)
--   • If Yes → inhaler name & instructions (required) + an acknowledgment that
--     an inhaler must stay on-site (required). If No → both stay hidden.
-- "Yes" makes inhaler info required, which populates asthma_inhaler_info and
-- fires the existing medical alert (AdminRegistrations also keys off has_asthma).

alter table public.registration_form_fields
  add column if not exists condition jsonb;

-- 1) The Yes/No gate (custom field → stored in youth_registrations.custom_fields_data).
insert into public.registration_form_fields
  (field_key, field_type, label, help_text, placeholder, required, options, sort_order, is_active, is_core, db_column, default_value, section, condition)
values
  ('has_asthma', 'yes_no', 'Does your child have asthma?',
   'This helps us keep your child safe during physical activity.',
   null, true, null, 195, true, false, null, null, 'Medical Information', null)
on conflict (field_key) do update set
  field_type  = excluded.field_type,
  label       = excluded.label,
  help_text   = excluded.help_text,
  required    = excluded.required,
  sort_order  = excluded.sort_order,
  is_active   = excluded.is_active,
  section     = excluded.section;

-- 2) Inhaler info: softer wording; shown + required only when asthma = Yes.
update public.registration_form_fields
set label     = 'Inhaler name & instructions',
    help_text = 'Please list your child''s inhaler(s) and when it''s used.',
    required  = true,
    sort_order = 200,
    condition = '{"field":"has_asthma","op":"eq","value":"Yes"}'::jsonb
where field_key = 'asthma_inhaler_info';

-- 3) Acknowledgment checkbox: shown + required only when asthma = Yes.
insert into public.registration_form_fields
  (field_key, field_type, label, help_text, placeholder, required, options, sort_order, is_active, is_core, db_column, default_value, section, condition)
values
  ('asthma_inhaler_ack', 'checkbox',
   'I understand that, for my child''s safety, I must provide an inhaler that stays at No Limits Academy during all program hours.',
   null, null, true, null, 205, true, false, null, null, 'Medical Information',
   '{"field":"has_asthma","op":"eq","value":"Yes"}'::jsonb)
on conflict (field_key) do update set
  field_type  = excluded.field_type,
  label       = excluded.label,
  required    = excluded.required,
  sort_order  = excluded.sort_order,
  is_active   = excluded.is_active,
  section     = excluded.section,
  condition   = excluded.condition;
