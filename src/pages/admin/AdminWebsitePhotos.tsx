import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useStaffPermissions } from "@/hooks/useStaffPermissions";
import { useSiteImages, type SiteImageRow } from "@/hooks/useSiteImages";
import {
  SITE_IMAGE_GROUPS,
  defaultToken,
  resolveDefaultToken,
  type SiteImageGroup,
} from "@/config/siteImages";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft,
  Upload,
  Trash2,
  ChevronUp,
  ChevronDown,
  Plus,
  Loader2,
  RotateCcw,
  Save,
  ImageIcon,
  GripVertical,
} from "lucide-react";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// The resolved preview src for a stored token (a Storage URL or a default-token).
const previewOf = (token: string): string => resolveDefaultToken(token)?.src ?? token;

// Upload a file to the public site-images bucket and return its public URL.
async function uploadImage(file: File): Promise<string> {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage
    .from("site-images")
    .upload(path, file, { upsert: true, contentType: file.type || undefined });
  if (error) throw error;
  const { data } = supabase.storage.from("site-images").getPublicUrl(path);
  return data.publicUrl;
}

type EditItem = { uid: string; token: string; alt: string; caption: string };

const toEditItems = (group: SiteImageGroup, rows: SiteImageRow[]): EditItem[] => {
  if (rows.length) {
    return rows.map((r) => {
      const def = resolveDefaultToken(r.url);
      return {
        uid: r.id,
        token: r.url,
        alt: r.alt ?? def?.alt ?? "",
        caption: r.caption ?? def?.caption ?? "",
      };
    });
  }
  return group.defaults.map((d, i) => ({
    uid: `def-${i}`,
    token: defaultToken(group.key, i),
    alt: d.alt,
    caption: d.caption ?? "",
  }));
};

// Wraps a photo card so it can be dragged to reorder (galleries only). Shows a
// grip handle in the corner; the up/down arrows remain as a touch-friendly
// fallback.
const SortablePhotoCard = ({ id, draggable, children }: { id: string; draggable: boolean; children: ReactNode }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled: !draggable });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 50 : undefined,
  };
  return (
    <div ref={setNodeRef} style={style} className="relative">
      {draggable && (
        <button
          {...attributes}
          {...listeners}
          type="button"
          className="absolute top-1 left-1 z-10 p-1 rounded bg-black/60 text-white/60 hover:text-white cursor-grab active:cursor-grabbing"
          title="Drag to reorder"
        >
          <GripVertical className="w-3.5 h-3.5" />
        </button>
      )}
      {children}
    </div>
  );
};

