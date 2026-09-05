// Scripture Coach — a youth mentor's companion for the conversation happening
// right now, in the office, with a kid sitting across the desk.
//
// The flow is deliberately three steps, and the two rounds of clicking are kept
// visually apart because they mean different things:
//   1. Pick the youth (their age is derived from it — never asked).
//   2. Type what they brought up → five ESV passages, context, talking points,
//      prayer points.
//   3. CURATE: keep the passages that fit, regenerate the ones that don't.
//   4. SESSION: after talking, tick the ones actually used, journal it, save.
//
// Plan: docs/SCRIPTURE_COACH_PLAN.md
import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Search, X, Sparkles, RefreshCw, ArrowRight, ArrowLeft, Check,
  MessageSquareQuote, MessagesSquare, HandHeart, NotebookPen, Save, Loader2, Trash2, History,
} from "lucide-react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { getCurrentAttendanceYear } from "@/lib/programYear";
import {
  NLA_RED, ESV_COPYRIGHT, QUICK_TOPICS, SessionPassage,
  calculateAge, ageBandFor, resolveHeadshot, sentenceCase,
} from "@/lib/scriptureCoach";

interface Youth {
  id: string;
  child_first_name: string;
  child_last_name: string;
  child_date_of_birth: string | null;
  child_headshot_url: string | null;
}

type Phase = "topic" | "curate" | "session";

