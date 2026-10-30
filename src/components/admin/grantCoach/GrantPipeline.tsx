// Every grant at a glance (Josh, 2026-10-24): the pipeline — asked, won,
// win rate — and one calendar of everything due across every grant:
// applications, reports, grant periods ending. Anything due inside two
// weeks shows amber; anything late shows red. This is the reminder.
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { CalendarClock, TrendingUp } from "lucide-react";
import GcCard, { GC_BLUE } from "@/components/admin/grantCoach/GcCard";
import { loadReports, pipelineStats, dueItems, daysUntil, type PipelineFolder } from "@/lib/grantCoach/lifecycle";
import { todayNY } from "@/lib/programYear";

const money = (n: number) => (n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2)}M` : `$${Math.round(n).toLocaleString()}`);
const fmtDay = (ymd: string) => new Date(`${ymd}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
const KIND: Record<string, string> = { application: "Application", report: "Report", period_end: "Period ends" };

export default function GrantPipeline({ folders }: { folders: PipelineFolder[] }) {
  const navigate = useNavigate();
  const { data: reports = [] } = useQuery({ queryKey: ["grant-reports", "all"], queryFn: () => loadReports() });
  const s = pipelineStats(folders);
  const today = todayNY();
  const due = dueItems(folders, reports).filter((d) => daysUntil(d.date, today) >= -60).slice(0, 12);
  const urgent = due.filter((d) => daysUntil(d.date, today) <= 14);

  const tile = (label: string, value: string, sub?: string) => (
    <div className="rounded-xl bg-white/[0.04] border border-white/10 p-3 min-w-0">
      <p className="text-[11px] uppercase tracking-wide text-white/45">{label}</p>
      {/* A six-figure sum ("$200,000") steps down a size so it stays inside the tile (Josh, 2026-10-30). */}
      <p className={`font-black tabular-nums mt-0.5 leading-tight ${value.length > 7 ? "text-base" : "text-xl"}`}>{value}</p>
      {sub && <p className="text-[11px] text-white/40">{sub}</p>}
    </div>
  );

  return (
    <div className="grid gap-4 lg:grid-cols-2 items-start">
      <GcCard icon={<TrendingUp className="w-4 h-4" />} title="The pipeline" blurb="Every grant NLA has applied for">
        <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
          {tile("Applying", String(s.applying))}
          {tile("Waiting", String(s.pending), "submitted")}
          {tile("Asked", money(s.asked), "sent in")}
          {tile("Won", money(s.won), s.winRate == null ? "none decided yet" : `${s.winRate}% win rate · ${s.wonCount} of ${s.wonCount + s.lostCount}`)}
        </div>
      </GcCard>

      <GcCard
        icon={<CalendarClock className="w-4 h-4" />}
        title="Coming up"
        blurb={urgent.length ? `${urgent.length} due in the next two weeks` : "Nothing due in the next two weeks"}
      >
        <ul className="divide-y divide-white/[0.06]">
          {due.map((d, i) => {
            const left = daysUntil(d.date, today);
            return (
              <li key={`${d.folderId}-${d.kind}-${d.date}-${i}`}>
                <button type="button" onClick={() => navigate(`/admin/finance/grant-coach/${d.folderId}`)} className="w-full px-4 py-2.5 flex items-center gap-3 text-left hover:bg-white/[0.03]">
                  <span className="w-20 shrink-0 text-[11px] font-bold uppercase tracking-wide" style={{ color: GC_BLUE }}>{KIND[d.kind]}</span>
                  <span className="flex-1 min-w-0 text-sm truncate">{d.title}</span>
                  <span className={`shrink-0 text-[12px] tabular-nums ${left < 0 ? "text-red-300" : left <= 14 ? "text-amber-300" : "text-white/50"}`}>
                    {fmtDay(d.date)} · {left < 0 ? `${-left}d late` : left === 0 ? "today" : `${left}d`}
                  </span>
                </button>
              </li>
            );
          })}
          {!due.length && <li className="px-4 py-3 text-[12px] text-white/40">No dates yet. Application deadlines and report due dates appear here.</li>}
        </ul>
      </GcCard>
    </div>
  );
}
