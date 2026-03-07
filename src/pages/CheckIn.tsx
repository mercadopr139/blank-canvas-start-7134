import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Search, CheckCircle2, ArrowLeft } from "lucide-react";
import nlaLogo from "@/assets/nla-logo-white.png";

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
        .or(`child_first_name.ilike.%${search}%,child_last_name.ilike.%${search}%`)
        .order("child_last_name")
        .limit(20);
      setYouth(data || []);
      setLoading(false);
    }, 300);
    return () => clearTimeout(timeout);
  }, [search]);

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
              className={`bg-white/5 border-white/10 text-white cursor-pointer hover:bg-white/10 transition-all ${
                checkedIn === y.id ? "border-green-500 bg-green-500/10" : ""
              } ${alreadyIn === y.id ? "border-yellow-500 bg-yellow-500/10" : ""}`}
              onClick={() => !checkedIn && handleCheckIn(y)}
            >
              <CardContent className="flex items-center gap-4 p-4">
                <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center overflow-hidden flex-shrink-0">
                  {y.child_headshot_url ? (
                    <img src={y.child_headshot_url} alt="" className="w-full h-full object-cover" />
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
                {checkedIn === y.id && (
                  <div className="flex items-center gap-2 text-green-400">
                    <CheckCircle2 className="w-6 h-6" />
                    <span className="font-medium">Checked In!</span>
                  </div>
                )}
                {alreadyIn === y.id && (
                  <span className="text-yellow-400 text-sm font-medium">Already checked in today</span>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CheckIn;
