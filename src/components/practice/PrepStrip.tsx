// The line at the top of a Workout Plan on the wall: what to drag out before
// the lift starts, worked out from the exercises, plus the coach's own note
// from the Practice Plan when there is one. Kids read this first.
export const PrepStrip = ({
  equipment, note, accent,
}: {
  equipment: string[];
  note: string | null | undefined;
  accent: string;
}) => {
  if (!equipment.length && !note) return null;
  return (
    <div
      className="shrink-0 rounded-xl border px-4 py-2 flex items-start gap-4 flex-wrap"
      style={{ borderColor: `${accent}55`, background: `${accent}12` }}
    >
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] self-center" style={{ color: accent }}>
        Prep · drag out first
      </p>
      {equipment.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {equipment.map((e) => (
            <span key={e} className="rounded-md border border-white/15 bg-white/[0.05] px-2 py-0.5 text-sm text-white/90">
              {e}
            </span>
          ))}
        </div>
      )}
      {note && (
        <p className="text-sm text-white/80 leading-snug basis-full md:basis-auto md:ml-auto">
          <span className="text-white/45 font-semibold">Coach&apos;s note · </span>{note}
        </p>
      )}
    </div>
  );
};
