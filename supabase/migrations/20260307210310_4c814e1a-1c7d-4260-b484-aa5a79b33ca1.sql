
-- Drop existing attendance_records policies and recreate with explicit roles
DROP POLICY IF EXISTS "Anyone can check in" ON public.attendance_records;
DROP POLICY IF EXISTS "Admins can view all attendance" ON public.attendance_records;
DROP POLICY IF EXISTS "Admins can delete attendance" ON public.attendance_records;
DROP POLICY IF EXISTS "Admins can update attendance" ON public.attendance_records;

-- Kiosk: allow anon inserts only
CREATE POLICY "Kiosk users can check in" ON public.attendance_records
FOR INSERT TO anon
WITH CHECK (true);

-- Authenticated admins: full access
CREATE POLICY "Admins can view all attendance" ON public.attendance_records
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert attendance" ON public.attendance_records
FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update attendance" ON public.attendance_records
FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete attendance" ON public.attendance_records
FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));
