-- Practice Plan categories (Josh, 2026-10-20): a category typed once into
-- "Something else…" stays a chip from then on, in the template and the week.
-- The built-in chips (Boxing, Strength, …) live in code; this table holds
-- the ones Josh adds. Admins add and forget them; the wall board reads them.
CREATE TABLE IF NOT EXISTS public.practice_categories (
  name       text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
ALTER TABLE public.practice_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Board reads categories" ON public.practice_categories;
CREATE POLICY "Board reads categories" ON public.practice_categories
  FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS practice_categories_admin_insert ON public.practice_categories;
CREATE POLICY practice_categories_admin_insert ON public.practice_categories
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS practice_categories_admin_delete ON public.practice_categories;
CREATE POLICY practice_categories_admin_delete ON public.practice_categories
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

NOTIFY pgrst, 'reload schema';
SELECT 'Practice categories ready' AS result;
