// Grant Coach's reviewer card: the plain pre-submit checks, and the skeptical
// funder's read — a score per criterion, the three weakest answers with a
// one-click fix, contradictions and numbers that don't match the back end.
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, Gavel, AlertTriangle, Check, Wand2, XCircle } from "lucide-react";
import GcCard, { GC_BLUE } from "@/components/admin/grantCoach/GcCard";
import { preSubmitChecks, reviewApplication, type Review } from "@/lib/grantCoach/review";
import type { CaseBrief, DraftFolder, LibraryEntry, FunderBrief } from "@/lib/grantCoach/writer";
import type { Fact } from "@/lib/grantCoach/liveFacts";
import type { AppItem } from "@/components/admin/grantCoach/GrantApplication";

interface Props {
  folderId: string;
  folder: DraftFolder;
  items: AppItem[];
  library: LibraryEntry[];
  getFacts: () => Promise<Fact[]>;
  caseBrief: CaseBrief | null;
  review: Review | null;
  reviewedAt: string | null;
  funderBrief: FunderBrief | null;
  /** Latest change to any answer, to tell a stale review from a current one. */
  lastChange: string | null;
  busy: boolean;
  onFix: (it: AppItem, instruction: string) => Promise<void>;
}

const tone = (pct: number) => (pct >= 85 ? "#34d399" : pct >= 70 ? GC_BLUE : pct >= 55 ? "#fcd34d" : "#fca5a5");

