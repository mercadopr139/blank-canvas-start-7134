import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Search, Upload, UserPlus, ArrowLeft } from "lucide-react";

interface RegistrationResult {
  id: string;
  child_first_name: string;
  child_last_name: string;
  child_headshot_url: string | null;
  child_primary_address: string;
}

interface AddYouthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

const emptyForm = {
  first_name: "",
  last_name: "",
  address: "",
  pickup_zone: "Woodbine" as string,
  emergency_contact_name: "",
  emergency_contact_phone: "",
  notes: "",
  status: "active",
};

export default function AddYouthDialog({ open, onOpenChange, onSaved }: AddYouthDialogProps) {
  const [step, setStep] = useState<"search" | "form">("search");
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<RegistrationResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [prefillPhotoUrl, setPrefillPhotoUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setStep("search");
      setSearchQuery("");
      setResults([]);
      setForm(emptyForm);
      setPhotoFile(null);
      setPrefillPhotoUrl(null);
    }
  }, [open]);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    clearTimeout(debounceRef.current);
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      const { data } = await supabase
        .from("youth_registrations")
        .select("id, child_first_name, child_last_name, child_headshot_url, child_primary_address")
        .or(`child_first_name.ilike.%${query.trim()}%,child_last_name.ilike.%${query.trim()}%`)
        .order("child_last_name")
        .limit(10);
      setResults(data || []);
      setSearching(false);
    }, 300);
  };

  const selectRegistration = (r: RegistrationResult) => {
    setForm({
      ...emptyForm,
      first_name: r.child_first_name,
      last_name: r.child_last_name,
      address: r.child_primary_address || "",
    });
    setPrefillPhotoUrl(r.child_headshot_url);
    setStep("form");
  };

  const startManualEntry = () => {
    setForm(emptyForm);
    setPrefillPhotoUrl(null);
    setStep("form");
  };

  const handleSave = async () => {
    if (!form.first_name.trim() || !form.last_name.trim()) {
      toast({ title: "First and last name are required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      let photo_url: string | null = prefillPhotoUrl || null;

      if (photoFile) {
        const ext = photoFile.name.split(".").pop();
        const path = `transport/${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("youth-photos")
          .upload(path, photoFile, { upsert: true });
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from("youth-photos").getPublicUrl(path);
        photo_url = urlData.publicUrl;
      }

      const record = {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        address: form.address.trim() || null,
        pickup_zone: form.pickup_zone as "Woodbine" | "Wildwood",
        emergency_contact_name: form.emergency_contact_name.trim() || null,
        emergency_contact_phone: form.emergency_contact_phone.trim() || null,
        notes: form.notes.trim() || null,
        status: form.status as "active" | "inactive",
        photo_url,
      };

      const { error } = await supabase.from("youth_profiles").insert(record);
      if (error) throw error;
      toast({ title: "Profile added" });
      onOpenChange(false);
      onSaved();
    } catch {
      toast({ title: "Failed to save profile", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#111827] border-white/10 text-white max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {step === "search" ? "Add Youth Profile" : (
              <button onClick={() => setStep("search")} className="flex items-center gap-2 hover:text-white/70 transition-colors">
                <ArrowLeft className="w-4 h-4" /> Complete Profile
              </button>
            )}
          </DialogTitle>
        </DialogHeader>

        {step === "search" ? (
          <div className="space-y-4 mt-2">
            <p className="text-white/50 text-sm">Search existing registrations to auto-fill, or add manually.</p>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <Input
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Type a name to search registrations..."
                className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-white/30"
                autoFocus
              />
            </div>

            {searching && <p className="text-white/40 text-sm text-center py-2">Searching...</p>}

            {results.length > 0 && (
              <ul className="space-y-1 max-h-60 overflow-y-auto">
                {results.map((r) => (
                  <li
                    key={r.id}
                    onClick={() => selectRegistration(r)}
                    className="flex items-center gap-3 p-3 rounded-lg bg-white/5 hover:bg-white/10 cursor-pointer transition-colors"
                  >
                    <div className="w-9 h-9 rounded-full bg-white/10 overflow-hidden shrink-0 flex items-center justify-center">
                      {r.child_headshot_url ? (
                        <img src={r.child_headshot_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-white/30 text-xs font-bold">
                          {r.child_first_name[0]}{r.child_last_name[0]}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-white font-medium text-sm truncate">{r.child_first_name} {r.child_last_name}</p>
                      {r.child_primary_address && (
                        <p className="text-white/40 text-xs truncate">{r.child_primary_address}</p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {searchQuery.trim().length >= 2 && !searching && results.length === 0 && (
              <p className="text-white/40 text-sm text-center py-2">No registrations found.</p>
            )}

            <Button
              variant="outline"
              onClick={startManualEntry}
              className="w-full border-white/10 text-white/70 hover:text-white hover:bg-white/5 gap-2"
            >
              <UserPlus className="w-4 h-4" /> Add Manually
            </Button>
          </div>
        ) : (
          <div className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-white/70">First Name *</Label>
                <Input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} className="bg-white/5 border-white/10 text-white" />
              </div>
              <div className="space-y-2">
                <Label className="text-white/70">Last Name *</Label>
                <Input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} className="bg-white/5 border-white/10 text-white" />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-white/70">Photo</Label>
              {prefillPhotoUrl && !photoFile && (
                <div className="flex items-center gap-2 mb-1">
                  <img src={prefillPhotoUrl} alt="Current" className="w-10 h-10 rounded-lg object-cover" />
                  <span className="text-white/40 text-xs">From registration (upload to replace)</span>
                </div>
              )}
              <label className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 cursor-pointer hover:bg-white/10 transition-colors">
                <Upload className="w-4 h-4 text-white/40" />
                <span className="text-white/50 text-sm truncate">{photoFile ? photoFile.name : "Choose photo..."}</span>
                <input type="file" accept="image/*" className="hidden" onChange={(e) => setPhotoFile(e.target.files?.[0] || null)} />
              </label>
            </div>

            <div className="space-y-2">
              <Label className="text-white/70">Address</Label>
              <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="bg-white/5 border-white/10 text-white" placeholder="Street address" />
            </div>

            <div className="space-y-2">
              <Label className="text-white/70">Pickup Zone *</Label>
              <Select value={form.pickup_zone} onValueChange={(v) => setForm({ ...form, pickup_zone: v })}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Woodbine">Woodbine</SelectItem>
                  <SelectItem value="Wildwood">Wildwood</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-white/70">Emergency Contact</Label>
                <Input value={form.emergency_contact_name} onChange={(e) => setForm({ ...form, emergency_contact_name: e.target.value })} className="bg-white/5 border-white/10 text-white" placeholder="Contact name" />
              </div>
              <div className="space-y-2">
                <Label className="text-white/70">Contact Phone</Label>
                <Input value={form.emergency_contact_phone} onChange={(e) => setForm({ ...form, emergency_contact_phone: e.target.value })} className="bg-white/5 border-white/10 text-white" placeholder="(555) 123-4567" />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-white/70">Notes</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="bg-white/5 border-white/10 text-white resize-none" rows={2} placeholder="Allergies, special needs, etc." />
            </div>

            <div className="space-y-2">
              <Label className="text-white/70">Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button onClick={handleSave} disabled={saving} className="w-full bg-[#3B82F6] hover:bg-[#2563EB] text-white">
              {saving ? "Saving..." : "Add Profile"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
