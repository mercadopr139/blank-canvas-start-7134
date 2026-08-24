import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { startOfMonth, endOfMonth, getDaysInMonth, getDay, format, addMonths, subMonths } from "date-fns";
import { ChevronLeft, ChevronRight, Users, CalendarDays, Activity, Star } from "lucide-react";

// Smile Lab Intelligence — a month calendar showing how many youth attended each
// day (mirrors the Attendance Intelligence calendar, scoped to Smile Lab), plus
// month totals. Click a day to see who came + that day's journal.

const TEAL = "#2dd4bf";
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const SmileLabIntelligence = () => {
  const [month, setMonth] = useState(new Date());
  const [selected, setSelected] = useState<string | null>(null);

  const monthStart = iso(startOfMonth(month));
  const monthEnd = iso(endOfMonth(month));

  const { data: records = [] } = useQuery({
    queryKey: ["smile-lab-intel", monthStart],
    queryFn: async (): Promise<{ check_in_date: string; registration_id: string }[]> => {
      const { data, error } = await supabase
        .from("attendance_records")
        .select("check_in_date, registration_id")
        .eq("program_source", "Smile Lab")
        .gte("check_in_date", monthStart)
        .lte("check_in_date", monthEnd);
      if (error) throw error;
      return (data as any) ?? [];
    },
  });

  // Count + unique kids per date.
  const byDate = useMemo(() => {
    const m: Record<string, number> = {};
    for (const r of records) m[r.check_in_date] = (m[r.check_in_date] ?? 0) + 1;
    return m;
  }, [records]);

  const stats = useMemo(() => {
    const sessions = Object.keys(byDate).length;
    const total = records.length;
    const unique = new Set(records.map((r) => r.registration_id)).size;
    return { sessions, total, unique, avg: sessions ? Math.round(total / sessions) : 0 };
  }, [records, byDate]);

  // Build the calendar cells (leading blanks + days).
  const cells = useMemo(() => {
    const first = startOfMonth(month);
    const lead = getDay(first);
    const days = getDaysInMonth(month);
    const out: (string | null)[] = Array.from({ length: lead }, () => null);
    for (let d = 1; d <= days; d++) out.push(iso(new Date(month.getFullYear(), month.getMonth(), d)));
    return out;
  }, [month]);

  return (
    <div className="space-y-4">
      {/* Month totals */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat icon={<CalendarDays className="h-4 w-4" />} label="Sessions" value={stats.sessions} />
        <Stat icon={<Activity className="h-4 w-4" />} label="Check-ins" value={stats.total} />
        <Stat icon={<Users className="h-4 w-4" />} label="Kids reached" value={stats.unique} />
        <Stat icon={<Star className="h-4 w-4" />} label="Avg / session" value={stats.avg} />
      </div>

      {/* Calendar */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <div className="flex items-center justify-between mb-3">
          <button onClick={() => setMonth((m) => subMonths(m, 1))} className="h-8 w-8 grid place-items-center rounded-lg bg-white/5 hover:bg-white/10 border border-white/10">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="font-bold text-white">{format(month, "MMMM yyyy")}</div>
          <button onClick={() => setMonth((m) => addMonths(m, 1))} className="h-8 w-8 grid place-items-center rounded-lg bg-white/5 hover:bg-white/10 border border-white/10">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 mb-1">
          {WEEKDAYS.map((w) => <div key={w} className="text-center text-[10px] uppercase tracking-wide text-white/30 py-1">{w}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((dateStr, i) => {
            if (!dateStr) return <div key={i} />;
            const day = Number(dateStr.slice(8, 10));
            const count = byDate[dateStr] ?? 0;
            const has = count > 0;
            return (
              <button key={i} disabled={!has} onClick={() => has && setSelected(dateStr)}
                className={`aspect-square rounded-lg border p-1 flex flex-col items-center justify-center transition-colors ${
                  has ? "border-teal-400/30 hover:border-teal-400/60 cursor-pointer" : "border-white/5"}`}
                style={has ? { background: "rgba(45,212,191,0.10)" } : undefined}>
                <span className={`text-xs ${has ? "text-white/60" : "text-white/25"}`}>{day}</span>
                {has && <span className="text-base font-extrabold leading-none" style={{ color: TEAL }}>{count}</span>}
              </button>
            );
          })}
        </div>
        <p className="text-[11px] text-white/30 mt-3">Each highlighted day shows how many youth checked in. Tap a day for the roster + journal.</p>
      </div>

      {selected && <DayDetail date={selected} onClose={() => setSelected(null)} />}
    </div>
  );
};

const Stat = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) => (
  <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
    <div className="flex items-center gap-1.5 text-white/40 text-[11px] uppercase tracking-wide mb-1">{icon}{label}</div>
    <div className="text-2xl font-extrabold text-white">{value}</div>
  </div>
);

const DayDetail = ({ date, onClose }: { date: string; onClose: () => void }) => {
  const [attendees, setAttendees] = useState<{ child_first_name: string; child_last_name: string }[]>([]);
  const [notes, setNotes] = useState<{ caring_note: string | null; sharing_note: string | null; highlights: string[] } | null>(null);

  useEffect(() => {
    (async () => {
      const { data: att } = await (supabase.rpc as any)("get_smile_lab_attendance", { _date: date });
      setAttendees((att as any) ?? []);
      const { data: sess } = await (supabase.from("smile_lab_sessions" as never) as any)
        .select("caring_note, sharing_note, highlights").eq("session_date", date).maybeSingle();
      setNotes(sess ?? null);
    })();
  }, [date]);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-[#0b0f1a] border-white/10 text-white max-w-md">
        <DialogHeader>
          <DialogTitle>{format(new Date(date + "T00:00:00"), "EEEE, MMMM d, yyyy")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <div className="text-xs font-semibold text-white/50 mb-1">Checked in ({attendees.length})</div>
            {attendees.length === 0 ? <p className="text-sm text-white/40">No check-ins.</p> : (
              <div className="flex flex-wrap gap-1.5">
                {attendees.map((a, i) => <span key={i} className="text-xs px-2 py-1 rounded-md bg-white/5 border border-white/10">{a.child_first_name} {a.child_last_name[0]}.</span>)}
              </div>
            )}
          </div>
          {notes?.caring_note?.trim() && (
            <div><div className="text-xs font-semibold text-teal-300 mb-0.5">🦷 Caring for Your Smile</div><p className="text-sm text-white/80 whitespace-pre-wrap">{notes.caring_note}</p></div>
          )}
          {notes?.sharing_note?.trim() && (
            <div><div className="text-xs font-semibold text-yellow-300 mb-0.5">😊 Sharing Your Smile</div><p className="text-sm text-white/80 whitespace-pre-wrap">{notes.sharing_note}</p></div>
          )}
          {notes?.highlights?.length ? (
            <div><div className="text-xs font-semibold text-white/50 mb-0.5">⭐ Standout Moments</div>
              <ul className="list-disc list-inside text-sm text-white/80">{notes.highlights.map((h, i) => <li key={i}>{h}</li>)}</ul>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SmileLabIntelligence;
