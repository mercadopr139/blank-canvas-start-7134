// Hawk Squad — Attendance.
//
// A month at a glance and one day in detail. The calendar shows which days
// Hawk Squad runs (Tuesday and Thursday unless a day is switched), how many
// came each day, and the day you pick shows who: their photo, when they
// signed in, and GOING HOME -- Bus or Dismissed -- which the coach sets before
// the bus leaves. Dismissed is only offered when the parent signed the
// dismissal waiver; a database trigger refuses it otherwise, so the greyed
// button is a courtesy, not the lock.
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Bus, DoorOpen, Plus, Trash2, Search, Monitor, Users } from "lucide-react";
import {
  type GoingHome, hawkPhotoUrl, hawkTodayET, isHawkPracticeDay, datesInMonth,
} from "@/lib/hawkSquad";

interface DayRow {
  id: string;
  registration_id: string;
  check_in_at: string;
  check_in_date: string;
  going_home: GoingHome;
  is_manual: boolean;
  hawk_squad_registrations: {
    child_first_name: string;
    child_last_name: string;
    child_headshot_url: string | null;
    dismissal_waiver_signed_at: string | null;
    grade_level: string | null;
  } | null;
}

interface Student {
  id: string;
  child_first_name: string;
  child_last_name: string;
  child_headshot_url: string | null;
}

