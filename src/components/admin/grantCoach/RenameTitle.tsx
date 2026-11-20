// Rename a shelf, a card or a paragraph card in place (Josh, 2026-11-20: "I
// want the ability to manually edit the section title", then the card titles,
// then the paragraphs). One row: the name in a box, save, cancel, and — when
// the name differs from the shipped one — a way back to it. The caller keeps
// the pencil that opens this, and saves the name under its own key in
// grant_org_fields (null drops it); the writer never reads those rows.
import { useState } from "react";
import { toast } from "sonner";
import { Check, Loader2, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GC_BLUE } from "@/components/admin/grantCoach/GcCard";

export default function RenameTitle({ title, shipped, what, onRename, onClose }: {
  /** The name as shown now. */
  title: string;
  /** The name as shipped in code. */
  shipped: string;
  /** "shelf", "card" or "paragraph", for the toast. */
  what: string;
  /** Save the new name; null means back to the shipped one. */
  onRename: (name: string | null) => Promise<void>;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(title);
  const [busy, setBusy] = useState(false);
  const nameOrNull = (v: string) => (v.trim() && v.trim() !== shipped ? v.trim() : null);
  const save = async (name: string | null) => {
    setBusy(true);
    try {
      await onRename(name);
      toast.success(name ? `The ${what} is now "${name}"` : `The ${what} is "${shipped}" again`);
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    // Inside a header band that toggles its card on a click: the edit swallows its clicks.
    <span className="inline-flex items-center gap-2 flex-wrap" onClick={(e) => e.stopPropagation()}>
      <Input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void save(nameOrNull(draft)); } if (e.key === "Escape") onClose(); }}
        className="h-8 w-72 text-sm font-black uppercase tracking-wide bg-neutral-950 border-white/20 text-white"
        aria-label={`${what} title`}
      />
      <Button size="sm" className="h-8 font-bold text-black hover:brightness-110" style={{ backgroundColor: GC_BLUE }} disabled={busy || !draft.trim()} onClick={() => void save(nameOrNull(draft))}>
        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
      </Button>
      <button type="button" className="text-white/50 hover:text-white p-1" onClick={onClose} aria-label="Cancel"><X className="w-4 h-4" /></button>
      {title !== shipped && (
        <button type="button" onClick={() => void save(null)} className="text-[11px] normal-case tracking-normal font-normal text-white/40 hover:text-white inline-flex items-center gap-1" title={`Back to "${shipped}"`}>
          <RotateCcw className="w-3 h-3" /> Back to "{shipped}"
        </button>
      )}
    </span>
  );
}
