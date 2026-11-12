// About this funder (Josh, 2026-11-12): what NLA knows about them, typed once
// and kept per funder — the relationship, who reads, what the regular gift
// has paid for, what they respond to, past asks and outcomes. It sits next to
// The Rules of This Grant (what the funder wrote) and goes with every writer,
// strategy and reviewer call. Grant Coach can also propose it from the
// conversation ("About this funder" card in a question's chat); nothing is
// saved until Josh clicks.
import { useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Textarea } from "@/components/ui/textarea";
import { ChevronDown, ChevronRight, Handshake } from "lucide-react";
import { GC_BLUE } from "@/components/admin/grantCoach/GcCard";
import { FUNDER_NOTE_PROMPTS, funderHistory, loadFunderNotes, saveFunderNotes, type FunderFolder } from "@/lib/grantCoach/funders";

/** The notes for a folder's funder, shared by the folder page (the row and the writer's folder). */
export const funderNotesQueryKey = (funder: string) => ["grant-funder", funder.trim().toLowerCase()] as const;
export function useFunderNotes(funder: string | null | undefined) {
  return useQuery({
    queryKey: funderNotesQueryKey(funder ?? ""),
    enabled: !!funder?.trim(),
    queryFn: () => loadFunderNotes(funder!),
    staleTime: 5 * 60_000,
  });
}

/** Every folder, as the funder history reads it: what NLA asked this funder for before and what happened. */
export function useFunderFolders() {
  return useQuery({
    queryKey: ["grant-funder-folders"],
    queryFn: async () => {
      const { data, error } = await supabase.from("grant_folders" as never)
        .select("id, name, funder, status, amount_requested, amount_awarded, due_at, period_start, submitted_at, decided_at, decline_reason");
      if (error) throw error;
      return (data ?? []) as unknown as FunderFolder[];
    },
    staleTime: 5 * 60_000,
  });
}

export default function AboutFunder({ folderId, funder, userId }: { folderId: string; funder: string; userId: string | null }) {
  const qc = useQueryClient();
  const { data: row, isLoading } = useFunderNotes(funder);
  const { data: folders = [] } = useFunderFolders();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const notes = row?.notes ?? "";
  const history = funderHistory(folders, funder, folderId);

  const save = async (v: string) => {
    if (v.trim() === notes.trim()) return;
    setSaving(true);
    try {
      await saveFunderNotes(funder, v, userId);
      qc.invalidateQueries({ queryKey: funderNotesQueryKey(funder) });
      toast.success(`Saved. Every grant with ${funder.trim()} reads this from now on.`);
    } catch (e) {
      toast.error(`Couldn't save: ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  const blurb: ReactNode = isLoading
    ? "reading…"
    : notes
      ? `what NLA knows about ${funder.trim()} · kept for every grant with them${row?.updated_at ? ` · ${new Date(row.updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" })}` : ""}`
      : `nothing written yet — who they are to NLA, who reads, what they have funded · every answer is written with this`;

  return (
    <div className="py-3">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="w-full flex items-start gap-2 text-left">
        {open ? <ChevronDown className="w-4 h-4 mt-0.5 shrink-0 text-white/50" /> : <ChevronRight className="w-4 h-4 mt-0.5 shrink-0 text-white/50" />}
        <Handshake className="w-4 h-4 mt-0.5 shrink-0" style={{ color: GC_BLUE }} />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold text-white">About this funder</span>
          <span className="block text-[11px] text-white/45">{blurb}</span>
        </span>
        {!notes && !isLoading && <span className="shrink-0 text-[11px] font-semibold text-amber-300">Start here</span>}
      </button>
      {open && (
        <div className="mt-2 pl-6 space-y-2.5">
          <p className="text-[12px] text-white/55">
            The Rules of This Grant is what the funder wrote. This is what you know about them. It is kept once per funder, not per grant,
            and goes with every answer, the strategy session and the reviewer. You can also tell Grant Coach in any question's conversation
            ("about this funder: …") and save what it proposes.
          </p>
          <ul className="text-[11px] text-white/40 space-y-0.5">
            {FUNDER_NOTE_PROMPTS.map((p) => <li key={p}>• {p}</li>)}
          </ul>
          <Textarea
            key={row?.updated_at ?? "new"}
            defaultValue={notes}
            onBlur={(e) => void save(e.target.value)}
            rows={notes ? Math.min(14, Math.max(5, notes.split("\n").length + 1)) : 5}
            disabled={saving}
            placeholder={`e.g. ALCF has given NLA a regular annual gift since 2023 ($5,000 a year), used for Junior Boxing equipment. Jim Lutz (President) reads the applications and interviews; the board votes. They like concrete equipment and kids' activities in Cape May County; they do not fund salaries.`}
            className="bg-neutral-950 border-white/15 text-white text-[12px] leading-relaxed"
          />
          <p className="text-[11px] text-white/35">Saves when you click away.</p>
          {history.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-white/45">NLA's other grants with them in Grant Coach</p>
              <ul className="mt-0.5 space-y-0.5">{history.map((h) => <li key={h.id} className="text-[12px] text-white/75">• {h.line}</li>)}</ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
