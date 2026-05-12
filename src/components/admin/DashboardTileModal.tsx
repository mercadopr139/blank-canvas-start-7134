import { useState, useMemo, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { icons, Trash2 } from "lucide-react";
import FullColorPicker from "@/components/admin/FullColorPicker";

const COMMON_ICONS = [
  "bus", "signal", "settings", "calendar-days", "users", "shield", "briefcase",
  "building-2", "target", "dumbbell", "zap", "heart", "star", "trophy",
  "flame", "rocket", "compass", "crown", "graduation-cap", "hand-heart",
  "globe", "hammer", "wrench", "lightbulb", "gauge", "clipboard-list",
  "bell", "mail", "phone", "map-pin", "lock", "key", "megaphone", "chart-bar",
];

export type DashboardTile = {
  id: string;
  user_id: string;
  title: string;
  subtitle: string | null;
  icon_name: string;
  accent_color: string;
  href: string;
  sort_order: number;
  is_default: boolean;
};

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  editingTile: DashboardTile | null;
}

const DashboardTileModal = ({ open, onClose, onSaved, editingTile }: Props) => {
  const [title, setTitle] = useState(editingTile?.title ?? "");
  const [subtitle, setSubtitle] = useState(editingTile?.subtitle ?? "");
  const [iconName, setIconName] = useState(editingTile?.icon_name ?? "square");
  const [accentColor, setAccentColor] = useState(editingTile?.accent_color ?? "#a1a1aa");
  const [saving, setSaving] = useState(false);
  const [iconSearch, setIconSearch] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setTitle(editingTile?.title ?? "");
    setSubtitle(editingTile?.subtitle ?? "");
    setIconName(editingTile?.icon_name ?? "square");
    setAccentColor(editingTile?.accent_color ?? "#a1a1aa");
    setIconSearch("");
  }, [editingTile]);

  const filteredIcons = useMemo(() => {
    const search = iconSearch.toLowerCase().trim();
    if (!search) return COMMON_ICONS;
    const kebabKeys = Object.keys(icons).map((k) =>
      k.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase()
    );
    return kebabKeys.filter((k) => k.includes(search)).slice(0, 60);
  }, [iconSearch]);

  const getIconComponent = (name: string) => {
    const pascal = name
      .split("-")
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join("");
    return (icons as any)[pascal] || null;
  };

  const handleSave = async () => {
    if (!editingTile) return;
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    setSaving(true);

    try {
      const { error, data } = await (supabase.from("dashboard_tiles") as any)
        .update({
          title: title.trim(),
          subtitle: subtitle.trim() || null,
          icon_name: iconName,
          accent_color: accentColor,
        })
        .eq("id", editingTile.id)
        .select();
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error("Update returned no rows – you may not have permission to edit this tile.");
      }
      toast.success("Tile updated");
      onSaved();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to save tile");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editingTile) return;
    setDeleting(true);
    try {
      const { error } = await (supabase.from("dashboard_tiles") as any)
        .delete()
        .eq("id", editingTile.id);
      if (error) throw error;
      toast.success("Tile deleted");
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
        <DialogContent className="bg-black border border-white/20 text-white max-w-lg max-h-[85vh] overflow-y-auto" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="text-white">Edit Tile</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Title */}
            <div className="space-y-1.5">
              <Label className="text-white/70 text-xs">Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} className="bg-white/5 border-white/10 text-white" />
            </div>

            {/* Subtitle */}
            <div className="space-y-1.5">
              <Label className="text-white/70 text-xs">Subtitle</Label>
              <Input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} className="bg-white/5 border-white/10 text-white" />
            </div>

            {/* Color */}
            <div className="space-y-1.5">
              <Label className="text-white/70 text-xs">Accent Color</Label>
              <FullColorPicker value={accentColor} onChange={setAccentColor} />
            </div>

            {/* Icon picker */}
            <div className="space-y-1.5">
              <Label className="text-white/70 text-xs">Icon</Label>
              <Input
                placeholder="Search icons…"
                value={iconSearch}
                onChange={(e) => setIconSearch(e.target.value)}
                className="bg-white/5 border-white/10 text-white mb-2"
              />
              <div className="grid grid-cols-8 gap-1 max-h-[160px] overflow-y-auto">
                {filteredIcons.map((name) => {
                  const Ic = getIconComponent(name);
                  if (!Ic) return null;
                  return (
                    <button
                      key={name}
                      type="button"
                      onClick={() => setIconName(name)}
                      className={`p-2 rounded-lg transition-colors ${
                        iconName === name
                          ? "bg-white/20 ring-1 ring-white/40"
                          : "hover:bg-white/10"
                      }`}
                    >
                      <Ic className="w-4 h-4 text-white/70" />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <DialogFooter className="flex justify-between items-center pt-2">
            <div>
              <Button variant="ghost" size="sm" onClick={() => setShowDeleteConfirm(true)} className="text-red-400 hover:text-red-300 hover:bg-red-500/10">
                <Trash2 className="w-4 h-4 mr-1" /> Delete
              </Button>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose} className="border-white/10 text-zinc-300 bg-transparent hover:bg-white/5">Cancel</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "Saving…" : "Update"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent className="bg-zinc-900 border-zinc-700 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Delete "{editingTile?.title}"?</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              This tile will be removed from your dashboard. You can always re-add it later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-white/10 text-zinc-300 bg-transparent hover:bg-white/5">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-red-600 hover:bg-red-700 text-white">
              {deleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default DashboardTileModal;
