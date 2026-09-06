// Daily Duties — shared types + the look of each zone.
//
// The board and the admin editor both lean on this so a zone always looks the
// same everywhere. Colors echo the paper sheet (Boxing Gym pink/red,
// Performance Center blue, Bathrooms purple, Smile Lab teal, Entire Gym
// gold) but are tuned to read on the black Gym Board TV.

export interface DutyJob {
  id: string;
  zone: string;
  label: string;
  category: string;
  sort_order: number;
  is_active: boolean;
}

// One assignment as the board sees it (youth name + photo already joined).
export interface DutyAssignee {
  job_id: string;
  registration_id: string;
  child_first_name: string;
  child_last_name: string;
  child_headshot_url: string | null;
}

// A youth found in the "tonight's check-ins" search.
export interface CheckedInYouth {
  id: string;
  child_first_name: string;
  child_last_name: string;
  child_boxing_program: string;
  child_headshot_url: string | null;
}

// The zones, in the order they appear on the board, each with its accent.
export interface ZoneStyle {
  name: string;
  // Tailwind classes: a soft tinted card, a matching border, and a chip color.
  border: string;
  headerBg: string;
  headerText: string;
  dot: string;
}

export const DUTY_ZONES: ZoneStyle[] = [
  { name: "Boxing Gym",         border: "border-rose-500/30",   headerBg: "bg-rose-500/15",   headerText: "text-rose-200",   dot: "bg-rose-400" },
  { name: "Performance Center", border: "border-sky-500/30",    headerBg: "bg-sky-500/15",    headerText: "text-sky-200",    dot: "bg-sky-400" },
  { name: "Bathrooms",          border: "border-violet-500/30", headerBg: "bg-violet-500/15", headerText: "text-violet-200", dot: "bg-violet-400" },
  { name: "Smile Lab",          border: "border-teal-500/30",   headerBg: "bg-teal-500/15",   headerText: "text-teal-200",   dot: "bg-teal-400" },
  { name: "Entire Gym",         border: "border-amber-500/30",  headerBg: "bg-amber-500/15",  headerText: "text-amber-200",  dot: "bg-amber-400" },
];

// Fallback style for any zone not in the list above (e.g. a new one an admin
// types). Keeps the UI from breaking on unknown zones.
const ZONE_FALLBACK: ZoneStyle = {
  name: "",
  border: "border-neutral-700",
  headerBg: "bg-neutral-800",
  headerText: "text-neutral-200",
  dot: "bg-neutral-400",
};

export const zoneStyle = (zone: string): ZoneStyle =>
  DUTY_ZONES.find((z) => z.name === zone) ?? { ...ZONE_FALLBACK, name: zone };

// Report categories, in the order they should show on a funder report.
export const DUTY_CATEGORIES = ["Floors", "Equipment", "Bathrooms", "Reset", "Other"] as const;

// Group jobs by zone, preserving DUTY_ZONES order first, then any extras, and
// sort_order within each zone.
export function groupJobsByZone(jobs: DutyJob[]): { zone: string; jobs: DutyJob[] }[] {
  const byZone = new Map<string, DutyJob[]>();
  for (const j of jobs) {
    if (!byZone.has(j.zone)) byZone.set(j.zone, []);
    byZone.get(j.zone)!.push(j);
  }
  for (const list of byZone.values()) list.sort((a, b) => a.sort_order - b.sort_order);

  const ordered: { zone: string; jobs: DutyJob[] }[] = [];
  for (const z of DUTY_ZONES) {
    if (byZone.has(z.name)) {
      ordered.push({ zone: z.name, jobs: byZone.get(z.name)! });
      byZone.delete(z.name);
    }
  }
  // Any zones the admin invented that aren't in DUTY_ZONES, alphabetical.
  for (const zone of [...byZone.keys()].sort()) {
    ordered.push({ zone, jobs: byZone.get(zone)! });
  }
  return ordered;
}

// Photo URL helper — mirrors the check-in kiosk so headshots resolve the same
// way whether the stored value is a full URL or a storage path.
export function headshotUrl(url: string | null): string | null {
  if (!url) return null;
  if (url.startsWith("http")) return url;
  const base = import.meta.env.VITE_SUPABASE_URL;
  const path = url.startsWith("youth-photos/") ? url : `youth-photos/${url}`;
  return `${base}/storage/v1/object/public/${path}`;
}
