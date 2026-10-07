// Weekly Standout Moments — one free-text entry per week per program, written
// by Chrissy, the little nuggets that make the report real. This week's box on
// top (or the week the reminder email linked to), every entry in a table
// below, each one editable and deletable.
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Sparkles, Save, Pencil, Trash2, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { type HawkWeeklyMoments, hawkTodayET, hawkWeekStart, hawkMomentsTargetWeek, hawkWeekLabel } from "@/lib/hawkSquad";
import type { ProgramConfig } from "@/lib/programs";

const tblFor = (name: string) => supabase.from(name as never) as never as {
  select: (s: string) => { order: (k: string, o: { ascending: boolean }) => Promise<{ data: unknown; error: { message: string } | null }> };
  upsert: (v: Record<string, unknown>, o: { onConflict: string }) => Promise<{ error: { message: string } | null }>;
  delete: () => { eq: (k: string, v: string) => Promise<{ error: { message: string } | null }> };
};

const shift = (monday: string, weeks: number) => {
  const d = new Date(`${monday}T12:00:00`); d.setDate(d.getDate() + weeks * 7);
  return hawkWeekStart(d.toLocaleDateString("en-CA"));
};

const ProgramWeeklyMoments = ({ program }: { program: ProgramConfig }) => {
  const tbl = () => tblFor(program.tables.moments);
  const { primary, primaryDark, accent, onAccent } = program.brand;
  const qc = useQueryClient();
  const { user } = useAuth();
  const [params] = useSearchParams();
  const today = hawkTodayET();
  // Nothing is due before the programme's first week; until then the box
  // simply opens on that first week.
  const due = hawkMomentsTargetWeek(today, program.momentsDueFrom);
  const dueActive = due >= program.momentsStart;
  const fromLink = params.get("moments");
  const [week, setWeek] = useState<string>(fromLink && /^\d{4}-\d{2}-\d{2}$/.test(fromLink) ? hawkWeekStart(fromLink) : (dueActive ? due : program.momentsStart));
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: entries = [], isLoading, isError, error } = useQuery({
    queryKey: ["program-moments", program.key],
    queryFn: async (): Promise<HawkWeeklyMoments[]> => {
      const { data, error } = await tbl().select("*").order("week_start", { ascending: false });
      if (error) throw new Error(error.message);
      return (data as HawkWeeklyMoments[]) ?? [];
    },
  });

  const current = useMemo(() => entries.find((e) => e.week_start === week) ?? null, [entries, week]);
  useEffect(() => { setNotes(current?.notes ?? ""); }, [current, week]);
  const dirty = notes !== (current?.notes ?? "");

  // Scroll here when the reminder email brought them.
  useEffect(() => {
    if (fromLink) document.getElementById("moments")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [fromLink]);

  const save = async () => {
    setSaving(true);
    const { error } = await tbl().upsert(
      { week_start: week, notes: notes.trim(), author_email: user?.email ?? null, updated_at: new Date().toISOString() },
      { onConflict: "week_start" },
    );
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["program-moments", program.key] });
    toast.success(`Saved — week of ${hawkWeekLabel(week)}.`);
  };

  const remove = async (e: HawkWeeklyMoments) => {
    if (!window.confirm(`Delete the moments for the week of ${hawkWeekLabel(e.week_start)}?`)) return;
    const { error } = await tbl().delete().eq("id", e.id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["program-moments", program.key] });
    if (e.week_start === week) setNotes("");
    toast.success("Deleted.");
  };

  const isDue = dueActive && week === due;
  const dueWritten = !dueActive || !!entries.find((e) => e.week_start === due && e.notes.trim());

  return (
    <section id="moments" className="rounded-2xl border p-4 md:p-6 space-y-4 scroll-mt-6 shadow-lg" style={{ borderColor: `${accent}66`, backgroundImage: `linear-gradient(135deg, ${primary}, ${primaryDark})` }}>
      <div>
        <div className="flex items-center gap-3">
          <span className="rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-[0.2em]" style={{ backgroundColor: accent, color: onAccent }}>In the coaches' words</span>
          <h3 className="text-lg font-bold flex items-center gap-2"><Sparkles className="h-5 w-5" style={{ color: accent }} /> Weekly Standout Moments</h3>
        </div>
        <p className="text-white/60 text-sm mt-2">
          A few sentences a week — what the kids did, what they enjoyed, anything that made you smile. The grant report weaves these in.
          {!dueWritten && <span style={{ color: accent }}> This week's is still waiting; Chrissy gets a reminder at 8 AM until it is written.</span>}
          {!dueActive && <span className="text-white/45"> Starts the week of {hawkWeekLabel(program.momentsStart)}.</span>}
        </p>
      </div>

      {/* The box */}
      <Card className="bg-black/25 border-white/10 text-white" style={{ borderColor: isDue && !current?.notes ? `${accent}99` : undefined }}>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8 text-white/50 hover:text-white" onClick={() => setWeek(shift(week, -1))}><ChevronLeft className="w-4 h-4" /></Button>
              <p className="font-semibold px-1">Week of {hawkWeekLabel(week)}{isDue && <span className="ml-2 text-[10px] uppercase tracking-wider" style={{ color: accent }}>this week</span>}</p>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-white/50 hover:text-white" onClick={() => setWeek(shift(week, 1))} disabled={shift(week, 1) > hawkWeekStart(today)}><ChevronRight className="w-4 h-4" /></Button>
            </div>
            {current && <p className="text-[11px] text-white/35">Last saved {new Date(current.updated_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}{current.author_email ? ` · ${current.author_email.split("@")[0]}` : ""}</p>}
          </div>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={5}
            placeholder={"e.g. Friendly game of dodgeball Tuesday and pizza from Domino's after. Thursday a few of the kids helped each other get ready for the SAT prep class."}
            className="bg-neutral-900 border-neutral-700 text-white text-sm leading-relaxed" />
          <div className="flex justify-end">
            <Button onClick={save} disabled={saving || !dirty || !notes.trim()} className="font-bold gap-2 hover:opacity-90" style={{ backgroundColor: accent, color: onAccent }}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {current ? "Save changes" : "Save"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Every entry */}
      <div className="flex items-end justify-between gap-3 pt-1">
        <div>
          <p className="font-bold">Saved weeks <span className="text-white/45 font-normal text-sm">· {entries.filter((e) => e.notes.trim()).length}</span></p>
          <p className="text-xs text-white/45">Every week written so far. Edit opens it in the box above; the trash deletes it.</p>
        </div>
      </div>
      <Card className="bg-black/25 border-white/10 text-white">
        <CardContent className="p-0">
          {isLoading ? <p className="p-4 text-white/40 text-sm">Loading…</p>
          : isError ? <p className="p-4 text-rose-300 text-sm">Couldn't load: {(error as Error)?.message}</p>
          : entries.length === 0 ? <p className="p-4 text-white/35 text-sm">No entries yet.</p>
          : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-white/40 border-b border-white/10">
                  <th className="text-left px-4 py-2 font-medium w-44">Week</th>
                  <th className="text-left px-2 py-2 font-medium">Moments</th>
                  <th className="text-left px-2 py-2 font-medium w-32 hidden md:table-cell">Updated</th>
                  <th className="px-2 py-2 w-24"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {entries.map((e) => (
                  <tr key={e.id} className={e.week_start === week ? "bg-white/[0.06]" : ""}>
                    <td className="px-4 py-2.5 font-semibold whitespace-nowrap align-top">{hawkWeekLabel(e.week_start)}</td>
                    <td className="px-2 py-2.5 text-white/75 align-top whitespace-pre-wrap">{e.notes}</td>
                    <td className="px-2 py-2.5 text-white/35 text-xs align-top hidden md:table-cell">{new Date(e.updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</td>
                    <td className="px-2 py-2 align-top">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-white/40 hover:text-white" title="Edit" onClick={() => { setWeek(e.week_start); document.getElementById("moments")?.scrollIntoView({ behavior: "smooth", block: "start" }); }}><Pencil className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-white/30 hover:text-rose-300" title="Delete" onClick={() => remove(e)}><Trash2 className="w-4 h-4" /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </section>
  );
};

export default ProgramWeeklyMoments;
