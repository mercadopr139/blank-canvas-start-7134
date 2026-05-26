// Shared types for the Weekly Agenda feature.
// agenda_items are a self-referential tree capped at depth 4 by both
// the app and a DB CHECK constraint.

import type { Pillar } from "@/pages/admin/AdminMessageBoard";

export type AgendaStatus = "pending_review" | "signal" | "done" | "on_hold";

export interface AgendaItem {
  id: string;
  pillar: Pillar;
  parent_id: string | null;
  depth: number;
  title: string;
  notes: string | null;
  owner_user_ids: string[];
  status: AgendaStatus;
  due_date: string | null;
  is_starred: boolean;
  sort_order: number;
  is_archived: boolean;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  last_edited_by: string | null;
  last_edited_at: string | null;
}

export interface AgendaItemWithChildren extends AgendaItem {
  children: AgendaItemWithChildren[];
}

export interface StaffOption {
  user_id: string;
  full_name: string;
  job_title: string | null;
  // Null when the staff member doesn't have a Workbench yet. Used by
  // the Send-to-Workbench chooser to filter focus areas to the ones
  // this user actually has.
  task_manager_type: string | null;
}

// Lightweight summaries fetched at page load so each row can display
// attachment/link indicator icons without a per-item query.
export interface AttachmentSummary {
  item_id: string;
  filename: string;
}

export interface LinkSummary {
  item_id: string;
  url: string;
  nickname: string | null;
}

export const STATUS_LABEL: Record<AgendaStatus, string> = {
  pending_review: "Pending Review",
  signal: "Signal",
  done: "Done",
  on_hold: "On-Hold",
};

// Initials avatar — deterministic color from user_id so the same
// person always shows the same hue. Picks from the pillar palette
// + a few extras so two staff next to each other look distinct.
const AVATAR_COLORS = [
  "#bf0f3e", // NLA red
  "#22c55e", // green
  "#38bdf8", // sky
  "#f59e0b", // amber
  "#a78bfa", // violet
  "#ec4899", // pink
  "#14b8a6", // teal
];

export const colorForUserId = (userId: string | null | undefined): string => {
  if (!userId) return "#52525b";
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  }
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
};

export const initialsOf = (fullName: string): string => {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

// Tree builder: turn the flat list returned by Supabase into a nested
// structure ordered by sort_order within each parent.
export const buildTree = (items: AgendaItem[]): AgendaItemWithChildren[] => {
  const byId = new Map<string, AgendaItemWithChildren>();
  items.forEach((i) => byId.set(i.id, { ...i, children: [] }));
  const roots: AgendaItemWithChildren[] = [];
  byId.forEach((node) => {
    if (node.parent_id) {
      const parent = byId.get(node.parent_id);
      if (parent) parent.children.push(node);
      else roots.push(node); // orphan — parent archived/deleted; show as root so it doesn't disappear
    } else {
      roots.push(node);
    }
  });
  const sortRec = (nodes: AgendaItemWithChildren[]) => {
    nodes.sort((a, b) => a.sort_order - b.sort_order);
    nodes.forEach((n) => sortRec(n.children));
  };
  sortRec(roots);
  return roots;
};

// Walk subtree, return ALL descendants (used by progress badge + duplicate).
export const flattenSubtree = (
  node: AgendaItemWithChildren,
): AgendaItemWithChildren[] => {
  const out: AgendaItemWithChildren[] = [node];
  node.children.forEach((c) => out.push(...flattenSubtree(c)));
  return out;
};
