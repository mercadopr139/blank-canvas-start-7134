import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Search, CheckCircle2 } from "lucide-react";
import nlaLogo from "@/assets/nla-logo-white.png";
import PhotoUploadModal from "@/components/admin/PhotoUploadModal";

const getHeadshotUrl = (url: string | null): string | null => {
  if (!url) return null;
  if (url.startsWith("http")) return url;
  // It's a storage path — resolve to public URL
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  // Check which bucket the path belongs to
  if (url.startsWith("youth-photos/")) {
    return `${supabaseUrl}/storage/v1/object/public/youth-photos/${url}`;
  }
  // Default: registration-signatures bucket (used by import-youth-photo edge function)
  return `${supabaseUrl}/storage/v1/object/public/registration-signatures/${url}`;
};

interface Youth {
  id: string;
  child_first_name: string;
  child_last_name: string;
  child_boxing_program: string;
  child_headshot_url: string | null;
}

// Confetti particle component
const Confetti = () => {
  const colors = ['#22c55e', '#facc15', '#ef4444', '#3b82f6', '#a855f7', '#f97316'];
  const particles = Array.from({ length: 50 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 0.5,
    duration: 1 + Math.random() * 2,
    color: colors[Math.floor(Math.random() * colors.length)],
    size: 8 + Math.random() * 8,
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
  const [selectedYouth, setSelectedYouth] = useState<Youth | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);

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

  // Realtime subscription for photo updates
  useEffect(() => {
    const channel = supabase
      .channel("youth_photos")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "youth_registrations",
        },
        (payload) => {
          const updated = payload.new as Youth;
          setYouth((prev) =>
            prev.map((y) => (y.id === updated.id ? { ...y, child_headshot_url: updated.child_headshot_url } : y))
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleCheckIn = async (y: Youth) => {
    setError(null);
    setCheckedIn(null);
    setAlreadyIn(null);
    setShowCelebration(false);
    const today = new Date().toISOString().split("T")[0];
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
    }, 3500);
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* Celebration Overlay */}
      {showCelebration && (
        <>
          <Confetti />
          <div className="fixed inset-0 bg-black/80 z-40 flex items-center justify-center animate-in fade-in duration-200">
            <div className="text-center animate-in zoom-in duration-500">
              <CheckCircle2 className="w-24 h-24 text-green-400 mx-auto mb-4 animate-bounce" />
              <h2 className="text-5xl md:text-6xl font-black text-green-400 mb-2 tracking-tight">
                CHECKED-IN!
              </h2>
              <p className="text-2xl md:text-3xl text-white/80 font-medium mb-2">
                {checkedInName}
              </p>
              <p className="text-xl text-white/60 italic">
                "Iron sharpens iron"
              </p>
              <p className="text-sm text-white/40 mt-1">
                — Proverbs 27:17
              </p>
            </div>
          </div>
        </>
      )}

      {/* Header */}
      <header className="py-6 text-center border-b border-white/10">
        <img src={nlaLogo} alt="No Limits Academy" className="h-20 mx-auto mb-2" />
        <h1 className="text-2xl font-bold tracking-tight">Attendance Check-In</h1>
        <p className="text-white/50 text-sm mt-1">Search your name and tap to check in</p>
      </header>

      {/* Search */}
      <div className="flex-1 container mx-auto px-4 py-8 max-w-lg">
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Type your name..."
            className="pl-10 bg-white/5 border-white/20 text-white placeholder:text-white/30 text-lg h-14"
            autoFocus
          />
        </div>

        {error && <p className="text-red-400 text-center mb-4">{error}</p>}

        <div className="space-y-3">
          {loading && <p className="text-center text-white/40">Searching...</p>}
          {!loading && search.length >= 2 && youth.length === 0 && (
            <p className="text-center text-white/40">No students found</p>
          )}
          {youth.map((y) => (
            <Card
              key={y.id}
              className={`bg-white/5 border-white/10 text-white transition-all ${
                checkedIn === y.id ? "border-green-500 bg-green-500/10" : ""
              } ${alreadyIn === y.id ? "border-yellow-500 bg-yellow-500/10" : ""}`}
            >
              <CardContent className="flex items-center gap-4 p-4">
                <div 
                  className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center overflow-hidden flex-shrink-0 cursor-pointer hover:ring-2 hover:ring-white/30 transition-all"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedYouth(y);
                    setPhotoModalOpen(true);
                  }}
                  title="Update photo"
                >
                  {getHeadshotUrl(y.child_headshot_url) ? (
                    <img src={getHeadshotUrl(y.child_headshot_url)!} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-lg font-bold text-white/50">
                      {y.child_first_name[0]}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-lg">
                    {y.child_first_name} {y.child_last_name}
                  </p>
                  <p className="text-sm text-white/50">{y.child_boxing_program}</p>
                </div>
                <div className="flex items-center gap-2">
                  {checkedIn === y.id && (
                    <div className="flex flex-col items-center text-green-400 animate-in fade-in zoom-in duration-300">
                      <CheckCircle2 className="w-8 h-8 mb-1" />
                      <span className="font-bold text-lg">CHECKED-IN!</span>
                      <span className="text-xs text-white/60 italic">"Iron sharpens iron"</span>
                    </div>
                  )}
                  {alreadyIn === y.id && (
                    <span className="text-yellow-400 text-sm font-medium">Already checked in today</span>
                  )}
                  {!checkedIn && !alreadyIn && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCheckIn(y);
                      }}
                      className="bg-black border-green-500 text-green-400 hover:bg-green-500/10 hover:text-green-300 font-semibold px-4"
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
