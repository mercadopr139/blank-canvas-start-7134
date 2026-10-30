// A draft card's text with the change marked (Josh, 2026-10-29): words the
// draft adds or changes in amber, words it removes struck through and dim,
// everything else as it was. When there is no current answer, or the draft
// is a wholly new piece, it reads plain.
import { diffWords, differs } from "@/lib/grantCoach/diffWords";

export default function DraftDiff({ before, after, className = "" }: { before: string | null | undefined; after: string; className?: string }) {
  const base = (before ?? "").trim();
  if (!base || !differs(base, after)) return <p className={className}>{after}</p>;
  const parts = diffWords(base, after);
  // A rewrite from scratch marks nearly everything: then the marks say nothing, so it reads plain with one line of warning.
  const addedLen = parts.filter((p) => p.kind === "added").reduce((n, p) => n + p.text.length, 0);
  if (addedLen > after.length * 0.85) {
    return (
      <div>
        <p className="px-3 pt-2 text-[11px] font-semibold text-amber-300">Mostly new text, not a small change — read it whole.</p>
        <p className={className}>{after}</p>
      </div>
    );
  }
  return (
    <p className={className}>
      {parts.map((p, k) =>
        p.kind === "same" ? <span key={k}>{p.text}</span>
          : p.kind === "added" ? <mark key={k} className="rounded-sm px-0.5 bg-amber-400/35 text-amber-50 font-medium">{p.text}</mark>
          : <del key={k} className="text-white/35 decoration-red-400/70">{p.text}</del>,
      )}
    </p>
  );
}
