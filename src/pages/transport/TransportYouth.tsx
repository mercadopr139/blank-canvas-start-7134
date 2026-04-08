import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Baby, MapPin, Search, Upload, Trash2 } from "lucide-react";
import AddYouthDialog from "@/components/transport/AddYouthDialog";

interface YouthProfile {
  id: string;
  first_name: string;
  last_name: string;
  photo_url: string | null;
  address: string | null;
  pickup_zone: string;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  notes: string | null;
  status: string;
  created_at: string;
  date_of_birth: string | null;
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

export default function TransportYouth() {
  const [youth, setYouth] = useState<YouthProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<YouthProfile | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<YouthProfile | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { toast } = useToast();

  useEffect(() => { fetchYouth(); }, []);

  const fetchYouth = async () => {
    const { data, error } = await supabase.from("youth_profiles").select("*").order("last_name");
    if (!error && data) setYouth(data);
    setLoading(false);
  };

  const openEdit = (y: YouthProfile) => {
    setEditing(y);
    setForm({
      first_name: y.first_name, last_name: y.last_name, address: y.address || "",
      pickup_zone: y.pickup_zone, emergency_contact_name: y.emergency_contact_name || "",
      emergency_contact_phone: y.emergency_contact_phone || "", notes: y.notes || "", status: y.status,
    });
    setPhotoFile(null);
    setEditOpen(true);
  };

  const handleEditSave = async () => {
    if (!editing || !form.first_name.trim() || !form.last_name.trim()) {
      toast({ title: "First and last name are required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      let photo_url: string | null = editing.photo_url || null;
      if (photoFile) {
        const ext = photoFile.name.split(".").pop();
        const path = `transport/${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage.from("youth-photos").upload(path, photoFile, { upsert: true });
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from("youth-photos").getPublicUrl(path);
        photo_url = urlData.publicUrl;
      }
      const record = {
        first_name: form.first_name.trim(), last_name: form.last_name.trim(),
        address: form.address.trim() || null, pickup_zone: form.pickup_zone as "Woodbine" | "Wildwood",
        emergency_contact_name: form.emergency_contact_name.trim() || null,
        emergency_contact_phone: form.emergency_contact_phone.trim() || null,
        notes: form.notes.trim() || null, status: form.status as "active" | "inactive", photo_url,
      };
      const { error } = await supabase.from("youth_profiles").update(record).eq("id", editing.id);
      if (error) throw error;
      toast({ title: "Profile updated" });
      setEditOpen(false);
      fetchYouth();
    } catch {
      toast({ title: "Failed to save profile", variant: "destructive" });
    } finally { setSaving(false); }
  };

  const filtered = youth.filter((y) => {
    const q = search.toLowerCase();
    return y.first_name.toLowerCase().includes(q) || y.last_name.toLowerCase().includes(q) || y.pickup_zone.toLowerCase().includes(q);
  });

  const getPhotoUrl = (url: string | null) => {
    if (!url) return null;
    if (url.startsWith("http")) return url;
    // Photos may be in youth-photos or registration-signatures bucket
    return `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/registration-signatures/${url}`;
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Baby className="w-6 h-6 text-[#3B82F6]" />
          <h1 className="text-xl font-bold text-white">Youth Profiles</h1>
          <Badge variant="outline" className="text-white/50 border-white/20">{youth.length}</Badge>
        </div>
        <Button onClick={() => setAddOpen(true)} className="bg-[#3B82F6] hover:bg-[#2563EB] text-white gap-2">
          <Plus className="w-4 h-4" /> Add Youth
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or zone..." className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-white/30" />
      </div>

      {loading ? (
        <div className="text-white/40 text-center py-12">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="text-white/40 text-center py-12">No youth profiles found.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((y) => (
            <div key={y.id} className="bg-white/5 border border-white/10 rounded-xl p-4 flex gap-3 items-start">
              <div className="w-14 h-14 rounded-lg bg-white/10 overflow-hidden shrink-0 flex items-center justify-center">
                {y.photo_url ? (
                  <img src={getPhotoUrl(y.photo_url) || ""} alt={`${y.first_name} ${y.last_name}`} className="w-full h-full object-cover" />
                ) : (
                  <Baby className="w-6 h-6 text-white/30" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-medium truncate">
                  {y.first_name} {y.last_name}
                  {y.date_of_birth && (
                    <span className="text-white/40 text-sm ml-1">· {(() => { const b = new Date(y.date_of_birth); const t = new Date(); let a = t.getFullYear() - b.getFullYear(); if (t.getMonth() < b.getMonth() || (t.getMonth() === b.getMonth() && t.getDate() < b.getDate())) a--; return a; })()}y</span>
                  )}
                </p>
                <p className="text-white/40 text-sm flex items-center gap-1 mt-0.5"><MapPin className="w-3 h-3" /> {y.pickup_zone}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <Badge className={y.status === "active" ? "bg-green-500/20 text-green-400 border-green-500/30 text-[10px]" : "bg-red-500/20 text-red-400 border-red-500/30 text-[10px]"}>{y.status}</Badge>
                </div>
              </div>
              <div className="flex flex-col gap-1 shrink-0">
                <Button size="icon" variant="ghost" onClick={() => openEdit(y)} className="text-white/40 hover:text-white hover:bg-white/10 h-8 w-8">
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => setDeleteTarget(y)} className="text-white/40 hover:text-red-400 hover:bg-red-500/10 h-8 w-8">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <AddYouthDialog open={addOpen} onOpenChange={setAddOpen} onSaved={fetchYouth} />

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="bg-[#111827] border-white/10 text-white max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Youth Profile</DialogTitle></DialogHeader>
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
                <SelectContent><SelectItem value="Woodbine">Woodbine</SelectItem><SelectItem value="Wildwood">Wildwood</SelectItem></SelectContent>
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
                <SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem></SelectContent>
              </Select>
            </div>
            <Button onClick={handleEditSave} disabled={saving} className="w-full bg-[#3B82F6] hover:bg-[#2563EB] text-white">
              {saving ? "Saving..." : "Update Profile"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="bg-[#111827] border-white/10 text-white max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-red-400">Delete Youth Profile</DialogTitle>
          </DialogHeader>
          <p className="text-white/60 text-sm">
            Are you sure you want to permanently delete <strong className="text-white">{deleteTarget?.first_name} {deleteTarget?.last_name}</strong>? This action cannot be undone.
          </p>
          <div className="flex gap-3 mt-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)} className="flex-1 border-white/10 text-white/70 hover:bg-white/5">
              Cancel
            </Button>
            <Button
              onClick={async () => {
                if (!deleteTarget) return;
                setDeleting(true);
                const { error } = await supabase.from("youth_profiles").delete().eq("id", deleteTarget.id);
                setDeleting(false);
                if (error) {
                  toast({ title: "Failed to delete profile", variant: "destructive" });
                } else {
                  toast({ title: "Profile deleted" });
                  setDeleteTarget(null);
                  fetchYouth();
                }
              }}
              disabled={deleting}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white"
            >
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
