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
  PauseCircle,
  Target,
  StickyNote,
  Paperclip,
  Calendar,
  X,
  GripVertical,
} from "lucide-react";
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
import { OwnerPicker } from "./OwnerPicker";
import { PILLAR_COLOR } from "@/pages/admin/AdminMessageBoard";
import type {
  AgendaItemWithChildren,
  AgendaStatus,
  StaffOption,
  AttachmentSummary,
  LinkSummary,
} from "./types";
import { STATUS_LABEL, flattenSubtree } from "./types";

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
    // Quietest of the four — "haven't looked at it yet this week" should
    // recede until someone touches it. Neutral gray + plain circle.
    label: "Pending Review",
    bg: "bg-white/[0.04]",
    text: "text-zinc-400",
    border: "border-white/[0.10]",
    Icon: Circle,
  },
  signal: {
    label: "Signal",
    bg: "bg-red-500/15",
    text: "text-red-400",
    border: "border-red-500/30",
    Icon: Target,
  },
  done: {
    label: "Done",
    bg: "bg-green-500/15",
    text: "text-green-400",
    border: "border-green-500/30",
    Icon: CheckCircle2,
  },
  on_hold: {
    label: "On-Hold",
    bg: "bg-amber-500/15",
    text: "text-amber-300",
    border: "border-amber-500/30",
    Icon: PauseCircle,
  },
};

// Status order in the dropdown — left-to-right by escalating attention:
// neutral default → active → blocked → complete.
const STATUS_OPTIONS: AgendaStatus[] = ["pending_review", "signal", "on_hold", "done"];

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
// Single icon + count combining attachments and links. Click opens
// the detail dialog where the user can upload/manage both sets — far
// less duplicated UX than a separate popover.

const FilesCell = ({
  attachments,
  links,
  onOpenDetail,
}: {
  attachments: AttachmentSummary[];
  links: LinkSummary[];
  onOpenDetail: () => void;
}) => {
  const count = attachments.length + links.length;
  const hasAny = count > 0;
  const previewLines: string[] = [];
  if (attachments.length > 0) {
    const names = attachments.slice(0, 3).map((a) => a.filename);
    previewLines.push(
      `${attachments.length} file${attachments.length === 1 ? "" : "s"}: ${names.join(", ")}${
        attachments.length > 3 ? `, +${attachments.length - 3} more` : ""
      }`,
    );
  }
  if (links.length > 0) {
    const names = links.slice(0, 3).map((l) => l.nickname?.trim() || l.url);
    previewLines.push(
      `${links.length} link${links.length === 1 ? "" : "s"}: ${names.join(", ")}${
        links.length > 3 ? `, +${links.length - 3} more` : ""
      }`,
    );
  }
  const tip = hasAny ? previewLines.join(" · ") : "No files or links — click to add";
  return (
    <button
      type="button"
      onClick={onOpenDetail}
      className={`w-full flex items-center justify-center gap-1 px-2 py-1 rounded-md border text-[11px] font-semibold transition-colors ${
        hasAny
          ? "bg-amber-400/10 text-amber-400 border-amber-400/30 hover:bg-amber-400/15"
          : "bg-white/[0.02] text-white/25 border-white/[0.06] hover:text-white/60 hover:bg-white/[0.06]"
      }`}
      title={tip}
    >
      <Paperclip className="w-3 h-3 shrink-0" />
      <span className="tabular-nums">{hasAny ? count : "—"}</span>
    </button>
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
  const isTask = !isL1; // L2-L4 get the columns; L1 stays a container header

  const [addingChild, setAddingChild] = useState(false);
  const [draftChildTitle, setDraftChildTitle] = useState("");
  const [savingChild, setSavingChild] = useState(false);

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
  const doneDescendants = allDescendants.filter((d) => d.status === "done").length;

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

  // Zebra striping — only on task rows (L2-L4). L1 already differentiates
  // via the pillar-tinted card wrapper, so striping there would clash.
  const stripeBg = isTask && index % 2 === 1 ? "bg-white/[0.025]" : "";

  const rowContent = (
    <div
      className={`group/row flex items-center gap-2 ${style.rowPx} ${stripeBg} hover:bg-white/[0.05] transition-colors`}
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

      {/* Title — for tasks (L2-L4) the title gets a fixed column width so
          columns sit right next to it (much easier to scan than columns
          pinned far-right). L1 topics keep flex-1 since they have no
          columns to anchor against. */}
      <button
        type="button"
        onClick={() => onOpenDetail(node)}
        className={`min-w-0 text-left truncate hover:text-white transition-colors ${
          isTask ? "w-80 shrink-0" : "flex-1"
        } ${style.titleClass} ${
          node.status === "done" && isTask ? "line-through opacity-50" : ""
        }`}
        title="Open details"
      >
        {node.title}
      </button>

      {/* Task columns — pinned right. Only on L2-L4. Each column wears
          a left border so the row reads as a real columnar grid. The
          border color matches the column header text (zinc-500) at low
          opacity so it's a soft separator, not a hard divider. */}
      {isTask && (
        <>
          <div className="w-28 shrink-0 hidden sm:block border-l border-zinc-500/30 pl-2">
            <StatusDropdown
              status={node.status}
              onChange={(s) => onSetStatus(node.id, s)}
            />
          </div>
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
            doneDescendants === allDescendants.length ? "text-green-400" : "text-white/50"
          }`}
          title={`${doneDescendants} of ${allDescendants.length} tasks done`}
        >
          {doneDescendants}/{allDescendants.length}
        </span>
      )}

      {/* Right-side cluster: owner + add + menu */}
      <div className="flex items-center gap-2 ml-1">
        <OwnerPicker
          ownerUserIds={node.owner_user_ids}
          staff={staff}
          size={style.ownerSize}
          onChange={(uids) => onChangeOwners(node.id, uids)}
        />

        {canHaveChildren && (
          <button
            type="button"
            onClick={startAddingChild}
            className="shrink-0 p-1 rounded text-white/20 hover:text-white/70 hover:bg-white/[0.06] opacity-0 group-hover/row:opacity-100 focus:opacity-100 transition-opacity"
            title={addLabel}
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
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
          <span className="w-28 shrink-0 hidden sm:block text-center border-l border-zinc-500/30 pl-2">Status</span>
          <span className="w-24 shrink-0 hidden sm:block text-center border-l border-zinc-500/30 pl-2">Due</span>
          <span className="w-16 shrink-0 hidden md:block text-center border-l border-zinc-500/30 pl-2">Files</span>
          <span className="w-14 shrink-0 hidden md:block text-center border-l border-zinc-500/30 pl-2">Notes</span>
          {/* Flex spacer + actions cluster spacer mirror the row layout:
              columns hug the title on the left, the actions cluster
              floats on the right. */}
          <span className="flex-1" aria-hidden />
          <span className="w-[88px] shrink-0" aria-hidden />
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

  // L1: card-style container with pillar tint. L2-L4: inline rows
  // separated by hairline borders so siblings read as a list.
  if (isL1) {
    return (
      <div
        ref={setNodeRef}
        style={{
          ...dragStyle,
          borderColor: `${accent}30`,
          background: `${accent}08`,
        }}
        className="rounded-xl border overflow-hidden mb-3 last:mb-0"
      >
        <div style={{ background: `${accent}18` }}>{rowContent}</div>
        {childrenBlock && <div className="pb-2">{childrenBlock}</div>}
      </div>
    );
  }

  return (
    <div ref={setNodeRef} style={dragStyle}>
      {rowContent}
      {childrenBlock}
    </div>
  );
};
