import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Signal } from "lucide-react";
import type { Pillar } from "@/pages/admin/AdminMessageBoard";

interface Props {
  open: boolean;
  onClose: () => void;
  currentUserId: string;
  // Optional — pre-fill from a specific message that triggered this modal.
  prefilledDescription?: string;
  sourceMessageId?: string;
  sourceConversationId?: string;
  // The conversation's pillar maps 1:1 onto a signal pillar when present.
  // Helps the user skip a step in the common case of "this came from a
  // Finance conversation, file it under Finance in my Workbench."
  conversationPillar?: Pillar;
}

type FocusArea = { id: string; key: string; title: string; manager_type: string };

// The signal-pillar enum uses Title Case strings with spaces, while the
// message-board pillar enum uses snake_case. Map between them.
const messageBoardToSignalPillar: Record<Pillar, string> = {
  operations: "Operations",
  sales_marketing: "Sales & Marketing",
  finance: "Finance",
};

// Mirrors the helper in AdminWorkbench.tsx — keep these two in sync.
const signalSourceFor = (managerType: string, areaKey: string, areaTitle: string): string | null => {
  const isNla = areaKey === "nla";
  if (managerType === "PD") return isNla ? null : areaTitle;
  return `${managerType}:${isNla ? "NLA" : areaTitle}`;
};

