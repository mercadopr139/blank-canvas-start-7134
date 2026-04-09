import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { CheckCircle2, X, Search } from "lucide-react";
import { format } from "date-fns";

interface YouthMatch {
  id: string;
  child_first_name: string;
  child_last_name: string;
  child_headshot_url: string | null;
  is_bald_eagle: boolean;
}

const CallOut = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<YouthMatch[]>([]);
  const [selectedYouth, setSelectedYouth] = useState<YouthMatch | null>(null);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const today = format(new Date(), "yyyy-MM-dd");
  const todayDisplay = format(new Date(), "EEEE, MMMM d, yyyy");

  // Search youth registrations with debounce
  useEffect(() => {
    if (selectedYouth) return;
    if (searchQuery.trim().length < 2) {
      setResults([]);
      setShowDropdown(false);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      const { data } = await supabase.rpc("search_kiosk_youth", { _search: searchQuery.trim() });
      const mapped = ((data as any[]) || []).map((r: any) => ({
        id: r.id,
        child_first_name: r.child_first_name,
        child_last_name: r.child_last_name,
        child_headshot_url: r.child_headshot_url || null,
        is_bald_eagle: false, // We'll check separately
      }));

      // Check bald eagle status for results
      if (mapped.length > 0) {
        const { data: regData } = await supabase
          .from("youth_registrations")
          .select("id, is_bald_eagle")
          .in("id", mapped.map((m) => m.id));
        const eagleMap = new Map((regData || []).map((r) => [r.id, r.is_bald_eagle]));
        mapped.forEach((m) => { m.is_bald_eagle = eagleMap.get(m.id) || false; });
      }

      setResults(mapped);
      setShowDropdown(mapped.length > 0 || searchQuery.trim().length >= 2);
      setSearching(false);
    }, 300);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchQuery, selectedYouth]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelect = (youth: YouthMatch) => {
    setSelectedYouth(youth);
    setSearchQuery("");
    setShowDropdown(false);
    setResults([]);
  };

  const handleClear = () => {
    setSelectedYouth(null);
    setSearchQuery("");
    setResults([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedYouth || !reason.trim()) return;
    setSubmitting(true);

    try {
      await supabase.from("callouts" as any).insert({
        first_name: selectedYouth.child_first_name,
        last_name: selectedYouth.child_last_name,
        date: today,
        reason: reason.trim(),
        is_bald_eagle: selectedYouth.is_bald_eagle,
      } as any);
      setSubmitted(true);
    } catch {
      setSubmitted(true);
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex flex-col bg-black">
        <Header />
        <main className="flex-1 flex items-center justify-center px-4">
          <div className="max-w-md w-full text-center">
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-8">
              <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-white mb-3">Call-Out Recorded</h2>
              <p className="text-lg font-semibold text-white mb-2">
                100% Attendance is not Required,
              </p>
              <p className="text-lg font-semibold text-white mb-6">
                100% Communication is Required!
              </p>
              <Button
                onClick={() => {
                  setSubmitted(false);
                  setSelectedYouth(null);
                  setSearchQuery("");
                  setReason("");
                }}
                className="text-white font-bold"
                style={{ backgroundColor: "#bf0f3e" }}
              >
                Submit Another
              </Button>
            </div>
          </div>
        </main>
        <Footer className="bg-neutral-950 border-neutral-800" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-black">
      <Header />
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="max-w-lg w-full">
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 md:p-8">
            <h1 className="text-2xl md:text-3xl font-black text-white text-center mb-2">
              CALL-OUT FORM
            </h1>
            <p className="text-center text-white font-semibold mb-1">
              100% Attendance is not Required,
            </p>
            <p className="text-center text-white font-semibold mb-6">
              100% Communication is Required!
            </p>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Youth Search */}
              <div>
                <Label className="text-white text-sm">Search your name *</Label>
                {selectedYouth ? (
                  <div className="mt-1 flex items-center gap-3 bg-neutral-800 border border-green-500/30 rounded-md px-3 py-2.5">
                    {selectedYouth.child_headshot_url ? (
                      <img src={selectedYouth.child_headshot_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-neutral-700 flex items-center justify-center text-white text-xs font-bold">
                        {selectedYouth.child_first_name[0]}{selectedYouth.child_last_name[0]}
                      </div>
                    )}
                    <span className="text-white font-medium text-sm flex-1">
                      Submitting as: <span className="text-green-400">{selectedYouth.child_first_name} {selectedYouth.child_last_name}</span>
                    </span>
                    <button type="button" onClick={handleClear} className="text-neutral-400 hover:text-white">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="relative mt-1" ref={dropdownRef}>
                    <Search className="absolute left-3 top-2.5 w-4 h-4 text-neutral-500" />
                    <Input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Type your first or last name..."
                      className="pl-9 bg-neutral-800 border-neutral-700 text-white"
                      autoFocus
                    />
                    {showDropdown && (
                      <div className="absolute z-50 w-full mt-1 bg-neutral-800 border border-neutral-700 rounded-md shadow-xl max-h-[240px] overflow-y-auto">
                        {results.length > 0 ? (
                          results.map((r) => (
                            <button
                              key={r.id}
                              type="button"
                              onClick={() => handleSelect(r)}
                              className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-neutral-700 transition-colors text-left"
                            >
                              {r.child_headshot_url ? (
                                <img src={r.child_headshot_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-neutral-600 flex items-center justify-center text-white text-xs font-bold">
                                  {r.child_first_name[0]}{r.child_last_name[0]}
                                </div>
                              )}
                              <span className="text-white text-sm font-medium">
                                {r.child_first_name} {r.child_last_name}
                              </span>
                            </button>
                          ))
                        ) : !searching ? (
                          <div className="px-3 py-4 text-center">
                            <p className="text-neutral-400 text-sm">Name not found.</p>
                            <p className="text-neutral-500 text-xs mt-1">Please see a coach to get registered.</p>
                          </div>
                        ) : null}
                        {searching && (
                          <div className="px-3 py-3 text-center text-neutral-500 text-sm">Searching...</div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div>
                <Label className="text-white text-sm">Today's Date</Label>
                <Input
                  value={todayDisplay}
                  readOnly
                  className="bg-neutral-800/50 border-neutral-700 text-neutral-400 mt-1 cursor-not-allowed"
                />
              </div>

              <div>
                <Label className="text-white text-sm">Reason for Missing Practice *</Label>
                <Textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Why will you miss practice today?"
                  required
                  className="bg-neutral-800 border-neutral-700 text-white mt-1 min-h-[100px]"
                />
                <div className="mt-3 space-y-2 text-xs">
                  <p className="text-green-400 font-medium">
                    ✅ Acceptable: School event, doctor appointment, family event or emergency, illness
                  </p>
                  <p className="text-red-400 font-medium">
                    ❌ Unacceptable: "I don't feel like it", no reason given, repeated vague excuses
                  </p>
                </div>
              </div>

              <Button
                type="submit"
                disabled={submitting || !selectedYouth || !reason.trim()}
                className="w-full text-white font-bold text-lg py-6"
                style={{ backgroundColor: "#bf0f3e" }}
              >
                {submitting ? "Submitting..." : "SUBMIT CALL-OUT"}
              </Button>
            </form>
          </div>
        </div>
      </main>
      <Footer className="bg-neutral-950 border-neutral-800" />
    </div>
  );
};

export default CallOut;
