import { useState, useMemo } from "react";
import coachingRingsideImage from "@/assets/programs/coaching-ringside.jpg";
import { Link } from "react-router-dom";
import groupActivityImage from "@/assets/programs/group-activity.jpg";
import groupLessonImage from "@/assets/programs/group-lesson.jpg";
import instructorSpeakingImage from "@/assets/programs/instructor-speaking.jpg";
import teamActivityImage from "@/assets/programs/team-activity.jpg";
import smileLabDisplayImage from "@/assets/programs/smile-lab-display.jpg";
import smileLabModelsImage from "@/assets/programs/smile-lab-models.jpg";
import lilChampsActivity1 from "@/assets/programs/lil-champs-activity-1.jpg";
import lilChampsActivity2 from "@/assets/programs/lil-champs-activity-2.jpg";
import lilChampsActivity3 from "@/assets/programs/lil-champs-activity-3.jpg";
import lilChampsActivity4 from "@/assets/programs/lil-champs-activity-4.jpg";
import lilChampsActivity5 from "@/assets/programs/lil-champs-activity-5.jpg";
import lilChampsActivity6 from "@/assets/programs/lil-champs-activity-6.jpg";
import nj4sLogo from "@/assets/programs/nj4s-logo.png";
import capeAssistLogo from "@/assets/programs/cape-assist-logo.png";
import deltaDentalLogo from "@/assets/programs/delta-dental-logo.png";
import launchPadLogo from "@/assets/programs/launch-pad-logo.png";
import spiritualDevPrayer1 from "@/assets/programs/spiritual-dev-prayer-1.jpg";
import spiritualDevPrayer2 from "@/assets/programs/spiritual-dev-prayer-2.jpg";
import spiritualDevPrayer3 from "@/assets/programs/spiritual-dev-prayer-3.jpg";
import smileLabGroupImage from "@/assets/programs/smile-lab-group.png";
import smileLabInstructorImage from "@/assets/programs/smile-lab-instructor.png";
import smileLabKidsPuzzle from "@/assets/programs/smile-lab-kids-puzzle.png";
import smileLabBoysCraft from "@/assets/programs/smile-lab-boys-craft.png";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ClickToEnlargeGallery } from "@/components/ui/click-to-enlarge-gallery";

