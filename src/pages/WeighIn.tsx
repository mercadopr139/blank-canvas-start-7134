import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Search, Scale, ArrowLeft, CheckCircle2, X, CalendarDays } from "lucide-react";
import nlaLogo from "@/assets/nla-logo-white.png";

const getHeadshotUrl = (url: string | null): string | null => {
  if (!url) return null;
  const bust = `?v=${Date.now()}`;
  if (url.startsWith("http")) return url + bust;
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  return `${supabaseUrl}/storage/v1/object/public/youth-photos/${url}${bust}`;
};

interface Youth {
  id: string;
  child_first_name: string;
  child_last_name: string;
  child_boxing_program: string;
  child_headshot_url: string | null;
}

interface WeighResult {
  child_first_name: string;
  child_last_name: string;
  weight_lb: number;
  target_weight: number | null;
  kiosk_message: string | null;
  previous_weight: number | null;
  previous_date: string | null;
  camp_name: string | null;
  fight_date: string | null;
}

const fmt = (n: number | null | undefined) =>
  n === null || n === undefined ? "" : Number(n).toFixed(1);

const Confetti = () => {
  const colors = ["#22c55e", "#facc15", "#ef4444", "#3b82f6", "#a855f7", "#f97316"];
  const particles = Array.from({ length: 60 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 0.5,
    duration: 1 + Math.random() * 2,
    color: colors[Math.floor(Math.random() * colors.length)],
    size: 10 + Math.random() * 10,
  }));
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-50">
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute animate-confetti"
          style={{
            left: `${p.left}%`,
            top: "-20px",
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            borderRadius: Math.random() > 0.5 ? "50%" : "2px",
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
          }}
        />
      ))}
    </div>
  );
};