const AddToWorkbenchModal = ({
  open,
  onClose,
  currentUserId,
  prefilledDescription,
  sourceMessageId,
  sourceConversationId,
  conversationPillar,
}: Props) => {
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [focusAreaKey, setFocusAreaKey] = useState<string>("");
  const [bucket, setBucket] = useState<"Core" | "Bonus">("Core");
  const [pillar, setPillar] = useState<string>("");
  const [saving, setSaving] = useState(false);

  // The current user's task_manager_type drives which Workbench (PD or
  // PC) this task lands in. Without it, the user can't have one — show
  // a helpful note instead of a broken form.
  const { data: profile } = useQuery({
    queryKey: ["my-task-manager-type", currentUserId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staff_profiles")
        .select("task_manager_type")
        .eq("user_id", currentUserId)
        .maybeSingle();
      if (error) return null;
      return data as { task_manager_type: string | null } | null;
    },
    enabled: !!currentUserId && open,
  });

  const managerType = profile?.task_manager_type ?? null;

  const { data: focusAreas = [] } = useQuery<FocusArea[]>({
    queryKey: ["my-workbench-focus-areas", managerType],
    queryFn: async () => {
      if (!managerType) return [];
      const { data, error } = await supabase
        .from("focus_areas")
        .select("id, key, title, manager_type")
        .eq("manager_type", managerType)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data || []) as FocusArea[];
    },
    enabled: !!managerType && open,
  });

  // Pre-fill on open so the user lands in a form that's already most of
  // the way filled out.
  useEffect(() => {
    if (!open) return;
    setTitle("");
    setDescription(prefilledDescription || "");
    setBucket("Core");
    setPillar(conversationPillar ? messageBoardToSignalPillar[conversationPillar] : "");
    setFocusAreaKey("");
  }, [open, prefilledDescription, conversationPillar]);

  // If there's exactly one focus area, just pick it.
  useEffect(() => {
    if (focusAreas.length === 1 && !focusAreaKey) {
      setFocusAreaKey(focusAreas[0].key);
    }
  }, [focusAreas, focusAreaKey]);

  const handleSave = async () => {
    if (!title.trim()) {
      toast({ title: "Title is required", variant: "destructive" });
      return;
    }
    if (!managerType) {
      toast({ title: "You don't have a Workbench yet", description: "Ask Josh to set your task_manager_type.", variant: "destructive" });
      return;
    }
    if (!focusAreaKey) {
      toast({ title: "Pick a focus area", variant: "destructive" });
      return;
    }
    const area = focusAreas.find((a) => a.key === focusAreaKey);
    if (!area) {
      toast({ title: "Focus area not found", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const source = signalSourceFor(managerType, area.key, area.title);
      const insertRow: Record<string, unknown> = {
        title: title.trim(),
        description: description.trim() || null,
        priority_layer: bucket,
        signal_kind: null,
        signal_type: "Action",
        status: "Pending",
        is_archived: false,
        source,
      };
      if (pillar) insertRow.pillar = pillar;
      if (sourceMessageId) insertRow.source_message_id = sourceMessageId;
      if (sourceConversationId) insertRow.source_conversation_id = sourceConversationId;

      const { error } = await supabase.from("signals").insert(insertRow);
      if (error) throw error;

      toast({ title: "Added to your Workbench" });
      onClose();
    } catch (err) {
      toast({
        title: "Failed to add to Workbench",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="bg-neutral-900 border-white/[0.08] text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold text-white flex items-center gap-2">
            <Signal className="w-4 h-4 text-emerald-400" />
            Add to my Workbench
          </DialogTitle>
        </DialogHeader>

        {!managerType ? (
          <div className="py-4 text-sm text-zinc-400">
            Your account doesn't have a Workbench assigned yet. Ask Josh to set your{" "}
            <code className="bg-white/[0.06] px-1 rounded text-xs">task_manager_type</code>{" "}
            on your staff profile.
          </div>
        ) : focusAreas.length === 0 ? (
          <div className="py-4 text-sm text-zinc-400">
            Your {managerType} Workbench doesn't have any focus areas yet. Open the Workbench and create one first.
          </div>
        ) : (
          <div className="space-y-4 pt-1">
            <div>
              <Label className="text-xs text-zinc-400 mb-1.5 block">Title <span className="text-red-400">*</span></Label>
              <Input
                placeholder="What needs to get done?"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="bg-white/[0.04] border-white/[0.08] text-zinc-200 placeholder:text-zinc-600 text-sm"
                autoFocus
              />
            </div>

            <div>
              <Label className="text-xs text-zinc-400 mb-1.5 block">Notes</Label>
              <Textarea
                placeholder="Add more context..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="resize-none bg-white/[0.04] border-white/[0.08] text-zinc-200 placeholder:text-zinc-600 text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-zinc-400 mb-1.5 block">Focus Area</Label>
                <Select value={focusAreaKey} onValueChange={setFocusAreaKey}>
                  <SelectTrigger className="bg-white/[0.04] border-white/[0.08] text-zinc-200 text-sm h-9">
                    <SelectValue placeholder="Pick one" />
                  </SelectTrigger>
                  <SelectContent className="bg-neutral-900 border-white/[0.08] z-[200]">
                    {focusAreas.map((a) => (
                      <SelectItem key={a.key} value={a.key} className="text-zinc-200 text-sm focus:bg-white/[0.06] focus:text-white">
                        {a.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs text-zinc-400 mb-1.5 block">Bucket</Label>
                <Select value={bucket} onValueChange={(v) => setBucket(v as "Core" | "Bonus")}>
                  <SelectTrigger className="bg-white/[0.04] border-white/[0.08] text-zinc-200 text-sm h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-neutral-900 border-white/[0.08] z-[200]">
                    <SelectItem value="Core" className="text-zinc-200 text-sm focus:bg-white/[0.06] focus:text-white">Core</SelectItem>
                    <SelectItem value="Bonus" className="text-zinc-200 text-sm focus:bg-white/[0.06] focus:text-white">On-Deck</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {sourceMessageId && (
              <p className="text-[11px] text-zinc-600">
                ↳ Linked back to the original message — you'll be able to jump to it from your Workbench.
              </p>
            )}

            <div className="flex gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={onClose}
                className="flex-1 border-white/10 text-zinc-400 bg-transparent hover:bg-white/5 hover:text-white text-xs"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={saving || !title.trim() || !focusAreaKey}
                className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-semibold"
              >
                {saving ? "Adding..." : "Add to Workbench"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default AddToWorkbenchModal;
