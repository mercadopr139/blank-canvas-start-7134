-- Create invoice_status enum
CREATE TYPE public.invoice_status AS ENUM ('draft', 'sent', 'paid');

-- Create invoices table
CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT UNIQUE NOT NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  invoice_month INTEGER NOT NULL CHECK (invoice_month >= 1 AND invoice_month <= 12),
  invoice_year INTEGER NOT NULL CHECK (invoice_year >= 2000 AND invoice_year <= 2100),
  status invoice_status DEFAULT 'draft' NOT NULL,
  issue_date DATE DEFAULT CURRENT_DATE,
  due_date DATE,
  subtotal NUMERIC(10, 2) DEFAULT 0,
  total NUMERIC(10, 2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (client_id, invoice_month, invoice_year)
);

-- Create sequence for invoice numbers
CREATE SEQUENCE public.invoice_number_seq START 1001;

-- Create function to auto-generate invoice number
CREATE OR REPLACE FUNCTION public.generate_invoice_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.invoice_number IS NULL OR NEW.invoice_number = '' THEN
    NEW.invoice_number := 'INV-' || LPAD(nextval('public.invoice_number_seq')::TEXT, 5, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger to auto-generate invoice number
CREATE TRIGGER generate_invoice_number_trigger
BEFORE INSERT ON public.invoices
FOR EACH ROW
EXECUTE FUNCTION public.generate_invoice_number();

-- Enable RLS
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- Only admins can view invoices
CREATE POLICY "Admins can view all invoices"
ON public.invoices
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Only admins can create invoices
CREATE POLICY "Admins can create invoices"
ON public.invoices
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Only admins can update invoices
CREATE POLICY "Admins can update invoices"
ON public.invoices
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

-- Only admins can delete invoices
CREATE POLICY "Admins can delete invoices"
ON public.invoices
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- Create trigger for updated_at
CREATE TRIGGER update_invoices_updated_at
BEFORE UPDATE ON public.invoices
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();