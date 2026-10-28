// One approved paragraph of the program year, as a card (Josh, 2026-10-24),
// and the hook that loads the year. Since 2026-10-28 the Snapshot is no
// longer its own tab: each of its four sections opens the Grant Vault
// section it answers (GrantVault.tsx), so there is one place for grants.
// A section is approved word for word and locked until Josh unlocks it;
// Grant Coach reads only approved sections, as source 2 in every draft.
// Next year: Redraft with Grant Coach keeps the wording and updates the figures.
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, Lock, LockOpen, Check, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import GcCard, { GC_BLUE } from "@/components/admin/grantCoach/GcCard";
import type { useAsk } from "@/components/admin/AskDialog";
import {
  loadSnapshot, snapshotYears, snapshotYear, shortYear, saveSection, approveSection, unlockSection,
  type SnapshotSection as SnapshotRow,
} from "@/lib/grantCoach/snapshot";
import { loadLibrary, redraftSnapshotSection } from "@/lib/grantCoach/writer";
import { gatherLiveFacts } from "@/lib/grantCoach/liveFacts";

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", year: "numeric" }) : "";

export const copyText = async (text: string, what: string) => {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${what} copied`);
  } catch {
    toast.error("Couldn't copy. Select the text and copy it by hand.");
  }
};

export const outline = "bg-transparent border-white/20 text-white/85 hover:bg-white/10 hover:text-white";

/** The Snapshot for one year: its sections, the year before (to redraft from), and the year chips. */
export function useSnapshot() {
  const qc = useQueryClient();
  const target = snapshotYear();
  const { data: years = [] } = useQuery({ queryKey: ["grant-snapshot-years"], queryFn: snapshotYears });
  const [year, setYear] = useState<string | null>(null);
  // Open on the newest year on file; the last complete year when nothing is.
  useEffect(() => { if (!year && years) setYear(years[0] ?? target); }, [years, year, target]);
  const shown = year ?? target;
  const allYears = [...new Set([target, ...years])].sort().reverse();
  const prevYear = `${Number(shown.slice(0, 4)) - 1}-${shown.slice(0, 4)}`;
  const { data: sections = [], isLoading, isError, error } = useQuery({ queryKey: ["grant-snapshot", shown], queryFn: () => loadSnapshot(shown) });
  const { data: previous = [] } = useQuery({ queryKey: ["grant-snapshot", prevYear], queryFn: () => loadSnapshot(prevYear) });
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["grant-snapshot"] });
    qc.invalidateQueries({ queryKey: ["grant-snapshot-years"] });
  };
  const approved = sections.filter((s) => s.status === "approved");
  return { shown, allYears, setYear, sections, previous, approved, isLoading, isError, error: error as Error | null, refresh };
}

/** The first sentence or so of a section, for its folded card; the ALL-CAPS heading line is skipped. */
const gistOf = (body: string, max = 170) => {
  const lines = body.replace(/\r\n/g, "\n").split("\n").map((l) => l.trim()).filter(Boolean);
  const first = lines.find((l) => !/^[A-Z0-9 ·&–—'-]+$/.test(l)) ?? "";
  const t = first.replace(/\s+/g, " ");
  return t.length > max ? t.slice(0, max).replace(/\s+\S*$/, "") + "…" : t;
};

export default function SnapshotSectionCard({ section, previous, userId, ask, onChanged, open, onToggle }: {
  section: SnapshotRow;
  previous: string | null;
  userId: string | null;
  ask: ReturnType<typeof useAsk>["ask"];
  onChanged: () => void;
  /** Folded to its title and first line until opened (the Vault is a library index). */
  open: boolean;
  onToggle: () => void;
}) {
  const locked = section.status === "approved";
  const [text, setText] = useState(section.body);
  const [busy, setBusy] = useState<null | "save" | "approve" | "unlock" | "redraft">(null);
  const [changed, setChanged] = useState<string[]>([]);
  useEffect(() => { setText(section.body); }, [section.body, section.status]);
  const dirty = text !== section.body;

  const run = async (what: NonNullable<typeof busy>, fn: () => Promise<void>, done?: string) => {
    setBusy(what);
    try { await fn(); if (done) toast.success(done); onChanged(); }
    catch (e) { toast.error((e as Error).message); }
    finally { setBusy(null); }
  };

  const unlock = async () => {
    const ok = await ask.confirm({
      title: `Unlock "${section.title}"?`,
      body: "It goes back to a draft, with your words kept. Grant Coach stops using it until you approve it again.",
      confirmLabel: "Unlock",
    });
    if (ok) await run("unlock", () => unlockSection(section, userId), "Unlocked. Edit, then approve it again.");
  };

  const redraft = async () => {
    const values = await ask.prompt({
      title: `Redraft "${section.title}" for ${shortYear(section.program_year)}`,
      body: "Grant Coach keeps your approved wording sentence for sentence and updates only the figures the live numbers now state differently. You review it before anything is approved.",
      fields: [{ key: "instruction", label: "Anything to change? (optional)", placeholder: "e.g. add the new Launch Pad numbers" }],
      confirmLabel: "Redraft",
    });
    if (!values) return;
    setBusy("redraft");
    try {
      const [library, facts] = await Promise.all([loadLibrary(), gatherLiveFacts()]);
      const out = await redraftSnapshotSection({
        year: shortYear(section.program_year), title: section.title, current: text, previous,
        instruction: values.instruction?.trim() || undefined, library, facts,
      });
      setText(out.answer);
      setChanged(out.changed);
      toast.success("Redrafted. Read it, then save or approve.");
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(null); }
  };

  return (
    <GcCard
      icon={locked ? <Lock className="w-3.5 h-3.5" /> : <LockOpen className="w-3.5 h-3.5" />}
      title={`${section.title} · ${shortYear(section.program_year)}`}
      open={open}
      onToggle={onToggle}
      blurb={!open
        ? (section.body ? gistOf(section.body) : "Not written yet.")
        : locked
          ? <span className="inline-flex items-center gap-1">Approved word for word and locked{section.approved_at ? ` · ${fmtDate(section.approved_at)}` : ""}. Grant Coach uses it as written.</span>
          : section.body ? "Draft. Grant Coach does not use it until you approve it." : "Not written yet."}
      right={
        <>
          <Button size="sm" variant="outline" className={outline} disabled={!text.trim()} onClick={() => copyText(text, section.title)}>
            <Copy className="w-3.5 h-3.5 mr-1.5" /> Copy
          </Button>
          {locked && open && (
            <Button size="sm" variant="outline" className={outline} disabled={busy != null} onClick={unlock}>
              {busy === "unlock" ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <LockOpen className="w-3.5 h-3.5 mr-1.5" />} Unlock
            </Button>
          )}
        </>
      }
    >
      <div className="p-4 space-y-3">
        {locked ? (
          <div className="whitespace-pre-wrap text-sm leading-relaxed text-white/90">{section.body}</div>
        ) : (
          <>
            {!text.trim() && previous && (
              <p className="text-xs text-white/55">Last year's approved section is ready to start from. Press Redraft with Grant Coach to update its figures.</p>
            )}
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={Math.min(28, Math.max(10, text.split("\n").length + 2))}
              className="bg-black/30 border-white/15 text-sm leading-relaxed text-white"
              placeholder="Write the section, or redraft it with Grant Coach."
            />
            {changed.length > 0 && (
              <div className="rounded-lg border px-3 py-2 text-xs space-y-1" style={{ borderColor: `${GC_BLUE}55`, background: `${GC_BLUE}12` }}>
                <p className="font-semibold" style={{ color: GC_BLUE }}>What Grant Coach changed</p>
                <ul className="list-disc pl-4 text-white/75 space-y-0.5">{changed.map((c, i) => <li key={i}>{c}</li>)}</ul>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" className={outline} disabled={busy != null} onClick={redraft}>
                {busy === "redraft" ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 mr-1.5" style={{ color: GC_BLUE }} />} Redraft with Grant Coach
              </Button>
              <Button size="sm" variant="outline" className={outline} disabled={busy != null || !dirty} onClick={() => run("save", () => saveSection(section, text, userId), "Draft saved")}>
                {busy === "save" && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />} Save draft
              </Button>
              <Button
                size="sm"
                className="text-black hover:brightness-110"
                style={{ backgroundColor: GC_BLUE }}
                disabled={busy != null || !text.trim()}
                onClick={() => run("approve", async () => { await approveSection(section, text, userId); setChanged([]); }, "Approved and locked")}
              >
                {busy === "approve" ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Check className="w-3.5 h-3.5 mr-1.5" />} Approve and lock
              </Button>
            </div>
          </>
        )}
      </div>
    </GcCard>
  );
}
