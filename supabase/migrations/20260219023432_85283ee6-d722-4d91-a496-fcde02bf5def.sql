
-- Create donation_method enum
CREATE TYPE public.donation_method AS ENUM ('Check', 'PayPal', 'Cash', 'Other');

-- Create receipt_status enum
CREATE TYPE public.receipt_status AS ENUM ('Pending', 'Sent', 'Not Needed');

-- Create donations table
CREATE TABLE public.donations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  donor_name TEXT NOT NULL,
  donor_email TEXT,
  amount NUMERIC NOT NULL,
  method public.donation_method NOT NULL,
  date_received DATE NOT NULL,
  reference_id TEXT,
  notes TEXT,
  deposit_batch_id UUID,
  receipt_status public.receipt_status NOT NULL DEFAULT 'Pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.donations ENABLE ROW LEVEL SECURITY;

-- Admin-only policies
CREATE POLICY "Admins can view all donations" ON public.donations FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can create donations" ON public.donations FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update donations" ON public.donations FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete donations" ON public.donations FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- Timestamp trigger
CREATE TRIGGER update_donations_updated_at
  BEFORE UPDATE ON public.donations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Validation constraints
ALTER TABLE public.donations ADD CONSTRAINT donations_donor_name_length CHECK (char_length(donor_name) <= 200);
ALTER TABLE public.donations ADD CONSTRAINT donations_amount_positive CHECK (amount > 0);
ALTER TABLE public.donations ADD CONSTRAINT donations_reference_id_length CHECK (char_length(reference_id) <= 200);
