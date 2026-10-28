// Resources, a pop-up from the question's conversation (Josh, 2026-10-24):
// it opens on the Grant Vault exactly as Grant Coach home shows it — the one
// source of truth: each section's approved paragraph (Copy, Unlock, edit,
// Approve and lock) with the facts under it (Copy, Edit, saved to the same
// Vault) — because that screen is "way easier on the eyes". Past answers
// and stories sit beside it with Copy. Esc, ✕ or a click outside closes it
// and leaves the question as it was.
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, Check, Search, Library } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import GcCard, { GC_BLUE } from "@/components/admin/grantCoach/GcCard";
import GrantVault from "@/components/admin/grantCoach/GrantVault";
import { loadMemory } from "@/lib/grantCoach/memory";
import type { WriterStory } from "@/lib/grantCoach/writer";

type Tab = "vault" | "past" | "stories";
/** One read-only card with Copy: a past answer or a story. */
interface Entry { id: string; title: string; sub?: string; text: string }

const outline = "bg-transparent border-white/20 text-white/85 hover:bg-white/10 hover:text-white";

function EntryCard({ e }: { e: Entry }) {
  const [done, setDone] = useState(false);
  const copy = () => void navigator.clipboard.writeText(e.text).then(
    () => { setDone(true); window.setTimeout(() => setDone(false), 1600); },
    () => toast.error("Couldn't copy. Select the text and copy it by hand."),
  );
  return (
    <GcCard
      title={e.title}
      blurb={e.sub}
      right={
        e.text.trim() && (
          <Button size="sm" variant="outline" className={outline} onClick={copy}>
            {done ? <><Check className="w-3.5 h-3.5 mr-1.5 text-emerald-300" /> Copied</> : <><Copy className="w-3.5 h-3.5 mr-1.5" /> Copy</>}
          </Button>
        )
      }
    >
      <div className="p-4 whitespace-pre-wrap text-sm leading-relaxed text-white/90">{e.text}</div>
    </GcCard>
  );
}

export default function ResourcePanel({ open, onOpenChange, stories }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  stories: WriterStory[];
}) {
  const [tab, setTab] = useState<Tab>("vault");
  const [q, setQ] = useState("");
  const { data: memory = [] } = useQuery({ queryKey: ["grant-memory"], queryFn: loadMemory, enabled: open });

  const entries: Entry[] = useMemo(() => {
    if (tab === "past") return memory.map((m) => ({ id: m.id, title: m.question, sub: m.funder ?? undefined, text: m.answer }));
    if (tab === "stories") return stories.map((s) => ({ id: s.id, title: s.title, sub: [s.program, s.consent === "anonymous" ? "anonymous" : null].filter(Boolean).join(" · ") || undefined, text: s.story }));
    return [];
  }, [tab, memory, stories]);
  const shown = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    return words.length ? entries.filter((e) => words.every((w) => `${e.title} ${e.sub ?? ""} ${e.text}`.toLowerCase().includes(w))) : entries;
  }, [entries, q]);

  const TABS: { k: Tab; label: string }[] = [
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
            {tab !== "vault" && (
              <div className="relative ml-auto w-56">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-white/40" />
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" className="h-8 pl-8 text-sm bg-neutral-950 border-white/15 text-white" />
              </div>
            )}
          </div>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto p-5">
          {tab === "vault" ? (
            <GrantVault />
          ) : (
            <div className="space-y-4">
              {shown.map((e) => <EntryCard key={`${tab}-${e.id}`} e={e} />)}
              {!shown.length && <p className="text-sm text-white/45 py-6 text-center">{q ? "Nothing matches that search." : tab === "past" ? "No approved answers yet." : "No stories with consent yet."}</p>}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
