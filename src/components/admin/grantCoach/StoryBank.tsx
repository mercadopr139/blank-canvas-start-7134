// The Grant Vault's story bank, and the card that saves a story Grant Coach
// wrote up — from the Vault box or from a strategy session. Nothing is saved
// until Josh picks the consent: family said yes / anonymous only / don't use.
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { BookHeart, Loader2, Trash2, ShieldCheck, Wand2 } from "lucide-react";
import GcCard, { GC_BLUE } from "@/components/admin/grantCoach/GcCard";
import { CONSENT, loadStories, saveStory, writeUpStory, type Consent, type StoryDraft, type StoryRow } from "@/lib/grantCoach/stories";
import { loadLibrary } from "@/lib/grantCoach/writer";

const CONSENT_TONE: Record<Consent, string> = {
  named: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  anonymous: "bg-sky-400/15 text-sky-200 border-sky-400/30",
  private: "bg-white/[0.06] text-white/60 border-white/15",
};

function ConsentPicker({ value, onChange }: { value: Consent | null; onChange: (c: Consent) => void }) {
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {CONSENT.map((c) => (
        <button
          key={c.key}
          type="button"
          onClick={() => onChange(c.key)}
          className={`rounded-lg border px-3 py-2 text-left transition-colors ${value === c.key ? "border-white/50 bg-white/[0.08]" : "border-white/12 hover:bg-white/[0.04]"}`}
        >
          <p className="text-sm font-semibold text-white">{c.label}</p>
          <p className="text-[11px] text-white/45">{c.help}</p>
        </button>
      ))}
    </div>
  );
}

