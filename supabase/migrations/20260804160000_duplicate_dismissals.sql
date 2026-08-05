-- ═══════════════════════════════════════════════════════════════════
-- Duplicate dismissals — "these are NOT the same kid" (e.g. twins)
-- ═══════════════════════════════════════════════════════════════════
-- The duplicate detector groups by birthday + last name, which correctly
-- catches shortened/misspelled names — but also flags TWINS (same birthday,
-- same last name, different first names). This table lets an admin permanently
-- mark a specific set of registrations as "not a duplicate" so it stops showing
-- up in the Duplicate Registrations list and the inline "Possible dup" badge.
--
-- `group_key` is the sorted, '|'-joined set of registration IDs in the group.
-- If a NEW registration later joins that birthday+last-name group, the id set
-- (and therefore the key) changes, so the group re-surfaces for a fresh review
-- — a dismissal only silences the exact set of registrations that was reviewed.
--
-- Additive + idempotent.
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.duplicate_dismissals (
  id           UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_key    TEXT NOT NULL UNIQUE,
  reg_ids      UUID[] NOT NULL,
  dismissed_by UUID REFERENCES auth.users(id),
  created_at   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.duplicate_dismissals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view duplicate dismissals" ON public.duplicate_dismissals;
CREATE POLICY "Admins can view duplicate dismissals" ON public.duplicate_dismissals
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins can insert duplicate dismissals" ON public.duplicate_dismissals;
CREATE POLICY "Admins can insert duplicate dismissals" ON public.duplicate_dismissals
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins can delete duplicate dismissals" ON public.duplicate_dismissals;
CREATE POLICY "Admins can delete duplicate dismissals" ON public.duplicate_dismissals
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));
