-- ─────────────────────────────────────────────────────────────────────
-- Make registration waivers dynamic (admin add / edit / remove) while
-- keeping every existing signed registration 100% intact.
--
-- New registrations store all waivers in youth_registrations.waivers_data.
-- Existing records keep their legacy *_name / *_signature_url column values
-- untouched (the admin view falls back to those for older registrations).
-- ─────────────────────────────────────────────────────────────────────

-- 1) The 6 legacy waiver columns are no longer required.
alter table public.youth_registrations
  alter column medical_consent_name drop not null,
  alter column medical_consent_signature_url drop not null,
  alter column liability_waiver_name drop not null,
  alter column liability_waiver_signature_url drop not null,
  alter column transportation_excursions_waiver_name drop not null,
  alter column transportation_excursions_signature_url drop not null,
  alter column media_consent_name drop not null,
  alter column media_consent_signature_url drop not null,
  alter column spiritual_development_policy_name drop not null,
  alter column spiritual_development_policy_signature_url drop not null;

-- 2) Flexible per-registration waiver store. Shape, keyed by waiver field_key:
--    { "<waiver_key>": { "title": "...", "name": "...", "signaturePath": "..." } }
alter table public.youth_registrations
  add column if not exists waivers_data jsonb not null default '{}'::jsonb;
