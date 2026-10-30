// "Start the next one from this folder" (Josh, 2026-10-29): a second
// application to the same funder in the same cycle, for a different program.
// One small form — the name, the program it funds, the amount, and a line on
// what is different — then Grant Coach builds the folder: the funder's files
// and rules copied, the case written for the new program, every question
// carried over with the facts as they were and every written answer empty,
// to be rewritten fresh. Josh lands in the new folder with the drafting
// already under way.
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { GC_BLUE } from "@/components/admin/grantCoach/GcCard";
import { startNext, carryAsIs, type SourceFolder, type SourceDoc, type SourceItem } from "@/lib/grantCoach/sibling";
import type { LibraryEntry } from "@/lib/grantCoach/writer";
import type { Fact } from "@/lib/grantCoach/liveFacts";

const money = (n: number | null) => (n == null ? "" : `$${Number(n).toLocaleString()}`);
const toMoney = (text: string): number | null => {
  const n = Number(text.replace(/[^0-9.]/g, ""));
  return text.trim() && Number.isFinite(n) ? n : null;
};

export default function StartNextDialog({ open, onOpenChange, source, docs, items, library, getFacts, userId }: {
  open: boolean; onOpenChange: (o: boolean) => void;
  source: SourceFolder; docs: SourceDoc[]; items: SourceItem[];
  library: LibraryEntry[]; getFacts: () => Promise<Fact[]>; userId: string | null;
}) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [name, setName] = useState(`${source.name} · next`);
  const [firstProgram, setFirstProgram] = useState(source.program_name ?? "");
  const [program, setProgram] = useState("");
  const [amount, setAmount] = useState(money(source.amount_requested));
  const [different, setDifferent] = useState("");
  const [stage, setStage] = useState<string | null>(null);

  const live = items.filter((i) => i.status !== "na");
  const kept = live.filter((i) => carryAsIs(i) && !!i.answer?.trim()).length;
  const uploads = live.filter((i) => i.kind === "upload").length;
  const rewritten = live.length - kept - uploads;
  const files = docs.filter((d) => d.side === "funder" && !/^Application: screen-\d+/.test(d.title)).length;

  const go = async () => {
    if (!name.trim()) { toast.error("Name the new grant."); return; }
    if (!program.trim()) { toast.error("Which program does this one fund?"); return; }
    setStage("Starting…");
    try {
      const facts = await getFacts();
      const { id, warnings } = await startNext({
        source, docs, items, library, facts, userId,
        next: { name: name.trim(), program: program.trim(), firstProgram, amount: toMoney(amount), different },
        onStage: setStage,
      });
      qc.invalidateQueries({ queryKey: ["grant-folders"] });
      qc.invalidateQueries({ queryKey: ["grant-folder", source.id] });
      onOpenChange(false);
      toast.success(`"${name.trim()}" is ready. Grant Coach is rewriting the ${rewritten} written answer${rewritten === 1 ? "" : "s"} for ${program.trim()}.`);
      for (const w of warnings) toast.error(w, { duration: 10000 });
      navigate(`/admin/finance/grant-coach/${id}`);
    } catch (e) {
      toast.error(`Couldn't start the next one: ${(e as Error).message}`);
    } finally {
      setStage(null);
    }
  };

  const busy = stage != null;
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!busy) onOpenChange(o); }}>
      <DialogContent className="bg-[#141416] border-white/15 text-white max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="inline-flex items-center gap-2"><Layers className="w-4 h-4" style={{ color: GC_BLUE }} /> Start the next one from this folder</DialogTitle>
          <DialogDescription className="text-white/55">
            Another application to {source.funder} for a different program or service. The funder's files and rules come across; every question comes across. The facts stay as they are; every written answer is written again, fresh, for the new program — the first application is context, never a template.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <label className="block text-[11px] text-white/50">Name the new grant
            <Input value={name} onChange={(e) => setName(e.target.value)} disabled={busy} className="mt-1 bg-black/40 border-white/15 text-white" />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-[11px] text-white/50">The first application funds
              <Input value={firstProgram} onChange={(e) => setFirstProgram(e.target.value)} disabled={busy} placeholder="e.g. Battle Team" className="mt-1 bg-black/40 border-white/15 text-white" />
            </label>
            <label className="block text-[11px] text-white/50">This one funds
              <Input value={program} onChange={(e) => setProgram(e.target.value)} disabled={busy} placeholder="e.g. Non-Battle Team and the Littles" className="mt-1 bg-black/40 border-white/15 text-white" autoFocus />
            </label>
          </div>
          <p className="text-[11px] text-white/40 -mt-1">Name both as a reviewer would tell them apart. Every rewrite is written for the second and checked against the first.</p>
          <label className="block text-[11px] text-white/50">Amount requested
            <Input value={amount} onChange={(e) => setAmount(e.target.value)} disabled={busy} inputMode="decimal" className="mt-1 bg-black/40 border-white/15 text-white" />
          </label>
          <label className="block text-[11px] text-white/50">What is different about this one (optional, but it sets the angle of every rewrite)
            <Textarea value={different} onChange={(e) => setDifferent(e.target.value)} disabled={busy} rows={3} placeholder={`e.g. The Non-Battle Team and the Littles: ages 7–19, non-contact boxing, no competition travel. The money pays for … — nothing the ${firstProgram || "first"} application already pays for.`} className="mt-1 bg-black/40 border-white/15 text-white text-sm" />
          </label>
          <div className="rounded-lg bg-white/[0.04] p-3 text-[12px] text-white/60 space-y-1">
            <p><span className="text-white font-semibold">{files}</span> funder file{files === 1 ? "" : "s"} and the rules read from them — copied.</p>
            <p><span className="text-white font-semibold">{kept}</span> fact{kept === 1 ? "" : "s"} (the Vault, the portal's choices) — carried over as they are, for you to approve in one click.</p>
            <p><span className="text-white font-semibold">{rewritten}</span> written answer{rewritten === 1 ? "" : "s"} — rewritten by Grant Coach for the new program, each checked against the first application for sameness.</p>
            {uploads > 0 && <p><span className="text-white font-semibold">{uploads}</span> upload{uploads === 1 ? "" : "s"} — attached again, per grant.</p>}
          </div>
          {/* The progress reads as its own line, not inside the button (2026-10-30: the button overflowed the dialog). */}
          {busy && <p className="text-[12px] inline-flex items-center gap-2" style={{ color: GC_BLUE }}><Loader2 className="w-4 h-4 animate-spin shrink-0" /> <span className="min-w-0 break-words">{stage}</span></p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" className="text-white/60 hover:text-white hover:bg-white/10" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
            <Button className="font-bold text-black hover:brightness-110 shrink-0" style={{ backgroundColor: GC_BLUE }} onClick={() => void go()} disabled={busy}>
              {busy ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Working…</> : <><Layers className="w-4 h-4 mr-2" /> Create the next application</>}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
