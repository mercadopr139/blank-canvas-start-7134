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

  const pinned = topics.find((t) => t.id === value) ?? null;
  // A real control, not a bare dropdown (Josh, 2026-10-19: "where?"): a
  // pill that reads "Pin to the lap" until pinned, then the checkpoint's
  // name in NLA red. The select sits over it, so a click opens the list.
  return (
    <label
      className={`relative inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full border text-[11px] font-semibold flex-shrink-0 cursor-pointer ${pinned ? "border-[#bf0f3e]/70 bg-[#bf0f3e]/15 text-white" : "border-white/20 bg-white/5 text-zinc-300 hover:bg-white/10 hover:text-white"}`}
      title={pinned ? `Pinned to ${pinned.title} on the Lap — click to change` : "Pin this conversation to a checkpoint on the Lap, so it is waiting there on lap day"}
    >
      <Flag className="w-3.5 h-3.5" style={{ color: "#bf0f3e" }} />
      <span className="max-w-[160px] truncate">{pinned ? `On the lap: ${pinned.title}` : "Pin to the lap"}</span>
      <select
        value={value ?? ""}
        onChange={(e) => void pin(e.target.value)}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        aria-label="Pin to a lap checkpoint"
      >
        <option value="">Not on the lap</option>
        {topics.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
      </select>
    </label>
  );
};

export default LapPinSelect;
