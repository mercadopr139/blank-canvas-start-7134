// Juniors Session — the admin side.
//
// LINE-UP: Josh or Chrissy pick who holds each role on a Tuesday, from the
// whole approved roster (the kids have not signed in yet), with a one-tap
// copy of last Tuesday. ROLES and CHECKLIST: add, rename, reorder, star,
// switch off, and add a photo of the proper set-up. HISTORY: the last few
// Tuesdays -- who held what and whether setup was finished, and when.
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Star, Plus, Trash2, ArrowUp, ArrowDown, Camera, X, Monitor, Copy, Search, Users, Check, Loader2,
} from "lucide-react";
import { getCurrentAttendanceYear } from "@/lib/programYear";
import {
  type JuniorsRole, type JuniorsLineupRow, type JuniorsCategory, type JuniorsTask, type JuniorsCompletion,
  juniorsTodayET, nextTuesday, recentTuesdays, groupTasks, groupRoles, youthPhotoUrl,
} from "@/lib/juniors";

const GOLD = "#f2c230";
const NLA_RED = "#bf0f3e";

type Q = { data: unknown; error: { message: string } | null };
const tbl = (name: string) => supabase.from(name as never) as never as {
  select: (s: string) => {
    order: (k: string, o: { ascending: boolean }) => Promise<Q>;
    eq: (k: string, v: unknown) => Promise<Q>;
    in: (k: string, v: string[]) => Promise<Q>;
  };
  insert: (v: unknown) => Promise<{ error: { message: string } | null }>;
  update: (v: unknown) => { eq: (k: string, v: string) => Promise<{ error: { message: string } | null }> };
  upsert: (v: unknown, o: { onConflict: string }) => Promise<{ error: { message: string } | null }>;
  delete: () => { eq: (k: string, v: string) => { eq?: (k: string, v: string) => Promise<{ error: { message: string } | null }> } & Promise<{ error: { message: string } | null }> };
};
const rpc = (name: string, args?: Record<string, unknown>) =>
  (supabase.rpc as unknown as (n: string, a?: Record<string, unknown>) => Promise<Q>)(name, args);

interface Youth { id: string; child_first_name: string; child_last_name: string; child_headshot_url: string | null; child_boxing_program: string | null }

