// Practice Plan — the weekly editor behind the Gym Board.
//
// Two layers, deliberately kept apart:
//   TEMPLATE  what KIND of session each group does each day. Set once a season.
//   WEEK      what we are ACTUALLY doing — the drills. Written every Monday.
//
// Monday morning: review last week, click "Start new week", keep or clear each
// drill, write the meeting points, publish. Most weeks that is a couple of
// minutes.
//
// Plan: docs/PRACTICE_PLAN_PLAN.md
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ChevronLeft, ChevronRight, Plus, Loader2, Send, Monitor, Users,
  X, Sparkles, CalendarDays, Trash2, Pencil, Check, RefreshCw, Eye, EyeOff,
} from "lucide-react";
import { toast } from "sonner";
import VerseOfTheWeekAdmin from "@/components/verse/VerseOfTheWeekAdmin";
import {
  NLA_RED, TOGETHER_GRAY, OFF_TEMPLATE_VIOLET, GROUPS, WEEKDAYS, QUICK_BLOCKS, spiritualAccent, daysFor, mondayOf, addDays, formatWeekRange,
  dateForWeekday, blockAccent, PracticeGroup, PracticeSettings, PracticeWeek, PracticeBlock,
  TemplateBlock, SpiritualDay, MeetingPoints, SeasonMode, formatStartTime,
} from "@/lib/practicePlan";
import { handleIndentKey } from "@/lib/indentTextarea";

