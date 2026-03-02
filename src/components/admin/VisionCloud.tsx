import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Pencil, ArchiveX, Cloud } from "lucide-react";

const PILLARS = ["Operations", "Sales & Marketing", "Finance", "Vision", "Personal"] as const;

const PILLAR_CHIP_COLORS: Record<string, string> = {
  Operations: "bg-[#bf0f3e]/15 text-[#bf0f3e] border-[#bf0f3e]/30",
  "Sales & Marketing": "bg-green-500/15 text-green-400 border-green-500/30",
  Finance: "bg-sky-300/15 text-sky-300 border-sky-300/30",
  Vision: "bg-amber-400/15 text-amber-400 border-amber-400/30",
  Personal: "bg-purple-400/15 text-purple-400 border-purple-400/30",
};

const PILLAR_GLOW: Record<string, string> = {
  Operations: "shadow-[0_0_12px_rgba(191,15,62,0.15)]",
  "Sales & Marketing": "shadow-[0_0_12px_rgba(74,222,128,0.12)]",
  Finance: "shadow-[0_0_12px_rgba(125,211,252,0.12)]",
  Vision: "shadow-[0_0_12px_rgba(251,191,36,0.12)]",
  Personal: "shadow-[0_0_12px_rgba(192,132,252,0.12)]",
};

type VisionItem = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  pillar: string;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export default function VisionCloud() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<VisionItem | null>(null);
  const [form, setForm] = useState({ title: "", description: "", pillar: "Vision" });

  const { data: items = [] } = useQuery({
    queryKey: ["vision-cloud-items"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vision_cloud_items" as any)
        .select("*")
        .eq("active", true)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data as any[]) as VisionItem[];
    },
    enabled: !!user,
  });

  const upsertMutation = useMutation({
    mutationFn: async () => {
      if (editingItem) {
        const { error } = await supabase
          .from("vision_cloud_items" as any)
          .update({ title: form.title, description: form.description || null, pillar: form.pillar } as any)
          .eq("id", editingItem.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("vision_cloud_items" as any)
          .insert({ title: form.title, description: form.description || null, pillar: form.pillar, user_id: user!.id, active: true } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vision-cloud-items"] });
      closeModal();
      toast.success(editingItem ? "Updated" : "Added to Vision Cloud");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const archiveMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("vision_cloud_items" as any)
        .update({ active: false } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vision-cloud-items"] });
      toast.success("Archived");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const openAdd = () => {
    setEditingItem(null);
    setForm({ title: "", description: "", pillar: "Vision" });
    setShowModal(true);
  };

  const openEdit = (item: VisionItem) => {
    setEditingItem(item);
    setForm({ title: item.title, description: item.description || "", pillar: item.pillar });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingItem(null);
    setForm({ title: "", description: "", pillar: "Vision" });
  };

  return (
    <>
      {/* Vision Cloud Container */}
      <div className="relative rounded-[2rem] border border-white/[0.08] bg-gradient-to-br from-white/[0.04] via-white/[0.02] to-white/[0.01] backdrop-blur-sm p-6 md:p-8 overflow-hidden">
        {/* Subtle glow outline */}
        <div className="absolute inset-0 rounded-[2rem] ring-1 ring-inset ring-white/[0.06] pointer-events-none" />
        {/* Background blob decorations */}
        <div className="absolute -top-20 -right-20 w-60 h-60 bg-amber-400/[0.03] rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-48 h-48 bg-purple-400/[0.03] rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="relative flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Cloud className="w-4 h-4 text-white/30" />
              <h2 className="text-sm font-bold uppercase tracking-[0.15em] text-white/50">Big Picture Focus</h2>
            </div>
            <p className="text-xs text-white/20 italic">What deserves strategic time right now?</p>
          </div>
          <div className="flex items-center gap-3">
            {items.length > 0 && (
              <span className="text-[10px] text-white/20 tabular-nums">
                {items.length} Strategic Focus Area{items.length !== 1 ? "s" : ""} Active
              </span>
            )}
            <Button
              onClick={openAdd}
              size="sm"
              className="bg-white/[0.08] hover:bg-white/[0.14] text-white/60 hover:text-white border border-white/[0.1] text-xs h-7 px-3 rounded-full"
            >
              <Plus className="w-3 h-3 mr-1" />
              Add
            </Button>
          </div>
        </div>

        {/* Cloud Chips */}
        <div className="relative flex flex-wrap gap-3 min-h-[60px]">
          {items.length === 0 ? (
            <div className="w-full text-center py-8">
              <Cloud className="w-8 h-8 text-white/10 mx-auto mb-2" />
              <p className="text-xs text-white/15 italic">No strategic focus areas yet</p>
            </div>
          ) : (
            items.map((item) => (
              <div
                key={item.id}
                className={`group relative flex items-center gap-2 px-4 py-2.5 rounded-2xl border bg-white/[0.04] border-white/[0.08] hover:bg-white/[0.07] hover:-translate-y-0.5 transition-all duration-200 cursor-default ${PILLAR_GLOW[item.pillar] || ""}`}
              >
                <span className="text-sm text-white/80 font-medium">{item.title}</span>
                <Badge variant="outline" className={`text-[9px] px-1.5 py-0 h-4 ${PILLAR_CHIP_COLORS[item.pillar] || "border-white/20 text-white/60"}`}>
                  {item.pillar}
                </Badge>
                {/* Action icons on hover */}
                <div className="hidden group-hover:flex items-center gap-0.5 ml-1">
                  <button
                    onClick={() => openEdit(item)}
                    className="p-1 rounded-full hover:bg-white/10 text-white/30 hover:text-white/70 transition-colors"
                    aria-label="Edit"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => archiveMutation.mutate(item.id)}
                    className="p-1 rounded-full hover:bg-white/10 text-white/30 hover:text-white/70 transition-colors"
                    aria-label="Archive"
                  >
                    <ArchiveX className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Add/Edit Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="bg-zinc-900 border-white/10 text-white">
          <DialogHeader>
            <DialogTitle>{editingItem ? "Edit Focus Area" : "Add Big Picture Item"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-white/60">Title *</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="bg-white/5 border-white/10 text-white mt-1"
                placeholder="e.g. Launch summer program"
              />
            </div>
            <div>
              <Label className="text-white/60">Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="bg-white/5 border-white/10 text-white mt-1"
                placeholder="Optional details..."
                rows={3}
              />
            </div>
            <div>
              <Label className="text-white/60">Pillar</Label>
              <Select value={form.pillar} onValueChange={(v) => setForm({ ...form, pillar: v })}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white mt-1">
                  <SelectValue placeholder="Select pillar" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-white/10 z-[200]">
                  {PILLARS.map((p) => (
                    <SelectItem key={p} value={p} className="text-white hover:bg-white/10 focus:bg-white/10 focus:text-white">{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={closeModal} className="text-white/40 hover:text-white/60">Cancel</Button>
            <Button
              onClick={() => upsertMutation.mutate()}
              disabled={!form.title.trim() || upsertMutation.isPending}
              className="bg-white text-black hover:bg-white/90"
            >
              {upsertMutation.isPending ? "Saving..." : editingItem ? "Save Changes" : "Add to Cloud"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
