import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Heart, Calendar } from "lucide-react";

// Homepage Event Banner — an admin-managed promo (flyer + optional headline + a
// "sponsor" link) shown at the top of the homepage while an event is upcoming.
// Reads the singleton `event_banner` row (anon SELECT). Renders nothing unless
// it's enabled, has a flyer, and isn't past its hide-after date — so the homepage
// is unchanged when there's no event to promote.

interface EventBannerRow {
  enabled: boolean;
  flyer_url: string | null;
  flyer_alt: string | null;
  headline: string | null;
  subtext: string | null;
  sponsor_url: string | null;
  sponsor_label: string | null;
  hide_after: string | null;
}

const EventBanner = () => {
  const { data } = useQuery({
    queryKey: ["event-banner"],
    queryFn: async (): Promise<EventBannerRow | null> => {
      const { data, error } = await (supabase.from("event_banner" as never) as any)
        .select("*").eq("id", true).maybeSingle();
      if (error) throw error;
      return (data as EventBannerRow) ?? null;
    },
  });

  if (!data?.enabled || !data.flyer_url) return null;
  if (data.hide_after && new Date() > new Date(data.hide_after + "T23:59:59")) return null;

  const sponsor = data.sponsor_url?.trim();

  return (
    <section className="w-full py-10 md:py-14 px-4"
      style={{ background: "linear-gradient(110deg, #0a2472 0%, #b22234 46%, #ffffff 47.5%, #ffffff 52.5%, #169b62 54%, #ff7900 100%)" }}>
      <div className="max-w-4xl mx-auto flex flex-col items-center text-center">
        <span className="inline-flex items-center gap-1.5 text-xs md:text-sm font-black tracking-widest uppercase px-3 py-1 rounded-full mb-4 shadow-md" style={{ backgroundColor: "#0a2472", color: "#ffffff" }}>
          <Calendar className="h-4 w-4" /> Upcoming Event
        </span>

        {(data.headline || data.subtext) && (
          <div className="mb-6 rounded-2xl bg-black/55 backdrop-blur-sm px-6 py-4 shadow-xl ring-1 ring-white/10">
            {data.headline && (
              <h2 className="text-3xl md:text-5xl font-extrabold text-white tracking-tight">{data.headline}</h2>
            )}
            {data.subtext && (
              <p className="text-white/90 max-w-2xl mt-1.5 font-medium">{data.subtext}</p>
            )}
          </div>
        )}

        {/* Flyer — click to enlarge */}
        <Dialog>
          <DialogTrigger asChild>
            <button className="group relative rounded-2xl overflow-hidden ring-1 ring-white/15 shadow-2xl max-w-lg w-full">
              <img src={data.flyer_url} alt={data.flyer_alt || data.headline || "Event flyer"}
                className="w-full h-auto block transition-transform duration-300 group-hover:scale-[1.02]" />
              <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent text-white text-xs py-2 opacity-0 group-hover:opacity-100 transition-opacity">
                Tap to enlarge
              </span>
            </button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl p-2 bg-black border-white/10">
            <DialogHeader>
              <DialogTitle className="sr-only">Event flyer</DialogTitle>
            </DialogHeader>
            <img src={data.flyer_url} alt={data.flyer_alt || data.headline || "Event flyer"}
              className="w-full h-auto rounded-lg" />
          </DialogContent>
        </Dialog>

        {sponsor && (
          <a href={sponsor} target="_blank" rel="noopener noreferrer"
            className="mt-6 inline-flex items-center gap-2 px-7 py-3 rounded-xl font-bold border-2 border-black shadow-lg hover:opacity-90 transition-opacity"
            style={{ backgroundColor: "#ffffff", color: "#000000" }}>
            <Heart className="h-5 w-5" /> {data.sponsor_label?.trim() || "Sponsor this event"}
          </a>
        )}
      </div>
    </section>
  );
};

export default EventBanner;
