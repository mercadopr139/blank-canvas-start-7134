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
  Paperclip,
  FileText,
  File as FileIcon,
  Download,
  Link as LinkIcon,
  Plus,
  Trash2,
  Loader2,
  ExternalLink,
  CheckCircle2,
  Circle,
  StickyNote,
  Pencil,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { PILLAR_COLOR, PILLAR_LABEL } from "@/pages/admin/AdminMessageBoard";
import {
  STATUS_LABEL,
  isParentTaskComplete,
  type AgendaItemWithChildren,
  type AgendaStatus,
  type StaffOption,
} from "./types";
import { logAgendaActivity } from "./activityLog";
import { displayNameFor } from "@/lib/staff";

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

// Activity log rendering pulled — the section was removed from the
// dialog so the helper has no remaining call sites. logAgendaActivity
// still writes events to the DB in case we ever bring the section
// back, but no UI reads them today.

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
        <label className="cursor-pointer text-xs font-semibold text-[#bf0f3e] hover:text-[#d11447] transition-colors flex items-center gap-1">
          {uploading ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Uploading…
            </>
          ) : (
            <>
              <Plus className="w-3.5 h-3.5" />
              Upload file
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
            className="text-xs font-semibold text-[#bf0f3e] hover:text-[#d11447] transition-colors flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            Add link
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
          {/* Primary action — NLA red, full-size button so it can't be
              missed. Without this Save will dismiss the dialog without
              persisting the typed URL, which previously caught users out. */}
          <div className="flex items-center gap-2">
            <Button
              type="submit"
              disabled={!draftUrl.trim() || saving}
              className="h-8 text-xs px-3 bg-[#bf0f3e] hover:bg-[#d11447] text-white font-semibold disabled:opacity-40"
            >
              {saving ? "Adding…" : "Add link"}
            </Button>
            <button
              type="button"
              onClick={() => {
                setAdding(false);
                setDraftUrl("");
                setDraftNickname("");
              }}
              className="text-xs text-white/50 hover:text-white/80"
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

// ──────────────────────────── Notes section ────────────────────────────
// Threaded log of notes per agenda item — replaces the old single-blob
// `notes` column. Notes show oldest-first so the log reads as a
// chronological journal of context. Hovering a note reveals Edit and
// Delete; delete prompts a confirm before removing the entry.

interface AgendaNoteRow {
  id: string;
  content: string;
  created_at: string;
  created_by: string | null;
  updated_at: string;
}

const NotesSection = ({
  itemId,
  staff,
}: {
  itemId: string;
  staff: StaffOption[];
}) => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleteCandidate, setDeleteCandidate] = useState<AgendaNoteRow | null>(null);

  const { data: notes = [] } = useQuery<AgendaNoteRow[]>({
    queryKey: ["agenda-notes", itemId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agenda_item_notes" as any)
        .select("*")
        .eq("item_id", itemId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as AgendaNoteRow[];
    },
  });

  const handleAdd = async () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    setAdding(true);
    try {
      const { error } = await supabase
        .from("agenda_item_notes" as any)
        .insert({
          item_id: itemId,
          content: trimmed,
          created_by: user?.id ?? null,
        } as any);
      if (error) throw error;
      void logAgendaActivity(itemId, "updated", user?.id ?? null, {
        note_added: true,
      });
      qc.invalidateQueries({ queryKey: ["agenda-notes", itemId] });
      qc.invalidateQueries({ queryKey: ["agenda-notes-summary"] });
      qc.invalidateQueries({ queryKey: ["agenda-activity", itemId] });
      setDraft("");
    } catch (e: any) {
      toast.error(e?.message ?? "Add note failed");
    } finally {
      setAdding(false);
    }
  };

  const startEdit = (note: AgendaNoteRow) => {
    setEditingId(note.id);
    setEditDraft(note.content);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft("");
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const trimmed = editDraft.trim();
    if (!trimmed) return;
    setSavingEdit(true);
    try {
      const { error } = await supabase
        .from("agenda_item_notes" as any)
        .update({ content: trimmed, updated_at: new Date().toISOString() } as any)
        .eq("id", editingId);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["agenda-notes", itemId] });
      cancelEdit();
    } catch (e: any) {
      toast.error(e?.message ?? "Edit failed");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleConfirmedDelete = async () => {
    if (!deleteCandidate) return;
    try {
      const { error } = await supabase
        .from("agenda_item_notes" as any)
        .delete()
        .eq("id", deleteCandidate.id);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["agenda-notes", itemId] });
      qc.invalidateQueries({ queryKey: ["agenda-notes-summary"] });
      setDeleteCandidate(null);
      toast.success("Note deleted");
    } catch (e: any) {
      toast.error(e?.message ?? "Delete failed");
    }
  };

  const authorName = (uid: string | null): string => {
    if (!uid) return "Someone";
    const s = staff.find((x) => x.user_id === uid);
    return s ? displayNameFor(s) : "Someone";
  };

  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2 flex items-center gap-1.5">
        <StickyNote className="w-3 h-3" />
        Notes
      </p>

      {notes.length === 0 ? (
        <p className="text-xs text-zinc-600 italic mb-3">No notes yet.</p>
      ) : (
        <ul className="space-y-2 mb-3">
          {notes.map((note) => {
            const isEditing = editingId === note.id;
            const edited =
              note.updated_at && note.updated_at !== note.created_at;
            return (
              <li
                key={note.id}
                className="bg-white/[0.03] border border-white/[0.06] rounded-md px-3 py-2 group/note"
              >
                {isEditing ? (
                  <div>
                    <Textarea
                      autoFocus
                      value={editDraft}
                      onChange={(e) => setEditDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Escape") cancelEdit();
                        if (
                          e.key === "Enter" &&
                          (e.metaKey || e.ctrlKey)
                        ) {
                          e.preventDefault();
                          saveEdit();
                        }
                      }}
                      className="bg-white/[0.04] border-white/[0.08] text-white text-sm min-h-[80px]"
                    />
                    <div className="flex justify-end items-center gap-2 mt-2">
                      <button
                        type="button"
                        onClick={cancelEdit}
                        className="text-[10px] text-zinc-400 hover:text-white px-2"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={saveEdit}
                        disabled={!editDraft.trim() || savingEdit}
                        className="text-[10px] font-semibold px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-white disabled:opacity-40"
                      >
                        {savingEdit ? "Saving…" : "Save"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-xs text-zinc-200 whitespace-pre-wrap leading-relaxed">
                      {note.content}
                    </p>
                    <div className="flex items-center justify-between mt-1.5 gap-2">
                      <span className="text-[10px] text-zinc-500 truncate">
                        {authorName(note.created_by)} ·{" "}
                        {formatDistanceToNow(new Date(note.created_at), {
                          addSuffix: true,
                        })}
                        {edited && (
                          <span className="text-zinc-600"> · edited</span>
                        )}
                      </span>
                      <div className="flex items-center gap-2 opacity-0 group-hover/note:opacity-100 focus-within:opacity-100 transition-opacity shrink-0">
                        <button
                          type="button"
                          onClick={() => startEdit(note)}
                          className="flex items-center gap-1 text-[10px] text-zinc-400 hover:text-white"
                          title="Edit note"
                        >
                          <Pencil className="w-3 h-3" />
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteCandidate(note)}
                          className="flex items-center gap-1 text-[10px] text-zinc-400 hover:text-red-400"
                          title="Delete note"
                        >
                          <Trash2 className="w-3 h-3" />
                          Delete
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* Add new note */}
      <div>
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              handleAdd();
            }
          }}
          placeholder="Add a note — context, decisions, what changed this week…"
          className="bg-white/[0.04] border-white/[0.08] text-white text-sm min-h-[80px]"
        />
        <div className="flex items-center justify-between gap-2 mt-2">
          <span className="text-[10px] text-zinc-600">⌘/Ctrl + Enter to add</span>
          <Button
            type="button"
            disabled={!draft.trim() || adding}
            onClick={handleAdd}
            className="h-7 text-[11px] bg-white/10 hover:bg-white/20 text-white gap-1"
          >
            <Plus className="w-3 h-3" />
            {adding ? "Adding…" : "Add note"}
          </Button>
        </div>
      </div>

      <AlertDialog
        open={!!deleteCandidate}
        onOpenChange={(o) => {
          if (!o) setDeleteCandidate(null);
        }}
      >
        <AlertDialogContent className="bg-neutral-900 border-white/10 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">
              Delete this note?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              This permanently removes the entry from the log. Can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-white/[0.04] border-white/10 text-white hover:bg-white/10">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-500 hover:bg-red-600 text-white"
              onClick={handleConfirmedDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

// Activity section dropped from the dialog — the threaded NotesSection
// covers the "what happened, when" story at a much better signal-to-
// noise ratio. agenda_activity_log writes still happen passively so
// the data accumulates if we ever bring the section back.

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

const STATUS_OPTIONS: AgendaStatus[] = ["pending_review", "reviewed"];

export const AgendaItemDetailDialog = ({
  item,
  staff,
  open,
  onClose,
  onSave,
}: Props) => {
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<AgendaStatus>("pending_review");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!item) return;
    setTitle(item.title);
    setStatus(item.status);
  }, [item?.id]);

  if (!item) return null;

  const accent = PILLAR_COLOR[item.pillar];
  // L1 (Agenda Topic) is a pure container — only its title is editable
  // in the detail dialog. Status/Due/Notes/Send to Workbench/files/links
  // belong on the tasks underneath, not on the topic shell itself.
  const isTopic = item.depth === 1;

  // Save handles just title + status. Notes are managed inline by the
  // NotesSection (per-entry CRUD via its own table). The agenda_items
  // `due_date` and `notes` columns stay in the DB for legacy data but
  // the dialog no longer writes to them.
  const handleSave = async () => {
    const patch: Parameters<typeof onSave>[0] = {};
    if (title.trim() !== item.title) patch.title = title.trim();
    if (status !== item.status) patch.status = status;
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
            <span className="text-[10px] text-zinc-600">
              {item.depth === 1 ? "Agenda Topic" : "Task"}
            </span>
          </div>
          <DialogTitle className="sr-only">Edit agenda item</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 mt-2">
          {/* Title — large inline edit. For topics this is the only field. */}
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={isTopic ? "Agenda topic title" : "Task title"}
            className="bg-white/[0.04] border-white/[0.08] text-white text-base font-semibold h-10"
          />

          {/* Everything below is task-only. Agenda Topics are containers —
              their status, due, files, etc. live on the tasks underneath. */}
          {!isTopic && (
            <>
              {/* Status — segmented control for leaf tasks; read-only auto-
                  derived badge for parent tasks (those with sub-tasks). */}
              <div>
                <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1.5">
                  Status
                </p>
                {item.children.length > 0 ? (
                  (() => {
                    const complete = isParentTaskComplete(item);
                    return (
                      <div className="space-y-1.5">
                        <div
                          className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md border text-sm font-semibold ${
                            complete
                              ? "bg-green-600 text-white border-green-500 shadow-sm shadow-green-900/40"
                              : "bg-white/[0.04] text-zinc-300 border-white/[0.10]"
                          }`}
                        >
                          {complete ? (
                            <CheckCircle2 className="w-4 h-4" />
                          ) : (
                            <Circle className="w-4 h-4" />
                          )}
                          {complete ? "Complete" : "Incomplete"}
                        </div>
                        <p className="text-[10px] text-zinc-500 leading-snug">
                          Auto-derived. Flips to Complete only when every
                          sub-task in this branch has been Reviewed.
                        </p>
                      </div>
                    );
                  })()
                ) : (
                  <div className="flex gap-1.5">
                    {STATUS_OPTIONS.map((s) => {
                      const active = status === s;
                      const activeClass =
                        s === "reviewed"
                          ? "border-green-500/40 bg-green-500/15 text-green-400"
                          : "border-white/20 bg-white/[0.06] text-zinc-200";
                      return (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setStatus(s)}
                          className={`flex-1 text-xs font-semibold py-1.5 rounded-md border transition-colors ${
                            active
                              ? activeClass
                              : "border-white/[0.06] text-white/40 hover:border-white/15 hover:text-white/70"
                          }`}
                        >
                          {STATUS_LABEL[s]}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Due date dropped — agenda is the weekly cadence so the
                  date was redundant. Notes is now a threaded log (see
                  NotesSection) instead of a single Textarea. */}

              {/* Threaded notes log — oldest at top, timestamped, with
                  inline edit and confirm-to-delete. */}
              <NotesSection itemId={item.id} staff={staff} />

              {/* Attachments — Phase 3b */}
              <AttachmentsSection itemId={item.id} />

              {/* Links — Phase 3b */}
              <LinksSection itemId={item.id} />

              {/* Activity log section dropped — the notes log is the
                  audit trail you actually want to read. */}
            </>
          )}

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

      </DialogContent>
    </Dialog>
  );
};
