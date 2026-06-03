-- Ad-hoc quotes + one-off invoices. Separate from the recurring
-- monthly invoice system (which is driven by clients + service_logs).
-- Used for situations like "send Pittsgrove a quote for 12 days of
-- Hawk Squad at $150/day" without needing to provision a client row.
--
-- One row per generated document. line_items stores the editable
-- table contents as JSON so the form has full flexibility (mixed
-- units like "12 days", "1 session", "Flat fee" are all just strings).
--
-- Doc numbers auto-generate per type via dedicated sequences:
--   - Quotes:   QT-0001, QT-0002, ...
--   - Invoices: IN-0001, IN-0002, ... (distinct from the recurring
--     monthly INV-XXXXX namespace, so the two systems can coexist
--     without number collisions in the eye of a recipient).

CREATE SEQUENCE IF NOT EXISTS public.ad_hoc_quote_seq START 1;
CREATE SEQUENCE IF NOT EXISTS public.ad_hoc_invoice_seq START 1;

CREATE TABLE public.ad_hoc_docs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_type text NOT NULL CHECK (doc_type IN ('quote', 'invoice')),
  doc_number text NOT NULL UNIQUE,
  -- Recipient block is free text — no FK to clients. Ad-hoc by design.
  recipient_name text NOT NULL,
  recipient_email text,
  recipient_address text,
  issue_date date NOT NULL DEFAULT CURRENT_DATE,
  -- "Valid Until" for quotes, "Due Date" for invoices. Same column,
  -- label swaps on the UI / PDF based on doc_type.
  expiry_date date,
  -- jsonb array of { description, quantity, rate, amount }.
  -- All numeric values are stored as numbers; the PDF formats them.
  line_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  subtotal numeric(12, 2) NOT NULL DEFAULT 0,
  total numeric(12, 2) NOT NULL DEFAULT 0,
  notes text,
  -- Lifecycle. draft → sent → accepted/declined (quotes) or paid
  -- (invoices) or expired. Free to expand later.
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'sent', 'accepted', 'declined', 'paid', 'expired')),
  pdf_base64 text,
  pdf_generated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX idx_ad_hoc_docs_type_created
  ON public.ad_hoc_docs(doc_type, created_at DESC);
CREATE INDEX idx_ad_hoc_docs_recipient
  ON public.ad_hoc_docs USING gin (to_tsvector('english', recipient_name));

ALTER TABLE public.ad_hoc_docs ENABLE ROW LEVEL SECURITY;
CREATE POLICY ad_hoc_docs_admin_all ON public.ad_hoc_docs
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Number generator. Called from the app on insert so the user can
-- preview the assigned number before saving. SECURITY DEFINER so an
-- admin caller doesn't need direct sequence privileges.
CREATE OR REPLACE FUNCTION public.next_ad_hoc_doc_number(p_doc_type text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n bigint;
BEGIN
  IF p_doc_type = 'quote' THEN
    n := nextval('public.ad_hoc_quote_seq');
    RETURN 'QT-' || lpad(n::text, 4, '0');
  ELSIF p_doc_type = 'invoice' THEN
    n := nextval('public.ad_hoc_invoice_seq');
    RETURN 'IN-' || lpad(n::text, 4, '0');
  ELSE
    RAISE EXCEPTION 'Unknown doc_type: %', p_doc_type;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.next_ad_hoc_doc_number(text) TO authenticated;
