// Recursive row for a single agenda item + its children.
//
// Layout decisions captured here so they don't get re-derived:
//   - L1 topics get a card-style container so each topic visually
//     contains its children (huge readability win once the tree fills
//     in). L2-L4 render as inline rows inside their L1 card.
//   - Right-side controls (progress / due / owner / + / menu) cluster
//     tightly together right after the title rather than being pushed
//     to the far-right edge. Kills the "empty desert in the middle of
//     every row" problem when the screen is wide.
//   - "Add sub-item" lives as a hover-revealed "+" icon ON the parent
//     row (group-hover/row) instead of as a persistent button below
//     the children list. The old version stacked visibly because CSS
//     :hover bubbles up the DOM, so hovering a leaf triggered every
//     ancestor's `group/branch` add button at once.
//   - Hairline border between sibling rows so they read as a list,
//     not as floating one-liners.

import { useState } from "react";
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
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { OwnerPicker } from "./OwnerPicker";
import { PILLAR_COLOR } from "@/pages/admin/AdminMessageBoard";
import type {
  AgendaItemWithChildren,
  AgendaStatus,
  StaffOption,
} from "./types";
import { flattenSubtree } from "./types";

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

const StatusButton = ({
  status,
  onCycle,
  iconClass,
  accent,
}: {
  status: AgendaStatus;
  onCycle: () => void;
  iconClass: string;
  accent: string;
}) => {
  if (status === "done") {
    return (
      <button
        type="button"
        onClick={onCycle}
        className="shrink-0 hover:opacity-80 transition-opacity"
        title="Done — click to cycle (Signal)"
      >
        <CheckCircle2 className={iconClass} style={{ color: accent }} />
      </button>
    );
  }
  if (status === "on_hold") {
    return (
      <button
        type="button"
        onClick={onCycle}
        className="shrink-0 text-amber-400 hover:text-amber-300 transition-colors"
        title="On-Hold — click to cycle (Done)"
      >
        <PauseCircle className={iconClass} />
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onCycle}
      className="shrink-0 text-white/30 hover:text-white/60 transition-colors"
      title="Signal — click to cycle (On-Hold)"
    >
      <Circle className={iconClass} />
    </button>
  );
};

// Cycle order: signal -> on_hold -> done -> signal
const nextStatus = (s: AgendaStatus): AgendaStatus =>
  s === "signal" ? "on_hold" : s === "on_hold" ? "done" : "signal";

