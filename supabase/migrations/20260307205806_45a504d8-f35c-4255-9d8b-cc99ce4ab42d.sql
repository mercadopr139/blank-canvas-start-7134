
-- Add is_bald_eagle to youth_registrations
ALTER TABLE public.youth_registrations ADD COLUMN is_bald_eagle boolean NOT NULL DEFAULT false;

-- Create attendance_records table
CREATE TABLE public.attendance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id uuid NOT NULL REFERENCES public.youth_registrations(id) ON DELETE CASCADE,
  check_in_at timestamptz NOT NULL DEFAULT now(),
  check_in_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create unique constraint to prevent double check-in on same day
CREATE UNIQUE INDEX attendance_one_per_day ON public.attendance_records (registration_id, check_in_date);

-- Enable RLS
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;

-- RLS: Anyone can insert (kiosk self-service)
CREATE POLICY "Anyone can check in" ON public.attendance_records FOR INSERT WITH CHECK (true);

-- RLS: Admins can view all attendance
CREATE POLICY "Admins can view all attendance" ON public.attendance_records FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS: Admins can delete attendance
CREATE POLICY "Admins can delete attendance" ON public.attendance_records FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS: Admins can update attendance
CREATE POLICY "Admins can update attendance" ON public.attendance_records FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS for is_bald_eagle: already covered by existing youth_registrations policies (admin-only update/select)
