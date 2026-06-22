import { Sun } from "lucide-react";
import { isSummerBreakActive, SUMMER_BREAK_COPY } from "@/lib/summerBreak";

/**
 * Public-facing banner shown on the Programs page and the /register page
 * during the summer-break window (July 1 → Sept 28 by default — see
 * src/lib/summerBreak.ts to update annually).
 *
 * Renders nothing outside the window so we can drop it anywhere without
 * needing date checks at the call site.
 *
 * Compact variant (used on /register where the form is the main attraction)
 * trades the bottom "reach out" line for a tighter footprint.
 */
export default function SummerBreakBanner({ compact = false }: { compact?: boolean }) {
  if (!isSummerBreakActive()) return null;

  return (
    <section className="bg-amber-500/[0.07] border-y border-amber-400/30">
      <div className="container py-5 md:py-6">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-start gap-3">
            <div className="shrink-0 w-9 h-9 rounded-full bg-amber-500/15 border border-amber-400/40 flex items-center justify-center">
              <Sun className="w-4 h-4 text-amber-300" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.15em] text-amber-300 mb-1">
                Summer Schedule — through September 28
              </p>
              <ul className="space-y-1 text-sm md:text-base text-foreground/85">
                <li>
                  <span className="font-semibold text-foreground">Senior Boxing</span> meets {SUMMER_BREAK_COPY.seniorSchedule}
                </li>
                <li>
                  <span className="font-semibold text-foreground">Junior Boxing</span> returns {SUMMER_BREAK_COPY.juniorReturn}
                </li>
                <li>
                  <span className="font-semibold text-foreground">Re-registration</span> for the {SUMMER_BREAK_COPY.newProgramYear} program year opens {SUMMER_BREAK_COPY.reRegistrationOpens}
                </li>
              </ul>
              {!compact && (
                <p className="text-xs md:text-sm text-foreground/60 italic mt-3">
                  Have a question or a child who needs to start now? Reach out — we work with families case-by-case.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
