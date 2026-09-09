// The participant's own 75, opened from a private link.
//
// No account, no admin, no sidebar. A token in the URL and a PIN he sets the
// first time. Everything on this page goes through the hard75-access edge
// function, which checks the token server-side — the browser is never given
// access to a table.
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Flame, Loader2, CalendarDays, Images, BookOpen, Lock, ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import {
  Hard75Run, Hard75Day, HARD75_LENGTH, buildPlan, toDateString, endDateOf,
  dayNumberFor, streak, STRENGTH_COLOR,
} from "@/lib/hard75";
import { tokenApi } from "@/lib/hard75Api";
import Hard75Calendar from "@/components/hard75/Hard75Calendar";
import Hard75Photos from "@/components/hard75/Hard75Photos";
import Hard75Journal from "@/components/hard75/Hard75Journal";
import Hard75DaySheet from "@/components/hard75/Hard75DaySheet";

type Phase = "loading" | "bad" | "set-pin" | "enter-pin" | "setup" | "ready";

const Hard75Invite = () => {
  const { token = "" } = useParams();
  const [phase, setPhase] = useState<Phase>("loading");
  const [pin, setPin] = useState("");
  const [participant, setParticipant] = useState("");
  const [busy, setBusy] = useState(false);
  const [run, setRun] = useState<Hard75Run | null>(null);
  const [days, setDays] = useState<Hard75Day[]>([]);
  const [tab, setTab] = useState<"calendar" | "journal" | "photos">("calendar");
  const [openDay, setOpenDay] = useState<string | null>(null);
  const today = toDateString(new Date());

  const call = useCallback(
    async (action: string, extra: Record<string, unknown> = {}) => {
      const { data, error } = await supabase.functions.invoke("hard75-access", {
        body: { token, pin, action, ...extra },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    [token, pin]
  );

  const load = useCallback(async () => {
    const data = await call("get");
    setRun(data.run as Hard75Run);
    setDays((data.days ?? []) as Hard75Day[]);
    setPhase(data.run?.status === "pending" ? "setup" : "ready");
  }, [call]);

  // What the link is before we know the PIN.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("hard75-access", {
          body: { token, action: "peek" },
        });
        if (cancelled) return;
        if (error || data?.error) { setPhase("bad"); return; }
        setParticipant(data.participant ?? "");
        setPhase(data.needsPin ? "enter-pin" : "set-pin");
      } catch {
        if (!cancelled) setPhase("bad");
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  const api = useMemo(
    () => (run ? tokenApi(token, pin, run.id, () => { void load(); }) : null),
    [token, pin, run, load]
  );

  const stats = useMemo(() => {
    if (!run?.start_date || days.length === 0) return null;
    return {
      current: Math.min(HARD75_LENGTH, Math.max(1, dayNumberFor(run.start_date, today))),
      streak: streak(days),
    };
  }, [run, days, today]);

  /* ───── Gates ───── */

  if (phase === "loading") {
    return <Centered><Loader2 className="w-6 h-6 animate-spin text-white/30" /></Centered>;
  }

  if (phase === "bad") {
    return (
      <Centered>
        <div className="text-center max-w-sm">
          <Lock className="w-10 h-10 mx-auto mb-3 text-white/20" />
          <h1 className="text-xl font-bold">This link doesn&apos;t work</h1>
          <p className="text-white/40 text-sm mt-2">
            It may have been replaced. Ask whoever sent it for a new one.
          </p>
        </div>
      </Centered>
    );
  }

  if (phase === "set-pin" || phase === "enter-pin") {
    const setting = phase === "set-pin";
    return (
      <Centered>
        <div className="w-full max-w-xs text-center space-y-5">
          <div>
            <div
              className="w-12 h-12 rounded-2xl grid place-items-center mx-auto mb-3"
              style={{ backgroundColor: `${STRENGTH_COLOR}22` }}
            >
              <Flame className="w-6 h-6" style={{ color: STRENGTH_COLOR }} />
            </div>
            <h1 className="text-2xl font-black">75 Hard</h1>
            <p className="text-white/40 text-sm mt-1">
              {setting
                ? "Set a PIN. You'll use it every time you open this link, and it keeps your photos yours."
                : `Welcome back${participant ? `, ${participant}` : ""}.`}
            </p>
          </div>

          <Input
            type="password"
            inputMode="numeric"
            autoComplete="off"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
            placeholder={setting ? "Choose 4 digits" : "PIN"}
            className="h-14 text-center text-2xl tracking-[0.5em] bg-neutral-900 border-neutral-800 text-white"
          />

          <Button
            onClick={async () => {
              setBusy(true);
              try {
                if (setting) await call("set_pin");
                await load();
              } catch (e) {
                toast.error((e as Error)?.message ?? "That didn't work.");
              } finally {
                setBusy(false);
              }
            }}
            disabled={pin.length < 4 || busy}
            className="w-full h-12 text-white font-bold"
            style={{ backgroundColor: STRENGTH_COLOR }}
          >
            {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : setting ? "Set PIN and start" : "Open"}
          </Button>

          {setting && (
            <p className="text-[11px] text-white/25 flex items-start gap-1.5 text-left">
              <ShieldCheck className="w-3.5 h-3.5 shrink-0 mt-px" />
              Nobody can reset this for you, so pick something you won&apos;t forget.
            </p>
          )}
        </div>
      </Centered>
    );
  }

  /* ───── His own details, then the 75 ───── */

  if (phase === "setup" || !run) {
    return <SetupForm defaultName={participant} onSubmit={async (v) => {
      setBusy(true);
      try {
        await call("setup", { ...v, plan: buildPlan(v.startDate) });
        await load();
        toast.success("You're on Day 1.");
      } catch (e) {
        toast.error((e as Error)?.message ?? "Couldn't start that.");
      } finally {
        setBusy(false);
      }
    }} busy={busy} />;
  }

  /* ───── The 75 ───── */

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="border-b border-white/10 px-4 md:px-8 py-4 flex items-center gap-3 flex-wrap">
        <div
          className="w-10 h-10 rounded-xl grid place-items-center shrink-0"
          style={{ backgroundColor: `${STRENGTH_COLOR}22` }}
        >
          <Flame className="w-5 h-5" style={{ color: STRENGTH_COLOR }} />
        </div>
        <div className="min-w-0">
          <h1 className="text-xl md:text-2xl font-black tracking-tight">75 Hard</h1>
          <p className="text-xs text-white/40">
            {run.participant}
            {run.start_date && ` · ${run.start_date} to ${endDateOf(run.start_date)}`}
          </p>
        </div>
        {stats && (
          <div className="ml-auto flex items-center gap-2">
            <Stat label="Day" value={`${stats.current} of ${HARD75_LENGTH}`} />
            <Stat label="Streak" value={String(stats.streak)} accent={STRENGTH_COLOR} />
          </div>
        )}
      </header>

      <div className="px-4 md:px-8 py-5 max-w-6xl mx-auto space-y-5">
        <div className="flex items-center gap-2">
          <Tab active={tab === "calendar"} onClick={() => setTab("calendar")} icon={CalendarDays}>Calendar</Tab>
          <Tab active={tab === "journal"} onClick={() => setTab("journal")} icon={BookOpen}>Journal</Tab>
          <Tab active={tab === "photos"} onClick={() => setTab("photos")} icon={Images}>Photos</Tab>
        </div>

        {api && (
          <>
            {tab === "calendar" ? (
              <Hard75Calendar run={run} days={days} today={today} onOpenDay={(d) => setOpenDay(d.id)} />
            ) : tab === "journal" ? (
              <Hard75Journal days={days} onOpenDay={(d) => setOpenDay(d.id)} />
            ) : (
              <Hard75Photos run={run} days={days} api={api} />
            )}

            <Hard75DaySheet
              day={days.find((d) => d.id === openDay) ?? null}
              days={days}
              run={run}
              api={api}
              onClose={() => setOpenDay(null)}
            />
          </>
        )}
      </div>
    </div>
  );
};

