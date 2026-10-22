// The Grant Vault's "Answers from past grants": every answer approved in a
// grant folder, which the next grant reuses (src/lib/grantCoach/memory.ts).
// Josh can read them, fix one for every grant after this, or take one out.
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { History, Search, Trash2 } from "lucide-react";
import GcCard from "@/components/admin/grantCoach/GcCard";
import { loadMemory, type MemoryRow } from "@/lib/grantCoach/memory";

const when = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/New_York" });

export default function PastAnswers() {
  const qc = useQueryClient();
  const { data: memory = [], isLoading, isError, error } = useQuery({ queryKey: ["grant-memory"], queryFn: loadMemory });
  const [q, setQ] = useState("");
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? memory.filter((m) => `${m.question} ${m.answer} ${m.funder ?? ""}`.toLowerCase().includes(t)) : memory;
  }, [memory, q]);

  const save = async (m: MemoryRow, answer: string) => {
    const v = answer.trim();
    if (!v || v === m.answer) return;
    const { error: e } = await supabase.from("grant_answer_memory" as never).update({ answer: v, updated_at: new Date().toISOString() } as never).eq("id", m.id);
    if (e) { toast.error(e.message); return; }
    qc.invalidateQueries({ queryKey: ["grant-memory"] });
    toast.success("Saved. The next grant that asks this uses your new answer.");
  };
  const remove = async (m: MemoryRow) => {
    const { error: e } = await supabase.from("grant_answer_memory" as never).delete().eq("id", m.id);
    if (e) { toast.error(e.message); return; }
    qc.invalidateQueries({ queryKey: ["grant-memory"] });
    toast("Taken out of the memory. Grant Coach won't reuse it.", {
      action: { label: "Undo", onClick: async () => { await supabase.from("grant_answer_memory" as never).insert(m as never); qc.invalidateQueries({ queryKey: ["grant-memory"] }); } },
    });
  };

  return (
    <GcCard
      icon={<History className="w-4 h-4" />}
      title="Answers from past grants"
      blurb={`${memory.length} approved answer${memory.length === 1 ? "" : "s"} · the next grant that asks the same question reuses them`}
    >
      <div className="p-4 space-y-3">
        <p className="text-[12px] text-white/50">
          Every answer you approve in a grant folder lands here, with the funder and the date. Short answers are reused as they are; written answers become the starting draft, adapted to the new funder. Edit one here and every grant after this uses the edit.
        </p>
        {memory.length > 5 && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/35" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search the questions and answers" className="pl-9 bg-neutral-950 border-white/15 text-white text-sm" />
          </div>
        )}
        {isLoading && <p className="text-[12px] text-white/40">Loading…</p>}
        {isError && <p className="text-[12px] text-red-300">Couldn't load the answers: {(error as Error).message}</p>}
        {!isLoading && !isError && memory.length === 0 && (
          <p className="text-[12px] text-white/40">Nothing yet. Approve answers in a grant folder and they appear here.</p>
        )}
        <ul className="divide-y divide-white/[0.06]">
          {shown.map((m) => (
            <li key={m.id} className="py-3 space-y-1.5">
              <div className="flex items-start gap-2">
                <p className="flex-1 text-sm font-semibold text-white/90">{m.question}</p>
                <button type="button" onClick={() => void remove(m)} title="Take it out of the memory" className="p-1 text-white/30 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
              </div>
              <Textarea
                key={`${m.id}-${m.updated_at}`}
                defaultValue={m.answer}
                onBlur={(e) => void save(m, e.target.value)}
                rows={Math.min(8, Math.max(1, Math.ceil(m.answer.length / 90)))}
                className="bg-neutral-950 border-white/10 text-white text-sm"
              />
              <p className="text-[11px] text-white/35">{m.funder ?? "A grant"} · {when(m.updated_at)}{m.source === "portal" ? " · typed into the portal" : ""}</p>
            </li>
          ))}
        </ul>
      </div>
    </GcCard>
  );
}
