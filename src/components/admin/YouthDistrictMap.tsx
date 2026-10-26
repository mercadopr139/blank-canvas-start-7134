import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { MapPin, Loader2, LocateFixed, Pencil, Check, X } from "lucide-react";
import ChildPrimaryAddressField, { type AddressPin } from "@/components/registration/ChildPrimaryAddressField";
import { addressProblem } from "@/lib/address";
import { toast } from "sonner";
import { capeMayGeo } from "@/data/capeMayGeo";
import YouthStreetMap, { type StreetPoint } from "@/components/admin/YouthStreetMap";
import { DISTRICT_MAP, GROUP_COLOR, type GroupKey } from "@/lib/districtGroups";

/*
  Youth Per School District — a real map of Cape May County with one dot per
  youth, placed inside the actual boundary of the school district they attend
  and colored by district group. Built for showing donors our reach at a glance.

  Data source: youth_registrations.child_school_district (a locked dropdown).
  Geography: official NJ GIS municipal boundaries (see src/data/capeMayGeo.ts).
*/

/* ── District groups: color + display label ── */

const GROUPS: Record<GroupKey, { name: string; sub: string; color: string; school?: boolean; offMap?: boolean }> = {
  // Colours come from src/lib/districtGroups.ts — the same ones the By School District circle uses.
  middle:    { name: "Middle Township",       sub: "incl. Dennis Twp",                     color: GROUP_COLOR.middle },
  wildwood:  { name: "Wildwood",              sub: "incl. Crest & N. Wildwood",            color: GROUP_COLOR.wildwood },
  lowercape: { name: "Lower Cape May",        sub: "Cape May, W. Cape May, Lower Twp",     color: GROUP_COLOR.lowercape },
  woodbine:  { name: "Woodbine",              sub: "",                                     color: GROUP_COLOR.woodbine },
  ocean:     { name: "Ocean City",            sub: "incl. Upper Twp",                      color: GROUP_COLOR.ocean },
  tech:      { name: "Cape May Tech",         sub: "county vocational school",             color: GROUP_COLOR.tech, school: true },
  catholic:  { name: "Wildwood Catholic",     sub: "private academy",                      color: GROUP_COLOR.catholic, school: true },
  avalon:    { name: "Avalon & Stone Harbor", sub: "",                                     color: GROUP_COLOR.avalon },
  home:      { name: "Homeschool / Other",    sub: "no fixed district",                    color: GROUP_COLOR.home, offMap: true },
};

/* Order groups appear in the legend */
const GROUP_ORDER: GroupKey[] = ["middle", "wildwood", "lowercape", "woodbine", "ocean", "tech", "catholic", "avalon", "home"];

/* ── Every school_district dropdown value → its group + the municipality
      polygon to scatter its dots into. mun:null => off-map tally. ── */
// The table lives in src/lib/districtGroups.ts, shared with the By School District chart.

/* Municipality → the geographic region color it should be tinted with */
const MUN_TINT: Record<string, string> = {
  "Cape May": GROUPS.lowercape.color, "West Cape May Borough": GROUPS.lowercape.color,
  "Cape May Point Borough": GROUPS.lowercape.color, "Lower Township": GROUPS.lowercape.color,
  "Ocean City": GROUPS.ocean.color, "Upper Township": GROUPS.ocean.color,
  "Middle Township": GROUPS.middle.color, "Dennis Township": GROUPS.middle.color,
  "Wildwood": GROUPS.wildwood.color, "Wildwood Crest Borough": GROUPS.wildwood.color,
  "North Wildwood": GROUPS.wildwood.color, "West Wildwood Borough": GROUPS.wildwood.color,
  "Woodbine Borough": GROUPS.woodbine.color,
  "Avalon Borough": GROUPS.avalon.color, "Stone Harbor Borough": GROUPS.avalon.color,
};

