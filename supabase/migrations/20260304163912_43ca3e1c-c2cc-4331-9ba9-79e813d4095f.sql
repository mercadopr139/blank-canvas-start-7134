ALTER TABLE public.invoices 
  ADD COLUMN IF NOT EXISTS pdf_base64 text,
  ADD COLUMN IF NOT EXISTS pdf_generated_at timestamptz;