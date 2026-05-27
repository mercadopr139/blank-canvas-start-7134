// Weekly Agenda — internal staff meeting tool spanning all 3 pillars.
// Phase 2: item CRUD + detail panel. Drag, attachments, links, log,
// Workbench sync, and the weekly cycle arrive in later phases.

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Plus, RotateCcw } from "lucide-react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  PILLARS,
  PILLAR_LABEL,
  PILLAR_COLOR,
  type Pillar,
} from "@/pages/admin/AdminMessageBoard";
import { AgendaItemRow } from "@/components/admin/agenda/AgendaItemRow";
import { AgendaItemDetailDialog } from "@/components/admin/agenda/AgendaItemDetailDialog";
import { WorkbenchesDrawer } from "@/components/admin/agenda/WorkbenchesDrawer";
import {
  buildTree,
  flattenSubtree,
  type AgendaItem,
  type AgendaItemWithChildren,
  type AgendaStatus,
  type StaffOption,
  type AttachmentSummary,
  type LinkSummary,
} from "@/components/admin/agenda/types";
import { logAgendaActivity } from "@/components/admin/agenda/activityLog";
import {
  mirrorAgendaStatusToSignals,
  mirrorSignalStatusToAgenda,
} from "@/components/admin/agenda/workbench-sync";

const formatWeekStart = (d: Date): string => {
  const day = d.getDay();
  const sunday = new Date(d);
  sunday.setDate(d.getDate() - day);
  return `${sunday.getFullYear()}-${String(sunday.getMonth() + 1).padStart(2, "0")}-${String(sunday.getDate()).padStart(2, "0")}`;
};

