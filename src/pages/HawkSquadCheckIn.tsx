// Hawk Squad check-in — the kiosk at /check-in/hawk-squad.
//
// A screen with no login, on the same device as the NLA kiosk. Same shape as
// the Smile Lab kiosk the kids already know: type your name, tap SIGN IN, a
// big green YOU'RE IN. Everything it reads comes through narrow functions that
// return only approved, current-year Hawk Squad students and today's roster;
// the check-in itself is an insert-only policy on hawk_squad_attendance. It
// cannot read a registration, and it never touches an NLA table.
import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Search, CheckCircle2, Users, ArrowLeft, Eye, X, Undo2 } from "lucide-react";
import nlaLogo from "@/assets/nla-logo-white.png";
import { hawkPhotoUrl, hawkTodayET } from "@/lib/hawkSquad";

const GREEN = "#22c55e";

interface Student {
  id: string;
  child_first_name: string;
  child_last_name: string;
  child_date_of_birth: string | null;
  child_headshot_url: string | null;
}

const rpc = (name: string, args?: Record<string, unknown>) =>
  (supabase.rpc as unknown as (n: string, a?: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>)(name, args);

const HawkSquadCheckIn = () => {
  const navigate = useNavigate();
  const goBack = () => { if (window.history.length > 1) navigate(-1); else navigate("/"); };

  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Student[]>([]);
  const [loading, setLoading] = useState(false);
  const [checkedIn, setCheckedIn] = useState<string | null>(null);
  const [checkedInName, setCheckedInName] = useState("");
  const [alreadyIn, setAlreadyIn] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [celebrate, setCelebrate] = useState(false);
  const [todayIds, setTodayIds] = useState<Set<string>>(new Set());
  const [pulse, setPulse] = useState(false);
  const [showRoster, setShowRoster] = useState(false);
  const [roster, setRoster] = useState<Student[]>([]);
  const searchRef = useRef<HTMLInputElement>(null);

  // Who is in today. Polled rather than pushed: the kiosk is the only thing
  // writing during a session, and a 30-second catch-up covers a coach's
  // manual add from the office.
  const fetchToday = useCallback(async () => {
    const { data } = await rpc("hawk_squad_today_roster");
    const rows = (data as Array<{ registration_id: string }> | null) ?? [];
    setTodayIds(new Set(rows.map((r) => r.registration_id)));
  }, []);
  useEffect(() => {
    fetchToday();
    const id = window.setInterval(fetchToday, 30_000);
    return () => window.clearInterval(id);
  }, [fetchToday]);

  useEffect(() => { searchRef.current?.focus(); }, [celebrate]);

  useEffect(() => {
    if (search.trim().length < 2) { setResults([]); return; }
    const t = setTimeout(async () => {
      setLoading(true);
      const { data, error } = await rpc("search_hawk_squad_youth", { _search: search.trim() });
      setResults(error ? [] : ((data as Student[]) ?? []));
      setLoading(false);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const signIn = async (s: Student) => {
    setError(null);
    setCheckedIn(null);
    setAlreadyIn(null);
    const { error: insertError } = await (supabase.from("hawk_squad_attendance" as never) as never as {
      insert: (v: unknown) => Promise<{ error: { code?: string; message: string } | null }>;
    }).insert({ registration_id: s.id, check_in_date: hawkTodayET() });

    if (insertError) {
      if (insertError.code === "23505" || /duplicate/i.test(insertError.message)) {
        setAlreadyIn(s.id);
        setTimeout(() => setAlreadyIn(null), 3000);
      } else {
        setError("Something went wrong. Please try again or see a coach.");
      }
      return;
    }
    setTodayIds((prev) => new Set(prev).add(s.id));
    setPulse(true);
    setTimeout(() => setPulse(false), 1000);
    setCheckedIn(s.id);
    setCheckedInName(`${s.child_first_name} ${s.child_last_name}`);
    setCelebrate(true);
    setTimeout(() => {
      setCheckedIn(null);
      setCelebrate(false);
      setSearch("");
      setResults([]);
    }, 2500);
  };

  const undo = async (s: Student) => {
    const { error } = await rpc("hawk_squad_kiosk_undo", { _registration_id: s.id });
    if (error) return;
    setTodayIds((prev) => { const n = new Set(prev); n.delete(s.id); return n; });
  };

  const openRoster = async () => {
    const { data } = await rpc("hawk_squad_kiosk_roster");
    setRoster(((data as Student[]) ?? []));
    setShowRoster(true);
  };

  const age = (dob: string | null) => {
    if (!dob) return null;
    const b = new Date(`${dob}T12:00:00`); const n = new Date();
    let a = n.getFullYear() - b.getFullYear();
    if (n.getMonth() < b.getMonth() || (n.getMonth() === b.getMonth() && n.getDate() < b.getDate())) a--;
    return a;
  };

  const hasResults = results.length > 0;
  const showEmpty = !loading && search.trim().length >= 2 && !hasResults;
  const idle = !hasResults && !showEmpty;

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {celebrate && (
        <div className="fixed inset-0 bg-black/85 z-40 flex items-center justify-center animate-in fade-in duration-200">
          <div className="text-center animate-in zoom-in duration-500 px-6">
            <CheckCircle2 className="w-32 h-32 md:w-40 md:h-40 mx-auto mb-6 animate-bounce" style={{ color: GREEN }} />
            <h2 className="text-6xl md:text-8xl font-black mb-3 tracking-tight" style={{ color: GREEN }}>YOU'RE IN!</h2>
            <p className="text-3xl md:text-5xl text-white/90 font-bold">{checkedInName}</p>
            <p className="text-lg md:text-xl text-white/50 mt-4">Hawk Squad · {new Date().toLocaleDateString("en-US", { weekday: "long", timeZone: "America/New_York" })}</p>
          </div>
        </div>
      )}

      <Button variant="ghost" size="sm" className="absolute top-4 left-4 text-white/40 hover:text-white hover:bg-white/10 z-10" onClick={goBack}>
        <ArrowLeft className="w-4 h-4 mr-1" /> Back
      </Button>

      <div className={`flex-1 flex flex-col items-center px-4 md:px-8 transition-all duration-500 ${idle ? "justify-center" : "justify-start pt-8 md:pt-12"}`}>
        <img src={nlaLogo} alt="No Limits Academy" className={`mx-auto transition-all duration-500 ${idle ? "h-24 md:h-32 mb-6" : "h-14 md:h-18 mb-4"}`} />

        <h1 className={`font-black tracking-tight text-center transition-all duration-500 ${idle ? "text-3xl md:text-5xl mb-1" : "text-2xl md:text-3xl mb-1"}`}>
          <span style={{ color: GREEN }}>Hawk Squad</span> Check-In
        </h1>
        <p className={`text-center text-white/45 font-semibold transition-all duration-500 ${idle ? "text-lg md:text-xl mb-4" : "text-sm md:text-base mb-3"}`}>
          Cape May Tech · No Limits Academy
        </p>

        <div className={`flex items-center gap-2.5 rounded-full border px-5 py-2 mb-6 transition-all duration-300 ${pulse ? "scale-110" : ""}`}
          style={{ borderColor: `${GREEN}${pulse ? "80" : "33"}`, backgroundColor: `${GREEN}${pulse ? "1a" : "0f"}` }}>
          <Users className="w-5 h-5" style={{ color: pulse ? GREEN : "rgba(255,255,255,0.4)" }} />
          <span className="text-white/50 text-sm md:text-base font-medium">Here today:</span>
          <span className="font-black text-xl md:text-2xl tabular-nums" style={{ color: pulse ? GREEN : "#fff" }}>{todayIds.size}</span>
        </div>

        {idle && (
          <Button onClick={openRoster}
            className="mb-6 text-white font-bold text-base sm:text-lg px-6 py-4 rounded-xl shadow-lg transition-all active:scale-95"
            style={{ backgroundColor: "#15803d" }}>
            <Eye className="w-5 h-5 mr-2" /> Browse by Photo
          </Button>
        )}

        <div className="w-full max-w-2xl">
          <div className="relative mb-6">
            <Search className={`absolute left-4 md:left-5 top-1/2 -translate-y-1/2 text-white/40 transition-all duration-500 ${idle ? "w-7 h-7 md:w-8 md:h-8" : "w-6 h-6"}`} />
            <Input
              ref={searchRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && results.length === 1 && !checkedIn && !alreadyIn) signIn(results[0]); }}
              placeholder="Type your name to check in"
              className={`pl-12 md:pl-14 bg-white/5 border-2 text-white placeholder:text-white/30 rounded-2xl transition-all duration-500 ${idle ? "text-2xl md:text-3xl h-18 md:h-22" : "text-xl md:text-2xl h-16 md:h-18"}`}
              style={{ borderColor: `${GREEN}33` }}
              autoFocus
            />
          </div>

          {error && <p className="text-red-400 text-center mb-4 text-lg">{error}</p>}

          <div className="space-y-4">
            {loading && <p className="text-center text-white/40 text-lg py-8">Searching…</p>}
            {showEmpty && (
              <div className="text-center py-8 px-4">
                <p className="text-white/50 text-lg">No match found</p>
                <p className="text-white/60 text-sm mt-3 max-w-md mx-auto leading-relaxed">
                  Double-check the spelling. If you haven't <strong className="text-white/80">registered for Hawk Squad this year</strong>,
                  or your registration hasn't been approved yet, please see a coach.
                </p>
              </div>
            )}
            {results.map((s, i) => {
              const inToday = todayIds.has(s.id);
              return (
                <Card key={s.id}
                  className={`bg-white/[0.04] border-2 border-white/10 text-white transition-all duration-300 hover:bg-white/[0.07] animate-in slide-in-from-bottom-4 fade-in ${checkedIn === s.id ? "bg-green-500/10" : ""} ${alreadyIn === s.id ? "border-orange-500 bg-orange-500/10" : ""}`}
                  style={{ animationDelay: `${i * 80}ms`, animationFillMode: "both", ...(checkedIn === s.id ? { borderColor: GREEN } : {}) }}>
                  <CardContent className="flex items-center gap-5 md:gap-6 p-5 md:p-6">
                    <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-white/10 flex items-center justify-center overflow-hidden flex-shrink-0 ring-2" style={{ boxShadow: `0 0 0 2px ${GREEN}33` }}>
                      {hawkPhotoUrl(s.child_headshot_url)
                        ? <img src={hawkPhotoUrl(s.child_headshot_url)!} alt="" className="w-full h-full object-cover" />
                        : <span className="text-2xl md:text-3xl font-bold text-white/50">{s.child_first_name[0]}</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-xl md:text-2xl leading-tight">{s.child_first_name} {s.child_last_name}</p>
                      {age(s.child_date_of_birth) != null && <p className="text-base md:text-lg text-white/50 mt-0.5">Age: {age(s.child_date_of_birth)}</p>}
                    </div>
                    <div className="flex items-center flex-shrink-0">
                      {checkedIn === s.id && (
                        <div className="flex flex-col items-center animate-in fade-in zoom-in duration-300" style={{ color: GREEN }}>
                          <CheckCircle2 className="w-10 h-10 md:w-12 md:h-12 mb-1" />
                          <span className="font-bold text-base md:text-lg">CHECKED IN!</span>
                        </div>
                      )}
                      {alreadyIn === s.id && (
                        <span className="text-orange-400 text-sm md:text-base font-semibold text-center">Already checked in<br />today ✓</span>
                      )}
                      {!checkedIn && !alreadyIn && (inToday ? (
                        <span className="text-white/45 text-sm md:text-base font-semibold text-center flex items-center gap-1.5"><CheckCircle2 className="w-5 h-5" style={{ color: GREEN }} /> Here today</span>
                      ) : (
                        <Button
                          onClick={(e) => { e.stopPropagation(); signIn(s); }}
                          onTouchEnd={(e) => { e.preventDefault(); e.stopPropagation(); signIn(s); }}
                          style={{ touchAction: "manipulation", WebkitTapHighlightColor: "transparent", backgroundColor: GREEN }}
                          className="hover:opacity-90 text-black font-bold text-lg md:text-xl px-6 md:px-8 py-5 md:py-6 rounded-xl shadow-lg transition-all active:scale-95">
                          SIGN IN
                        </Button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </div>

      {/* Browse by photo: every approved student, tap to sign in, tap again to undo a mistake. */}
      {showRoster && (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
            <div>
              <h2 className="text-xl md:text-2xl font-black">Tap your photo to sign in</h2>
              <p className="text-white/45 text-sm">{todayIds.size} here today</p>
            </div>
            <Button variant="ghost" onClick={() => setShowRoster(false)} className="text-white/60 hover:text-white hover:bg-white/10 h-11 px-4">
              <X className="w-5 h-5 mr-1.5" /> Done
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {roster.length === 0 ? (
              <p className="text-center text-white/40 py-20">No approved students yet.</p>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
                {roster.map((s) => {
                  const inToday = todayIds.has(s.id);
                  return (
                    <button key={s.id}
                      onClick={() => (inToday ? undo(s) : signIn(s))}
                      className={`rounded-xl border-2 p-2 text-center transition-all active:scale-95 ${inToday ? "bg-green-500/10" : "border-white/10 bg-white/[0.03] hover:bg-white/[0.07]"}`}
                      style={inToday ? { borderColor: GREEN } : undefined}>
                      <div className="aspect-square rounded-lg overflow-hidden bg-white/10 mb-1.5 relative">
                        {hawkPhotoUrl(s.child_headshot_url)
                          ? <img src={hawkPhotoUrl(s.child_headshot_url)!} alt="" className="w-full h-full object-cover" />
                          : <span className="w-full h-full flex items-center justify-center text-3xl font-bold text-white/40">{s.child_first_name[0]}</span>}
                        {inToday && (
                          <span className="absolute inset-0 flex items-center justify-center bg-black/40">
                            <CheckCircle2 className="w-10 h-10" style={{ color: GREEN }} />
                          </span>
                        )}
                      </div>
                      <p className="text-xs md:text-sm font-semibold leading-tight truncate">{s.child_first_name}</p>
                      <p className="text-[11px] text-white/45 truncate">{s.child_last_name}</p>
                      {inToday && <p className="text-[10px] text-white/40 mt-0.5 flex items-center justify-center gap-1"><Undo2 className="w-3 h-3" /> tap to undo</p>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default HawkSquadCheckIn;
