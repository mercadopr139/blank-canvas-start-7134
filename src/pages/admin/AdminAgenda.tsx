// Weekly Agenda — internal staff meeting tool spanning all 3 pillars.
// Phase 1 skeleton: page shell, three pillar sections in the fixed order
// (Operations → Sales & Marketing → Finance), and the week-summary box.
// CRUD, drag, attachments, Workbench sync, and the weekly cycle are
// future phases.

import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  PILLARS,
  PILLAR_LABEL,
  PILLAR_COLOR,
  type Pillar,
} from "@/pages/admin/AdminMessageBoard";

const formatWeekStart = (d: Date): string => {
  // Sunday-anchored ISO date for the week containing `d`.
  const day = d.getDay();
  const sunday = new Date(d);
  sunday.setDate(d.getDate() - day);
  return `${sunday.getFullYear()}-${String(sunday.getMonth() + 1).padStart(2, "0")}-${String(sunday.getDate()).padStart(2, "0")}`;
};

const formatWeekRangeDisplay = (weekStartIso: string): string => {
  const start = new Date(weekStartIso + "T12:00:00");
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${fmt(start)} – ${fmt(end)}, ${start.getFullYear()}`;
};

const PillarSection = ({ pillar }: { pillar: Pillar }) => {
  const color = PILLAR_COLOR[pillar];
  const label = PILLAR_LABEL[pillar];
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-3">
        <span
          className="w-2.5 h-2.5 rounded-full"
          style={{ background: color }}
        />
        <h2
          className="text-lg font-bold uppercase tracking-wide"
          style={{ color }}
        >
          {label}
        </h2>
        <span className="text-xs text-zinc-600">· 0 topics</span>
      </div>

      <div
        className="rounded-xl border-2 p-6 text-center"
        style={{
          borderColor: `${color}30`,
          background: `${color}08`,
        }}
      >
        <p className="text-sm text-zinc-500">
          No topics yet. Phase 2 will let you add topics here.
        </p>
      </div>
    </section>
  );
};

const AdminAgenda = () => {
  const navigate = useNavigate();
  const weekStartIso = formatWeekStart(new Date());

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Page header — same pattern as Message Board */}
      <header className="border-b border-white/[0.06] bg-[#09090b]/80 backdrop-blur-md sticky top-0 z-30">
        <div className="px-4 sm:px-6 py-3 flex items-center justify-between gap-3 max-w-screen-2xl mx-auto">
          <div className="flex items-center gap-3 min-w-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/admin/dashboard")}
              className="text-zinc-400 hover:text-white hover:bg-white/5 flex-shrink-0"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-base font-bold tracking-tight text-white leading-none">
                Weekly Agenda
              </h1>
              <p className="text-[10px] text-zinc-500 mt-0.5 truncate">
                {formatWeekRangeDisplay(weekStartIso)}
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-8 space-y-10">
        {/* AGENDA banner — the spec calls for big and bold at the top */}
        <div className="text-center">
          <h2 className="text-5xl sm:text-6xl font-black tracking-tight text-white">
            AGENDA
          </h2>
          <p className="mt-2 text-xs uppercase tracking-[0.25em] text-zinc-600">
            Weekly Review
          </p>
        </div>

        {/* Week summary — meeting lead's free-text capture for the week */}
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-5">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              Week Summary
            </h3>
            <span className="text-[10px] text-zinc-600 italic">
              Edit coming in Phase 2
            </span>
          </div>
          <p className="text-sm text-zinc-600 italic">
            The week's theme, wins, or heads-ups go here.
          </p>
        </div>

        {/* Three pillars — fixed order: Operations → Sales & Marketing → Finance */}
        {PILLARS.map((p) => (
          <PillarSection key={p} pillar={p} />
        ))}
      </main>
    </div>
  );
};

export default AdminAgenda;
