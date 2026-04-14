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

interface RegistrationResult {
  id: string;
  child_first_name: string;
  child_last_name: string;
  child_headshot_url: string | null;
  child_primary_address: string | null;
  child_date_of_birth: string | null;
  parent_first_name: string;
  parent_last_name: string;
  parent_phone: string;
}

type SearchResult =
  | { source: "profile"; data: YouthProfile }
  | { source: "registration"; data: RegistrationResult };

interface DriverAddYouthSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  routeName: string;
  onYouthAdded: (youth: YouthProfile) => void;
  currentRosterIds?: Set<string>;
}

export default function DriverAddYouthSheet({ open, onOpenChange, routeName, onYouthAdded, currentRosterIds }: DriverAddYouthSheetProps) {
  const [step, setStep] = useState<"search" | "form">("search");
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
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
    return "Woodbine";
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

  const getPhotoUrl = (url: string | null) => {
    if (!url) return null;
    if (url.startsWith("http")) return url;
    return `${supabaseUrl}/storage/v1/object/public/registration-signatures/${url}`;
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    clearTimeout(debounceRef.current);
    if (query.trim().length < 2) { setResults([]); return; }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`${supabaseUrl}/functions/v1/search-transport-youth`, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: anonKey, Authorization: `Bearer ${anonKey}` },
          body: JSON.stringify({ query: query.trim() }),
        });
        if (res.ok) {
          const data = await res.json();
          const combined: SearchResult[] = [
            ...(data.profiles || []).map((p: YouthProfile) => ({ source: "profile" as const, data: p })),
            ...(data.registrations || []).map((r: RegistrationResult) => ({ source: "registration" as const, data: r })),
          ];
          setResults(combined.slice(0, 15));
        }
      } catch { /* ignore */ }
      setSearching(false);
    }, 300);
  };

  const selectProfile = (y: YouthProfile) => {
    onYouthAdded(y);
    toast({ title: `${y.first_name} ${y.last_name} added` });
    handleOpenChange(false);
  };

  const selectRegistration = async (r: RegistrationResult) => {
    setSaving(true);
    try {
      const zone = resolveZone();
      const res = await fetch(`${supabaseUrl}/functions/v1/add-transport-youth`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: anonKey, Authorization: `Bearer ${anonKey}` },
        body: JSON.stringify({
          first_name: r.child_first_name,
          last_name: r.child_last_name,
          pickup_zone: zone,
          photo_url: r.child_headshot_url || null,
          address: r.child_primary_address || null,
          emergency_contact_name: `${r.parent_first_name} ${r.parent_last_name}`.trim(),
          emergency_contact_phone: r.parent_phone || null,
          date_of_birth: r.child_date_of_birth || null,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      const newYouth: YouthProfile = {
        id: data.id,
        first_name: r.child_first_name,
        last_name: r.child_last_name,
        photo_url: r.child_headshot_url,
        pickup_zone: zone,
      };
      onYouthAdded(newYouth);
      toast({ title: `${newYouth.first_name} ${newYouth.last_name} added from registration` });
      handleOpenChange(false);
    } catch {
      toast({ title: "Failed to add youth", variant: "destructive" });
    } finally {
      setSaving(false);
    }
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
      const res = await fetch(`${supabaseUrl}/functions/v1/add-transport-youth`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: anonKey, Authorization: `Bearer ${anonKey}` },
        body: JSON.stringify({ first_name: firstName.trim(), last_name: lastName.trim(), pickup_zone: zone, photo_url }),
      });
      if (!res.ok) throw new Error("Failed to save");
      const data = await res.json();
      const newYouth: YouthProfile = { id: data.id, first_name: firstName.trim(), last_name: lastName.trim(), photo_url, pickup_zone: zone };
      onYouthAdded(newYouth);
      toast({ title: `${newYouth.first_name} ${newYouth.last_name} added` });
      handleOpenChange(false);
    } catch {
      toast({ title: "Failed to save youth", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const getResultName = (r: SearchResult) =>
    r.source === "profile" ? `${r.data.first_name} ${r.data.last_name}` : `${(r.data as RegistrationResult).child_first_name} ${(r.data as RegistrationResult).child_last_name}`;

  const getResultInitials = (r: SearchResult) =>
    r.source === "profile" ? `${r.data.first_name[0]}${r.data.last_name[0]}` : `${(r.data as RegistrationResult).child_first_name[0]}${(r.data as RegistrationResult).child_last_name[0]}`;

  const getResultPhoto = (r: SearchResult) =>
    r.source === "profile" ? getPhotoUrl((r.data as YouthProfile).photo_url) : getPhotoUrl((r.data as RegistrationResult).child_headshot_url);

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
                {results.map((r, idx) => {
                  const name = getResultName(r);
                  const photo = getResultPhoto(r);
                  const initials = getResultInitials(r);
                  const isReg = r.source === "registration";

                  return (
                    <li
                      key={`${r.source}-${r.data.id}-${idx}`}
                      onClick={() => {
                        if (r.source === "profile") selectProfile(r.data as YouthProfile);
                        else selectRegistration(r.data as RegistrationResult);
                      }}
                      className="flex items-center gap-3 p-2.5 rounded-lg bg-white/5 hover:bg-white/10 cursor-pointer transition-colors"
                    >
                      <div className="w-8 h-8 rounded-full bg-white/10 overflow-hidden shrink-0 flex items-center justify-center">
                        {photo ? (
                          <img src={photo} alt="" className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                        ) : (
                          <span className="text-white/30 text-xs font-bold">{initials}</span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-white text-sm font-medium truncate">{name}</p>
                        {isReg && (
                          <p className="text-white/30 text-[10px]">From registration</p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            {searchQuery.trim().length >= 2 && !searching && results.length === 0 && (
              <p className="text-white/40 text-sm text-center py-2">No youth found.</p>
            )}

            <Button
              onClick={() => setStep("form")}
              className="w-full border border-white/20 bg-white/5 text-white/70 hover:text-white hover:bg-white/10 gap-2"
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
