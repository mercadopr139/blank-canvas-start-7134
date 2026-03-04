
-- Add approval columns to invoices table
ALTER TABLE public.invoices 
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS approved_by text,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS approval_notes text,
  ADD COLUMN IF NOT EXISTS approval_request_sent_at timestamptz;

-- Create invoice_approvals table
CREATE TABLE public.invoice_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  requested_by_user_id uuid,
  approver_email text NOT NULL DEFAULT 'chrissycasiello@nolimitsboxingacademy.org',
  status text NOT NULL DEFAULT 'pending',
  responded_at timestamptz,
  notes text,
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on invoice_approvals
ALTER TABLE public.invoice_approvals ENABLE ROW LEVEL SECURITY;

-- Admin policies for invoice_approvals
CREATE POLICY "Admins can view all invoice_approvals"
  ON public.invoice_approvals FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can create invoice_approvals"
  ON public.invoice_approvals FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update invoice_approvals"
  ON public.invoice_approvals FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete invoice_approvals"
  ON public.invoice_approvals FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Public read policy for token-based access (used by approval page via edge function)
-- The actual token validation happens in the edge function, not RLS