const WeighIn = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [youth, setYouth] = useState<Youth[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Youth | null>(null);
  const [weight, setWeight] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<WeighResult | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const weightRef = useRef<HTMLInputElement>(null);
  const todayLabel = new Date().toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", timeZone: "America/New_York",
  });

  const resetAll = useCallback(() => {
    setSelected(null);
    setWeight("");
    setResult(null);
    setError(null);
    setSearch("");
    setYouth([]);
  }, []);

  // Auto-focus the right field for the current step.
  useEffect(() => {
    if (result) return;
    if (selected) weightRef.current?.focus();
    else searchRef.current?.focus();
  }, [selected, result]);

  // Debounced name search (reuses the same kiosk search as check-in).
  useEffect(() => {
    if (selected) return;
    if (search.length < 2) {
      setYouth([]);
      return;
    }
    const t = setTimeout(async () => {
      setLoading(true);
      const { data, error } = await supabase.rpc("search_kiosk_youth", { _search: search });
      if (error) {
        console.error("Weigh-in search failed:", error);
        setYouth([]);
      } else {
        setYouth((data as Youth[]) || []);
      }
      setLoading(false);
    }, 300);
    return () => clearTimeout(t);
  }, [search, selected]);

  const submitWeight = async () => {
    if (!selected) return;
    const w = parseFloat(weight);
    if (!w || w <= 0 || w >= 1000) {
      setError("Enter a valid weight, like 105.6");
      return;
    }
    setError(null);
    setSubmitting(true);
    const { data, error } = await supabase.rpc("record_weigh_in" as never, {
      _registration_id: selected.id,
      _weight: w,
    } as never);
    setSubmitting(false);
    if (error) {
      setError(error.message || "Something went wrong. Please try again.");
      return;
    }
    const row = (data as WeighResult[] | null)?.[0] ?? null;
    setResult(
      row ?? {
        child_first_name: selected.child_first_name,
        child_last_name: selected.child_last_name,
        weight_lb: w,
        target_weight: null,
        kiosk_message: null,
        previous_weight: null,
        previous_date: null,
        camp_name: null,
        fight_date: null,
      }
    );
    // Auto-return to search after the celebration.
    setTimeout(resetAll, 6000);
  };

  const hasResults = youth.length > 0;
  const showEmpty = !loading && !selected && search.length >= 2 && youth.length === 0;
  const isIdle = !hasResults && !showEmpty && !selected;

  /* ─── Celebration pop-up ─── */
  if (result) {
    const goal = result.target_weight;
    const toGo = goal !== null ? Math.round((result.weight_lb - goal) * 10) / 10 : null;
    const sinceLast =
      result.previous_weight !== null
        ? Math.round((result.weight_lb - result.previous_weight) * 10) / 10
        : null;
    const defaultMsg = "Eat Protein! Watch your Carbs! 💪";
    const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
    const daysToFight = result.fight_date
      ? Math.round((Date.parse(result.fight_date + "T00:00:00") - Date.parse(todayStr + "T00:00:00")) / 86400000)
      : null;
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <Confetti />
        <div className="text-center animate-in zoom-in duration-500 px-6">
          <CheckCircle2 className="w-24 h-24 md:w-32 md:h-32 text-green-400 mx-auto mb-5 animate-bounce" />
          <p className="text-2xl md:text-3xl text-white/70 font-semibold">Nice work,</p>
          <h2 className="text-5xl md:text-7xl font-black text-green-400 mb-3 tracking-tight">
            {result.child_first_name}!
          </h2>
          <p className="text-4xl md:text-6xl font-black text-white mb-6 tabular-nums">
            {fmt(result.weight_lb)} <span className="text-2xl md:text-3xl text-white/50">lb</span>
          </p>

          {daysToFight !== null && daysToFight >= 0 && (
            <p className="text-xl md:text-3xl text-red-300 font-bold mb-4">
              🥊 {result.camp_name?.trim() ? result.camp_name : "Fight"} —{" "}
              {daysToFight === 0 ? "TODAY!" : `${daysToFight} day${daysToFight === 1 ? "" : "s"} out`}
            </p>
          )}

          {goal !== null && (
            <div className="mb-4">
              <p className="text-xl md:text-2xl text-white/80">
                🎯 Goal: <span className="font-bold">{fmt(goal)} lb</span>
              </p>
              <p className="text-lg md:text-2xl mt-1">
                {toGo !== null && toGo > 0 ? (
                  <span className="text-yellow-300 font-semibold">{fmt(toGo)} lb to go!</span>
                ) : (
                  <span className="text-green-300 font-bold">You hit your goal! 🎉</span>
                )}
              </p>
            </div>
          )}

          {sinceLast !== null && sinceLast !== 0 && (
            <p className="text-base md:text-xl text-white/60 mb-3">
              {sinceLast < 0 ? "▼ down" : "▲ up"} {fmt(Math.abs(sinceLast))} lb since last weigh-in
            </p>
          )}

          {/* Always show a message: the boxer's custom one, or the default. */}
          <p className="text-xl md:text-3xl text-white/90 italic mt-4 max-w-2xl mx-auto">
            {result.kiosk_message?.trim() || defaultMsg}
          </p>

          <Button
            onClick={resetAll}
            className="mt-8 bg-white/10 hover:bg-white/20 text-white text-lg px-8 py-6 rounded-xl"
          >
            Done
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <style>{`
        .ww-eyes { display: inline-flex; gap: 0.12em; vertical-align: -0.06em; }
        .ww-eye {
          position: relative; width: 0.62em; height: 0.8em;
          background: #fff; border-radius: 50%; overflow: hidden;
          box-shadow: inset 0 -0.05em 0.08em rgba(0,0,0,0.25);
        }
        .ww-pupil {
          position: absolute; top: 50%; left: 8%;
          width: 0.3em; height: 0.3em; background: #111; border-radius: 50%;
          transform: translateY(-50%);
          animation: ww-eye-look 2.6s ease-in-out infinite;
        }
        @keyframes ww-eye-look {
          0%, 12% { left: 8%; }
          45%, 55% { left: 44%; }
          88%, 100% { left: 8%; }
        }
        @media (prefers-reduced-motion: reduce) {
          .ww-pupil { animation: none; left: 26%; }
        }
      `}</style>
      <Button
        variant="ghost"
        size="sm"
        className="absolute top-4 left-4 text-white/40 hover:text-white hover:bg-white/10 z-10"
        onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/"))}
      >
        <ArrowLeft className="w-4 h-4 mr-1" /> Back
      </Button>

      <div
        className={`flex-1 flex flex-col items-center px-4 md:px-8 transition-all duration-500 ${
          isIdle ? "justify-center" : "justify-start pt-8 md:pt-12"
        }`}
      >
        <img
          src={nlaLogo}
          alt="No Limits Academy"
          className={`mx-auto transition-all duration-500 ${
            isIdle ? "h-24 md:h-36 mb-6 md:mb-8" : "h-14 md:h-16 mb-4"
          }`}
        />
        <h1
          className={`font-black tracking-tight text-center flex items-center gap-3 text-green-500 transition-all duration-500 ${
            isIdle ? "text-4xl md:text-6xl mb-2" : "text-2xl md:text-3xl mb-1"
          }`}
        >
          <span className="ww-eyes" aria-hidden>
            <span className="ww-eye"><i className="ww-pupil" /></span>
            <span className="ww-eye"><i className="ww-pupil" /></span>
          </span>{" "}
          Weight Watchers
        </h1>
        <p
          className={`text-white/50 text-center transition-all duration-500 ${
            isIdle ? "text-lg md:text-xl mb-6" : "text-sm md:text-base mb-4"
          }`}
        >
          {selected ? "Enter your weight" : "Search your name to weigh in"}
        </p>

        <div className="w-full max-w-2xl">
          {/* Step 2: weight entry */}
          {selected ? (
            <Card className="bg-white/[0.04] border-2 border-white/10 text-white">
              <CardContent className="p-6 md:p-8">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center overflow-hidden flex-shrink-0 ring-2 ring-white/10">
                    {getHeadshotUrl(selected.child_headshot_url) ? (
                      <img src={getHeadshotUrl(selected.child_headshot_url)!} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-2xl font-bold text-white/50">{selected.child_first_name[0]}</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-2xl leading-tight">
                      {selected.child_first_name} {selected.child_last_name}
                    </p>
                    <p className="text-white/50">{selected.child_boxing_program}</p>
                  </div>
                  <button
                    onClick={resetAll}
                    className="ml-auto text-white/40 hover:text-white p-2"
                    aria-label="Cancel"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <div className="flex items-center justify-center gap-2 text-white/70 text-base md:text-lg font-medium mb-4">
                  <CalendarDays className="w-5 h-5 text-green-400" /> {todayLabel}
                </div>

                <label className="block text-white/60 text-sm mb-2">Weight (lb)</label>
                <div className="relative">
                  <Input
                    ref={weightRef}
                    value={weight}
                    onChange={(e) => setWeight(e.target.value.replace(/[^0-9.]/g, ""))}
                    onKeyDown={(e) => { if (e.key === "Enter") submitWeight(); }}
                    inputMode="decimal"
                    placeholder="105.6"
                    className="text-4xl md:text-5xl h-20 md:h-24 text-center bg-white/5 border-2 border-white/20 text-white placeholder:text-white/20 focus:border-green-500/60 rounded-2xl tabular-nums"
                  />
                </div>
                {error && <p className="text-red-400 text-center mt-3 text-lg">{error}</p>}

                <Button
                  onClick={submitWeight}
                  disabled={submitting}
                  className="w-full mt-6 bg-green-600 hover:bg-green-500 text-white font-bold text-xl md:text-2xl py-6 md:py-7 rounded-xl shadow-lg shadow-green-900/30 active:scale-95 transition-all"
                >
                  {submitting ? "Submitting…" : "Submit Today's Weight"}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Step 1: search */}
              <div className="relative mb-6">
                <Search
                  className={`absolute left-4 md:left-5 top-1/2 -translate-y-1/2 text-white/40 transition-all duration-500 ${
                    isIdle ? "w-7 h-7 md:w-8 md:h-8" : "w-6 h-6"
                  }`}
                />
                <Input
                  ref={searchRef}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Type your name"
                  className={`pl-12 md:pl-14 bg-white/5 border-2 border-white/20 text-white placeholder:text-white/30 focus:border-green-500/60 rounded-2xl transition-all duration-500 ${
                    isIdle ? "text-2xl md:text-3xl h-18 md:h-22" : "text-xl md:text-2xl h-16 md:h-18"
                  }`}
                  autoFocus
                />
              </div>

              <div className="space-y-4">
                {loading && <p className="text-center text-white/40 text-lg py-8">Searching…</p>}
                {showEmpty && (
                  <div className="text-center py-8 px-4">
                    <p className="text-white/50 text-lg">No match found</p>
                    <p className="text-white/60 text-sm mt-2">Double-check the spelling, or see a coach.</p>
                  </div>
                )}
                {youth.map((y, index) => (
                  <Card
                    key={y.id}
                    className="bg-white/[0.04] border-2 border-white/10 text-white transition-all duration-300 hover:bg-white/[0.07] animate-in slide-in-from-bottom-4 fade-in cursor-pointer"
                    style={{ animationDelay: `${index * 80}ms`, animationFillMode: "both" }}
                    onClick={() => { setSelected(y); setError(null); }}
                  >
                    <CardContent className="flex items-center gap-5 p-5">
                      <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center overflow-hidden flex-shrink-0 ring-2 ring-white/10">
                        {getHeadshotUrl(y.child_headshot_url) ? (
                          <img src={getHeadshotUrl(y.child_headshot_url)!} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-2xl font-bold text-white/50">{y.child_first_name[0]}</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-xl md:text-2xl leading-tight">
                          {y.child_first_name} {y.child_last_name}
                        </p>
                        <p className="text-base text-white/50 mt-0.5">{y.child_boxing_program}</p>
                      </div>
                      <div className="flex items-center gap-2 text-green-400 font-bold">
                        <Scale className="w-6 h-6" /> Weigh In
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default WeighIn;
