
-- Add resend tracking columns to invoices
ALTER TABLE public.invoices 
  ADD COLUMN IF NOT EXISTS vendor_email text,
  ADD COLUMN IF NOT EXISTS last_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS send_count integer NOT NULL DEFAULT 0;

-- Create invoice_sends history table
CREATE TABLE public.invoice_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  sent_to text NOT NULL,
  subject text NOT NULL,
  message text,
  sent_by_user_id uuid,
  sent_at timestamptz NOT NULL DEFAULT now(),
  type text NOT NULL DEFAULT 'initial' CHECK (type IN ('initial', 'resend')),
  status text NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'failed')),
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.invoice_sends ENABLE ROW LEVEL SECURITY;

-- Admin-only policies
CREATE POLICY "Admins can view all invoice_sends" ON public.invoice_sends
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can create invoice_sends" ON public.invoice_sends
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update invoice_sends" ON public.invoice_sends
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete invoice_sends" ON public.invoice_sends
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