const fmtDay = (ymd: string) => new Date(`${ymd}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

const AdminJuniorsSession = () => {
  const qc = useQueryClient();
  const today = juniorsTodayET();

  const { data: roles = [] } = useQuery({ queryKey: ["juniors-roles-admin"], queryFn: async () => { const { data, error } = await tbl("juniors_roles").select("*").order("sort_order", { ascending: true }); if (error) throw new Error(error.message); return (data as JuniorsRole[]) ?? []; } });
  const { data: categories = [] } = useQuery({ queryKey: ["juniors-categories-admin"], queryFn: async () => { const { data, error } = await tbl("juniors_categories").select("*").order("sort_order", { ascending: true }); if (error) throw new Error(error.message); return (data as JuniorsCategory[]) ?? []; } });
  const { data: tasks = [] } = useQuery({ queryKey: ["juniors-tasks-admin"], queryFn: async () => { const { data, error } = await tbl("juniors_tasks").select("*").order("sort_order", { ascending: true }); if (error) throw new Error(error.message); return (data as JuniorsTask[]) ?? []; } });
  const refreshAll = () => ["juniors-roles-admin", "juniors-categories-admin", "juniors-tasks-admin", "juniors-roles", "juniors-categories", "juniors-tasks"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-6xl mx-auto text-white">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold">Juniors Session</h2>
          <p className="text-neutral-400 text-sm mt-1">Tuesday's line-up and the setup checklist the senior boxers tick off on the Gym Board.</p>
        </div>
        <Button variant="outline" onClick={() => window.open("/juniors-session", "_blank")} className="bg-transparent border-neutral-700 text-neutral-300 hover:text-white">
          <Monitor className="w-4 h-4 mr-1.5" /> Open the board
        </Button>
      </div>

      <Tabs defaultValue="lineup">
        <TabsList className="bg-white/5 border border-white/10 gap-1">
          {[["lineup", "Line-up"], ["checklist", "Checklist"], ["roles", "Roles"], ["history", "History"]].map(([v, l]) => (
            <TabsTrigger key={v} value={v} className="text-white/70 hover:text-white data-[state=active]:bg-[#bf0f3e] data-[state=active]:text-white font-semibold">{l}</TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="lineup" className="mt-5"><Lineup roles={roles.filter((r) => r.is_active)} today={today} /></TabsContent>
        <TabsContent value="checklist" className="mt-5"><Checklist categories={categories} tasks={tasks} onChange={refreshAll} /></TabsContent>
        <TabsContent value="roles" className="mt-5"><Roles roles={roles} onChange={refreshAll} /></TabsContent>
        <TabsContent value="history" className="mt-5"><History roles={roles} tasks={tasks} today={today} /></TabsContent>
      </Tabs>
    </div>
  );
};

/* ───── Line-up ───── */
const Lineup = ({ roles, today }: { roles: JuniorsRole[]; today: string }) => {
  const qc = useQueryClient();
  const [date, setDate] = useState(nextTuesday(today));
  const [picking, setPicking] = useState<JuniorsRole | null>(null);
  const [search, setSearch] = useState("");

  const { data: lineup = [] } = useQuery({
    queryKey: ["juniors-lineup-admin", date],
    queryFn: async () => { const { data, error } = await rpc("get_juniors_lineup", { _date: date }); if (error) throw new Error(error.message); return (data as JuniorsLineupRow[]) ?? []; },
  });
  // The whole approved roster for the year in session: the kids have not signed in yet.
  const { data: roster = [] } = useQuery({
    queryKey: ["juniors-roster", getCurrentAttendanceYear()],
    queryFn: async () => {
      const { data, error } = await (supabase.from("youth_registrations") as never as {
        select: (s: string) => { eq: (k: string, v: unknown) => { is: (k: string, v: null) => { eq: (k: string, v: string) => { order: (k: string, o: { ascending: boolean }) => Promise<Q> } } } };
      }).select("id, child_first_name, child_last_name, child_headshot_url, child_boxing_program")
        .eq("approved_for_attendance", true).is("archived_at", null).eq("program_year", getCurrentAttendanceYear())
        .order("child_last_name", { ascending: true });
      if (error) throw new Error(error.message);
      return (data as Youth[]) ?? [];
    },
  });
  const byRole = useMemo(() => new Map(lineup.map((l) => [l.role_id, l])), [lineup]);
  const refresh = () => { qc.invalidateQueries({ queryKey: ["juniors-lineup-admin", date] }); qc.invalidateQueries({ queryKey: ["juniors-lineup", date] }); };

  const assign = async (role: JuniorsRole, y: Youth) => {
    const { error } = await tbl("juniors_role_assignments").upsert({ role_id: role.id, session_date: date, registration_id: y.id }, { onConflict: "role_id,session_date" });
    if (error) { toast.error(error.message); return; }
    setPicking(null); setSearch(""); refresh();
    toast.success(`${y.child_first_name} — ${role.title}`);
  };
  const clear = async (role: JuniorsRole) => {
    const { data, error } = await tbl("juniors_role_assignments").select("id").eq("role_id", role.id);
    if (error) { toast.error(error.message); return; }
    const row = ((data as Array<{ id: string; session_date?: string }>) ?? []);
    // Narrow to this date client-side: the typed chain above allows one eq.
    const { data: rows2 } = await tbl("juniors_role_assignments").select("id, session_date").eq("role_id", role.id);
    const target = ((rows2 as Array<{ id: string; session_date: string }>) ?? []).find((r) => r.session_date === date) ?? row[0];
    if (!target) return;
    const { error: delError } = await tbl("juniors_role_assignments").delete().eq("id", target.id);
    if (delError) { toast.error(delError.message); return; }
    refresh();
  };
  const copyLast = async () => {
    const prev = recentTuesdays(date, 2).find((d) => d < date);
    if (!prev) return;
    const { data, error } = await rpc("get_juniors_lineup", { _date: prev });
    if (error) { toast.error(error.message); return; }
    const rows = (data as JuniorsLineupRow[]) ?? [];
    if (!rows.length) { toast.error(`Nothing filled on ${fmtDay(prev)}.`); return; }
    const { error: upError } = await tbl("juniors_role_assignments").upsert(rows.map((r) => ({ role_id: r.role_id, session_date: date, registration_id: r.registration_id })), { onConflict: "role_id,session_date" });
    if (upError) { toast.error(upError.message); return; }
    refresh(); toast.success(`Copied ${rows.length} from ${fmtDay(prev)}.`);
  };

  const q = search.trim().toLowerCase();
  const matches = roster.filter((y) => !q || `${y.child_first_name} ${y.child_last_name}`.toLowerCase().includes(q)).slice(0, 30);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <label className="text-sm text-white/60 flex items-center gap-2">Session
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-lg bg-white/5 border border-white/15 px-2 py-1.5 text-sm text-white" />
        </label>
        <span className="text-xs text-white/40">{fmtDay(date)}{date === today ? " · today" : ""}</span>
        <Button variant="outline" size="sm" onClick={copyLast} className="ml-auto bg-transparent border-neutral-700 text-neutral-300 hover:text-white">
          <Copy className="w-3.5 h-3.5 mr-1.5" /> Copy last Tuesday
        </Button>
      </div>
      {groupRoles(roles).map((g) => (
        <Card key={g.label} className="bg-white/[0.03] border-white/10 text-white">
          <CardContent className="p-4">
            <p className="text-[11px] uppercase tracking-wider text-white/45 font-bold mb-3">{g.label}</p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {g.roles.map((r) => {
                const who = byRole.get(r.id);
                return (
                  <div key={r.id} className={`rounded-xl border p-3 flex items-center gap-3 ${who ? "border-white/15 bg-white/[0.05]" : "border-dashed border-white/20"}`}>
                    <div className="w-11 h-11 rounded-full overflow-hidden bg-white/10 shrink-0 flex items-center justify-center">
                      {who && youthPhotoUrl(who.child_headshot_url) ? <img src={youthPhotoUrl(who.child_headshot_url)!} alt="" className="w-full h-full object-cover" /> : <Users className="w-5 h-5 text-white/25" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] uppercase tracking-wide text-white/45 font-semibold">{r.title}{r.location ? ` · ${r.location}` : ""}</p>
                      <p className={`font-bold truncate ${who ? "" : "text-white/30"}`}>{who ? `${who.child_first_name} ${who.child_last_name}` : "Open"}</p>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" className="h-8 px-2 text-white/60 hover:text-white" onClick={() => { setPicking(r); setSearch(""); }}>{who ? "Change" : "Pick"}</Button>
                      {who && <Button size="icon" variant="ghost" className="h-8 w-8 text-white/30 hover:text-rose-300" onClick={() => clear(r)}><X className="w-4 h-4" /></Button>}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ))}

      {picking && (
        <div className="fixed inset-0 z-[60] bg-black/80 flex items-start justify-center p-4 md:pt-20" onClick={() => setPicking(null)}>
          <div className="w-full max-w-lg bg-neutral-950 border border-white/15 rounded-2xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-white/10">
              <p className="text-xs uppercase tracking-wide font-bold text-white/45">{fmtDay(date)}</p>
              <p className="font-bold text-lg">{picking.title}</p>
            </div>
            <div className="p-4 space-y-3">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} autoFocus placeholder="Search the roster…" className="pl-9 h-10 bg-neutral-900 border-neutral-700 text-white" />
              </div>
              <div className="max-h-72 overflow-y-auto space-y-1">
                {matches.map((y) => (
                  <button key={y.id} onClick={() => assign(picking, y)} className="w-full flex items-center gap-3 rounded-lg px-2 py-1.5 text-left hover:bg-white/10">
                    <span className="w-8 h-8 rounded-full overflow-hidden bg-white/10 shrink-0">{youthPhotoUrl(y.child_headshot_url) && <img src={youthPhotoUrl(y.child_headshot_url)!} alt="" className="w-full h-full object-cover" />}</span>
                    <span className="font-semibold text-sm">{y.child_first_name} {y.child_last_name}</span>
                    <span className="ml-auto text-[11px] text-white/35">{y.child_boxing_program ?? ""}</span>
                  </button>
                ))}
                {matches.length === 0 && <p className="text-white/35 text-sm px-2 py-3">Nobody on the roster matches.</p>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* ───── Checklist editor ───── */
const Checklist = ({ categories, tasks, onChange }: { categories: JuniorsCategory[]; tasks: JuniorsTask[]; onChange: () => void }) => {
  const [newCat, setNewCat] = useState("");
  const [newTask, setNewTask] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState<string | null>(null);

  const addCategory = async () => {
    if (!newCat.trim()) return;
    const sort = Math.max(0, ...categories.map((c) => c.sort_order)) + 10;
    const { error } = await tbl("juniors_categories").insert({ title: newCat.trim(), sort_order: sort });
    if (error) { toast.error(error.message); return; }
    setNewCat(""); onChange();
  };
  const addTask = async (c: JuniorsCategory) => {
    const title = (newTask[c.id] ?? "").trim();
    if (!title) return;
    const sort = Math.max(0, ...tasks.filter((t) => t.category_id === c.id).map((t) => t.sort_order)) + 10;
    const { error } = await tbl("juniors_tasks").insert({ category_id: c.id, title, sort_order: sort });
    if (error) { toast.error(error.message); return; }
    setNewTask((p) => ({ ...p, [c.id]: "" })); onChange();
  };
  const patch = async (table: string, id: string, v: Record<string, unknown>) => {
    const { error } = await tbl(table).update(v).eq("id", id);
    if (error) { toast.error(error.message); return; }
    onChange();
  };
  const remove = async (table: string, id: string, label: string) => {
    if (!window.confirm(`Delete "${label}"? Use the switch to hide it instead if it might come back.`)) return;
    const { error } = await tbl(table).delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    onChange();
  };
  // Move within siblings by swapping sort orders.
  const move = async (table: string, items: { id: string; sort_order: number }[], id: string, dir: -1 | 1) => {
    const sorted = [...items].sort((a, b) => a.sort_order - b.sort_order);
    const i = sorted.findIndex((x) => x.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= sorted.length) return;
    const a = sorted[i], b = sorted[j];
    const sa = a.sort_order === b.sort_order ? b.sort_order + dir : b.sort_order;
    const sb = a.sort_order === b.sort_order ? a.sort_order : a.sort_order;
    await tbl(table).update({ sort_order: sa }).eq("id", a.id);
    await tbl(table).update({ sort_order: sb }).eq("id", b.id);
    onChange();
  };
  const upload = async (table: string, id: string, file: File) => {
    setUploading(id);
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const path = `juniors/${table === "juniors_tasks" ? "task" : "category"}_${id}_${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("site-images").upload(path, file, { upsert: true, contentType: file.type || undefined });
    if (error) { setUploading(null); toast.error(error.message); return; }
    const url = supabase.storage.from("site-images").getPublicUrl(path).data.publicUrl;
    await patch(table, id, { photo_url: url });
    setUploading(null);
    toast.success("Photo added.");
  };

  const PhotoButton = ({ table, row }: { table: string; row: { id: string; photo_url: string | null } }) => (
    <label className="inline-flex items-center gap-1 text-xs text-white/50 hover:text-white cursor-pointer" title={row.photo_url ? "Replace photo" : "Add a photo of the proper set-up"}>
      {uploading === row.id ? <Loader2 className="w-4 h-4 animate-spin" /> : row.photo_url ? <img src={row.photo_url} alt="" className="w-8 h-8 rounded object-cover ring-1 ring-white/20" /> : <Camera className="w-4 h-4" />}
      <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(table, row.id, f); e.currentTarget.value = ""; }} />
      {row.photo_url && <button type="button" className="text-white/30 hover:text-rose-300" title="Remove photo" onClick={(e) => { e.preventDefault(); patch(table, row.id, { photo_url: null }); }}><X className="w-3 h-3" /></button>}
    </label>
  );

  const sortedCats = [...categories].sort((a, b) => a.sort_order - b.sort_order);
  return (
    <div className="space-y-4">
      <p className="text-xs text-white/40">Starred tasks sit at the top of their category on the board. A photo shows the kids the proper set-up. The switch hides a task without deleting it.</p>
      {sortedCats.map((c) => {
        const ts = tasks.filter((t) => t.category_id === c.id).sort((a, b) => a.sort_order - b.sort_order);
        return (
          <Card key={c.id} className={`bg-white/[0.03] border-white/10 text-white ${c.is_active ? "" : "opacity-60"}`}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Input defaultValue={c.title} onBlur={(e) => e.target.value.trim() && e.target.value !== c.title && patch("juniors_categories", c.id, { title: e.target.value.trim() })}
                  className="h-9 bg-transparent border-transparent hover:border-neutral-700 focus:border-neutral-600 text-white font-black uppercase tracking-wider max-w-xs" />
                <PhotoButton table="juniors_categories" row={c} />
                <div className="ml-auto flex items-center gap-1">
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-white/40 hover:text-white" onClick={() => move("juniors_categories", sortedCats, c.id, -1)}><ArrowUp className="w-4 h-4" /></Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-white/40 hover:text-white" onClick={() => move("juniors_categories", sortedCats, c.id, 1)}><ArrowDown className="w-4 h-4" /></Button>
                  <Switch checked={c.is_active} onCheckedChange={(v) => patch("juniors_categories", c.id, { is_active: v })} />
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-white/30 hover:text-rose-300" onClick={() => remove("juniors_categories", c.id, c.title)}><Trash2 className="w-4 h-4" /></Button>
                </div>
              </div>
              <div className="divide-y divide-white/[0.06] rounded-lg border border-white/10">
                {ts.map((t) => (
                  <div key={t.id} className={`flex items-center gap-2 px-3 py-2 ${t.is_active ? "" : "opacity-50"}`}>
                    <button onClick={() => patch("juniors_tasks", t.id, { starred: !t.starred })} title={t.starred ? "Unstar" : "Star as important"} className="shrink-0">
                      <Star className="w-4 h-4" style={t.starred ? { color: GOLD, fill: GOLD } : { color: "rgba(255,255,255,0.25)" }} />
                    </button>
                    <div className="flex-1 min-w-0">
                      <Input defaultValue={t.title} onBlur={(e) => e.target.value.trim() && e.target.value !== t.title && patch("juniors_tasks", t.id, { title: e.target.value.trim() })}
                        className="h-8 bg-transparent border-transparent hover:border-neutral-700 focus:border-neutral-600 text-white text-sm" />
                      <Textarea defaultValue={t.details ?? ""} placeholder="Optional detail shown under the task" rows={1}
                        onBlur={(e) => (e.target.value.trim() || null) !== (t.details ?? null) && patch("juniors_tasks", t.id, { details: e.target.value.trim() || null })}
                        className="mt-0.5 min-h-0 h-7 py-1 bg-transparent border-transparent hover:border-neutral-700 focus:border-neutral-600 text-white/60 text-xs resize-none" />
                    </div>
                    <PhotoButton table="juniors_tasks" row={t} />
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-white/40 hover:text-white" onClick={() => move("juniors_tasks", ts, t.id, -1)}><ArrowUp className="w-3.5 h-3.5" /></Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-white/40 hover:text-white" onClick={() => move("juniors_tasks", ts, t.id, 1)}><ArrowDown className="w-3.5 h-3.5" /></Button>
                    <Switch checked={t.is_active} onCheckedChange={(v) => patch("juniors_tasks", t.id, { is_active: v })} />
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-white/30 hover:text-rose-300" onClick={() => remove("juniors_tasks", t.id, t.title)}><Trash2 className="w-3.5 h-3.5" /></Button>
                  </div>
                ))}
                <div className="flex items-center gap-2 px-3 py-2">
                  <Plus className="w-4 h-4 text-white/30" />
                  <Input value={newTask[c.id] ?? ""} onChange={(e) => setNewTask((p) => ({ ...p, [c.id]: e.target.value }))} onKeyDown={(e) => { if (e.key === "Enter") addTask(c); }}
                    placeholder="Add a task and press Enter" className="h-8 bg-transparent border-transparent hover:border-neutral-700 focus:border-neutral-600 text-white text-sm" />
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
      <div className="flex items-center gap-2">
        <Input value={newCat} onChange={(e) => setNewCat(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addCategory(); }} placeholder="New category…" className="h-9 max-w-xs bg-neutral-900 border-neutral-700 text-white" />
        <Button onClick={addCategory} disabled={!newCat.trim()} className="h-9 text-white font-bold" style={{ backgroundColor: NLA_RED }}><Plus className="w-4 h-4 mr-1" /> Category</Button>
      </div>
    </div>
  );
};

/* ───── Roles editor ───── */
const Roles = ({ roles, onChange }: { roles: JuniorsRole[]; onChange: () => void }) => {
  const [title, setTitle] = useState("");
  const [group, setGroup] = useState("Coaching");
  const [location, setLocation] = useState("");
  const groups = Array.from(new Set(["Coaching", "Blue Stools", ...roles.map((r) => r.group_label)]));
  const patch = async (id: string, v: Record<string, unknown>) => { const { error } = await tbl("juniors_roles").update(v).eq("id", id); if (error) toast.error(error.message); else onChange(); };
  const add = async () => {
    if (!title.trim()) return;
    const { error } = await tbl("juniors_roles").insert({ title: title.trim(), group_label: group, location: location.trim() || null, sort_order: Math.max(0, ...roles.map((r) => r.sort_order)) + 10 });
    if (error) { toast.error(error.message); return; }
    setTitle(""); setLocation(""); onChange();
  };
  const remove = async (r: JuniorsRole) => {
    if (!window.confirm(`Delete the role "${r.title}"? Past line-ups for it are deleted too. Switch it off instead to keep them.`)) return;
    const { error } = await tbl("juniors_roles").delete().eq("id", r.id); if (error) toast.error(error.message); else onChange();
  };
  const sorted = [...roles].sort((a, b) => a.sort_order - b.sort_order);
  const move = async (id: string, dir: -1 | 1) => {
    const i = sorted.findIndex((r) => r.id === id); const j = i + dir;
    if (i < 0 || j < 0 || j >= sorted.length) return;
    await tbl("juniors_roles").update({ sort_order: sorted[j].sort_order }).eq("id", sorted[i].id);
    await tbl("juniors_roles").update({ sort_order: sorted[i].sort_order }).eq("id", sorted[j].id);
    onChange();
  };
  return (
    <div className="space-y-3">
      <Card className="bg-white/[0.03] border-white/10 text-white"><CardContent className="p-0 divide-y divide-white/[0.06]">
        {sorted.map((r) => (
          <div key={r.id} className={`flex items-center gap-2 px-4 py-2 ${r.is_active ? "" : "opacity-50"}`}>
            <Input defaultValue={r.title} onBlur={(e) => e.target.value.trim() && e.target.value !== r.title && patch(r.id, { title: e.target.value.trim() })} className="h-8 bg-transparent border-transparent hover:border-neutral-700 text-white font-semibold max-w-xs" />
            <span className="text-[11px] uppercase tracking-wide text-white/40 w-24">{r.group_label}</span>
            <Input defaultValue={r.location ?? ""} placeholder="Location" onBlur={(e) => (e.target.value.trim() || null) !== (r.location ?? null) && patch(r.id, { location: e.target.value.trim() || null })} className="h-8 bg-transparent border-transparent hover:border-neutral-700 text-white/70 text-sm max-w-[180px]" />
            <div className="ml-auto flex items-center gap-1">
              <Button size="icon" variant="ghost" className="h-7 w-7 text-white/40 hover:text-white" onClick={() => move(r.id, -1)}><ArrowUp className="w-3.5 h-3.5" /></Button>
              <Button size="icon" variant="ghost" className="h-7 w-7 text-white/40 hover:text-white" onClick={() => move(r.id, 1)}><ArrowDown className="w-3.5 h-3.5" /></Button>
              <Switch checked={r.is_active} onCheckedChange={(v) => patch(r.id, { is_active: v })} />
              <Button size="icon" variant="ghost" className="h-7 w-7 text-white/30 hover:text-rose-300" onClick={() => remove(r)}><Trash2 className="w-3.5 h-3.5" /></Button>
            </div>
          </div>
        ))}
      </CardContent></Card>
      <div className="flex items-center gap-2 flex-wrap">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="New role…" className="h-9 max-w-xs bg-neutral-900 border-neutral-700 text-white" />
        <select value={group} onChange={(e) => setGroup(e.target.value)} className="h-9 rounded-md bg-neutral-900 border border-neutral-700 px-2 text-sm text-white">
          {groups.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
        <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Location (optional)" className="h-9 max-w-[200px] bg-neutral-900 border-neutral-700 text-white" />
        <Button onClick={add} disabled={!title.trim()} className="h-9 text-white font-bold" style={{ backgroundColor: NLA_RED }}><Plus className="w-4 h-4 mr-1" /> Role</Button>
      </div>
    </div>
  );
};

/* ───── History: the last Tuesdays ───── */
const History = ({ roles, tasks, today }: { roles: JuniorsRole[]; tasks: JuniorsTask[]; today: string }) => {
  const dates = useMemo(() => recentTuesdays(today, 8), [today]);
  const { data } = useQuery({
    queryKey: ["juniors-history", dates[0]],
    queryFn: async () => {
      const out: Record<string, { lineup: JuniorsLineupRow[]; done: JuniorsCompletion[] }> = {};
      for (const d of dates) {
        const [{ data: l }, { data: c }] = await Promise.all([rpc("get_juniors_lineup", { _date: d }), rpc("get_juniors_completions", { _date: d })]);
        out[d] = { lineup: (l as JuniorsLineupRow[]) ?? [], done: (c as JuniorsCompletion[]) ?? [] };
      }
      return out;
    },
  });
  const activeTasks = tasks.filter((t) => t.is_active).length;
  const roleById = new Map(roles.map((r) => [r.id, r]));
  return (
    <div className="space-y-3">
      {dates.map((d) => {
        const h = data?.[d];
        const done = h?.done.length ?? 0;
        const last = h?.done.length ? new Date(Math.max(...h.done.map((x) => new Date(x.done_at).getTime()))) : null;
        return (
          <Card key={d} className="bg-white/[0.03] border-white/10 text-white">
            <CardContent className="p-4">
              <div className="flex items-center gap-3 flex-wrap">
                <p className="font-bold w-32">{fmtDay(d)}</p>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${activeTasks && done >= activeTasks ? "bg-emerald-500/15 text-emerald-300" : done ? "bg-amber-500/15 text-amber-300" : "bg-white/5 text-white/40"}`}>
                  {done === 0 ? "No setup recorded" : done >= activeTasks ? <>All set{last && ` by ${last.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" })}`}<Check className="inline w-3 h-3 ml-1" /></> : `${done} of ${activeTasks} done`}
                </span>
                <p className="text-xs text-white/45 flex-1 min-w-[200px]">
                  {h?.lineup.length ? h.lineup.map((l) => `${roleById.get(l.role_id)?.title ?? "Role"}: ${l.child_first_name}`).join(" · ") : "No line-up"}
                </p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default AdminJuniorsSession;
