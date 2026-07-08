-- ═══════════════════════════════════════════════════════════════════
-- Excursion Sign-Ups (pre-trip invite / roster planning)
-- ═══════════════════════════════════════════════════════════════════
-- Before excursion day, a coordinator (e.g. Chrissy) builds the invite
-- list: pick an excursion, set a loose target capacity, add youth from
-- the youth bucket, and work each one through
--   pending → invited → confirmed   (with a quiet "declined" bucket).
--
-- This is an ADMIN-ONLY planning tool (used signed-in on the iPad in the
-- admin area), so it uses normal RLS admin policies + direct table
-- access — no anonymous SECURITY DEFINER RPCs like the kiosk needs.
--
-- On excursion day, the "confirmed" list is exactly who you expect at
-- the check-in kiosk. Sign-ups do NOT check anyone in — the kiosk still
-- records actual attendance independently.

BEGIN;

-- Loose target headcount for the trip (nullable = no target set).
ALTER TABLE public.excursions
  ADD COLUMN IF NOT EXISTS target_capacity integer;

-- One row per youth invited to / requesting a given excursion.
CREATE TABLE IF NOT EXISTS public.excursion_signups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  excursion_id uuid NOT NULL REFERENCES public.excursions(id) ON DELETE CASCADE,
  registration_id uuid NOT NULL REFERENCES public.youth_registrations(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'invited', 'confirmed', 'declined')),
  notes text,
  parent_contacted_at timestamptz,          -- stamped when the coordinator reaches out
  added_by text,                            -- email of the admin who added them
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (excursion_id, registration_id)    -- a youth appears once per excursion
);

CREATE INDEX IF NOT EXISTS idx_excursion_signups_excursion_id
  ON public.excursion_signups(excursion_id);
CREATE INDEX IF NOT EXISTS idx_excursion_signups_registration_id
  ON public.excursion_signups(registration_id);

ALTER TABLE public.excursion_signups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view excursion_signups" ON public.excursion_signups
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can insert excursion_signups" ON public.excursion_signups
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can update excursion_signups" ON public.excursion_signups
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can delete excursion_signups" ON public.excursion_signups
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));

COMMIT;