/** A written-up story, editable, saved only once the consent is picked. */
export function StoryDraftCard({ draft, raw, folderId, onSaved, onDismiss }: { draft: StoryDraft; raw?: string | null; folderId?: string | null; onSaved?: () => void; onDismiss?: () => void }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [d, setD] = useState(draft);
  const [consent, setConsent] = useState<Consent | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const save = async () => {
    if (!consent) return;
    setSaving(true);
    try {
      await saveStory({ ...d, raw, consent, folder_id: folderId ?? null }, user?.id ?? null);
      qc.invalidateQueries({ queryKey: ["grant-stories"] });
      setSaved(true);
      toast.success(consent === "private" ? "Saved to the story bank, kept out of writing." : "Saved to the story bank. Every grant from now on can use it.");
      onSaved?.();
    } catch (e) {
      toast.error(`Couldn't save the story: ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  if (saved) return <p className="text-[12px] text-emerald-300 inline-flex items-center gap-1.5"><ShieldCheck className="w-4 h-4" /> "{d.title}" is in the story bank.</p>;

  return (
    <div className="rounded-xl border-2 p-4 space-y-3" style={{ borderColor: `${GC_BLUE}80` }}>
      <p className="text-[11px] font-bold uppercase tracking-[0.16em]" style={{ color: GC_BLUE }}>Save this story to the bank?</p>
      <Input value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} className="bg-neutral-950 border-white/15 text-white font-semibold" />
      <Textarea value={d.story} onChange={(e) => setD({ ...d, story: e.target.value })} rows={Math.min(10, Math.max(4, Math.ceil(d.story.length / 90)))} className="bg-neutral-950 border-white/15 text-white text-sm" />
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="block"><span className="text-[11px] text-white/50">Program</span><Input value={d.program ?? ""} onChange={(e) => setD({ ...d, program: e.target.value })} className="bg-neutral-950 border-white/15 text-white text-sm" /></label>
        <label className="block"><span className="text-[11px] text-white/50">What it proves (comma-separated)</span><Input value={(d.proves ?? []).join(", ")} onChange={(e) => setD({ ...d, proves: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) })} className="bg-neutral-950 border-white/15 text-white text-sm" /></label>
      </div>
      {d.left_out && <p className="text-[12px] text-amber-300">Left out to protect the kids: {d.left_out}</p>}
      <div className="space-y-1.5">
        <p className="text-[12px] text-white/60">Did the family say yes? Pick one before saving.</p>
        <ConsentPicker value={consent} onChange={setConsent} />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => void save()} disabled={!consent || saving || !d.story.trim() || !d.title.trim()} className="bg-emerald-700 hover:bg-emerald-600 text-white">
          {saving ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <BookHeart className="w-4 h-4 mr-1.5" />} Save to the story bank
        </Button>
        {onDismiss && <Button variant="outline" onClick={onDismiss} className="bg-transparent border-white/20 text-white/70 hover:bg-white/10 hover:text-white">Not now</Button>}
      </div>
    </div>
  );
}

/** The bank itself, in the Grant Vault. */
export default function StoryBank() {
  const qc = useQueryClient();
  const { data: stories = [], isLoading, isError, error } = useQuery({ queryKey: ["grant-stories"], queryFn: loadStories });
  const { data: library = [] } = useQuery({ queryKey: ["grant-library"], queryFn: loadLibrary, staleTime: 5 * 60_000 });
  const [raw, setRaw] = useState("");
  const [writing, setWriting] = useState(false);
  const [draft, setDraft] = useState<{ d: StoryDraft; raw: string } | null>(null);

  const writeUp = async () => {
    const t = raw.trim();
    if (!t) return;
    setWriting(true);
    try { setDraft({ d: await writeUpStory(t, library), raw: t }); } catch (e) { toast.error(`Grant Coach: ${(e as Error).message}`); } finally { setWriting(false); }
  };
  const update = async (s: StoryRow, p: Partial<StoryRow>) => {
    const { error: e } = await supabase.from("grant_stories" as never).update({ ...p, updated_at: new Date().toISOString() } as never).eq("id", s.id);
    if (e) { toast.error(e.message); return; }
    qc.invalidateQueries({ queryKey: ["grant-stories"] });
  };
  const remove = async (s: StoryRow) => {
    const { error: e } = await supabase.from("grant_stories" as never).delete().eq("id", s.id);
    if (e) { toast.error(e.message); return; }
    qc.invalidateQueries({ queryKey: ["grant-stories"] });
    toast(`"${s.title}" taken out of the story bank.`, { action: { label: "Undo", onClick: async () => { await supabase.from("grant_stories" as never).insert(s as never); qc.invalidateQueries({ queryKey: ["grant-stories"] }); } } });
  };

  return (
    <GcCard
      icon={<BookHeart className="w-4 h-4" />}
      title="Story bank"
      blurb={`${stories.length} stor${stories.length === 1 ? "y" : "ies"} · the real moments that prove NLA works, told once, used by every grant`}
    >
      <div className="p-4 space-y-4">
        <div className="space-y-2">
          <p className="text-sm font-semibold">Tell Grant Coach a story</p>
          <p className="text-[12px] text-white/50">In your own words, rough is fine: what happened, who (first names only), what changed. Grant Coach writes it up; you check it and say whether the family is OK with it being used.</p>
          <Textarea value={raw} onChange={(e) => setRaw(e.target.value)} rows={4} placeholder="e.g. Marcus walked in two years ago and wouldn't look anyone in the eye…" className="bg-neutral-950 border-white/15 text-white text-sm" />
          <Button onClick={() => void writeUp()} disabled={writing || !raw.trim()} className="font-bold" style={{ backgroundColor: GC_BLUE, color: "#0a0a0a" }}>
            {writing ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Wand2 className="w-4 h-4 mr-1.5" />} Write it up
          </Button>
        </div>
        {draft && <StoryDraftCard draft={draft.d} raw={draft.raw} onSaved={() => { setDraft(null); setRaw(""); }} onDismiss={() => setDraft(null)} />}

        {isLoading && <p className="text-[12px] text-white/40">Loading…</p>}
        {isError && <p className="text-[12px] text-red-300">Couldn't load the stories: {(error as Error).message}</p>}
        <ul className="divide-y divide-white/[0.06]">
          {stories.map((s) => (
            <li key={s.id} className="py-3 space-y-1.5">
              <div className="flex items-start gap-2 flex-wrap">
                <p className="flex-1 min-w-[160px] text-sm font-semibold text-white">{s.title}</p>
                <span className={`text-[10px] font-bold uppercase tracking-wide rounded-full border px-2 py-0.5 ${CONSENT_TONE[s.consent]}`}>{CONSENT.find((c) => c.key === s.consent)?.label}</span>
                <button type="button" onClick={() => void remove(s)} title="Take it out of the bank" className="p-1 text-white/30 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
              </div>
              <Textarea key={`${s.id}-${s.updated_at}`} defaultValue={s.story} onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== s.story) void update(s, { story: v }); }} rows={Math.min(8, Math.max(2, Math.ceil(s.story.length / 90)))} className="bg-neutral-950 border-white/10 text-white text-sm" />
              <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-white/40">
                {s.program && <span>{s.program}</span>}
                {(s.proves ?? []).map((p) => <span key={p} className="rounded-full bg-white/[0.06] px-2 py-0.5 text-white/60">{p}</span>)}
                <span>· {s.year}</span>
                <span className="ml-auto inline-flex gap-1">
                  {CONSENT.filter((c) => c.key !== s.consent).map((c) => (
                    <button key={c.key} type="button" onClick={() => void update(s, { consent: c.key })} className="underline underline-offset-2 hover:text-white">Mark {c.label.toLowerCase()}</button>
                  ))}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </GcCard>
  );
}