const GroupEditor = ({
  group,
  rows,
  onSaved,
}: {
  group: SiteImageGroup;
  rows: SiteImageRow[];
  onSaved: () => void;
}) => {
  const [items, setItems] = useState<EditItem[]>(() => toEditItems(group, rows));
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const addInputRef = useRef<HTMLInputElement>(null);
  const isGallery = group.kind === "gallery";

  const mutate = (next: EditItem[]) => {
    setItems(next);
    setDirty(true);
  };

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((it) => it.uid === active.id);
    const newIndex = items.findIndex((it) => it.uid === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    mutate(arrayMove(items, oldIndex, newIndex));
  };

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    mutate(next);
  };
  const remove = (i: number) => mutate(items.filter((_, idx) => idx !== i));
  const setAlt = (i: number, v: string) => mutate(items.map((it, idx) => (idx === i ? { ...it, alt: v } : it)));
  const setCaption = (i: number, v: string) => mutate(items.map((it, idx) => (idx === i ? { ...it, caption: v } : it)));

  const uploadTo = async (target: number | "new", file: File) => {
    setBusy(true);
    try {
      const url = await uploadImage(file);
      if (target === "new") {
        // New photos land at the front (recent first); reorder by drag/arrows.
        setItems((prev) => [{ uid: `up-${Date.now()}`, token: url, alt: "", caption: "" }, ...prev]);
      } else {
        setItems((prev) => prev.map((it, idx) => (idx === target ? { ...it, token: url } : it)));
      }
      setDirty(true);
    } catch (e: any) {
      toast.error(e?.message || "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    setBusy(true);
    try {
      const del = await supabase.from("site_images").delete().eq("group_key", group.key);
      if (del.error) throw del.error;
      if (items.length) {
        const payload = items.map((it, i) => ({
          group_key: group.key,
          sort_order: (i + 1) * 10,
          url: it.token,
          // Alt text (accessibility) falls back to the caption so gallery
          // photos always have a description without a second field to fill.
          alt: it.alt || it.caption || null,
          caption: it.caption || null,
          object_position: null,
        }));
        const ins = await supabase.from("site_images").insert(payload as any);
        if (ins.error) throw ins.error;
      }
      setDirty(false);
      toast.success("Photos saved — live on the site");
      onSaved();
    } catch (e: any) {
      toast.error(e?.message || "Couldn't save");
    } finally {
      setBusy(false);
    }
  };

  const resetToDefault = async () => {
    setBusy(true);
    try {
      const del = await supabase.from("site_images").delete().eq("group_key", group.key);
      if (del.error) throw del.error;
      setItems(
        group.defaults.map((d, i) => ({
          uid: `def-${i}`,
          token: defaultToken(group.key, i),
          alt: d.alt,
          caption: d.caption ?? "",
        }))
      );
      setDirty(false);
      toast.success("Reverted to the original photos");
      onSaved();
    } catch (e: any) {
      toast.error(e?.message || "Couldn't reset");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div>
          <h3 className="text-sm font-semibold text-white">{group.label}</h3>
          <p className="text-[11px] text-zinc-500">
            {isGallery ? `${items.length} photo${items.length === 1 ? "" : "s"}` : "Single image"}
            {dirty && <span className="text-amber-400"> · unsaved changes</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={resetToDefault}
            disabled={busy}
            className="text-zinc-500 hover:text-zinc-200 hover:bg-white/5 text-xs h-8"
            title="Revert this to the original photos"
          >
            <RotateCcw className="w-3.5 h-3.5 mr-1" /> Reset
          </Button>
          <Button
            size="sm"
            onClick={save}
            disabled={busy || !dirty}
            className="bg-[#bf0f3e] hover:bg-[#bf0f3e]/80 text-white text-xs h-8"
          >
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Save className="w-3.5 h-3.5 mr-1" />}
            Save
          </Button>
        </div>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <SortableContext items={items.map((it) => it.uid)} strategy={rectSortingStrategy}>
        {items.map((it, i) => (
          <SortablePhotoCard key={it.uid} id={it.uid} draggable={isGallery}>
          <div className="rounded-lg border border-white/10 bg-black/30 overflow-hidden">
            <div className="relative aspect-video bg-black/40">
              {previewOf(it.token) ? (
                <img src={previewOf(it.token)} alt={it.alt} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white/20">
                  <ImageIcon className="w-6 h-6" />
                </div>
              )}
            </div>
            <div className="p-2 space-y-1.5">
              <div className="flex items-center justify-between gap-1">
                {isGallery ? (
                  <div className="flex items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => move(i, -1)}
                      disabled={i === 0 || busy}
                      className="p-1 rounded text-zinc-500 hover:text-white hover:bg-white/10 disabled:opacity-25"
                      title="Move up / earlier"
                    >
                      <ChevronUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => move(i, 1)}
                      disabled={i === items.length - 1 || busy}
                      className="p-1 rounded text-zinc-500 hover:text-white hover:bg-white/10 disabled:opacity-25"
                      title="Move down / later"
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <span />
                )}
                <div className="flex items-center gap-0.5">
                  <label className="p-1 rounded text-zinc-500 hover:text-white hover:bg-white/10 cursor-pointer" title="Replace this photo">
                    <Upload className="w-3.5 h-3.5" />
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={busy}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) uploadTo(i, f);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  {isGallery && (
                    <button
                      type="button"
                      onClick={() => remove(i)}
                      disabled={busy}
                      className="p-1 rounded text-zinc-500 hover:text-red-400 hover:bg-white/10"
                      title="Remove this photo"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
              {isGallery ? (
                // One field per gallery photo: the caption shown on the site.
                // Alt text (accessibility) is derived from it automatically.
                <Input
                  value={it.caption}
                  onChange={(e) => setCaption(i, e.target.value)}
                  placeholder="Caption (shows under the photo)"
                  className="h-7 text-[11px] bg-white/[0.04] border-white/10 text-white placeholder:text-zinc-600"
                />
              ) : (
                <Input
                  value={it.alt}
                  onChange={(e) => setAlt(i, e.target.value)}
                  placeholder="Description"
                  className="h-7 text-[11px] bg-white/[0.04] border-white/10 text-white placeholder:text-zinc-600"
                />
              )}
            </div>
          </div>
          </SortablePhotoCard>
        ))}
        </SortableContext>

        {isGallery && (
          <button
            type="button"
            onClick={() => addInputRef.current?.click()}
            disabled={busy}
            className="rounded-lg border-2 border-dashed border-white/10 hover:border-white/25 hover:bg-white/[0.02] flex flex-col items-center justify-center gap-1.5 text-zinc-600 hover:text-zinc-400 min-h-[120px] transition-colors"
          >
            <Plus className="w-6 h-6" />
            <span className="text-xs font-medium">Add photo</span>
            <input
              ref={addInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadTo("new", f);
                e.target.value = "";
              }}
            />
          </button>
        )}
      </div>
      </DndContext>
    </div>
  );
};

const AdminWebsitePhotos = () => {
  const navigate = useNavigate();
  const { hasPermission, loading: permLoading } = useStaffPermissions();
  const { byGroup, refetch, isLoading } = useSiteImages();

  // Fine-grained gate (ProtectedRoute only checks isAdmin).
  useEffect(() => {
    if (!permLoading && !hasPermission("manage_website_photos")) {
      navigate("/admin/dashboard", { replace: true });
    }
  }, [permLoading, hasPermission, navigate]);

  const sections = useMemo(() => {
    const map = new Map<string, SiteImageGroup[]>();
    for (const g of SITE_IMAGE_GROUPS) {
      const list = map.get(g.section) ?? [];
      list.push(g);
      map.set(g.section, list);
    }
    return [...map.entries()];
  }, []);

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="border-b border-white/[0.06] bg-[#09090b]/80 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/admin/dashboard")}
            aria-label="Back to dashboard"
            className="text-zinc-400 hover:text-white hover:bg-white/5"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-[#bf0f3e]" />
            <div>
              <h1 className="text-lg font-bold tracking-tight text-white">Website Photos</h1>
              <p className="text-xs text-zinc-500 font-medium">Replace, add, remove &amp; reorder photos on the public site</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        <p className="text-sm text-zinc-400 mb-6 max-w-2xl">
          Changes go live on the public website as soon as you hit <span className="text-white font-medium">Save</span> for a group.
          Use <span className="text-white font-medium">Reset</span> to put a group's original photos back.
        </p>

        {isLoading ? (
          <div className="py-20 flex items-center justify-center text-zinc-500 gap-2">
            <Loader2 className="w-5 h-5 animate-spin" /> Loading photos…
          </div>
        ) : (
          <div className="space-y-10">
            {sections.map(([section, groups]) => (
              <div key={section}>
                <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-zinc-500 mb-3">{section}</h2>
                <div className="space-y-4">
                  {groups.map((g) => (
                    <GroupEditor
                      key={g.key}
                      group={g}
                      rows={byGroup.get(g.key) ?? []}
                      onSaved={refetch}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default AdminWebsitePhotos;