/* ───── Pieces ───── */

const Centered = ({ children }: { children: React.ReactNode }) => (
  <div className="min-h-screen bg-black text-white grid place-items-center px-4">{children}</div>
);

const Stat = ({ label, value, accent }: { label: string; value: string; accent?: string }) => (
  <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-1.5 text-center">
    <p className="text-[9px] uppercase tracking-wider text-white/35 font-semibold">{label}</p>
    <p className="text-base font-bold leading-tight" style={accent ? { color: accent } : undefined}>{value}</p>
  </div>
);

const Tab = ({
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

const SetupForm = ({
  defaultName, onSubmit, busy,
}: {
  defaultName: string;
  onSubmit: (v: {
    participant: string; age: string; goal: string; limitations: string; startDate: string;
  }) => Promise<void>;
  busy: boolean;
}) => {
  const [participant, setParticipant] = useState(defaultName);
  const [age, setAge] = useState("");
  const [goal, setGoal] = useState("");
  const [limitations, setLimitations] = useState("");
  const [startDate, setStartDate] = useState(toDateString(new Date()));

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-md mx-auto px-4 py-12 space-y-5">
        <div className="text-center">
          <div
            className="w-12 h-12 rounded-2xl grid place-items-center mx-auto mb-3"
            style={{ backgroundColor: `${STRENGTH_COLOR}22` }}
          >
            <Flame className="w-6 h-6" style={{ color: STRENGTH_COLOR }} />
          </div>
          <h1 className="text-2xl font-bold">Let&apos;s set you up</h1>
          <p className="text-white/40 text-sm mt-1">
            Two workouts a day, one outdoors. Gallon of water. Ten pages. Diet held. A photo. Every day for
            seventy-five days.
          </p>
        </div>

        <div className="space-y-3">
          <div>
            <Label className="text-xs text-white/50">Your name</Label>
            <Input
              value={participant}
              onChange={(e) => setParticipant(e.target.value)}
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
              <p className="text-[11px] text-white/25 mt-1">Recovery at 45 isn&apos;t recovery at 22 — it changes the workouts.</p>
            </div>
            <div>
              <Label className="text-xs text-white/50">Day 1</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="mt-1 bg-neutral-900 border-neutral-800 text-white"
              />
            </div>
          </div>
          <div>
            <Label className="text-xs text-white/50">What are you after?</Label>
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
            <p className="text-[11px] text-white/25 mt-1">
              So a workout never asks you to train through something it doesn&apos;t know about.
            </p>
          </div>
        </div>

        <Button
          onClick={() => onSubmit({ participant, age, goal, limitations, startDate })}
          disabled={participant.trim().length < 2 || busy}
          className="w-full h-12 text-white font-bold text-base"
          style={{ backgroundColor: STRENGTH_COLOR }}
        >
          {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : `Start — ${startDate} to ${endDateOf(startDate)}`}
        </Button>
      </div>
    </div>
  );
};

export default Hard75Invite;
