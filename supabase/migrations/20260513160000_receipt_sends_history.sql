-- receipt_sends — full history of every donor receipt send attempt.
--
-- One row per send. Captures everything needed to later open and view
-- exactly what was sent: subject line, rendered email HTML, the PDF
-- attachment (base64), the personal message the operator typed, the
-- recipient email, and the outcome ('Sent' | 'Failed'). Failed sends
-- store an error string for diagnostics; html/pdf may be null on the
-- failure path since they may not have been generated yet.
--
-- The `receipt_year` column is the calendar year the receipt covers
-- (and also the year sent — they're the same in practice). The app
-- treats a supporter as receipted for the current year when the
-- latest receipt_sends.status = 'Sent' for receipt_year = current.
-- That mirrors how supporters.latest_receipt_* is used today; this
-- table is the audit trail behind that summary.

CREATE TABLE IF NOT EXISTS public.receipt_sends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supporter_id UUID NOT NULL REFERENCES public.supporters(id) ON DELETE CASCADE,
  receipt_year INT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('Sent', 'Failed')),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_to TEXT,
  subject TEXT,
  email_html TEXT,
  email_text TEXT,
  pdf_base64 TEXT,
  pdf_filename TEXT,
  personal_message TEXT,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS receipt_sends_supporter_id_idx
  ON public.receipt_sends(supporter_id);

CREATE INDEX IF NOT EXISTS receipt_sends_supporter_year_sent_at_idx
  ON public.receipt_sends(supporter_id, receipt_year, sent_at DESC);

ALTER TABLE public.receipt_sends ENABLE ROW LEVEL SECURITY;

-- Admin-only access. has_role() is the project-wide helper for checking
-- the user_roles table (same pattern used by other admin-only tables).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'receipt_sends'
      AND policyname = 'receipt_sends_admin_select'
  ) THEN
    CREATE POLICY receipt_sends_admin_select ON public.receipt_sends
      FOR SELECT
      USING (public.has_role(auth.uid(), 'admin'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'receipt_sends'
      AND policyname = 'receipt_sends_admin_insert'
  ) THEN
    CREATE POLICY receipt_sends_admin_insert ON public.receipt_sends
      FOR INSERT
      WITH CHECK (public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;
