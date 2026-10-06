// The Juniors checklist editor: categories and tasks, with drag and drop.
//
// Tasks are dragged by their handle: up and down within a category, and
// across categories, landing in an empty one too. One sortable list per
// category inside one drag context -- the pattern that works in this app
// (Edit Excursion), not nested sortables, which fought dnd-kit in Today's
// Plan. Categories keep their arrows. Star, switch off, photo and delete sit
// on each row; a photo shows the kids the proper set-up on the board.
import { useEffect, useState } from "react";
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors, useDroppable, pointerWithin,
  type DragStartEvent, type DragOverEvent, type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Star, Plus, Trash2, ArrowUp, ArrowDown, Camera, X, Loader2, GripVertical } from "lucide-react";
import { type JuniorsCategory, type JuniorsTask, placeTask } from "@/lib/juniors";
import { resizePhoto } from "@/lib/imageResize";

const GOLD = "#f2c230";
const NLA_RED = "#bf0f3e";

const tbl = (name: string) => supabase.from(name as never) as never as {
  insert: (v: unknown) => Promise<{ error: { message: string } | null }>;
  update: (v: unknown) => { eq: (k: string, v: string) => Promise<{ error: { message: string } | null }> };
  delete: () => { eq: (k: string, v: string) => Promise<{ error: { message: string } | null }> };
};

const inCat = (list: JuniorsTask[], catId: string) =>
  list.filter((t) => t.category_id === catId).sort((a, b) => a.sort_order - b.sort_order);

