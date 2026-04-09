import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Search, UserPlus, ArrowLeft, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface YouthProfile {
  id: string;
  first_name: string;
  last_name: string;
  photo_url: string | null;
  pickup_zone: string;
}

interface DriverAddYouthSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  routeName: string;
  onYouthAdded: (youth: YouthProfile) => void;
}

export default function DriverAddYouthSheet({ open, onOpenChange, routeName, onYouthAdded }: DriverAddYouthSheetProps) {
  const [step, setStep] = useState<"search" | "form">("search");
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<YouthProfile[]>([]);
  const [searching, setSearching] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  const resolveZone = (): string => {
    if (routeName === "Woodbine" || routeName === "Wildwood") return routeName;
    return "Woodbine"; // default for Both/Overflow
  };

  const reset = () => {
    setStep("search");
    setSearchQuery("");
    setResults([]);
    setFirstName("");
    setLastName("");
    setPhotoFile(null);
  };

  const handleOpenChange = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    clearTimeout(debounceRef.current);
    if (query.trim().length < 2) { setResults([]); return; }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`${supabaseUrl}/functions/v1/get-run-youth`, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: anonKey, Authorization: `Bearer ${anonKey}` },
          body: JSON.stringify({ route_name: "Both" }),
        });
        if (res.ok) {
          const data = await res.json();
          const q = query.trim().toLowerCase();
          const filtered = (data.youth || []).filter((y: YouthProfile) =>
            y.first_name.toLowerCase().includes(q) || y.last_name.toLowerCase().includes(q)
          );
          setResults(filtered.slice(0, 10));
        }
      } catch { /* ignore */ }
      setSearching(false);
    }, 300);
  };

  const selectExisting = (y: YouthProfile) => {
    onYouthAdded(y);
    toast({ title: `${y.first_name} ${y.last_name} added` });
    handleOpenChange(false);
  };

  const handleSaveNew = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      toast({ title: "First and last name required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      let photo_url: string | null = null;

      if (photoFile) {
        const { createClient } = await import("@supabase/supabase-js");
        const supabase = createClient(supabaseUrl, anonKey);
        const ext = photoFile.name.split(".").pop();
        const path = `transport/${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage.from("youth-photos").upload(path, photoFile, { upsert: true });
        if (!uploadError) {
          const { data: urlData } = supabase.storage.from("youth-photos").getPublicUrl(path);
          photo_url = urlData.publicUrl;
        }
      }

      const zone = resolveZone();

      // Use edge function to insert (anon can't insert directly due to RLS)
      const res = await fetch(`${supabaseUrl}/functions/v1/add-transport-youth`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: anonKey, Authorization: `Bearer ${anonKey}` },
        body: JSON.stringify({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          pickup_zone: zone,
          photo_url,
        }),
      });

      if (!res.ok) throw new Error("Failed to save");
      const data = await res.json();

      const newYouth: YouthProfile = {
        id: data.id,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        photo_url,
        pickup_zone: zone,
      };

      onYouthAdded(newYouth);
      toast({ title: `${newYouth.first_name} ${newYouth.last_name} added` });
      handleOpenChange(false);
    } catch {
      toast({ title: "Failed to save youth", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="bg-[#111827] border-white/10 text-white max-w-sm max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {step === "search" ? "+ Add Youth" : (
              <button onClick={() => setStep("search")} className="flex items-center gap-2 hover:text-white/70 transition-colors">
                <ArrowLeft className="w-4 h-4" /> New Youth
              </button>
            )}
          </DialogTitle>
        </DialogHeader>

        {step === "search" ? (
          <div className="space-y-3 mt-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <Input
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Search by name..."
                className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-white/30"
                autoFocus
              />
            </div>

            {searching && <p className="text-white/40 text-sm text-center py-2">Searching...</p>}

            {results.length > 0 && (
              <ul className="space-y-1 max-h-52 overflow-y-auto">
                {results.map((r) => (
                  <li
                    key={r.id}
                    onClick={() => selectExisting(r)}
                    className="flex items-center gap-3 p-2.5 rounded-lg bg-white/5 hover:bg-white/10 cursor-pointer transition-colors"
                  >
                    <div className="w-8 h-8 rounded-full bg-white/10 overflow-hidden shrink-0 flex items-center justify-center">
                      {r.photo_url ? (
                        <img src={r.photo_url.startsWith("http") ? r.photo_url : `${supabaseUrl}/storage/v1/object/public/registration-signatures/${r.photo_url}`} alt="" className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                      ) : (
                        <span className="text-white/30 text-xs font-bold">{r.first_name[0]}{r.last_name[0]}</span>
                      )}
                    </div>
                    <p className="text-white text-sm font-medium truncate">{r.first_name} {r.last_name}</p>
                  </li>
                ))}
              </ul>
            )}

            {searchQuery.trim().length >= 2 && !searching && results.length === 0 && (
              <p className="text-white/40 text-sm text-center py-2">No youth found.</p>
            )}

            <Button
              variant="outline"
              onClick={() => setStep("form")}
              className="w-full border-white/10 text-white/70 hover:text-white hover:bg-white/5 gap-2"
            >
              <UserPlus className="w-4 h-4" /> Add New Youth
            </Button>
          </div>
        ) : (
          <div className="space-y-4 mt-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-white/70 text-xs">First Name *</Label>
                <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} className="bg-white/5 border-white/10 text-white" autoFocus />
              </div>
              <div className="space-y-1.5">
                <Label className="text-white/70 text-xs">Last Name *</Label>
                <Input value={lastName} onChange={(e) => setLastName(e.target.value)} className="bg-white/5 border-white/10 text-white" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-white/70 text-xs">Photo (optional)</Label>
              <label className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 cursor-pointer hover:bg-white/10 transition-colors">
                <Upload className="w-4 h-4 text-white/40" />
                <span className="text-white/50 text-sm truncate">{photoFile ? photoFile.name : "Choose photo..."}</span>
                <input type="file" accept="image/*" className="hidden" onChange={(e) => setPhotoFile(e.target.files?.[0] || null)} />
              </label>
            </div>

            <p className="text-white/40 text-xs">Zone: <strong className="text-white/60">{resolveZone()}</strong></p>

            <Button onClick={handleSaveNew} disabled={saving} className="w-full bg-[#3B82F6] hover:bg-[#2563EB] text-white">
              {saving ? "Saving..." : "Add Youth"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
