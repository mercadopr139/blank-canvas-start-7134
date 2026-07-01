import { useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  StickyNote, Plus, Link2, Paperclip, Pencil, Trash2, X, Check,
  ExternalLink, CircleCheck, Circle,
} from "lucide-react";

// A per-focus-area "Notes" surface: durable, detailed context that sits
// alongside — but separate from — the signals/tasks kanban. Each note has
// a title + body and can carry link attachments (Google Doc / Sheet / any
// URL) and file attachments (uploaded to the private focus-area-files
// bucket, opened via short-lived signed URLs). Notes are shared across
// everyone who can see this focus-area board and scoped by
// (managerType, focusArea), exactly like signals.

type NoteAttachment = {
  id: string;
  note_id: string;
  kind: "link" | "file";
  label: string | null;
  url: string | null;
  storage_path: string | null;
  mime_type: string | null;
};

type Note = {
  id: string;
  manager_type: string;
  focus_area: string;
  title: string | null;
  body: string;
  resolved: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  focus_area_note_attachments: NoteAttachment[];
};

const FILES_BUCKET = "focus-area-files";

// Render note text with bare URLs turned into clickable links, preserving
// line breaks. Keeps the body plain-text while still making pasted links
// usable without a full rich-text editor.
const linkifyBody = (text: string) => {
  const parts = text.split(/(https?:\/\/[^\s]+)/g);
  return parts.map((part, i) =>
    /^https?:\/\//.test(part) ? (
      <a
        key={i}
        href={part}
        target="_blank"
        rel="noreferrer"
        className="text-sky-400 underline break-all hover:text-sky-300"
        onClick={(e) => e.stopPropagation()}
      >
        {part}
      </a>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
};

const sanitizeFileName = (name: string) =>
  name.replace(/[^\w.-]+/g, "_").slice(0, 120);

// Supabase error objects aren't JS Error instances, so pull the real
// message off whatever we're handed rather than falling back to a
// generic string (which hid the actual cause, e.g. a missing table).
const errMsg = (err: unknown, fallback: string): string => {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object" && "message" in err) {
    const m = (err as { message?: unknown }).message;
    if (typeof m === "string" && m) return m;
  }
  return fallback;
};

interface Props {
  managerType: string;
  focusArea: string;
  accentHex: string;
  currentUserId: string;
}

