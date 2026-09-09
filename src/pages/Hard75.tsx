// 75 Hard — 75 consecutive days, two sessions a day, no rest days.
//
// Lives outside the admin sidebar on its own page because the person using it
// is standing in a gym on a phone, not sitting at a desk.
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft, Flame, Loader2, CalendarDays, Images, RotateCcw, BookOpen, Plus, Trash2, UserPlus,
  Link2, Copy, Check,
} from "lucide-react";
import { toast } from "sonner";
import {
  Hard75Run, Hard75Day, HARD75_LENGTH, buildPlan, toDateString, endDateOf,
  dayNumberFor, streak, firstFailedDay, STRENGTH_COLOR,
} from "@/lib/hard75";
import { adminApi } from "@/lib/hard75Api";
import Hard75Calendar from "@/components/hard75/Hard75Calendar";
import Hard75Photos from "@/components/hard75/Hard75Photos";
import Hard75Journal from "@/components/hard75/Hard75Journal";
import Hard75DaySheet from "@/components/hard75/Hard75DaySheet";

const Hard75 = () => {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const [tab, setTab] = useState<"calendar" | "journal" | "photos">("calendar");
  // The sheet is owned here rather than by the calendar, because the journal
  // opens days too.
  const [openDay, setOpenDay] = useState<string | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [inviting, setInviting] = useState(false);
  const today = toDateString(new Date());

  // Everyone's attempts, not just one. Failed ones stay in the list: on day 62
  // of a second try, the record of reaching day 41 on the first is the point.
  const { data: runs = [], isLoading } = useQuery({
    queryKey: ["hard75-runs"],
    queryFn: async () => {
      const { data } = await supabase
        .from("hard75_runs" as never)
        .select("*")
        .order("created_at", { ascending: false });
      return (data as unknown as Hard75Run[]) || [];
    },
  });

  const live = useMemo(() => runs.filter((r) => r.status !== "failed"), [runs]);
  const run = useMemo(
    () => runs.find((r) => r.id === runId) ?? live[0] ?? null,
    [runs, live, runId]
  );

  // Follow along when a run is created or deleted underneath the selection.
  useEffect(() => {
    if (run && run.id !== runId) setRunId(run.id);
    if (!run && runId) setRunId(null);
  }, [run, runId]);

  const { data: days = [] } = useQuery({
    queryKey: ["hard75-days", run?.id],
    enabled: !!run?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hard75_days" as never)
        .select("*")
        .eq("run_id", run!.id)
        .order("day_number");
      if (error) throw error;
      return (data as unknown as Hard75Day[]) || [];
    },
  });

  const stats = useMemo(() => {
    if (!run?.start_date || days.length === 0) return null;
    const current = Math.min(HARD75_LENGTH, Math.max(1, dayNumberFor(run.start_date, today)));
    return {
      current,
      streak: streak(days),
      failed: firstFailedDay(days, today),
      complete: days.filter((d) =>
        d.strength_done && d.cardio_done && d.outdoor_done &&
        d.water_done && d.reading_done && d.diet_done
      ).length,
    };
  }, [run, days, today]);

  const refreshAll = () => {
    qc.invalidateQueries({ queryKey: ["hard75-runs"] });
    qc.invalidateQueries({ queryKey: ["hard75-days"] });
  };

  // Signed in as an admin, so straight to the tables. The invite link uses the
  // same components through a different api — see src/lib/hard75Api.ts.
  // Keyed on the run id alone: refreshAll is stable in behaviour and rebuilding
  // the api on every render would re-run the photo query on each keystroke.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const api = useMemo(() => (run ? adminApi(run.id, refreshAll) : null), [run?.id]);

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="border-b border-white/10 px-4 md:px-8 py-4 flex items-center gap-3 flex-wrap">
        <Button
          variant="ghost" size="icon"
          onClick={() => navigate("/admin/operations")}
          className="text-white/25 hover:text-white hover:bg-white/5 h-9 w-9"
          aria-label="Back to Operations"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: `${STRENGTH_COLOR}22` }}
        >
          <Flame className="w-5 h-5" style={{ color: STRENGTH_COLOR }} />
        </div>
        <div className="min-w-0">
          <h1 className="text-xl md:text-2xl font-black tracking-tight">75 Hard</h1>
          {run?.start_date ? (
            <p className="text-xs text-white/40">
              {run.start_date} to {endDateOf(run.start_date)}
            </p>
          ) : run ? (
            <p className="text-xs text-amber-400/70">Waiting on them to open their link</p>
          ) : null}
        </div>

        {/* Whose 75 this is. Only a picker once more than one person is running
            it — a lone participant shouldn't have to choose themselves. */}
        {runs.length > 0 && (
          <div className="flex items-center gap-2">
            {runs.length > 1 ? (
              <Select value={run?.id ?? ""} onValueChange={setRunId}>
                <SelectTrigger className="h-9 w-[220px] bg-neutral-900 border-neutral-800 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-neutral-900 border-neutral-800 text-white">
                  {runs.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.participant}
                      {r.status === "failed" && " · ended"}
                      {r.status === "complete" && " · finished"}
                      <span className="text-white/30"> · {r.start_date}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <span className="font-semibold">{run?.participant}</span>
            )}
            <Button
              variant="outline"
              onClick={() => setInviting(true)}
              className="h-9 bg-transparent border-white/15 text-white/70 hover:text-white text-xs font-semibold"
            >
              <Link2 className="w-4 h-4 mr-1.5" /> Invite someone
            </Button>
            <Button
              variant="ghost" size="icon"
              onClick={() => setStarting(true)}
              title="Set one up here, without a link"
              aria-label="Set one up here, without a link"
              className="text-white/40 hover:text-white h-9 w-9"
            >
              <UserPlus className="w-4 h-4" />
            </Button>
          </div>
        )}

        {run && stats && (
          <div className="ml-auto flex items-center gap-2 md:gap-3 flex-wrap">
            <HeaderStat label="Day" value={`${stats.current} of ${HARD75_LENGTH}`} />
            <HeaderStat label="Streak" value={String(stats.streak)} accent={STRENGTH_COLOR} />
            <HeaderStat label="Days done" value={String(stats.complete)} />
            <Button
              variant="ghost" size="icon"
              onClick={() => setDeleting(true)}
              title={`Delete ${run.participant}'s run`}
              aria-label="Delete this run"
              className="text-white/20 hover:text-red-400 h-9 w-9"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        )}
      </header>

      {isLoading ? (
        <p className="text-white/40 text-center py-20">Loading…</p>
      ) : !run ? (
        <FirstChoice
          onInvite={() => setInviting(true)}
          onSelf={() => setStarting(true)}
        />
      ) : (
        <div className="px-4 md:px-8 py-5 max-w-6xl mx-auto space-y-5">
          {run.status === "failed" ? (
            <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
              <p className="font-bold text-white/70">
                This attempt ended on day {run.failed_on_day}.
              </p>
              <p className="text-sm text-white/35">Kept as history. Read-only.</p>
            </div>
          ) : (
            stats?.failed && (
              <FailedBanner
                run={run}
                day={stats.failed.day_number}
                ownerId={user?.id ?? null}
                onRestarted={refreshAll}
              />
            )
          )}

          <div className="flex items-center gap-2">
            <TabButton active={tab === "calendar"} onClick={() => setTab("calendar")} icon={CalendarDays}>
              Calendar
            </TabButton>
            <TabButton active={tab === "journal"} onClick={() => setTab("journal")} icon={BookOpen}>
              Journal
            </TabButton>
            <TabButton active={tab === "photos"} onClick={() => setTab("photos")} icon={Images}>
              Photos
            </TabButton>
          </div>

          {tab === "calendar" ? (
            <Hard75Calendar run={run} days={days} today={today} onOpenDay={(d) => setOpenDay(d.id)} />
          ) : tab === "journal" ? (
            <Hard75Journal days={days} onOpenDay={(d) => setOpenDay(d.id)} />
          ) : (
            <Hard75Photos run={run} days={days} api={api!} />
          )}

          {/* Held by id so the sheet keeps showing live data as boxes are ticked. */}
          {api && (
            <Hard75DaySheet
              day={days.find((d) => d.id === openDay) ?? null}
              days={days}
              run={run}
              api={api}
              onClose={() => setOpenDay(null)}
            />
          )}
        </div>
      )}

      {/* Someone else wants to run it. */}
      <Dialog open={starting} onOpenChange={setStarting}>
        <DialogContent className="bg-neutral-950 border-neutral-800 text-white max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Start a 75 for someone else</DialogTitle>
          </DialogHeader>
          <StartRun
            compact
            ownerId={user?.id ?? null}
            onStarted={() => { setStarting(false); refreshAll(); }}
          />
        </DialogContent>
      </Dialog>

      <InviteDialog open={inviting} onClose={() => setInviting(false)} onCreated={refreshAll} />

      {run && (
        <DeleteRunDialog
          open={deleting}
          run={run}
          onClose={() => setDeleting(false)}
          onDeleted={() => { setDeleting(false); setRunId(null); refreshAll(); }}
        />
      )}
    </div>
  );
};

