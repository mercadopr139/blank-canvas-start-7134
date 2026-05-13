-- Capture the actual email body + attached PDF on every invoice send so
-- operators can later open the row and see exactly what went out.
--
-- Mirrors the columns added to receipt_sends in 20260513160000 +
-- 20260513170000. The invoice viewer modal reads from these columns; the
-- send-invoice edge function writes them on every send (success and
-- failure paths). is_regenerated flags rows that were synthesized by the
-- backfill-invoice-sends function rather than captured at real send time
-- — the viewer renders a disclaimer on those because the original
-- personal note isn't recoverable and the template may have shifted.

ALTER TABLE public.invoice_sends
  ADD COLUMN IF NOT EXISTS email_html TEXT,
  ADD COLUMN IF NOT EXISTS pdf_base64 TEXT,
  ADD COLUMN IF NOT EXISTS pdf_filename TEXT,
  ADD COLUMN IF NOT EXISTS is_regenerated BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS invoice_sends_is_regenerated_idx
  ON public.invoice_sends(is_regenerated)
  WHERE is_regenerated = true;
