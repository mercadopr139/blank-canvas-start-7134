// Verse of the Week — the admin side, a tab in the Practice Plan.
//
// Monday flow: type the theme for the week, Generate, review/edit the five
// days, tick "Show on board", Save. Buildable weeks ahead like the plan.
// The AI picks references and writes context/questions/answers; the ESV text
// comes from the API (via the verse-week function). The mentor's answers are
// hidden on the board until tapped, but the coach sees and edits them here.
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  ChevronLeft, ChevronRight, Sparkles, Loader2, Save, RefreshCw, BookOpen, Eye, EyeOff,
} from "lucide-react";
import { toast } from "sonner";
import { mondayOf, addDays, formatWeekRange, SeasonMode } from "@/lib/practicePlan";

const DAYS: { n: number; label: string }[] = [
  { n: 1, label: "Monday" },
  { n: 2, label: "Tuesday" },
  { n: 3, label: "Wednesday" },
  { n: 4, label: "Thursday" },
  { n: 5, label: "Friday" },
];

// A named person in the passage, with the one-liner that tells the room who
// they were. Editable here like everything else the AI writes.
interface VerseFigure {
  name: string;
  who: string;
}

interface VerseDay {
  weekday: number;
  reference: string;
  text: string;
  context: string;
  figures: VerseFigure[];
  questions: string[];
  answers: string[];
}

const emptyDay = (weekday: number): VerseDay => ({
  weekday, reference: "", text: "", context: "", figures: [], questions: [""], answers: [""],
});

