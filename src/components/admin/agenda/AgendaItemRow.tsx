// Recursive row for a single agenda item + its children. Renders one
// row per node with status, owner, due date, star, progress badge,
// per-row actions, and a hover-revealed child-adder. Strong visual
// hierarchy across depths: L1 reads as a chunky topic header, L4 reads
// as small detail. Vertical guide lines in the pillar color connect
// parents to their children.

import { useState } from "react";
import {
  ChevronRight,
  ChevronDown,
  Plus,
  Star,
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

// Per-depth visual scale. L1 is the chunky topic header; L2-L4 step
// down in size + weight + opacity. The whole point is that you should
// be able to tell L1 from L4 without reading the indent.
const DEPTH_STYLE: Record<number, {
  rowPx: string;
  titleClass: string;
  iconClass: string;
  ownerSize: "sm" | "md";
  rowBg: string;
}> = {
  1: {
    rowPx: "py-2.5 px-3",
    titleClass: "text-[15px] font-extrabold uppercase tracking-wide text-white",
    iconClass: "w-4 h-4",
    ownerSize: "md",
    rowBg: "bg-white/[0.03]",
  },
  2: {
    rowPx: "py-1.5 px-3",
    titleClass: "text-sm font-semibold text-white/90",
    iconClass: "w-3.5 h-3.5",
    ownerSize: "sm",
    rowBg: "",
  },
  3: {
    rowPx: "py-1 px-3",
    titleClass: "text-[13px] font-medium text-white/70",
    iconClass: "w-3 h-3",
    ownerSize: "sm",
    rowBg: "",
  },
  4: {
    rowPx: "py-1 px-3",
    titleClass: "text-xs font-normal text-white/55",
    iconClass: "w-3 h-3",
    ownerSize: "sm",
    rowBg: "",
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
  onToggleStar: (id: string, current: boolean) => void;
  onChangeOwner: (id: string, userId: string | null) => void;
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
  onToggleStar,
  onChangeOwner,
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

  const [addingChild, setAddingChild] = useState(false);
  const [draftChildTitle, setDraftChildTitle] = useState("");
  const [savingChild, setSavingChild] = useState(false);

  // Progress roll-up across all descendants (not just direct children)
  // so a parent of parents reflects the entire subtree at a glance.
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

  return (
    <div className="group/branch">
      {/* The row itself */}
      <div
        className={`group/row flex items-center gap-2 rounded-lg ${style.rowPx} ${style.rowBg} hover:bg-white/[0.05] transition-colors`}
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

        {/* Star */}
        <button
          type="button"
          onClick={() => onToggleStar(node.id, node.is_starred)}
          className="shrink-0"
          title={node.is_starred ? "Unstar" : "Star — flag as important"}
        >
          <Star
            className={`${style.iconClass} ${
              node.is_starred
                ? "fill-amber-400 text-amber-400"
                : "text-white/15 hover:text-white/40 transition-colors"
            }`}
          />
        </button>

        {/* Title — clicking opens the detail panel */}
        <button
          type="button"
          onClick={() => onOpenDetail(node)}
          className={`flex-1 min-w-0 text-left truncate hover:text-white transition-colors ${
            style.titleClass
          } ${node.status === "done" ? "line-through opacity-50" : ""}`}
          title="Open details"
        >
          {node.title}
          {node.notes && (
            <span className="ml-1.5 text-[10px] text-white/30 align-middle">·</span>
          )}
        </button>

        {/* Progress roll-up (only when there are descendants) */}
        {allDescendants.length > 0 && (
          <span
            className={`text-[10px] font-semibold shrink-0 ${
              doneDescendants === allDescendants.length ? "text-green-400" : "text-white/40"
            }`}
            title={`${doneDescendants} of ${allDescendants.length} sub-items done`}
          >
            {doneDescendants}/{allDescendants.length}
          </span>
        )}

        {/* Due date chip */}
        {dueDateChip(node.due_date)}

        {/* Owner avatar — always visible. Shows ? when unassigned. */}
        <OwnerPicker
          ownerUserId={node.owner_user_id}
          staff={staff}
          size={style.ownerSize}
          onChange={(uid) => onChangeOwner(node.id, uid)}
        />

        {/* Per-row menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="shrink-0 p-1 rounded text-white/20 hover:text-white/60 hover:bg-white/[0.06] opacity-0 group-hover/row:opacity-100 transition-opacity"
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
                  onSelect={() => {
                    setAddingChild(true);
                    if (!isExpanded) onToggleExpand(node.id);
                  }}
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

      {/* Children container — vertical tree-guide line in pillar color
          shows the parent-child relationship without bespoke per-row
          borders. The inline add-child is hover-revealed and lives
          inside this container so it sits at the children's indent. */}
      {isExpanded && (hasChildren || addingChild || canHaveChildren) && (
        <div
          className="ml-[14px] pl-4 border-l"
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
              onToggleStar={onToggleStar}
              onChangeOwner={onChangeOwner}
              onAddChild={onAddChild}
              onArchive={onArchive}
              onDuplicate={onDuplicate}
              onDelete={onDelete}
            />
          ))}

          {canHaveChildren && (
            addingChild ? (
              <form
                onSubmit={handleSubmitChild}
                className="flex items-center gap-2 py-1 px-3"
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
            ) : (
              <button
                type="button"
                onClick={() => setAddingChild(true)}
                className="flex items-center gap-1.5 text-[10px] text-white/30 hover:text-white/60 transition-colors py-1 px-3 opacity-0 group-hover/branch:opacity-100 focus:opacity-100 transition-[opacity]"
              >
                <Plus className="w-3 h-3" />
                Add sub-item
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
};
