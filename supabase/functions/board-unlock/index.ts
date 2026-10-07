// board-unlock — a four-digit code unlocks the coach buttons on a wall board.
//
// The TV is never signed in. When a coach taps Edit tonight and types the
// code, this signs the board in as the dedicated "Gym Board" account and
// hands the session back; the board signs itself out again on Done editing
// or after fifteen quiet minutes (src/hooks/useBoardSession.ts).
//
// The Gym Board account is a real person in Staff Management -- "Gym Board",
// with the Admin switch on, because the wall's edits go through the same
// database rules as any admin's. Josh can switch it off there at any time
// and the code stops working. The account is created here on first use.
//
// Secrets: BOARD_PIN, BOARD_COACH_EMAIL, BOARD_COACH_PASSWORD.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const PIN = Deno.env.get("BOARD_PIN");
    const EMAIL = Deno.env.get("BOARD_COACH_EMAIL");
    const PASSWORD = Deno.env.get("BOARD_COACH_PASSWORD");
    if (!PIN || !EMAIL || !PASSWORD) return json({ error: "The board code is not set up yet." }, 500);

    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const pin = String(body?.pin ?? "").trim();
    if (pin !== PIN) { await sleep(800); return json({ error: "That code isn't right." }, 401); }

    const url = Deno.env.get("SUPABASE_URL")!;
    const service = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

    // The Gym Board account, created the first time the code is used.
    let userId: string | null = null;
    const { data: list } = await service.auth.admin.listUsers({ page: 1, perPage: 1000 });
    userId = list?.users.find((u) => (u.email ?? "").toLowerCase() === EMAIL.toLowerCase())?.id ?? null;
    if (!userId) {
      const { data: created, error: createError } = await service.auth.admin.createUser({
        email: EMAIL, password: PASSWORD, email_confirm: true, user_metadata: { full_name: "Gym Board" },
      });
      if (createError || !created.user) throw new Error(createError?.message ?? "Couldn't create the board account.");
      userId = created.user.id;
    }

    // A person in Staff Management, with the Admin switch on (the trigger
    // turns that into the admin role the database rules check).
    await service.from("staff_profiles").upsert(
      { user_id: userId, full_name: "Gym Board", email: EMAIL, job_title: "Wall board (code unlock)", status: "active" },
      { onConflict: "user_id" },
    );
    const { data: perm } = await service.from("staff_permissions").select("id, granted").eq("user_id", userId).eq("permission_key", "access_admin").maybeSingle();
    if (!perm) await service.from("staff_permissions").insert({ user_id: userId, permission_key: "access_admin", granted: true });
    else if (!perm.granted) await service.from("staff_permissions").update({ granted: true }).eq("id", perm.id);

    // Sign the board in and hand the session back.
    const anon = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { auth: { persistSession: false } });
    const { data: signed, error: signError } = await anon.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
    if (signError || !signed.session) {
      // Staff Management may have switched the account off, or the account was removed.
      return json({ error: "The board account can't sign in. Check Gym Board in Staff Management." }, 403);
    }
    return json({ access_token: signed.session.access_token, refresh_token: signed.session.refresh_token });
  } catch (e) {
    console.error("board-unlock error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
