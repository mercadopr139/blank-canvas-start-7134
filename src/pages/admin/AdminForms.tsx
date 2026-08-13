import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Eye, Trash2, ExternalLink, Link2, FileText, Copy, Users } from "lucide-react";
import { toast } from "sonner";
import { slugify, type FormRecord } from "@/lib/formKit";
import { computeImpactSnapshot, type ImpactForm } from "@/lib/impactSnapshot";
import { ImpactSnapshotView } from "@/components/admin/ImpactSnapshotView";

const AdminForms = () => {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const [creating, setCreating] = useState(false);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FormRecord | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

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

  // Response counts per form, so the list shows how many submissions each form
  // has without opening it. One lightweight query, tallied client-side.
  const { data: responseCounts } = useQuery({
    queryKey: ["admin-forms-response-counts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("form_responses" as never).select("form_id");
      if (error) throw error;
      const counts: Record<string, number> = {};
      (data as unknown as { form_id: string }[] || []).forEach((r) => {
        counts[r.form_id] = (counts[r.form_id] || 0) + 1;
      });
      return counts;
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

  const duplicateForm = async (f: FormRecord) => {
    setDuplicatingId(f.id);
    try {
      // Fresh form-xxxx slug so it stays unique AND keeps auto-following the
      // title while it's a draft — retyping the title updates the public link.
      const slug = `form-${Math.random().toString(36).slice(2, 7)}`;
      // New field ids so the copy never shares identity with the original.
      const clonedFields = (f.fields || []).map((fld) => ({ ...fld, id: crypto.randomUUID() }));
      const { data, error } = await supabase
        .from("forms" as never)
        .insert({
          title: `Copy of ${f.title || "Untitled Form"}`,
          slug,
          status: "draft", // never auto-publish a copy — staff reviews + publishes
          fields: clonedFields as never,
          settings: (f.settings ?? {}) as never,
          created_by: user?.id ?? null,
        } as never)
        .select("id")
        .single();
      if (error) throw error;
      toast.success("Form duplicated — rename it, then Publish when ready.");
      qc.invalidateQueries({ queryKey: ["admin-forms"] });
      navigate(`/admin/operations/forms/${(data as { id: string }).id}`);
    } catch (e) {
      toast.error("Couldn't duplicate: " + (e as Error).message);
    } finally {
      setDuplicatingId(null);
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

  // Forms toggled ON feed the youth-reached snapshot at the bottom of the page.
  const impactForms = useMemo(() => (forms || []).filter((f) => f.settings?.impactSource), [forms]);
  const impactIds = impactForms.map((f) => f.id);

  // Toggle whether a form's youth are counted in the snapshot below. Persisted
  // on the form's settings so it survives across sessions / other machines.
  // We flip the value IN PLACE in the cache (not via a refetch) — refetching
  // re-sorts the list by updated_at, which would make the row jump and the
  // next click land on the wrong form.
  const toggleImpact = async (f: FormRecord, on: boolean) => {
    setTogglingId(f.id);
    const settings = { ...(f.settings || {}), impactSource: on };
    const patch = (s: FormRecord["settings"]) =>
      qc.setQueryData<FormRecord[]>(["admin-forms"], (prev) =>
        (prev || []).map((x) => (x.id === f.id ? { ...x, settings: s } : x)));
    patch(settings); // optimistic — row stays put
    try {
      const { error } = await supabase.from("forms" as never).update({ settings } as never).eq("id", f.id);
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["forms-impact-responses"] });
    } catch (e) {
      patch(f.settings); // revert on failure
      toast.error("Couldn't update: " + (e as Error).message);
    } finally {
      setTogglingId(null);
    }
  };

  // Responses for every toggled-on form, for the aggregate snapshot.
  const { data: impactResponses } = useQuery({
    queryKey: ["forms-impact-responses", impactIds.join(",")],
    enabled: impactIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("form_responses" as never)
        .select("form_id, data")
        .in("form_id", impactIds);
      if (error) throw error;
      return (data as unknown as { form_id: string; data: Record<string, unknown> }[]) || [];
    },
  });

  const aggregateSnapshot = useMemo(() => {
    if (impactForms.length === 0) return null;
    const byForm: Record<string, { data: Record<string, unknown> }[]> = {};
    (impactResponses || []).forEach((r) => { (byForm[r.form_id] ||= []).push({ data: r.data }); });
    const inputs: ImpactForm[] = impactForms.map((f) => ({
      fields: f.fields || [], settings: f.settings, responses: byForm[f.id] || [],
    }));
    return computeImpactSnapshot(inputs);
  }, [impactForms, impactResponses]);

  // Live NLA registered youth — the funder baseline. Also used to make sure a
  // camp youth who is ALSO a registered youth is counted once (no double-count).
  const { data: registered } = useQuery({
    queryKey: ["forms-nla-registered-keys"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("youth_registrations")
        .select("child_first_name, child_last_name, child_date_of_birth");
      if (error) throw error;
      return (data as { child_first_name: string | null; child_last_name: string | null; child_date_of_birth: string | null }[]) || [];
    },
  });

  // Combined, unduplicated reach: registered youth + camp youth who aren't
  // already registered. Keys match impactSnapshot's `first|last|dob` format.
  const reach = useMemo(() => {
    const registeredCount = registered?.length || 0;
    const norm = (s: unknown) => String(s ?? "").trim().toLowerCase();
    const regKeys = new Set<string>();
    (registered || []).forEach((r) => {
      if (!r.child_first_name || !r.child_last_name || !r.child_date_of_birth) return;
      regKeys.add(`${norm(r.child_first_name)}|${norm(r.child_last_name)}|${String(r.child_date_of_birth).slice(0, 10)}`);
    });
    const campUnique = aggregateSnapshot?.uniqueCount || 0;
    const campKeys = aggregateSnapshot?.youthKeys || [];
    const overlap = campKeys.filter((k) => regKeys.has(k)).length; // in both systems
    const campAdditional = campUnique - overlap;
    return { registeredCount, campUnique, overlap, campAdditional, total: registeredCount + campAdditional };
  }, [registered, aggregateSnapshot]);

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
                  {" · "}
                  <span className={(responseCounts?.[f.id] ?? 0) > 0 ? "text-emerald-300/80 font-semibold" : "text-white/35"}>
                    {responseCounts?.[f.id] ?? 0} response{(responseCounts?.[f.id] ?? 0) === 1 ? "" : "s"}
                  </span>
                  {f.status === "published" && <> · /f/{f.slug}</>}
                </span>
              </div>
              <div
                className="flex items-center gap-1.5 shrink-0 mr-1 pl-3 border-l border-white/10"
                title="Count this form's youth in the reached snapshot at the bottom of the page"
              >
                <Users className={`w-3.5 h-3.5 ${f.settings?.impactSource ? "text-[#bf0f3e]" : "text-white/25"}`} />
                <Switch
                  checked={!!f.settings?.impactSource}
                  disabled={togglingId === f.id}
                  onCheckedChange={(v) => toggleImpact(f, v)}
                  className="data-[state=checked]:bg-[#bf0f3e]"
                />
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
                <Button size="icon" variant="ghost" onClick={() => duplicateForm(f)} disabled={duplicatingId === f.id} title="Duplicate this form" className="h-8 w-8 text-white/50 hover:text-white">
                  <Copy className="w-4 h-4" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => navigate(`/admin/operations/forms/${f.id}`)} title="View / edit" className="h-8 w-8 text-white/60 hover:text-white">
                  <Eye className="w-4 h-4" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => setDeleteTarget(f)} title="Delete" className="h-8 w-8 text-red-400/60 hover:text-red-400">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Total Youth Reached — NLA registered youth + camp/one-day youth ──
          Every child counted once (camp youth already registered are removed),
          so the total holds up for funders. */}
      {forms && forms.length > 0 && (
        <div className="mt-8 border-t border-white/10 pt-6">
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-5 h-5 text-[#bf0f3e]" />
            <h2 className="text-lg font-bold">Total Youth Reached</h2>
          </div>
          <p className="text-white/50 text-sm mb-4 max-w-2xl">
            Your live NLA registered youth, plus the camp / one-day youth from any form you toggle on above.
            Every child is counted once — a camp youth who is also registered isn't double-counted — so it holds up for funders.
          </p>

          {/* Combined reach tile */}
          <div className="rounded-xl border border-[#bf0f3e]/40 bg-[#bf0f3e]/[0.07] p-5 mb-5">
            <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
              <div>
                <p className="text-[11px] uppercase tracking-wider text-white/50 mb-1">Total unique youth reached</p>
                <p className="text-5xl font-extrabold text-white leading-none">{reach.total.toLocaleString()}</p>
              </div>
              <div className="text-sm space-y-1.5 min-w-[280px]">
                <div className="flex items-center justify-between gap-6">
                  <span className="text-white/60">NLA registered youth</span>
                  <span className="font-semibold text-white tabular-nums">{reach.registeredCount.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between gap-6">
                  <span className="text-white/60">Camp / one-day youth{reach.overlap > 0 ? ` (+${reach.campAdditional.toLocaleString()} new)` : ""}</span>
                  <span className="font-semibold text-white tabular-nums">{reach.campUnique.toLocaleString()}</span>
                </div>
                {reach.overlap > 0 && (
                  <p className="text-[11px] text-white/40">{reach.overlap} camp youth {reach.overlap === 1 ? "is" : "are"} also registered — counted once.</p>
                )}
                <div className="border-t border-white/10 pt-1.5 flex items-center justify-between gap-6">
                  <span className="text-white/80 font-medium">Total unique reached</span>
                  <span className="font-bold text-[#bf0f3e] tabular-nums">{reach.total.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Camp / one-day youth breakdown (the youth added on top of registrations) */}
          {impactForms.length === 0 ? (
            <div className="border border-dashed border-white/15 rounded-xl py-8 text-center">
              <p className="text-white/50 text-sm">Toggle a camp or waiver form above to add its youth to the total.</p>
              <p className="text-white/40 text-xs mt-1">Their demographics will appear here.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] uppercase tracking-wider text-white/40">Camp youth from:</span>
                {impactForms.map((f) => (
                  <Badge key={f.id} className="bg-[#bf0f3e]/15 text-[#bf0f3e] border-[#bf0f3e]/30 text-[10px]">
                    {f.title || "Untitled Form"}
                  </Badge>
                ))}
              </div>
              {aggregateSnapshot && <ImpactSnapshotView snap={aggregateSnapshot} emptyHint="No responses in the selected forms yet." />}
            </div>
          )}
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
