-- Add email tracking fields to invoices
ALTER TABLE public.invoices
ADD COLUMN sent_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN sent_to TEXT;