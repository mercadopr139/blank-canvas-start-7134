import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Search, CheckCircle2, Camera } from "lucide-react";
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

const CheckIn = () => {
  const [search, setSearch] = useState("");
  const [youth, setYouth] = useState<Youth[]>([]);
  const [loading, setLoading] = useState(false);
  const [checkedIn, setCheckedIn] = useState<string | null>(null);
  const [alreadyIn, setAlreadyIn] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [photoModalOpen, setPhotoModalOpen] = useState(false);
  const [selectedYouth, setSelectedYouth] = useState<Youth | null>(null);

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
    setTimeout(() => {
      setCheckedIn(null);
      setSearch("");
      setYouth([]);
    }, 2500);
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
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
                <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center overflow-hidden flex-shrink-0">
                  {getHeadshotUrl(y.child_headshot_url) ? (
                    <img src={getHeadshotUrl(y.child_headshot_url)!} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-lg font-bold text-white/50">
                      {y.child_first_name[0]}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => !checkedIn && handleCheckIn(y)}>
                  <p className="font-semibold text-lg">
                    {y.child_first_name} {y.child_last_name}
                  </p>
                  <p className="text-sm text-white/50">{y.child_boxing_program}</p>
                </div>
                <div className="flex items-center gap-2">
                  {checkedIn === y.id && (
                    <div className="flex items-center gap-2 text-green-400">
                      <CheckCircle2 className="w-6 h-6" />
                      <span className="font-medium">Checked In!</span>
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
                        setSelectedYouth(y);
                        setPhotoModalOpen(true);
                      }}
                      className="gap-2 bg-white/5 hover:bg-white/10 border-white/20 text-white"
                    >
                      <Camera className="w-4 h-4" />
                      Update Photo
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
