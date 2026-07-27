import { useState } from "react";
import { Link } from "react-router-dom";
import { YouTubeEmbed } from "@/components/orientation/YouTubeEmbed";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ClickToEnlargeGallery } from "@/components/ui/click-to-enlarge-gallery";
import { useSiteImages } from "@/hooks/useSiteImages";
import type { SiteImageItem } from "@/config/siteImages";
type ProgramItem = {
  id: string;
  title: string;
  subtitle: string;
  ageRange: string;
  blurb: string;
  policyText?: string;
  images: SiteImageItem[];
  buttonLabel: string;
};
const ProgramsExtrasSection = () => {
  // Photos are managed from the admin (Website Photos); resolveGroup returns the
  // edited images if a group has been changed, else the bundled defaults.
  const { resolveGroup } = useSiteImages();
  const single = (key: string) => resolveGroup(key)[0]?.src ?? "";
  const items: ProgramItem[] = [{
    id: "smile-lab",
    title: "Delta Dental's Smile Lab",
    subtitle: "Junior Boxers Only",
    ageRange: "7–10 years old",
    blurb: "Smile Lab is part of Double Punch Tuesday—our Junior Boxing program followed by optional aftercare. After training, youth participate in an oral health initiative through our partnership with Delta Dental, designed to improve access to care and deliver engaging education that empowers youth to take control of their oral health and overall well-being.",
    images: resolveGroup("programs.smile-lab"),
    buttonLabel: "Back to Programs"
  }, {
    id: "excursions",
    title: "Excursions",
    subtitle: "Senior Boxers Only",
    ageRange: "11–19 years old",
    blurb: "Our excursions take youth beyond the facility walls—exposing them to new experiences, education, and opportunities that expand perspective and reinforce life skills learned in the gym.",
    images: resolveGroup("programs.excursions"),
    buttonLabel: "Back to Programs"
  }, {
    id: "lil-champs",
    title: "NJ4S Lil' Champs' Corner",
    subtitle: "Junior Boxers Only",
    ageRange: "7–10 years old",
    blurb: "Lil' Champs' Corner is part of Double Punch Tuesday—our Junior Boxing program followed by optional aftercare. After training, youth participate in age-appropriate education programming through our NJ4S partnership with Acenda, building life skills like routines, hygiene, and habits that translate into confidence and responsibility.",
    images: resolveGroup("programs.lil-champs"),
    buttonLabel: "Back to Programs"
  }, {
    id: "real-talk",
    title: "Real Talk Sessions",
    subtitle: "Senior Boxers",
    ageRange: "11–19 years old",
    blurb: "Real Talk Sessions bring influential adults to No Limits Academy to share honest stories of struggle, failure, heartbreak, and setbacks—showing youth what perseverance and resilience look like in real life. Speakers share how resilience and faith helped anchor them through adversity, with the goal of inspiring youth to keep moving forward.",
    images: resolveGroup("programs.real-talk"),
    buttonLabel: "Back to Programs"
  }, {
    id: "spiritual-development",
    title: "Spiritual Development",
    subtitle: "All Boxers Welcome",
    ageRange: "7–19 years old",
    blurb: "Spiritual development at No Limits Academy focuses on reflection, values, purpose, and personal growth within a supportive and respectful environment. This component is designed to complement our youth development work by encouraging mindfulness, character, and healthy decision-making.",
    policyText: "At No Limits Academy, we respect each individual's unique spiritual journey. Participation in any aspect of spiritual development is entirely voluntary. We do not require youth participants to read, engage with, or participate in spiritual practices or teachings. For youth who are curious or willing to explore their spiritual development, we are here to offer support and guidance. NLA's focus is on providing a nurturing, caring, and encouraging environment where youth can explore God, at their own pace, if they choose to do so.",
    images: resolveGroup("programs.spiritual-development"),
    buttonLabel: "Back to Programs"
  }, {
    id: "launch-pad",
    title: "The Launch Pad",
    subtitle: "Senior Boxers Only",
    ageRange: "11–19 years old",
    blurb: "The Launch Pad is how No Limits Academy executes its mission long-term. It keeps young people connected to guidance, opportunity, and support long after they leave the gym—through a growing network of mentors, local businesses, and real-world partnerships.\n\nWe don't just train athletes. We develop future leaders, employees, employers, entrepreneurs, and community builders—youth who graduate with a clear path forward and the discipline to succeed.",
    images: resolveGroup("programs.launch-pad"),
    buttonLabel: "Back to Programs"
  }, {
    id: "coaching-boys-into-men",
    title: "Coaching Boys into Men (Evidence-Based Program)",
    subtitle: "Senior Boxers",
    ageRange: "11–19 years old",
    blurb: "In partnership with Cape Assist, CBIM is an evidence-based violence prevention program that trains coaches to teach young male athletes about respect, integrity, and non-violence. Through ongoing conversations and teachable moments, coaches help shape attitudes and behaviors that prevent relationship abuse and promote healthy masculinity.",
    images: resolveGroup("programs.coaching-boys-into-men"),
    buttonLabel: "Back to Programs"
  }, {
    id: "meal-train",
    title: "Meal Train",
    subtitle: "All Participants",
    ageRange: "7–19 years old",
    blurb: "The NLA Meal Train supports our youth participants by providing free, sit-down meals during scheduled program days. These meals create consistency, build community, and ensure our athletes are fueled, focused, and cared for while they train and learn together. Volunteers play a vital role in making this possible.",
    images: resolveGroup("programs.meal-train"),
    buttonLabel: "Back to Programs"
  }];
  const [openId, setOpenId] = useState<string | null>(null);
  const [bankingBoxingOpen, setBankingBoxingOpen] = useState(false);
  const openItem = items.find((x) => x.id === openId) || null;


  // Sort items alphabetically by title
  const sortedItems = [...items].sort((a, b) => a.title.localeCompare(b.title));

  // Create a combined list with link items inserted alphabetically
  type ListItem = {type: 'modal';item: ProgramItem;} | {type: 'link';title: string;to: string;} | {type: 'video';title: string;};

  const allItems: ListItem[] = [
  ...sortedItems.map((item) => ({ type: 'modal' as const, item })),
  { type: 'link' as const, title: 'Gym Buddies', to: '/gym-buddies' },
  { type: 'video' as const, title: 'Banking & Boxing' }].
  sort((a, b) => {
    const titleA = a.type === 'modal' ? a.item.title : a.title;
    const titleB = b.type === 'modal' ? b.item.title : b.title;
    return titleA.localeCompare(titleB);
  });

  return <section className="py-16 md:py-20 bg-background relative overflow-hidden">
      {/* Background image on the right */}
      <div className="absolute right-0 top-0 bottom-0 w-full md:w-1/3 pointer-events-none">
        <img
        src={single("programs.background-coaching-ringside")}
        alt=""
        className="h-full w-full object-cover object-[60%_20%] opacity-25 md:opacity-100" />
      
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/60 via-30% to-transparent" />
      </div>
      <div className="container relative z-10">
        <h2 className="text-2xl md:text-3xl font-bold text-foreground">Extended Programs at NLA

      </h2>
        <p className="mt-3 text-base md:text-lg text-muted-foreground max-w-3xl">
          These programs strengthen the core experience and show how NLA extends impact beyond boxing & fitness training.
        </p>

        {/* Bullet-style list - alphabetically sorted */}
        <ul className="mt-6 space-y-3">
          {allItems.map((listItem, idx) =>
        <li key={listItem.type === 'modal' ? listItem.item.id : listItem.title} className="flex items-start gap-3">
              <span className="mt-2.5 h-2 w-2 rounded-full bg-foreground flex-shrink-0" />
              {listItem.type === 'modal' ?
          <button
            type="button"
            onClick={() => setOpenId(listItem.item.id)}
            className="text-left text-lg font-medium text-foreground underline underline-offset-4 hover:text-foreground/80 transition-colors"
            aria-haspopup="dialog">
            
                  {listItem.item.title}
                </button> :
          listItem.type === 'link' ?
          <Link
            to={listItem.to}
            state={{ fromPrograms: true }}
            className="text-left text-lg font-medium text-foreground underline underline-offset-4 hover:text-foreground/80 transition-colors">
            
                  {listItem.title}
                </Link> :

          <button
            type="button"
            onClick={() => setBankingBoxingOpen(true)}
            className="text-left text-lg font-medium text-foreground underline underline-offset-4 hover:text-foreground/80 transition-colors"
            aria-haspopup="dialog">
            
                  {listItem.title}
                </button>
          }
            </li>
        )}
        </ul>

        {/* Modal */}
        <Dialog open={!!openItem} onOpenChange={(open) => !open && setOpenId(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold">
                {openItem?.title}
              </DialogTitle>
              <p className="text-sm font-medium text-muted-foreground">
                {openItem?.subtitle}
              </p>
              <p className="text-xs font-normal text-muted-foreground/70">
                {openItem?.ageRange}
              </p>
            </DialogHeader>
            
            <p className="text-base text-muted-foreground px-0 py-[10px] pb-0">
              {openItem?.blurb}
            </p>

            {openItem?.policyText && <p className="text-xs italic text-muted-foreground mt-4">
                *{openItem.policyText}
              </p>}

            {/* Delta Dental Logo for Smile Lab */}
            {openItem?.id === "smile-lab" && <div className="flex justify-center my-4">
                <img src={single("programs.smile-lab-logo")} alt="Delta Dental Logo" className="h-20 w-auto border-none" />
              </div>}

            {/* NJ4S Video + Logo for Lil' Champs */}
            {openItem?.id === "lil-champs" && <>
                <div className="my-4">
                  <YouTubeEmbed videoId="R6HPefPkv20" title="NJ4S Lil' Champs' Corner Program" />
                </div>
                <div className="flex justify-center my-0">
                  <img src={single("programs.lil-champs-logo")} alt="NJ4S Logo" className="h-48 w-auto border-none" />
                </div>
              </>}

            {/* Cape Assist Logo for Coaching Boys into Men */}
            {openItem?.id === "coaching-boys-into-men" && <div className="flex justify-center my-0">
                <img src={single("programs.cbim-logo")} alt="Cape Assist Logo" className="h-48 w-auto border-none" />
              </div>}

            {/* Launch Pad Logo */}
            {openItem?.id === "launch-pad" && <div className="flex flex-col items-center my-4">
                <img src={single("programs.launch-pad-logo")} alt="The Launch Pad Logo" className="h-48 w-auto border-none" />
                <p className="text-sm text-muted-foreground italic mt-2">Pictures coming soon</p>
              </div>}

            {/* Excursions Video */}
            {openItem?.id === "excursions" && <div className="my-4">
                <YouTubeEmbed videoId="ogMH05MZFwM" title="NLA Excursions" />
              </div>}

            {/* Gallery */}
            {openItem && openItem.images.length > 0 && <ClickToEnlargeGallery images={openItem.images} showCaptions />}

            {/* Bottom button */}
            <div className="mt-6 flex justify-end">
              <Button onClick={() => setOpenId(null)} className="bg-foreground text-background hover:bg-foreground/90">
                {openItem?.buttonLabel}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Banking & Boxing Video Dialog */}
        <Dialog open={bankingBoxingOpen} onOpenChange={setBankingBoxingOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold">Banking & Boxing</DialogTitle>
            </DialogHeader>
            <p className="text-base text-muted-foreground px-0 py-[10px] pb-4 whitespace-pre-line">
              {"In Banking & Boxing, our youth train bankers in boxing, and bankers return the favor by teaching financial literacy. The exchange helps young people recognize their value first—then absorb new knowledge with confidence."}
            </p>
            <div className="flex justify-center my-2">
              <img src={single("programs.banking-boxing-logo")} alt="OceanFirst Bank Logo" className="h-20 w-auto border-none" />
            </div>
            <YouTubeEmbed videoId="TsXbq70NB70" title="Banking & Boxing" />
            <div className="mt-6 flex justify-end">
              <Button onClick={() => setBankingBoxingOpen(false)} className="bg-foreground text-background hover:bg-foreground/90">
                Back to Programs
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </section>;
};
export default ProgramsExtrasSection;