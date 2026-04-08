import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Phone, Users } from "lucide-react";

interface Driver {
  id: string;
  name: string;
  phone: string | null;
  status: string;
  pin_hash: string;
  created_at: string;
}

async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export default function TransportDrivers() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  const [form, setForm] = useState({ name: "", phone: "", pin: "", status: "active" });
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchDrivers();
  }, []);

  const fetchDrivers = async () => {
    const { data, error } = await supabase
      .from("drivers")
      .select("*")
      .order("name");
    if (!error && data) setDrivers(data);
    setLoading(false);
  };

  const openAdd = () => {
    setEditingDriver(null);
    setForm({ name: "", phone: "", pin: "", status: "active" });
    setDialogOpen(true);
  };

  const openEdit = (driver: Driver) => {
    setEditingDriver(driver);
    setForm({ name: driver.name, phone: driver.phone || "", pin: "", status: driver.status });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }

    if (!editingDriver && (!form.pin || form.pin.length < 4)) {
      toast({ title: "PIN must be at least 4 digits", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      if (editingDriver) {
        const updateData: Record<string, unknown> = {
          name: form.name.trim(),
          phone: form.phone.trim() || null,
          status: form.status,
        };
        if (form.pin) {
          updateData.pin_hash = await hashPin(form.pin);
        }
        const { error } = await supabase
          .from("drivers")
          .update(updateData)
          .eq("id", editingDriver.id);
        if (error) throw error;
        toast({ title: "Driver updated" });
      } else {
        const pin_hash = await hashPin(form.pin);
        const { error } = await supabase
          .from("drivers")
          .insert({ name: form.name.trim(), phone: form.phone.trim() || null, pin_hash, status: form.status as "active" | "inactive" });
        if (error) throw error;
        toast({ title: "Driver added" });
      }
      setDialogOpen(false);
      fetchDrivers();
    } catch {
      toast({ title: "Failed to save driver", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="w-6 h-6 text-[#DC2626]" />
          <h1 className="text-xl font-bold text-white">Drivers</h1>
          <Badge variant="outline" className="text-white/50 border-white/20">
            {drivers.length}
          </Badge>
        </div>
        <Button onClick={openAdd} className="bg-[#DC2626] hover:bg-[#B91C1C] text-white gap-2">
          <Plus className="w-4 h-4" /> Add Driver
        </Button>
      </div>

      {loading ? (
        <div className="text-white/40 text-center py-12">Loading...</div>
      ) : drivers.length === 0 ? (
        <div className="text-white/40 text-center py-12">No drivers yet. Add your first driver above.</div>
      ) : (
        <div className="grid gap-3">
          {drivers.map((driver) => (
            <div
              key={driver.id}
              className="flex items-center justify-between bg-white/5 border border-white/10 rounded-xl px-4 py-3"
            >
              <div className="flex-1 min-w-0">
                <p className="text-white font-medium truncate">{driver.name}</p>
                {driver.phone && (
                  <p className="text-white/40 text-sm flex items-center gap-1 mt-0.5">
                    <Phone className="w-3 h-3" /> {driver.phone}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3">
                <Badge
                  className={
                    driver.status === "active"
                      ? "bg-green-500/20 text-green-400 border-green-500/30"
                      : "bg-red-500/20 text-red-400 border-red-500/30"
                  }
                >
                  {driver.status}
                </Badge>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => openEdit(driver)}
                  className="text-white/40 hover:text-white hover:bg-white/10"
                >
                  <Pencil className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-[#111827] border-white/10 text-white max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingDriver ? "Edit Driver" : "Add New Driver"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label className="text-white/70">Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="bg-white/5 border-white/10 text-white"
                placeholder="Driver name"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-white/70">Phone</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="bg-white/5 border-white/10 text-white"
                placeholder="(555) 123-4567"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-white/70">
                {editingDriver ? "New PIN (leave blank to keep current)" : "PIN *"}
              </Label>
              <Input
                type="password"
                value={form.pin}
                onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, "").slice(0, 6) })}
                className="bg-white/5 border-white/10 text-white"
                placeholder="4-6 digit PIN"
                inputMode="numeric"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-white/70">Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="w-full bg-[#DC2626] hover:bg-[#B91C1C] text-white"
            >
              {saving ? "Saving..." : editingDriver ? "Update Driver" : "Add Driver"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
