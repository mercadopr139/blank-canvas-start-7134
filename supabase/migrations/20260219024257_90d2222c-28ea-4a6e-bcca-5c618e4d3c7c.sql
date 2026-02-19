
-- Create bank_account enum
CREATE TYPE public.bank_account AS ENUM ('Crest Savings', 'Other');

-- Create deposit_status enum
CREATE TYPE public.deposit_status AS ENUM ('Draft', 'Deposited');

-- Create deposit_batches table
CREATE TABLE public.deposit_batches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  batch_name TEXT NOT NULL,
  bank_account public.bank_account NOT NULL DEFAULT 'Crest Savings',
  status public.deposit_status NOT NULL DEFAULT 'Draft',
  deposit_date DATE,
  deposited_by TEXT,
  created_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.deposit_batches ENABLE ROW LEVEL SECURITY;

-- Admin-only policies
CREATE POLICY "Admins can view all deposit_batches" ON public.deposit_batches FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can create deposit_batches" ON public.deposit_batches FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update deposit_batches" ON public.deposit_batches FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete deposit_batches" ON public.deposit_batches FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- Timestamp trigger
CREATE TRIGGER update_deposit_batches_updated_at
  BEFORE UPDATE ON public.deposit_batches
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add foreign key from donations to deposit_batches
ALTER TABLE public.donations
  ADD CONSTRAINT donations_deposit_batch_id_fkey
  FOREIGN KEY (deposit_batch_id) REFERENCES public.deposit_batches(id) ON DELETE SET NULL;

-- Constraint
ALTER TABLE public.deposit_batches ADD CONSTRAINT deposit_batches_name_length CHECK (char_length(batch_name) <= 200);