const AdminScriptureCoach = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  // Arriving from "Start follow-up session" in Intelligence.
  const preselectId = params.get("youth");

  const [youth, setYouth] = useState<Youth | null>(null);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Youth[]>([]);
  const [searching, setSearching] = useState(false);

  const [topic, setTopic] = useState("");
  const [phase, setPhase] = useState<Phase>("topic");
  const [generating, setGenerating] = useState(false);
  const [refilling, setRefilling] = useState(false);

  const [passages, setPassages] = useState<SessionPassage[]>([]);
  const [talkingPoints, setTalkingPoints] = useState<string[]>([]);
  const [responses, setResponses] = useState<string[]>([]);
  const [prayerPoints, setPrayerPoints] = useState<string[]>([]);
  // Every reference shown or set aside for this topic, so a regenerate never
  // hands back something the mentor has already seen.
  const [seenRefs, setSeenRefs] = useState<string[]>([]);

  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const age = useMemo(() => calculateAge(youth?.child_date_of_birth), [youth]);

  // Every prior conversation with this youth. Drives the history card, and is
  // fed to the model so a second session builds on the first instead of
  // repeating it.
  const { data: priorSessions = [] } = useQuery({
    queryKey: ["scripture-history", youth?.id],
    enabled: !!youth?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("scripture_sessions" as never)
        .select("id, session_date, topic, follow_up_needed, passages")
        .eq("registration_id", youth!.id)
        .order("session_date", { ascending: false });
      return (data || []) as unknown as Array<{
        id: string;
        session_date: string;
        topic: string;
        follow_up_needed: boolean | null;
        passages: SessionPassage[];
      }>;
    },
  });

  // Don't hand a child the same passages they already heard. Two sessions'
  // worth is enough to avoid repetition without starving the model of options.
  const previouslyUsedRefs = useMemo(
    () =>
      priorSessions
        .slice(0, 2)
        .flatMap((sn) => (sn.passages || []).map((pp) => pp.ref)),
    [priorSessions]
  );

  // ── Youth search — this year's kids, not archived. Deliberately does NOT
  // require approved_for_attendance: a kid whose paperwork is pending can
  // still walk in hurting, and care shouldn't wait on a queue. ──
  useEffect(() => {
    if (youth) return;
    if (search.trim().length < 2) {
      setResults([]);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      const q = search.trim();
      const { data } = await supabase
        .from("youth_registrations")
        .select("id, child_first_name, child_last_name, child_date_of_birth, child_headshot_url")
        .eq("program_year", getCurrentAttendanceYear())
        .is("archived_at", null)
        .or(`child_first_name.ilike.%${q}%,child_last_name.ilike.%${q}%`)
        .order("child_last_name")
        .limit(12);
      setResults((data as Youth[]) || []);
      setSearching(false);
    }, 250);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search, youth]);

  // Land straight on the topic step when following up on a prior session.
  useEffect(() => {
    if (!preselectId || youth) return;
    (async () => {
      const { data } = await supabase
        .from("youth_registrations")
        .select("id, child_first_name, child_last_name, child_date_of_birth, child_headshot_url")
        .eq("id", preselectId)
        .maybeSingle();
      if (data) setYouth(data as Youth);
    })();
  }, [preselectId, youth]);

  const resetSession = () => {
    setPhase("topic");
    setPassages([]);
    setTalkingPoints([]);
    setResponses([]);
    setPrayerPoints([]);
    setSeenRefs([]);
    setNotes("");
  };

  const changeYouth = () => {
    setYouth(null);
    setSearch("");
    setTopic("");
    resetSession();
  };

  // ── Generate a full set for a new topic ──
  const generate = async () => {
    if (!youth || topic.trim().length < 3) return;
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("scripture-coach", {
        body: {
          topic: topic.trim(),
          age,
          count: 5,
          history: priorSessions.map((sn) => ({
            date: sn.session_date,
            topic: sn.topic,
          })),
          exclude: previouslyUsedRefs,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const next: SessionPassage[] = (data.passages || []).map((p: SessionPassage) => ({
        ref: p.ref, esv_text: p.esv_text, context: p.context, kept: true, used: false,
      }));
      setPassages(next);
      setTalkingPoints(data.talking_points || []);
      setResponses(data.responses || []);
      setPrayerPoints(data.prayer_points || []);
      setSeenRefs(next.map((p) => p.ref));
      setPhase("curate");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Couldn't pull scripture. Try again.");
    } finally {
      setGenerating(false);
    }
  };

  // ── Replace only the dropped slots; kept passages never move ──
  const regenerateDropped = async () => {
    const dropped = passages.filter((p) => !p.kept);
    if (dropped.length === 0) return;
    setRefilling(true);
    try {
      const { data, error } = await supabase.functions.invoke("scripture-coach", {
        body: {
          topic: topic.trim(),
          age,
          count: dropped.length,
          exclude: [...seenRefs, ...previouslyUsedRefs],
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const incoming: SessionPassage[] = (data.passages || []).map((p: SessionPassage) => ({
        ref: p.ref, esv_text: p.esv_text, context: p.context, kept: true, used: false,
      }));
      if (incoming.length === 0) {
        toast.error("No new passages came back — try rewording the topic.");
        return;
      }

      // Slot the new ones into the dropped positions, in order. Kept passages
      // never move. If fewer came back than were dropped, the leftover slots
      // are removed rather than left showing a rejected passage.
      setPassages((prev) => {
        let i = 0;
        const next: SessionPassage[] = [];
        for (const p of prev) {
          if (p.kept) next.push(p);
          else if (i < incoming.length) next.push(incoming[i++]);
        }
        return next;
      });
      setSeenRefs((prev) => [...prev, ...incoming.map((p) => p.ref)]);
      toast.success(`Pulled ${incoming.length} new passage${incoming.length === 1 ? "" : "s"}`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Couldn't regenerate. Try again.");
    } finally {
      setRefilling(false);
    }
  };

  const togglePassage = (ref: string, field: "kept" | "used") =>
    setPassages((prev) =>
      prev.map((p) => (p.ref === ref ? { ...p, [field]: !p[field] } : p))
    );

  // Locking the set in: drop what wasn't kept, and pre-tick everything as used
  // so the common case (walked through all of them) is zero extra clicks.
  const startSession = () => {
    const kept = passages.filter((p) => p.kept).map((p) => ({ ...p, used: true }));
    if (kept.length === 0) {
      toast.error("Keep at least one passage first.");
      return;
    }
    setPassages(kept);
    setPhase("session");
  };

  const save = async () => {
    if (!youth) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("scripture_sessions").insert({
        registration_id: youth.id,
        youth_name: `${youth.child_first_name} ${youth.child_last_name}`,
        coach_id: user?.id ?? null,
        coach_name: user?.email ?? null,
        topic: topic.trim(),
        passages,
        talking_points: talkingPoints,
        responses,
        prayer_points: prayerPoints,
        notes: notes.trim() || null,
      } as never);
      if (error) throw error;
      toast.success("Session saved");
      navigate("/admin/operations/scripture-coach-intelligence");
    } catch (e: unknown) {
      // Supabase returns PostgrestError objects, which are not Error
      // instances — an `instanceof Error` check swallows the real reason and
      // leaves the mentor staring at a generic failure.
      const msg = (e as { message?: string })?.message;
      toast.error(msg ? `Couldn't save: ${msg}` : "Couldn't save the session.");
      setSaving(false);
    }
  };

  const keptCount = passages.filter((p) => p.kept).length;
  const droppedCount = passages.length - keptCount;
  const usedCount = passages.filter((p) => p.used).length;

  // ── Youth picker ──────────────────────────────────────────────────
  if (!youth) {
    return (
      <div className="p-4 md:p-8 space-y-6 max-w-5xl mx-auto text-white">
        <div>
          <h2 className="text-xl font-bold text-white">Scripture Coach</h2>
          <p className="text-sm text-neutral-400 mt-1">
            Who are you sitting down with?
          </p>
        </div>

        <div className="max-w-xl mx-auto">
          <div className="relative">
            <Search className="absolute left-3 top-3.5 w-4 h-4 text-neutral-500" />
            <Input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search a youth's name..."
              className="pl-10 h-12 text-base bg-neutral-900 border-neutral-800 text-white"
            />
          </div>

          <div className="mt-3 space-y-1">
            {searching && (
              <p className="text-sm text-neutral-500 py-3 text-center">Searching…</p>
            )}
            {!searching && search.trim().length >= 2 && results.length === 0 && (
              <p className="text-sm text-neutral-500 py-6 text-center">
                No youth found for this program year.
              </p>
            )}
            {results.map((y) => {
              const photo = resolveHeadshot(y.child_headshot_url);
              const a = calculateAge(y.child_date_of_birth);
              return (
                <button
                  key={y.id}
                  onClick={() => { setYouth(y); setSearch(""); setResults([]); }}
                  className="w-full flex items-center gap-3 p-3 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-neutral-700 hover:bg-neutral-800/60 transition-colors text-left"
                >
                  {photo ? (
                    <img src={photo} alt="" className="w-10 h-10 rounded-full object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-neutral-700 flex items-center justify-center text-white text-sm font-bold">
                      {y.child_first_name[0]}{y.child_last_name[0]}
                    </div>
                  )}
                  <div className="flex-1">
                    <p className="text-white font-medium">
                      {y.child_first_name} {y.child_last_name}
                    </p>
                    {a !== null && <p className="text-xs text-neutral-500">{a} years old</p>}
                  </div>
                  <ArrowRight className="w-4 h-4 text-neutral-600" />
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  const photo = resolveHeadshot(youth.child_headshot_url);

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-5xl mx-auto text-white">
      {/* Who we're with — persistent, so the screen never loses the person */}
      <div className="flex items-center gap-3 p-3 rounded-xl bg-neutral-900 border border-neutral-800">
        {photo ? (
          <img src={photo} alt="" className="w-11 h-11 rounded-full object-cover" />
        ) : (
          <div className="w-11 h-11 rounded-full bg-neutral-700 flex items-center justify-center text-white font-bold">
            {youth.child_first_name[0]}{youth.child_last_name[0]}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold truncate">
            {youth.child_first_name} {youth.child_last_name}
          </p>
          <p className="text-xs text-neutral-500">
            {age !== null ? `${age} years old · ` : ""}
            {ageBandFor(age) === "junior" ? "Junior" : "Senior"}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => (phase === "topic" ? changeYouth() : setConfirmDiscard(true))}
          className="text-neutral-400 hover:text-white hover:bg-white/5"
        >
          <X className="w-4 h-4 mr-1" /> Change
        </Button>
      </div>

      {/* ── Step: topic ── */}
      {phase === "topic" && (
        <div className="space-y-4 max-w-2xl mx-auto">
          <div>
            <h2 className="text-xl font-bold text-white">What did they bring up?</h2>
            <p className="text-sm text-neutral-400 mt-1">
              In your words — the way they said it is fine.
            </p>
          </div>

          {/* Walk in knowing. A mentor should never open a follow-up
              conversation without the last one in front of them. */}
          {priorSessions.length > 0 && (
            <div className="rounded-xl border border-sky-500/25 bg-sky-500/[0.05] p-4">
              <div className="flex items-center gap-2 mb-2.5">
                <History className="w-4 h-4 text-sky-400" />
                <p className="text-sm font-semibold text-sky-200">
                  {priorSessions.length} previous{" "}
                  {priorSessions.length === 1 ? "conversation" : "conversations"} with{" "}
                  {youth.child_first_name}
                </p>
                {priorSessions.some((sn) => sn.follow_up_needed) && (
                  <Badge className="bg-amber-500/15 text-amber-300 border-amber-500/30 text-[10px]">
                    Follow-up was needed
                  </Badge>
                )}
              </div>
              <ul className="space-y-1.5">
                {priorSessions.slice(0, 3).map((sn) => (
                  <li key={sn.id} className="flex gap-2.5 text-[13px] leading-relaxed">
                    <span className="text-sky-400/70 font-mono text-[11px] mt-0.5 shrink-0">
                      {format(parseISO(sn.session_date), "MMM d")}
                    </span>
                    <span className="text-neutral-300">{sn.topic}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2.5 pt-2.5 border-t border-sky-500/15 text-[11px] text-sky-200/60">
                This session builds on those — you won&apos;t be handed the same
                passages again.
              </p>
            </div>
          )}

          <Textarea
            autoFocus
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder='e.g. "I have a girlfriend and I think we&apos;re ready to have sex"'
            className="min-h-[110px] text-base bg-neutral-900 border-neutral-800 text-white"
          />

          <div>
            <p className="text-[11px] uppercase tracking-[0.15em] text-neutral-500 mb-2">
              Or start from one of these
            </p>
            <div className="flex flex-wrap gap-2">
              {QUICK_TOPICS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTopic(t)}
                  className="px-3 py-1.5 rounded-full text-xs font-medium bg-neutral-900 border border-neutral-800 text-neutral-300 hover:border-neutral-600 hover:text-white transition-colors"
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <Button
            onClick={generate}
            disabled={generating || topic.trim().length < 3}
            className="w-full h-12 text-white font-bold text-base"
            style={{ backgroundColor: NLA_RED }}
          >
            {generating ? (
              <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Finding scripture…</>
            ) : (
              <><Sparkles className="w-5 h-5 mr-2" /> Find Scripture</>
            )}
          </Button>
          {generating && (
            <p className="text-xs text-neutral-500 text-center">
              A new topic takes a few seconds. Once it&apos;s here, it&apos;s instant next time.
            </p>
          )}
        </div>
      )}

      {/* ── Step: curate ── */}
      {phase === "curate" && (
        <div className="space-y-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-xl font-bold text-white">Keep what fits</h2>
              <p className="text-sm text-neutral-400 mt-1 max-w-xl">
                Not the right passage? Unbox it and pull a replacement. Nothing
                is saved yet.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => { resetSession(); }}
                className="bg-transparent border-neutral-700 text-neutral-300 hover:bg-white/5 hover:text-white"
              >
                <ArrowLeft className="w-4 h-4 mr-1.5" /> Change topic
              </Button>
              {droppedCount > 0 && (
                <Button
                  size="sm"
                  onClick={regenerateDropped}
                  disabled={refilling}
                  className="bg-neutral-800 hover:bg-neutral-700 text-white"
                >
                  {refilling ? (
                    <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Pulling…</>
                  ) : (
                    <><RefreshCw className="w-4 h-4 mr-1.5" /> Replace {droppedCount}</>
                  )}
                </Button>
              )}
            </div>
          </div>

          <div className="space-y-3">
            {passages.map((p) => (
              <PassageCard
                key={p.ref}
                passage={p}
                mode="keep"
                onToggle={() => togglePassage(p.ref, "kept")}
              />
            ))}
          </div>

          <PointsBlocks
            talkingPoints={talkingPoints}
            responses={responses}
            prayerPoints={prayerPoints}
          />

          {/* This button locks the set in and moves to the journal, so it says
              exactly that — the passages come with you and nothing is lost. */}
          <div className="sticky bottom-4 z-10 flex flex-col items-center gap-3">
            {/* Reads before the button, not after it — this is the last chance
                to drop a passage, so it has to be seen, not discovered. */}
            <p className="text-[13px] font-medium text-amber-300/90 text-center">
              Unbox any scriptures above that you need not use in this session.
            </p>
            <Button
              onClick={startSession}
              disabled={keptCount === 0}
              className="h-10 px-5 text-white font-bold text-sm shadow-xl"
              style={{ backgroundColor: NLA_RED }}
            >
              Begin Session Notes
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      )}

      {/* ── Step: session ── */}
      {phase === "session" && (
        <div className="space-y-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-xl font-bold text-white">After the conversation</h2>
              <p className="text-sm text-neutral-400 mt-1 max-w-xl">
                Tick the ones you actually walked through — only those go in the
                report.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPhase("curate")}
              className="bg-transparent border-neutral-700 text-neutral-300 hover:bg-white/5 hover:text-white"
            >
              <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to passages
            </Button>
          </div>

          <div className="space-y-3">
            {passages.map((p) => (
              <PassageCard
                key={p.ref}
                passage={p}
                mode="used"
                onToggle={() => togglePassage(p.ref, "used")}
              />
            ))}
          </div>

          <PointsBlocks
            talkingPoints={talkingPoints}
            responses={responses}
            prayerPoints={prayerPoints}
          />

          <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
            <div className="flex items-center gap-2 mb-3">
              <NotebookPen className="w-4 h-4" style={{ color: NLA_RED }} />
              <h3 className="text-sm font-semibold text-white">Journal notes</h3>
              <span className="text-[11px] text-neutral-500 ml-auto">
                {new Date().toLocaleDateString(undefined, {
                  weekday: "long", month: "long", day: "numeric", year: "numeric",
                })}
              </span>
            </div>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="A few notes on how it went, what they said, anything to follow up on…"
              className="min-h-[130px] bg-neutral-950 border-neutral-800 text-white"
            />
          </div>

          <div className="sticky bottom-4 z-10 flex gap-2">
            <Button
              variant="outline"
              onClick={() => setConfirmDiscard(true)}
              className="h-12 bg-neutral-900 border-neutral-700 text-neutral-300 hover:bg-red-500/10 hover:text-red-300 hover:border-red-500/40"
            >
              <Trash2 className="w-4 h-4 mr-1.5" /> Discard
            </Button>
            <Button
              onClick={save}
              disabled={saving}
              className="flex-1 h-12 text-white font-bold text-base shadow-xl"
              style={{ backgroundColor: NLA_RED }}
            >
              {saving ? (
                <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Saving…</>
              ) : (
                <><Save className="w-5 h-5 mr-2" /> Save session ({usedCount} used)</>
              )}
            </Button>
          </div>
        </div>
      )}

      <p className="text-[10px] leading-relaxed text-neutral-600 max-w-3xl pt-2">
        {ESV_COPYRIGHT}
      </p>

      <AlertDialog open={confirmDiscard} onOpenChange={setConfirmDiscard}>
        <AlertDialogContent className="bg-neutral-900 border-neutral-700 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Discard this session?</AlertDialogTitle>
            <AlertDialogDescription className="text-neutral-400">
              The passages and any notes you&apos;ve written will be lost. Nothing has
              been saved yet.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-transparent border-neutral-700 text-white hover:bg-white/5">
              Keep working
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={changeYouth}
              className="bg-red-600 hover:bg-red-500 text-white"
            >
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

// ── One passage. `keep` mode is curating the set; `used` mode is recording
// what actually happened. They look different on purpose. ──
const PassageCard = ({
  passage, mode, onToggle,
}: {
  passage: SessionPassage;
  mode: "keep" | "used";
  onToggle: () => void;
}) => {
  const on = mode === "keep" ? passage.kept : passage.used;
  return (
    <div
      className={`rounded-xl border p-4 transition-all ${
        on
          ? "border-neutral-700 bg-neutral-900"
          : "border-neutral-800/60 bg-neutral-900/40 opacity-50"
      }`}
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={onToggle}
          aria-label={on ? "Remove" : "Add"}
          className={`mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
            on ? "border-transparent" : "border-neutral-600 hover:border-neutral-400"
          }`}
          style={on ? { backgroundColor: NLA_RED } : undefined}
        >
          {on && <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="text-white font-bold text-[15px]">{passage.ref}</h4>
            {mode === "used" && on && (
              <Badge className="bg-green-500/15 text-green-400 border-green-500/30 text-[10px]">
                In report
              </Badge>
            )}
          </div>

          {/* Upright serif against a quiet red rule. Italic serif is tiring to
              read over four or five lines, and the rule plus the serif already
              mark this as scripture without leaning on the slant. */}
          <blockquote
            className="mt-2.5 pl-3.5 border-l-2 font-serif text-[16.5px] leading-[1.75] text-neutral-100"
            style={{ borderColor: `${NLA_RED}66` }}
          >
            {passage.esv_text.replace(/\s+/g, " ").trim()}
          </blockquote>

          {passage.context && (
            <p className="mt-3 text-[13px] leading-relaxed text-neutral-400">
              {passage.context}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

// Talking points and the matching responses sit side by side and share their
// numbering: 03 on the left is answered by 03 on the right. A mentor can be
// lost for words when a child says something heavy, so the right column is
// what they could say next. Prayer closes the conversation, so it sits at the
// bottom, centred.
const PointsBlocks = ({
  talkingPoints, responses, prayerPoints,
}: {
  talkingPoints: string[];
  responses: string[];
  prayerPoints: string[];
}) => (
  <div className="space-y-3">
    {talkingPoints.length > 0 && (
      <div className="rounded-xl border border-neutral-800 bg-neutral-900 overflow-hidden">
        {/* Column headers, desktop only — on a phone the pair stacks and gets
            its own inline labels instead. */}
        <div className="hidden md:grid md:grid-cols-2 gap-6 px-4 py-2.5 border-b border-neutral-800">
          <div className="flex items-center gap-2">
            <MessageSquareQuote className="w-4 h-4" style={{ color: NLA_RED }} />
            <h3 className="text-sm font-semibold text-white">Ask them</h3>
          </div>
          <div className="flex items-center gap-2">
            <MessagesSquare className="w-4 h-4" style={{ color: NLA_RED }} />
            <h3 className="text-sm font-semibold text-white">You could say</h3>
          </div>
        </div>

        {/* One row per pair. The number is stated once for the whole row and
            the row is banded, so which answer belongs to which question is
            visible rather than inferred from two parallel lists. */}
        {talkingPoints.map((t, i) => (
          <div
            key={i}
            className={`grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 px-4 py-3.5 ${
              i % 2 === 1 ? "bg-white/[0.025]" : ""
            } ${i > 0 ? "border-t border-neutral-800/70" : ""}`}
          >
            <div className="flex gap-2.5 text-[14px] leading-relaxed text-neutral-100">
              <span className="font-mono text-[11px] text-neutral-500 mt-1 shrink-0">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span>{sentenceCase(t)}</span>
            </div>

            <div className="flex gap-2.5 pl-[26px] md:pl-0 text-[14px] leading-relaxed text-neutral-300">
              <span className="md:hidden text-[10px] uppercase tracking-wider text-neutral-600 mt-1.5 shrink-0">
                Say
              </span>
              <span>{responses[i] ? sentenceCase(responses[i]) : "—"}</span>
            </div>
          </div>
        ))}

        <p className="px-4 py-2.5 border-t border-neutral-800 text-[11px] text-neutral-500 italic">
          A guide, not a script — say it your way.
        </p>
      </div>
    )}

    {prayerPoints.length > 0 && (
      <div className="max-w-lg mx-auto w-full rounded-xl border border-neutral-800 bg-neutral-900 p-4">
        <div className="flex items-center justify-center gap-2 mb-3">
          <HandHeart className="w-4 h-4" style={{ color: NLA_RED }} />
          <h3 className="text-sm font-semibold text-white">Before we pray</h3>
        </div>
        <ul className="space-y-2">
          {prayerPoints.map((t, i) => (
            <li
              key={i}
              className="flex items-start justify-center gap-2.5 text-[14px] text-neutral-200 text-center"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-neutral-600 mt-2 shrink-0" />
              <span>{sentenceCase(t)}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 pt-3 border-t border-neutral-800 text-[11px] text-neutral-500 italic text-center">
          Reminders to name out loud — not a prayer to read.
        </p>
      </div>
    )}
  </div>
);

export default AdminScriptureCoach;
