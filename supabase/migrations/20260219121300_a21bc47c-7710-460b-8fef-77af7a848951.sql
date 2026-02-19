
-- Create supporters table
CREATE TABLE public.supporters (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  receipt_2026_status TEXT NOT NULL DEFAULT 'Not Sent' CHECK (receipt_2026_status IN ('Not Sent', 'Sent', 'Failed')),
  receipt_2026_sent_at TIMESTAMP WITH TIME ZONE,
  receipt_2026_last_sent_to TEXT,
  receipt_2026_pdf_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.supporters ENABLE ROW LEVEL SECURITY;

-- RLS policies (admin only)
CREATE POLICY "Admins can view all supporters" ON public.supporters FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can create supporters" ON public.supporters FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update supporters" ON public.supporters FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete supporters" ON public.supporters FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- Add supporter_id to donations
ALTER TABLE public.donations ADD COLUMN supporter_id UUID REFERENCES public.supporters(id);

-- Trigger for updated_at
CREATE TRIGGER update_supporters_updated_at
  BEFORE UPDATE ON public.supporters
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
