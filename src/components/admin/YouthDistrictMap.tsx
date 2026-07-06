import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { MapPin } from "lucide-react";
import { capeMayGeo } from "@/data/capeMayGeo";

/*
  Youth Per School District — a real map of Cape May County with one dot per
  youth, placed inside the actual boundary of the school district they attend
  and colored by district group. Built for showing donors our reach at a glance.

  Data source: youth_registrations.child_school_district (a locked dropdown).
  Geography: official NJ GIS municipal boundaries (see src/data/capeMayGeo.ts).
*/

/* ── District groups: color + display label ── */
type GroupKey =
  | "lowercape" | "ocean" | "middle" | "wildwood"
  | "woodbine" | "avalon" | "tech" | "catholic" | "home";

const GROUPS: Record<GroupKey, { name: string; sub: string; color: string; school?: boolean; offMap?: boolean }> = {
  middle:    { name: "Middle Township",       sub: "incl. Dennis Twp",                     color: "#f59340" },
  wildwood:  { name: "Wildwood",              sub: "incl. Crest & N. Wildwood",            color: "#9c2c3b" },
  lowercape: { name: "Lower Cape May",        sub: "Cape May, W. Cape May, Lower Twp",     color: "#57b0ea" },
  woodbine:  { name: "Woodbine",              sub: "",                                     color: "#9aa4af" },
  ocean:     { name: "Ocean City",            sub: "incl. Upper Twp",                      color: "#ef4444" },
  tech:      { name: "Cape May Tech",         sub: "county vocational school",             color: "#33c281", school: true },
  catholic:  { name: "Wildwood Catholic",     sub: "private academy",                      color: "#3160b4", school: true },
  avalon:    { name: "Avalon & Stone Harbor", sub: "",                                     color: "#f2c94c" },
  home:      { name: "Homeschool / Other",    sub: "no fixed district",                    color: "#a7d96b", offMap: true },
};

/* Order groups appear in the legend */
const GROUP_ORDER: GroupKey[] = ["middle", "wildwood", "lowercape", "woodbine", "ocean", "tech", "catholic", "avalon", "home"];

/* ── Every school_district dropdown value → its group + the municipality
      polygon to scatter its dots into. mun:null => off-map tally. ── */
const DISTRICT_MAP: Record<string, { g: GroupKey; mun: string | null }> = {
  "Cape May City":                                        { g: "lowercape", mun: "Cape May" },
  "Cape May/West Cape May":                               { g: "lowercape", mun: "Cape May" },
  "West Cape May":                                        { g: "lowercape", mun: "West Cape May Borough" },
  "Lower Township":                                       { g: "lowercape", mun: "Lower Township" },
  "Lower Cape May Regional":                              { g: "lowercape", mun: "Lower Township" },
  "Middle Township":                                      { g: "middle",    mun: "Middle Township" },
  "Dennis Township":                                      { g: "middle",    mun: "Dennis Township" },
  "Ocean City":                                           { g: "ocean",     mun: "Ocean City" },
  "Upper Township":                                       { g: "ocean",     mun: "Upper Township" },
  "Wildwood":                                             { g: "wildwood",  mun: "Wildwood" },
  "Wildwood/Wildwood Crest/North Wildwood":               { g: "wildwood",  mun: "Wildwood" },
  "Wildwood Crest":                                       { g: "wildwood",  mun: "Wildwood Crest Borough" },
  "North Wildwood":                                       { g: "wildwood",  mun: "North Wildwood" },
  "Woodbine":                                             { g: "woodbine",  mun: "Woodbine Borough" },
  "Avalon/Stone Harbor":                                  { g: "avalon",    mun: "Avalon Borough" },
  "Cape May Tech":                                        { g: "tech",      mun: "Middle Township" },
  "Wildwood Catholic Academy":                            { g: "catholic",  mun: "North Wildwood" },
  "Homeschool, Hybrid, or Alternative Form of Schooling": { g: "home",      mun: null },
  "Other":                                                { g: "home",      mun: null },
};

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

  return { munPaths, munIndex };
}

