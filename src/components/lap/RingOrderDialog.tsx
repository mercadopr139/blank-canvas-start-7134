// Reorder the ring (Josh, 2026-10-19): drag a checkpoint up or down its
// pillar and watch the ring redraw as you go. Pillars keep their order on
// the ring (Operations, Sales & Marketing, Finance); a pillar pill on a row
// moves a checkpoint to the end of another pillar. Every drop is saved at
// once, so a lap in progress follows the new order from its next step.
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Check, Loader2 } from "lucide-react";
import LapRing from "@/components/lap/LapRing";
import { PILLAR_ORDER, PILLAR_LABEL, runningOrder, type Pillar, type RingTopic } from "@/lib/lap/ring";
import { PILLAR_COLOR } from "@/lib/lap/commitments";

export interface OrderTopic extends RingTopic { sort_order: number; this_lap_only_lap_id: string | null }

const Row = ({ t, onPillar }: { t: OrderTopic; onPillar: (p: Pillar) => void }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: t.id });
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }} className="flex items-center gap-2 rounded-lg px-1.5 py-1.5 hover:bg-white/[0.04]">
      <button {...attributes} {...listeners} type="button" className="text-white/25 hover:text-white/60 cursor-grab active:cursor-grabbing touch-none shrink-0" title="Drag to reorder" aria-label="Drag to reorder">
        <GripVertical className="w-4 h-4" />
      </button>
      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: PILLAR_COLOR[t.pillar] }} />
      <span className="flex-1 min-w-0 truncate text-sm text-white/90">{t.title}{t.this_lap_only_lap_id && <span className="ml-2 text-[10px] uppercase tracking-wide text-white/35">this lap only</span>}</span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" className="shrink-0 rounded-full border border-white/15 bg-white/[0.04] px-2 py-0.5 text-[11px] font-medium text-white/50 hover:text-white hover:border-white/30" title="Move to another pillar">{PILLAR_LABEL[t.pillar]}</button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52 bg-neutral-900 border-white/[0.08] shadow-2xl text-white">
          <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-zinc-500">Move to a pillar</DropdownMenuLabel>
          {PILLAR_ORDER.map((p) => (
            <DropdownMenuItem key={p} onSelect={() => onPillar(p)} className="cursor-pointer text-white/85 focus:text-white focus:bg-white/10">
              <span className="w-4 mr-1.5 inline-flex justify-center">{p === t.pillar ? <Check className="w-3.5 h-3.5 text-[#bf0f3e]" /> : <span className="w-2 h-2 rounded-full" style={{ backgroundColor: PILLAR_COLOR[p] }} />}</span>{PILLAR_LABEL[p]}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
};

const RingOrderDialog = ({ open, topics, onClose }: { open: boolean; topics: OrderTopic[]; onClose: () => void }) => {
  const qc = useQueryClient();
  const [list, setList] = useState<OrderTopic[]>([]);
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (open) setList(runningOrder(topics) as OrderTopic[]); }, [open, topics]);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  );
  const byPillar = (p: Pillar) => list.filter((t) => t.pillar === p);

  /** Save the whole order: sort_order is the position in the running order; a pillar change rides along. */
  const persist = async (next: OrderTopic[]) => {
    setSaving(true);
    const ordered = runningOrder(next) as OrderTopic[];
    const changes = ordered
      .map((t, i) => ({ t, sort_order: i + 1 }))
      .filter(({ t, sort_order }) => { const was = topics.find((x) => x.id === t.id); return !was || was.sort_order !== sort_order || was.pillar !== t.pillar; });
    const results = await Promise.all(changes.map(({ t, sort_order }) => supabase.from("lap_topics" as never).update({ sort_order, pillar: t.pillar, updated_at: new Date().toISOString() } as never).eq("id", t.id)));
    setSaving(false);
    const failed = results.find((r) => r.error);
    if (failed?.error) { toast.error(`The order didn't save: ${failed.error.message}`); return; }
    qc.invalidateQueries({ queryKey: ["lap-topics"] });
    qc.invalidateQueries({ queryKey: ["lap-topics-for-pin"] });
  };

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const a = list.find((t) => t.id === active.id), b = list.find((t) => t.id === over.id);
    if (!a || !b || a.pillar !== b.pillar) return;
    const mine = byPillar(a.pillar);
    const moved = arrayMove(mine, mine.findIndex((t) => t.id === a.id), mine.findIndex((t) => t.id === b.id));
    const next = PILLAR_ORDER.flatMap((p) => (p === a.pillar ? moved : byPillar(p)));
    setList(next);
    void persist(next);
  };
  const movePillar = (t: OrderTopic, p: Pillar) => {
    if (t.pillar === p) return;
    const next = PILLAR_ORDER.flatMap((q) => [...byPillar(q).filter((x) => x.id !== t.id), ...(q === p ? [{ ...t, pillar: p }] : [])]);
    setList(next);
    void persist(next);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="bg-[#1a1a2e] border-white/10 text-white max-w-5xl">
        <DialogHeader>
          <DialogTitle className="inline-flex items-center gap-2">Reorder the ring {saving && <Loader2 className="w-4 h-4 animate-spin text-white/50" />}</DialogTitle>
          <DialogDescription className="text-white/60">Drag a checkpoint up or down its pillar. The ring redraws as you go, and every drop is saved. Pillars keep their place on the ring; the pill on a row moves a checkpoint to another pillar.</DialogDescription>
        </DialogHeader>
        <div className="grid lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] gap-6 items-start">
          <div className="min-w-0">
            <LapRing topics={list} currentIndex={-1} visited={new Set()} flags={{}} size={420} />
          </div>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
              {PILLAR_ORDER.map((p) => {
                const mine = byPillar(p);
                return (
                  <div key={p}>
                    <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: PILLAR_COLOR[p] }}>{PILLAR_LABEL[p]} · {mine.length}</p>
                    {mine.length === 0 && <p className="text-[12px] text-white/35 px-1.5">No checkpoints here. Move one in with its pill.</p>}
                    <SortableContext items={mine.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                      <ul className="space-y-0.5">{mine.map((t) => <Row key={t.id} t={t} onPillar={(q) => movePillar(t, q)} />)}</ul>
                    </SortableContext>
                  </div>
                );
              })}
            </div>
          </DndContext>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RingOrderDialog;
