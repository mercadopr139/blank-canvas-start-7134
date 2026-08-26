// geocode-youth — turns each youth's child_primary_address into lat/long using
// the free US Census geocoder (no API key), so the Youth-per-District map can
// plot real locations. Admin-gated. Processes a capped batch per call and is
// re-runnable (the client loops until `remaining` hits 0).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.94.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
const SUPER_ADMIN_EMAIL = "joshmercado@nolimitsboxingacademy.org";
const BATCH = 75;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// Geocode one address → { lat, lng } or null. Appends ", NJ" if no state hint.
async function geocode(address: string): Promise<{ lat: number; lng: number } | null> {
  let addr = address.trim();
  if (!/\bNJ\b|New Jersey/i.test(addr)) addr += ", NJ";
  const url = `https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?address=${encodeURIComponent(addr)}&benchmark=Public_AR_Current&format=json`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const m = data?.result?.addressMatches?.[0]?.coordinates;
    if (m && typeof m.x === "number" && typeof m.y === "number") return { lat: m.y, lng: m.x };
    return null;
  } catch {
    return null;
  }
}

// Run tasks with limited concurrency.
async function pool<T>(items: T[], limit: number, fn: (t: T) => Promise<void>) {
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) { const idx = i++; await fn(items[idx]); }
  });
  await Promise.all(workers);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const authed = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: claimsData, error: claimsError } = await authed.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (claimsError || !claimsData?.claims) return json({ error: "Unauthorized" }, 401);
    const email = String(claimsData.claims.email ?? "").toLowerCase();
    const uid = String(claimsData.claims.sub ?? "");

    const service = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    let isAdmin = email === SUPER_ADMIN_EMAIL;
    if (!isAdmin && uid) {
      const { data: role } = await service.from("user_roles").select("role").eq("user_id", uid).eq("role", "admin").maybeSingle();
      isAdmin = !!role;
    }
    if (!isAdmin) return json({ error: "Admin access required." }, 403);

    // Optional: caller can force a full re-geocode of everything.
    const body = await req.json().catch(() => ({}));
    if (body?.reset === true) {
      await service.from("youth_registrations").update({ latitude: null, longitude: null, geocoded_at: null }).not("id", "is", null);
    }

    // Grab a batch of not-yet-attempted rows with an address.
    const { data: rows } = await service
      .from("youth_registrations")
      .select("id, child_primary_address")
      .is("latitude", null)
      .is("geocoded_at", null)
      .not("child_primary_address", "is", null)
      .limit(BATCH);

    let matched = 0;
    const list = (rows ?? []).filter((r: any) => (r.child_primary_address ?? "").trim().length > 3);

    await pool(list, 6, async (r: any) => {
      const coords = await geocode(r.child_primary_address);
      const patch: Record<string, unknown> = { geocoded_at: new Date().toISOString() };
      if (coords) { patch.latitude = coords.lat; patch.longitude = coords.lng; matched++; }
      await service.from("youth_registrations").update(patch).eq("id", r.id);
    });

    // How many still need geocoding after this batch.
    const { count: remaining } = await service
      .from("youth_registrations")
      .select("id", { count: "exact", head: true })
      .is("latitude", null).is("geocoded_at", null).not("child_primary_address", "is", null);

    return json({ processed: list.length, matched, unmatched: list.length - matched, remaining: remaining ?? 0 });
  } catch (e) {
    console.error("geocode-youth error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