const AdminPracticePlan = () => {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [weekStart, setWeekStart] = useState<string>(() => mondayOf());
  const [copyLastWeek, setCopyLastWeek] = useState(true);

  // ── Settings ──
  const { data: settings } = useQuery({
    queryKey: ["practice-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("practice_settings" as never)
        .select("season, start_time, meeting_leader")
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as PracticeSettings) ?? {
        season: "in_season" as SeasonMode,
        start_time: "17:15:00",
        meeting_leader: "Mercado",
      };
    },
  });
  const season: SeasonMode = settings?.season ?? "in_season";
  const days = useMemo(() => daysFor(season), [season]);

  // ── Template ──
  const { data: template = [] } = useQuery({
    queryKey: ["practice-template"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("practice_template_blocks" as never)
        .select("*")
        .order("weekday")
        .order("position");
      if (error) throw error;
      return (data || []) as unknown as TemplateBlock[];
    },
  });

  const { data: spiritual = [] } = useQuery({
    queryKey: ["practice-spiritual"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("practice_spiritual_template" as never)
        .select("*")
        .order("weekday");
      if (error) throw error;
      return (data || []) as unknown as SpiritualDay[];
    },
  });

  // ── The week being edited ──
  const { data: week, isLoading: weekLoading } = useQuery({
    queryKey: ["practice-week", weekStart],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("practice_weeks" as never)
        .select("*")
        .eq("week_start", weekStart)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as PracticeWeek) ?? null;
    },
  });

  const { data: blocks = [] } = useQuery({
    queryKey: ["practice-blocks", week?.id],
    enabled: !!week?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("practice_blocks" as never)
        .select("*")
        .eq("week_id", week!.id)
        .order("weekday")
        .order("position");
      if (error) throw error;
      return (data || []) as unknown as PracticeBlock[];
    },
  });

  const { data: meeting = [] } = useQuery({
    queryKey: ["practice-meeting", week?.id],
    enabled: !!week?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("practice_meeting_points" as never)
        .select("*")
        .eq("week_id", week!.id);
      if (error) throw error;
      return (data || []) as unknown as MeetingPoints[];
    },
  });

  // Last week's drills, for the pre-fill.
  const prevWeekStart = addDays(weekStart, -7);
  const { data: lastWeekBlocks = [] } = useQuery({
    queryKey: ["practice-blocks-prev", prevWeekStart],
    queryFn: async () => {
      const { data: w } = await supabase
        .from("practice_weeks" as never)
        .select("id")
        .eq("week_start", prevWeekStart)
        .maybeSingle();
      if (!w) return [];
      const { data } = await supabase
        .from("practice_blocks" as never)
        .select("*")
        .eq("week_id", (w as unknown as PracticeWeek).id);
      return (data || []) as unknown as PracticeBlock[];
    },
  });

  // ── Start a new week from the template ──
  const startWeek = useMutation({
    mutationFn: async () => {
      const { data: created, error } = await supabase
        .from("practice_weeks" as never)
        .insert({ week_start: weekStart, created_by: user?.id ?? null } as never)
        .select()
        .single();
      if (error) throw error;
      const newWeek = created as unknown as PracticeWeek;

      // Carry last week's drill forward into the matching slot when asked —
      // most weeks are small edits on the last one.
      const prior = new Map(
        lastWeekBlocks.map((b) => [`${b.group}|${b.weekday}|${b.position}`, b.detail])
      );
      const rows = template
        .filter((t) => t.is_active !== false)
        .filter((t) => days.some((d) => d.n === t.weekday))
        .map((t) => ({
          week_id: newWeek.id,
          group: t.group,
          weekday: t.weekday,
          position: t.position,
          category: t.category,
          detail: copyLastWeek
            ? prior.get(`${t.group}|${t.weekday}|${t.position}`) ?? null
            : null,
        }));
      if (rows.length) {
        const { error: bErr } = await supabase
          .from("practice_blocks" as never)
          .insert(rows as never);
        if (bErr) throw bErr;
      }
      return newWeek;
    },
    onSuccess: () => {
      toast.success("New week started");
      qc.invalidateQueries({ queryKey: ["practice-week", weekStart] });
      qc.invalidateQueries({ queryKey: ["practice-blocks"] });
    },
    onError: (e: Error) => toast.error(e.message || "Couldn't start the week."),
  });

  // Rename one column for THIS WEEK. The template is untouched, and the flag
  // stops the drift sync treating it as something to put back.
  const saveCategory = useMutation({
    mutationFn: async ({ id, category }: { id: string; category: string }) => {
      const { error } = await supabase
        .from("practice_blocks" as never)
        .update({ category, category_overridden: true } as never)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["practice-blocks", week?.id] }),
    onError: (e: Error) => toast.error(e.message || "Couldn't rename that."),
  });

  // Put a one-off column back to whatever the template says.
  const resetCategory = useMutation({
    mutationFn: async (block: PracticeBlock) => {
      const t = template.find(
        (x) =>
          x.group === block.group &&
          x.weekday === block.weekday &&
          x.position === block.position
      );
      const { error } = await supabase
        .from("practice_blocks" as never)
        .update({
          category: t?.category ?? block.category,
          category_overridden: false,
        } as never)
        .eq("id", block.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["practice-blocks", week?.id] }),
    onError: (e: Error) => toast.error(e.message || "Couldn't reset that."),
  });

  // Adding or dropping a column for THIS WEEK. The template is untouched, so
  // next week comes back as normal.
  const addWeekBlock = useMutation({
    mutationFn: async ({
      group, weekday, category,
    }: { group: PracticeGroup; weekday: number; category: string }) => {
      const existing = blocks.filter((b) => b.group === group && b.weekday === weekday);
      const position = existing.reduce((m, b) => Math.max(m, b.position), -1) + 1;
      const { error } = await supabase
        .from("practice_blocks" as never)
        .insert({
          week_id: week!.id,
          group,
          weekday,
          position,
          category,
          category_overridden: true,
        } as never);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["practice-blocks", week?.id] }),
    onError: (e: Error) => toast.error(e.message || "Couldn't add that."),
  });

  const removeWeekBlock = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("practice_blocks" as never)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["practice-blocks", week?.id] }),
    onError: (e: Error) => toast.error(e.message || "Couldn't remove that."),
  });

  const saveBlock = useMutation({
    mutationFn: async ({ id, detail }: { id: string; detail: string | null }) => {
      const { error } = await supabase
        .from("practice_blocks" as never)
        .update({ detail } as never)
        .eq("id", id);
      if (error) throw error;
      // Remember the drill so it can be offered back later. The library builds
      // itself out of what actually gets used.
      if (detail && detail.trim().length > 3) {
        await supabase
          .from("practice_drills" as never)
          .upsert(
            { detail: detail.trim(), last_used: new Date().toISOString() } as never,
            { onConflict: "detail" } as never
          );
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["practice-blocks", week?.id] }),
    onError: (e: Error) => toast.error(e.message || "Couldn't save."),
  });

  const saveMeeting = useMutation({
    mutationFn: async ({ weekday, points }: { weekday: number; points: string[] }) => {
      const { error } = await supabase
        .from("practice_meeting_points" as never)
        .upsert(
          { week_id: week!.id, weekday, points } as never,
          { onConflict: "week_id,weekday" } as never
        );
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["practice-meeting", week?.id] }),
    onError: (e: Error) => toast.error(e.message || "Couldn't save meeting points."),
  });

  const publish = useMutation({
    mutationFn: async () => {
      const next = week!.status === "published" ? "draft" : "published";
      const { error } = await supabase
        .from("practice_weeks" as never)
        .update({
          status: next,
          published_at: next === "published" ? new Date().toISOString() : null,
        } as never)
        .eq("id", week!.id);
      if (error) throw error;
      return next;
    },
    onSuccess: (next) => {
      toast.success(next === "published" ? "Published to the gym board" : "Unpublished");
      qc.invalidateQueries({ queryKey: ["practice-week", weekStart] });
    },
    onError: (e: Error) => toast.error(e.message || "Couldn't publish."),
  });

  const setSeason = useMutation({
    mutationFn: async (s: SeasonMode) => {
      const { error } = await supabase
        .from("practice_settings" as never)
        .update({ season: s } as never)
        .eq("id", true);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["practice-settings"] });
      toast.success("Season updated");
    },
    onError: (e: Error) => toast.error(e.message || "Couldn't update the season."),
  });

  // A week snapshots its categories when it starts, so editing the template
  // afterwards leaves the current week alone — that is deliberate, otherwise
  // re-planning a season would rewrite what past weeks say was trained. But it
  // must be possible to pull a change in on purpose, so work out the drift.
  const drift = useMemo(() => {
    const empty = {
      missing: [] as TemplateBlock[],
      stale: [] as PracticeBlock[],
      renamed: [] as { block: PracticeBlock; category: string }[],
    };
    if (!week) return empty;
    const key = (g: string, d: number, pos: number) => `${g}|${d}|${pos}`;
    const inWeek = new Set(blocks.map((b) => key(b.group, b.weekday, b.position)));
    const inTemplate = new Map(
      template
        .filter((t) => t.is_active !== false)
        .filter((t) => days.some((d) => d.n === t.weekday))
        .map((t) => [key(t.group, t.weekday, t.position), t])
    );
    const missing = [...inTemplate.entries()]
      .filter(([k]) => !inWeek.has(k))
      .map(([, t]) => t);
    // Only offer to drop slots nobody has written a drill into — a filled slot
    // is a record of intent and shouldn't vanish because a template changed.
    //
    // And never a column added FOR this week: it is missing from the template
    // because it was deliberately added here, which is the opposite of drift.
    // Without this the sync silently deleted a freshly added column that had
    // no drill typed into it yet.
    const stale = blocks.filter(
      (b) =>
        !b.category_overridden &&
        !inTemplate.has(key(b.group, b.weekday, b.position)) &&
        !b.detail?.trim()
    );
    // A slot kept its place but was renamed in the template — "Boxing Circuit"
    // became "TESTING". Matching on position alone missed this entirely, which
    // made template edits look like they did nothing.
    const renamed = blocks
      .filter((b) => !b.category_overridden)
      .map((b) => {
        const t = inTemplate.get(key(b.group, b.weekday, b.position));
        return t && t.category !== b.category ? { block: b, category: t.category } : null;
      })
      .filter(Boolean) as { block: PracticeBlock; category: string }[];
    return { missing, stale, renamed };
  }, [week, blocks, template, days]);

  const syncTemplate = useMutation({
    mutationFn: async () => {
      if (drift.missing.length) {
        const rows = drift.missing.map((t) => ({
          week_id: week!.id,
          group: t.group,
          weekday: t.weekday,
          position: t.position,
          category: t.category,
          detail: null,
        }));
        const { error } = await supabase
          .from("practice_blocks" as never)
          .insert(rows as never);
        if (error) throw error;
      }
      if (drift.stale.length) {
        const { error } = await supabase
          .from("practice_blocks" as never)
          .delete()
          .in("id", drift.stale.map((b) => b.id));
        if (error) throw error;
      }
      // Rename in place, so whatever drill was written under the old name
      // stays exactly where it was.
      for (const r of drift.renamed) {
        const { error } = await supabase
          .from("practice_blocks" as never)
          .update({ category: r.category } as never)
          .eq("id", r.block.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("This week now matches the template");
      qc.invalidateQueries({ queryKey: ["practice-blocks", week?.id] });
    },
    onError: (e: Error) => toast.error(e.message || "Couldn't sync."),
  });

  const blocksFor = (weekday: number, group: PracticeGroup) =>
    blocks.filter((b) => b.weekday === weekday && b.group === group);

  const pointsFor = (weekday: number) =>
    meeting.find((m) => m.weekday === weekday)?.points ?? [];

  const isThisWeek = weekStart === mondayOf();
  const filledCount = blocks.filter((b) => b.detail?.trim()).length;

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-6xl mx-auto text-white">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-white">Practice Plan</h2>
          <p className="text-sm text-neutral-400 mt-1">
            The week behind the gym board.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open("/practice-board", "_blank")}
            className="bg-transparent border-neutral-700 text-neutral-300 hover:bg-white/5 hover:text-white"
          >
            <Monitor className="w-4 h-4 mr-1.5" /> Open gym board
          </Button>
          {week && (
            <Button
              size="sm"
              onClick={() => publish.mutate()}
              disabled={publish.isPending}
              className={
                week.status === "published"
                  ? "bg-neutral-800 hover:bg-neutral-700 text-white"
                  : "text-white font-semibold"
              }
              style={week.status === "published" ? undefined : { backgroundColor: NLA_RED }}
            >
              {publish.isPending ? (
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
              ) : (
                <Send className="w-4 h-4 mr-1.5" />
              )}
              {week.status === "published" ? "Unpublish" : "Publish to board"}
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="week">
        {/* The default inactive tab is near-invisible on this dark
            surface — lift it so both options are readable. */}
        <TabsList className="bg-neutral-900 border border-neutral-800 h-11 p-1 gap-1">
          <TabsTrigger
            value="week"
            className="px-5 h-9 text-sm font-semibold text-neutral-300 hover:text-white data-[state=active]:bg-white data-[state=active]:text-black"
          >
            This Week
          </TabsTrigger>
          <TabsTrigger
            value="template"
            className="px-5 h-9 text-sm font-semibold text-neutral-300 hover:text-white data-[state=active]:bg-white data-[state=active]:text-black"
          >
            Template
          </TabsTrigger>
          <TabsTrigger
            value="verse"
            className="px-5 h-9 text-sm font-semibold text-neutral-300 hover:text-white data-[state=active]:bg-white data-[state=active]:text-black"
          >
            Verse of the Week
          </TabsTrigger>
        </TabsList>

        {/* ── The week ── */}
        <TabsContent value="week" className="space-y-4 mt-4">
          <div className="flex items-center justify-between gap-3 flex-wrap rounded-xl border border-neutral-800 bg-neutral-900 p-3">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost" size="icon"
                onClick={() => setWeekStart(addDays(weekStart, -7))}
                className="text-neutral-400 hover:text-white h-8 w-8"
                aria-label="Previous week"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <div className="text-center min-w-[190px]">
                <p className="text-white font-semibold text-sm">
                  {formatWeekRange(weekStart, season)}
                </p>
                <p className="text-[11px] text-neutral-500">
                  {isThisWeek ? "This week" : weekStart}
                </p>
              </div>
              <Button
                variant="ghost" size="icon"
                onClick={() => setWeekStart(addDays(weekStart, 7))}
                className="text-neutral-400 hover:text-white h-8 w-8"
                aria-label="Next week"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
              {!isThisWeek && (
                <Button
                  variant="ghost" size="sm"
                  onClick={() => setWeekStart(mondayOf())}
                  className="text-neutral-400 hover:text-white text-xs"
                >
                  Today
                </Button>
              )}
            </div>

            {week && (
              <div className="flex items-center gap-2">
                <Badge
                  className={
                    week.status === "published"
                      ? "bg-green-500/15 text-green-400 border-green-500/30"
                      : "bg-amber-500/15 text-amber-400 border-amber-500/30"
                  }
                >
                  {week.status === "published" ? "Published" : "Draft"}
                </Badge>
                {/* A completeness meter, worded so it can't read as a date. */}
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-16 rounded-full bg-neutral-800 overflow-hidden" aria-hidden>
                    <div
                      className="h-full rounded-full bg-emerald-500/70 transition-all"
                      style={{ width: `${blocks.length ? Math.round((filledCount / blocks.length) * 100) : 0}%` }}
                    />
                  </div>
                  <span className="text-[11px] text-neutral-400 whitespace-nowrap">
                    {filledCount} of {blocks.length} drills filled
                  </span>
                </div>
              </div>
            )}
          </div>

          {weekLoading ? (
            <p className="text-neutral-500 text-sm text-center py-16">Loading…</p>
          ) : !week ? (
            <StartWeekCard
              weekStart={weekStart}
              season={season}
              hasLastWeek={lastWeekBlocks.length > 0}
              copyLastWeek={copyLastWeek}
              setCopyLastWeek={setCopyLastWeek}
              onStart={() => startWeek.mutate()}
              starting={startWeek.isPending}
            />
          ) : (
            <div className="space-y-5">
              {(drift.missing.length > 0 ||
                drift.stale.length > 0 ||
                drift.renamed.length > 0) && (
                <div className="flex items-center justify-between gap-4 flex-wrap rounded-xl border border-violet-400/30 bg-violet-400/[0.07] p-4">
                  <div>
                    <p className="text-sm font-semibold text-violet-200">
                      The template has changed since this week was started
                    </p>
                    <p className="text-xs text-violet-100/60 mt-0.5">
                      {[
                        drift.missing.length > 0 &&
                          `${drift.missing.length} to add`,
                        drift.renamed.length > 0 &&
                          `${drift.renamed.length} renamed`,
                        drift.stale.length > 0 &&
                          `${drift.stale.length} empty to remove`,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                      . Your drills and anything marked{" "}
                      <span style={{ color: OFF_TEMPLATE_VIOLET }}>this week only</span>{" "}
                      are left alone.
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => syncTemplate.mutate()}
                    disabled={syncTemplate.isPending}
                    className="bg-violet-400 hover:bg-violet-300 text-black font-bold"
                  >
                    {syncTemplate.isPending ? (
                      <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Updating…</>
                    ) : (
                      <><RefreshCw className="w-4 h-4 mr-1.5" /> Update this week</>
                    )}
                  </Button>
                </div>
              )}
              {days.map((d) => (
                <DayCard
                  key={d.n}
                  day={d}
                  dateISO={dateForWeekday(weekStart, d.n)}
                  spiritual={spiritual.find((s) => s.weekday === d.n) ?? null}
                  points={pointsFor(d.n)}
                  onPoints={(points) => saveMeeting.mutate({ weekday: d.n, points })}
                  blocksFor={(g) => blocksFor(d.n, g)}
                  onSaveBlock={(id, detail) => saveBlock.mutate({ id, detail })}
                  template={template}
                  onRename={(id, category) => saveCategory.mutate({ id, category })}
                  onReset={(b) => resetCategory.mutate(b)}
                  onRemove={(id) => removeWeekBlock.mutate(id)}
                  onAddWeekBlock={(g, weekday, category) =>
                    addWeekBlock.mutate({ group: g, weekday, category })
                  }
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── The template ── */}
        <TabsContent value="template" className="space-y-4 mt-4">
          <TemplateView
            template={template}
            spiritual={spiritual}
            season={season}
            startTime={settings?.start_time ?? "17:15:00"}
            onSeason={(s) => setSeason.mutate(s)}
          />
        </TabsContent>

        {/* ── Verse of the Week ── */}
        <TabsContent value="verse" className="mt-4">
          <VerseOfTheWeekAdmin season={season} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

// ── Start of week ────────────────────────────────────────────────────
const StartWeekCard = ({
  weekStart, season, hasLastWeek, copyLastWeek, setCopyLastWeek, onStart, starting,
}: {
  weekStart: string;
  season: SeasonMode;
  hasLastWeek: boolean;
  copyLastWeek: boolean;
  setCopyLastWeek: (v: boolean) => void;
  onStart: () => void;
  starting: boolean;
}) => (
  <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-8 text-center">
    <CalendarDays className="w-8 h-8 mx-auto mb-3" style={{ color: NLA_RED }} />
    <h3 className="text-lg font-bold text-white">
      No plan yet for {formatWeekRange(weekStart, season)}
    </h3>
    <p className="text-sm text-neutral-400 mt-1.5 max-w-md mx-auto">
      Start the week and every slot comes up on the template&apos;s skeleton —
      {season === "off_season" ? " Monday to Thursday" : " Monday to Friday"}, three
      groups a day.
    </p>

    {hasLastWeek && (
      <label className="mt-5 inline-flex items-center gap-2.5 cursor-pointer rounded-lg border border-neutral-700 bg-neutral-950 px-3.5 py-2.5">
        <input
          type="checkbox"
          checked={copyLastWeek}
          onChange={(e) => setCopyLastWeek(e.target.checked)}
          className="w-4 h-4 accent-[#bf0f3e]"
        />
        <span className="text-sm text-neutral-200">
          Start from last week&apos;s drills
        </span>
        <span className="text-[11px] text-neutral-500">— keep or clear each one</span>
      </label>
    )}

    <div className="mt-6">
      <Button
        onClick={onStart}
        disabled={starting}
        className="h-11 px-6 text-white font-bold"
        style={{ backgroundColor: NLA_RED }}
      >
        {starting ? (
          <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Starting…</>
        ) : (
          <><Plus className="w-4 h-4 mr-2" /> Start new week</>
        )}
      </Button>
    </div>
  </div>
);

// ── One day ──────────────────────────────────────────────────────────
const DayCard = ({
  day, dateISO, spiritual, points, onPoints, blocksFor, onSaveBlock,
  template, onRename, onReset, onRemove, onAddWeekBlock,
}: {
  day: { n: number; short: string; long: string };
  dateISO: string;
  spiritual: SpiritualDay | null;
  points: string[];
  onPoints: (points: string[]) => void;
  blocksFor: (g: PracticeGroup) => PracticeBlock[];
  onSaveBlock: (id: string, detail: string | null) => void;
  template: TemplateBlock[];
  onRename: (id: string, category: string) => void;
  onReset: (block: PracticeBlock) => void;
  onRemove: (id: string) => void;
  onAddWeekBlock: (g: PracticeGroup, weekday: number, category: string) => void;
}) => {
  const [draft, setDraft] = useState("");
  const date = new Date(`${dateISO}T12:00:00`);
  const dayNumber = day.n;

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900 overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-neutral-800 flex-wrap">
        <div className="flex items-baseline gap-2.5">
          <h3 className="text-white font-bold">{day.long}</h3>
          <span className="text-xs text-neutral-500">
            {date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
          </span>
        </div>
        {/* A paused slot is hidden on the gym board, so it must not look live
            here either — but it stays visible, dimmed and labelled, so the
            week explains why the board has nothing on that day. */}
        {spiritual && (
          <Badge
            className={`bg-black text-[11px] font-semibold ${
              spiritual.is_active === false ? "opacity-40" : ""
            }`}
            style={{
              color: spiritual.is_active === false
                ? TOGETHER_GRAY
                : spiritualAccent(spiritual.label),
              borderColor: spiritual.is_active === false
                ? TOGETHER_GRAY
                : spiritualAccent(spiritual.label),
            }}
          >
            <Sparkles className="w-3 h-3 mr-1" />
            <span className={spiritual.is_active === false ? "line-through" : ""}>
              {spiritual.label}
              {spiritual.leader ? ` — ${spiritual.leader}` : ""}
            </span>
            {spiritual.is_active === false && (
              <span className="ml-1.5 no-underline">· paused</span>
            )}
          </Badge>
        )}
      </div>

      {/* The five minutes that open practice */}
      <div className="px-4 py-3 border-b border-neutral-800 bg-neutral-950/40">
        <div className="flex items-center gap-2 mb-2">
          <Users className="w-3.5 h-3.5" style={{ color: TOGETHER_GRAY }} />
          <p className="text-[11px] uppercase tracking-[0.15em] text-neutral-400 font-semibold">
            Team meeting · 5 min
          </p>
        </div>
        <ul className="space-y-1.5 mb-2">
          {points.map((p, i) => (
            <li key={i} className="flex items-start gap-2 group/pt">
              <span className="w-1.5 h-1.5 rounded-full bg-neutral-600 mt-2 shrink-0" />
              <span className="flex-1 text-sm text-neutral-200">{p}</span>
              <button
                type="button"
                onClick={() => onPoints(points.filter((_, x) => x !== i))}
                className="opacity-0 group-hover/pt:opacity-100 text-neutral-500 hover:text-red-400 transition-opacity"
                aria-label="Remove point"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && draft.trim()) {
                onPoints([...points, draft.trim()]);
                setDraft("");
              }
            }}
            placeholder="Add a discussion point…"
            className="h-8 text-sm bg-neutral-900 border-neutral-800 text-white"
          />
          <Button
            size="sm"
            variant="outline"
            disabled={!draft.trim()}
            onClick={() => {
              onPoints([...points, draft.trim()]);
              setDraft("");
            }}
            className="h-8 bg-transparent border-neutral-700 text-neutral-300 hover:bg-white/5 hover:text-white"
          >
            Add
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-neutral-800">
        {GROUPS.map((g) => {
          const gb = blocksFor(g.key);
          return (
            <div key={g.key} className="p-4 space-y-3 group/col">
              <div>
                <p className="text-sm font-bold" style={{ color: g.accent }}>
                  {g.label}
                </p>
                <p className="text-[10px] text-neutral-600">{g.blurb}</p>
              </div>
              {gb.length === 0 ? (
                <p className="text-xs text-neutral-600 italic">Nothing scheduled</p>
              ) : (
                gb.map((b) => (
                  <BlockEditor
                    key={b.id}
                    block={b}
                    accent={g.accent}
                    templateCategory={
                      template.find(
                        (t) =>
                          t.group === b.group &&
                          t.weekday === b.weekday &&
                          t.position === b.position
                      )?.category
                    }
                    onSave={onSaveBlock}
                    onRename={onRename}
                    onReset={() => onReset(b)}
                    onRemove={() => onRemove(b.id)}
                  />
                ))
              )}
              <AddTemplateBlock
                accent={g.accent}
                label="Add a column this week"
                onAdd={(category) =>
                  onAddWeekBlock(g.key, dayNumber, category)
                }
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};

/**
 * One column of one group's day.
 *
 * The column NAME is editable here, not just the drill. Most weeks Tuesday's
 * second Battle Team column is "Sparring" because the template says so — but
 * some weeks it isn't, and that is a fact about the week rather than a change
 * to the pattern. Renaming here marks the block as a deliberate one-off, so
 * the "template has changed" sync leaves it alone instead of putting it back.
 */
const BlockEditor = ({
  block, accent, templateCategory, onSave, onRename, onReset, onRemove,
}: {
  block: PracticeBlock;
  accent: string;
  templateCategory?: string;
  onSave: (id: string, detail: string | null) => void;
  onRename: (id: string, category: string) => void;
  onReset: () => void;
  onRemove: () => void;
}) => {
  const [renaming, setRenaming] = useState(false);
  const changed = !!block.category_overridden;

  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-1">
        {renaming ? (
          <Input
            autoFocus
            defaultValue={block.category}
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v && v !== block.category) onRename(block.id, v);
              setRenaming(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              if (e.key === "Escape") setRenaming(false);
            }}
            className="h-6 text-[11px] uppercase tracking-wider font-semibold bg-neutral-950 border-neutral-700 text-white px-2"
          />
        ) : (
          <button
            type="button"
            onClick={() => setRenaming(true)}
            title="Rename this column for this week only"
            className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-semibold hover:opacity-70 transition-opacity"
            style={{ color: blockAccent(block.category, accent) }}
          >
            {block.category}
            <Pencil className="w-2.5 h-2.5 opacity-0 group-hover/col:opacity-60" />
          </button>
        )}

        <div className="flex items-center gap-2 shrink-0">
          {block.detail?.trim() && (
            <button
              type="button"
              onClick={() => onSave(block.id, null)}
              className="text-[10px] text-neutral-600 hover:text-red-400 flex items-center gap-1"
            >
              <Trash2 className="w-3 h-3" /> Clear
            </button>
          )}
          <button
            type="button"
            onClick={onRemove}
            title="Remove this column for this week"
            className="text-neutral-600 hover:text-red-400"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Says plainly that this week differs, and offers the way back. */}
      {changed && (
        <div className="flex items-center gap-1.5 mb-1.5">
          <span
            className="text-[9px] uppercase tracking-wider font-semibold"
            style={{ color: OFF_TEMPLATE_VIOLET }}
          >
            This week only
          </span>
          {templateCategory && templateCategory !== block.category && (
            <button
              type="button"
              onClick={onReset}
              className="text-[9px] text-neutral-500 hover:text-white underline"
            >
              back to {templateCategory}
            </button>
          )}
        </div>
      )}

      <Textarea
        key={`${block.id}-${block.detail ?? ""}`}
        defaultValue={block.detail ?? ""}
        onBlur={(e) => {
          const v = e.target.value.trim() || null;
          if (v !== (block.detail || null)) onSave(block.id, v);
        }}
        onKeyDown={handleIndentKey}
        placeholder="What are we doing?  —  Tab to indent"
        className="min-h-[68px] text-sm bg-neutral-950 border-neutral-800 text-white"
      />
    </div>
  );
};

/**
 * Add a category to one group's day in the TEMPLATE — the standing pattern,
 * not this week. Same quick picks as the board, since they are the same kinds
 * of session.
 */
const AddTemplateBlock = ({
  accent, onAdd, label = "Add",
}: {
  accent: string;
  onAdd: (category: string) => void;
  label?: string;
}) => {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState("");

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded-md border border-dashed border-neutral-700 px-2 py-0.5 text-xs text-neutral-500 hover:text-white hover:border-neutral-500"
      >
        <Plus className="w-3 h-3" /> {label}
      </button>
    );
  }

  const add = (c: string) => {
    const v = c.trim();
    if (!v) return;
    onAdd(v);
    setCustom("");
    setOpen(false);
  };

  return (
    <div className="w-full rounded-lg border border-neutral-700 bg-neutral-950 p-2 space-y-1.5">
      <div className="flex flex-wrap gap-1">
        {QUICK_BLOCKS.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => add(q)}
            className="px-1.5 py-0.5 rounded border text-[11px] hover:bg-white/10"
            style={{ borderColor: `${accent}55`, color: accent }}
          >
            {q}
          </button>
        ))}
      </div>
      <div className="flex gap-1">
        <Input
          autoFocus
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") add(custom);
            if (e.key === "Escape") setOpen(false);
          }}
          placeholder="Something else…"
          className="h-7 text-xs bg-neutral-900 border-neutral-800 text-white"
        />
        <Button
          size="sm"
          onClick={() => setOpen(false)}
          variant="ghost"
          className="h-7 px-2 text-neutral-500 hover:text-white"
        >
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
};

// ── Template ─────────────────────────────────────────────────────────
const TemplateView = ({
  template, spiritual, season, startTime, onSeason,
}: {
  template: TemplateBlock[];
  spiritual: SpiritualDay[];
  season: SeasonMode;
  startTime: string;
  onSeason: (s: SeasonMode) => void;
}) => {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const days = daysFor(season);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["practice-template"] });
    qc.invalidateQueries({ queryKey: ["practice-spiritual"] });
  };

  const onAddTemplate = async (
    group: PracticeGroup, weekday: number, category: string
  ) => {
    const existing = template.filter((t) => t.group === group && t.weekday === weekday);
    const position = existing.reduce((m, t) => Math.max(m, t.position), -1) + 1;
    const { error } = await supabase
      .from("practice_template_blocks" as never)
      .insert({ group, weekday, position, category } as never);
    if (error) toast.error(error.message);
    else refresh();
  };

  const onToggleTemplate = async (block: TemplateBlock) => {
    const { error } = await supabase
      .from("practice_template_blocks" as never)
      .update({ is_active: block.is_active === false } as never)
      .eq("id", block.id);
    if (error) toast.error(error.message);
    else refresh();
  };

  const onToggleSpiritual = async (weekday: number, next: boolean) => {
    const { error } = await supabase
      .from("practice_spiritual_template" as never)
      .update({ is_active: next } as never)
      .eq("weekday", weekday);
    if (error) toast.error(error.message);
    else refresh();
  };

  const onRemoveTemplate = async (id: string) => {
    const { error } = await supabase
      .from("practice_template_blocks" as never)
      .delete()
      .eq("id", id);
    if (error) toast.error(error.message);
    else refresh();
  };

  const onSaveSpiritual = async (
    weekday: number, label: string, leader: string | null
  ) => {
    if (!label.trim()) return;
    const { error } = await supabase
      .from("practice_spiritual_template" as never)
      .upsert({ weekday, label: label.trim(), leader } as never, {
        onConflict: "weekday",
      } as never);
    if (error) toast.error(error.message);
    else refresh();
  };
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <p className="text-sm font-semibold text-white">Season</p>
          <p className="text-xs text-neutral-500 mt-0.5">
            In season runs Monday to Friday. Off season stops at Thursday —
            Friday isn&apos;t deleted, just dormant.
          </p>
        </div>
        <Select value={season} onValueChange={(v) => onSeason(v as SeasonMode)}>
          <SelectTrigger className="w-[180px] bg-neutral-950 border-neutral-700 text-white text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="in_season">In season · Mon–Fri</SelectItem>
            <SelectItem value="off_season">Off season · Mon–Thu</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <p className="text-sm font-semibold text-white">Practice starts</p>
          <p className="text-xs text-neutral-500 mt-0.5">
            What the gym board counts down to.
          </p>
        </div>
        <Badge className="bg-neutral-800 text-neutral-200 border-neutral-700 text-sm px-3 py-1">
          {formatStartTime(startTime)}
        </Badge>
      </div>

      <div className="rounded-xl border border-neutral-800 bg-neutral-900 overflow-hidden">
        <div className="px-4 py-3 border-b border-neutral-800 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-sm font-semibold text-white">Weekly template</p>
            <p className="text-xs text-neutral-500 mt-0.5">
              What kind of session each group runs. The drills live in the week,
              not here.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setEditing((e) => !e)}
            className={
              editing
                ? "bg-neutral-800 border-neutral-600 text-white"
                : "bg-transparent border-neutral-700 text-neutral-300 hover:bg-white/5 hover:text-white"
            }
          >
            {editing ? (
              <><Check className="w-4 h-4 mr-1.5" /> Done</>
            ) : (
              <><Pencil className="w-4 h-4 mr-1.5" /> Edit template</>
            )}
          </Button>
        </div>

        {editing && (
          <p className="px-4 py-2.5 text-[11px] text-amber-300/80 bg-amber-500/[0.06] border-b border-amber-500/20">
            Changes here shape the weeks you start from now on. Weeks already
            written keep what they say — a template change never rewrites
            history.
          </p>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-800">
                <th className="text-left px-4 py-2 text-[11px] uppercase tracking-wider text-neutral-500 font-semibold">
                  Day
                </th>
                {GROUPS.map((g) => (
                  <th
                    key={g.key}
                    className="text-left px-4 py-2 text-[11px] uppercase tracking-wider font-semibold"
                    style={{ color: g.accent }}
                  >
                    {g.label}
                  </th>
                ))}
                <th
                  className="text-left px-4 py-2 text-[11px] uppercase tracking-wider font-semibold"
                  style={{ color: TOGETHER_GRAY }}
                >
                  Spiritual
                </th>
              </tr>
            </thead>
            <tbody>
              {WEEKDAYS.map((d) => {
                const dormant = !days.some((x) => x.n === d.n);
                const sp = spiritual.find((s) => s.weekday === d.n);
                return (
                  <tr
                    key={d.n}
                    className={`border-b border-neutral-800/60 last:border-0 ${
                      dormant ? "opacity-40" : ""
                    }`}
                  >
                    <td className="px-4 py-3 text-white font-medium whitespace-nowrap">
                      {d.short}
                      {dormant && (
                        <span className="ml-2 text-[10px] text-neutral-500">dormant</span>
                      )}
                    </td>
                    {GROUPS.map((g) => {
                      const cells = template.filter(
                        (t) => t.weekday === d.n && t.group === g.key
                      );
                      return (
                        <td key={g.key} className="px-4 py-3 text-neutral-300 align-top">
                          {!editing ? (
                            cells.map((t) => t.category).join(" · ") || (
                              <span className="text-neutral-600">—</span>
                            )
                          ) : (
                            <div className="flex flex-wrap gap-1.5 items-center">
                              {cells.map((t) => {
                                const paused = t.is_active === false;
                                return (
                                  <span
                                    key={t.id}
                                    className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs ${
                                      paused ? "opacity-40 line-through" : ""
                                    }`}
                                    style={{
                                      borderColor: `${g.accent}55`,
                                      color: blockAccent(t.category, g.accent),
                                    }}
                                  >
                                    {t.category}
                                    <button
                                      type="button"
                                      onClick={() => onToggleTemplate(t)}
                                      className="text-neutral-500 hover:text-white no-underline"
                                      title={paused ? "Bring it back" : "Pause — keeps it, stops using it"}
                                    >
                                      {paused ? (
                                        <Eye className="w-3 h-3" />
                                      ) : (
                                        <EyeOff className="w-3 h-3" />
                                      )}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => onRemoveTemplate(t.id)}
                                      className="text-neutral-500 hover:text-red-400 no-underline"
                                      aria-label={`Remove ${t.category}`}
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  </span>
                                );
                              })}
                              <AddTemplateBlock
                                accent={g.accent}
                                onAdd={(category) =>
                                  onAddTemplate(g.key, d.n, category)
                                }
                              />
                            </div>
                          )}
                        </td>
                      );
                    })}
                    <td
                      className="px-4 py-3 text-xs align-top"
                      style={{ color: spiritualAccent(sp?.label ?? "") }}
                    >
                      {!editing ? (
                        sp ? `${sp.label}${sp.leader ? ` — ${sp.leader}` : ""}` : "—"
                      ) : (
                        <div
                          className={`space-y-1.5 min-w-[190px] ${
                            sp?.is_active === false ? "opacity-40" : ""
                          }`}
                        >
                          {sp && (
                            <button
                              type="button"
                              onClick={() => onToggleSpiritual(d.n, sp.is_active === false)}
                              className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-neutral-500 hover:text-white"
                            >
                              {sp.is_active === false ? (
                                <><Eye className="w-3 h-3" /> Paused — bring it back</>
                              ) : (
                                <><EyeOff className="w-3 h-3" /> Pause</>
                              )}
                            </button>
                          )}
                          <Input
                            defaultValue={sp?.label ?? ""}
                            onBlur={(e) =>
                              onSaveSpiritual(d.n, e.target.value.trim(), sp?.leader ?? null)
                            }
                            placeholder="e.g. Chew on this…"
                            className="h-7 text-xs bg-neutral-950 border-neutral-800 text-white"
                          />
                          <Input
                            defaultValue={sp?.leader ?? ""}
                            onBlur={(e) =>
                              onSaveSpiritual(
                                d.n,
                                sp?.label ?? "",
                                e.target.value.trim() || null
                              )
                            }
                            placeholder="Who leads it?"
                            className="h-7 text-xs bg-neutral-950 border-neutral-800 text-white"
                          />
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminPracticePlan;
