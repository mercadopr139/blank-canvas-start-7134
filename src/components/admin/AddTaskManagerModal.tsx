import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

type StaffOption = {
  user_id: string;
  full_name: string | null;
  email: string | null;
  job_title: string | null;
};

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

// Derive a short uppercase key from a manager name. "Head Coach" → "HC",
// "Josh Sanchez" → "JS". Falls back to first 2 letters if no spaces.
const deriveKey = (name: string): string => {
  const trimmed = name.trim();
  if (!trimmed) return "";
  const words = trimmed.split(/\s+/);
  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }
  return words.map((w) => w[0]).join("").slice(0, 4).toUpperCase();
};

const ACCENT_COLORS = [
  { hex: "#a1a1aa", label: "Gray" },
  { hex: "#ef4444", label: "Red" },
  { hex: "#f59e0b", label: "Amber" },
  { hex: "#22c55e", label: "Green" },
  { hex: "#06b6d4", label: "Cyan" },
  { hex: "#3b82f6", label: "Blue" },
  { hex: "#a855f7", label: "Purple" },
];

export default function AddTaskManagerModal({ open, onClose, onCreated }: Props) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [keyTouched, setKeyTouched] = useState(false);
  const [ownerUserId, setOwnerUserId] = useState<string>("");
  const [accentColor, setAccentColor] = useState(ACCENT_COLORS[0].hex);
  const [saving, setSaving] = useState(false);

  // Reset form whenever the modal reopens.
  useEffect(() => {
    if (open) {
      setName("");
      setKey("");
      setKeyTouched(false);
      setOwnerUserId("");
      setAccentColor(ACCENT_COLORS[0].hex);
    }
  }, [open]);

  // Auto-derive the key from the name unless the user has typed in the key field.
  useEffect(() => {
    if (!keyTouched) setKey(deriveKey(name));
  }, [name, keyTouched]);

  // Load admin users for the Owner dropdown.
  const { data: staffOptions = [] } = useQuery({
    queryKey: ["staff-options-for-task-manager"],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("staff_profiles")
        .select("user_id, full_name, email, job_title") as any)
        .eq("status", "active")
        .order("full_name", { ascending: true });
      if (error) throw error;
      return (data || []) as StaffOption[];
    },
    enabled: open,
  });

  const selectedOwner = useMemo(
    () => staffOptions.find((s) => s.user_id === ownerUserId) || null,
    [staffOptions, ownerUserId]
  );

  const createMutation = useMutation({
    mutationFn: async () => {
      const trimmedName = name.trim();
      const trimmedKey = key.trim().toUpperCase();
      if (!trimmedName) throw new Error("Manager name is required");
      if (!trimmedKey) throw new Error("Short code is required");
      if (!selectedOwner?.email) throw new Error("Owner is required");
      if (!/^[A-Z0-9]{1,8}$/.test(trimmedKey)) {
        throw new Error("Short code must be 1–8 letters/digits, no spaces");
      }
      // PD/PC are reserved as legacy keys; everything else uses the prefixed
      // source convention so a clash here would silently scramble signals.
      if (trimmedKey === "PD" || trimmedKey === "PC") {
        throw new Error(`Short code "${trimmedKey}" is reserved`);
      }

      // Find the next sort_order so the new tile lands at the end of the row.
      const { data: existing } = await (supabase
        .from("task_managers")
        .select("sort_order") as any)
        .order("sort_order", { ascending: false })
        .limit(1);
      const nextSortOrder = ((existing?.[0]?.sort_order as number) ?? 0) + 1;

      // 1. Insert the task manager row.
      const displayName = `${trimmedName} Task Manager`;
      const { error: tmErr } = await (supabase.from("task_managers") as any).insert({
        key: trimmedKey,
        display_name: displayName,
        subtitle: "Focus Areas & Daily Signals",
        owner_email: selectedOwner.email,
        owner_name: selectedOwner.full_name || trimmedName,
        accent_color: accentColor,
        icon_name: "signal",
        sort_order: nextSortOrder,
      });
      if (tmErr) throw tmErr;

      // 2. Seed only the shared NLA focus area for the new manager. Other
      //    focus areas (USA Boxing, etc.) are intentionally left out so the
      //    owner can add focus areas tailored to their role.
      const { error: faErr } = await (supabase.from("focus_areas") as any).insert({
        key: "nla",
        title: "NLA",
        subtitle: "No Limits Academy",
        icon_name: "graduation-cap",
        accent_color: "#ef4444",
        sort_order: 0,
        is_default: true,
        manager_type: trimmedKey,
      });
      if (faErr) throw faErr;

      // 3. Auto-grant the owner permission to their own task manager so
      //    they can navigate to the tile immediately on next page load.
      //    Other admins will need to be granted via Staff Management.
      const { error: permErr } = await (supabase.from("staff_permissions") as any).upsert(
        {
          user_id: selectedOwner.user_id,
          permission_key: `task_manager_${trimmedKey}`,
          granted: true,
        },
        { onConflict: "user_id,permission_key" }
      );
      if (permErr) {
        // Permission grant is a nice-to-have — the manager + focus area
        // are already created. Log instead of failing the whole flow.
        console.warn("Failed to auto-grant owner permission:", permErr);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-managers"] });
      queryClient.invalidateQueries({ queryKey: ["focus-areas"] });
      toast.success("Task manager created");
      onCreated();
      onClose();
    },
    onError: (e: any) => toast.error(e.message || "Couldn't create task manager"),
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      await createMutation.mutateAsync();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="bg-zinc-900 border-white/10 text-white max-w-md">
        <DialogHeader>
          <DialogTitle>Add Task Manager</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div>
            <Label className="text-white/60">Manager name</Label>
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Head Coach, Josh Sanchez"
              className="bg-white/5 border-white/10 text-white mt-1"
            />
            <p className="text-[11px] text-white/30 mt-1">
              Tile will read "{name.trim() || "…"} Task Manager"
            </p>
          </div>

          <div>
            <Label className="text-white/60">Short code</Label>
            <Input
              value={key}
              onChange={(e) => {
                setKey(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8));
                setKeyTouched(true);
              }}
              placeholder="HC"
              className="bg-white/5 border-white/10 text-white mt-1 font-mono uppercase"
              maxLength={8}
            />
            <p className="text-[11px] text-white/30 mt-1">
              Used in the URL (/admin/task-manager/{key || "…"}) and to namespace this manager's signals. Auto-derived from the name; tweak if needed.
            </p>
          </div>

          <div>
            <Label className="text-white/60">Owner</Label>
            <Select value={ownerUserId} onValueChange={setOwnerUserId}>
              <SelectTrigger className="bg-white/5 border-white/10 text-white mt-1">
                <SelectValue placeholder="Pick an admin user" />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-white/10 z-[200] max-h-72">
                {staffOptions.length === 0 ? (
                  <div className="px-2 py-3 text-xs text-white/40">No active staff. Add one in Settings → Staff Management.</div>
                ) : (
                  staffOptions.map((s) => (
                    <SelectItem
                      key={s.user_id}
                      value={s.user_id}
                      className="text-white hover:bg-white/10 focus:bg-white/10 focus:text-white"
                    >
                      <div className="flex flex-col">
                        <span>{s.full_name || s.email || "Unnamed"}</span>
                        {s.email && (
                          <span className="text-[10px] text-white/40">{s.email}</span>
                        )}
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-white/60">Accent color</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {ACCENT_COLORS.map((c) => (
                <button
                  key={c.hex}
                  type="button"
                  onClick={() => setAccentColor(c.hex)}
                  title={c.label}
                  className={`w-7 h-7 rounded-full border-2 transition-all ${
                    accentColor === c.hex ? "border-white scale-110" : "border-white/10 hover:border-white/40"
                  }`}
                  style={{ background: c.hex }}
                />
              ))}
            </div>
          </div>
        </div>
        <DialogFooter className="mt-6">
          <Button
            variant="ghost"
            onClick={onClose}
            className="text-white/40 hover:text-white/60"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={
              saving ||
              !name.trim() ||
              !key.trim() ||
              !ownerUserId ||
              key === "PD" ||
              key === "PC"
            }
            className="bg-white text-black hover:bg-white/90"
          >
            {saving ? "Creating…" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
