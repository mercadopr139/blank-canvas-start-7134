// The Practice Plan's category chips: the built-in ones from code plus the
// ones Josh has added (practice_categories). Typed once into "Something
// else…", a category stays a choice (Josh, 2026-10-20). Admins add and
// forget; the wall board only reads.
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { QUICK_BLOCKS } from "@/lib/practicePlan";

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export const usePracticeCategories = () => {
  const qc = useQueryClient();
  const { data: custom = [] } = useQuery({
    queryKey: ["practice-categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("practice_categories" as never).select("name").order("created_at");
      if (error) throw error;
      return ((data ?? []) as unknown as { name: string }[]).map((r) => r.name);
    },
    staleTime: 5 * 60 * 1000,
  });
  const chips = [...QUICK_BLOCKS, ...custom.filter((c) => !QUICK_BLOCKS.some((q) => same(q, c)))];
  const isCustom = (name: string) => custom.some((c) => same(c, name));
  const isKnown = (name: string) => chips.some((c) => same(c, name));
  const refresh = () => qc.invalidateQueries({ queryKey: ["practice-categories"] });

  /** Keep a typed category as a chip. Quiet if it is already one. Returns an error message or null. */
  const add = async (name: string): Promise<string | null> => {
    const v = name.trim();
    if (!v || isKnown(v)) return null;
    const { error } = await supabase.from("practice_categories" as never).insert({ name: v } as never);
    if (error) return error.message;
    refresh();
    return null;
  };
  /** Forget a custom chip. Blocks already using the name keep it. */
  const remove = async (name: string): Promise<string | null> => {
    const { error } = await supabase.from("practice_categories" as never).delete().eq("name", name);
    if (error) return error.message;
    refresh();
    return null;
  };
  return { chips, custom, isCustom, add, remove };
};
