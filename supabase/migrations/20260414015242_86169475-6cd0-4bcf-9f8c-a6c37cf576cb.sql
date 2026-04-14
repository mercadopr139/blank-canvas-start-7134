-- Remove the dangerously permissive UPDATE policies for anon/public on youth_registrations
DROP POLICY IF EXISTS "Kiosk can update headshot" ON public.youth_registrations;
DROP POLICY IF EXISTS "Kiosk can update headshot URL" ON public.youth_registrations;

-- Add RLS policies on realtime.messages to restrict channel subscriptions to admins
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins can access realtime messages"
ON realtime.messages
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Only admins can insert realtime messages"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));