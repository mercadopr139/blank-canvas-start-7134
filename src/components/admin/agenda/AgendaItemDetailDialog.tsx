// Detail panel — opens when you click an item title in the tree.
// Hosts the editable core (title / status / owners / due / notes),
// plus the per-item attachments, links, and activity log sections
// added in Phase 3b.
//
// Notes that show up nowhere else:
//   - Attachment download uses a JS blob-fetch (not <a download>) so
//     cross-origin Supabase URLs actually save instead of opening in
//     a new tab. Same trick the Message Board uses.
//   - Activity log writes are fire-and-forget (see activityLog.ts);
//     a failed log entry never blocks the user-facing mutation.
//   - Section queries are scoped per-item via React Query keys so
//     opening a different item gets a fresh fetch and stale data
//     never bleeds across items.

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
import {
  Calendar,
  X,
  Paperclip,
  FileText,
  File as FileIcon,
  Download,
  Link as LinkIcon,
  Plus,
  Trash2,
  Loader2,
  Activity,
  ExternalLink,
  Send,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { OwnerPicker } from "./OwnerPicker";
import { PILLAR_COLOR, PILLAR_LABEL } from "@/pages/admin/AdminMessageBoard";
import {
  STATUS_LABEL,
  type AgendaItemWithChildren,
  type AgendaStatus,
  type StaffOption,
} from "./types";
import { logAgendaActivity, type AgendaActivityRow } from "./activityLog";
import { pushAgendaItemToWorkbench } from "./workbench-sync";
import { Checkbox } from "@/components/ui/checkbox";

// ──────────────────────────── helpers ────────────────────────────

const formatBytes = (b: number): string => {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
};

const safeFilename = (name: string): string =>
  name.replace(/[^\w.\-]+/g, "_").slice(0, 200);

const ALLOWED_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
]);

