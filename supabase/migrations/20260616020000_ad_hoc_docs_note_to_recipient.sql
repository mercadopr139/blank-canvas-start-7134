-- ═══════════════════════════════════════════════════════════════════
-- Invoice / Quote Generator: add note_to_recipient field
-- ═══════════════════════════════════════════════════════════════════
-- Adds a second free-text field on every ad-hoc doc. The existing
-- `notes` column already renders as "TERMS" on the PDF — Josh uses it
-- for date-schedule lists. note_to_recipient is a separate clause /
-- condition (e.g. "If no late bus is provided by school, NLA will
-- provide transport for students in need.") that prints as its own
-- "NOTE TO RECIPIENT" section below TERMS on the PDF.
--
-- Nullable so existing rows stay valid; the PDF generator skips the
-- section when blank.

ALTER TABLE public.ad_hoc_docs
  ADD COLUMN IF NOT EXISTS note_to_recipient text;
