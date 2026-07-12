import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, ExternalLink, Link2, FileText } from "lucide-react";
import { toast } from "sonner";
import { slugify, type FormRecord } from "@/lib/formKit";

const AdminForms = () => {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<FormRecord | null>(null);

  const { data: forms, isLoading } = useQuery({
    queryKey: ["admin-forms"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("forms" as never)
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data as unknown as FormRecord[]) || [];
    },
  });

  const publicUrl = (slug: string) => `${window.location.origin}/f/${slug}`;

  const createForm = async () => {
    setCreating(true);
    try {
      const slug = `${slugify("form")}-${Math.random().toString(36).slice(2, 7)}`;
      const { data, error } = await supabase
        .from("forms" as never)
        .insert({
          title: "Untitled Form", slug, status: "draft",
          fields: [], settings: {}, created_by: user?.id ?? null,
        } as never)
        .select("id")
        .single();
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["admin-forms"] });
      navigate(`/admin/operations/forms/${(data as { id: string }).id}`);
    } catch (e) {
      toast.error("Couldn't create form: " + (e as Error).message);
    } finally {
      setCreating(false);
    }
  };

  const doDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from("forms" as never).delete().eq("id", deleteTarget.id);
    if (error) { toast.error("Delete failed: " + error.message); return; }
    toast.success("Form deleted");
    setDeleteTarget(null);
    qc.invalidateQueries({ queryKey: ["admin-forms"] });
  };

  const copyLink = (slug: string) => {
    navigator.clipboard.writeText(publicUrl(slug));
    toast.success("Public link copied");
  };

  return (
    <div className="text-white">
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="w-6 h-6 text-red-400" /> Forms &amp; Waivers
          </h1>
          <p className="text-white/50 text-sm mt-1">Build a form once, publish it, and share the link or QR code with parents.</p>
        </div>
        <Button onClick={createForm} disabled={creating} className="bg-[#bf0f3e] hover:bg-[#a50d35] text-white gap-1.5">
          <Plus className="w-4 h-4" /> {creating ? "Creating…" : "New Form"}
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" />
        </div>
      ) : !forms || forms.length === 0 ? (
        <div className="border border-dashed border-white/15 rounded-xl py-16 text-center">
          <FileText className="w-10 h-10 mx-auto text-white/20 mb-3" />
          <p className="text-white/60">No forms yet.</p>
          <p className="text-white/40 text-sm mt-1">Click <strong>New Form</strong> to build your first one — a one-day waiver, a sign-up sheet, anything.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {forms.map((f) => (
            <div key={f.id} className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-4 py-3 hover:border-white/20 transition-colors">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold truncate">{f.title || "Untitled Form"}</span>
                  {f.status === "published"
                    ? <Badge className="bg-green-500/15 text-green-400 border-green-500/30 text-[10px]">Published</Badge>
                    : <Badge className="bg-white/10 text-white/50 border-white/15 text-[10px]">Draft</Badge>}
                </div>
                <span className="text-xs text-white/35">
                  {(f.fields?.length || 0)} field{(f.fields?.length || 0) === 1 ? "" : "s"}
                  {f.status === "published" && <> · /f/{f.slug}</>}
                </span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {f.status === "published" && (
                  <>
                    <Button size="icon" variant="ghost" onClick={() => copyLink(f.slug)} title="Copy public link" className="h-8 w-8 text-white/50 hover:text-white">
                      <Link2 className="w-4 h-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => window.open(publicUrl(f.slug), "_blank")} title="Open form" className="h-8 w-8 text-white/50 hover:text-white">
                      <ExternalLink className="w-4 h-4" />
                    </Button>
                  </>
                )}
                <Button size="icon" variant="ghost" onClick={() => navigate(`/admin/operations/forms/${f.id}`)} title="Edit" className="h-8 w-8 text-white/60 hover:text-white">
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => setDeleteTarget(f)} title="Delete" className="h-8 w-8 text-red-400/60 hover:text-red-400">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{deleteTarget?.title}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the form and all of its collected responses. This can’t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-red-500 hover:bg-red-600 text-white" onClick={doDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminForms;
