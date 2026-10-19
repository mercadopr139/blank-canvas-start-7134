// Pin a message-board conversation to a lap checkpoint (docs/LAP_PLAN.md,
// step 5). A small select in the thread header: the topics of the
// conversation's own pillar, or none. Pinned, the conversation is listed at
// that checkpoint when the runner arrives, whether or not it moved this week.
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Flag } from "lucide-react";

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
    toast.success(topicId ? `Pinned to ${topics.find((t) => t.id === topicId)?.title ?? "the lap"}.` : "Unpinned from the lap.");
  };

  return (
    <label className="hidden sm:inline-flex items-center gap-1.5 text-[10px] text-zinc-500 flex-shrink-0" title="Pin this conversation to a checkpoint on the Lap">
      <Flag className="w-3 h-3" style={{ color: value ? "#bf0f3e" : undefined }} />
      <select
        value={value ?? ""}
        onChange={(e) => void pin(e.target.value)}
        className="bg-transparent border border-white/10 rounded-md px-1.5 py-0.5 text-[10px] text-zinc-400 hover:text-white focus:outline-none max-w-[150px]"
        aria-label="Pin to a lap checkpoint"
      >
        <option value="">Not on the lap</option>
        {topics.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
      </select>
    </label>
  );
};

export default LapPinSelect;