const HeaderStat = ({ label, value, accent }: { label: string; value: string; accent?: string }) => (
  <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-1.5 text-center">
    <p className="text-[9px] uppercase tracking-wider text-white/35 font-semibold">{label}</p>
    <p className="text-base font-bold leading-tight" style={accent ? { color: accent } : undefined}>
      {value}
    </p>
  </div>
);

const TabButton = ({
  active, onClick, icon: Icon, children,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof CalendarDays;
  children: React.ReactNode;
}) => (
  <button
    onClick={onClick}
    className={`h-9 px-4 rounded-lg text-sm font-semibold border inline-flex items-center gap-1.5 transition-colors ${
      active ? "border-white/30 bg-white/10 text-white" : "border-white/10 text-white/45 hover:text-white"
    }`}
  >
    <Icon className="w-4 h-4" /> {children}
  </button>
);

/* ───── Starting ───── */

const StartRun = ({
  ownerId, onStarted, compact,
}: {
  ownerId: string | null;
  onStarted: () => void;
  compact?: boolean;
}) => {
  const [participant, setParticipant] = useState("");
  const [age, setAge] = useState("");
  const [goal, setGoal] = useState("");
  const [limitations, setLimitations] = useState("");
  const [startDate, setStartDate] = useState(toDateString(new Date()));

  const start = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from("hard75_runs" as never)
        .insert({
          participant: participant.trim(),
          age: age ? Number(age) : null,
          goal: goal.trim() || null,
          limitations: limitations.trim() || null,
          start_date: startDate,
          owner_id: ownerId,
        } as never)
        .select("id")
        .single();
      if (error) throw error;

      // All 75 days are written now, so the whole calendar exists on day one.
      // Seeing day 40 on day 1 is most of the motivation.
      const runId = (data as unknown as { id: string }).id;
      const rows = buildPlan(startDate).map((d) => ({ ...d, run_id: runId }));
      const { error: dErr } = await supabase.from("hard75_days" as never).insert(rows as never);
      if (dErr) throw dErr;
    },
    onSuccess: () => {
      toast.success("75 days written. Day 1 starts now.");
      onStarted();
    },
    onError: (e: Error) => toast.error(e.message || "Couldn't start that."),
  });

  return (
    <div className={compact ? "space-y-4" : "max-w-md mx-auto px-4 py-12 space-y-5"}>
      {!compact && (
        <div className="text-center">
          <h2 className="text-2xl font-bold">Start the 75</h2>
          <p className="text-white/40 text-sm mt-1">
            Two workouts a day, one outdoors. Gallon of water. Ten pages. Diet held. A photo. Every day for
            seventy-five days.
          </p>
        </div>
      )}

      <div className="space-y-3">
        <div>
          <Label className="text-xs text-white/50">Name</Label>
          <Input
            value={participant}
            onChange={(e) => setParticipant(e.target.value)}
            placeholder="Rob"
            className="mt-1 bg-neutral-900 border-neutral-800 text-white"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs text-white/50">Age</Label>
            <Input
              type="number" min="1"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              placeholder="45"
              className="mt-1 bg-neutral-900 border-neutral-800 text-white"
            />
          </div>
          <div>
            <Label className="text-xs text-white/50">Start date</Label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="mt-1 bg-neutral-900 border-neutral-800 text-white"
            />
          </div>
        </div>
        <div>
          <Label className="text-xs text-white/50">Goal</Label>
          <Input
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="Lose weight, build muscle"
            className="mt-1 bg-neutral-900 border-neutral-800 text-white"
          />
        </div>
        <div>
          <Label className="text-xs text-white/50">Anything to train around</Label>
          <Textarea
            value={limitations}
            onChange={(e) => setLimitations(e.target.value)}
            rows={2}
            placeholder="Old shoulder, bad knee — leave blank if nothing"
            className="mt-1 bg-neutral-900 border-neutral-800 text-white"
          />
          <p className="text-[11px] text-white/30 mt-1">
            Used whenever a workout gets rewritten, so it never prescribes around an injury it doesn&apos;t know about.
          </p>
        </div>
      </div>

      <Button
        onClick={() => start.mutate()}
        disabled={participant.trim().length < 2 || start.isPending}
        className="w-full h-12 text-white font-bold text-base"
        style={{ backgroundColor: STRENGTH_COLOR }}
      >
        {start.isPending ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <><Plus className="w-4 h-4 mr-1.5" /> Start — {startDate} to {endDateOf(startDate)}</>
        )}
      </Button>
    </div>
  );
};

