// Who may call an app's function? An Admin always; a Staff person when they
// hold a box that app belongs to (Josh, 2026-10-20: every box opens its
// app). The question is asked of the database AS THE CALLER, through
// has_app(), so it is their own card that answers — a deactivated or removed
// person gets no, and the function never has to read user_roles itself.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/** True when the caller holds any of these boxes (or is an Admin — has_app says yes for Admins too). */
export const holdsBox = async (req: Request, keys: string[]): Promise<boolean> => {
  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return false;
  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !anon) return false;
  const asCaller = createClient(url, anon, { auth: { persistSession: false }, global: { headers: { Authorization: auth } } });
  for (const key of keys) {
    const { data, error } = await asCaller.rpc("has_app", { _key: key });
    if (!error && data === true) return true;
  }
  return false;
};
