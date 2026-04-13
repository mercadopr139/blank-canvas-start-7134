import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { icons } from "lucide-react";
import { Trash2, Upload, X } from "lucide-react";

/* ── Curated color palette ── */
const COLOR_OPTIONS = [
  { label: "Red", hex: "#ef4444" },
  { label: "Blue", hex: "#3b82f6" },
  { label: "Orange", hex: "#f97316" },
  { label: "Green", hex: "#22c55e" },
  { label: "Purple", hex: "#a78bfa" },
  { label: "Yellow", hex: "#eab308" },
  { label: "Teal", hex: "#14b8a6" },
  { label: "Pink", hex: "#ec4899" },
  { label: "White", hex: "#e4e4e7" },
];

/* ── Common icon names for quick access ── */
const COMMON_ICONS = [
  "target", "dumbbell", "zap", "building-2", "user", "heart", "star", "briefcase",
  "book-open", "shield", "trophy", "flame", "rocket", "compass", "crown", "swords",
  "graduation-cap", "hand-heart", "church", "music", "palette", "camera", "globe",
  "mountain", "sun", "moon", "anchor", "flag", "mic", "users", "brain", "lightbulb",
  "gem", "gauge", "hammer", "wrench", "leaf", "trees", "home", "map-pin",
];

type FocusArea = {
  id: string;
  key: string;
  title: string;
  subtitle: string | null;
  icon_name: string;
  accent_color: string;
  is_default: boolean;
  image_url: string | null;
  sort_order: number;
};

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  editingArea?: FocusArea | null;
}