export default function FocusAreaNotes({ managerType, focusArea, accentHex, currentUserId }: Props) {
  const queryClient = useQueryClient();
  const queryKey = ["focus-area-notes", managerType, focusArea];

  const { data: notes = [], isLoading } = useQuery<Note[]>({
    queryKey,
    queryFn: async () => {
      const { data, error } = await (supabase.from("focus_area_notes") as any)
        .select("*, focus_area_note_attachments(*)")
        .eq("manager_type", managerType)
        .eq("focus_area", focusArea)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Note[];
    },
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey });

  // ── Create / edit note ──
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftBody, setDraftBody] = useState("");
  const [saving, setSaving] = useState(false);

  const openCreate = () => {
    setEditingNote(null);
    setDraftTitle("");
    setDraftBody("");
    setEditorOpen(true);
  };
  const openEdit = (note: Note) => {
    setEditingNote(note);
    setDraftTitle(note.title ?? "");
    setDraftBody(note.body ?? "");
    setEditorOpen(true);
  };

  const saveNote = async () => {
    const body = draftBody.trim();
    const title = draftTitle.trim();
    if (!body && !title) {
      toast.error("Add a title or some text first");
      return;
    }
    setSaving(true);
    try {
      if (editingNote) {
        const { error } = await (supabase.from("focus_area_notes") as any)
          .update({ title: title || null, body })
          .eq("id", editingNote.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase.from("focus_area_notes") as any).insert({
          manager_type: managerType,
          focus_area: focusArea,
          title: title || null,
          body,
          created_by: currentUserId || null,
        });
        if (error) throw error;
      }
      setEditorOpen(false);
      refresh();
    } catch (err) {
      toast.error(errMsg(err, "Couldn't save note"));
    } finally {
      setSaving(false);
    }
  };

  const toggleResolved = async (note: Note) => {
    const { error } = await (supabase.from("focus_area_notes") as any)
      .update({ resolved: !note.resolved })
      .eq("id", note.id);
    if (error) { toast.error(error.message); return; }
    refresh();
  };

  // ── Delete note (also removes its uploaded files) ──
  const [pendingDelete, setPendingDelete] = useState<Note | null>(null);
  const confirmDeleteNote = async () => {
    if (!pendingDelete) return;
    try {
      const paths = pendingDelete.focus_area_note_attachments
        .filter((a) => a.kind === "file" && a.storage_path)
        .map((a) => a.storage_path as string);
      if (paths.length > 0) {
        await supabase.storage.from(FILES_BUCKET).remove(paths);
      }
      // Attachment rows cascade-delete with the note.
      const { error } = await (supabase.from("focus_area_notes") as any)
        .delete()
        .eq("id", pendingDelete.id);
      if (error) throw error;
      setPendingDelete(null);
      refresh();
    } catch (err) {
      toast.error(errMsg(err, "Couldn't delete note"));
    }
  };

  // ── Add link attachment ──
  const [linkNoteId, setLinkNoteId] = useState<string | null>(null);
  const [linkLabel, setLinkLabel] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const openAddLink = (noteId: string) => {
    setLinkNoteId(noteId);
    setLinkLabel("");
    setLinkUrl("");
  };
  const saveLink = async () => {
    if (!linkNoteId) return;
    let url = linkUrl.trim();
    if (!url) { toast.error("Paste a URL"); return; }
    if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
    const { error } = await (supabase.from("focus_area_note_attachments") as any).insert({
      note_id: linkNoteId,
      kind: "link",
      label: linkLabel.trim() || url,
      url,
    });
    if (error) { toast.error(error.message); return; }
    setLinkNoteId(null);
    refresh();
  };

  // ── Add file attachment ──
  const [uploadingNoteId, setUploadingNoteId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileTargetNoteId = useRef<string | null>(null);

  const pickFile = (noteId: string) => {
    fileTargetNoteId.current = noteId;
    fileInputRef.current?.click();
  };
  const onFileChosen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const noteId = fileTargetNoteId.current;
    e.target.value = ""; // allow re-picking the same file later
    if (!file || !noteId) return;
    setUploadingNoteId(noteId);
    try {
      const path = `${managerType}/${focusArea}/${noteId}/${crypto.randomUUID()}-${sanitizeFileName(file.name)}`;
      const { error: upErr } = await supabase.storage.from(FILES_BUCKET).upload(path, file);
      if (upErr) throw upErr;
      const { error } = await (supabase.from("focus_area_note_attachments") as any).insert({
        note_id: noteId,
        kind: "file",
        label: file.name,
        storage_path: path,
        mime_type: file.type || null,
      });
      if (error) throw error;
      refresh();
    } catch (err) {
      toast.error(errMsg(err, "Upload failed"));
    } finally {
      setUploadingNoteId(null);
    }
  };

  const openFile = async (att: NoteAttachment) => {
    if (!att.storage_path) return;
    const { data, error } = await supabase.storage
      .from(FILES_BUCKET)
      .createSignedUrl(att.storage_path, 60);
    if (error || !data?.signedUrl) {
      toast.error("Couldn't open file");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener");
  };

  const removeAttachment = async (att: NoteAttachment) => {
    try {
      if (att.kind === "file" && att.storage_path) {
        await supabase.storage.from(FILES_BUCKET).remove([att.storage_path]);
      }
      const { error } = await (supabase.from("focus_area_note_attachments") as any)
        .delete()
        .eq("id", att.id);
      if (error) throw error;
      refresh();
    } catch (err) {
      toast.error(errMsg(err, "Couldn't remove attachment"));
    }
  };

  const activeNotes = notes.filter((n) => !n.resolved);
  const resolvedNotes = notes.filter((n) => n.resolved);

  const renderNote = (note: Note) => {
    const atts = note.focus_area_note_attachments || [];
    return (
      <div
        key={note.id}
        className={`rounded-xl border bg-white/[0.02] p-4 transition-colors ${
          note.resolved ? "border-white/[0.05] opacity-60" : "border-white/[0.08]"
        }`}
        style={note.resolved ? undefined : { borderLeft: `3px solid ${accentHex}` }}
      >
        <div className="flex items-start gap-2">
          <button
            onClick={() => toggleResolved(note)}
            className="mt-0.5 text-zinc-500 hover:text-emerald-400 transition-colors shrink-0"
            title={note.resolved ? "Mark as not done" : "Mark as done"}
          >
            {note.resolved ? (
              <CircleCheck className="w-4 h-4 text-emerald-400" />
            ) : (
              <Circle className="w-4 h-4" />
            )}
          </button>

          <div className="flex-1 min-w-0">
            {note.title && (
              <h4 className={`text-sm font-semibold ${note.resolved ? "text-zinc-500 line-through" : "text-zinc-100"}`}>
                {note.title}
              </h4>
            )}
            {note.body && (
              <p className={`text-sm whitespace-pre-wrap break-words mt-0.5 ${note.resolved ? "text-zinc-600" : "text-zinc-400"}`}>
                {linkifyBody(note.body)}
              </p>
            )}

            {/* Attachment chips */}
            {atts.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {atts.map((att) => (
                  <span
                    key={att.id}
                    className="group/att inline-flex items-center gap-1.5 pl-2 pr-1 py-1 rounded-md bg-white/[0.04] border border-white/[0.08] text-xs text-zinc-300 max-w-[240px]"
                  >
                    {att.kind === "link" ? (
                      <a
                        href={att.url ?? "#"}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 min-w-0 hover:text-white"
                        title={att.url ?? undefined}
                      >
                        <Link2 className="w-3.5 h-3.5 shrink-0 text-sky-400" />
                        <span className="truncate">{att.label || att.url}</span>
                        <ExternalLink className="w-3 h-3 shrink-0 text-zinc-500" />
                      </a>
                    ) : (
                      <button
                        onClick={() => openFile(att)}
                        className="inline-flex items-center gap-1.5 min-w-0 hover:text-white"
                        title={att.label ?? undefined}
                      >
                        <Paperclip className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                        <span className="truncate">{att.label}</span>
                      </button>
                    )}
                    <button
                      onClick={() => removeAttachment(att)}
                      className="p-0.5 rounded text-zinc-600 hover:text-red-400 opacity-0 group-hover/att:opacity-100 transition-opacity"
                      title="Remove attachment"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-1 mt-3 -ml-1">
              <button
                onClick={() => openAddLink(note.id)}
                className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.05] transition-colors"
              >
                <Link2 className="w-3 h-3" /> Link
              </button>
              <button
                onClick={() => pickFile(note.id)}
                disabled={uploadingNoteId === note.id}
                className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.05] transition-colors disabled:opacity-50"
              >
                <Paperclip className="w-3 h-3" />
                {uploadingNoteId === note.id ? "Uploading…" : "File"}
              </button>
              <button
                onClick={() => openEdit(note)}
                className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.05] transition-colors"
              >
                <Pencil className="w-3 h-3" /> Edit
              </button>
              <button
                onClick={() => setPendingDelete(note)}
                className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <Trash2 className="w-3 h-3" /> Delete
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="mt-12">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <StickyNote className="w-4 h-4" style={{ color: accentHex }} />
          <h3 className="text-sm font-bold tracking-wide text-zinc-200 uppercase">Notes</h3>
          <span className="text-[11px] text-zinc-600">· detailed context, kept separate from signals</span>
        </div>
        <Button
          size="sm"
          onClick={openCreate}
          className="h-8 text-xs bg-white/[0.06] hover:bg-white/[0.10] text-zinc-100 border border-white/[0.10]"
        >
          <Plus className="w-3.5 h-3.5 mr-1" /> Add Note
        </Button>
      </div>

      {isLoading ? (
        <p className="text-xs text-zinc-600 py-6 text-center">Loading notes…</p>
      ) : notes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/[0.08] py-8 text-center">
          <StickyNote className="w-6 h-6 text-zinc-700 mx-auto mb-2" />
          <p className="text-xs text-zinc-600">No notes yet</p>
          <button onClick={openCreate} className="text-xs mt-1 hover:underline" style={{ color: accentHex }}>
            Write your first note
          </button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {activeNotes.map(renderNote)}

          {resolvedNotes.length > 0 && (
            <>
              <div className="flex items-center gap-2 pt-3 pb-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
                  Done · {resolvedNotes.length}
                </span>
                <div className="flex-1 border-t border-white/[0.05]" />
              </div>
              {resolvedNotes.map(renderNote)}
            </>
          )}
        </div>
      )}

      {/* Hidden file input, shared across all note cards */}
      <input ref={fileInputRef} type="file" className="hidden" onChange={onFileChosen} />

      {/* Create / edit note dialog */}
      <Dialog open={editorOpen} onOpenChange={(o) => { if (!o && !saving) setEditorOpen(false); }}>
        <DialogContent className="bg-neutral-900 border-white/10 text-white">
          <DialogHeader>
            <DialogTitle>{editingNote ? "Edit note" : "New note"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-1">
            <div className="space-y-1.5">
              <Label className="text-white/60 text-xs">Title <span className="text-white/30">(optional)</span></Label>
              <Input
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                placeholder="e.g. Rewrite the bylaws"
                className="bg-white/5 border-white/10 text-white"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-white/60 text-xs">Note</Label>
              <Textarea
                value={draftBody}
                onChange={(e) => setDraftBody(e.target.value)}
                placeholder="Write the details… paste links and they'll become clickable. You can attach a Google Doc or a file after saving."
                rows={6}
                className="bg-white/5 border-white/10 text-white resize-y"
              />
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="ghost" onClick={() => setEditorOpen(false)} className="text-white/50 hover:text-white/80">
              Cancel
            </Button>
            <Button onClick={saveNote} disabled={saving} className="bg-white text-black hover:bg-white/90">
              {saving ? "Saving…" : editingNote ? "Save changes" : "Add note"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add link dialog */}
      <Dialog open={!!linkNoteId} onOpenChange={(o) => { if (!o) setLinkNoteId(null); }}>
        <DialogContent className="bg-neutral-900 border-white/10 text-white max-w-sm">
          <DialogHeader>
            <DialogTitle>Add a link</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-1">
            <div className="space-y-1.5">
              <Label className="text-white/60 text-xs">Label <span className="text-white/30">(optional)</span></Label>
              <Input
                value={linkLabel}
                onChange={(e) => setLinkLabel(e.target.value)}
                placeholder="e.g. Bylaws working draft"
                className="bg-white/5 border-white/10 text-white"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-white/60 text-xs">URL</Label>
              <Input
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); saveLink(); } }}
                placeholder="docs.google.com/…"
                className="bg-white/5 border-white/10 text-white"
                autoFocus
              />
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="ghost" onClick={() => setLinkNoteId(null)} className="text-white/50 hover:text-white/80">
              Cancel
            </Button>
            <Button onClick={saveLink} className="bg-white text-black hover:bg-white/90">
              <Check className="w-4 h-4 mr-1" /> Add link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => { if (!o) setPendingDelete(null); }}>
        <AlertDialogContent className="bg-neutral-900 border-white/[0.08] text-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Delete this note?</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              This permanently removes the note and its attached files. Links you added aren't affected elsewhere. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-transparent border-white/10 text-zinc-300 hover:bg-white/5 hover:text-white">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteNote} className="bg-red-600 hover:bg-red-500 text-white">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
