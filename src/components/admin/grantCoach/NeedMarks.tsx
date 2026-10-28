// Grant Coach leaves "[NEED: …]" where it lacks a fact. Josh (2026-10-28): "that
// should be in red so I don't accidentally miss it." Everywhere an answer or a
// draft is shown as text, the NEED notes are painted red and bold; the rest of
// the text is untouched. (A textarea can't colour its own text, so the red shows
// wherever the answer is read, not while it is being typed.)
import type { ReactNode } from "react";

const NEED = /(\[NEED:[^\]]*\]?)/gi;

/** The text with every [NEED: …] note in red. */
export default function NeedMarks({ text }: { text: string }) {
  if (!/\[NEED/i.test(text)) return <>{text}</>;
  const parts: ReactNode[] = [];
  text.split(NEED).forEach((piece, i) => {
    if (!piece) return;
    parts.push(
      /^\[NEED/i.test(piece)
        ? <mark key={i} className="rounded px-1 bg-red-500/20 text-red-300 font-bold">{piece}</mark>
        : <span key={i}>{piece}</span>,
    );
  });
  return <>{parts}</>;
}
