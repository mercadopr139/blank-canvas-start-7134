-- Daily Duties: the scrolling message along the bottom of the board
-- (Josh, 2026-10-26): "Don't forget to RESTOCK toilet paper". One message,
-- always at the foot of the board while it has words; a coach changes it
-- any time, even halfway through clean-up. Empty = no banner.
--
-- The wall TV reads it without a login (it holds no personal data). Writing
-- needs a signed-in admin: a coach's phone, or the board after the coach
-- code (CoachUnlock), the same rule as Special Projects.
CREATE TABLE IF NOT EXISTS public.duty_board_message (
  id          smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  message     text NOT NULL DEFAULT '',
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
INSERT INTO public.duty_board_message (id, message) VALUES (1, '') ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.duty_board_message ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Board reads the duty message" ON public.duty_board_message;
CREATE POLICY "Board reads the duty message"
  ON public.duty_board_message FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins change the duty message" ON public.duty_board_message;
CREATE POLICY "Admins change the duty message"
  ON public.duty_board_message FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