// Upcoming Friday relative to `from` (defaults to today). If today is
// Friday, returns today. If today is Sat or Sun, returns next week's
// Friday. Used as the default due_date for new tasks and the new
// target date when Reset Week bumps existing tasks forward.
const upcomingFridayIso = (from: Date = new Date()): string => {
  const d = new Date(from);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0 Sun … 5 Fri … 6 Sat
  const daysUntilFriday = (5 - day + 7) % 7;
  d.setDate(d.getDate() + daysUntilFriday);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const formatWeekRangeDisplay = (weekStartIso: string): string => {
  const start = new Date(weekStartIso + "T12:00:00");
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${fmt(start)} – ${fmt(end)}, ${start.getFullYear()}`;
};

const AdminAgenda = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const weekStartIso = formatWeekStart(new Date());

  // ─── Queries ────────────────────────────────────────────────────────

  const { data: items = [] } = useQuery<AgendaItem[]>({
    queryKey: ["agenda-items"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agenda_items" as any)
        .select("*")
        .eq("is_archived", false)
        .order("sort_order");
      if (error) throw error;
      return (data || []) as unknown as AgendaItem[];
    },
  });

  const { data: staff = [] } = useQuery<StaffOption[]>({
    queryKey: ["agenda-staff"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staff_profiles")
        .select("user_id, full_name, job_title, task_manager_type, status")
        .eq("status", "active")
        .order("full_name");
      if (error) throw error;
      return ((data || []) as {
        user_id: string;
        full_name: string;
        job_title: string | null;
        task_manager_type: string | null;
      }[]).map((s) => ({
        user_id: s.user_id,
        full_name: s.full_name,
        job_title: s.job_title,
        task_manager_type: s.task_manager_type,
      }));
    },
  });

  // Seeded "Agenda" focus area per manager_type. Powers the per-row
  // Send-to-Workbench picker (and the floating Workbenches drawer)
  // — clicking a staff name pushes to that user's Agenda tile without
  // any further focus-area picking.
  const { data: agendaFocusAreas = [] } = useQuery<{ id: string; manager_type: string | null }[]>({
    queryKey: ["agenda-focus-areas-by-manager"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("focus_areas")
        .select("id, manager_type")
        .eq("key", "agenda");
      if (error) throw error;
      return data || [];
    },
  });

  const agendaFocusByManager = useMemo(() => {
    const m = new Map<string, string>();
    for (const fa of agendaFocusAreas) {
      if (fa.manager_type) m.set(fa.manager_type, fa.id);
    }
    return m;
  }, [agendaFocusAreas]);

  // Page-level summaries so each row can show attachment/link
  // indicator icons without N per-item queries. The detail dialog
  // still owns its own full per-item queries for editing — it just
  // also invalidates these summary keys on mutation.
  const { data: attachmentSummaries = [] } = useQuery<AttachmentSummary[]>({
    queryKey: ["agenda-attachment-summary"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agenda_attachments" as any)
        .select("id, item_id, filename, storage_path, mime_type");
      if (error) throw error;
      return (data || []) as unknown as AttachmentSummary[];
    },
  });

  const { data: linkSummaries = [] } = useQuery<LinkSummary[]>({
    queryKey: ["agenda-link-summary"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agenda_item_links" as any)
        .select("id, item_id, url, nickname");
      if (error) throw error;
      return (data || []) as unknown as LinkSummary[];
    },
  });

  const attachmentsByItem = useMemo(() => {
    const m = new Map<string, AttachmentSummary[]>();
    for (const a of attachmentSummaries) {
      if (!m.has(a.item_id)) m.set(a.item_id, []);
      m.get(a.item_id)!.push(a);
    }
    return m;
  }, [attachmentSummaries]);

  const linksByItem = useMemo(() => {
    const m = new Map<string, LinkSummary[]>();
    for (const l of linkSummaries) {
      if (!m.has(l.item_id)) m.set(l.item_id, []);
      m.get(l.item_id)!.push(l);
    }
    return m;
  }, [linkSummaries]);

  const { data: weekSummaryRow } = useQuery<{ summary: string | null } | null>({
    queryKey: ["agenda-week-summary", weekStartIso],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agenda_week_summary" as any)
        .select("summary")
        .eq("week_start_date", weekStartIso)
        .maybeSingle();
      if (error) throw error;
      return (data as { summary: string | null } | null) ?? null;
    },
  });

  // ─── Tree shape per pillar ──────────────────────────────────────────

  const treeByPillar = useMemo(() => {
    const out: Record<Pillar, AgendaItemWithChildren[]> = {
      operations: [],
      sales_marketing: [],
      finance: [],
    };
    PILLARS.forEach((p) => {
      out[p] = buildTree(items.filter((i) => i.pillar === p));
    });
    return out;
  }, [items]);

  // ─── UI state ────────────────────────────────────────────────────────

  // Expanded set — defaults to "all expanded" because the spec wants
  // every item visible during meetings unless explicitly collapsed.
  // Auto-add newly-arrived items so children show immediately; never
  // remove an id here (the user's explicit collapses stick).
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  useEffect(() => {
    setExpanded((prev) => {
      let changed = false;
      const next = new Set(prev);
      items.forEach((i) => {
        if (!next.has(i.id)) {
          next.add(i.id);
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [items]);

  const toggleExpand = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const [detailItem, setDetailItem] = useState<AgendaItemWithChildren | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AgendaItemWithChildren | null>(null);
  const [addingTopicPillar, setAddingTopicPillar] = useState<Pillar | null>(null);
  const [draftTopicTitle, setDraftTopicTitle] = useState("");
  const [savingTopic, setSavingTopic] = useState(false);
  const [summaryDraft, setSummaryDraft] = useState<string | null>(null);
  const [savingSummary, setSavingSummary] = useState(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);

  // Counts powering the Reset Week button + confirm dialog. The button
  // enables when either there's something to reset (Reviewed tasks) OR
  // something to bump (tasks with a due_date that isn't already on the
  // new Friday). Both counts are shown to the user before they confirm.
  const reviewedCount = useMemo(
    () => items.filter((i) => i.status === "reviewed").length,
    [items],
  );
  const newFridayIso = useMemo(() => upcomingFridayIso(), [weekStartIso]);
  const bumpableCount = useMemo(
    () => items.filter((i) => i.due_date && i.due_date !== newFridayIso).length,
    [items, newFridayIso],
  );

  // ─── Mutations ──────────────────────────────────────────────────────

  const invalidateItems = () =>
    queryClient.invalidateQueries({ queryKey: ["agenda-items"] });

  const addItem = async (params: {
    pillar: Pillar;
    parent_id: string | null;
    depth: number;
    title: string;
  }) => {
    const sortOrder = Date.now();
    // Tasks (L2-L4) default to the upcoming Friday since the agenda is
    // a weekly cadence. L1 topics are containers and don't get a date.
    // User can still change it from either the row's Due cell or the
    // detail dialog.
    const defaultDueDate = params.depth >= 2 ? upcomingFridayIso() : null;
    const { data, error } = await supabase
      .from("agenda_items" as any)
      .insert({
        pillar: params.pillar,
        parent_id: params.parent_id,
        depth: params.depth,
        title: params.title,
        due_date: defaultDueDate,
        sort_order: sortOrder,
        created_by: user?.id ?? null,
      } as any)
      .select("id")
      .single();
    if (error) throw error;
    const newId = (data as { id: string }).id;
    await logAgendaActivity(newId, "created", user?.id ?? null, { title: params.title });
    await invalidateItems();
  };

  const updateMutation = useMutation({
    mutationFn: async (args: { id: string; patch: Record<string, any> }) => {
      const patch = { ...args.patch, last_edited_by: user?.id ?? null, last_edited_at: new Date().toISOString() };
      const { error } = await supabase
        .from("agenda_items" as any)
        .update(patch as any)
        .eq("id", args.id);
      if (error) throw error;
      return args;
    },
    onSuccess: ({ id, patch }) => {
      invalidateItems();
      // Log structural updates only — last_edited_* are bookkeeping.
      const tracked: Record<string, unknown> = {};
      for (const key of ["title", "status", "due_date", "owner_user_ids", "notes"]) {
        if (key in patch) tracked[key] = patch[key];
      }
      if (Object.keys(tracked).length > 0) {
        void logAgendaActivity(id, "updated", user?.id ?? null, tracked);
      }
      // Workbench sync: if status changed, mirror to all linked signals
      // so a Done on the Agenda becomes Complete on every pushed copy.
      if ("status" in patch) {
        void mirrorAgendaStatusToSignals(id, patch.status as AgendaStatus);
      }
    },
    onError: (e: any) => toast.error(e.message),
  });

  const archiveMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("agenda_items" as any)
        .update({ is_archived: true, archived_at: new Date().toISOString() } as any)
        .eq("id", id);
      if (error) throw error;
      return id;
    },
    onSuccess: (id) => {
      invalidateItems();
      void logAgendaActivity(id, "archived", user?.id ?? null);
      toast.success("Archived", {
        duration: 5000,
        action: {
          label: "Undo",
          onClick: async () => {
            await supabase
              .from("agenda_items" as any)
              .update({ is_archived: false, archived_at: null } as any)
              .eq("id", id);
            invalidateItems();
            void logAgendaActivity(id, "restored", user?.id ?? null);
          },
        },
      });
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Permanent delete — confirmed via AlertDialog. Cascade handles
  // children because the FK uses ON DELETE CASCADE.
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("agenda_items" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateItems();
      toast.success("Deleted");
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Duplicate — recursively copies the subtree. Returns the new root id
  // so the UI could focus it later if we wanted. We don't try to be
  // clever about parents; a duplicate sits as a sibling of the original.
  const duplicateItem = async (node: AgendaItemWithChildren) => {
    const cloneSubtree = async (
      n: AgendaItemWithChildren,
      newParentId: string | null,
    ): Promise<void> => {
      const { data, error } = await supabase
        .from("agenda_items" as any)
        .insert({
          pillar: n.pillar,
          parent_id: newParentId,
          depth: n.depth,
          title: n.title + (newParentId === null ? " (copy)" : ""),
          notes: n.notes,
          owner_user_ids: n.owner_user_ids,
          status: "pending_review", // duplicates start fresh — the user will review and re-stage as needed
          due_date: n.due_date,
          is_starred: n.is_starred,
          sort_order: Date.now() * 1000 + Math.floor(Math.random() * 1000),
          created_by: user?.id ?? null,
        } as any)
        .select("id")
        .single();
      if (error) throw error;
      const newId = (data as { id: string }).id;
      for (const child of n.children) {
        await cloneSubtree(child, newId);
      }
    };
    try {
      await cloneSubtree(node, node.parent_id);
      await invalidateItems();
      toast.success("Duplicated");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  // Drag-to-reorder: batch-update sort_order on the affected sibling
  // list. Same-parent only — a drop onto a different parent is ignored
  // so the tree shape stays intact. Cross-parent moves will live in
  // the indent/outdent buttons in the detail panel later.
  const reorderMutation = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      const updates = orderedIds.map((id, i) =>
        supabase
          .from("agenda_items" as any)
          .update({ sort_order: (i + 1) * 1000 } as any)
          .eq("id", id),
      );
      const results = await Promise.all(updates);
      const failed = results.find((r) => r.error);
      if (failed?.error) throw failed.error;
    },
    onSuccess: () => invalidateItems(),
    onError: (e: any) => {
      invalidateItems();
      toast.error(`Reorder failed: ${e.message}`);
    },
  });

  // Reset Week — the audit refresh button. Two things happen:
  //   1. Every Done task flips back to Pending Review (mirroring to any
  //      linked Workbench signals).
  //   2. Every non-archived task that already has a due_date gets bumped
  //      to the upcoming Friday so incomplete work rolls into the new
  //      week without manual date editing. Tasks with no due date are
  //      left alone — if someone explicitly cleared the date, Reset
  //      Week respects that choice.
  // Activity log records both actions per item so each task's history
  // still tells the truth ("Reviewed on Monday → Reset on Friday →
  // Reviewed again next week").
  const resetWeekMutation = useMutation({
    mutationFn: async () => {
      const newFriday = upcomingFridayIso();

      // 1) Flip Reviewed → Pending Review.
      const { data: reviewedItems, error: reviewedFetchErr } = await supabase
        .from("agenda_items" as any)
        .select("id")
        .eq("status", "reviewed")
        .eq("is_archived", false);
      if (reviewedFetchErr) throw reviewedFetchErr;
      const reviewedIds = ((reviewedItems as { id: string }[]) || []).map((i) => i.id);

      if (reviewedIds.length > 0) {
        const { error: reviewedUpdErr } = await supabase
          .from("agenda_items" as any)
          .update({
            status: "pending_review",
            last_edited_at: new Date().toISOString(),
            last_edited_by: user?.id ?? null,
          } as any)
          .in("id", reviewedIds);
        if (reviewedUpdErr) throw reviewedUpdErr;

        const { error: sigErr } = await supabase
          .from("signals")
          .update({ status: "Pending", completed_at: null } as any)
          .in("source_agenda_item_id", reviewedIds)
          .eq("status", "Complete");
        if (sigErr) console.warn("Reset: workbench mirror failed:", sigErr.message);
      }

      // 2) Bump existing due_dates forward to the new Friday. Skip any
      //    that are already on the new date (idempotent re-clicks).
      const { data: datedItems, error: dateFetchErr } = await supabase
        .from("agenda_items" as any)
        .select("id, due_date")
        .eq("is_archived", false)
        .not("due_date", "is", null)
        .neq("due_date", newFriday);
      if (dateFetchErr) throw dateFetchErr;
      const datedIds = ((datedItems as { id: string }[]) || []).map((i) => i.id);

      if (datedIds.length > 0) {
        const { error: dateUpdErr } = await supabase
          .from("agenda_items" as any)
          .update({
            due_date: newFriday,
            last_edited_at: new Date().toISOString(),
            last_edited_by: user?.id ?? null,
          } as any)
          .in("id", datedIds);
        if (dateUpdErr) throw dateUpdErr;
      }

      // Fire-and-forget activity log entries; failures here never
      // disrupt the user-visible reset. One entry per touched item.
      const touched = new Set<string>([...reviewedIds, ...datedIds]);
      await Promise.all(
        Array.from(touched).map((id) => {
          const changed: Record<string, unknown> = { reset: true };
          if (reviewedIds.includes(id)) changed.status = "pending_review";
          if (datedIds.includes(id)) changed.due_date = newFriday;
          return logAgendaActivity(id, "updated", user?.id ?? null, changed);
        }),
      );

      return {
        resetCount: reviewedIds.length,
        bumpedCount: datedIds.length,
        newFriday,
      };
    },
    onSuccess: ({ resetCount, bumpedCount, newFriday }) => {
      invalidateItems();
      if (resetCount === 0 && bumpedCount === 0) {
        toast.info("Nothing to reset — no Reviewed tasks and no dates to bump.");
        return;
      }
      const parts: string[] = [];
      if (resetCount > 0) {
        parts.push(`${resetCount} reset to Pending Review`);
      }
      if (bumpedCount > 0) {
        const friendly = new Date(newFriday + "T12:00:00").toLocaleDateString(
          "en-US",
          { month: "short", day: "numeric" },
        );
        parts.push(`${bumpedCount} due ${friendly}`);
      }
      toast.success(parts.join(" · "));
    },
    onError: (e: any) => toast.error(`Reset failed: ${e.message}`),
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  // Realtime channel. Three jobs in one subscription:
  //   1. Live-meeting collab: any change to agenda_items, attachments,
  //      links, or week_summary invalidates the relevant React Query
  //      key so other staff see the edit immediately.
  //   2. Reverse Workbench sync: when a signal with a
  //      source_agenda_item_id flips Pending↔Complete, mirror that
  //      back to the agenda item. mirrorSignalStatusToAgenda uses a
  //      `.neq` guard so loops can't form.
  //   3. Activity feed: any new agenda_activity_log row invalidates
  //      the matching detail-panel query so the feed stays live.
  useEffect(() => {
    const channel = supabase
      .channel("agenda-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "agenda_items" }, () => {
        queryClient.invalidateQueries({ queryKey: ["agenda-items"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "agenda_item_links" }, () => {
        queryClient.invalidateQueries({ queryKey: ["agenda-link-summary"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "agenda_attachments" }, () => {
        queryClient.invalidateQueries({ queryKey: ["agenda-attachment-summary"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "agenda_week_summary" }, () => {
        queryClient.invalidateQueries({ queryKey: ["agenda-week-summary"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "agenda_activity_log" }, (payload: any) => {
        const itemId = payload.new?.item_id ?? payload.old?.item_id;
        if (itemId) {
          queryClient.invalidateQueries({ queryKey: ["agenda-activity", itemId] });
        }
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "signals" }, (payload: any) => {
        const newRow = payload.new as { source_agenda_item_id: string | null; status: string } | null;
        const oldRow = payload.old as { status: string } | null;
        if (!newRow?.source_agenda_item_id) return;
        if (oldRow?.status === newRow.status) return;
        void mirrorSignalStatusToAgenda(newRow.source_agenda_item_id, newRow.status);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const activeData = active.data.current as { parentId: string | null } | undefined;
    const overData = over.data.current as { parentId: string | null } | undefined;
    // Same-parent only.
    if (!activeData || !overData) return;
    if ((activeData.parentId ?? null) !== (overData.parentId ?? null)) return;

    // Compute the new order of this parent's children.
    const siblings = items
      .filter((i) => (i.parent_id ?? null) === (activeData.parentId ?? null))
      .sort((a, b) => a.sort_order - b.sort_order);
    const oldIndex = siblings.findIndex((s) => s.id === active.id);
    const newIndex = siblings.findIndex((s) => s.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(siblings, oldIndex, newIndex);
    reorderMutation.mutate(reordered.map((s) => s.id));
  };

  // Week summary — upsert per current week
  const saveSummary = async (text: string) => {
    setSavingSummary(true);
    try {
      const { error } = await supabase
        .from("agenda_week_summary" as any)
        .upsert(
          {
            week_start_date: weekStartIso,
            summary: text,
            updated_by: user?.id ?? null,
            updated_at: new Date().toISOString(),
          } as any,
          { onConflict: "week_start_date" },
        );
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["agenda-week-summary", weekStartIso] });
      setSummaryDraft(null);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSavingSummary(false);
    }
  };

  // ─── Render ─────────────────────────────────────────────────────────

  const renderPillarSection = (pillar: Pillar) => {
    const color = PILLAR_COLOR[pillar];
    const label = PILLAR_LABEL[pillar];
    const tree = treeByPillar[pillar];
    const allFlat = tree.flatMap((t) => flattenSubtree(t));
    const totalCount = allFlat.length;
    const reviewedCountPillar = allFlat.filter((i) => i.status === "reviewed").length;
    const isAdding = addingTopicPillar === pillar;

    return (
      <section key={pillar} className="space-y-3">
        <div className="flex items-center gap-3">
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
          <h2
            className="text-lg font-bold uppercase tracking-wide"
            style={{ color }}
          >
            {label}
          </h2>
          <span className="text-xs text-zinc-600">
            {totalCount === 0
              ? "· empty"
              : `· ${reviewedCountPillar}/${totalCount} reviewed`}
          </span>
        </div>

        <div
          className="rounded-xl border-2 p-3"
          style={{
            borderColor: `${color}30`,
            background: `${color}08`,
          }}
        >
          {tree.length === 0 && !isAdding && (
            <p className="text-xs text-zinc-500 italic text-center py-4">
              No agenda topics yet. Add your first one.
            </p>
          )}

          {/* One DndContext per pillar so drags can't cross pillars
              (per spec). L1 items here are the top-level sortable list;
              each row internally wraps its own children in another
              SortableContext so nested levels reorder independently. */}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={tree.map((t) => t.id)}
              strategy={verticalListSortingStrategy}
            >
              {tree.map((node, idx) => (
                <AgendaItemRow
                  key={node.id}
                  node={node}
                  index={idx}
                  staff={staff}
                  agendaFocusByManager={agendaFocusByManager}
                  attachmentsByItem={attachmentsByItem}
                  linksByItem={linksByItem}
                  expanded={expanded}
                  onToggleExpand={toggleExpand}
                  onOpenDetail={(it) => setDetailItem(it)}
                  onSetStatus={(id, status) =>
                    updateMutation.mutate({ id, patch: { status } })
                  }
                  onChangeOwners={(id, userIds) =>
                    updateMutation.mutate({ id, patch: { owner_user_ids: userIds } })
                  }
                  onSetDueDate={(id, due_date) =>
                    updateMutation.mutate({ id, patch: { due_date } })
                  }
                  onUpdateNotes={(id, notes) =>
                    updateMutation.mutate({ id, patch: { notes } })
                  }
                  onAddChild={(parent, title) =>
                    addItem({
                      pillar: parent.pillar,
                      parent_id: parent.id,
                      depth: Math.min(parent.depth + 1, 4),
                      title,
                    })
                  }
                  onArchive={(id) => archiveMutation.mutate(id)}
                  onDuplicate={(node) => duplicateItem(node)}
                  onDelete={(node) => setDeleteTarget(node)}
                />
              ))}
            </SortableContext>
          </DndContext>

          {isAdding ? (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const t = draftTopicTitle.trim();
                if (!t) return;
                setSavingTopic(true);
                try {
                  await addItem({ pillar, parent_id: null, depth: 1, title: t });
                  setDraftTopicTitle("");
                  setAddingTopicPillar(null);
                } catch (err: any) {
                  toast.error(err.message);
                } finally {
                  setSavingTopic(false);
                }
              }}
              className="flex items-center gap-2 mt-2 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.08]"
            >
              <input
                autoFocus
                value={draftTopicTitle}
                onChange={(e) => setDraftTopicTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setAddingTopicPillar(null);
                    setDraftTopicTitle("");
                  }
                }}
                placeholder="New Agenda Topic…"
                disabled={savingTopic}
                className="flex-1 bg-transparent outline-none text-sm text-white"
              />
              <button
                type="submit"
                disabled={!draftTopicTitle.trim() || savingTopic}
                className="text-xs font-semibold px-3 py-1 rounded text-white disabled:opacity-40"
                style={{ background: color }}
              >
                {savingTopic ? "Saving…" : "Add Agenda Topic"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setAddingTopicPillar(null);
                  setDraftTopicTitle("");
                }}
                className="text-xs text-white/40 hover:text-white/70"
              >
                Cancel
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setAddingTopicPillar(pillar)}
              className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-white/50 hover:text-white/80 transition-colors px-3 py-2"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Agenda Topic
            </button>
          )}
        </div>
      </section>
    );
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="border-b border-white/[0.06] bg-[#09090b]/80 backdrop-blur-md sticky top-0 z-30">
        <div className="px-4 sm:px-6 py-3 flex items-center justify-between gap-3 max-w-screen-2xl mx-auto">
          <div className="flex items-center gap-3 min-w-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/admin/dashboard")}
              className="text-zinc-400 hover:text-white hover:bg-white/5 flex-shrink-0"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-base font-bold tracking-tight text-white leading-none">
                Weekly Agenda
              </h1>
              <p className="text-[10px] text-zinc-500 mt-0.5 truncate">
                {formatWeekRangeDisplay(weekStartIso)}
              </p>
            </div>
          </div>

          {/* Reset Week — enabled when there's either Reviewed tasks to
              reset OR existing due dates to bump forward. */}
          <Button
            variant="ghost"
            size="sm"
            disabled={
              (reviewedCount === 0 && bumpableCount === 0) ||
              resetWeekMutation.isPending
            }
            onClick={() => setResetConfirmOpen(true)}
            className="text-zinc-400 hover:text-white hover:bg-white/[0.06] gap-1.5 disabled:opacity-40"
            title={
              reviewedCount === 0 && bumpableCount === 0
                ? "Nothing to reset — no Reviewed tasks and no dates to bump"
                : `Reset ${reviewedCount} Reviewed · bump ${bumpableCount} due dates to next Friday`
            }
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="text-xs font-semibold hidden sm:inline">
              Reset Week
            </span>
            {reviewedCount + bumpableCount > 0 && (
              <span className="text-[10px] tabular-nums text-zinc-500">
                ({reviewedCount + bumpableCount})
              </span>
            )}
          </Button>
        </div>
      </header>

      <main className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-8 space-y-10">
        <div className="text-center">
          <h2 className="text-5xl sm:text-6xl font-black tracking-tight text-white">
            AGENDA
          </h2>
          <p className="mt-2 text-xs uppercase tracking-[0.25em] text-zinc-600">
            Weekly Review
          </p>
        </div>

        {/* Week summary — editable */}
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-5">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              Week Summary
            </h3>
            {summaryDraft === null ? (
              <button
                type="button"
                onClick={() => setSummaryDraft(weekSummaryRow?.summary ?? "")}
                className="text-[10px] text-zinc-500 hover:text-white transition-colors"
              >
                {weekSummaryRow?.summary ? "Edit" : "Add"}
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSummaryDraft(null)}
                  className="text-[10px] text-zinc-500 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => saveSummary(summaryDraft ?? "")}
                  disabled={savingSummary}
                  className="text-[10px] font-semibold text-white bg-white/10 hover:bg-white/20 px-2 py-1 rounded disabled:opacity-40"
                >
                  {savingSummary ? "Saving…" : "Save"}
                </button>
              </div>
            )}
          </div>
          {summaryDraft === null ? (
            weekSummaryRow?.summary ? (
              <p className="text-sm text-zinc-300 whitespace-pre-wrap leading-relaxed">
                {weekSummaryRow.summary}
              </p>
            ) : (
              <p className="text-sm text-zinc-600 italic">
                The week's theme, wins, or heads-ups go here.
              </p>
            )
          ) : (
            <Textarea
              autoFocus
              value={summaryDraft ?? ""}
              onChange={(e) => setSummaryDraft(e.target.value)}
              className="bg-white/[0.04] border-white/[0.08] text-white text-sm min-h-[80px]"
              placeholder="What's the focus this week?"
            />
          )}
        </div>

        {PILLARS.map((p) => renderPillarSection(p))}
      </main>

      <AgendaItemDetailDialog
        item={detailItem}
        staff={staff}
        open={!!detailItem}
        onClose={() => setDetailItem(null)}
        onSave={async (patch) => {
          if (!detailItem) return;
          await updateMutation.mutateAsync({ id: detailItem.id, patch });
        }}
      />

      {/* Floating Workbenches drawer — always accessible on the agenda
          page regardless of scroll position. Click the FAB to slide
          out a panel showing each eligible staffer's pushed-from-agenda
          signals. Per-row Send button is the primary add mechanism;
          this drawer is the at-a-glance read + remove surface. */}
      <WorkbenchesDrawer
        staff={staff}
        agendaFocusByManager={agendaFocusByManager}
      />

      <AlertDialog open={resetConfirmOpen} onOpenChange={setResetConfirmOpen}>
        <AlertDialogContent className="bg-neutral-900 border-white/10 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">
              Reset this week's agenda?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              This flips{" "}
              <strong className="text-white">{reviewedCount}</strong>{" "}
              Reviewed task{reviewedCount === 1 ? "" : "s"} back to{" "}
              <strong className="text-white">Pending Review</strong> and bumps{" "}
              <strong className="text-white">{bumpableCount}</strong>{" "}
              task{bumpableCount === 1 ? "" : "s"} with a due date to{" "}
              <strong className="text-white">
                {new Date(newFridayIso + "T12:00:00").toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}
              </strong>{" "}
              (next Friday). Tasks with no due date are left alone. Each
              item's activity log records the change, and any linked
              Workbench signals are mirrored back to Pending.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-white/[0.04] border-white/10 text-white hover:bg-white/10">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-500 hover:bg-red-600 text-white"
              onClick={() => {
                resetWeekMutation.mutate();
                setResetConfirmOpen(false);
              }}
            >
              Reset Week
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}
      >
        <AlertDialogContent className="bg-neutral-900 border-white/10 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">
              Delete this item?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              {deleteTarget && deleteTarget.children.length > 0 ? (
                <>
                  <strong className="text-red-400">"{deleteTarget.title}"</strong> has{" "}
                  {flattenSubtree(deleteTarget).length - 1} sub-item
                  {flattenSubtree(deleteTarget).length - 1 === 1 ? "" : "s"} that will
                  also be permanently deleted. Use Archive if you want to keep them.
                </>
              ) : (
                <>This permanently deletes the item. Use Archive if you might need it later.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-white/[0.04] border-white/10 text-white hover:bg-white/10">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-500 hover:bg-red-600 text-white"
              onClick={() => {
                if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
                setDeleteTarget(null);
              }}
            >
              Delete permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminAgenda;
