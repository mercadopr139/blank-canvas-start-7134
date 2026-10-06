// Juniors Session — the Tuesday line-up and the setup checklist.
//
// Junior Boxers practice on Tuesdays. The senior boxers set the building up
// and a few of them hold a role for the session. The admin fills the line-up
// before practice from the whole roster; the seniors tick the checklist on
// the gym board. Both are kept per date.

export interface JuniorsRole {
  id: string;
  title: string;
  group_label: string;   // "Coaching" | "Blue Stools"
  location: string | null;
  sort_order: number;
  is_active: boolean;
}

export interface JuniorsLineupRow {
  role_id: string;
  /** A registered youth, or null when an adult was typed by name. */
  registration_id: string | null;
  person_name: string | null;
  child_first_name: string | null;
  child_last_name: string | null;
  child_headshot_url: string | null;
}

/** The name on a line-up card: the typed adult, or the youth's full name. */
export const lineupName = (l: Pick<JuniorsLineupRow, "person_name" | "child_first_name" | "child_last_name">) =>
  (l.person_name ?? "").trim() || `${l.child_first_name ?? ""} ${l.child_last_name ?? ""}`.trim();

/** Initials for a card without a photo. */
export const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");

export interface JuniorsCategory {
  id: string;
  title: string;
  photo_url: string | null;
  thumb_url?: string | null;
  sort_order: number;
  is_active: boolean;
}

export interface JuniorsTask {
  id: string;
  category_id: string;
  title: string;
  details: string | null;
  photo_url: string | null;
  /** A small copy for lists; the board falls back to photo_url for older rows. */
  thumb_url?: string | null;
  starred: boolean;
  sort_order: number;
  is_active: boolean;
}

export interface JuniorsCompletion {
  task_id: string;
  done_at: string;
  child_first_name: string | null;
  child_last_name: string | null;
}

/** Today in New Jersey, YYYY-MM-DD. */
export const juniorsTodayET = (now = new Date()) => now.toLocaleDateString("en-CA", { timeZone: "America/New_York" });

/** Is this date a Tuesday? `ymd` read at noon so no timezone can shift it. */
export const isTuesday = (ymd: string) => new Date(`${ymd}T12:00:00`).getDay() === 2;

/** The Tuesday of the week holding `ymd` if it is still ahead (or today); otherwise next week's. */
export const nextTuesday = (ymd: string) => {
  const d = new Date(`${ymd}T12:00:00`);
  const diff = (2 - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + diff);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

/** The last `n` Tuesdays on or before `ymd`, most recent first. */
export const recentTuesdays = (ymd: string, n: number): string[] => {
  const d = new Date(`${ymd}T12:00:00`);
  d.setDate(d.getDate() - ((d.getDay() - 2 + 7) % 7));
  const out: string[] = [];
  const p = (x: number) => String(x).padStart(2, "0");
  for (let i = 0; i < n; i++) {
    out.push(`${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`);
    d.setDate(d.getDate() - 7);
  }
  return out;
};

const inCategory = (list: JuniorsTask[], catId: string) =>
  list.filter((t) => t.category_id === catId).sort((a, b) => a.sort_order - b.sort_order);

/**
 * The list with `moving` placed at `index` in `catId` (any category, empty
 * or not), that category renumbered 10, 20, 30… Pure; the editor persists
 * only the rows whose category or position changed.
 */
export const placeTask = (list: JuniorsTask[], moving: JuniorsTask, catId: string, index: number): JuniorsTask[] => {
  const rest = list.filter((t) => t.id !== moving.id);
  const siblings = inCategory(rest, catId);
  const at = Math.max(0, Math.min(index, siblings.length));
  const ordered = [...siblings.slice(0, at), { ...moving, category_id: catId }, ...siblings.slice(at)];
  const renumbered = ordered.map((t, i) => ({ ...t, category_id: catId, sort_order: (i + 1) * 10 }));
  return [...rest.filter((t) => t.category_id !== catId), ...renumbered];
};

/** Tasks in board order: starred first, then by sort order. */
export const orderTasks = (tasks: JuniorsTask[]) =>
  [...tasks].sort((a, b) => Number(b.starred) - Number(a.starred) || a.sort_order - b.sort_order || a.title.localeCompare(b.title));

/** Tasks grouped under their category, both in order, empty categories dropped. */
export const groupTasks = (categories: JuniorsCategory[], tasks: JuniorsTask[]) =>
  [...categories]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((c) => ({ category: c, tasks: orderTasks(tasks.filter((t) => t.category_id === c.id)) }))
    .filter((g) => g.tasks.length > 0);

/** The roles grouped by their label, in order. */
export const groupRoles = (roles: JuniorsRole[]) => {
  const groups = new Map<string, JuniorsRole[]>();
  [...roles].sort((a, b) => a.sort_order - b.sort_order).forEach((r) => {
    groups.set(r.group_label, [...(groups.get(r.group_label) ?? []), r]);
  });
  return [...groups.entries()].map(([label, items]) => ({ label, roles: items }));
};

/** Public URL of a youth headshot in the youth-photos bucket. */
export const youthPhotoUrl = (path: string | null | undefined): string | null => {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  const clean = path.startsWith("youth-photos/") ? path.slice("youth-photos/".length) : path;
  return `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/youth-photos/${clean}`;
};
