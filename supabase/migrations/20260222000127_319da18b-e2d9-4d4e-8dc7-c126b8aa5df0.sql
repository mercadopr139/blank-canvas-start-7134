
-- Create engagement_type enum
CREATE TYPE public.engagement_type AS ENUM ('Call', 'Email', 'Text', 'Meeting', 'Event', 'Report Sent', 'Video Update Sent');

-- Create engagement_outcome enum
CREATE TYPE public.engagement_outcome AS ENUM ('Positive', 'Neutral', 'No Response');

-- Create engagements table
CREATE TABLE public.engagements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  supporter_id UUID NOT NULL REFERENCES public.supporters(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  engagement_type public.engagement_type NOT NULL,
  logged_by TEXT,
  summary TEXT,
  outcome public.engagement_outcome,
  follow_up_needed BOOLEAN NOT NULL DEFAULT false,
  follow_up_date DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.engagements ENABLE ROW LEVEL SECURITY;

-- Admin-only policies
CREATE POLICY "Admins can view all engagements" ON public.engagements FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can create engagements" ON public.engagements FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update engagements" ON public.engagements FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete engagements" ON public.engagements FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- Updated_at trigger
CREATE TRIGGER update_engagements_updated_at
  BEFORE UPDATE ON public.engagements
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
