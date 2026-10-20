// Pin a message-board conversation to a lap checkpoint (docs/LAP_PLAN.md,
// step 5). A small select in the thread header: the topics of the
// conversation's own pillar, or none. Pinned, the conversation is listed at
// that checkpoint when the runner arrives, whether or not it moved this week.
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Flag, Check, ChevronDown } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const LapPinSelect = ({ conversationId, pillar, value }: { conversationId: string; pillar: string; value: string | null }) => {
  const qc = useQueryClient();
  const { data: topics = [] } = useQuery({
    queryKey: ["lap-topics-for-pin", pillar],
    queryFn: async () => {
      const { data, error } = await supabase.from("lap_topics" as never).select("id, title").eq("pillar", pillar).is("retired_at", null).is("this_lap_only_lap_id", null).order("sort_order");
      if (error) throw error;
      return (data ?? []) as unknown as { id: string; title: string }[];
    },
  });
  if (topics.length === 0) return null;

  const pin = async (topicId: string) => {
    const { error } = await supabase.from("mb_conversations").update({ lap_topic_id: topicId || null } as never).eq("id", conversationId);
    if (error) { toast.error(`Couldn't pin: ${error.message}`); return; }
    qc.invalidateQueries({ queryKey: ["mb-conversations"] });
    qc.invalidateQueries({ queryKey: ["lap-conversations"] });
    toast.success(topicId ? `Pinned to ${topics.find((t) => t.id === topicId)?.title ?? "the Lap"}.` : "Unpinned from the Lap.");
  };

  const pinned = topics.find((t) => t.id === value) ?? null;
  // A real control, not a bare dropdown (Josh, 2026-10-19: "where?"): a
  // pill that reads "Pin to the lap" until pinned, then the checkpoint's
  // name in NLA red. The list is the app's own dark menu — a native
  // <select> painted its list white-on-white (Josh, same day).
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full border text-[11px] font-semibold flex-shrink-0 outline-none ${pinned ? "border-[#bf0f3e]/70 bg-[#bf0f3e]/15 text-white" : "border-white/20 bg-white/5 text-zinc-300 hover:bg-white/10 hover:text-white"}`}
          title={pinned ? `Pinned to ${pinned.title} on the Lap — click to change` : "Pin this conversation to a checkpoint on the Lap, so it is waiting there on lap day"}
          aria-label="Pin to a lap checkpoint"
        >
          <Flag className="w-3.5 h-3.5" style={{ color: "#bf0f3e" }} />
          <span className="max-w-[160px] truncate">{pinned ? `On the Lap: ${pinned.title}` : "Pin to the Lap"}</span>
          <ChevronDown className="w-3 h-3 opacity-60" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60 bg-neutral-900 border-white/[0.08] shadow-2xl text-white">
        <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-zinc-500">Pin to a checkpoint</DropdownMenuLabel>
        {topics.map((t) => (
          <DropdownMenuItem key={t.id} onSelect={() => void pin(t.id)} className="cursor-pointer text-white/85 focus:text-white focus:bg-white/10">
            <span className="w-4 mr-1.5 inline-flex justify-center">{t.id === value ? <Check className="w-3.5 h-3.5" style={{ color: "#bf0f3e" }} /> : null}</span>
            {t.title}
          </DropdownMenuItem>
        ))}
        {pinned && (
          <>
            <DropdownMenuSeparator className="bg-white/10" />
            <DropdownMenuItem onSelect={() => void pin("")} className="cursor-pointer text-zinc-400 focus:text-white focus:bg-white/10">
              <span className="w-4 mr-1.5" />Take off the Lap
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default LapPinSelect;