/* ───── The reset ───── */

const FailedBanner = ({
  run, day, ownerId, onRestarted,
}: {
  run: Hard75Run;
  day: number;
  ownerId: string | null;
  onRestarted: () => void;
}) => {
  const restart = useMutation({
    mutationFn: async () => {
      // The failed attempt is kept, not deleted. On day 62 of the next try, the
      // record of reaching day 41 on this one is the whole point.
      const { error } = await supabase
        .from("hard75_runs" as never)
        .update({ status: "failed", failed_on_day: day } as never)
        .eq("id", run.id);
      if (error) throw error;

      const startDate = toDateString(new Date());
      const { data, error: rErr } = await supabase
        .from("hard75_runs" as never)
        .insert({
          participant: run.participant,
          age: run.age,
          goal: run.goal,
          limitations: run.limitations,
          start_date: startDate,
          owner_id: ownerId ?? run.owner_id,
          restarted_from: run.id,
        } as never)
        .select("id")
        .single();
      if (rErr) throw rErr;

      const newId = (data as unknown as { id: string }).id;
      const rows = buildPlan(startDate).map((d) => ({ ...d, run_id: newId }));
      const { error: dErr } = await supabase.from("hard75_days" as never).insert(rows as never);
      if (dErr) throw dErr;
    },
    onSuccess: () => {
      toast.success("Back to Day 1.");
      onRestarted();
    },
    onError: (e: Error) => toast.error(e.message || "Couldn't restart."),
  });

  return (
    <div className="rounded-xl border border-red-500/30 bg-red-500/[0.07] px-4 py-3 flex items-start justify-between gap-4 flex-wrap">
      <div>
        <p className="font-bold text-red-300">Day {day} wasn&apos;t completed.</p>
        <p className="text-sm text-red-200/60">
          75 Hard has no partial credit — this attempt is over. Restarting keeps it in your history, so you
          can see how far you got.
        </p>
      </div>
      <Button
        onClick={() => restart.mutate()}
        disabled={restart.isPending}
        className="bg-red-600 hover:bg-red-500 text-white font-bold"
      >
        {restart.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><RotateCcw className="w-4 h-4 mr-1.5" /> Restart at Day 1</>}
      </Button>
    </div>
  );
};