const VerseOfTheWeekAdmin = ({ season = "in_season" }: { season?: SeasonMode }) => {
  const qc = useQueryClient();
  const [weekStart, setWeekStart] = useState<string>(() => mondayOf());
  const [theme, setTheme] = useState("");
  const [days, setDays] = useState<VerseDay[]>(DAYS.map((d) => emptyDay(d.n)));
  const [published, setPublished] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [regenDay, setRegenDay] = useState<number | null>(null);
  const [dirty, setDirty] = useState(false);

  // Load whatever is already saved for the week being viewed.
  const { data: loaded, isFetching } = useQuery({
    queryKey: ["verse-week", weekStart],
    queryFn: async () => {
      const { data: wk } = await supabase
        .from("board_verse_weeks" as never)
        .select("week_start, theme, is_published")
        .eq("week_start", weekStart)
        .maybeSingle();
      const { data: dys } = await supabase
        .from("board_verse_days" as never)
        .select("weekday, reference, text, context, figures, questions, answers")
        .eq("week_start", weekStart)
        .order("weekday");
      return { wk: (wk as never) ?? null, dys: (dys as never) ?? [] };
    },
  });

  useEffect(() => {
    const wk = (loaded?.wk ?? null) as { theme?: string; is_published?: boolean } | null;
    const dys = (loaded?.dys ?? []) as Array<{
      weekday: number; reference: string; text: string; context: string | null;
      figures: unknown; questions: unknown; answers: unknown;
    }>;
    setTheme(wk?.theme ?? "");
    setPublished(!!wk?.is_published);
    setDays(
      DAYS.map((d) => {
        const row = dys.find((r) => r.weekday === d.n);
        if (!row) return emptyDay(d.n);
        return {
          weekday: d.n,
          reference: row.reference ?? "",
          text: row.text ?? "",
          context: row.context ?? "",
          figures: Array.isArray(row.figures) ? (row.figures as VerseFigure[]) : [],
          questions: [...(Array.isArray(row.questions) ? (row.questions as string[]) : []), ""].slice(0, 1),
          answers: [...(Array.isArray(row.answers) ? (row.answers as string[]) : []), ""].slice(0, 1),
        };
      })
    );
    setDirty(false);
  }, [loaded]);

  const hasContent = days.some((d) => d.reference.trim() && d.text.trim());

  const shiftWeek = (dir: number) => setWeekStart(addDays(weekStart, dir * 7));

  const generate = async (regenerate = false) => {
    if (theme.trim().length < 3) {
      toast.error("Type a theme for the week first.");
      return;
    }
    setGenerating(true);
    try {
      const exclude = regenerate ? days.map((d) => d.reference).filter(Boolean) : [];
      const { data, error } = await supabase.functions.invoke("verse-week", {
        body: { theme: theme.trim(), exclude },
      });
      if (error) throw error;
      const resDays = (data?.days ?? []) as Array<{
        ref: string; esv_text: string; context: string; figures: VerseFigure[]; questions: string[]; answers: string[];
      }>;
      if (resDays.length === 0) {
        toast.error(data?.error ?? "Nothing came back. Try rewording the theme.");
        return;
      }
      setDays(
        DAYS.map((d, i) => {
          const r = resDays[i];
          if (!r) return emptyDay(d.n);
          return {
            weekday: d.n,
            reference: r.ref ?? "",
            text: r.esv_text ?? "",
            context: r.context ?? "",
            figures: Array.isArray(r.figures) ? r.figures : [],
            questions: [...(r.questions ?? []), ""].slice(0, 1),
            answers: [...(r.answers ?? []), ""].slice(0, 1),
          };
        })
      );
      setDirty(true);
      toast.success(`Generated ${resDays.length} verses — review, then Save.`);
    } catch (e) {
      toast.error((e as Error)?.message ?? "Generation failed. Try again.");
    } finally {
      setGenerating(false);
    }
  };

  // Replace ONE day. The other four are left exactly as they are — including a
  // day the room has already heard, which must never change underneath them.
  // Nothing is written until Save, same as every other edit on this tab.
  const regenerateDay = async (weekday: number) => {
    if (theme.trim().length < 3) {
      toast.error("Type a theme for the week first.");
      return;
    }
    const label = DAYS.find((x) => x.n === weekday)?.label ?? "";
    setRegenDay(weekday);
    try {
      const { data, error } = await supabase.functions.invoke("verse-week", {
        body: {
          theme: theme.trim(),
          dayLabel: label,
          // Every reference currently in the week, so the replacement is not one
          // of the other four days over again.
          exclude: days.map((x) => x.reference).filter(Boolean),
        },
      });
      if (error) throw error;
      const r = (data?.days ?? [])[0] as
        | { ref: string; esv_text: string; context: string; figures: VerseFigure[]; questions: string[]; answers: string[] }
        | undefined;
      if (!r) {
        toast.error(data?.error ?? "Nothing came back. Try again.");
        return;
      }
      setDays((prev) =>
        prev.map((x) =>
          x.weekday === weekday
            ? {
                weekday,
                reference: r.ref ?? "",
                text: r.esv_text ?? "",
                context: r.context ?? "",
                figures: Array.isArray(r.figures) ? r.figures : [],
                questions: [...(r.questions ?? []), ""].slice(0, 1),
                answers: [...(r.answers ?? []), ""].slice(0, 1),
              }
            : x
        )
      );
      setDirty(true);
      toast.success(`${label} swapped to ${r.ref} — review, then Save.`);
    } catch (e) {
      toast.error((e as Error)?.message ?? "Couldn't get a new verse. Try again.");
    } finally {
      setRegenDay(null);
    }
  };

  const patchDay = (weekday: number, patch: Partial<VerseDay>) => {
    setDays((prev) => prev.map((d) => (d.weekday === weekday ? { ...d, ...patch } : d)));
    setDirty(true);
  };
  const patchList = (weekday: number, field: "questions" | "answers", idx: number, value: string) => {
    setDays((prev) =>
      prev.map((d) => {
        if (d.weekday !== weekday) return d;
        const list = [...d[field]];
        list[idx] = value;
        return { ...d, [field]: list };
      })
    );
    setDirty(true);
  };

  const patchFigure = (weekday: number, idx: number, field: "name" | "who", value: string) => {
    setDays((prev) =>
      prev.map((d) => {
        if (d.weekday !== weekday) return d;
        const figures = d.figures.map((f, i) => (i === idx ? { ...f, [field]: value } : f));
        return { ...d, figures };
      })
    );
    setDirty(true);
  };

  const save = async () => {
    if (!hasContent) {
      toast.error("Generate the week before saving.");
      return;
    }
    setSaving(true);
    try {
      const { error: wkErr } = await supabase
        .from("board_verse_weeks" as never)
        .upsert({ week_start: weekStart, theme: theme.trim(), is_published: published, updated_at: new Date().toISOString() } as never, { onConflict: "week_start" } as never);
      if (wkErr) throw wkErr;

      // Replace the week's days wholesale — simplest correct save.
      await supabase.from("board_verse_days" as never).delete().eq("week_start", weekStart);
      const rows = days
        .filter((d) => d.reference.trim() && d.text.trim())
        .map((d) => ({
          week_start: weekStart,
          weekday: d.weekday,
          reference: d.reference.trim(),
          text: d.text.trim(),
          context: d.context.trim(),
          figures: d.figures
            .map((f) => ({ name: f.name.trim(), who: f.who.trim() }))
            .filter((f) => f.name && f.who),
          questions: d.questions.map((q) => q.trim()).filter(Boolean),
          answers: d.answers.map((a) => a.trim()).filter(Boolean),
        }));
      const { error: dErr } = await supabase.from("board_verse_days" as never).insert(rows as never);
      if (dErr) throw dErr;

      setDirty(false);
      qc.invalidateQueries({ queryKey: ["verse-week", weekStart] });
      qc.invalidateQueries({ queryKey: ["board-verse-week"] });
      toast.success(published ? "Saved — live on the board." : "Saved as draft.");
    } catch (e) {
      toast.error((e as Error)?.message ?? "Save failed. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const isThisWeek = weekStart === mondayOf();

  return (
    <div className="space-y-4">
      {/* Week nav + status */}
      <div className="flex items-center justify-between gap-3 flex-wrap rounded-xl border border-neutral-800 bg-neutral-900 p-3">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => shiftWeek(-1)} className="text-neutral-400 hover:text-white h-8 w-8" aria-label="Previous week">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <div className="text-center min-w-[190px]">
            <p className="font-bold text-white">{formatWeekRange(weekStart, season)}</p>
            <p className="text-[11px] text-neutral-500">{isThisWeek ? "This week" : "Upcoming"}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={() => shiftWeek(1)} className="text-neutral-400 hover:text-white h-8 w-8" aria-label="Next week">
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setPublished((p) => !p); setDirty(true); }}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 h-9 text-sm font-semibold transition-colors ${
              published ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-300" : "border-neutral-700 text-neutral-300 hover:text-white"
            }`}
            title="Whether this week shows on the gym board"
          >
            {published ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            {published ? "On the board" : "Draft"}
          </button>
          <Button onClick={save} disabled={saving || !dirty} className="bg-white text-black hover:bg-white/90 font-bold">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4 mr-1.5" /> Save</>}
          </Button>
        </div>
      </div>

      {/* Draft warning — the #1 gotcha: a saved draft never reaches the board. */}
      {hasContent && !published && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-200 flex items-center gap-2">
          <EyeOff className="w-4 h-4 shrink-0" />
          <span>
            This week is a <strong>Draft</strong> — it won&apos;t show on the gym board until you switch the toggle to{" "}
            <strong>On the board</strong> and hit Save.
          </span>
        </div>
      )}

      {/* Theme + generate */}
      <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4 space-y-3">
        <label className="text-xs uppercase tracking-wide text-neutral-500 font-semibold">Theme for the week</label>
        <div className="flex gap-2 flex-wrap">
          <Input
            value={theme}
            onChange={(e) => { setTheme(e.target.value); setDirty(true); }}
            placeholder="e.g. Youth struggling with identity"
            className="flex-1 min-w-[240px] bg-neutral-800 border-neutral-700 text-white"
          />
          <Button onClick={() => generate(false)} disabled={generating} className="text-white font-bold" style={{ backgroundColor: "#bf0f3e" }}>
            {generating ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Sparkles className="w-4 h-4 mr-1.5" />}
            {hasContent ? "Generate again" : "Generate week"}
          </Button>
          {hasContent && (
            <Button onClick={() => generate(true)} disabled={generating} variant="outline" className="border-neutral-700 text-neutral-300 hover:text-white bg-transparent" title="New verses, avoiding the current ones">
              <RefreshCw className="w-4 h-4 mr-1.5" /> Fresh verses
            </Button>
          )}
        </div>
        <p className="text-xs text-neutral-500">
          Five verses (Mon–Fri) on this theme, real ESV text, each with one discussion question aimed at a teenager’s own week, plus a short script the mentor reads out loud afterwards. Review and edit anything below, then Save.
        </p>
      </div>

      {isFetching && !hasContent ? (
        <p className="text-neutral-500 py-8 text-center">Loading…</p>
      ) : !hasContent ? (
        <div className="text-center py-12 text-neutral-600">
          <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p>No verses for this week yet. Type a theme and hit <span className="text-white/70 font-medium">Generate week</span>.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {days.map((d) => {
            const label = DAYS.find((x) => x.n === d.weekday)?.label ?? "";
            return (
              <div key={d.weekday} className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-xs font-bold uppercase tracking-wide text-neutral-400 w-24 shrink-0">{label}</span>
                  <Input
                    value={d.reference}
                    onChange={(e) => patchDay(d.weekday, { reference: e.target.value })}
                    placeholder="Reference"
                    className="max-w-[220px] h-8 bg-neutral-800 border-neutral-700 text-white text-sm font-semibold"
                  />
                  {/* Swap one day without touching the rest of the week — the
                      coach doesn't like Wednesday, or Monday has already been
                      read to the room and must not change under them. */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => regenerateDay(d.weekday)}
                    disabled={regenDay !== null || generating || theme.trim().length < 3}
                    title={
                      theme.trim().length < 3
                        ? "Type a theme first"
                        : `New verse for ${label} only`
                    }
                    className="ml-auto h-8 text-neutral-400 hover:text-white hover:bg-white/5 text-xs"
                  >
                    {regenDay === d.weekday ? (
                      <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Finding one…</>
                    ) : (
                      <><RefreshCw className="w-3.5 h-3.5 mr-1.5" /> New verse</>
                    )}
                  </Button>
                </div>
                {d.text && (
                  <p className="text-sm text-white/70 italic leading-relaxed mb-3">&ldquo;{d.text}&rdquo;</p>
                )}
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="text-[10px] uppercase tracking-wide text-neutral-500 font-semibold">Context</label>
                    <Textarea
                      value={d.context}
                      onChange={(e) => patchDay(d.weekday, { context: e.target.value })}
                      rows={3}
                      className="mt-1 bg-neutral-800 border-neutral-700 text-white text-sm"
                    />
                    {d.figures.length > 0 && (
                      <div className="mt-3">
                        <label className="text-[10px] uppercase tracking-wide text-neutral-500 font-semibold">
                          Who they are (shown on the board)
                        </label>
                        <div className="mt-1 space-y-1.5">
                          {d.figures.map((f, i) => (
                            <div key={i} className="flex gap-1.5">
                              <Input
                                value={f.name}
                                onChange={(e) => patchFigure(d.weekday, i, "name", e.target.value)}
                                placeholder="Name"
                                className="h-8 w-[120px] shrink-0 bg-neutral-800 border-neutral-700 text-white text-sm font-semibold"
                              />
                              <Input
                                value={f.who}
                                onChange={(e) => patchFigure(d.weekday, i, "who", e.target.value)}
                                placeholder="One sentence on who they were"
                                className="h-8 flex-1 bg-neutral-800 border-neutral-700 text-white text-sm"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <div className="grid grid-cols-1 gap-1">
                      <Input
                        value={d.questions[0] ?? ""}
                        onChange={(e) => patchList(d.weekday, "questions", 0, e.target.value)}
                        placeholder="Question"
                        className="h-8 bg-neutral-800 border-neutral-700 text-white text-sm"
                      />
                      <Textarea
                        value={d.answers[0] ?? ""}
                        onChange={(e) => patchList(d.weekday, "answers", 0, e.target.value)}
                        placeholder="Read this out loud"
                        rows={3}
                        className="bg-black/40 border-neutral-800 text-white/80 text-xs"
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default VerseOfTheWeekAdmin;
