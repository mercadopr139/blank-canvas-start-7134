import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Search, CheckCircle2, Users, ArrowLeft, Eye } from "lucide-react";
import nlaLogo from "@/assets/nla-logo-white.png";
import LilChampsRoster from "@/components/checkin/LilChampsRoster";

const getHeadshotUrl = (url: string | null): string | null => {
  if (!url) return null;
  const bustParam = `?v=${Date.now()}`;
  if (url.startsWith("http")) return url + bustParam;
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  if (url.startsWith("youth-photos/")) {
    return `${supabaseUrl}/storage/v1/object/public/youth-photos/${url}${bustParam}`;
  }
  return `${supabaseUrl}/storage/v1/object/public/registration-signatures/${url}${bustParam}`;
};

interface LilChampsYouth {
  id: string;
  child_first_name: string;
  child_last_name: string;
  child_date_of_birth: string;
  child_headshot_url: string | null;
}

const calculateAge = (dob: string): number => {
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || m === 0 && today.getDate() < birth.getDate()) age--;
  return age;
};

const Confetti = () => {
  const colors = ['#facc15', '#f97316', '#ef4444', '#22c55e', '#3b82f6', '#a855f7'];
  const particles = Array.from({ length: 60 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 0.5,
    duration: 1 + Math.random() * 2,
    color: colors[Math.floor(Math.random() * colors.length)],
    size: 10 + Math.random() * 10
  }));

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-50">
      {particles.map((p) =>
      <div
        key={p.id}
        className="absolute animate-confetti"
        style={{
          left: `${p.left}%`,
          top: '-20px',
          width: p.size,
          height: p.size,
          backgroundColor: p.color,
          borderRadius: Math.random() > 0.5 ? '50%' : '2px',
          animationDelay: `${p.delay}s`,
          animationDuration: `${p.duration}s`
        }} />

      )}
    </div>);

};