export function YouthDistrictMap() {
  const { data: rows } = useQuery({
    queryKey: ["youth-district-map"],
    queryFn: async () => {
      const { data, error } = await supabase.from("youth_registrations").select("child_school_district");
      if (error) throw error;
      return data as { child_school_district: string | null }[];
    },
  });

  const { munPaths, munIndex } = useMemo(buildGeometry, []);

  const countsByDistrict = useMemo(() => {
    const acc: Record<string, number> = {};
    (rows || []).forEach((r) => {
      const key = r.child_school_district || "Other";
      acc[key] = (acc[key] || 0) + 1;
    });
    return acc;
  }, [rows]);

  const { dots, labels, groupCounts, total, served, offMapCount } = useMemo(() => {
    // seeded RNG so dots stay put across re-renders
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

    const dots: { cx: number; cy: number; fill: string; key: string }[] = [];
    const groupCounts: Record<string, number> = {};
    let total = 0, offMapCount = 0, di = 0;

    Object.entries(countsByDistrict).forEach(([district, count]) => {
      const map = DISTRICT_MAP[district] || { g: "home" as GroupKey, mun: null };
      const group = GROUPS[map.g];
      groupCounts[map.g] = (groupCounts[map.g] || 0) + count;
      total += count;
      if (!map.mun || group.offMap) { offMapCount += count; return; }
      const target = munIndex[map.mun];
      if (!target) { offMapCount += count; return; }
      for (let i = 0; i < count; i++) {
        const p = scatterInto(target.ring);
        dots.push({ cx: +p.x.toFixed(1), cy: +p.y.toFixed(1), fill: group.color, key: district + i + di });
      }
      di += count;
    });

    // group labels at the area-weighted center of each geographic region
    const labels: { x: number; y: number; text: string }[] = [];
    (Object.keys(GEO_GROUP_MUNS) as GroupKey[]).forEach((gk) => {
      if (!groupCounts[gk]) return;
      const members = (GEO_GROUP_MUNS[gk] || []).map((n) => munIndex[n]).filter(Boolean) as { ring: Pt[]; area: number; c: Pt }[];
      if (!members.length) return;
      let cx = 0, cy = 0, wa = 0;
      members.forEach((m) => { cx += m.c.x * m.area; cy += m.c.y * m.area; wa += m.area; });
      labels.push({ x: Math.round(cx / wa), y: Math.round(cy / wa), text: GROUPS[gk].name });
    });

    const served = GROUP_ORDER.filter((g) => g !== "home" && groupCounts[g] > 0).length;
    return { dots, labels, groupCounts, total, served, offMapCount };
  }, [countsByDistrict, munIndex]);

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
              Every dot is one young person we serve, placed in the Cape May County district they attend.
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

        <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-4 items-start">
          {/* Map */}
          <div className="rounded-xl overflow-hidden" style={{ background: "#0c141d" }}>
            <svg viewBox={`0 0 ${VB_W} ${VB_H}`} className="w-full h-auto block" role="img" aria-label="Map of Cape May County youth by school district">
              {munPaths.map((m) => (
                <path key={m.key} d={m.d} fill={m.fill} fillOpacity={m.fillOpacity}
                  stroke="rgba(255,255,255,.14)" strokeWidth={0.8} strokeLinejoin="round" />
              ))}
              {dots.map((dt) => (
                <circle key={dt.key} cx={dt.cx} cy={dt.cy} r={4.3} fill={dt.fill}
                  stroke="rgba(0,0,0,.4)" strokeWidth={0.8} />
              ))}
              {labels.map((l, i) => (
                <text key={i} x={l.x} y={l.y} textAnchor="middle"
                  style={{ fill: "#eceef2", fontSize: 13, fontWeight: 700, paintOrder: "stroke", stroke: "#0c141d", strokeWidth: 3.2 }}>
                  {l.text}
                </text>
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