/* Member municipalities per geographic group (for label placement) */
const GEO_GROUP_MUNS: Partial<Record<GroupKey, string[]>> = {
  lowercape: ["Cape May", "West Cape May Borough", "Cape May Point Borough", "Lower Township"],
  ocean: ["Ocean City", "Upper Township"],
  middle: ["Middle Township", "Dennis Township"],
  wildwood: ["Wildwood", "Wildwood Crest Borough", "North Wildwood", "West Wildwood Borough"],
  woodbine: ["Woodbine Borough"],
  avalon: ["Avalon Borough", "Stone Harbor Borough"],
};

/* ── viewBox + inner draw box ── */
const VB_W = 640, VB_H = 860;
const BOX = { L: 56, R: 584, T: 54, B: 820 };

type Pt = { x: number; y: number };

/* ── geometry helpers (all in projected/SVG space) ── */
const ringArea = (pts: Pt[]) => {
  let a = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) a += pts[j].x * pts[i].y - pts[i].x * pts[j].y;
  return Math.abs(a) / 2;
};
const inRing = (pts: Pt[], x: number, y: number) => {
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const yi = pts[i].y, yj = pts[j].y, xi = pts[i].x, xj = pts[j].x;
    if (((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)) c = !c;
  }
  return c;
};
const ringCentroid = (pts: Pt[]): Pt => {
  let x = 0, y = 0, a = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const f = pts[j].x * pts[i].y - pts[i].x * pts[j].y;
    x += (pts[j].x + pts[i].x) * f; y += (pts[j].y + pts[i].y) * f; a += f;
  }
  a *= 0.5;
  return a ? { x: x / (6 * a), y: y / (6 * a) } : pts[0] || { x: 0, y: 0 };
};

const eachPoly = (geom: { type: string; coordinates: number[][][] | number[][][][] }, cb: (poly: number[][][]) => void) => {
  if (geom.type === "Polygon") cb(geom.coordinates as number[][][]);
  else if (geom.type === "MultiPolygon") (geom.coordinates as number[][][][]).forEach(cb);
};

/* ── Static geometry: projection + municipality paths + per-mun scatter ring.
      Depends only on the (constant) GeoJSON, so this runs once. ── */
function buildGeometry() {
  let minLng = 1e9, maxLng = -1e9, minLat = 1e9, maxLat = -1e9;
  capeMayGeo.features.forEach((f: { geometry: { type: string; coordinates: number[][][] | number[][][][] } }) =>
    eachPoly(f.geometry, (poly) => poly.forEach((ring) => ring.forEach(([lng, lat]) => {
      if (lng < minLng) minLng = lng; if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat; if (lat > maxLat) maxLat = lat;
    })))
  );
  const meanLat = (minLat + maxLat) / 2;
  const kx = Math.cos((meanLat * Math.PI) / 180);
  const rawW = (maxLng - minLng) * kx, rawH = maxLat - minLat;
  const scale = Math.min((BOX.R - BOX.L) / rawW, (BOX.B - BOX.T) / rawH);
  const ox = BOX.L + ((BOX.R - BOX.L) - rawW * scale) / 2;
  const oy = BOX.T + ((BOX.B - BOX.T) - rawH * scale) / 2;
  const P = (lng: number, lat: number): Pt => ({ x: ox + (lng - minLng) * kx * scale, y: oy + (maxLat - lat) * scale });

  const munPaths: { d: string; fill: string; fillOpacity: number; key: string }[] = [];
  const munIndex: Record<string, { ring: Pt[]; area: number; c: Pt }> = {};

  capeMayGeo.features.forEach((f: { properties: { NAME: string }; geometry: { type: string; coordinates: number[][][] | number[][][][] } }, idx: number) => {
    const name = f.properties.NAME;
    const tint = MUN_TINT[name];
    let d = "", biggest: Pt[] | null = null, bigArea = -1;
    eachPoly(f.geometry, (poly) => {
      poly.forEach((ring, ri) => {
        const pts = ring.map(([lng, lat]) => P(lng, lat));
        d += "M" + pts.map((p) => p.x.toFixed(1) + "," + p.y.toFixed(1)).join("L") + "Z";
        if (ri === 0) { const ar = ringArea(pts); if (ar > bigArea) { bigArea = ar; biggest = pts; } }
      });
    });
    munPaths.push({ d, fill: tint || "#202832", fillOpacity: tint ? 0.16 : 1, key: name + idx });
    if (biggest) munIndex[name] = { ring: biggest, area: bigArea, c: ringCentroid(biggest) };
  });

  return { munPaths, munIndex, P };
}