const LilChampsCheckIn = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [youth, setYouth] = useState<LilChampsYouth[]>([]);
  const [loading, setLoading] = useState(false);
  const [checkedIn, setCheckedIn] = useState<string | null>(null);
  const [checkedInName, setCheckedInName] = useState("");
  const [alreadyIn, setAlreadyIn] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const [todayCount, setTodayCount] = useState(0);
  const [counterPulse, setCounterPulse] = useState(false);
  const [showRoster, setShowRoster] = useState(false);
  const [checkedInIds, setCheckedInIds] = useState<Set<string>>(new Set());
  const searchRef = useRef<HTMLInputElement>(null);

  const fetchCount = useCallback(async () => {
    const { data } = await supabase.rpc("get_today_lil_champs_count");
    if (typeof data === "number") setTodayCount(data);
  }, []);

  useEffect(() => {fetchCount();}, [fetchCount]);

  useEffect(() => {
    const channel = supabase.
    channel("lil_champs_counter").
    on("postgres_changes", { event: "INSERT", schema: "public", table: "attendance_records" }, () => fetchCount()).
    subscribe();
    return () => {supabase.removeChannel(channel);};
  }, [fetchCount]);

  useEffect(() => {searchRef.current?.focus();}, [showCelebration]);

  useEffect(() => {
    if (search.length < 2) {setYouth([]);return;}
    const timeout = setTimeout(async () => {
      setLoading(true);
      const { data, error } = await supabase.rpc("search_lil_champs_youth", { _search: search });
      if (error) {
        console.error("Lil Champs search failed:", error);
        setYouth([]);
      } else {
        setYouth(data as LilChampsYouth[] || []);
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

  const handleCheckIn = async (y: LilChampsYouth) => {
    setError(null);
    setCheckedIn(null);
    setAlreadyIn(null);
    setShowCelebration(false);
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
    const { error: insertError } = await supabase.
    from("attendance_records").
    insert({ registration_id: y.id, check_in_date: today, program_source: "Lil Champs Corner" });

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

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {showCelebration &&
      <>
          <Confetti />
          <div className="fixed inset-0 bg-black/85 z-40 flex items-center justify-center animate-in fade-in duration-200">
            <div className="text-center animate-in zoom-in duration-500 px-6">
              <CheckCircle2 className="w-32 h-32 md:w-40 md:h-40 text-yellow-400 mx-auto mb-6 animate-bounce" />
              <h2 className="text-6xl md:text-8xl font-black text-yellow-400 mb-3 tracking-tight">
                YOU'RE IN!
              </h2>
              <p className="text-3xl md:text-5xl text-white/90 font-bold mb-4">
                {checkedInName}
              </p>
              <p className="text-xl md:text-2xl text-white/60 italic">
                "Train up a child in the way he should go"
              </p>
              <p className="text-base text-white/40 mt-2">
                — Proverbs 22:6
              </p>
            </div>
          </div>
        </>
      }

      {/* Back button */}
      <Button
        variant="ghost"
        size="sm"
        className="absolute top-4 left-4 text-white/40 hover:text-white hover:bg-white/10 z-10"
        onClick={() => navigate(-1)}>
        
        <ArrowLeft className="w-4 h-4 mr-1" />
        Back
      </Button>

      <div className={`flex-1 flex flex-col items-center px-4 md:px-8 transition-all duration-500 ${
      isIdle ? "justify-center" : "justify-start pt-8 md:pt-12"}`
      }>
        <img
          src={nlaLogo}
          alt="No Limits Academy"
          className={`mx-auto transition-all duration-500 ${
          isIdle ? "h-24 md:h-32 mb-6 md:mb-8" : "h-14 md:h-18 mb-4 md:mb-5"}`
          } />
        

        <h1 className={`font-black tracking-tight text-center transition-all duration-500 ${
        isIdle ? "text-3xl md:text-5xl mb-1" : "text-2xl md:text-3xl mb-1"}`
        }>
          <span style={{ color: '#38bdf8' }}>Lil' Champs Corner</span> Check-In
        </h1>
        <p className={`text-white/50 text-center transition-all duration-500 ${
        isIdle ? "text-lg md:text-xl mb-4" : "text-sm md:text-base mb-3"}`
        }>
          Search your name and tap to check in
        </p>

        <div className={`flex items-center gap-2.5 rounded-full border border-yellow-500/20 bg-yellow-500/[0.06] px-5 py-2 mb-6 transition-all duration-300 ${
        counterPulse ? "scale-110 border-yellow-500/50 bg-yellow-500/10" : ""}`
        }>
          <Users className={`w-5 h-5 transition-colors ${counterPulse ? "text-yellow-400" : "text-white/40"}`} />
          <span className="text-white/50 text-sm md:text-base font-medium">Today's Check-Ins:</span>
          <span className={`font-black text-xl md:text-2xl tabular-nums transition-colors ${
          counterPulse ? "text-yellow-400" : "text-white"}`
          }>
            {todayCount}
          </span>
        </div>

        <div className="w-full max-w-2xl">
          <div className="relative mb-6">
            <Search className={`absolute left-4 md:left-5 top-1/2 -translate-y-1/2 text-white/40 transition-all duration-500 ${
            isIdle ? "w-7 h-7 md:w-8 md:h-8" : "w-6 h-6"}`
            } />
            <Input
              ref={searchRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your name to check in"
              className={`pl-12 md:pl-14 bg-white/5 border-2 border-yellow-500/20 text-white placeholder:text-white/30 focus:border-yellow-500/60 rounded-2xl transition-all duration-500 ${
              isIdle ?
              "text-2xl md:text-3xl h-18 md:h-22" :
              "text-xl md:text-2xl h-16 md:h-18"}`
              }
              autoFocus />
            
          </div>

          {error && <p className="text-red-400 text-center mb-4 text-lg">{error}</p>}

          <div className="space-y-4">
            {loading && <p className="text-center text-white/40 text-lg py-8">Searching...</p>}
            {showEmpty && <p className="text-center text-white/40 text-lg py-8">No students found</p>}
            {youth.map((y, index) =>
            <Card
              key={y.id}
              className={`bg-white/[0.04] border-2 border-white/10 text-white transition-all duration-300 hover:bg-white/[0.07] animate-in slide-in-from-bottom-4 fade-in ${
              checkedIn === y.id ? "border-yellow-500 bg-yellow-500/10" : ""} ${
              alreadyIn === y.id ? "border-orange-500 bg-orange-500/10" : ""}`}
              style={{ animationDelay: `${index * 80}ms`, animationFillMode: 'both' }}>
              
                <CardContent className="flex items-center gap-5 md:gap-6 p-5 md:p-6">
                  <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-white/10 flex items-center justify-center overflow-hidden flex-shrink-0 ring-2 ring-yellow-500/20">
                    {getHeadshotUrl(y.child_headshot_url) ?
                  <img src={getHeadshotUrl(y.child_headshot_url)!} alt="" className="w-full h-full object-cover" /> :

                  <span className="text-2xl md:text-3xl font-bold text-white/50">
                        {y.child_first_name[0]}
                      </span>
                  }
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-xl md:text-2xl leading-tight">
                      {y.child_first_name} {y.child_last_name}
                    </p>
                    <p className="text-base md:text-lg text-white/50 mt-0.5">
                      Age: {calculateAge(y.child_date_of_birth)}
                    </p>
                  </div>

                  <div className="flex items-center flex-shrink-0">
                    {checkedIn === y.id &&
                  <div className="flex flex-col items-center text-yellow-400 animate-in fade-in zoom-in duration-300">
                        <CheckCircle2 className="w-10 h-10 md:w-12 md:h-12 mb-1" />
                        <span className="font-bold text-base md:text-lg">CHECKED IN!</span>
                      </div>
                  }
                    {alreadyIn === y.id &&
                  <span className="text-orange-400 text-sm md:text-base font-semibold text-center">
                        Already checked in for<br />Lil' Champs Corner today ✓
                      </span>
                  }
                    {!checkedIn && !alreadyIn &&
                  <Button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCheckIn(y);
                    }}
                    className="bg-yellow-600 hover:bg-yellow-500 text-black font-bold text-lg md:text-xl px-6 md:px-8 py-5 md:py-6 rounded-xl shadow-lg shadow-yellow-900/30 transition-all active:scale-95">
                    
                        SIGN IN
                      </Button>
                  }
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>);

};

export default LilChampsCheckIn;