/* ───── Deleting a run ───── */

const DeleteRunDialog = ({
  open, run, onClose, onDeleted,
}: {
  open: boolean;
  run: Hard75Run;
  onClose: () => void;
  onDeleted: () => void;
}) => {
  const [confirmName, setConfirmName] = useState("");

  const destroy = useMutation({
    mutationFn: async () => {
      // Photos live in storage, not in the row, so they have to go separately —
      // otherwise a deleted run leaves someone's body photos on the server.
      const { data: files } = await supabase.storage.from("hard75-photos").list(run.id);
      if (files?.length) {
        await supabase.storage
          .from("hard75-photos")
          .remove(files.map((f) => `${run.id}/${f.name}`));
      }
      const { error } = await supabase.from("hard75_runs" as never).delete().eq("id", run.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Run deleted.");
      setConfirmName("");
      onDeleted();
    },
    onError: (e: Error) => toast.error(e.message || "Couldn't delete that."),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { setConfirmName(""); onClose(); } }}>
      <DialogContent className="bg-neutral-950 border-neutral-800 text-white max-w-md">
        <DialogHeader>
          <DialogTitle>Delete {run.participant}&apos;s 75?</DialogTitle>
          <DialogDescription className="text-white/50">
            All 75 days, every tick, the journal and every progress photo. There is no undo, and the photos
            are removed from storage as well.
          </DialogDescription>
        </DialogHeader>

        <div>
          <Label className="text-xs text-white/50">
            Type <span className="text-white font-semibold">{run.participant}</span> to confirm
          </Label>
          <Input
            value={confirmName}
            onChange={(e) => setConfirmName(e.target.value)}
            className="mt-1 bg-neutral-900 border-neutral-800 text-white"
          />
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} className="text-white/50 hover:text-white">
            Cancel
          </Button>
          <Button
            onClick={() => destroy.mutate()}
            disabled={confirmName.trim() !== run.participant || destroy.isPending}
            className="bg-red-600 hover:bg-red-500 text-white font-bold"
          >
            {destroy.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Delete run"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

/* ───── The invite link ───── */

// 32 hex characters from the browser's CSPRNG. Long enough that guessing it is
// not a thing anyone can do, and it never leaves this app except in the link.
const newToken = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

const InviteDialog = ({
  open, onClose, onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) => {
  const [name, setName] = useState("");
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const create = useMutation({
    mutationFn: async () => {
      const token = newToken();
      // Nothing but a name and a token. No start date, no days — the run sits
      // as 'pending' until they open the link and fill it in themselves.
      const { error } = await supabase.from("hard75_runs" as never).insert({
        participant: name.trim(),
        status: "pending",
        access_token: token,
      } as never);
      if (error) throw error;
      return `${window.location.origin}/75/${token}`;
    },
    onSuccess: (url) => { setLink(url); onCreated(); },
    onError: (e: Error) => toast.error(e.message || "Couldn’t make a link."),
  });

  const close = () => { setName(""); setLink(null); setCopied(false); onClose(); };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) close(); }}>
      <DialogContent className="bg-neutral-950 border-neutral-800 text-white max-w-md">
        <DialogHeader>
          <DialogTitle>Send someone a private link</DialogTitle>
          <DialogDescription className="text-white/50">
            They open it, set their own PIN and fill in their own details. No account, and no way into
            anything else here.
          </DialogDescription>
        </DialogHeader>

        {link ? (
          <div className="space-y-3">
            <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-3 break-all text-sm text-white/80">
              {link}
            </div>
            <Button
              onClick={async () => {
                await navigator.clipboard.writeText(link);
                setCopied(true);
                toast.success("Link copied.");
              }}
              className="w-full font-bold"
              style={{ backgroundColor: STRENGTH_COLOR }}
            >
              {copied ? <><Check className="w-4 h-4 mr-1.5" /> Copied</> : <><Copy className="w-4 h-4 mr-1.5" /> Copy the link</>}
            </Button>
            <p className="text-[11px] text-white/30">
              Send it to them directly. Whoever holds this link can set the PIN, so don’t post it anywhere
              public — and if it goes astray, delete the run and send a new one.
            </p>
          </div>
        ) : (
          <>
            <div>
              <Label className="text-xs text-white/50">Who is it for?</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Rob"
                className="mt-1 bg-neutral-900 border-neutral-800 text-white"
              />
              <p className="text-[11px] text-white/30 mt-1">
                Just so you can tell the runs apart. They can correct it themselves.
              </p>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={close} className="text-white/50 hover:text-white">Cancel</Button>
              <Button
                onClick={() => create.mutate()}
                disabled={name.trim().length < 2 || create.isPending}
                className="font-bold text-white"
                style={{ backgroundColor: STRENGTH_COLOR }}
              >
                {create.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Link2 className="w-4 h-4 mr-1.5" /> Make the link</>}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

/* ───── The very first screen ─────
   It used to be a name field, which reads as "what is YOUR name" — so a coach
   setting somebody else up ends up creating a run for himself. Ask which it is
   before asking anything else. */

const FirstChoice = ({
  onInvite, onSelf,
}: {
  onInvite: () => void;
  onSelf: () => void;
}) => (
  <div className="max-w-lg mx-auto px-4 py-14 space-y-6">
    <div className="text-center">
      <div
        className="w-14 h-14 rounded-2xl grid place-items-center mx-auto mb-3"
        style={{ backgroundColor: `${STRENGTH_COLOR}22` }}
      >
        <Flame className="w-7 h-7" style={{ color: STRENGTH_COLOR }} />
      </div>
      <h2 className="text-2xl font-bold">75 Hard</h2>
      <p className="text-white/40 text-sm mt-1">
        Two workouts a day, one outdoors. Gallon of water. Ten pages. Diet held. A photo. Every day for
        seventy-five days.
      </p>
    </div>

    <div className="space-y-3">
      <button
        onClick={onInvite}
        className="w-full text-left rounded-2xl border border-white/15 bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/30 transition-colors p-5"
      >
        <div className="flex items-start gap-3">
          <Link2 className="w-5 h-5 mt-0.5 shrink-0" style={{ color: STRENGTH_COLOR }} />
          <div>
            <p className="font-bold">Someone else is doing it</p>
            <p className="text-sm text-white/45 mt-0.5">
              Get a private link to send them. They set their own PIN and fill in their own details — no
              account, and no way into anything else here. You still see everything.
            </p>
          </div>
        </div>
      </button>

      <button
        onClick={onSelf}
        className="w-full text-left rounded-2xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/25 transition-colors p-5"
      >
        <div className="flex items-start gap-3">
          <UserPlus className="w-5 h-5 mt-0.5 text-white/40 shrink-0" />
          <div>
            <p className="font-bold">I&rsquo;m doing it</p>
            <p className="text-sm text-white/45 mt-0.5">
              Set it up here and track it from this screen.
            </p>
          </div>
        </div>
      </button>
    </div>
  </div>
);

export default Hard75;