type YouthPoint = {
  latitude: number | null;
  longitude: number | null;
  child_school_district: string | null;
  // Optional: with these, the couldn't-locate panel can name the registration.
  id?: string;
  child_first_name?: string | null;
  child_last_name?: string | null;
  child_primary_address?: string | null;
  geocoded_at?: string | null;
};

export function YouthDistrictMap({ youth: youthProp }: { youth?: YouthPoint[] } = {}) {
  const queryClient = useQueryClient();
  const [geo, setGeo] = useState<{ running: boolean; done: number; remaining: number } | null>(null);
  const [view, setView] = useState<"district" | "street">("district");

  // If the parent passes filtered/deduped youth, use those; otherwise fetch all.
  const { data: fetched } = useQuery({
    queryKey: ["youth-district-map"],
    enabled: !youthProp,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("youth_registrations")
        .select("id, latitude, longitude, child_school_district, child_first_name, child_last_name, child_primary_address, geocoded_at");
      if (error) throw error;
      // latitude/longitude were added by migration after types.ts was generated.
      return data as unknown as YouthPoint[];
    },
  });
  const youth = youthProp ?? fetched ?? [];

  // The ones the geocoders gave up on, named so a person can fix the
  // registration — a PO box, an email typed into the address field, a street
  // with no town. Derived from the SAME cohort the map counts: the first
  // version ran its own query over the whole table and reported 68 against a
  // map that said 59, because it was counting other years and duplicates.
  // Only youth the map would actually plot count — a homeschooler with no
  // district is not "unlocated", just off-map by design.
  const unlocated = useMemo(
    () =>
      youth
        .filter((y) => {
          if (!y.geocoded_at || typeof y.latitude === "number" || !(y.child_primary_address ?? "").trim()) return false;
          const map = DISTRICT_MAP[y.child_school_district || "Other"] || { g: "home" as GroupKey, mun: null };
          return !!map.mun && !GROUPS[map.g].offMap;
        })
        .sort((a, b) => (a.child_last_name ?? "").localeCompare(b.child_last_name ?? "")),
    [youth]
  );

  const { munPaths, munIndex, P } = useMemo(buildGeometry, []);

  const { dots, labels, groupCounts, total, served, offMapCount, located, geocodable } = useMemo(() => {
    // seeded RNG so approximate dots + jitter stay put across re-renders
    let seed = 20260705;
    const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    const scatterInto = (ring: Pt[]): Pt => {
      let xmin = 1e9, xmax = -1e9, ymin = 1e9, ymax = -1e9;
      ring.forEach((p) => { if (p.x < xmin) xmin = p.x; if (p.x > xmax) xmax = p.x; if (p.y < ymin) ymin = p.y; if (p.y > ymax) ymax = p.y; });
      for (let t = 0; t < 250; t++) {
        const x = xmin + rnd() * (xmax - xmin), y = ymin + rnd() * (ymax - ymin);
        if (inRing(ring, x, y)) return { x, y };
      }
      return ringCentroid(ring);
    };

    const dots: { cx: number; cy: number; fill: string; key: string; real: boolean }[] = [];
    const groupCounts: Record<string, number> = {};
    let total = 0, offMapCount = 0, located = 0, geocodable = 0;

    youth.forEach((y, idx) => {
      total++;
      const district = y.child_school_district || "Other";
      const map = DISTRICT_MAP[district] || { g: "home" as GroupKey, mun: null };
      const group = GROUPS[map.g];
      groupCounts[map.g] = (groupCounts[map.g] || 0) + 1;
      if (!map.mun || group.offMap) { offMapCount++; return; } // no fixed town
      geocodable++;
      // Real address → plot at true location (tiny jitter for privacy).
      if (typeof y.latitude === "number" && typeof y.longitude === "number") {
        const p = P(y.longitude, y.latitude);
        const x = p.x + (rnd() - 0.5) * 4, yy = p.y + (rnd() - 0.5) * 4;
        if (x >= BOX.L - 8 && x <= BOX.R + 8 && yy >= BOX.T - 8 && yy <= BOX.B + 8) {
          dots.push({ cx: +x.toFixed(1), cy: +yy.toFixed(1), fill: group.color, key: "r" + idx, real: true });
          located++;
          return;
        }
      }
      // Not yet located → approximate scatter inside the district.
      const target = munIndex[map.mun];
      if (target) { const p = scatterInto(target.ring); dots.push({ cx: +p.x.toFixed(1), cy: +p.y.toFixed(1), fill: group.color, key: "s" + idx, real: false }); }
      else offMapCount++;
    });

    // A label normally sits at its towns' centre. The barrier-island groups are too
    // thin for a long name — "Avalon & Stone Harbor" spilled across Middle Township
    // and read as part of it — so theirs goes out in the ocean just east of the
    // island, on two lines, with a short line pointing back to it.
    const labels: { x: number; y: number; text: string; lines?: string[]; anchor?: "middle" | "start"; from?: { x: number; y: number } }[] = [];
    const OFFSHORE: Partial<Record<GroupKey, string[]>> = { avalon: ["Avalon &", "Stone Harbor"] };
    (Object.keys(GEO_GROUP_MUNS) as GroupKey[]).forEach((gk) => {
      if (!groupCounts[gk]) return;
      const members = (GEO_GROUP_MUNS[gk] || []).map((n) => munIndex[n]).filter(Boolean) as { ring: Pt[]; area: number; c: Pt }[];
      if (!members.length) return;
      let cx = 0, cy = 0, wa = 0;
      members.forEach((m) => { cx += m.c.x * m.area; cy += m.c.y * m.area; wa += m.area; });
      const at = { x: Math.round(cx / wa), y: Math.round(cy / wa) };
      const lines = OFFSHORE[gk];
      if (lines) {
        // East edge of the island at the label's height, plus a gap.
        const east = Math.max(...members.flatMap((m) => m.ring.map((p) => p.x)));
        labels.push({ x: Math.round(east + 14), y: at.y, text: GROUPS[gk].name, lines, anchor: "start", from: { x: Math.round(east - 4), y: at.y } });
      } else {
        labels.push({ ...at, text: GROUPS[gk].name });
      }
    });

    const served = GROUP_ORDER.filter((g) => g !== "home" && groupCounts[g] > 0).length;
    return { dots, labels, groupCounts, total, served, offMapCount, located, geocodable };
  }, [youth, munIndex, P]);

  const streetPoints = useMemo<StreetPoint[]>(() =>
    youth
      .filter((y) => typeof y.latitude === "number" && typeof y.longitude === "number")
      .map((y) => {
        const map = DISTRICT_MAP[y.child_school_district || "Other"] || { g: "home" as GroupKey, mun: null };
        return { lat: y.latitude as number, lng: y.longitude as number, color: GROUPS[map.g].color };
      }),
    [youth]);

  const locateAddresses = async () => {
    setGeo({ running: true, done: 0, remaining: 0 });
    try {
      let matched = 0, missed = 0;
      for (let guard = 0; guard < 60; guard++) {
        const { data, error } = await supabase.functions.invoke("geocode-youth", { body: {} });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        matched += data.matched || 0;
        missed += data.unmatched || 0;
        setGeo((g) => ({ running: true, done: (g?.done || 0) + (data.processed || 0), remaining: data.remaining || 0 }));
        if ((data.remaining || 0) <= 0 || (data.processed || 0) === 0) break;
      }
      await queryClient.invalidateQueries({ queryKey: ["youth-registrations-analytics"] });
      await queryClient.invalidateQueries({ queryKey: ["youth-district-map"] });
      toast.success(
        missed > 0
          ? `${matched} located · ${missed} couldn't be — they're listed under the map.`
          : `${matched} located.`
      );
    } catch (e: any) {
      toast.error(e?.message || "Geocoding failed.");
    } finally {
      setGeo((g) => (g ? { ...g, running: false } : null));
    }
  };

  return (
    <Card className="bg-white/5 border-white/10 text-white">
      <CardContent className="p-5">
        {/* Header + headline stat */}
        <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <MapPin className="w-5 h-5 text-red-400" /> Youth Per School District
            </h2>
            <p className="text-white/50 text-sm mt-1 max-w-xl">
              Every dot is one young person we serve, placed at their actual home address (from registration) and colored by school district.
            </p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold tabular-nums">
              <span className="text-[#bf0f3e]">{total.toLocaleString()}</span> youth
            </div>
            <div className="text-white/50 text-xs">
              across <span className="text-white font-semibold">{served}</span> Cape May County school districts
            </div>
          </div>
        </div>

        {/* Geocoding status + action */}
        <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
          <p className="text-xs text-white/45">
            <span className="text-white/70 font-semibold">{located.toLocaleString()}</span> of {geocodable.toLocaleString()} plotted at their real address
            {geocodable - located > 0 ? ` · ${(geocodable - located).toLocaleString()} shown approximately in-district until located` : ""}
          </p>
          <button onClick={locateAddresses} disabled={geo?.running}
            className="inline-flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/15 text-white disabled:opacity-60">
            {geo?.running ? <Loader2 className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />}
            {geo?.running ? `Locating… ${geo.done} done · ${geo.remaining} left` : "Locate addresses"}
          </button>
        </div>

        {/* The addresses no geocoder can read. Not a failure of the map — a
            registration to correct. Names, because that is how you find it. */}
        {unlocated.length > 0 && (
          // Open from the start (Josh, 2026-10-26: "where are the addresses?") — the list is the point, not a footnote.
          <details open className="mb-4 rounded-xl border-2 border-amber-400/40 bg-amber-500/[0.08]">
            <summary className="cursor-pointer select-none px-4 py-3 text-sm font-bold text-amber-200">
              {unlocated.length} {unlocated.length === 1 ? "address needs" : "addresses need"} fixing — tap Fix on each one below
            </summary>
            <p className="px-4 pb-2 text-[11px] text-white/45">
              Usually a PO box, a street with no town or ZIP, or a trailer lot. Press Fix, start typing the home address and pick it from
              the list — that places them on the map at once. Not in the list? Type the full address with the town and ZIP, and Save.
            </p>
            <ul className="px-4 pb-3 divide-y divide-white/[0.06]">
              {unlocated.map((u) => <UnlocatedRow key={u.id} youth={u} />)}
            </ul>
          </details>
        )}

        {/* District (branded) vs Street (real, zoomable) view */}
        <div className="inline-flex rounded-lg border border-white/10 bg-white/5 p-0.5 mb-3">
          <button onClick={() => setView("district")}
            className={`px-3 py-1.5 rounded-md text-sm font-semibold transition-colors ${view === "district" ? "bg-white/10 text-white" : "text-white/50 hover:text-white/80"}`}>District</button>
          <button onClick={() => setView("street")}
            className={`px-3 py-1.5 rounded-md text-sm font-semibold transition-colors ${view === "street" ? "bg-white/10 text-white" : "text-white/50 hover:text-white/80"}`}>Street</button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-4 items-start">
          {/* Map */}
          <div>
            {view === "street" ? (
              streetPoints.length > 0
                ? <YouthStreetMap points={streetPoints} />
                : <div className="rounded-xl grid place-items-center text-white/40 text-sm p-6 text-center" style={{ height: 520, background: "#0c141d" }}>No located youth yet — click "Locate addresses" above to plot real homes.</div>
            ) : (
            <div className="rounded-xl overflow-hidden" style={{ background: "#0c141d" }}>
            <svg viewBox={`0 0 ${VB_W} ${VB_H}`} className="w-full h-auto block" role="img" aria-label="Map of Cape May County youth by school district">
              {munPaths.map((m) => (
                <path key={m.key} d={m.d} fill={m.fill} fillOpacity={m.fillOpacity}
                  stroke="rgba(255,255,255,.14)" strokeWidth={0.8} strokeLinejoin="round" />
              ))}
              {dots.map((dt) => (
                <circle key={dt.key} cx={dt.cx} cy={dt.cy} r={dt.real ? 4.3 : 3.6} fill={dt.fill} fillOpacity={dt.real ? 1 : 0.4}
                  stroke="rgba(0,0,0,.4)" strokeWidth={0.8} />
              ))}
              {labels.map((l, i) => (
                <g key={i}>
                  {l.from && <line x1={l.from.x} y1={l.from.y} x2={l.x - 4} y2={l.y - 4} stroke="#eceef2" strokeOpacity={0.45} strokeWidth={1} />}
                  <text x={l.x} y={l.y} textAnchor={l.anchor ?? "middle"}
                    style={{ fill: "#eceef2", fontSize: 13, fontWeight: 700, paintOrder: "stroke", stroke: "#0c141d", strokeWidth: 3.2 }}>
                    {l.lines ? l.lines.map((t, k) => <tspan key={k} x={l.x} dy={k === 0 ? 0 : 15}>{t}</tspan>) : l.text}
                  </text>
                </g>
              ))}
              <text x={18} y={430} transform="rotate(-90 18 430)" textAnchor="middle"
                style={{ fill: "#6b7480", fontSize: 12, letterSpacing: "0.22em", opacity: 0.5, textTransform: "uppercase", fontWeight: 600 }}>
                Delaware Bay
              </text>
              <text x={624} y={430} transform="rotate(90 624 430)" textAnchor="middle"
                style={{ fill: "#6b7480", fontSize: 12, letterSpacing: "0.22em", opacity: 0.5, textTransform: "uppercase", fontWeight: 600 }}>
                Atlantic Ocean
              </text>
            </svg>
            </div>
            )}
          </div>

          {/* Legend */}
          <div>
            <p className="text-[10px] uppercase tracking-wider text-white/40 font-semibold mb-2 px-1">Districts represented</p>
            <div className="flex flex-col">
              {GROUP_ORDER.map((gk) => {
                const g = GROUPS[gk];
                const n = groupCounts[gk] || 0;
                return (
                  <div key={gk} className="grid grid-cols-[16px_1fr_auto] items-center gap-3 py-2 px-1 border-t border-white/5 first:border-t-0"
                    style={{ opacity: n === 0 ? 0.4 : 1 }}>
                    <span style={{ width: 13, height: 13, borderRadius: g.offMap ? 4 : "50%", background: g.color, boxShadow: "0 0 0 3px rgba(255,255,255,.04)" }} />
                    <span className="text-sm font-semibold leading-tight">
                      {g.name}
                      {g.sub && <span className="block text-white/40 font-normal text-xs">{g.sub}</span>}
                    </span>
                    <span className="text-base font-bold tabular-nums">{n}</span>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between items-baseline mt-2 pt-3 border-t border-white/10 px-1">
              <span className="text-white/50 text-xs uppercase tracking-wider font-semibold">Total youth served</span>
              <span className="text-xl font-bold tabular-nums">{total.toLocaleString()}</span>
            </div>
            {offMapCount > 0 && (
              <p className="text-white/35 text-xs mt-3 px-1">
                {offMapCount} youth ({GROUPS.home.name.toLowerCase()}) are counted in the total but not shown on the map — they have no fixed town.
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default YouthDistrictMap;

/* One address the map couldn't place, fixed in place (Josh, 2026-10-26: so
   Chrissy can correct it without opening the registration). Picking a
   suggestion saves the exact pin; a typed address is located right away. */
function UnlocatedRow({ youth: u }: { youth: YouthPoint }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(u.child_primary_address ?? "");
  const [pin, setPin] = useState<AddressPin | null>(null);
  const [saving, setSaving] = useState(false);
  const name = [u.child_first_name, u.child_last_name].filter(Boolean).join(" ") || "Unnamed";

  const save = async () => {
    const address = text.trim();
    if (!address || !u.id) return;
    const problem = addressProblem(address);
    if (problem) { toast.error(problem); return; }
    setSaving(true);
    try {
      const { error } = await supabase
        .from("youth_registrations")
        .update({
          child_primary_address: address,
          latitude: pin?.lat ?? null,
          longitude: pin?.lng ?? null,
          geocoded_at: pin ? new Date().toISOString() : null,
        } as never)
        .eq("id", u.id);
      if (error) throw error;
      let placed = !!pin;
      if (!pin) {
        // Typed by hand: try to place just this one now.
        const { data } = await supabase.functions.invoke("geocode-youth", { body: { ids: [u.id] } });
        placed = (data?.matched ?? 0) > 0;
      }
      await queryClient.invalidateQueries({ queryKey: ["youth-registrations-analytics"] });
      await queryClient.invalidateQueries({ queryKey: ["youth-district-map"] });
      if (placed) toast.success(`${name} is on the map.`);
      else toast.warning(`Saved, but the map still can't find it. Add the town and ZIP, or pick the address from the suggestions.`, { duration: 9000 });
      setEditing(false);
    } catch (e) {
      toast.error((e as Error).message || "Couldn't save the address.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <li className="py-2 text-xs">
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="font-semibold text-white/85 whitespace-nowrap">{name}</span>
        {!editing && <span className="text-white/45 break-all flex-1 min-w-0">{u.child_primary_address}</span>}
        {!editing && (
          <button type="button" onClick={() => { setText(u.child_primary_address ?? ""); setPin(null); setEditing(true); }} className="ml-auto inline-flex items-center gap-1 rounded-md border border-white/15 px-2 py-0.5 text-[11px] font-semibold text-white/80 hover:bg-white/10">
            <Pencil className="w-3 h-3" /> Fix
          </button>
        )}
      </div>
      {editing && (
        <div className="mt-2 space-y-2">
          <ChildPrimaryAddressField value={text} onChange={(v) => { setText(v); }} onLocate={setPin} className="bg-neutral-900 text-white border-white/20 placeholder:text-white/35" />
          <div className="flex items-center gap-2">
            <button type="button" disabled={saving || !text.trim()} onClick={() => void save()} className="inline-flex items-center gap-1 rounded-md bg-white text-black px-3 py-1 text-[12px] font-bold hover:bg-white/90 disabled:opacity-40">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Save
            </button>
            <button type="button" disabled={saving} onClick={() => setEditing(false)} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[12px] text-white/60 hover:text-white hover:bg-white/10">
              <X className="w-3.5 h-3.5" /> Cancel
            </button>
            {pin && <span className="text-emerald-300 text-[11px]">Picked from the list — it goes straight on the map.</span>}
          </div>
        </div>
      )}
    </li>
  );
}