const JuniorsChecklistEditor = ({ categories, tasks, onChange }: { categories: JuniorsCategory[]; tasks: JuniorsTask[]; onChange: () => void }) => {
  const [newCat, setNewCat] = useState("");
  const [newTask, setNewTask] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState<string | null>(null);
  // The list as it is being dragged; follows the server between drags.
  const [local, setLocal] = useState<JuniorsTask[]>(tasks);
  const [dragging, setDragging] = useState<JuniorsTask | null>(null);
  useEffect(() => { if (!dragging) setLocal(tasks); }, [tasks, dragging]);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const sortedCats = [...categories].sort((a, b) => a.sort_order - b.sort_order);
  const taskById = (list: JuniorsTask[], id: string) => list.find((t) => t.id === id) ?? null;

  // Where a drag is hovering: a task's slot, or an (empty) category box.
  const targetOf = (list: JuniorsTask[], overId: string): { catId: string; index: number } | null => {
    if (overId.startsWith("cat:")) { const catId = overId.slice(4); return { catId, index: inCat(list, catId).length }; }
    const t = taskById(list, overId);
    if (!t) return null;
    return { catId: t.category_id, index: inCat(list, t.category_id).findIndex((x) => x.id === overId) };
  };

  const onDragStart = (e: DragStartEvent) => setDragging(taskById(local, String(e.active.id)));
  const onDragOver = (e: DragOverEvent) => {
    if (!dragging || !e.over) return;
    const current = taskById(local, dragging.id);
    const target = targetOf(local, String(e.over.id));
    if (!current || !target || current.category_id === target.catId) return; // same list: the sortable previews it
    setLocal((l) => placeTask(l, current, target.catId, target.index));
  };
  const onDragEnd = async (e: DragEndEvent) => {
    const moving = dragging;
    setDragging(null);
    if (!moving || !e.over) return;
    const current = taskById(local, moving.id) ?? moving;
    const target = targetOf(local, String(e.over.id));
    if (!target) return;
    const next = placeTask(local, current, target.catId, target.index);
    setLocal(next);
    // Persist only what changed: category or position.
    const before = new Map(tasks.map((t) => [t.id, t]));
    const changed = next.filter((t) => { const b = before.get(t.id); return !b || b.category_id !== t.category_id || b.sort_order !== t.sort_order; });
    for (const t of changed) {
      const { error } = await tbl("juniors_tasks").update({ category_id: t.category_id, sort_order: t.sort_order }).eq("id", t.id);
      if (error) { toast.error(error.message); break; }
    }
    onChange();
  };

  const addCategory = async () => {
    if (!newCat.trim()) return;
    const sort = Math.max(0, ...categories.map((c) => c.sort_order)) + 10;
    const { error } = await tbl("juniors_categories").insert({ title: newCat.trim(), sort_order: sort });
    if (error) { toast.error(error.message); return; }
    setNewCat(""); onChange();
  };
  const addTask = async (c: JuniorsCategory) => {
    const title = (newTask[c.id] ?? "").trim();
    if (!title) return;
    const sort = Math.max(0, ...tasks.filter((t) => t.category_id === c.id).map((t) => t.sort_order)) + 10;
    const { error } = await tbl("juniors_tasks").insert({ category_id: c.id, title, sort_order: sort });
    if (error) { toast.error(error.message); return; }
    setNewTask((p) => ({ ...p, [c.id]: "" })); onChange();
  };
  const patch = async (table: string, id: string, v: Record<string, unknown>) => {
    const { error } = await tbl(table).update(v).eq("id", id);
    if (error) { toast.error(error.message); return; }
    onChange();
  };
  const remove = async (table: string, id: string, label: string) => {
    if (!window.confirm(`Delete "${label}"? Use the switch to hide it instead if it might come back.`)) return;
    const { error } = await tbl(table).delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    onChange();
  };
  const moveCat = async (id: string, dir: -1 | 1) => {
    const i = sortedCats.findIndex((x) => x.id === id); const j = i + dir;
    if (i < 0 || j < 0 || j >= sortedCats.length) return;
    const a = sortedCats[i], b = sortedCats[j];
    const sa = a.sort_order === b.sort_order ? b.sort_order + dir : b.sort_order;
    await tbl("juniors_categories").update({ sort_order: sa }).eq("id", a.id);
    await tbl("juniors_categories").update({ sort_order: a.sort_order }).eq("id", b.id);
    onChange();
  };
  // Every photo is shrunk in the browser first: a 1600 px JPEG for the pop-up
  // and a 240 px thumbnail for the list. A phone original is 5 MB; these two
  // together are under 300 KB.
  const storePhoto = async (table: string, id: string, source: Blob): Promise<{ photo_url: string; thumb_url: string }> => {
    const { full, thumb } = await resizePhoto(source);
    const base = `juniors/${table === "juniors_tasks" ? "task" : "category"}_${id}_${Date.now()}`;
    const bucket = supabase.storage.from("site-images");
    const up = async (path: string, blob: Blob) => {
      const { error } = await bucket.upload(path, blob, { upsert: true, contentType: "image/jpeg" });
      if (error) throw new Error(error.message);
      return bucket.getPublicUrl(path).data.publicUrl;
    };
    const [photo_url, thumb_url] = await Promise.all([up(`${base}_full.jpg`, full), up(`${base}_thumb.jpg`, thumb)]);
    return { photo_url, thumb_url };
  };
  const upload = async (table: string, id: string, file: File) => {
    setUploading(id);
    try {
      const urls = await storePhoto(table, id, file);
      await patch(table, id, urls);
      toast.success("Photo added.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(null);
    }
  };
  // Photos uploaded before shrinking existed: fetch each original, shrink it,
  // store the two sizes, and point the row at them.
  const [shrinking, setShrinking] = useState(false);
  const pending = [...tasks.map((t) => ({ table: "juniors_tasks", row: t })), ...categories.map((c) => ({ table: "juniors_categories", row: c }))]
    .filter(({ row }) => row.photo_url && !row.thumb_url);
  const shrinkExisting = async () => {
    setShrinking(true);
    let done = 0;
    try {
      for (const { table, row } of pending) {
        const res = await fetch(row.photo_url!);
        if (!res.ok) throw new Error(`Couldn't fetch a photo (${res.status}).`);
        const urls = await storePhoto(table, row.id, await res.blob());
        const { error } = await tbl(table).update(urls).eq("id", row.id);
        if (error) throw new Error(error.message);
        done++;
      }
      toast.success(`Shrunk ${done} photo${done === 1 ? "" : "s"}.`);
    } catch (e) {
      toast.error(`${(e as Error).message} (${done} done)`);
    } finally {
      setShrinking(false);
      onChange();
    }
  };

  const PhotoButton = ({ table, row }: { table: string; row: { id: string; photo_url: string | null; thumb_url?: string | null } }) => (
    <label className="inline-flex items-center gap-1 text-xs text-white/50 hover:text-white cursor-pointer" title={row.photo_url ? "Replace photo" : "Add a photo of the proper set-up"}>
      {uploading === row.id ? <Loader2 className="w-4 h-4 animate-spin" /> : row.photo_url ? <img src={row.thumb_url ?? row.photo_url} alt="" loading="lazy" className="w-8 h-8 rounded object-cover ring-1 ring-white/20" /> : <Camera className="w-4 h-4" />}
      <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(table, row.id, f); e.currentTarget.value = ""; }} />
      {row.photo_url && <button type="button" className="text-white/30 hover:text-rose-300" title="Remove photo" onClick={(e) => { e.preventDefault(); patch(table, row.id, { photo_url: null, thumb_url: null }); }}><X className="w-3 h-3" /></button>}
    </label>
  );

  return (
    <div className="space-y-4">
      <p className="text-xs text-white/40">Drag a task by its handle to reorder it or move it to another category. Starred tasks sit at the top of their category on the board. A photo shows the kids the proper set-up. The switch hides a task without deleting it.</p>
      {pending.length > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-sm">
          <span className="text-amber-200">{pending.length} photo{pending.length === 1 ? " is" : "s are"} still full phone size and slow the board down.</span>
          <Button size="sm" onClick={shrinkExisting} disabled={shrinking} className="ml-auto h-8 bg-amber-500 hover:bg-amber-400 text-black font-bold">
            {shrinking ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}{shrinking ? "Shrinking…" : "Shrink photos"}
          </Button>
        </div>
      )}
      <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd} onDragCancel={() => setDragging(null)}>
        {sortedCats.map((c) => {
          const ts = inCat(local, c.id);
          return (
            <Card key={c.id} className={`bg-white/[0.03] border-white/10 text-white ${c.is_active ? "" : "opacity-60"}`}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Input defaultValue={c.title} onBlur={(e) => e.target.value.trim() && e.target.value !== c.title && patch("juniors_categories", c.id, { title: e.target.value.trim() })}
                    className="h-9 bg-transparent border-transparent hover:border-neutral-700 focus:border-neutral-600 text-white font-black uppercase tracking-wider max-w-xs" />
                  <PhotoButton table="juniors_categories" row={c} />
                  <div className="ml-auto flex items-center gap-1">
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-white/40 hover:text-white" onClick={() => moveCat(c.id, -1)}><ArrowUp className="w-4 h-4" /></Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-white/40 hover:text-white" onClick={() => moveCat(c.id, 1)}><ArrowDown className="w-4 h-4" /></Button>
                    <Switch checked={c.is_active} onCheckedChange={(v) => patch("juniors_categories", c.id, { is_active: v })} />
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-white/30 hover:text-rose-300" onClick={() => remove("juniors_categories", c.id, c.title)}><Trash2 className="w-4 h-4" /></Button>
                  </div>
                </div>
                <CategoryDrop id={c.id} active={!!dragging}>
                  <SortableContext items={ts.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                    {ts.map((t) => (
                      <TaskRow key={t.id} task={t}>
                        <button onClick={() => patch("juniors_tasks", t.id, { starred: !t.starred })} title={t.starred ? "Unstar" : "Star as important"} className="shrink-0">
                          <Star className="w-4 h-4" style={t.starred ? { color: GOLD, fill: GOLD } : { color: "rgba(255,255,255,0.25)" }} />
                        </button>
                        <div className="flex-1 min-w-0">
                          <Input defaultValue={t.title} onBlur={(e) => e.target.value.trim() && e.target.value !== t.title && patch("juniors_tasks", t.id, { title: e.target.value.trim() })}
                            className="h-8 bg-transparent border-transparent hover:border-neutral-700 focus:border-neutral-600 text-white text-sm" />
                          <Textarea defaultValue={t.details ?? ""} placeholder="Optional detail shown under the task" rows={1}
                            onBlur={(e) => (e.target.value.trim() || null) !== (t.details ?? null) && patch("juniors_tasks", t.id, { details: e.target.value.trim() || null })}
                            className="mt-0.5 min-h-0 h-7 py-1 bg-transparent border-transparent hover:border-neutral-700 focus:border-neutral-600 text-white/60 text-xs resize-none" />
                        </div>
                        <PhotoButton table="juniors_tasks" row={t} />
                        <Switch checked={t.is_active} onCheckedChange={(v) => patch("juniors_tasks", t.id, { is_active: v })} />
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-white/30 hover:text-rose-300" onClick={() => remove("juniors_tasks", t.id, t.title)}><Trash2 className="w-3.5 h-3.5" /></Button>
                      </TaskRow>
                    ))}
                  </SortableContext>
                  <div className="flex items-center gap-2 px-3 py-2">
                    <Plus className="w-4 h-4 text-white/30" />
                    <Input value={newTask[c.id] ?? ""} onChange={(e) => setNewTask((p) => ({ ...p, [c.id]: e.target.value }))} onKeyDown={(e) => { if (e.key === "Enter") addTask(c); }}
                      placeholder="Add a task and press Enter" className="h-8 bg-transparent border-transparent hover:border-neutral-700 focus:border-neutral-600 text-white text-sm" />
                  </div>
                </CategoryDrop>
              </CardContent>
            </Card>
          );
        })}
        <DragOverlay dropAnimation={null}>
          {dragging && (
            <div className="rounded-lg border border-white/30 bg-neutral-900 px-3 py-2 text-sm text-white shadow-2xl flex items-center gap-2">
              <GripVertical className="w-4 h-4 text-white/40" />
              {dragging.starred && <Star className="w-4 h-4" style={{ color: GOLD, fill: GOLD }} />}
              {dragging.title}
            </div>
          )}
        </DragOverlay>
      </DndContext>
      <div className="flex items-center gap-2">
        <Input value={newCat} onChange={(e) => setNewCat(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addCategory(); }} placeholder="New category…" className="h-9 max-w-xs bg-neutral-900 border-neutral-700 text-white" />
        <Button onClick={addCategory} disabled={!newCat.trim()} className="h-9 text-white font-bold" style={{ backgroundColor: NLA_RED }}><Plus className="w-4 h-4 mr-1" /> Category</Button>
      </div>
    </div>
  );
};

// A category's task list is a drop target too, so a task can land in an empty one.
const CategoryDrop = ({ id, active, children }: { id: string; active: boolean; children: React.ReactNode }) => {
  const { setNodeRef, isOver } = useDroppable({ id: `cat:${id}` });
  return (
    <div ref={setNodeRef} className={`divide-y divide-white/[0.06] rounded-lg border transition-colors ${isOver && active ? "border-[#f2c230]/60 bg-[#f2c230]/[0.04]" : "border-white/10"}`}>
      {children}
    </div>
  );
};

// One task row: a grip to drag by, then the row's controls.
const TaskRow = ({ task, children }: { task: JuniorsTask; children: React.ReactNode }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-2 px-3 py-2 ${task.is_active ? "" : "opacity-50"} ${isDragging ? "opacity-30" : ""}`}>
      <button {...attributes} {...listeners} className="shrink-0 cursor-grab active:cursor-grabbing text-white/30 hover:text-white touch-none" title="Drag to reorder or move" aria-label="Drag">
        <GripVertical className="w-4 h-4" />
      </button>
      {children}
    </div>
  );
};

export default JuniorsChecklistEditor;