// Excursions images (shared gallery)
import { excursionGalleryImages } from "@/data/excursionsGallery";
import realTalkJoeFranco from "@/assets/programs/real-talk-joe-franco.png";
import { mealTrainGalleryImages } from "@/data/mealTrainGallery";
type ProgramItem = {
  id: string;
  title: string;
  subtitle: string;
  ageRange: string;
  blurb: string;
  policyText?: string;
  images: {
    src: string;
    alt: string;
    caption?: string;
  }[];
  buttonLabel: string;
};
const ProgramsExtrasSection = () => {
  const items: ProgramItem[] = useMemo(() => [{
    id: "smile-lab",
    title: "Dental Dental's Smile Lab Program",
    subtitle: "Junior Boxers Only",
    ageRange: "7–10 years old",
    blurb: "Smile Lab, in partnership with Delta Dental, is an oral health initiative at No Limits Academy designed to improve access to care and deliver engaging, oral health education that empowers youth to take control of their oral health and overall well-being.",
    images: [{
      src: groupLessonImage,
      alt: "Students participating in a group lesson at a table"
    }, {
      src: instructorSpeakingImage,
      alt: "Instructor speaking with students during a group activity"
    }, {
      src: teamActivityImage,
      alt: "Student giving a high five during a group activity"
    }, {
      src: groupActivityImage,
      alt: "Kids participating in a group activity"
    }, {
      src: smileLabDisplayImage,
      alt: "Smile Lab oral health display inside No Limits Academy"
    }, {
      src: smileLabModelsImage,
      alt: "Dental education models demonstrating oral health"
    }, {
      src: smileLabGroupImage,
      alt: "Smile Lab instructor teaching youth about oral health"
    }, {
      src: smileLabInstructorImage,
      alt: "Smile Lab instructor with dental models at No Limits Academy"
    }, {
      src: smileLabKidsPuzzle,
      alt: "Kids working together on a dental puzzle activity"
    }, {
      src: smileLabBoysCraft,
      alt: "Boys building dental models during Smile Lab"
    }],
    buttonLabel: "Back to Programs"
  }, {
    id: "excursions",
    title: "Excursions",
    subtitle: "Senior Boxers Only",
    ageRange: "11–19 years old",
    blurb: "Our excursions take youth beyond the facility walls—exposing them to new experiences, education, and opportunities that expand perspective and reinforce life skills learned in the gym.",
    images: excursionGalleryImages,
    buttonLabel: "Back to Programs"
  }, {
    id: "lil-champs",
    title: "NJ4S Lil' Champs' Corner Program",
    subtitle: "Junior Boxers Only",
    ageRange: "7–10 years old",
    blurb: "In partnership with Acenda's NJ4S, we provide age-appropriate education programming that strengthens life skills—supporting youth with routines, hygiene, and habits that translate into confidence, responsibility, and community pride.",
    images: [{
      src: lilChampsActivity1,
      alt: "Child working on a hands-on learning activity during Lil' Champs program"
    }, {
      src: lilChampsActivity2,
      alt: "Instructor engaging with kids during a Lil' Champs group activity"
    }, {
      src: lilChampsActivity3,
      alt: "Kids working together on a hands-on learning activity during Lil' Champs"
    }, {
      src: lilChampsActivity4,
      alt: "Child decorating a heart-shaped craft during Lil' Champs"
    }, {
      src: lilChampsActivity5,
      alt: "Lil' Champs students proudly holding up their handmade heart crafts"
    }, {
      src: lilChampsActivity6,
      alt: "Student participating in a Lil' Champs hands-on learning activity"
    }],
    buttonLabel: "Back to Programs"
  }, {
    id: "real-talk",
    title: "Real Talk Sessions",
    subtitle: "Senior Boxers",
    ageRange: "11–19 years old",
    blurb: "Real Talk Sessions bring influential adults to No Limits Academy to share honest stories of struggle, failure, heartbreak, and setbacks—showing youth what perseverance and resilience look like in real life. Speakers share how resilience and faith helped anchor them through adversity, with the goal of inspiring youth to keep moving forward.",
    images: [{
      src: realTalkJoeFranco,
      alt: "Joe Franco with NLA youth at Real Talk Session",
      caption: "Joe Franco, NLA Donor & Wildwood Crest Commissioner"
    }, {
      src: "/placeholder.svg",
      alt: "Real Talk Sessions photo 2",
      caption: "Real Talk Sessions"
    }, {
      src: "/placeholder.svg",
      alt: "Real Talk Sessions photo 3",
      caption: "Real Talk Sessions"
    }, {
      src: "/placeholder.svg",
      alt: "Real Talk Sessions photo 4",
      caption: "Real Talk Sessions"
    }, {
      src: "/placeholder.svg",
      alt: "Real Talk Sessions photo 5",
      caption: "Real Talk Sessions"
    }, {
      src: "/placeholder.svg",
      alt: "Real Talk Sessions photo 6",
      caption: "Real Talk Sessions"
    }],
    buttonLabel: "Back to Programs"
  }, {
    id: "spiritual-development",
    title: "Spiritual Development",
    subtitle: "All Boxers Welcome",
    ageRange: "7–19 years old",
    blurb: "Spiritual development at No Limits Academy focuses on reflection, values, purpose, and personal growth within a supportive and respectful environment. This component is designed to complement our youth development work by encouraging mindfulness, character, and healthy decision-making.",
    policyText: "At No Limits Academy, we respect each individual's unique spiritual journey. Participation in any aspect of spiritual development is entirely voluntary. We do not require youth participants to read, engage with, or participate in spiritual practices or teachings. For youth who are curious or willing to explore their spiritual development, we are here to offer support and guidance. NLA's focus is on providing a nurturing, caring, and encouraging environment where youth can explore God, at their own pace, if they choose to do so.",
    images: [{
      src: spiritualDevPrayer1,
      alt: "Youth in reflection during spiritual development",
      caption: "Spiritual Development"
    }, {
      src: spiritualDevPrayer2,
      alt: "Group reflection during spiritual development",
      caption: "Spiritual Development"
    }, {
      src: spiritualDevPrayer3,
      alt: "Youth in group prayer during spiritual development at NLA",
      caption: "Spiritual Development"
    }, {
      src: "/placeholder.svg",
      alt: "Spiritual Development photo 4",
      caption: "Spiritual Development"
    }, {
      src: "/placeholder.svg",
      alt: "Spiritual Development photo 5",
      caption: "Spiritual Development"
    }, {
      src: "/placeholder.svg",
      alt: "Spiritual Development photo 6",
      caption: "Spiritual Development"
    }],
    buttonLabel: "Back to Programs"
  }, {
    id: "launch-pad",
    title: "The Launch Pad",
    subtitle: "Senior Boxers Only",
    ageRange: "11–19 years old",
    blurb: "The Launch Pad prepares youth for more than early work experience—it introduces them to the world of business. Through a network of local businesses, youth gain hands-on exposure to professional environments where they learn responsibility, communication, and how organizations operate.\n\nMentored by business leaders, participants build the habits, confidence, and understanding needed to graduate high school with a clear path forward and the discipline to succeed.",
    images: [{
      src: "/placeholder.svg",
      alt: "Launch Pad photo 1"
    }, {
      src: "/placeholder.svg",
      alt: "Launch Pad photo 2"
    }, {
      src: "/placeholder.svg",
      alt: "Launch Pad photo 3"
    }, {
      src: "/placeholder.svg",
      alt: "Launch Pad photo 4"
    }, {
      src: "/placeholder.svg",
      alt: "Launch Pad photo 5"
    }, {
      src: "/placeholder.svg",
      alt: "Launch Pad photo 6"
    }],
    buttonLabel: "Back to Programs"
  }, {
    id: "coaching-boys-into-men",
    title: "Coaching Boys into Men (Evidence-Based Program)",
    subtitle: "Senior Boxers",
    ageRange: "11–19 years old",
    blurb: "In partnership with Cape Assist, CBIM is an evidence-based violence prevention program that trains coaches to teach young male athletes about respect, integrity, and non-violence. Through ongoing conversations and teachable moments, coaches help shape attitudes and behaviors that prevent relationship abuse and promote healthy masculinity.",
    images: [{
      src: "/placeholder.svg",
      alt: "Coaching Boys into Men photo 1"
    }, {
      src: "/placeholder.svg",
      alt: "Coaching Boys into Men photo 2"
    }, {
      src: "/placeholder.svg",
      alt: "Coaching Boys into Men photo 3"
    }, {
      src: "/placeholder.svg",
      alt: "Coaching Boys into Men photo 4"
    }, {
      src: "/placeholder.svg",
      alt: "Coaching Boys into Men photo 5"
    }, {
      src: "/placeholder.svg",
      alt: "Coaching Boys into Men photo 6"
    }],
    buttonLabel: "Back to Programs"
  }, {
    id: "meal-train",
    title: "Meal Train",
    subtitle: "All Participants",
    ageRange: "7–19 years old",
    blurb: "The NLA Meal Train supports our youth participants by providing free, sit-down meals during scheduled program days. These meals create consistency, build community, and ensure our athletes are fueled, focused, and cared for while they train and learn together. Volunteers play a vital role in making this possible.",
    images: mealTrainGalleryImages,
    buttonLabel: "Back to Programs"
  }], []);
  const [openId, setOpenId] = useState<string | null>(null);
  const openItem = items.find(x => x.id === openId) || null;


  // Sort items alphabetically by title
  const sortedItems = [...items].sort((a, b) => a.title.localeCompare(b.title));

  // Create a combined list with link items inserted alphabetically
  type ListItem = { type: 'modal'; item: ProgramItem } | { type: 'link'; title: string; to: string };
  
  const allItems: ListItem[] = [
    ...sortedItems.map(item => ({ type: 'modal' as const, item })),
    { type: 'link' as const, title: 'Gym Buddies', to: '/gym-buddies' }
  ].sort((a, b) => {
    const titleA = a.type === 'modal' ? a.item.title : a.title;
    const titleB = b.type === 'modal' ? b.item.title : b.title;
    return titleA.localeCompare(titleB);
  });

  return <section className="py-16 md:py-20 bg-background relative overflow-hidden">
      {/* Background image on the right */}
      <div className="absolute right-0 top-0 bottom-0 w-full md:w-1/3 pointer-events-none">
        <img 
          src={coachingRingsideImage} 
          alt="" 
          className="h-full w-full object-cover object-[60%_20%] opacity-25 md:opacity-100"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/60 via-30% to-transparent" />
      </div>
      <div className="container relative z-10">
        <h2 className="text-2xl md:text-3xl font-bold text-foreground">
          More Programs at NLA
        </h2>
        <p className="mt-3 text-base md:text-lg text-muted-foreground max-w-3xl">
          These programs strengthen the core experience and show how NLA extends impact beyond boxing & fitness training.
        </p>

        {/* Bullet-style list - alphabetically sorted */}
        <ul className="mt-6 space-y-3">
          {allItems.map((listItem, idx) => (
            <li key={listItem.type === 'modal' ? listItem.item.id : listItem.title} className="flex items-start gap-3">
              <span className="mt-2.5 h-2 w-2 rounded-full bg-foreground flex-shrink-0" />
              {listItem.type === 'modal' ? (
                <button 
                  type="button" 
                  onClick={() => setOpenId(listItem.item.id)} 
                  className="text-left text-lg font-medium text-foreground underline underline-offset-4 hover:text-foreground/80 transition-colors" 
                  aria-haspopup="dialog"
                >
                  {listItem.item.title}
                </button>
              ) : (
                <Link 
                  to={listItem.to} 
                  state={{ fromPrograms: true }} 
                  className="text-left text-lg font-medium text-foreground underline underline-offset-4 hover:text-foreground/80 transition-colors"
                >
                  {listItem.title}
                </Link>
              )}
            </li>
          ))}
        </ul>

        {/* Modal */}
        <Dialog open={!!openItem} onOpenChange={open => !open && setOpenId(null)}>
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
                <img src={deltaDentalLogo} alt="Delta Dental Logo" className="h-20 w-auto border-none" />
              </div>}

            {/* NJ4S Logo for Lil' Champs */}
            {openItem?.id === "lil-champs" && <div className="flex justify-center my-0">
                <img src={nj4sLogo} alt="NJ4S Logo" className="h-48 w-auto border-none" />
              </div>}

            {/* Cape Assist Logo for Coaching Boys into Men */}
            {openItem?.id === "coaching-boys-into-men" && <div className="flex justify-center my-0">
                <img src={capeAssistLogo} alt="Cape Assist Logo" className="h-48 w-auto border-none" />
              </div>}

            {/* Launch Pad Logo */}
            {openItem?.id === "launch-pad" && <div className="flex justify-center my-4">
                <img src={launchPadLogo} alt="The Launch Pad Logo" className="h-48 w-auto border-none" />
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
      </div>
    </section>;
};
export default ProgramsExtrasSection;