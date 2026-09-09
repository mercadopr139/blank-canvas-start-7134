// geocode-youth — turns each youth's child_primary_address into lat/long so the
// Youth-per-District map can plot real locations. Admin-gated. Processes a
// capped batch per call and is re-runnable (the client loops until `remaining`
// hits 0).
//
// TWO GEOCODERS, IN ORDER, because the addresses arrive in two formats.
//
// The registration form's address field autocompletes from OpenStreetMap's
// Nominatim and saves its verbose display_name — "12, West Dunbar Street,
// Whitesboro, Middle Township, Cape May County, New Jersey, 08210, United
// States". The US Census geocoder cannot read that shape, so for a year the map
// located only the addresses a parent had typed by hand. Nominatim resolves its
// own strings without fail and reads most hand-typed ones too; the Census
// geocoder reads hand-typed ones Nominatim misses (a "Route 9 South" with a
// unit number). So: Nominatim first, Census second.
//
// A FENCE, because Nominatim is too willing. Given "9 East Ontario Street" with
// no town it cheerfully answered Chicago. Results more than ~150 miles from
// Cape May are refused — far enough to keep the youth who live in Bucks County
// or Wilmington, near enough to drop a different state's street of the same
// name.
//
// FAILURES CAN BE RETRIED. The first version stamped geocoded_at on a failed
// lookup and then excluded stamped rows from the batch, so a failure was
// permanent and "Locate addresses" would report 0 left while 59 sat unlocated.
// The batch now takes any row without coordinates, never-tried first.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.94.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
const SUPER_ADMIN_EMAIL = "joshmercado@nolimitsboxingacademy.org";

// Nominatim's usage policy is one request a second with a real User-Agent, and
// the lookups run one after another to honour it. Forty at ~1.5 s each keeps a
// batch well inside the function's wall-clock limit; the client loops for more.
const BATCH = 40;
const NOMINATIM_GAP_MS = 1100;
const USER_AGENT = "NLA-youth-map/1.0 (joshmercado@nolimitsboxingacademy.org)";

// Cape May Court House, and how far from it an answer may be.
const HOME = { lat: 39.08, lng: -74.82 };
const MAX_KM = 250;
// A preference box for Nominatim (South Jersey, plus a margin), not a hard bound.
const VIEWBOX = "-75.7,40.4,-73.9,38.7";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const kmBetween = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
};

type Point = { lat: number; lng: number };

/** OpenStreetMap. Reads the form's own strings, and most typed ones. */
async function nominatim(address: string): Promise<Point | null> {
  const url =
    `https://nominatim.openstreetmap.org/search?format=json&countrycodes=us&limit=1` +
    `&viewbox=${VIEWBOX}&q=${encodeURIComponent(address.trim())}`;
  try {
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT, "Accept-Language": "en" } });
    if (!res.ok) return null;
    const data = await res.json();
    const m = data?.[0];
    if (!m) return null;
    const p = { lat: Number(m.lat), lng: Number(m.lon) };
    if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng)) return null;
    // The fence. A street with no town must not land in another state.
    if (kmBetween(HOME, p) > MAX_KM) return null;
    return p;
  } catch {
    return null;
  }
}

/** US Census. No key, no rate limit to speak of, and good at typed addresses. */
async function census(address: string): Promise<Point | null> {
  let addr = address.trim();
  if (!/\bNJ\b|New Jersey|\bPA\b|Pennsylvania|\bDE\b|Delaware/i.test(addr)) addr += ", NJ";
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

/** PO boxes and bare emails will never geocode; do not spend a lookup on them. */
const hopeless = (address: string) =>
  /^\s*p\.?\s*o\.?\s*box\b/i.test(address) || /@/.test(address) || address.trim().length <= 3;

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

    // Anything without coordinates, never-tried first, then earlier failures —
    // so a click always makes progress and a past failure is not forever.
    const { data: rows } = await service
      .from("youth_registrations")
      .select("id, child_primary_address")
      .is("latitude", null)
      .not("child_primary_address", "is", null)
      .order("geocoded_at", { ascending: true, nullsFirst: true })
      .limit(BATCH);

    const list = (rows ?? []).filter((r: { child_primary_address?: string }) => (r.child_primary_address ?? "").trim().length > 0);

    let matched = 0;
    let skipped = 0;
    for (const r of list as Array<{ id: string; child_primary_address: string }>) {
      const address = r.child_primary_address;
      const patch: Record<string, unknown> = { geocoded_at: new Date().toISOString() };

      if (hopeless(address)) {
        skipped++;
      } else {
        let coords = await nominatim(address);
        await sleep(NOMINATIM_GAP_MS);
        if (!coords) coords = await census(address);
        if (coords) {
          patch.latitude = coords.lat;
          patch.longitude = coords.lng;
          matched++;
        }
      }
      await service.from("youth_registrations").update(patch).eq("id", r.id);
    }

    // Never-tried rows still waiting. Earlier failures are not counted here —
    // they are retried on the next click, not looped on forever.
    const { count: remaining } = await service
      .from("youth_registrations")
      .select("id", { count: "exact", head: true })
      .is("latitude", null).is("geocoded_at", null).not("child_primary_address", "is", null);

    return json({
      processed: list.length,
      matched,
      unmatched: list.length - matched,
      skipped,
      remaining: remaining ?? 0,
    });
  } catch (e) {
    console.error("geocode-youth error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
