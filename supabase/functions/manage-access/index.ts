// Access management that needs the keys to the login system itself: listing
// every login that exists, and removing a person.
//
// Callable by the access manager only (see _shared/superAdmins.ts). Everyone
// else gets a 403, whatever role they hold.
//
//   { action: "list" }
//     Every login, with its role, whether it has a staff card, whether its
//     email is on the sign-up allowlist, and when it last signed in. This is
//     how Staff Management shows accounts that never got a staff card.
//
//   { action: "remove", user_id }   or   { action: "remove", email }
//     Takes a person out: admin role gone, every checkbox gone, off the
//     allowlist, login blocked for good, staff card marked removed. Nothing
//     they wrote is deleted, and their name stays on it. Each step is
//     reversible from the SQL Editor; no row of theirs is destroyed.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isAccessManager } from "../_shared/superAdmins.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// A ban this long is "for good"; it can still be lifted by hand.
const BAN_FOR_GOOD = "876000h";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Who is calling: ask the login system, not the caller.
    const { data: callerData, error: callerError } = await admin.auth.getUser(authHeader.replace("Bearer ", ""));
    const caller = callerData?.user;
    if (callerError || !caller) return json({ error: "Unauthorized" }, 401);
    if (!isAccessManager(caller.email)) return json({ error: "Only the access manager can do this." }, 403);

    const body = await req.json().catch(() => ({}));
    const action = body?.action;

    // ── list ──────────────────────────────────────────────────────────────
    if (action === "list") {
      const { data: listData, error: listError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      if (listError) return json({ error: listError.message }, 500);

      const [{ data: roles }, { data: profiles }, { data: allow }] = await Promise.all([
        admin.from("user_roles").select("user_id, role"),
        admin.from("staff_profiles").select("user_id, removed_at"),
        admin.from("admin_allowlist").select("email"),
      ]);
      const rolesBy = new Map<string, string[]>();
      (roles ?? []).forEach((r: { user_id: string; role: string }) => {
        rolesBy.set(r.user_id, [...(rolesBy.get(r.user_id) ?? []), r.role]);
      });
      const cardBy = new Map<string, { removed_at: string | null }>();
      (profiles ?? []).forEach((p: { user_id: string; removed_at: string | null }) => cardBy.set(p.user_id, p));
      const allowed = new Set((allow ?? []).map((a: { email: string }) => a.email.toLowerCase()));

      const users = listData?.users ?? [];
      const accounts = users.map((u) => {
        const bannedUntil = (u as unknown as { banned_until?: string | null }).banned_until ?? null;
        return {
          user_id: u.id,
          email: u.email ?? "",
          roles: rolesBy.get(u.id) ?? [],
          has_card: cardBy.has(u.id),
          removed: !!cardBy.get(u.id)?.removed_at,
          on_allowlist: allowed.has((u.email ?? "").toLowerCase()),
          last_sign_in_at: u.last_sign_in_at ?? null,
          created_at: u.created_at,
          blocked: !!bannedUntil && new Date(bannedUntil).getTime() > Date.now(),
        };
      });
      // Emails that would become an admin the moment they sign up.
      const haveLogin = new Set(users.map((u) => (u.email ?? "").toLowerCase()));
      const waiting = [...allowed].filter((e) => !haveLogin.has(e));
      return json({ accounts, allowlist_without_login: waiting });
    }

    // ── remove ────────────────────────────────────────────────────────────
    if (action === "remove") {
      const wantId = typeof body.user_id === "string" ? body.user_id : null;
      const wantEmail = typeof body.email === "string" ? body.email.toLowerCase().trim() : null;
      if (!wantId && !wantEmail) return json({ error: "Say who: user_id or email." }, 400);

      let targetId: string | null = wantId;
      let targetEmail: string | null = wantEmail;
      if (targetId) {
        const { data: t, error: tErr } = await admin.auth.admin.getUserById(targetId);
        if (tErr || !t?.user) return json({ error: "No login with that id." }, 404);
        targetEmail = (t.user.email ?? "").toLowerCase();
      } else if (targetEmail) {
        const { data: listData } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
        targetId = listData?.users?.find((u) => (u.email ?? "").toLowerCase() === targetEmail)?.id ?? null;
      }

      if (targetId === caller.id || isAccessManager(targetEmail)) {
        return json({ error: "The access manager cannot be removed." }, 400);
      }

      const steps: Record<string, string> = {};
      const run = async (name: string, fn: () => Promise<{ error: { message: string } | null }>) => {
        const { error } = await fn();
        steps[name] = error ? `failed: ${error.message}` : "done";
      };

      if (targetId) {
        const id = targetId;
        await run("role", () => admin.from("user_roles").delete().eq("user_id", id));
        await run("checkboxes", () => admin.from("staff_permissions").delete().eq("user_id", id));
        await run("staff_card", () =>
          admin.from("staff_profiles")
            .update({ status: "inactive", removed_at: new Date().toISOString(), task_manager_type: null, is_super_admin: false })
            .eq("user_id", id));
        await run("login_blocked", async () => {
          const { error } = await admin.auth.admin.updateUserById(id, { ban_duration: BAN_FOR_GOOD });
          return { error };
        });
      }
      if (targetEmail) {
        const email = targetEmail;
        await run("allowlist", () => admin.from("admin_allowlist").delete().eq("email", email));
      }

      // The log is a courtesy; a missing table must not undo a removal.
      await admin.from("access_log").insert({
        actor_email: caller.email,
        action: "remove",
        target_email: targetEmail,
        detail: { user_id: targetId, steps },
      });

      const failed = Object.entries(steps).filter(([, v]) => v !== "done");
      // The role and the login block are the two that take access away.
      const critical = failed.filter(([k]) => k === "role" || k === "login_blocked");
      if (critical.length > 0) return json({ error: "Removal did not finish.", steps }, 500);
      return json({ success: true, email: targetEmail, steps });
    }

    return json({ error: "Unknown action." }, 400);
  } catch (err) {
    console.error("manage-access error:", err);
    return json({ error: "Internal server error" }, 500);
  }
});
