// hard75-access — everything the invite link can do.
//
// The participant has no account and must never reach the admin backend. He has
// a token in a URL and a PIN he set himself. This function is the only thing
// that token can talk to: it validates it server-side with the service role and
// only ever touches the one run it belongs to.
//
// Nothing here trusts the caller for anything but the token, the PIN and a day
// id that has to belong to that run. No table access is granted to the browser.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const sha256 = async (s: string) => {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
};

/** Constant-time-ish compare, so a wrong PIN can't be timed out character by character. */
const sameHash = (a: string, b: string) => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
};

const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

/** Only these columns ever go to the browser. Never the token or the PIN hash. */
const RUN_FIELDS =
  "id, participant, age, limitations, goal, start_date, status, failed_on_day, restarted_from, created_at";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return json({ error: "Server is not configured." }, 500);

  const db = createClient(url, serviceKey, { auth: { persistSession: false } });

  try {
    const body = await req.json();
    const token = String(body?.token ?? "").trim();
    const action = String(body?.action ?? "").trim();
    const pin = String(body?.pin ?? "").trim();

    if (token.length < 20) return json({ error: "That link isn't valid." }, 404);

    const { data: runRow } = await db
      .from("hard75_runs")
      .select("*")
      .eq("access_token", token)
      .maybeSingle();

    if (!runRow) return json({ error: "That link isn't valid." }, 404);

    const hasPin = !!runRow.access_pin_hash;
    const locked =
      runRow.pin_locked_until && new Date(runRow.pin_locked_until).getTime() > Date.now();

    // ── What the link looks like before you're through the PIN ──
    if (action === "peek") {
      return json({
        needsPin: hasPin,
        needsSetup: runRow.status === "pending",
        participant: runRow.participant,
        locked: !!locked,
      });
    }

    // ── Setting the PIN, once ──
    if (action === "set_pin") {
      if (hasPin) return json({ error: "A PIN is already set for this link." }, 409);
      if (!/^\d{4,8}$/.test(pin)) return json({ error: "Choose 4 to 8 digits." }, 400);
      await db
        .from("hard75_runs")
        .update({ access_pin_hash: await sha256(`${token}:${pin}`), pin_attempts: 0 })
        .eq("id", runRow.id);
      return json({ ok: true });
    }

    // ── Everything else needs the PIN, once one exists ──
    if (hasPin) {
      if (locked) {
        return json({ error: "Too many wrong PINs. Try again in a few minutes." }, 429);
      }
      const ok = sameHash(runRow.access_pin_hash, await sha256(`${token}:${pin}`));
      if (!ok) {
        const attempts = (runRow.pin_attempts ?? 0) + 1;
        await db
          .from("hard75_runs")
          .update({
            pin_attempts: attempts,
            pin_locked_until:
              attempts >= MAX_ATTEMPTS
                ? new Date(Date.now() + LOCK_MINUTES * 60_000).toISOString()
                : null,
          })
          .eq("id", runRow.id);
        return json({ error: "Wrong PIN." }, 401);
      }
      if (runRow.pin_attempts) {
        await db
          .from("hard75_runs")
          .update({ pin_attempts: 0, pin_locked_until: null })
          .eq("id", runRow.id);
      }
    }

    const runId = runRow.id as string;

    /** A day id is only ever accepted if it belongs to THIS run. */
    const ownsDay = async (dayId: string) => {
      const { data } = await db
        .from("hard75_days")
        .select("id")
        .eq("id", dayId)
        .eq("run_id", runId)
        .maybeSingle();
      return !!data;
    };

    switch (action) {
      case "get": {
        await db
          .from("hard75_runs")
          .update({ last_opened_at: new Date().toISOString() })
          .eq("id", runId);
        const { data: run } = await db
          .from("hard75_runs").select(RUN_FIELDS).eq("id", runId).single();
        const { data: days } = await db
          .from("hard75_days").select("*").eq("run_id", runId).order("day_number");
        return json({ run, days: days ?? [] });
      }

      // The participant fills in his own details and picks his own start date.
      // The 75 days are written here, server-side, from the same generator the
      // admin app uses — the browser never gets to invent the plan.
      case "setup": {
        if (runRow.status !== "pending") {
          return json({ error: "This one is already going." }, 409);
        }
        const plan = body?.plan;
        if (!Array.isArray(plan) || plan.length !== 75) {
          return json({ error: "The plan didn't come through. Reload and try again." }, 400);
        }
        const startDate = String(body?.startDate ?? "").trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
          return json({ error: "Pick a start date." }, 400);
        }

        await db
          .from("hard75_runs")
          .update({
            participant: String(body?.participant ?? runRow.participant).trim().slice(0, 80),
            age: body?.age ? Number(body.age) : null,
            goal: String(body?.goal ?? "").trim().slice(0, 300) || null,
            limitations: String(body?.limitations ?? "").trim().slice(0, 600) || null,
            start_date: startDate,
            status: "active",
          })
          .eq("id", runId);

        await db.from("hard75_days").delete().eq("run_id", runId);
        const { error } = await db.from("hard75_days").insert(
          plan.map((d: Record<string, unknown>) => ({
            run_id: runId,
            day_number: d.day_number,
            date: d.date,
            strength: d.strength,
            cardio: d.cardio,
          }))
        );
        if (error) throw error;
        return json({ ok: true });
      }

      case "update_day": {
        const dayId = String(body?.dayId ?? "");
        if (!(await ownsDay(dayId))) return json({ error: "Not your day." }, 403);

        // Only these keys can be written from a link. The workouts and the
        // checklist, and nothing structural.
        const allowed = [
          "strength_done", "cardio_done", "outdoor_done",
          "water_done", "reading_done", "diet_done",
          "photo_path", "weight_lb", "notes", "strength", "cardio",
          "strength_seconds", "strength_started_at",
          "cardio_seconds", "cardio_started_at",
        ];
        const patch: Record<string, unknown> = {};
        for (const k of allowed) {
          if (body?.patch && k in body.patch) patch[k] = body.patch[k];
        }
        if (Object.keys(patch).length === 0) return json({ error: "Nothing to change." }, 400);

        const { error } = await db.from("hard75_days").update(patch).eq("id", dayId);
        if (error) throw error;
        return json({ ok: true });
      }

      // The browser uploads straight to storage with a one-shot signed URL, so
      // the photo never passes through this function.
      case "photo_upload_url": {
        const dayId = String(body?.dayId ?? "");
        if (!(await ownsDay(dayId))) return json({ error: "Not your day." }, 403);
        const path = String(body?.path ?? "");
        if (!path.startsWith(`${runId}/`)) return json({ error: "Bad path." }, 400);
        const { data, error } = await db.storage
          .from("hard75-photos")
          .createSignedUploadUrl(path, { upsert: true });
        if (error) throw error;
        return json({ signedUrl: data?.signedUrl, token: data?.token, path });
      }

      case "photo_urls": {
        const paths: string[] = Array.isArray(body?.paths) ? body.paths : [];
        const mine = paths.filter((p) => typeof p === "string" && p.startsWith(`${runId}/`));
        if (mine.length === 0) return json({ urls: {} });
        const { data, error } = await db.storage
          .from("hard75-photos")
          .createSignedUrls(mine, 3600);
        if (error) throw error;
        const urls: Record<string, string> = {};
        (data ?? []).forEach((r) => { if (r.path && r.signedUrl) urls[r.path] = r.signedUrl; });
        return json({ urls });
      }

      case "photo_delete": {
        const path = String(body?.path ?? "");
        if (!path.startsWith(`${runId}/`)) return json({ error: "Bad path." }, 400);
        await db.storage.from("hard75-photos").remove([path]);
        return json({ ok: true });
      }

      default:
        return json({ error: "Unknown action." }, 400);
    }
  } catch (e: unknown) {
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