const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const FocusAreaModal = ({ open, onClose, onSaved, editingArea }: Props) => {
  const isEditing = !!editingArea;

  const [title, setTitle] = useState(editingArea?.title ?? "");
  const [subtitle, setSubtitle] = useState(editingArea?.subtitle ?? "");
  const [iconName, setIconName] = useState(editingArea?.icon_name ?? "target");
  const [accentColor, setAccentColor] = useState(editingArea?.accent_color ?? "#ef4444");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(editingArea?.image_url ?? null);
  const [removeImage, setRemoveImage] = useState(false);
  const [saving, setSaving] = useState(false);
  const [iconSearch, setIconSearch] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  /* Reset state when modal opens with new data */
  useState(() => {
    setTitle(editingArea?.title ?? "");
    setSubtitle(editingArea?.subtitle ?? "");
    setIconName(editingArea?.icon_name ?? "target");
    setAccentColor(editingArea?.accent_color ?? "#ef4444");
    setImageFile(null);
    setImagePreview(editingArea?.image_url ?? null);
    setRemoveImage(false);
  });

  /* Icon grid: show common + search results */
  const filteredIcons = useMemo(() => {
    const search = iconSearch.toLowerCase().trim();
    if (!search) return COMMON_ICONS;
    const kebabKeys = Object.keys(icons).map((k) => {
      return k.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
    });
    return kebabKeys.filter((k) => k.includes(search)).slice(0, 60);
  }, [iconSearch]);

  const getIconComponent = (name: string) => {
    // Convert kebab-case to PascalCase
    const pascal = name
      .split("-")
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join("");
    return (icons as any)[pascal] || null;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setRemoveImage(false);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setRemoveImage(true);
  };

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    setSaving(true);
    try {
      let imageUrl = editingArea?.image_url ?? null;

      // Upload new image
      if (imageFile) {
        const ext = imageFile.name.split(".").pop();
        const path = `${editingArea?.key ?? slugify(title)}-${Date.now()}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from("focus-area-images")
          .upload(path, imageFile, { upsert: true });
        if (uploadErr) throw uploadErr;
        const { data: urlData } = supabase.storage
          .from("focus-area-images")
          .getPublicUrl(path);
        imageUrl = urlData.publicUrl;
      } else if (removeImage) {
        imageUrl = null;
      }

      if (isEditing && editingArea) {
        const { error } = await supabase
          .from("focus_areas")
          .update({
            title: title.trim(),
            subtitle: subtitle.trim() || null,
            icon_name: iconName,
            accent_color: accentColor,
            image_url: imageUrl,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingArea.id);
        if (error) throw error;
        toast.success("Focus area updated");
      } else {
        const key = slugify(title);
        // Get max sort_order
        const { data: maxRow } = await supabase
          .from("focus_areas")
          .select("sort_order")
          .order("sort_order", { ascending: false })
          .limit(1)
          .single();
        const nextOrder = (maxRow?.sort_order ?? 0) + 1;

        const { error } = await supabase.from("focus_areas").insert({
          key,
          title: title.trim(),
          subtitle: subtitle.trim() || null,
          icon_name: iconName,
          accent_color: accentColor,
          image_url: imageUrl,
          sort_order: nextOrder,
          is_default: false,
        });
        if (error) throw error;
        toast.success("Focus area created");
      }
      onSaved();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editingArea) return;
    setDeleting(true);
    try {
      // Delete all signals for this area
      const label = editingArea.title;
      await supabase.from("signals").delete().eq("source", label);
      // Delete the focus area
      const { error } = await supabase
        .from("focus_areas")
        .delete()
        .eq("id", editingArea.id);
      if (error) throw error;
      toast.success("Focus area deleted");
      setShowDeleteConfirm(false);
      onSaved();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="bg-zinc-900 border-white/10 text-white max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">
              {isEditing ? "Edit Focus Area" : "New Focus Area"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Title */}
            <div className="space-y-1.5">
              <Label className="text-white/70 text-xs">Title *</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Mentorship, Health, Ministry"
                className="bg-white/5 border-white/10 text-white"
              />
            </div>

            {/* Subtitle */}
            <div className="space-y-1.5">
              <Label className="text-white/70 text-xs">Subtitle</Label>
              <Input
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                placeholder="Short description…"
                className="bg-white/5 border-white/10 text-white"
              />
            </div>

            {/* Color Picker */}
            <FullColorPicker value={accentColor} onChange={setAccentColor} />

            {/* Icon Picker */}
            <div className="space-y-1.5">
              <Label className="text-white/70 text-xs">Icon</Label>
              <Input
                value={iconSearch}
                onChange={(e) => setIconSearch(e.target.value)}
                placeholder="Search icons…"
                className="bg-white/5 border-white/10 text-white mb-2"
              />
              <div className="grid grid-cols-8 gap-1.5 max-h-[180px] overflow-y-auto p-1 rounded-lg bg-white/[0.03]">
                {filteredIcons.map((name) => {
                  const IconComp = getIconComponent(name);
                  if (!IconComp) return null;
                  return (
                    <button
                      key={name}
                      type="button"
                      onClick={() => setIconName(name)}
                      className={`p-2 rounded-lg transition-all flex items-center justify-center ${
                        iconName === name
                          ? "bg-white/20 ring-2 ring-white/40"
                          : "hover:bg-white/10"
                      }`}
                      title={name}
                    >
                      <IconComp className="w-5 h-5" style={{ color: accentColor }} />
                    </button>
                  );
                })}
                {filteredIcons.length === 0 && (
                  <p className="col-span-8 text-xs text-white/40 text-center py-4">
                    No icons found
                  </p>
                )}
              </div>
            </div>

            {/* Image Upload */}
            <div className="space-y-1.5">
              <Label className="text-white/70 text-xs">Image / Logo (optional)</Label>
              {imagePreview && !removeImage ? (
                <div className="relative inline-block">
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="w-24 h-24 object-contain rounded-lg border border-white/10 bg-black"
                  />
                  <button
                    type="button"
                    onClick={handleRemoveImage}
                    className="absolute -top-2 -right-2 bg-red-600 rounded-full p-0.5 hover:bg-red-500"
                  >
                    <X className="w-3.5 h-3.5 text-white" />
                  </button>
                </div>
              ) : (
                <label className="flex items-center gap-2 px-4 py-3 rounded-lg border border-dashed border-white/20 bg-white/[0.03] cursor-pointer hover:bg-white/[0.06] transition-colors">
                  <Upload className="w-4 h-4 text-white/40" />
                  <span className="text-xs text-white/50">Click to upload an image</span>
                  <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                </label>
              )}
            </div>

            {/* Delete button for editing */}
            {isEditing && (
              <div className="pt-2 border-t border-white/10">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="text-red-400 hover:text-red-300 hover:bg-red-500/10 gap-1.5 text-xs"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete this focus area
                </Button>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={onClose} className="text-white/50 hover:bg-white/10">
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!title.trim() || saving}
              className="bg-white text-black hover:bg-white/90"
            >
              {saving ? "Saving…" : isEditing ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent className="bg-zinc-900 border-white/10 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">
              Delete "{editingArea?.title}"?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-white/60">
              {editingArea?.is_default
                ? "⚠️ This is a default focus area. "
                : ""}
              This will permanently delete this focus area and all its signals. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-transparent border-white/10 text-white hover:bg-white/10">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-500 text-white"
            >
              {deleting ? "Deleting…" : "Delete permanently"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default FocusAreaModal;