export default function GrantReviewer({ folderId, folder, items, library, getFacts, caseBrief, review, reviewedAt, funderBrief, lastChange, busy, onFix }: Props) {
  const qc = useQueryClient();
  const [running, setRunning] = useState(false);
  const [fixing, setFixing] = useState<string | null>(null);
  const live = items.filter((i) => i.status !== "na");
  const checks = preSubmitChecks(live);
  const stale = !!review && !!reviewedAt && !!lastChange && lastChange > reviewedAt;
  const ready = !checks.blank.length && !checks.over.length && !checks.unapproved.length && !checks.needYou.length;

  const run = async () => {
    setRunning(true);
    try {
      const r = await reviewApplication({
        folder, library, facts: await getFacts(), caseBrief, funderBrief,
        application: live.map((it, i) => ({ i: i + 1, section: it.section, label: it.label, help: it.detail, kind: it.kind, required: it.required, answer: it.answer, limit_kind: it.limit_kind, limit_value: it.limit_value })),
      });
      const { error } = await supabase.from("grant_folders" as never).update({ review: r, reviewed_at: new Date().toISOString() } as never).eq("id", folderId);
      if (error) throw new Error(error.message);
      qc.invalidateQueries({ queryKey: ["grant-folder", folderId] });
      toast.success(`Reviewed: ${r.overall}/100.`);
    } catch (e) {
      toast.error(`The reviewer: ${(e as Error).message}`);
    } finally {
      setRunning(false);
    }
  };

  const fix = async (w: Review["weakest"][number]) => {
    const it = live[w.i - 1];
    if (!it) { toast.error("That question isn't in the application any more."); return; }
    setFixing(it.id);
    try { await onFix(it, w.instruction || w.fix); toast.success("Rewritten. Read it, then approve it or reject it."); } finally { setFixing(null); }
  };

  const List = ({ title, rows, color }: { title: string; rows: AppItem[] | { label: string }[]; color: string }) => rows.length ? (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color }}>{title} ({rows.length})</p>
      <ul className="mt-0.5 space-y-0.5">{rows.slice(0, 8).map((r, k) => <li key={k} className="text-[12px] text-white/70">• {r.label}</li>)}{rows.length > 8 && <li className="text-[12px] text-white/40">…and {rows.length - 8} more</li>}</ul>
    </div>
  ) : null;

  return (
    <GcCard
      icon={<Gavel className="w-4 h-4" />}
      title="The reviewer"
      blurb={review ? `${review.overall}/100${stale ? " · answers changed since this review" : ""}` : "Read the application the way the funder's panel will, before you submit"}
      right={
        <Button size="sm" onClick={() => void run()} disabled={running || busy || !live.some((i) => i.answer?.trim())} className="text-white h-8" style={{ backgroundColor: "#bf0f3e" }}>
          {running ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Gavel className="w-4 h-4 mr-1.5" />} {review ? "Review again" : "Review the application"}
        </Button>
      }
    >
      <div className="p-4 space-y-4">
        {/* The plain checks: no AI, always current. */}
        <div className={`rounded-xl border p-3 ${ready ? "border-emerald-400/30 bg-emerald-400/[0.04]" : "border-amber-400/30 bg-amber-400/[0.04]"}`}>
          <p className={`text-sm font-semibold inline-flex items-center gap-1.5 ${ready ? "text-emerald-300" : "text-amber-200"}`}>
            {ready ? <Check className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />} {ready ? "Ready to submit: every required question answered, approved and inside its limit." : "Before you submit"}
          </p>
          {!ready && (
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <List title="Required, not answered" rows={checks.blank} color="#fca5a5" />
              <List title="Over the funder's limit" rows={checks.over} color="#fca5a5" />
              <List title="Need you" rows={checks.needYou} color="#fcd34d" />
              <List title="Answered, not approved yet" rows={checks.unapproved} color="#fcd34d" />
            </div>
          )}
        </div>

        {running && <p className="text-sm text-white/55 inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" style={{ color: GC_BLUE }} /> Reading every answer the way a skeptical reviewer would, and checking every number against the back end…</p>}

        {review && !running && (
          <>
            <div className="flex flex-wrap items-center gap-4">
              <div className="w-20 h-20 rounded-full flex flex-col items-center justify-center border-4 shrink-0" style={{ borderColor: tone(review.overall) }}>
                <span className="text-2xl font-black leading-none" style={{ color: tone(review.overall) }}>{review.overall}</span>
                <span className="text-[10px] text-white/45">of 100</span>
              </div>
              <p className="flex-1 min-w-[220px] text-sm text-white/85">{review.verdict}</p>
            </div>
            {stale && <p className="text-[12px] text-amber-300">Answers have changed since this review. Review again for a current score.</p>}

            {review.criteria.length > 0 && (
              <div className="space-y-2">
                {review.criteria.map((c) => {
                  const pct = c.max ? Math.round((c.score / c.max) * 100) : 0;
                  return (
                    <div key={c.name}>
                      <div className="flex justify-between gap-2 text-[13px]"><span className="text-white/85">{c.name}</span><span className="tabular-nums font-semibold" style={{ color: tone(pct) }}>{c.score}/{c.max}</span></div>
                      <div className="mt-1 h-1.5 rounded-full bg-white/10 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${pct}%`, background: tone(pct) }} /></div>
                      <p className="mt-0.5 text-[12px] text-white/50">{c.why}</p>
                    </div>
                  );
                })}
              </div>
            )}

            {review.weakest.length > 0 && (
              <div className="space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-amber-300">Where it loses the most points</p>
                {review.weakest.map((w) => {
                  const it = live[w.i - 1];
                  return (
                    <div key={w.i} className="rounded-xl border border-white/10 bg-black/30 p-3 space-y-1">
                      <p className="text-sm font-semibold text-white">{it?.label ?? `Question ${w.i}`}</p>
                      <p className="text-[13px] text-red-200/90 inline-flex gap-1.5"><XCircle className="w-4 h-4 shrink-0 mt-0.5" /> {w.problem}</p>
                      <p className="text-[13px] text-emerald-200/90 inline-flex gap-1.5"><Check className="w-4 h-4 shrink-0 mt-0.5" /> {w.fix}</p>
                      {it && (
                        <Button size="sm" onClick={() => void fix(w)} disabled={busy || fixing != null} variant="outline" className="mt-1 bg-transparent border-white/20 text-white hover:bg-white/10">
                          {fixing === it.id ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Wand2 className="w-4 h-4 mr-1.5" />} Fix it
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {(review.contradictions.length > 0 || review.wrong_numbers.length > 0) && (
              <div className="grid gap-3 sm:grid-cols-2">
                {review.contradictions.length > 0 && (
                  <div><p className="text-[11px] font-bold uppercase tracking-wide text-red-300">Answers that disagree</p><ul className="mt-0.5 space-y-0.5">{review.contradictions.map((c) => <li key={c} className="text-[12px] text-white/70">• {c}</li>)}</ul></div>
                )}
                {review.wrong_numbers.length > 0 && (
                  <div><p className="text-[11px] font-bold uppercase tracking-wide text-red-300">Numbers that don't match the back end</p><ul className="mt-0.5 space-y-0.5">{review.wrong_numbers.map((c) => <li key={c} className="text-[12px] text-white/70">• {c}</li>)}</ul></div>
                )}
              </div>
            )}
            <p className="text-[11px] text-white/35">Question numbers in these notes count from the top of the application. Reviewed {reviewedAt ? new Date(reviewedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York" }) : ""}.</p>
          </>
        )}
      </div>
    </GcCard>
  );
}
