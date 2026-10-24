// Resources, a pop-up from the question's conversation (Josh, 2026-10-24):
// it opens on the Snapshot exactly as the Snapshot tab shows it — whole
// sections, Copy, Unlock, edit, Approve and lock — because that screen is
// "way easier on the eyes". The Grant Vault sits beside it, every field
// with Copy and Edit (saved to the same Vault as Grant Coach home); past
// answers and stories with Copy. Esc, ✕ or a click outside closes it and
// leaves the question as it was.
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, Check, Search, Library, Pencil, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import GcCard, { GC_BLUE } from "@/components/admin/grantCoach/GcCard";
import YearSnapshot from "@/components/admin/grantCoach/YearSnapshot";
import { loadMemory } from "@/lib/grantCoach/memory";
import { ORG_FIELDS, orgFieldValue } from "@/lib/grantCoach/orgProfile";
import type { WriterStory } from "@/lib/grantCoach/writer";

type Tab = "snapshot" | "vault" | "past" | "stories";
/** One card. `vaultKey` makes it editable: it saves to that Grant Vault field. */
interface Entry { id: string; title: string; sub?: string; text: string; vaultKey?: string; help?: string }

const outline = "bg-transparent border-white/20 text-white/85 hover:bg-white/10 hover:text-white";

function EntryCard({ e, onSave }: { e: Entry; onSave?: (key: string, value: string) => Promise<void> }) {
  const [done, setDone] = useState(false);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(e.text);
  const [saving, setSaving] = useState(false);
  const copy = () => void navigator.clipboard.writeText(e.text).then(
    () => { setDone(true); window.setTimeout(() => setDone(false), 1600); },
    () => toast.error("Couldn't copy. Select the text and copy it by hand."),
  );
  const save = async () => {
    if (!onSave || !e.vaultKey) return;
    setSaving(true);
    try { await onSave(e.vaultKey, value.trim()); setEditing(false); toast.success(`${e.title} saved to the Grant Vault`); }
    catch (err) { toast.error((err as Error).message); }
    finally { setSaving(false); }
  };
  return (
    <GcCard
      title={e.title}
      blurb={e.sub}
      right={
        <>
          {e.text.trim() && !editing && (
            <Button size="sm" variant="outline" className={outline} onClick={copy}>
              {done ? <><Check className="w-3.5 h-3.5 mr-1.5 text-emerald-300" /> Copied</> : <><Copy className="w-3.5 h-3.5 mr-1.5" /> Copy</>}
            </Button>
          )}
          {e.vaultKey && !editing && (
            <Button size="sm" variant="outline" className={outline} onClick={() => { setValue(e.text); setEditing(true); }}>
              <Pencil className="w-3.5 h-3.5 mr-1.5" /> {e.text.trim() ? "Edit" : "Fill in"}
            </Button>
          )}
        </>
      }
    >
      {editing ? (
        <div className="p-4 space-y-2">
          {e.help && <p className="text-[12px] text-white/45">{e.help}</p>}
          <Textarea
            autoFocus
            value={value}
            onChange={(ev) => setValue(ev.target.value)}
            rows={Math.min(20, Math.max(3, value.split("\n").length + 1))}
            className="bg-black/40 border-white/15 text-sm leading-relaxed text-white"
          />
          <div className="flex gap-2">
            <Button size="sm" className="font-bold text-black hover:brightness-110" style={{ backgroundColor: GC_BLUE }} disabled={saving || value.trim() === e.text.trim()} onClick={() => void save()}>
              {saving ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Check className="w-3.5 h-3.5 mr-1.5" />} Save to the Vault
            </Button>
            <Button size="sm" variant="ghost" className="text-white/60 hover:text-white hover:bg-white/10" disabled={saving} onClick={() => setEditing(false)}>Cancel</Button>
          </div>
        </div>
      ) : e.text.trim() ? (
        <div className="p-4 whitespace-pre-wrap text-sm leading-relaxed text-white/90">{e.text}</div>
      ) : (
        <p className="p-4 text-[12px] text-amber-300/80">Not filled in yet.</p>
      )}
    </GcCard>
  );
}

