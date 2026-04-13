
-- Create focus_areas table
CREATE TABLE public.focus_areas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  subtitle TEXT,
  icon_name TEXT NOT NULL DEFAULT 'target',
  accent_color TEXT NOT NULL DEFAULT '#ef4444',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_default BOOLEAN NOT NULL DEFAULT false,
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Seed default focus areas
INSERT INTO public.focus_areas (key, title, subtitle, icon_name, accent_color, sort_order, is_default) VALUES
  ('nla', 'NLA', 'No Limits Academy', 'target', '#ef4444', 0, true),
  ('usa-boxing', 'USA Boxing', 'USA Boxing Programs', 'dumbbell', '#3b82f6', 1, true),
  ('quikhit', 'QUIKHIT', 'QUIKHIT Operations', 'zap', '#e4e4e7', 2, true),
  ('fcusa', 'FCUSA', 'FCUSA Programs', 'building-2', '#71717a', 3, true),
  ('personal', 'Personal', 'Personal Goals & Tasks', 'user', '#a78bfa', 4, true);

-- Enable RLS
ALTER TABLE public.focus_areas ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read all focus areas
CREATE POLICY "Authenticated users can read focus areas"
  ON public.focus_areas FOR SELECT TO authenticated USING (true);

-- Authenticated users can insert focus areas
CREATE POLICY "Authenticated users can insert focus areas"
  ON public.focus_areas FOR INSERT TO authenticated WITH CHECK (true);

-- Authenticated users can update focus areas
CREATE POLICY "Authenticated users can update focus areas"
  ON public.focus_areas FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Authenticated users can delete focus areas
CREATE POLICY "Authenticated users can delete focus areas"
  ON public.focus_areas FOR DELETE TO authenticated USING (true);

-- Create storage bucket for focus area images
INSERT INTO storage.buckets (id, name, public) VALUES ('focus-area-images', 'focus-area-images', true);

-- Storage policies
CREATE POLICY "Authenticated users can upload focus area images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'focus-area-images');

CREATE POLICY "Anyone can view focus area images"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'focus-area-images');

CREATE POLICY "Authenticated users can delete focus area images"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'focus-area-images');
