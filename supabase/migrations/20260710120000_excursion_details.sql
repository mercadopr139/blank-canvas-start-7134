-- ═══════════════════════════════════════════════════════════════════
-- Excursion: "Trip Overview / Details" notepad
-- ═══════════════════════════════════════════════════════════════════
-- A second free-form bullet/outline notepad on each excursion, above the
-- debrief. Holds the factual stuff — location, host/contacts, itinerary,
-- packing, logistics — so the "good & the ugly" debrief (excursions.notes)
-- stays about reflections.

BEGIN;

ALTER TABLE public.excursions
  ADD COLUMN IF NOT EXISTS details text;

COMMIT;