export default function ResourcePanel({ open, onOpenChange, stories }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  stories: WriterStory[];
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("snapshot");
  const [q, setQ] = useState("");
  const { data: memory = [] } = useQuery({ queryKey: ["grant-memory"], queryFn: loadMemory, enabled: open });
  // The Vault as saved, every field (empty ones too, so they can be filled in here).
  const { data: saved = {} } = useQuery({
    queryKey: ["grant-vault-raw"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase.from("grant_org_fields" as never).select("key, value");
      if (error) throw new Error(error.message);
      return Object.fromEntries(((data ?? []) as { key: string; value: string | null }[]).map((r) => [r.key, r.value])) as Record<string, string | null>;
    },
  });

  const saveVault = async (key: string, value: string) => {
    const { error } = await supabase.from("grant_org_fields" as never).upsert(
      { key, value, updated_at: new Date().toISOString(), updated_by: user?.id ?? null } as never,
      { onConflict: "key" } as never,
    );
    if (error) throw new Error(error.message);
    // Everywhere the Vault is read: this pop-up, Grant Coach home, the application, and the writer's library.
    for (const k of ["grant-vault-raw", "grant-org-fields", "grant-library"]) qc.invalidateQueries({ queryKey: [k] });
  };

  const entries: Entry[] = useMemo(() => {
    if (tab === "vault") return ORG_FIELDS.map((f) => ({ id: f.key, title: f.label, text: orgFieldValue(f, saved), vaultKey: f.key, help: f.help }));
    if (tab === "past") return memory.map((m) => ({ id: m.id, title: m.question, sub: m.funder ?? undefined, text: m.answer }));
    if (tab === "stories") return stories.map((s) => ({ id: s.id, title: s.title, sub: [s.program, s.consent === "anonymous" ? "anonymous" : null].filter(Boolean).join(" · ") || undefined, text: s.story }));
    return [];
  }, [tab, saved, memory, stories]);
  const shown = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    return words.length ? entries.filter((e) => words.every((w) => `${e.title} ${e.sub ?? ""} ${e.text}`.toLowerCase().includes(w))) : entries;
  }, [entries, q]);

  const TABS: { k: Tab; label: string }[] = [
    { k: "snapshot", label: "Snapshot" },
    { k: "vault", label: "Grant Vault" },
    { k: "past", label: `Past answers${memory.length ? ` · ${memory.length}` : ""}` },
    { k: "stories", label: `Stories${stories.length ? ` · ${stories.length}` : ""}` },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-[96vw] h-[88vh] p-0 gap-0 overflow-hidden flex flex-col bg-black border-white/20 text-white">
        <DialogHeader className="px-5 pt-4 pb-3 border-b border-white/10 space-y-2 text-left">
          <div>
            <DialogTitle className="flex items-center gap-2 text-base"><Library className="w-4 h-4" style={{ color: GC_BLUE }} /> Resources</DialogTitle>
            <DialogDescription className="text-[12px] text-white/50">Copy what you need, then paste it in the chat or the answer box. Edits here save everywhere. Esc or ✕ takes you back.</DialogDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {TABS.map((t) => (
              <button
                key={t.k}
                type="button"
                onClick={() => { setTab(t.k); setQ(""); }}
                className={`rounded-xl border px-4 py-1.5 text-sm font-semibold transition-colors ${tab === t.k ? "border-white/30 bg-white/10 text-white" : "border-white/10 bg-white/[0.03] text-white/65 hover:bg-white/[0.06]"}`}
              >
                {t.label}
              </button>
            ))}
            {tab !== "snapshot" && (
              <div className="relative ml-auto w-56">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-white/40" />
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" className="h-8 pl-8 text-sm bg-neutral-950 border-white/15 text-white" />
              </div>
            )}
          </div>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto p-5">
          {tab === "snapshot" ? (
            <YearSnapshot />
          ) : (
            <div className="space-y-4">
              {shown.map((e) => <EntryCard key={`${tab}-${e.id}`} e={e} onSave={tab === "vault" ? saveVault : undefined} />)}
              {!shown.length && <p className="text-sm text-white/45 py-6 text-center">{q ? "Nothing matches that search." : tab === "past" ? "No approved answers yet." : "No stories with consent yet."}</p>}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