const att = () => supabase.from("hawk_squad_attendance" as never) as never as {
  select: (s: string) => {
    gte: (k: string, v: string) => { lte: (k: string, v: string) => { order: (k: string, o: { ascending: boolean }) => Promise<{ data: unknown; error: unknown }> } };
  };
  insert: (v: unknown) => Promise<{ error: { message: string } | null }>;
  update: (v: unknown) => { eq: (k: string, v: string) => Promise<{ error: { message: string } | null }> };
  delete: () => { eq: (k: string, v: string) => Promise<{ error: { message: string } | null }> };
};
const days = () => supabase.from("hawk_squad_practice_days" as never) as never as {
  select: (s: string) => { gte: (k: string, v: string) => { lte: (k: string, v: string) => Promise<{ data: unknown; error: unknown }> } };
  upsert: (v: unknown, o: { onConflict: string }) => Promise<{ error: { message: string } | null }>;
};
const rpc = (name: string, args?: Record<string, unknown>) =>
  (supabase.rpc as unknown as (n: string, a?: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>)(name, args);

const monthLabel = (y: number, m0: number) =>
  new Date(y, m0, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
const timeET = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" });

const AdminHawkSquadAttendance = () => {
  const qc = useQueryClient();
  const today = hawkTodayET();
  const [ym, setYm] = useState(() => ({ y: Number(today.slice(0, 4)), m0: Number(today.slice(5, 7)) - 1 }));
  const [selected, setSelected] = useState<string>(today);
  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const dates = useMemo(() => datesInMonth(ym.y, ym.m0), [ym]);
  const first = dates[0], last = dates[dates.length - 1];

  const { data: overrides = {} } = useQuery({
    queryKey: ["hawk-practice-days", first],
    queryFn: async () => {
      const { data, error } = await days().select("date, is_practice_day").gte("date", first).lte("date", last);
      if (error) throw error as Error;
      const m: Record<string, boolean> = {};
      ((data as Array<{ date: string; is_practice_day: boolean }>) ?? []).forEach((r) => { m[r.date] = r.is_practice_day; });
      return m;
    },
  });

  const { data: rows = [], isLoading, isError, error } = useQuery({
    queryKey: ["hawk-attendance", first],
    queryFn: async () => {
      const { data, error } = await att()
        .select("id, registration_id, check_in_at, check_in_date, going_home, is_manual, hawk_squad_registrations(child_first_name, child_last_name, child_headshot_url, dismissal_waiver_signed_at, grade_level)")
        .gte("check_in_date", first).lte("check_in_date", last)
        .order("check_in_at", { ascending: true });
      if (error) throw error as Error;
      return (data as DayRow[]) ?? [];
    },
  });

  const { data: students = [] } = useQuery({
    queryKey: ["hawk-kiosk-roster"],
    enabled: adding,
    queryFn: async () => {
      const { data, error } = await rpc("hawk_squad_kiosk_roster");
      if (error) throw error as Error;
      return (data as Student[]) ?? [];
    },
  });

  const byDate = useMemo(() => {
    const m: Record<string, DayRow[]> = {};
    rows.forEach((r) => { (m[r.check_in_date] ||= []).push(r); });
    return m;
  }, [rows]);
  const dayRows = byDate[selected] ?? [];
  const practiceDates = dates.filter((d) => isHawkPracticeDay(d, overrides));
  const distinctMonth = new Set(rows.map((r) => r.registration_id)).size;
  const practiceDaysSoFar = practiceDates.filter((d) => d <= today).length;

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["hawk-attendance", first] });
    qc.invalidateQueries({ queryKey: ["hawk-practice-days", first] });
  };

  const toggleDay = async (date: string) => {
    const next = !isHawkPracticeDay(date, overrides);
    const { error } = await days().upsert({ date, is_practice_day: next }, { onConflict: "date" });
    if (error) { toast.error(error.message); return; }
    refresh();
    toast.success(next ? `${date} is a Hawk Squad day.` : `${date} is off.`);
  };

  const setGoingHome = async (row: DayRow, going_home: GoingHome) => {
    if (row.going_home === going_home) return;
    setBusy(row.id);
    const { error } = await att().update({ going_home }).eq("id", row.id);
    setBusy(null);
    if (error) { toast.error(error.message); return; }
    refresh();
  };

  const remove = async (row: DayRow) => {
    const name = row.hawk_squad_registrations?.child_first_name ?? "this check-in";
    if (!window.confirm(`Remove ${name}'s check-in for ${selected}?`)) return;
    const { error } = await att().delete().eq("id", row.id);
    if (error) { toast.error(error.message); return; }
    refresh();
  };

  const addStudent = async (s: Student) => {
    const { error } = await att().insert({ registration_id: s.id, check_in_date: selected, is_manual: true });
    if (error) {
      toast.error(/duplicate/i.test(error.message) ? `${s.child_first_name} is already checked in that day.` : error.message);
      return;
    }
    setAdding(false); setSearch("");
    refresh();
    toast.success(`${s.child_first_name} added for ${selected}.`);
  };

  // Calendar cells: pad to Monday-first weeks.
  const lead = (new Date(`${first}T12:00:00`).getDay() + 6) % 7;
  const cells: (string | null)[] = [...Array(lead).fill(null), ...dates];

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-6xl mx-auto text-white">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold">Hawk Squad — Attendance</h2>
          <p className="text-neutral-400 text-sm mt-1">
            Tap a day to see who came. Click the dot on a date to switch a day on or off — Tuesday and Thursday by default.
          </p>
        </div>
        <Button variant="outline" onClick={() => window.open("/check-in/hawk-squad", "_blank")}
          className="bg-transparent border-neutral-700 text-neutral-300 hover:text-white">
          <Monitor className="w-4 h-4 mr-1.5" /> Open check-in
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: "Here today", value: (byDate[today] ?? []).length, sub: isHawkPracticeDay(today, overrides) ? "a Hawk Squad day" : "not a Hawk Squad day" },
          { label: "Students this month", value: distinctMonth, sub: `${rows.length} check-ins` },
          { label: "Practice days so far", value: practiceDaysSoFar, sub: `${practiceDates.length} planned in ${monthLabel(ym.y, ym.m0).split(" ")[0]}` },
        ].map((t) => (
          <Card key={t.label} className="bg-white/[0.03] border-white/10 text-white">
            <CardContent className="p-4">
              <p className="text-[10px] uppercase tracking-wider text-white/40">{t.label}</p>
              <p className="text-3xl font-black mt-1">{t.value}</p>
              <p className="text-xs text-white/40">{t.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        {/* ── Calendar ── */}
        <Card className="bg-white/[0.03] border-white/10 text-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <Button variant="ghost" size="icon" className="h-8 w-8 text-white/50 hover:text-white"
                onClick={() => setYm(({ y, m0 }) => (m0 === 0 ? { y: y - 1, m0: 11 } : { y, m0: m0 - 1 }))}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <p className="font-bold">{monthLabel(ym.y, ym.m0)}</p>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-white/50 hover:text-white"
                onClick={() => setYm(({ y, m0 }) => (m0 === 11 ? { y: y + 1, m0: 0 } : { y, m0: m0 + 1 }))}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-[10px] uppercase tracking-wider text-white/35 mb-1">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <div key={d}>{d}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {cells.map((d, i) => {
                if (!d) return <div key={`pad-${i}`} />;
                const on = isHawkPracticeDay(d, overrides);
                const n = (byDate[d] ?? []).length;
                const isSel = d === selected;
                return (
                  <div key={d}
                    className={`relative rounded-lg border p-1.5 min-h-[58px] text-left transition-colors cursor-pointer ${isSel ? "border-green-400/70 bg-green-500/10" : on ? "border-white/15 bg-white/[0.04] hover:bg-white/[0.07]" : "border-white/[0.06] bg-transparent hover:bg-white/[0.03]"}`}
                    onClick={() => setSelected(d)}>
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-semibold ${d === today ? "text-green-300" : on ? "text-white/85" : "text-white/30"}`}>{Number(d.slice(8, 10))}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleDay(d); }}
                        title={on ? "Hawk Squad day — click to switch off" : "Off — click to make it a Hawk Squad day"}
                        className={`w-3 h-3 rounded-full border ${on ? "bg-green-500 border-green-400" : "bg-transparent border-white/25"}`} />
                    </div>
                    {n > 0 && <p className="mt-1 text-lg font-black leading-none">{n}</p>}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* ── The day ── */}
        <Card className="bg-white/[0.03] border-white/10 text-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
              <div>
                <p className="font-bold">
                  {new Date(`${selected}T12:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                </p>
                <p className="text-xs text-white/40">
                  {dayRows.length} checked in · {dayRows.filter((r) => r.going_home === "dismissed").length} dismissed from NLA
                  {!isHawkPracticeDay(selected, overrides) && " · not a Hawk Squad day"}
                </p>
              </div>
              <Button size="sm" onClick={() => setAdding((v) => !v)} className="h-8 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold">
                <Plus className="w-3.5 h-3.5 mr-1" /> Add a student
              </Button>
            </div>

            {adding && (
              <div className="mb-3 rounded-lg border border-white/10 bg-black/30 p-3">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-white/30" />
                  <Input value={search} onChange={(e) => setSearch(e.target.value)} autoFocus placeholder="Student's name…"
                    className="pl-8 h-9 bg-neutral-900 border-neutral-700 text-white text-sm" />
                </div>
                <div className="mt-2 max-h-48 overflow-y-auto space-y-1">
                  {students
                    .filter((s) => `${s.child_first_name} ${s.child_last_name}`.toLowerCase().includes(search.trim().toLowerCase()))
                    .filter((s) => !dayRows.some((r) => r.registration_id === s.id))
                    .slice(0, 12)
                    .map((s) => (
                      <button key={s.id} onClick={() => addStudent(s)}
                        className="w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-white/10">
                        <span className="w-7 h-7 rounded-full overflow-hidden bg-white/10 shrink-0">
                          {hawkPhotoUrl(s.child_headshot_url) && <img src={hawkPhotoUrl(s.child_headshot_url)!} alt="" className="w-full h-full object-cover" />}
                        </span>
                        {s.child_first_name} {s.child_last_name}
                      </button>
                    ))}
                </div>
              </div>
            )}

            {isLoading ? (
              <p className="text-white/40 py-8 text-center text-sm">Loading…</p>
            ) : isError ? (
              <p className="text-rose-300 py-4 text-sm">Couldn't load attendance: {(error as Error)?.message}</p>
            ) : dayRows.length === 0 ? (
              <p className="text-white/35 py-8 text-center text-sm flex items-center justify-center gap-2"><Users className="w-4 h-4" /> Nobody checked in.</p>
            ) : (
              <div className="divide-y divide-white/[0.06]">
                {dayRows.map((r) => {
                  const s = r.hawk_squad_registrations;
                  const canDismiss = !!s?.dismissal_waiver_signed_at;
                  return (
                    <div key={r.id} className="flex items-center gap-3 py-2.5">
                      <div className="w-10 h-10 rounded-full overflow-hidden bg-white/10 shrink-0 ring-1 ring-white/15">
                        {hawkPhotoUrl(s?.child_headshot_url) && <img src={hawkPhotoUrl(s?.child_headshot_url)!} alt="" className="w-full h-full object-cover" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold truncate">{s?.child_first_name} {s?.child_last_name}
                          {s?.grade_level && <span className="ml-2 text-xs text-white/40">{s.grade_level}</span>}
                        </p>
                        <p className="text-xs text-white/40">{timeET(r.check_in_at)}{r.is_manual ? " · added by staff" : ""}</p>
                      </div>
                      {/* Going home. Two buttons, one lit. */}
                      <div className="flex items-center rounded-lg border border-white/10 overflow-hidden shrink-0">
                        <button onClick={() => setGoingHome(r, "bus")} disabled={busy === r.id}
                          className={`h-8 px-2.5 text-xs font-bold flex items-center gap-1 ${r.going_home === "bus" ? "bg-sky-500/25 text-sky-200" : "text-white/40 hover:text-white"}`}>
                          <Bus className="w-3.5 h-3.5" /> Bus
                        </button>
                        <button onClick={() => setGoingHome(r, "dismissed")} disabled={busy === r.id || !canDismiss}
                          title={canDismiss ? "Dismissed from NLA" : "No dismissal waiver on file — bus only"}
                          className={`h-8 px-2.5 text-xs font-bold flex items-center gap-1 border-l border-white/10 ${r.going_home === "dismissed" ? "bg-amber-500/25 text-amber-200" : canDismiss ? "text-white/40 hover:text-white" : "text-white/15 cursor-not-allowed"}`}>
                          <DoorOpen className="w-3.5 h-3.5" /> Dismissed
                        </button>
                      </div>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-white/30 hover:text-rose-300" title="Remove this check-in" onClick={() => remove(r)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
            {dayRows.some((r) => !r.hawk_squad_registrations?.dismissal_waiver_signed_at) && (
              <p className="mt-3 text-[11px] text-white/35 flex items-center gap-1.5">
                <Badge className="bg-white/5 text-white/40 border-white/10 text-[10px]">Bus only</Badge>
                students without a dismissal waiver can't be marked Dismissed. Record the waiver on their registration first.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminHawkSquadAttendance;
