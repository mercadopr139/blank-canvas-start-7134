// Detail panel — opens when you click an item title in the tree.
// Phase 2 surface: title (editable inline), status, owner, due date,
// star, notes (editable). Attachments + links + activity log come in
// Phase 3.

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Calendar, X } from "lucide-react";
import { OwnerPicker } from "./OwnerPicker";
import { PILLAR_COLOR, PILLAR_LABEL } from "@/pages/admin/AdminMessageBoard";
import {
  STATUS_LABEL,
  type AgendaItemWithChildren,
  type AgendaStatus,
  type StaffOption,
} from "./types";

interface Props {
  item: AgendaItemWithChildren | null;
  staff: StaffOption[];
  open: boolean;
  onClose: () => void;
  onSave: (patch: {
    title?: string;
    notes?: string | null;
    status?: AgendaStatus;
    due_date?: string | null;
    owner_user_id?: string | null;
  }) => Promise<void>;
}

const STATUS_OPTIONS: AgendaStatus[] = ["signal", "done", "on_hold"];

export const AgendaItemDetailDialog = ({
  item,
  staff,
  open,
  onClose,
  onSave,
}: Props) => {
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [dueDate, setDueDate] = useState<string>("");
  const [status, setStatus] = useState<AgendaStatus>("signal");
  const [ownerUserId, setOwnerUserId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Reset local form state whenever a different item opens.
  useEffect(() => {
    if (!item) return;
    setTitle(item.title);
    setNotes(item.notes ?? "");
    setDueDate(item.due_date ?? "");
    setStatus(item.status);
    setOwnerUserId(item.owner_user_id);
  }, [item?.id]);

  if (!item) return null;

  const accent = PILLAR_COLOR[item.pillar];

  const handleSave = async () => {
    const patch: Parameters<typeof onSave>[0] = {};
    if (title.trim() !== item.title) patch.title = title.trim();
    if ((notes || null) !== (item.notes || null)) patch.notes = notes.trim() || null;
    if ((dueDate || null) !== (item.due_date || null)) patch.due_date = dueDate || null;
    if (status !== item.status) patch.status = status;
    if ((ownerUserId || null) !== (item.owner_user_id || null)) patch.owner_user_id = ownerUserId;
    if (Object.keys(patch).length === 0) {
      onClose();
      return;
    }
    setSaving(true);
    try {
      await onSave(patch);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="bg-neutral-900 border-white/10 text-white max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <span
              className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded"
              style={{ background: `${accent}18`, color: accent }}
            >
              {PILLAR_LABEL[item.pillar]}
            </span>
            <span className="text-[10px] text-zinc-600">
              Level {item.depth}
            </span>
          </div>
          <DialogTitle className="sr-only">Edit agenda item</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Title — large inline edit */}
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Item title"
            className="bg-white/[0.04] border-white/[0.08] text-white text-base font-semibold h-10"
          />

          {/* Status segmented control */}
          <div>
            <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1.5">
              Status
            </p>
            <div className="flex gap-1.5">
              {STATUS_OPTIONS.map((s) => {
                const active = status === s;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatus(s)}
                    className={`flex-1 text-xs font-semibold py-1.5 rounded-md border transition-colors ${
                      active
                        ? s === "done"
                          ? "border-green-500/40 bg-green-500/15 text-green-400"
                          : s === "on_hold"
                            ? "border-amber-500/40 bg-amber-500/15 text-amber-300"
                            : "border-white/20 bg-white/[0.06] text-white"
                        : "border-white/[0.06] text-white/40 hover:border-white/15 hover:text-white/70"
                    }`}
                  >
                    {STATUS_LABEL[s]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Owner + due date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1.5">
                Owner
              </p>
              <OwnerPicker
                ownerUserId={ownerUserId}
                staff={staff}
                onChange={setOwnerUserId}
              />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1.5">
                Due
              </p>
              <div className="relative">
                <Calendar className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-md text-xs text-white py-1.5 pl-7 pr-2"
                />
                {dueDate && (
                  <button
                    type="button"
                    onClick={() => setDueDate("")}
                    className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 text-zinc-500 hover:text-white"
                    title="Clear due date"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1.5">
              Notes
            </p>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Context, links to discuss, sub-actions…"
              className="bg-white/[0.04] border-white/[0.08] text-white text-sm min-h-[120px]"
            />
          </div>

          {/* Attachments + links + activity log placeholder */}
          <div className="rounded-md border border-dashed border-white/[0.08] p-3 text-center">
            <p className="text-[10px] text-zinc-600 italic">
              Attachments, links, and activity log arrive in Phase 3
            </p>
          </div>

          <div className="flex gap-2 pt-1">
            <Button
              variant="ghost"
              onClick={onClose}
              className="flex-1 text-zinc-400 hover:text-white"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !title.trim()}
              className="flex-1 text-white font-semibold disabled:opacity-50"
              style={{ background: accent }}
            >
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
