import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Search, CheckCircle2 } from "lucide-react";
import nlaLogo from "@/assets/nla-logo-white.png";
import PhotoUploadModal from "@/components/admin/PhotoUploadModal";
import CoachPasswordModal from "@/components/checkin/CoachPasswordModal";

const getHeadshotUrl = (url: string | null): string | null => {
  if (!url) return null;
  if (url.startsWith("http")) return url;
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  if (url.startsWith("youth-photos/")) {
    return `${supabaseUrl}/storage/v1/object/public/youth-photos/${url}`;
  }
  return `${supabaseUrl}/storage/v1/object/public/registration-signatures/${url}`;
};

interface Youth {
  id: string;
  child_first_name: string;
  child_last_name: string;
  child_boxing_program: string;
  child_headshot_url: string | null;
}

const Confetti = () => {
  const colors = ['#22c55e', '#facc15', '#ef4444', '#3b82f6', '#a855f7', '#f97316'];
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
            top: '-20px',
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            borderRadius: Math.random() > 0.5 ? '50%' : '2px',
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
          }}
        />
      ))}
    </div>
  );
};

const CheckIn = () => {
  const [search, setSearch] = useState("");
  const [youth, setYouth] = useState<Youth[]>([]);
  const [loading, setLoading] = useState(false);
  const [checkedIn, setCheckedIn] = useState<string | null>(null);
  const [checkedInName, setCheckedInName] = useState<string>("");
  const [alreadyIn, setAlreadyIn] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [photoModalOpen, setPhotoModalOpen] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [selectedYouth, setSelectedYouth] = useState<Youth | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  // Auto-focus search on mount and after celebration
  useEffect(() => {
    searchRef.current?.focus();
  }, [showCelebration]);

  useEffect(() => {
    if (search.length < 2) {
      setYouth([]);
      return;
    }
    const timeout = setTimeout(async () => {
      setLoading(true);
      const { data } = await supabase
        .from("youth_registrations")
        .select("id, child_first_name, child_last_name, child_boxing_program, child_headshot_url")
        .eq("approved_for_attendance", true)
        .or(`child_first_name.ilike.%${search}%,child_last_name.ilike.%${search}%`)
        .order("child_last_name")
        .limit(20);
      setYouth(data || []);
      setLoading(false);
    }, 300);
    return () => clearTimeout(timeout);
  }, [search]);

  useEffect(() => {
    const channel = supabase
      .channel("youth_photos")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "youth_registrations" },
        (payload) => {
          const updated = payload.new as Youth;
          setYouth((prev) =>
            prev.map((y) => (y.id === updated.id ? { ...y, child_headshot_url: updated.child_headshot_url } : y))
          );
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  // ENTER to check in if only one result
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && youth.length === 1 && !checkedIn && !alreadyIn) {
      handleCheckIn(youth[0]);
    }
  };

  const handleCheckIn = async (y: Youth) => {
    setError(null);
    setCheckedIn(null);
    setAlreadyIn(null);
    setShowCelebration(false);
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
    const { error: insertError } = await supabase
      .from("attendance_records")
      .insert({ registration_id: y.id, check_in_date: today });

    if (insertError) {
      if (insertError.message.includes("duplicate") || insertError.code === "23505") {
        setAlreadyIn(y.id);
        setTimeout(() => setAlreadyIn(null), 3000);
      } else {
        setError("Something went wrong. Please try again.");
      }
      return;
    }
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

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* Celebration Overlay */}
      {showCelebration && (
        <>
          <Confetti />
          <div className="fixed inset-0 bg-black/85 z-40 flex items-center justify-center animate-in fade-in duration-200">
            <div className="text-center animate-in zoom-in duration-500 px-6">
              <CheckCircle2 className="w-32 h-32 md:w-40 md:h-40 text-green-400 mx-auto mb-6 animate-bounce" />
              <h2 className="text-6xl md:text-8xl font-black text-green-400 mb-3 tracking-tight">
                YOU'RE IN!
              </h2>
              <p className="text-3xl md:text-5xl text-white/90 font-bold mb-4">
                {checkedInName}
              </p>
              <p className="text-xl md:text-2xl text-white/60 italic">
                "Iron sharpens iron"
              </p>
              <p className="text-base text-white/40 mt-2">
                — Proverbs 27:17
              </p>
            </div>
          </div>
        </>
      )}

      {/* Main kiosk layout - centers when no results */}
      <div className={`flex-1 flex flex-col items-center px-4 md:px-8 transition-all duration-500 ${
        hasResults || showEmpty ? "justify-start pt-8 md:pt-12" : "justify-center"
      }`}>
        {/* Logo */}
        <img
          src={nlaLogo}
          alt="No Limits Academy"
          className={`mx-auto mb-4 transition-all duration-500 ${
            hasResults || showEmpty ? "h-16 md:h-20" : "h-28 md:h-40"
          }`}
        />

        {/* Title */}
        <h1 className={`font-black tracking-tight text-center transition-all duration-500 ${
          hasResults || showEmpty ? "text-2xl md:text-3xl mb-1" : "text-4xl md:text-6xl mb-2"
        }`}>
          Attendance Check-In
        </h1>
        <p className={`text-white/50 text-center mb-6 transition-all duration-500 ${
          hasResults || showEmpty ? "text-sm md:text-base" : "text-lg md:text-xl"
        }`}>
          Search your name and tap to check in
        </p>

        {/* Search bar */}
        <div className={`w-full transition-all duration-500 ${
          hasResults || showEmpty ? "max-w-2xl" : "max-w-2xl"
        }`}>
          <div className="relative mb-6">
            <Search className={`absolute left-4 md:left-5 top-1/2 -translate-y-1/2 text-white/40 transition-all duration-500 ${
              hasResults || showEmpty ? "w-6 h-6" : "w-7 h-7 md:w-8 md:h-8"
            }`} />
            <Input
              ref={searchRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your name to check in"
              className={`pl-12 md:pl-14 bg-white/5 border-2 border-white/20 text-white placeholder:text-white/30 focus:border-green-500/60 rounded-2xl transition-all duration-500 ${
                hasResults || showEmpty
                  ? "text-xl md:text-2xl h-16 md:h-18"
                  : "text-2xl md:text-3xl h-18 md:h-22"
              }`}
              autoFocus
            />
          </div>

          {error && <p className="text-red-400 text-center mb-4 text-lg">{error}</p>}

          {/* Results */}
          <div className="space-y-4">
            {loading && (
              <p className="text-center text-white/40 text-lg py-8">Searching...</p>
            )}
            {showEmpty && (
              <p className="text-center text-white/40 text-lg py-8">No students found</p>
            )}
            {youth.map((y, index) => (
              <Card
                key={y.id}
                className={`bg-white/[0.04] border-2 border-white/10 text-white transition-all duration-300 hover:bg-white/[0.07] animate-in slide-in-from-bottom-4 fade-in ${
                  checkedIn === y.id ? "border-green-500 bg-green-500/10" : ""
                } ${alreadyIn === y.id ? "border-yellow-500 bg-yellow-500/10" : ""}`}
                style={{ animationDelay: `${index * 80}ms`, animationFillMode: 'both' }}
              >
                <CardContent className="flex items-center gap-5 md:gap-6 p-5 md:p-6">
                  {/* Large avatar */}
                  <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-white/10 flex items-center justify-center overflow-hidden flex-shrink-0 ring-2 ring-white/10">
                    {getHeadshotUrl(y.child_headshot_url) ? (
                      <img src={getHeadshotUrl(y.child_headshot_url)!} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-2xl md:text-3xl font-bold text-white/50">
                        {y.child_first_name[0]}
                      </span>
                    )}
                  </div>

                  {/* Name & program */}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-xl md:text-2xl leading-tight">
                      {y.child_first_name} {y.child_last_name}
                    </p>
                    <p className="text-base md:text-lg text-white/50 mt-0.5">
                      {y.child_boxing_program}
                    </p>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedYouth(y);
                        setPasswordModalOpen(true);
                      }}
                      className="text-xs text-blue-400/60 hover:text-blue-300 mt-1 underline underline-offset-2 transition-colors"
                    >
                      Change Profile Pic
                    </button>
                  </div>

                  {/* Action area */}
                  <div className="flex items-center flex-shrink-0">
                    {checkedIn === y.id && (
                      <div className="flex flex-col items-center text-green-400 animate-in fade-in zoom-in duration-300">
                        <CheckCircle2 className="w-10 h-10 md:w-12 md:h-12 mb-1" />
                        <span className="font-bold text-base md:text-lg">CHECKED IN!</span>
                      </div>
                    )}
                    {alreadyIn === y.id && (
                      <span className="text-yellow-400 text-sm md:text-base font-semibold text-center">
                        Already checked<br />in today ✓
                      </span>
                    )}
                    {!checkedIn && !alreadyIn && (
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCheckIn(y);
                        }}
                        className="bg-green-600 hover:bg-green-500 text-white font-bold text-lg md:text-xl px-6 md:px-8 py-5 md:py-6 rounded-xl shadow-lg shadow-green-900/30 transition-all active:scale-95"
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

      {selectedYouth && (
        <CoachPasswordModal
          open={passwordModalOpen}
          onClose={() => {
            setPasswordModalOpen(false);
            setSelectedYouth(null);
          }}
          onSuccess={() => {
            setPasswordModalOpen(false);
            setPhotoModalOpen(true);
          }}
          registrationId={selectedYouth.id}
        />
      )}

      {selectedYouth && (
        <PhotoUploadModal
          open={photoModalOpen}
          onClose={() => {
            setPhotoModalOpen(false);
            setSelectedYouth(null);
          }}
          registrationId={selectedYouth.id}
          currentPhotoUrl={selectedYouth.child_headshot_url}
          onPhotoUpdated={(newUrl) => {
            setYouth((prev) =>
              prev.map((y) => (y.id === selectedYouth.id ? { ...y, child_headshot_url: newUrl } : y))
            );
          }}
          youthName={`${selectedYouth.child_first_name} ${selectedYouth.child_last_name}`}
        />
      )}
    </div>
  );
};

export default CheckIn;
