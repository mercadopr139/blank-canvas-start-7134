import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { normalizeImageForUpload } from "@/lib/imageUpload";
import { toast } from "sonner";
import { CalendarDays, Upload, Trash2, Loader2, ImageIcon } from "lucide-react";

// Admin editor for the homepage Event Banner (singleton `event_banner` row).
// Self-contained: loads the row, uploads the flyer to the shared `site-images`
// bucket, and upserts. Lives at the top of the Website Photos manager.

interface Form {
  enabled: boolean; flyer_url: string; flyer_alt: string;
  headline: string; subtext: string; sponsor_url: string; sponsor_label: string; hide_after: string;
}
const EMPTY: Form = {
  enabled: false, flyer_url: "", flyer_alt: "", headline: "", subtext: "",
  sponsor_url: "", sponsor_label: "Sponsor this event", hide_after: "",
};

async function uploadFlyer(file: File): Promise<string> {
  const normalized = await normalizeImageForUpload(file);
  const ext = (normalized.name.split(".").pop() || "jpg").toLowerCase();
  const path = `event-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from("site-images").upload(path, normalized, { upsert: true, contentType: normalized.type || undefined });
  if (error) throw error;
  return supabase.storage.from("site-images").getPublicUrl(path).data.publicUrl;
}

const inputCls = "w-full rounded-lg bg-white/5 border border-white/15 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/30";

const EventBannerEditor = () => {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await (supabase.from("event_banner" as never) as any).select("*").eq("id", true).maybeSingle();
      if (data) setForm({
        enabled: !!data.enabled, flyer_url: data.flyer_url ?? "", flyer_alt: data.flyer_alt ?? "",
        headline: data.headline ?? "", subtext: data.subtext ?? "", sponsor_url: data.sponsor_url ?? "",
        sponsor_label: data.sponsor_label ?? "Sponsor this event", hide_after: data.hide_after ?? "",
      });
      setLoading(false);
    })();
  }, []);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  const onPick = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadFlyer(file);
      set("flyer_url", url);
      toast.success("Flyer uploaded — remember to Save.");
    } catch (err: any) {
      toast.error(err?.message || "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const save = async () => {
    if (form.enabled && !form.flyer_url) { toast.error("Add a flyer before turning the banner on."); return; }
    setSaving(true);
    const { error } = await (supabase.from("event_banner" as never) as any).upsert({
      id: true, enabled: form.enabled, flyer_url: form.flyer_url || null, flyer_alt: form.flyer_alt || null,
      headline: form.headline || null, subtext: form.subtext || null, sponsor_url: form.sponsor_url || null,
      sponsor_label: form.sponsor_label || null, hide_after: form.hide_after || null, updated_at: new Date().toISOString(),
    }, { onConflict: "id" });
    setSaving(false);
    if (error) { toast.error("Couldn't save: " + error.message); return; }
    qc.invalidateQueries({ queryKey: ["event-banner"] });
    toast.success(form.enabled ? "Live on the homepage ✓" : "Saved — banner is off.");
  };

  if (loading) return null;

  return (
    <div className="rounded-2xl border border-white/10 bg-neutral-900/60 p-5 mb-10">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <CalendarDays className="w-5 h-5 text-[#bf0f3e]" />
          <div>
            <h2 className="text-base font-bold text-white">Homepage Event Banner</h2>
            <p className="text-xs text-zinc-500">Promote an upcoming event at the top of the homepage.</p>
          </div>
        </div>
        {/* On / off */}
        <button onClick={() => set("enabled", !form.enabled)}
          className={`shrink-0 inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${form.enabled ? "bg-emerald-500/15 border-emerald-400/30 text-emerald-300" : "bg-white/5 border-white/15 text-white/50"}`}>
          <span className={`h-2 w-2 rounded-full ${form.enabled ? "bg-emerald-400" : "bg-white/30"}`} />
          {form.enabled ? "Showing on homepage" : "Hidden"}
        </button>
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        {/* Flyer */}
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-white/40">Flyer image</label>
          <input ref={fileRef} type="file" accept="image/*" onChange={onPick} className="hidden" />
          {form.flyer_url ? (
            <div className="mt-2">
              <img src={form.flyer_url} alt="Event flyer preview" className="w-full max-w-xs rounded-lg border border-white/10" />
              <div className="flex gap-2 mt-2">
                <button onClick={() => fileRef.current?.click()} disabled={uploading}
                  className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md bg-white/5 hover:bg-white/10 border border-white/15 text-white">
                  {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />} Replace
                </button>
                <button onClick={() => set("flyer_url", "")}
                  className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md bg-white/5 hover:bg-red-500/20 border border-white/15 text-white">
                  <Trash2 className="h-3.5 w-3.5" /> Remove
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => fileRef.current?.click()} disabled={uploading}
              className="mt-2 w-full max-w-xs aspect-[3/4] rounded-lg border-2 border-dashed border-white/15 hover:border-white/30 grid place-items-center text-white/40 hover:text-white/70 transition-colors">
              {uploading ? <Loader2 className="h-6 w-6 animate-spin" /> : <span className="flex flex-col items-center gap-2 text-sm"><ImageIcon className="h-7 w-7" /> Upload flyer</span>}
            </button>
          )}
          <input value={form.flyer_alt} onChange={(e) => set("flyer_alt", e.target.value)}
            placeholder="Flyer description (for accessibility)" className={`${inputCls} mt-2`} />
        </div>

        {/* Text + link */}
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-white/40">Headline (optional)</label>
            <input value={form.headline} onChange={(e) => set("headline", e.target.value)}
              placeholder="e.g. Fight Night at No Limits" className={`${inputCls} mt-1`} />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-white/40">Short line (optional)</label>
            <textarea value={form.subtext} onChange={(e) => set("subtext", e.target.value)} rows={2}
              placeholder="e.g. Free to attend — come cheer on our boxers!" className={`${inputCls} mt-1 resize-none`} />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-white/40">Sponsor link URL</label>
            <input value={form.sponsor_url} onChange={(e) => set("sponsor_url", e.target.value)}
              placeholder="https://… (where the Sponsor button goes)" className={`${inputCls} mt-1`} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-white/40">Button label</label>
              <input value={form.sponsor_label} onChange={(e) => set("sponsor_label", e.target.value)}
                placeholder="Sponsor this event" className={`${inputCls} mt-1`} />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-white/40">Hide after</label>
              <input type="date" value={form.hide_after} onChange={(e) => set("hide_after", e.target.value)}
                className={`${inputCls} mt-1`} />
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 mt-5">
        <button onClick={save} disabled={saving}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-white disabled:opacity-60" style={{ backgroundColor: "#bf0f3e" }}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Save banner
        </button>
        <span className="text-xs text-white/40">Changes go live on the homepage when you Save. The button is hidden if you leave the link blank.</span>
      </div>
    </div>
  );
};

export default EventBannerEditor;
