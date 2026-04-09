CREATE TABLE public.weather_data (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL,
  location TEXT NOT NULL DEFAULT 'rio_grande_nj',
  temp_high NUMERIC,
  temp_low NUMERIC,
  precipitation NUMERIC,
  condition TEXT,
  condition_code INTEGER,
  fetched_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(date, location)
);

ALTER TABLE public.weather_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view weather_data" ON public.weather_data FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can insert weather_data" ON public.weather_data FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update weather_data" ON public.weather_data FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete weather_data" ON public.weather_data FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));