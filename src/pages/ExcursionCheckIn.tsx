import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Search, CheckCircle2, Users, ArrowLeft, MapPin, CalendarX, ClipboardCheck, Lock } from "lucide-react";
import nlaLogo from "@/assets/nla-logo-white.png";

const getHeadshotUrl = (url: string | null): string | null => {
  if (!url) return null;
  const bustParam = `?v=${Date.now()}`;
  if (url.startsWith("http")) return url + bustParam;
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  return `${supabaseUrl}/storage/v1/object/public/youth-photos/${url}${bustParam}`;
};

interface Youth {
  id: string;
  child_first_name: string;
  child_last_name: string;
  child_boxing_program: string;
  child_headshot_url: string | null;
}

interface TodaysExcursion {
  id: string;
  date: string;
  name: string;
  notes: string | null;
  youth_count: number;
  transportation_required: boolean | null;
  roster_locked_at: string | null;
}

const Confetti = () => {
  const colors = ["#a855f7", "#c084fc", "#facc15", "#22c55e", "#3b82f6", "#f97316"];
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

const ExcursionCheckIn = () => {
  const navigate = useNavigate();
  const [excursion, setExcursion] = useState<TodaysExcursion | null>(null);
  const [excursionLoaded, setExcursionLoaded] = useState(false);
  const [search, setSearch] = useState("");
  const [youth, setYouth] = useState<Youth[]>([]);
  const [loading, setLoading] = useState(false);
  const [checkedIn, setCheckedIn] = useState<string | null>(null);
  const [checkedInName, setCheckedInName] = useState<string>("");
  const [alreadyIn, setAlreadyIn] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const [todayCount, setTodayCount] = useState(0);
  const [counterPulse, setCounterPulse] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  // Pull today's Excursion from the calendar
  useEffect(() => {
    const loadExcursion = async () => {
      const { data, error: rpcError } = await supabase.rpc("get_todays_excursion");
      if (rpcError) {
        console.error("Failed to load today's Excursion:", rpcError);
        setExcursionLoaded(true);
        return;
      }
      const row = (data as TodaysExcursion[] | null)?.[0] ?? null;
      setExcursion(row);
      setExcursionLoaded(true);
    };
    loadExcursion();
  }, []);

  // Live count of check-ins for this Excursion
  const fetchCount = useCallback(async () => {
    if (!excursion?.id) return;
    const { data } = await supabase.rpc("get_excursion_checkin_count", {
      _excursion_id: excursion.id,
    });
    if (typeof data === "number") setTodayCount(data);
  }, [excursion?.id]);

  useEffect(() => {
    fetchCount();
    const handleVisibility = () => {
      if (document.visibilityState === "visible") fetchCount();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [fetchCount]);

  // Auto-focus search on mount and after celebration
  useEffect(() => {
    if (excursion) searchRef.current?.focus();
  }, [showCelebration, excursion]);

  // Debounced search
  useEffect(() => {
    if (search.length < 2) {
      setYouth([]);
      return;
    }
    const timeout = setTimeout(async () => {
      setLoading(true);
      const { data, error: rpcError } = await supabase.rpc("search_excursion_youth", {
        _search: search,
      });
      if (rpcError) {
        console.error("Excursion search failed:", rpcError);
        setYouth([]);
      } else {
        setYouth((data as Youth[]) || []);
      }
      setLoading(false);
    }, 300);
    return () => clearTimeout(timeout);
  }, [search]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && youth.length === 1 && !checkedIn && !alreadyIn) {
      handleCheckIn(youth[0]);
    }
  };

  const handleCheckIn = async (y: Youth) => {
    if (!excursion) return;
    setError(null);
    setCheckedIn(null);
    setAlreadyIn(null);
    setShowCelebration(false);
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
    const { error: insertError } = await supabase.from("attendance_records").insert({
      registration_id: y.id,
      check_in_date: today,
      program_source: "Excursion",
      excursion_id: excursion.id,
    });

    if (insertError) {
      if (insertError.message.includes("duplicate") || insertError.code === "23505") {
        setAlreadyIn(y.id);
        setTimeout(() => setAlreadyIn(null), 3000);
      } else {
        setError("Something went wrong. Please try again.");
      }
      return;
    }

    setTodayCount((c) => c + 1);
    setCounterPulse(true);
    setTimeout(() => setCounterPulse(false), 1000);

    setCheckedIn(y.id);
    setCheckedInName(`${y.child_first_name} ${y.child_last_name}`);
    setShowCelebration(true);
    setTimeout(() => {
      setCheckedIn(null);
      setShowCelebration(false);
      setSearch("");
      setYouth([]);
    }, 3000);
  };

  const hasResults = youth.length > 0;
  const showEmpty = !loading && search.length >= 2 && youth.length === 0;
  const isIdle = !hasResults && !showEmpty;

  // No Excursion scheduled — coach needs to mark the calendar first
  if (excursionLoaded && !excursion) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center px-6 relative">
        <Button
          variant="ghost"
          size="sm"
          className="absolute top-4 left-4 text-white/40 hover:text-white hover:bg-white/10 z-10"
          onClick={() => navigate("/")}
        >
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Button>
        <CalendarX className="w-24 h-24 text-purple-400/50 mb-6" />
        <h1 className="text-3xl md:text-4xl font-black text-white text-center mb-3">No Excursion Scheduled Today</h1>
        <p className="text-white/50 text-center max-w-lg text-base md:text-lg">
          To use this kiosk, a coach must first mark today as an Excursion in
          <span className="text-purple-300 font-semibold"> Admin → Operations → Attendance</span>.
        </p>
        <p className="text-white/30 text-sm mt-4 text-center">
          {new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "America/New_York" })}
        </p>
      </div>
    );
  }

  // Roster locked — kiosk no longer accepts self check-ins.
  // Late arrivals must be added by Coach Chrissy via Coach Mode.
  if (excursion?.roster_locked_at) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center px-6 relative">
        <Button
          variant="ghost"
          size="sm"
          className="absolute top-4 left-4 text-white/40 hover:text-white hover:bg-white/10 z-10"
          onClick={() => navigate("/")}
        >
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Button>
        <Button
          size="sm"
          className="absolute top-4 right-4 z-10 bg-purple-600/80 hover:bg-purple-500 text-white font-semibold border border-purple-400/40 shadow-lg shadow-purple-900/30"
          onClick={() => navigate("/excursion-coach")}
        >
          <ClipboardCheck className="w-4 h-4 mr-1.5" /> Coach Mode
        </Button>
        <Lock className="w-24 h-24 text-purple-400/60 mb-6" />
        <h1 className="text-3xl md:text-4xl font-black text-white text-center mb-3">Excursion Roster Submitted</h1>
        <p className="text-white/60 text-center max-w-lg text-base md:text-lg mb-2">
          Today's <span className="text-purple-300 font-semibold">{excursion.name}</span> roster has been finalized.
        </p>
        <p className="text-white/50 text-center max-w-lg text-base">
          Late arrival? Find <span className="text-white font-semibold">Coach Chrissy</span> to be added to the trip.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* Celebration Overlay */}
      {showCelebration && (
        <>
          <Confetti />
          <div className="fixed inset-0 bg-black/85 z-40 flex items-center justify-center animate-in fade-in duration-200">
            <div className="text-center animate-in zoom-in duration-500 px-6">
              <CheckCircle2 className="w-32 h-32 md:w-40 md:h-40 text-purple-400 mx-auto mb-6 animate-bounce" />
              <h2 className="text-6xl md:text-8xl font-black text-purple-400 mb-3 tracking-tight">
                READY FOR THE TRIP!
              </h2>
              <p className="text-3xl md:text-5xl text-white/90 font-bold mb-4">{checkedInName}</p>
              <p className="text-xl md:text-2xl text-white/60 italic">"The Lord directs our steps"</p>
              <p className="text-base text-white/40 mt-2">— Proverbs 16:9</p>
            </div>
          </div>
        </>
      )}

      <Button
        variant="ghost"
        size="sm"
        className="absolute top-4 left-4 text-white/40 hover:text-white hover:bg-white/10 z-10"
        onClick={() => navigate("/")}
      >
        <ArrowLeft className="w-4 h-4 mr-1" /> Back
      </Button>

      {excursion && (
        <Button
          size="sm"
          className="absolute top-4 right-4 z-10 bg-purple-600/80 hover:bg-purple-500 text-white font-semibold border border-purple-400/40 shadow-lg shadow-purple-900/30"
          onClick={() => navigate("/excursion-coach")}
        >
          <ClipboardCheck className="w-4 h-4 mr-1.5" /> Coach Mode
        </Button>
      )}

      <div className={`flex-1 flex flex-col items-center px-4 md:px-8 transition-all duration-500 ${
        isIdle ? "justify-center" : "justify-start pt-8 md:pt-12"
      }`}>
        <img
          src={nlaLogo}
          alt="No Limits Academy"
          className={`mx-auto transition-all duration-500 ${
            isIdle ? "h-28 md:h-40 mb-6 md:mb-8" : "h-16 md:h-20 mb-4"
          }`}
        />

        {excursion && (
          <div className={`flex items-center gap-2.5 rounded-full border border-purple-400/30 bg-purple-500/10 px-5 py-2 mb-4 ${
            isIdle ? "" : "scale-90"
          }`}>
            <MapPin className="w-4 h-4 text-purple-300" />
            <span className="text-purple-200 text-sm md:text-base font-semibold">
              Today's Excursion: {excursion.name}
            </span>
          </div>
        )}

        <h1 className={`font-black tracking-tight text-center transition-all duration-500 ${
          isIdle ? "text-4xl md:text-6xl mb-2" : "text-2xl md:text-3xl mb-1"
        }`}>
          Excursion Check-In
        </h1>
        <p className={`text-white/50 text-center transition-all duration-500 ${
          isIdle ? "text-lg md:text-xl mb-4" : "text-sm md:text-base mb-3"
        }`}>
          Search your name and tap to check in for the trip
        </p>

        <div className={`flex items-center gap-2.5 rounded-full border border-white/10 bg-white/[0.04] px-5 py-2 mb-6 transition-all duration-300 ${
          counterPulse ? "scale-110 border-purple-500/50 bg-purple-500/10" : ""
        }`}>
          <Users className={`w-5 h-5 transition-colors ${counterPulse ? "text-purple-300" : "text-white/40"}`} />
          <span className="text-white/50 text-sm md:text-base font-medium">Checked in for this Excursion:</span>
          <span className={`font-black text-xl md:text-2xl tabular-nums transition-colors ${
            counterPulse ? "text-purple-300" : "text-white"
          }`}>
            {todayCount}
          </span>
        </div>

        <div className="w-full max-w-2xl">
          <div className="relative mb-6">
            <Search className={`absolute left-4 md:left-5 top-1/2 -translate-y-1/2 text-white/40 transition-all duration-500 ${
              isIdle ? "w-7 h-7 md:w-8 md:h-8" : "w-6 h-6"
            }`} />
            <Input
              ref={searchRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your name to check in"
              className={`pl-12 md:pl-14 bg-white/5 border-2 border-white/20 text-white placeholder:text-white/30 focus:border-purple-500/60 rounded-2xl transition-all duration-500 ${
                isIdle ? "text-2xl md:text-3xl h-18 md:h-22" : "text-xl md:text-2xl h-16 md:h-18"
              }`}
              autoFocus
            />
          </div>

          {error && <p className="text-red-400 text-center mb-4 text-lg">{error}</p>}

          <div className="space-y-4">
            {loading && <p className="text-center text-white/40 text-lg py-8">Searching...</p>}
            {showEmpty && (
              <div className="text-center py-8 px-4">
                <p className="text-white/50 text-lg">No match found</p>
                <p className="text-white/60 text-sm mt-3 max-w-md mx-auto leading-relaxed">
                  Double-check the spelling. If you haven't <strong className="text-white/80">registered for this program year</strong> yet,
                  please see a coach — you may just need to re-register to check in.
                </p>
              </div>
            )}
            {youth.map((y, index) => (
              <Card
                key={y.id}
                className={`bg-white/[0.04] border-2 border-white/10 text-white transition-all duration-300 hover:bg-white/[0.07] animate-in slide-in-from-bottom-4 fade-in ${
                  checkedIn === y.id ? "border-purple-500 bg-purple-500/10" : ""
                } ${alreadyIn === y.id ? "border-yellow-500 bg-yellow-500/10" : ""}`}
                style={{ animationDelay: `${index * 80}ms`, animationFillMode: "both" }}
              >
                <CardContent className="flex items-center gap-5 md:gap-6 p-5 md:p-6">
                  <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-white/10 flex items-center justify-center overflow-hidden flex-shrink-0 ring-2 ring-white/10">
                    {getHeadshotUrl(y.child_headshot_url) ? (
                      <img src={getHeadshotUrl(y.child_headshot_url)!} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-2xl md:text-3xl font-bold text-white/50">{y.child_first_name[0]}</span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-xl md:text-2xl leading-tight">
                      {y.child_first_name} {y.child_last_name}
                    </p>
                    <p className="text-base md:text-lg text-white/50 mt-0.5">{y.child_boxing_program}</p>
                  </div>

                  <div className="flex items-center flex-shrink-0">
                    {checkedIn === y.id && (
                      <div className="flex flex-col items-center text-purple-300 animate-in fade-in zoom-in duration-300">
                        <CheckCircle2 className="w-10 h-10 md:w-12 md:h-12 mb-1" />
                        <span className="font-bold text-base md:text-lg">CHECKED IN!</span>
                      </div>
                    )}
                    {alreadyIn === y.id && (
                      <span className="text-yellow-400 text-sm md:text-base font-semibold text-center">
                        Already checked in<br />for the Excursion ✓
                      </span>
                    )}
                    {!checkedIn && !alreadyIn && (
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCheckIn(y);
                        }}
                        className="bg-purple-600 hover:bg-purple-500 text-white font-bold text-lg md:text-xl px-6 md:px-8 py-5 md:py-6 rounded-xl shadow-lg shadow-purple-900/30 transition-all active:scale-95"
                      >
                        SIGN IN
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExcursionCheckIn;
