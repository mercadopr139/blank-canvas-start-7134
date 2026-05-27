// Recursive row for a single agenda item + its children.
//
// Hierarchy terminology (locked, do not rename):
//   - Pillar (Operations / Sales & Marketing / Finance) — the container
//   - Agenda Topic (L1) — persistent week-to-week; pure container row
//   - Task (L2-L4) — the editable, week-to-week thing; gets the columns
//
// Layout decisions captured here so they don't get re-derived:
//   - L1 (Agenda Topic) renders as a card with title + progress + actions.
//     No status / due / files / notes inline — topics are containers.
//   - L2-L4 (Tasks) render with fixed-width columns to the right of the
//     title: Status dropdown | Due date | Files | Notes. Owner stack
//     and per-row menu follow.
//   - "Add Task" lives as a hover-revealed "+" icon ON the parent row
//     (group-hover/row). Older versions placed it as a persistent button
//     under the children list, but CSS :hover bubbled and caused every
//     ancestor's add button to flash simultaneously.

import { useEffect, useRef, useState } from "react";
import {
  ChevronRight,
  ChevronDown,
  Plus,
  MoreHorizontal,
  Archive,
  Copy,
  Trash2,
  Circle,
  CheckCircle2,
  StickyNote,
  Paperclip,
  Calendar,
  X,
  GripVertical,
  ExternalLink,
  FileText,
  File as FileIcon,
  Download,
  Send,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useSortable, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { PILLAR_COLOR } from "@/pages/admin/AdminMessageBoard";
import type {
  AgendaItemWithChildren,
  AgendaStatus,
  StaffOption,
  AttachmentSummary,
  LinkSummary,
} from "./types";
import {
  STATUS_LABEL,
  flattenSubtree,
  isParentTaskComplete,
} from "./types";
import { SendToWorkbenchOverlay } from "./SendToWorkbenchOverlay";
import confetti from "canvas-confetti";

// Per-depth visual scale. L1 is the chunky topic header (lives inside
// its own card); L2-L4 step down in size + weight + opacity.
const DEPTH_STYLE: Record<number, {
  rowPx: string;
  titleClass: string;
  iconClass: string;
  ownerSize: "sm" | "md";
}> = {
  1: {
    rowPx: "py-3 px-4",
    titleClass: "text-[15px] font-extrabold uppercase tracking-wide text-white",
    iconClass: "w-4 h-4",
    ownerSize: "md",
  },
  2: {
    rowPx: "py-2 px-3",
    titleClass: "text-sm font-semibold text-white/90",
    iconClass: "w-3.5 h-3.5",
    ownerSize: "sm",
  },
  3: {
    rowPx: "py-1.5 px-3",
    titleClass: "text-[13px] font-medium text-white/70",
    iconClass: "w-3 h-3",
    ownerSize: "sm",
  },
  4: {
    rowPx: "py-1.5 px-3",
    titleClass: "text-xs font-normal text-white/55",
    iconClass: "w-3 h-3",
    ownerSize: "sm",
  },
};

// ─────────────────────────── Status column ───────────────────────────
// Inline dropdown for L2-L4 tasks. Pill style matches the segmented
// control in the detail dialog so muscle memory transfers.

const STATUS_STYLE: Record<AgendaStatus, { label: string; bg: string; text: string; border: string; Icon: typeof Circle }> = {
  pending_review: {
    // Neutral default — "haven't reviewed yet this week" recedes until
    // someone walks through it during the audit.
    label: "Pending Review",
    bg: "bg-white/[0.04]",
    text: "text-zinc-300",
    border: "border-white/[0.10]",
    Icon: Circle,
  },
  reviewed: {
    // The "we audited it" terminal state. Green to match the muscle
    // memory of "complete" without naming it that — items aren't
    // completed in an audit, they're reviewed.
    label: "Reviewed",
    bg: "bg-green-500/15",
    text: "text-green-400",
    border: "border-green-500/30",
    Icon: CheckCircle2,
  },
};

// Status order in the dropdown — simple binary: default → reviewed.
const STATUS_OPTIONS: AgendaStatus[] = ["pending_review", "reviewed"];

const StatusDropdown = ({
  status,
  onChange,
}: {
  status: AgendaStatus;
  onChange: (s: AgendaStatus) => void;
}) => {
  const style = STATUS_STYLE[status];
  const Icon = style.Icon;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={`w-full flex items-center justify-between gap-1.5 px-2 py-1 rounded-md border text-[11px] font-semibold transition-colors hover:bg-white/[0.06] ${style.bg} ${style.text} ${style.border}`}
          title={`Status: ${style.label}`}
        >
          <span className="flex items-center gap-1.5 truncate">
            <Icon className="w-3 h-3 shrink-0" />
            <span className="truncate">{style.label}</span>
          </span>
          <ChevronDown className="w-3 h-3 shrink-0 opacity-60" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="bg-neutral-900 border-white/10 text-white text-xs min-w-[8rem]"
      >
        {STATUS_OPTIONS.map((s) => {
          const opt = STATUS_STYLE[s];
          const OptIcon = opt.Icon;
          return (
            <DropdownMenuItem
              key={s}
              onSelect={() => onChange(s)}
              className="cursor-pointer focus:bg-white/[0.06] gap-2"
            >
              <OptIcon className={`w-3.5 h-3.5 ${opt.text}`} />
              <span className={s === status ? "font-semibold" : ""}>
                {STATUS_LABEL[s]}
              </span>
              {s === status && <span className="ml-auto text-white/40 text-[10px]">current</span>}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

// ──────────────────────── Parent completion pill ────────────────────────
// Replaces the StatusDropdown for any task that has sub-tasks. Status is
// auto-derived from descendants (see isParentTaskComplete) — the user
// can't change it manually because the audit model requires walking
// every sub-task. Disabled-looking pill makes that clear.

const CompletionPill = ({ complete }: { complete: boolean }) => (
  <div
    className={`w-full flex items-center justify-center gap-1.5 px-2 py-1 rounded-md border text-[11px] font-semibold cursor-not-allowed ${
      // Solid saturated green when Complete so it reads as "earned /
      // auto-derived" — visually distinct from the soft leaf Reviewed
      // tint (bg-green-500/15). The user knows at a glance that this
      // wasn't manually toggled.
      complete
        ? "bg-green-600 text-white border-green-500 shadow-sm shadow-green-900/40"
        : "bg-white/[0.04] text-zinc-400 border-white/[0.10]"
    }`}
    title={
      complete
        ? "Auto: every sub-task in this branch has been reviewed."
        : "Auto: flips to Complete when every sub-task in this branch is Reviewed."
    }
  >
    {complete ? (
      <CheckCircle2 className="w-3 h-3 shrink-0" />
    ) : (
      <Circle className="w-3 h-3 shrink-0" />
    )}
    <span className="truncate">{complete ? "Complete" : "Incomplete"}</span>
  </div>
);

// ──────────────────────── Send-to-Workbench trigger ────────────────────────
// Per-row Send button that opens the full SendToWorkbenchOverlay. The
// overlay (modeled on MyWorkbenchOverlay) gives full agency: pick the
// staffer, see their whole Workbench, edit the task title, drop it
// into whichever tile makes sense. State is hoisted to the row so the
// agendaItem context follows the click into the modal.

const QuickSendButton = ({ onOpen }: { onOpen: () => void }) => (
  <button
    type="button"
    onClick={(e) => {
      e.stopPropagation();
      onOpen();
    }}
    className="shrink-0 p-1 rounded text-white/25 hover:text-emerald-300 hover:bg-emerald-500/[0.08] opacity-0 group-hover/row:opacity-100 focus:opacity-100 transition-opacity"
    title="Send to a Workbench"
  >
    <Send className="w-3.5 h-3.5" />
  </button>
);

// ─────────────────────────── Due-date column ───────────────────────────
// Native date input styled to match the column row. Overdue / today
// colorations are applied to the trigger surface itself, not a chip,
// so the column reads as a single editable cell.

const DueDateCell = ({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (iso: string | null) => void;
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let tone = "bg-white/[0.04] text-zinc-400 border-white/[0.08] hover:bg-white/[0.06]";
  let label = "—";
  if (value) {
    const due = new Date(value + "T00:00:00");
    const isOverdue = due < today;
    const isToday = due.getTime() === today.getTime();
    label = due.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    if (isOverdue) tone = "bg-red-500/15 text-red-400 border-red-500/30";
    else if (isToday) tone = "bg-amber-500/15 text-amber-300 border-amber-500/30";
    else tone = "bg-white/[0.04] text-zinc-300 border-white/[0.10] hover:bg-white/[0.06]";
  }
  // The hidden input is the anchor for the browser's date picker.
  // Clicking the visible button calls showPicker() — fallback to click()
  // for older browsers (Safari <16). The input is sr-only-style hidden
  // (not absolutely positioned over the button, which was swallowing
  // the click in Chrome and never opening the picker).
  const openPicker = () => {
    const el = inputRef.current;
    if (!el) return;
    try {
      if (typeof (el as any).showPicker === "function") {
        (el as any).showPicker();
        return;
      }
    } catch {
      // Some browsers throw if the element isn't visible — fall through.
    }
    el.focus();
    el.click();
  };

  return (
    <div className="relative w-full group/due">
      <button
        type="button"
        onClick={openPicker}
        className={`w-full flex items-center justify-center gap-1 px-2 py-1 rounded-md border text-[11px] font-semibold transition-colors ${tone}`}
        title={value ? `Due ${label} — click to change` : "Set due date"}
      >
        <Calendar className="w-3 h-3 shrink-0" />
        <span>{label}</span>
      </button>
      <input
        ref={inputRef}
        type="date"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        className="sr-only"
        tabIndex={-1}
        aria-label="Due date"
      />
      {value && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onChange(null);
          }}
          className="absolute -right-1 -top-1 p-0.5 rounded-full bg-neutral-900 border border-white/10 text-zinc-500 hover:text-white opacity-0 group-hover/due:opacity-100 transition-opacity"
          title="Clear due date"
        >
          <X className="w-2.5 h-2.5" />
        </button>
      )}
    </div>
  );
};

// ─────────────────────────── Files column ───────────────────────────
// Paperclip + count. Click opens a popover listing every link
// (click → opens in new tab) and every attachment (click → downloads
// via a signed URL). The full detail dialog is one footer click away
// for adding/removing, but for the common case of "grab a file" the
// row-level popover saves the dialog round-trip.
//
// Empty state still routes to onOpenDetail so first-time users land
// in the dialog where the Add/Upload affordances live.

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

const FilesCell = ({
  attachments,
  links,
  onOpenDetail,
}: {
  attachments: AttachmentSummary[];
  links: LinkSummary[];
  onOpenDetail: () => void;
}) => {
  const [open, setOpen] = useState(false);
  const count = attachments.length + links.length;
  const hasAny = count > 0;

  const handleDownload = async (att: AttachmentSummary) => {
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

  // No files yet — keep the existing "click to add" affordance routing
  // straight to the detail dialog, since the popover would just be empty.
  if (!hasAny) {
    return (
      <button
        type="button"
        onClick={onOpenDetail}
        className="w-full flex items-center justify-center gap-1 px-2 py-1 rounded-md border text-[11px] font-semibold transition-colors bg-white/[0.02] text-white/25 border-white/[0.06] hover:text-white/60 hover:bg-white/[0.06]"
        title="No files or links — click to add"
      >
        <Paperclip className="w-3 h-3 shrink-0" />
        <span className="tabular-nums">—</span>
      </button>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="w-full flex items-center justify-center gap-1 px-2 py-1 rounded-md border text-[11px] font-semibold transition-colors bg-amber-400/10 text-amber-400 border-amber-400/30 hover:bg-amber-400/15"
          title={`${count} item${count === 1 ? "" : "s"} — click to open`}
        >
          <Paperclip className="w-3 h-3 shrink-0" />
          <span className="tabular-nums">{count}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-72 p-0 bg-neutral-900 border-white/10 text-white"
      >
        <div className="max-h-64 overflow-y-auto py-1">
          {links.length > 0 && (
            <>
              <p className="px-3 pt-1.5 pb-1 text-[9px] uppercase tracking-wider text-zinc-500">
                Links
              </p>
              {links.map((link) => (
                <a
                  key={link.id}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2 px-3 py-1.5 hover:bg-white/[0.05] transition-colors text-xs text-white"
                  title={link.url}
                >
                  <ExternalLink className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                  <span className="flex-1 truncate">
                    {link.nickname?.trim() || link.url}
                  </span>
                </a>
              ))}
            </>
          )}
          {attachments.length > 0 && (
            <>
              <p className="px-3 pt-1.5 pb-1 text-[9px] uppercase tracking-wider text-zinc-500">
                Files
              </p>
              {attachments.map((att) => {
                const Icon = att.mime_type === "application/pdf" ? FileText : FileIcon;
                return (
                  <button
                    key={att.id}
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      void handleDownload(att);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-white/[0.05] transition-colors text-xs text-white text-left"
                    title={`Download ${att.filename}`}
                  >
                    <Icon className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                    <span className="flex-1 truncate">{att.filename}</span>
                    <Download className="w-3 h-3 text-zinc-500 shrink-0" />
                  </button>
                );
              })}
            </>
          )}
        </div>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            onOpenDetail();
          }}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 border-t border-white/[0.06] text-[10px] font-semibold text-zinc-400 hover:bg-white/[0.04] hover:text-white transition-colors"
        >
          Manage in details
          <ChevronRight className="w-3 h-3" />
        </button>
      </PopoverContent>
    </Popover>
  );
};

// ─────────────────────────── Notes column ───────────────────────────
// Icon + count cell. Click opens a popover with a Textarea for quick
// editing. Hover tooltip shows the first line so context is one
// mouse-over away — no click needed to peek.

const NotesCell = ({
  notes,
  onSave,
}: {
  notes: string | null;
  onSave: (newNotes: string | null) => void;
}) => {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(notes ?? "");
  useEffect(() => {
    if (open) setDraft(notes ?? "");
  }, [open, notes]);

  const hasNotes = !!(notes && notes.trim());
  const firstLine = hasNotes ? notes!.split("\n")[0].trim() : "";
  const tip = hasNotes
    ? firstLine.length > 140
      ? `${firstLine.slice(0, 137)}…`
      : firstLine
    : "No notes — click to add";

  const handleSave = () => {
    const trimmed = draft.trim();
    onSave(trimmed.length === 0 ? null : trimmed);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`w-full flex items-center justify-center gap-1 px-2 py-1 rounded-md border text-[11px] font-semibold transition-colors ${
            hasNotes
              ? "bg-amber-400/10 text-amber-400 border-amber-400/30 hover:bg-amber-400/15"
              : "bg-white/[0.02] text-white/25 border-white/[0.06] hover:text-white/60 hover:bg-white/[0.06]"
          }`}
          title={tip}
        >
          <StickyNote className="w-3 h-3 shrink-0" />
          <span className="tabular-nums">{hasNotes ? "•" : "—"}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-80 p-3 bg-neutral-900 border-white/10 text-white"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1.5">
          Notes
        </p>
        <Textarea
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              handleSave();
            }
          }}
          placeholder="Quick note — context, links to discuss, sub-actions…"
          className="bg-white/[0.04] border-white/[0.08] text-white text-sm min-h-[100px]"
        />
        <div className="flex items-center justify-between gap-2 mt-2">
          <span className="text-[10px] text-zinc-600">⌘/Ctrl + Enter to save</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-[10px] text-zinc-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="text-[10px] font-semibold px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-white"
            >
              Save
            </button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

interface RowProps {
  node: AgendaItemWithChildren;
  staff: StaffOption[];
  // manager_type → focus_area_id for the seeded "Agenda" tile on each
  // workbench. Lets the per-row Send button push without an extra
  // focus-area picker — clicking a staff name lands the task on their
  // Agenda tile directly.
  agendaFocusByManager: Map<string, string>;
  attachmentsByItem: Map<string, AttachmentSummary[]>;
  linksByItem: Map<string, LinkSummary[]>;
  expanded: Set<string>;
  // Position among siblings — used to zebra-stripe task rows so adjacent
  // rows read distinctly. Top-level (L1) ignores it since topics are
  // already card-styled.
  index?: number;
  onToggleExpand: (id: string) => void;
  onOpenDetail: (item: AgendaItemWithChildren) => void;
  onSetStatus: (id: string, status: AgendaStatus) => void;
  onChangeOwners: (id: string, userIds: string[]) => void;
  onSetDueDate: (id: string, iso: string | null) => void;
  onUpdateNotes: (id: string, notes: string | null) => void;
  onAddChild: (parent: AgendaItemWithChildren, title: string) => Promise<void>;
  onArchive: (id: string) => void;
  onDuplicate: (item: AgendaItemWithChildren) => void;
  onDelete: (item: AgendaItemWithChildren) => void;
}

export const AgendaItemRow = ({
  node,
  staff,
  agendaFocusByManager,
  attachmentsByItem,
  linksByItem,
  expanded,
  index = 0,
  onToggleExpand,
  onOpenDetail,
  onSetStatus,
  onChangeOwners,
  onSetDueDate,
  onUpdateNotes,
  onAddChild,
  onArchive,
  onDuplicate,
  onDelete,
}: RowProps) => {
  const depth = Math.min(Math.max(node.depth, 1), 4);
  const style = DEPTH_STYLE[depth];
  const accent = PILLAR_COLOR[node.pillar];
  const isExpanded = expanded.has(node.id);
  const canHaveChildren = depth < 4;
  const hasChildren = node.children.length > 0;
  const isL1 = depth === 1;
  const isTask = !isL1; // L2-L4 get a status column; L1 stays a container header
  // L3+ are sub-tasks. They keep the Status column (so you can check them
  // off in the row) but drop Due/Files/Notes — those live behind the
  // title click → detail dialog. Keeps the meeting scan-line uncluttered
  // while every feature stays a click away.
  const isSubtask = depth >= 3;

  const [addingChild, setAddingChild] = useState(false);
  const [draftChildTitle, setDraftChildTitle] = useState("");
  const [savingChild, setSavingChild] = useState(false);
  const [sendOverlayOpen, setSendOverlayOpen] = useState(false);

  // Drag-to-reorder. The data payload lets the DndContext at the
  // pillar level know which parent's child list this drag belongs to.
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({
      id: node.id,
      data: { parentId: node.parent_id, pillar: node.pillar, depth: node.depth },
    });
  const dragStyle: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  // Progress roll-up across all descendants so a topic header reflects
  // its whole subtree (not just direct children) at a glance.
  const allDescendants = flattenSubtree(node).slice(1);
  const reviewedDescendants = allDescendants.filter((d) => d.status === "reviewed").length;

  const handleSubmitChild = async (e: React.FormEvent) => {
    e.preventDefault();
    const t = draftChildTitle.trim();
    if (!t) return;
    setSavingChild(true);
    try {
      await onAddChild(node, t);
      setDraftChildTitle("");
      setAddingChild(false);
    } finally {
      setSavingChild(false);
    }
  };

  const startAddingChild = () => {
    if (!canHaveChildren) return;
    setAddingChild(true);
    if (!isExpanded) onToggleExpand(node.id);
  };

  const addLabel = isL1 ? "Add Task" : "Add Sub-task";
  const addPlaceholder = isL1 ? "New task…" : "New sub-task…";

  const itemAttachments = attachmentsByItem.get(node.id) || [];
  const itemLinks = linksByItem.get(node.id) || [];

  // Parent task auto-completion. A task with sub-tasks doesn't carry its
  // own status — it's "Complete" only when every leaf descendant has
  // been reviewed. We fire a green confetti pop the moment the
  // derivation flips Incomplete → Complete (caught via a ref so it
  // doesn't re-fire on every render or on initial mount).
  const isParent = isTask && hasChildren;
  const parentIsComplete = isParent && isParentTaskComplete(node);
  const rowContentRef = useRef<HTMLDivElement>(null);
  const prevCompleteRef = useRef(parentIsComplete);
  useEffect(() => {
    if (parentIsComplete && !prevCompleteRef.current) {
      const rect = rowContentRef.current?.getBoundingClientRect();
      confetti({
        particleCount: 70,
        spread: 70,
        ticks: 90,
        startVelocity: 35,
        colors: ["#22c55e", "#10b981", "#34d399", "#86efac"],
        origin: rect
          ? {
              x: (rect.left + rect.width / 2) / window.innerWidth,
              y: (rect.top + rect.height / 2) / window.innerHeight,
            }
          : { y: 0.5 },
      });
    }
    prevCompleteRef.current = parentIsComplete;
  }, [parentIsComplete]);

  // Inline content marker — appears right next to the title on any task
  // that has notes, files, or links. Screen-width-independent, so deep
  // sub-tasks still get a visible signal even when the columns drift
  // rightward with indentation. Tooltip shows a peek of what's inside.
  const hasNotes = !!(node.notes && node.notes.trim());
  const hasContent = hasNotes || itemAttachments.length > 0 || itemLinks.length > 0;
  const contentTip = (() => {
    if (!hasContent) return "";
    const parts: string[] = [];
    if (hasNotes) {
      const first = node.notes!.split("\n")[0].trim();
      parts.push(first.length > 100 ? `Note: ${first.slice(0, 97)}…` : `Note: ${first}`);
    }
    if (itemAttachments.length > 0) {
      parts.push(`${itemAttachments.length} file${itemAttachments.length === 1 ? "" : "s"}`);
    }
    if (itemLinks.length > 0) {
      parts.push(`${itemLinks.length} link${itemLinks.length === 1 ? "" : "s"}`);
    }
    return parts.join(" · ");
  })();

  // Row background + framing — three-tier visual hierarchy:
  //   - L1 (Agenda Topic): handled separately below in the card wrapper
  //     (full pillar color so the topic row reads as a strong anchor).
  //   - L2 (Task): pillar-tinted fill + pillar-color outline. Each task
  //     reads as its own framed card AND inherits the pillar identity,
  //     so the audit feels like discrete, on-brand items instead of
  //     gray boxes that almost disappear against the dark body.
  //   - L3+ (Sub-task): alternating subtle-gray / bare, no outline.
  //     Stays neutral so it doesn't compete with the colored L2 cards
  //     visually clustered above it.
  //
  // The L2 bg is driven by a `--task-bg` CSS variable on the row's
  // inline style instead of a static class — pillar color is dynamic
  // at runtime, and we still need `hover:bg-white/[0.12]` to win over
  // the resting state (which a hard-coded inline `background` would
  // block on hover because of CSS specificity).
  let rowBg = "";
  let rowExtra = "";
  let rowStyle: React.CSSProperties | undefined;
  if (isTask) {
    if (node.depth === 2) {
      rowExtra = "border rounded-md mt-1 bg-[var(--task-bg)]";
      rowStyle = {
        borderColor: `${accent}55`,
        ["--task-bg" as any]: `${accent}30`,
      };
    } else {
      rowBg = index % 2 === 1 ? "bg-white/[0.04]" : "";
    }
  }

  const rowContent = (
    <div
      ref={rowContentRef}
      className={`group/row flex items-center gap-2 ${style.rowPx} ${rowBg} ${rowExtra} hover:bg-white/[0.12] transition-colors`}
      style={rowStyle}
    >
      {/* Drag handle — hover-revealed, never steals layout space */}
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="shrink-0 text-white/15 hover:text-white/40 cursor-grab active:cursor-grabbing opacity-0 group-hover/row:opacity-100 focus:opacity-100 transition-opacity touch-none"
        aria-label="Drag to reorder"
        title="Drag to reorder"
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical className="w-3.5 h-3.5" />
      </button>

      {/* Expand/collapse — keeps its slot even when no children so columns align */}
      {hasChildren ? (
        <button
          type="button"
          onClick={() => onToggleExpand(node.id)}
          className="shrink-0 text-white/30 hover:text-white/60 transition-colors"
          title={isExpanded ? "Collapse" : "Expand"}
        >
          {isExpanded ? (
            <ChevronDown className="w-3.5 h-3.5" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5" />
          )}
        </button>
      ) : (
        <span className="w-3.5 shrink-0" />
      )}

      {/* Title — all tasks (L2-L4) get the same fixed column width so
          the status pill aligns next to the title rather than drifting
          to the right edge. L1 topics still flex-fill since they have
          no inline columns. L3 / L4 (sub-tasks) get a small middot
          prefix so they read as "child of the task above" at a glance —
          matches the visual weight reduction already in DEPTH_STYLE. */}
      <button
        type="button"
        onClick={() => onOpenDetail(node)}
        className={`min-w-0 text-left truncate hover:text-white transition-colors ${
          isTask ? "w-80 shrink-0" : "flex-1"
        } ${style.titleClass} ${
          isTask && (isParent ? parentIsComplete : node.status === "reviewed")
            ? "line-through opacity-50"
            : ""
        }`}
        title="Open details"
      >
        {node.depth >= 3 && (
          <span className="opacity-50 mr-1.5 select-none">·</span>
        )}
        {node.title}
      </button>

      {/* Inline content marker — small amber dot sitting next to the title
          when this task has notes / files / links. Always visible
          regardless of screen width, so deep sub-tasks still telegraph
          "there's something to review here." Clicking opens the detail
          dialog; hovering shows a preview. */}
      {isTask && hasContent && (
        <button
          type="button"
          onClick={() => onOpenDetail(node)}
          className="shrink-0 -ml-1 w-2 h-2 rounded-full bg-amber-400 hover:bg-amber-300 ring-2 ring-amber-400/15 hover:ring-amber-300/25 transition-colors"
          title={contentTip}
          aria-label="Has notes, files, or links — open details"
        />
      )}

      {/* Add-child button — lives right next to the title so the
          affordance reads as "add under this item" rather than as a
          row-level action. Hover-revealed so it doesn't compete with
          the title at rest. Width slot is reserved either way so the
          columns don't shift on hover. */}
      {canHaveChildren ? (
        <button
          type="button"
          onClick={startAddingChild}
          className="shrink-0 p-1 rounded text-white/25 hover:text-white hover:bg-white/[0.08] opacity-0 group-hover/row:opacity-100 focus:opacity-100 transition-opacity"
          title={addLabel}
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      ) : (
        // Keep the slot reserved on L4 (no children allowed) so column
        // headers and rows still line up.
        <span className="w-[22px] shrink-0" aria-hidden />
      )}

      {/* Task columns — pinned right. Only on L2-L4. Each column wears
          a left border so the row reads as a real columnar grid. The
          border color matches the column header text (zinc-500) at low
          opacity so it's a soft separator, not a hard divider.
          L3+ subtasks drop Due/Files/Notes — they live in the dialog. */}
      {isTask && (
        <>
          <div className="w-28 shrink-0 hidden sm:block border-l border-zinc-500/30 pl-2">
            {isParent ? (
              <CompletionPill complete={parentIsComplete} />
            ) : (
              <StatusDropdown
                status={node.status}
                onChange={(s) => onSetStatus(node.id, s)}
              />
            )}
          </div>
          {!isSubtask && (
            <>
              <div className="w-24 shrink-0 hidden sm:block border-l border-zinc-500/30 pl-2">
                <DueDateCell
                  value={node.due_date}
                  onChange={(iso) => onSetDueDate(node.id, iso)}
                />
              </div>
              <div className="w-16 shrink-0 hidden md:block border-l border-zinc-500/30 pl-2">
                <FilesCell
                  attachments={itemAttachments}
                  links={itemLinks}
                  onOpenDetail={() => onOpenDetail(node)}
                />
              </div>
              <div className="w-14 shrink-0 hidden md:block border-l border-zinc-500/30 pl-2">
                <NotesCell
                  notes={node.notes}
                  onSave={(notes) => onUpdateNotes(node.id, notes)}
                />
              </div>
            </>
          )}
          {/* Pushes the right-side actions cluster to the row's right
              edge so the column block stays anchored to the title. */}
          <div className="flex-1" aria-hidden />
        </>
      )}

      {/* L1 only — subtree progress count so the topic header reflects
          weekly progress at a glance. */}
      {isL1 && allDescendants.length > 0 && (
        <span
          className={`text-[11px] font-semibold shrink-0 tabular-nums ${
            reviewedDescendants === allDescendants.length ? "text-green-400" : "text-white/50"
          }`}
          title={`${reviewedDescendants} of ${allDescendants.length} tasks reviewed`}
        >
          {reviewedDescendants}/{allDescendants.length}
        </span>
      )}

      {/* Right-side cluster: per-row Send-to-Workbench + three-dot menu.
          Send-to-Workbench lives on every task row (not just inside the
          detail dialog) so the meeting flow is one click — review,
          send, move on. */}
      <div className="flex items-center gap-2 ml-1">
        {isTask && (
          <QuickSendButton onOpen={() => setSendOverlayOpen(true)} />
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="shrink-0 p-1 rounded text-white/20 hover:text-white/60 hover:bg-white/[0.06] opacity-0 group-hover/row:opacity-100 focus:opacity-100 transition-opacity"
              title="More actions"
            >
              <MoreHorizontal className="w-3.5 h-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="bg-neutral-900 border-white/10 text-white text-xs"
          >
            {canHaveChildren && (
              <>
                <DropdownMenuItem
                  onSelect={startAddingChild}
                  className="cursor-pointer focus:bg-white/[0.06]"
                >
                  <Plus className="w-3.5 h-3.5 mr-2" />
                  {addLabel}
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-white/[0.06]" />
              </>
            )}
            <DropdownMenuItem
              onSelect={() => onDuplicate(node)}
              className="cursor-pointer focus:bg-white/[0.06]"
            >
              <Copy className="w-3.5 h-3.5 mr-2" />
              Duplicate{node.children.length > 0 ? " (with sub-items)" : ""}
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => onArchive(node.id)}
              className="cursor-pointer focus:bg-white/[0.06]"
            >
              <Archive className="w-3.5 h-3.5 mr-2" />
              Archive
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-white/[0.06]" />
            <DropdownMenuItem
              onSelect={() => onDelete(node)}
              className="cursor-pointer text-red-400 focus:text-red-300 focus:bg-red-500/10"
            >
              <Trash2 className="w-3.5 h-3.5 mr-2" />
              Delete permanently
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );

  // Children container — vertical tree-guide line in the pillar color
  // plus the inline add-child form (only when actively adding).
  // Column headers live here at L1 only: tasks always sit under their
  // Agenda Topic, so labeling the columns directly above the first task
  // is the most contextual place for them.
  const childrenBlock = isExpanded && (hasChildren || addingChild) && (
    <div
      className="ml-[14px] pl-4 border-l divide-y divide-white/[0.03]"
      style={{ borderColor: `${accent}22` }}
    >
      {isL1 && (
        <div className="flex items-center gap-2 px-3 py-1.5 text-[10px] uppercase tracking-wider font-semibold text-zinc-500 select-none">
          <span className="w-3.5 shrink-0" aria-hidden />
          <span className="w-3.5 shrink-0" aria-hidden />
          <span className="w-80 shrink-0">Task</span>
          {/* Slot mirrors the inline "+" button now living next to each
              title — keeps the column headers aligned with the row content. */}
          <span className="w-[22px] shrink-0" aria-hidden />
          <span className="w-28 shrink-0 hidden sm:block text-center border-l border-zinc-500/30 pl-2">Status</span>
          <span className="w-24 shrink-0 hidden sm:block text-center border-l border-zinc-500/30 pl-2">Due</span>
          <span className="w-16 shrink-0 hidden md:block text-center border-l border-zinc-500/30 pl-2">Files</span>
          <span className="w-14 shrink-0 hidden md:block text-center border-l border-zinc-500/30 pl-2">Notes</span>
          {/* Flex spacer + actions cluster spacer mirror the row layout:
              columns hug the title on the left, the actions cluster
              (now just the three-dot menu) floats on the right. */}
          <span className="flex-1" aria-hidden />
          <span className="w-[44px] shrink-0" aria-hidden />
        </div>
      )}
      <SortableContext
        items={node.children.map((c) => c.id)}
        strategy={verticalListSortingStrategy}
      >
        {node.children.map((child, childIndex) => (
          <AgendaItemRow
            key={child.id}
            node={child}
            staff={staff}
            agendaFocusByManager={agendaFocusByManager}
            attachmentsByItem={attachmentsByItem}
            linksByItem={linksByItem}
            expanded={expanded}
            index={childIndex}
            onToggleExpand={onToggleExpand}
            onOpenDetail={onOpenDetail}
            onSetStatus={onSetStatus}
            onChangeOwners={onChangeOwners}
            onSetDueDate={onSetDueDate}
            onUpdateNotes={onUpdateNotes}
            onAddChild={onAddChild}
            onArchive={onArchive}
            onDuplicate={onDuplicate}
            onDelete={onDelete}
          />
        ))}
      </SortableContext>

      {addingChild && (
        <form
          onSubmit={handleSubmitChild}
          className="flex items-center gap-2 py-1.5 px-3"
        >
          <span className="w-3.5 shrink-0" />
          <Circle className="w-3 h-3 text-white/20 shrink-0" />
          <input
            autoFocus
            value={draftChildTitle}
            onChange={(e) => setDraftChildTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setAddingChild(false);
                setDraftChildTitle("");
              }
            }}
            placeholder={addPlaceholder}
            disabled={savingChild}
            className="flex-1 bg-transparent border-b border-white/15 focus:border-white/40 outline-none text-xs text-white py-0.5"
          />
          <button
            type="submit"
            disabled={!draftChildTitle.trim() || savingChild}
            className="text-[10px] font-semibold px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-white disabled:opacity-40"
          >
            {savingChild ? "…" : "Add"}
          </button>
          <button
            type="button"
            onClick={() => {
              setAddingChild(false);
              setDraftChildTitle("");
            }}
            className="text-[10px] text-white/40 hover:text-white/70"
          >
            Cancel
          </button>
        </form>
      )}
    </div>
  );

  // L1: dark gray card body with a FULL pillar-color header row. The
  // header band is the strongest visual anchor in the agenda — at the
  // section level you should be able to see "Operations / Sales /
  // Finance" at a glance. The body stays bg-neutral-900 so task rows
  // sit on a near-black surface and the alternating L3+ pattern
  // (subtle-gray over bare-dark) reads cleanly without the pillar tint
  // muddying it.
  // Send-to-Workbench overlay — rendered once per row so the agendaItem
  // context follows the click into the modal. Mounted regardless of
  // open state (Radix Dialog portals nothing when closed, so the
  // overhead is negligible).
  const sendOverlay = isTask ? (
    <SendToWorkbenchOverlay
      open={sendOverlayOpen}
      onClose={() => setSendOverlayOpen(false)}
      agendaItem={node}
      staff={staff}
      agendaFocusByManager={agendaFocusByManager}
    />
  ) : null;

  if (isL1) {
    return (
      <div
        ref={setNodeRef}
        style={{
          ...dragStyle,
          borderColor: `${accent}40`,
        }}
        className="rounded-xl border bg-neutral-900 overflow-hidden mb-3 last:mb-0"
      >
        <div style={{ background: accent }}>{rowContent}</div>
        {childrenBlock && <div className="pb-2">{childrenBlock}</div>}
        {sendOverlay}
      </div>
    );
  }

  return (
    <div ref={setNodeRef} style={dragStyle}>
      {rowContent}
      {childrenBlock}
      {sendOverlay}
    </div>
  );
};