const triggerBlobDownload = async (url: string, filename: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed (${res.status})`);
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
};

const renderActivity = (row: AgendaActivityRow, staff: StaffOption[]): string => {
  const who = row.user_id
    ? staff.find((s) => s.user_id === row.user_id)?.full_name ?? "Someone"
    : "Someone";
  const fields = row.changed_fields as Record<string, unknown>;
  switch (row.action) {
    case "created":
      return `${who} created this item`;
    case "archived":
      return `${who} archived this item`;
    case "restored":
      return `${who} restored this item`;
    case "attachment_added":
      return `${who} added attachment "${fields.filename ?? "file"}"`;
    case "attachment_removed":
      return `${who} removed attachment "${fields.filename ?? "file"}"`;
    case "link_added":
      return `${who} added link "${fields.nickname ?? fields.url ?? "link"}"`;
    case "link_removed":
      return `${who} removed a link`;
    case "updated": {
      const parts: string[] = [];
      if ("title" in fields) parts.push(`title to "${fields.title}"`);
      if ("status" in fields) parts.push(`status to ${fields.status}`);
      if ("due_date" in fields) parts.push(`due date to ${fields.due_date ?? "none"}`);
      if ("owner_user_ids" in fields) {
        const ids = (fields.owner_user_ids as string[]) || [];
        const names = ids
          .map((id) => staff.find((s) => s.user_id === id)?.full_name)
          .filter(Boolean)
          .join(", ");
        parts.push(ids.length === 0 ? "owners (cleared)" : `owners to ${names}`);
      }
      if ("notes" in fields) parts.push("notes");
      return parts.length === 0
        ? `${who} updated this item`
        : `${who} changed ${parts.join(", ")}`;
    }
    default:
      return `${who} did something`;
  }
};

// ──────────────────────── Attachments section ────────────────────────

interface AgendaAttachmentRow {
  id: string;
  storage_path: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
  uploaded_at: string;
}

const AttachmentsSection = ({
  itemId,
}: {
  itemId: string;
}) => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [uploading, setUploading] = useState(false);

  const { data: attachments = [] } = useQuery<AgendaAttachmentRow[]>({
    queryKey: ["agenda-attachments", itemId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agenda_attachments" as any)
        .select("*")
        .eq("item_id", itemId)
        .order("uploaded_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as AgendaAttachmentRow[];
    },
  });

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    let successCount = 0;
    let failCount = 0;
    for (const file of Array.from(files)) {
      if (!ALLOWED_TYPES.has(file.type)) {
        toast.error(`${file.name}: only PDF, PNG, JPG allowed`);
        failCount++;
        continue;
      }
      try {
        const ext = file.name.match(/\.[^.]+$/)?.[0] ?? "";
        const path = `${itemId}/${crypto.randomUUID()}-${safeFilename(file.name)}${ext && !safeFilename(file.name).endsWith(ext) ? ext : ""}`;
        const { error: upErr } = await supabase.storage
          .from("agenda-attachments")
          .upload(path, file, {
            contentType: file.type,
            upsert: false,
          });
        if (upErr) throw upErr;
        const { error: dbErr } = await supabase
          .from("agenda_attachments" as any)
          .insert({
            item_id: itemId,
            storage_path: path,
            filename: file.name,
            mime_type: file.type,
            size_bytes: file.size,
            uploaded_by: user?.id ?? null,
          } as any);
        if (dbErr) throw dbErr;
        void logAgendaActivity(itemId, "attachment_added", user?.id ?? null, {
          filename: file.name,
        });
        successCount++;
      } catch (e: any) {
        toast.error(`${file.name}: ${e.message ?? "upload failed"}`);
        failCount++;
      }
    }
    setUploading(false);
    if (successCount > 0) {
      qc.invalidateQueries({ queryKey: ["agenda-attachments", itemId] });
      qc.invalidateQueries({ queryKey: ["agenda-attachment-summary"] });
      qc.invalidateQueries({ queryKey: ["agenda-activity", itemId] });
      toast.success(`Uploaded ${successCount} file${successCount === 1 ? "" : "s"}`);
    }
  };

  const handleDelete = async (att: AgendaAttachmentRow) => {
    try {
      // Remove the bucket object first; DB row would orphan it otherwise.
      await supabase.storage.from("agenda-attachments").remove([att.storage_path]);
      const { error } = await supabase
        .from("agenda_attachments" as any)
        .delete()
        .eq("id", att.id);
      if (error) throw error;
      void logAgendaActivity(itemId, "attachment_removed", user?.id ?? null, {
        filename: att.filename,
      });
      qc.invalidateQueries({ queryKey: ["agenda-attachments", itemId] });
      qc.invalidateQueries({ queryKey: ["agenda-attachment-summary"] });
      qc.invalidateQueries({ queryKey: ["agenda-activity", itemId] });
      toast.success("Attachment removed");
    } catch (e: any) {
      toast.error(e.message ?? "Delete failed");
    }
  };

  const handleDownload = async (att: AgendaAttachmentRow) => {
    try {
      const { data, error } = await supabase.storage
        .from("agenda-attachments")
        .createSignedUrl(att.storage_path, 60 * 60);
      if (error || !data?.signedUrl) throw error ?? new Error("Could not sign URL");
      await triggerBlobDownload(data.signedUrl, att.filename);
    } catch (e: any) {
      toast.error(e.message ?? "Download failed");
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
          <Paperclip className="w-3 h-3" />
          Attachments
        </p>
        <label className="cursor-pointer text-[10px] font-semibold text-zinc-400 hover:text-white transition-colors flex items-center gap-1">
          {uploading ? (
            <>
              <Loader2 className="w-3 h-3 animate-spin" />
              Uploading…
            </>
          ) : (
            <>
              <Plus className="w-3 h-3" />
              Upload
            </>
          )}
          <input
            type="file"
            multiple
            accept=".pdf,image/png,image/jpeg,image/jpg"
            className="hidden"
            disabled={uploading}
            onChange={(e) => {
              handleUpload(e.target.files);
              e.target.value = ""; // allow re-selecting same file
            }}
          />
        </label>
      </div>
      {attachments.length === 0 ? (
        <p className="text-xs text-zinc-600 italic">No attachments yet.</p>
      ) : (
        <div className="space-y-1">
          {attachments.map((att) => {
            const Icon = att.mime_type === "application/pdf" ? FileText : FileIcon;
            return (
              <div
                key={att.id}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-white/[0.03] border border-white/[0.06] group/att"
              >
                <Icon className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                <button
                  type="button"
                  onClick={() => handleDownload(att)}
                  className="flex-1 min-w-0 text-left text-xs text-white truncate hover:underline"
                  title={`Download ${att.filename}`}
                >
                  {att.filename}
                </button>
                <span className="text-[10px] text-zinc-600 shrink-0">{formatBytes(att.size_bytes)}</span>
                <button
                  type="button"
                  onClick={() => handleDownload(att)}
                  className="shrink-0 p-1 text-zinc-500 hover:text-white opacity-0 group-hover/att:opacity-100 transition-opacity"
                  title="Download"
                >
                  <Download className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(att)}
                  className="shrink-0 p-1 text-zinc-500 hover:text-red-400 opacity-0 group-hover/att:opacity-100 transition-opacity"
                  title="Remove attachment"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ──────────────────────────── Links section ────────────────────────────

interface AgendaLinkRow {
  id: string;
  url: string;
  nickname: string | null;
  sort_order: number;
  created_at: string;
}

const LinksSection = ({ itemId }: { itemId: string }) => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [draftUrl, setDraftUrl] = useState("");
  const [draftNickname, setDraftNickname] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: links = [] } = useQuery<AgendaLinkRow[]>({
    queryKey: ["agenda-links", itemId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agenda_item_links" as any)
        .select("*")
        .eq("item_id", itemId)
        .order("sort_order");
      if (error) throw error;
      return (data || []) as unknown as AgendaLinkRow[];
    },
  });

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = draftUrl.trim();
    if (!url) return;
    setSaving(true);
    try {
      // Auto-prefix protocol so naked domains still open correctly.
      const finalUrl = /^https?:\/\//i.test(url) ? url : `https://${url}`;
      const { error } = await supabase
        .from("agenda_item_links" as any)
        .insert({
          item_id: itemId,
          url: finalUrl,
          nickname: draftNickname.trim() || null,
          sort_order: Date.now(),
          created_by: user?.id ?? null,
        } as any);
      if (error) throw error;
      void logAgendaActivity(itemId, "link_added", user?.id ?? null, {
        url: finalUrl,
        nickname: draftNickname.trim() || null,
      });
      qc.invalidateQueries({ queryKey: ["agenda-links", itemId] });
      qc.invalidateQueries({ queryKey: ["agenda-link-summary"] });
      qc.invalidateQueries({ queryKey: ["agenda-activity", itemId] });
      setDraftUrl("");
      setDraftNickname("");
      setAdding(false);
    } catch (e: any) {
      toast.error(e.message ?? "Add failed");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (link: AgendaLinkRow) => {
    try {
      const { error } = await supabase
        .from("agenda_item_links" as any)
        .delete()
        .eq("id", link.id);
      if (error) throw error;
      void logAgendaActivity(itemId, "link_removed", user?.id ?? null);
      qc.invalidateQueries({ queryKey: ["agenda-links", itemId] });
      qc.invalidateQueries({ queryKey: ["agenda-link-summary"] });
      qc.invalidateQueries({ queryKey: ["agenda-activity", itemId] });
    } catch (e: any) {
      toast.error(e.message ?? "Delete failed");
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
          <LinkIcon className="w-3 h-3" />
          Links
        </p>
        {!adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="text-[10px] font-semibold text-zinc-400 hover:text-white transition-colors flex items-center gap-1"
          >
            <Plus className="w-3 h-3" />
            Add
          </button>
        )}
      </div>

      {adding && (
        <form onSubmit={handleAdd} className="mb-2 p-2 rounded-md bg-white/[0.03] border border-white/[0.08] space-y-1.5">
          <Input
            autoFocus
            value={draftNickname}
            onChange={(e) => setDraftNickname(e.target.value)}
            placeholder="Nickname (optional, e.g. 'Practice plan doc')"
            className="bg-white/[0.04] border-white/[0.08] text-white text-xs h-7"
          />
          <Input
            value={draftUrl}
            onChange={(e) => setDraftUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setAdding(false);
                setDraftUrl("");
                setDraftNickname("");
              }
            }}
            placeholder="https://…"
            className="bg-white/[0.04] border-white/[0.08] text-white text-xs h-7"
          />
          <div className="flex items-center gap-2">
            <Button
              type="submit"
              disabled={!draftUrl.trim() || saving}
              className="h-6 text-[10px] px-2 bg-white/10 hover:bg-white/20 text-white"
            >
              {saving ? "…" : "Add link"}
            </Button>
            <button
              type="button"
              onClick={() => {
                setAdding(false);
                setDraftUrl("");
                setDraftNickname("");
              }}
              className="text-[10px] text-white/40 hover:text-white/70"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {links.length === 0 && !adding ? (
        <p className="text-xs text-zinc-600 italic">No links yet.</p>
      ) : (
        <div className="space-y-1">
          {links.map((link) => (
            <div
              key={link.id}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-white/[0.03] border border-white/[0.06] group/link"
            >
              <LinkIcon className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 min-w-0 text-xs text-white truncate hover:underline flex items-center gap-1.5"
                title={link.url}
              >
                <span className="truncate">{link.nickname?.trim() || link.url}</span>
                <ExternalLink className="w-3 h-3 text-zinc-500 shrink-0" />
              </a>
              <button
                type="button"
                onClick={() => handleDelete(link)}
                className="shrink-0 p-1 text-zinc-500 hover:text-red-400 opacity-0 group-hover/link:opacity-100 transition-opacity"
                title="Remove link"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ──────────────────────────── Activity section ────────────────────────────

const ActivitySection = ({
  itemId,
  staff,
}: {
  itemId: string;
  staff: StaffOption[];
}) => {
  const { data: events = [] } = useQuery<AgendaActivityRow[]>({
    queryKey: ["agenda-activity", itemId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agenda_activity_log" as any)
        .select("*")
        .eq("item_id", itemId)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data || []) as unknown as AgendaActivityRow[];
    },
  });

  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2 flex items-center gap-1.5">
        <Activity className="w-3 h-3" />
        Activity
      </p>
      {events.length === 0 ? (
        <p className="text-xs text-zinc-600 italic">No activity yet.</p>
      ) : (
        <ul className="space-y-1.5">
          {events.map((row) => (
            <li key={row.id} className="text-xs text-zinc-400 leading-relaxed">
              <span className="text-zinc-200">{renderActivity(row, staff)}</span>
              <span className="text-zinc-600 ml-1.5">
                · {formatDistanceToNow(new Date(row.created_at), { addSuffix: true })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

// ──────────────────────────── Main dialog ────────────────────────────

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
    owner_user_ids?: string[];
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
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [dueDate, setDueDate] = useState<string>("");
  const [status, setStatus] = useState<AgendaStatus>("signal");
  const [ownerUserIds, setOwnerUserIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // Workbench-send chooser. Map<userId, focusAreaId>. Entry present
  // means "send to this user"; value is which focus area on their
  // Workbench the signal should land in. Empty string = not chosen.
  const [pushOpen, setPushOpen] = useState(false);
  const [pushSelections, setPushSelections] = useState<Map<string, string>>(new Map());
  const [pushing, setPushing] = useState(false);

  // Focus areas across all manager_types — small table, one query.
  // Filtered client-side per owner in the chooser. Only fetched while
  // the chooser is open.
  const { data: focusAreas = [] } = useQuery<{
    id: string;
    title: string;
    manager_type: string | null;
  }[]>({
    queryKey: ["agenda-focus-areas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("focus_areas")
        .select("id, title, manager_type")
        .order("sort_order");
      if (error) throw error;
      return data || [];
    },
    enabled: pushOpen,
  });

  useEffect(() => {
    if (!item) return;
    setTitle(item.title);
    setNotes(item.notes ?? "");
    setDueDate(item.due_date ?? "");
    setStatus(item.status);
    setOwnerUserIds(item.owner_user_ids ?? []);
  }, [item?.id]);

  if (!item) return null;

  const accent = PILLAR_COLOR[item.pillar];

  const handleSave = async () => {
    const patch: Parameters<typeof onSave>[0] = {};
    if (title.trim() !== item.title) patch.title = title.trim();
    if ((notes || null) !== (item.notes || null)) patch.notes = notes.trim() || null;
    if ((dueDate || null) !== (item.due_date || null)) patch.due_date = dueDate || null;
    if (status !== item.status) patch.status = status;
    const sameOwners =
      ownerUserIds.length === (item.owner_user_ids?.length ?? 0) &&
      ownerUserIds.every((u) => item.owner_user_ids?.includes(u));
    if (!sameOwners) patch.owner_user_ids = ownerUserIds;
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
      <DialogContent className="bg-neutral-900 border-white/10 text-white max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <span
              className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded"
              style={{ background: `${accent}18`, color: accent }}
            >
              {PILLAR_LABEL[item.pillar]}
            </span>
            <span className="text-[10px] text-zinc-600">Level {item.depth}</span>
          </div>
          <DialogTitle className="sr-only">Edit agenda item</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 mt-2">
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

          {/* Owners + due date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1.5">
                Owners
              </p>
              <OwnerPicker
                ownerUserIds={ownerUserIds}
                staff={staff}
                onChange={setOwnerUserIds}
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

          {/* Push to Workbench — Phase 4. Disabled with a hint when
              there are no owners to send to. */}
          <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-white">Send to Workbench</p>
              <p className="text-[11px] text-zinc-500 leading-snug">
                {ownerUserIds.length === 0
                  ? "Assign an owner first to push this item to their Workbench."
                  : `Push this item into ${ownerUserIds.length === 1 ? "the owner's" : "selected owners'"} Workbench. Status syncs both ways.`}
              </p>
            </div>
            <Button
              type="button"
              disabled={ownerUserIds.length === 0}
              onClick={() => {
                // Pre-check every owner with no focus area chosen yet.
                const seeded = new Map<string, string>();
                for (const uid of ownerUserIds) seeded.set(uid, "");
                setPushSelections(seeded);
                setPushOpen(true);
              }}
              className="bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 text-xs h-8 gap-1.5 shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
              Send
            </Button>
          </div>

          {/* Attachments — Phase 3b */}
          <AttachmentsSection itemId={item.id} />

          {/* Links — Phase 3b */}
          <LinksSection itemId={item.id} />

          {/* Activity log — Phase 3b */}
          <ActivitySection itemId={item.id} staff={staff} />

          <div className="flex gap-2 pt-1 sticky bottom-0 bg-neutral-900 pb-2">
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

        {/* Workbench-target chooser — pick which owners receive the
            push AND which focus area on each of their Workbenches it
            lands in. The dialog stays open until you confirm. */}
        <Dialog open={pushOpen} onOpenChange={(o) => { if (!o) setPushOpen(false); }}>
          <DialogContent className="bg-neutral-900 border-white/10 text-white max-w-md">
            <DialogHeader>
              <DialogTitle className="text-white text-base font-semibold">
                Send to Workbench
              </DialogTitle>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Pick a focus area on each owner's Workbench to send this
                item to. Marking it Done in either place syncs to the other.
              </p>
            </DialogHeader>
            <div className="space-y-2 my-3 max-h-72 overflow-y-auto">
              {ownerUserIds.length === 0 ? (
                <p className="text-xs text-zinc-500 italic text-center py-4">
                  No owners assigned.
                </p>
              ) : (
                ownerUserIds.map((uid) => {
                  const profile = staff.find((s) => s.user_id === uid);
                  const checked = pushSelections.has(uid);
                  const chosenFa = pushSelections.get(uid) ?? "";
                  const userFocusAreas = profile?.task_manager_type
                    ? focusAreas.filter((fa) => fa.manager_type === profile.task_manager_type)
                    : [];
                  const noWorkbench = !profile?.task_manager_type;
                  return (
                    <div
                      key={uid}
                      className={`rounded-md transition-colors ${
                        checked ? "bg-white/[0.04]" : ""
                      }`}
                    >
                      <button
                        type="button"
                        disabled={noWorkbench}
                        onClick={() => {
                          setPushSelections((prev) => {
                            const next = new Map(prev);
                            if (next.has(uid)) next.delete(uid);
                            else next.set(uid, "");
                            return next;
                          });
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2 hover:bg-white/[0.04] disabled:opacity-50 disabled:cursor-not-allowed text-left"
                      >
                        <Checkbox checked={checked} className="border-white/30" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white truncate">
                            {profile?.full_name ?? "Unknown user"}
                          </p>
                          <p className="text-[10px] text-zinc-500 truncate">
                            {noWorkbench
                              ? "No Workbench — can't receive items"
                              : profile?.job_title || profile?.task_manager_type}
                          </p>
                        </div>
                      </button>
                      {checked && !noWorkbench && (
                        <div className="px-3 pb-2 pl-12">
                          <label className="text-[10px] uppercase tracking-wider text-zinc-500">
                            Send to focus area
                          </label>
                          <select
                            value={chosenFa}
                            onChange={(e) =>
                              setPushSelections((prev) => {
                                const next = new Map(prev);
                                next.set(uid, e.target.value);
                                return next;
                              })
                            }
                            className="w-full mt-1 bg-white/[0.04] border border-white/[0.08] rounded-md text-xs text-white py-1.5 px-2 focus:outline-none focus:border-white/20"
                          >
                            <option value="" disabled>
                              Pick a tile…
                            </option>
                            {userFocusAreas.map((fa) => (
                              <option key={fa.id} value={fa.id}>
                                {fa.title}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
            <p className="text-[10px] text-zinc-600 leading-relaxed">
              Already-pushed items won't be duplicated.
            </p>
            <div className="flex gap-2 pt-2">
              <Button
                variant="ghost"
                onClick={() => setPushOpen(false)}
                className="flex-1 text-zinc-400 hover:text-white"
              >
                Cancel
              </Button>
              <Button
                disabled={
                  pushing ||
                  pushSelections.size === 0 ||
                  Array.from(pushSelections.values()).some((v) => !v) ||
                  !item
                }
                onClick={async () => {
                  if (!item) return;
                  setPushing(true);
                  try {
                    const targets = Array.from(pushSelections.entries())
                      .filter(([, faId]) => !!faId)
                      .map(([userId, focusAreaId]) => ({ userId, focusAreaId }));
                    const res = await pushAgendaItemToWorkbench({
                      agendaItemId: item.id,
                      title: title.trim() || item.title,
                      notes: notes.trim() || null,
                      pillar: item.pillar,
                      status,
                      targets,
                    });
                    const parts: string[] = [];
                    if (res.inserted > 0) parts.push(`${res.inserted} sent`);
                    if (res.alreadyPresent > 0) parts.push(`${res.alreadyPresent} already there`);
                    if (res.noWorkbench > 0) parts.push(`${res.noWorkbench} skipped (no Workbench)`);
                    if (res.failed > 0) parts.push(`${res.failed} failed`);
                    toast.success(parts.join(" · ") || "Sent");
                    void logAgendaActivity(item.id, "updated", user?.id ?? null, {
                      pushed_to_workbench: targets.map((t) => t.userId),
                    });
                    setPushOpen(false);
                  } catch (e: any) {
                    toast.error(e.message ?? "Send failed");
                  } finally {
                    setPushing(false);
                  }
                }}
                className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-black font-semibold disabled:opacity-50"
              >
                {pushing
                  ? "Sending…"
                  : `Send (${Array.from(pushSelections.values()).filter((v) => !!v).length})`}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
};