const dueDateChip = (iso: string | null): React.ReactNode => {
  if (!iso) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(iso + "T00:00:00");
  const isOverdue = due < today;
  const isToday = due.getTime() === today.getTime();
  const label = due.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return (
    <span
      className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md shrink-0 ${
        isOverdue
          ? "bg-red-500/15 text-red-400 border border-red-500/30"
          : isToday
            ? "bg-amber-500/15 text-amber-300 border border-amber-500/30"
            : "bg-white/[0.04] text-zinc-400 border border-white/[0.08]"
      }`}
      title={isOverdue ? "Overdue" : isToday ? "Due today" : `Due ${label}`}
    >
      {label}
    </span>
  );
};

interface RowProps {
  node: AgendaItemWithChildren;
  staff: StaffOption[];
  expanded: Set<string>;
  onToggleExpand: (id: string) => void;
  onOpenDetail: (item: AgendaItemWithChildren) => void;
  onSetStatus: (id: string, status: AgendaStatus) => void;
  onChangeOwners: (id: string, userIds: string[]) => void;
  onAddChild: (parent: AgendaItemWithChildren, title: string) => Promise<void>;
  onArchive: (id: string) => void;
  onDuplicate: (item: AgendaItemWithChildren) => void;
  onDelete: (item: AgendaItemWithChildren) => void;
}

export const AgendaItemRow = ({
  node,
  staff,
  expanded,
  onToggleExpand,
  onOpenDetail,
  onSetStatus,
  onChangeOwners,
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

  const [addingChild, setAddingChild] = useState(false);
  const [draftChildTitle, setDraftChildTitle] = useState("");
  const [savingChild, setSavingChild] = useState(false);

  // Progress roll-up across all descendants (not just direct children)
  // so a parent-of-parents reflects the whole subtree at a glance.
  const allDescendants = flattenSubtree(node).slice(1); // exclude self
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

  // The row content is the same for L1 (inside a card) and L2-L4 (inline).
  // Wrapping changes the outer container only.
  const rowContent = (
    <div
      className={`group/row flex items-center gap-2 ${style.rowPx} hover:bg-white/[0.04] transition-colors`}
    >
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

      {/* Status (column to the LEFT of attachments per spec) */}
      <StatusButton
        status={node.status}
        onCycle={() => onSetStatus(node.id, nextStatus(node.status))}
        iconClass={style.iconClass}
        accent={accent}
      />

      {/* Title — clicking opens the detail panel. Capped width so the
          right-side controls cluster sits close, not at the screen edge. */}
      <button
        type="button"
        onClick={() => onOpenDetail(node)}
        className={`min-w-0 max-w-[28rem] text-left truncate hover:text-white transition-colors ${
          style.titleClass
        } ${node.status === "done" ? "line-through opacity-50" : ""}`}
        title="Open details"
      >
        {node.title}
      </button>

      {node.notes && (
        <span
          className="text-[10px] text-white/30 shrink-0"
          title="Has notes"
        >
          ·
        </span>
      )}

      {/* Right-side cluster — tight group that sits right after the title */}
      <div className="flex items-center gap-2 ml-2">
        {/* Progress roll-up (only when there are descendants) */}
        {allDescendants.length > 0 && (
          <span
            className={`text-[10px] font-semibold shrink-0 tabular-nums ${
              doneDescendants === allDescendants.length ? "text-green-400" : "text-white/40"
            }`}
            title={`${doneDescendants} of ${allDescendants.length} sub-items done`}
          >
            {doneDescendants}/{allDescendants.length}
          </span>
        )}

        {dueDateChip(node.due_date)}

        {/* Owner stack — always visible, shows ? when unassigned, click
            to add/remove. Multi-owner supported. */}
        <OwnerPicker
          ownerUserIds={node.owner_user_ids}
          staff={staff}
          size={style.ownerSize}
          onChange={(uids) => onChangeOwners(node.id, uids)}
        />

        {/* + Add sub-item — hover-revealed on the row itself.
            Critical: `group-hover/row` only fires when THIS row is
            hovered, not when a descendant is hovered, so add buttons
            no longer stack visibly all the way up the tree. */}
        {canHaveChildren && (
          <button
            type="button"
            onClick={startAddingChild}
            className="shrink-0 p-1 rounded text-white/20 hover:text-white/70 hover:bg-white/[0.06] opacity-0 group-hover/row:opacity-100 focus:opacity-100 transition-opacity"
            title="Add sub-item"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Per-row menu */}
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
                  Add sub-item
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
  const childrenBlock = isExpanded && (hasChildren || addingChild) && (
    <div
      className="ml-[14px] pl-4 border-l divide-y divide-white/[0.03]"
      style={{ borderColor: `${accent}22` }}
    >
      {node.children.map((child) => (
        <AgendaItemRow
          key={child.id}
          node={child}
          staff={staff}
          expanded={expanded}
          onToggleExpand={onToggleExpand}
          onOpenDetail={onOpenDetail}
          onSetStatus={onSetStatus}
          onChangeOwners={onChangeOwners}
          onAddChild={onAddChild}
          onArchive={onArchive}
          onDuplicate={onDuplicate}
          onDelete={onDelete}
        />
      ))}

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
            placeholder="New sub-item…"
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

  // L1: wrap row + children in a pillar-tinted card so the topic
  // visually contains its subtree AND pops as the focal point of its
  // pillar. The row itself gets a stronger tint than the children area
  // to make the L1 header unmistakable. L2-L4: render inline with a
  // hairline separator so siblings read as a list without floating.
  if (isL1) {
    return (
      <div
        className="rounded-xl border overflow-hidden mb-3 last:mb-0"
        style={{
          borderColor: `${accent}30`,
          background: `${accent}08`,
        }}
      >
        <div style={{ background: `${accent}18` }}>{rowContent}</div>
        {childrenBlock && <div className="pb-2">{childrenBlock}</div>}
      </div>
    );
  }

  return (
    <div>
      {rowContent}
      {childrenBlock}
    </div>
  );
};
