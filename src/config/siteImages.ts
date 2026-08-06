// Registry of editable website photo "groups". Each group is either a single
// image slot or a gallery. The `defaults` are the images bundled in code today;
// the Website Photos admin lets Josh/Chrissy override them (replace/add/remove/
// reorder) without a code change. Until a group is edited, the site renders
// these defaults, so nothing changes visually.
//
// Adding a new editable area later = register its group here + call
// resolveGroup(key) where it renders (see useSiteImages).

// ── Extended Programs assets ──────────────────────────────────────────────
import coachingRingsideImage from "@/assets/programs/coaching-ringside.jpg";
import groupActivityImage from "@/assets/programs/group-activity.jpg";
import groupLessonImage from "@/assets/programs/group-lesson.jpg";
import instructorSpeakingImage from "@/assets/programs/instructor-speaking.jpg";
import teamActivityImage from "@/assets/programs/team-activity.jpg";
import smileLabDisplayImage from "@/assets/programs/smile-lab-display.jpg";
import smileLabModelsImage from "@/assets/programs/smile-lab-models.jpg";
import smileLabGroupImage from "@/assets/programs/smile-lab-group.png";
import smileLabInstructorImage from "@/assets/programs/smile-lab-instructor.png";
import smileLabKidsPuzzle from "@/assets/programs/smile-lab-kids-puzzle.png";
import smileLabBoysCraft from "@/assets/programs/smile-lab-boys-craft.png";
import lilChampsActivity1 from "@/assets/programs/lil-champs-activity-1.jpg";
import lilChampsActivity2 from "@/assets/programs/lil-champs-activity-2.jpg";
import lilChampsActivity3 from "@/assets/programs/lil-champs-activity-3.jpg";
import lilChampsActivity4 from "@/assets/programs/lil-champs-activity-4.jpg";
import lilChampsActivity5 from "@/assets/programs/lil-champs-activity-5.jpg";
import lilChampsActivity6 from "@/assets/programs/lil-champs-activity-6.jpg";
import cbim1 from "@/assets/programs/cbim-1.png";
import cbim2 from "@/assets/programs/cbim-2.png";
import cbim3 from "@/assets/programs/cbim-3.png";
import cbim4 from "@/assets/programs/cbim-4.png";
import cbim5 from "@/assets/programs/cbim-5.png";
import cbim6 from "@/assets/programs/cbim-6.png";
import spiritualDevPrayer1 from "@/assets/programs/spiritual-dev-prayer-1.jpg";
import spiritualDevPrayer2 from "@/assets/programs/spiritual-dev-prayer-2.jpg";
import spiritualDevPrayer3 from "@/assets/programs/spiritual-dev-prayer-3.jpg";
import spiritualDevPrayer4 from "@/assets/programs/spiritual-dev-prayer-4.jpg";
import spiritualDevPrayer5 from "@/assets/programs/spiritual-dev-prayer-5.jpg";
import spiritualDevPrayer6 from "@/assets/programs/spiritual-dev-prayer-6.jpg";
import realTalkJoeFranco from "@/assets/programs/real-talk-joe-franco.png";
import realTalkNateEvans from "@/assets/programs/real-talk-nate-evans.jpg";
import nj4sLogo from "@/assets/programs/nj4s-logo.png";
import capeAssistLogo from "@/assets/programs/cape-assist-logo.png";
import deltaDentalLogo from "@/assets/programs/delta-dental-logo.png";
import launchPadLogo from "@/assets/programs/launch-pad-logo.png";
import oceanFirstBankLogo from "@/assets/programs/oceanfirst-bank-logo.png";
import { excursionGalleryImages } from "@/data/excursionsGallery";
import { mealTrainGalleryImages } from "@/data/mealTrainGallery";
import { gymBuddiesGalleryImages } from "@/data/gymBuddiesGallery";

export type SiteImageItem = {
  src: string;
  alt: string;
  caption?: string;
  objectPosition?: string;
  videoId?: string; // set → this item is a YouTube video, not a photo
};

export type SiteImageGroup = {
  key: string;
  label: string; // shown in the admin manager
  section: string; // grouping header in the admin manager
  kind: "single" | "gallery" | "video";
  defaults: SiteImageItem[];
  hidden?: boolean; // not shown as its own card (e.g. a gallery's paired video)
};

const LAUNCH_PAD_PLACEHOLDERS: SiteImageItem[] = Array.from({ length: 6 }, (_, i) => ({
  src: "/placeholder.svg",
  alt: `Launch Pad photo ${i + 1}`,
}));

const CONTENT_GROUPS: SiteImageGroup[] = [
  // ── Extended Programs · single images / logos ──
  {
    key: "programs.background-coaching-ringside",
    label: "Section background (coaching ringside)",
    section: "Extended Programs",
    kind: "single",
    defaults: [{ src: coachingRingsideImage, alt: "" }],
  },
  {
    key: "programs.smile-lab-logo",
    label: "Smile Lab — Delta Dental logo",
    section: "Extended Programs",
    kind: "single",
    defaults: [{ src: deltaDentalLogo, alt: "Delta Dental Logo" }],
  },
  {
    key: "programs.lil-champs-logo",
    label: "Lil' Champs — NJ4S logo",
    section: "Extended Programs",
    kind: "single",
    defaults: [{ src: nj4sLogo, alt: "NJ4S Logo" }],
  },
  {
    key: "programs.cbim-logo",
    label: "Coaching Boys into Men — Cape Assist logo",
    section: "Extended Programs",
    kind: "single",
    defaults: [{ src: capeAssistLogo, alt: "Cape Assist Logo" }],
  },
  {
    key: "programs.launch-pad-logo",
    label: "The Launch Pad — logo",
    section: "Extended Programs",
    kind: "single",
    defaults: [{ src: launchPadLogo, alt: "The Launch Pad Logo" }],
  },
  {
    key: "programs.banking-boxing-logo",
    label: "Banking & Boxing — OceanFirst Bank logo",
    section: "Extended Programs",
    kind: "single",
    defaults: [{ src: oceanFirstBankLogo, alt: "OceanFirst Bank Logo" }],
  },

  // ── Extended Programs · galleries ──
  {
    key: "programs.smile-lab",
    label: "Smile Lab — photo gallery",
    section: "Extended Programs",
    kind: "gallery",
    defaults: [
      { src: groupLessonImage, alt: "Students participating in a group lesson at a table" },
      { src: instructorSpeakingImage, alt: "Instructor speaking with students during a group activity" },
      { src: teamActivityImage, alt: "Student giving a high five during a group activity" },
      { src: groupActivityImage, alt: "Kids participating in a group activity" },
      { src: smileLabDisplayImage, alt: "Smile Lab oral health display inside No Limits Academy" },
      { src: smileLabModelsImage, alt: "Dental education models demonstrating oral health" },
      { src: smileLabGroupImage, alt: "Smile Lab instructor teaching youth about oral health" },
      { src: smileLabInstructorImage, alt: "Smile Lab instructor with dental models at No Limits Academy" },
      { src: smileLabKidsPuzzle, alt: "Kids working together on a dental puzzle activity" },
      { src: smileLabBoysCraft, alt: "Boys building dental models during Smile Lab" },
    ],
  },
  {
    key: "programs.excursions",
    label: "Excursions — photo gallery",
    section: "Extended Programs",
    kind: "gallery",
    defaults: excursionGalleryImages as SiteImageItem[],
  },
  {
    key: "programs.lil-champs",
    label: "Lil' Champs' Corner — photo gallery",
    section: "Extended Programs",
    kind: "gallery",
    defaults: [
      { src: lilChampsActivity1, alt: "Child working on a hands-on learning activity during Lil' Champs program" },
      { src: lilChampsActivity2, alt: "Instructor engaging with kids during a Lil' Champs group activity" },
      { src: lilChampsActivity3, alt: "Kids working together on a hands-on learning activity during Lil' Champs" },
      { src: lilChampsActivity4, alt: "Child decorating a heart-shaped craft during Lil' Champs" },
      { src: lilChampsActivity5, alt: "Lil' Champs students proudly holding up their handmade heart crafts" },
      { src: lilChampsActivity6, alt: "Student participating in a Lil' Champs hands-on learning activity" },
    ],
  },
  {
    key: "programs.real-talk",
    label: "Real Talk Sessions — photo gallery",
    section: "Extended Programs",
    kind: "gallery",
    defaults: [
      { src: realTalkJoeFranco, alt: "Joe Franco with NLA youth at Real Talk Session", caption: "Joe Franco, NLA Donor & Wildwood Crest Commissioner" },
      { src: realTalkNateEvans, alt: "Nate Evans speaking at Real Talk Session", caption: "Resilience Coach & Mentor, Nate Evans" },
    ],
  },
  {
    key: "programs.spiritual-development",
    label: "Spiritual Development — photo gallery",
    section: "Extended Programs",
    kind: "gallery",
    defaults: [
      { src: spiritualDevPrayer1, alt: "Youth in reflection during spiritual development", caption: "Spiritual Development" },
      { src: spiritualDevPrayer2, alt: "Group reflection during spiritual development", caption: "Spiritual Development" },
      { src: spiritualDevPrayer3, alt: "Youth in group prayer during spiritual development at NLA", caption: "Spiritual Development" },
      { src: spiritualDevPrayer4, alt: "Youth gathered listening during spiritual development", caption: "Spiritual Development" },
      { src: spiritualDevPrayer5, alt: "Two youth in prayer during spiritual development", caption: "Spiritual Development", objectPosition: "center 20%" },
      { src: spiritualDevPrayer6, alt: "Youth and mentors in reflection during spiritual development", caption: "Spiritual Development" },
    ],
  },
  {
    key: "programs.launch-pad",
    label: "The Launch Pad — photo gallery",
    section: "Extended Programs",
    kind: "gallery",
    defaults: LAUNCH_PAD_PLACEHOLDERS,
  },
  {
    key: "programs.coaching-boys-into-men",
    label: "Coaching Boys into Men — photo gallery",
    section: "Extended Programs",
    kind: "gallery",
    defaults: [
      { src: cbim1, alt: "CBIM closing session presentation" },
      { src: cbim2, alt: "CBIM coach leading discussion" },
      { src: cbim3, alt: "CBIM lesson on healthy behaviors" },
      { src: cbim4, alt: "CBIM group session at NLA" },
      { src: cbim5, alt: "CBIM coaches in discussion" },
      { src: cbim6, alt: "CBIM participants listening" },
    ],
  },
  {
    key: "programs.meal-train",
    label: "Meal Train — photo gallery",
    section: "Extended Programs",
    kind: "gallery",
    defaults: mealTrainGalleryImages as SiteImageItem[],
  },
  {
    // Starts empty — no bundled photos yet. Staff add photos in Website Photos
    // and they appear in the Banking & Boxing dialog on the Programs page.
    key: "programs.banking-boxing",
    label: "Banking & Boxing — photo gallery",
    section: "Extended Programs",
    kind: "gallery",
    defaults: [],
  },

  // ── Gym Buddies ──
  {
    key: "programs.gym-buddies",
    label: "Gym Buddies — photo gallery",
    section: "Gym Buddies",
    kind: "gallery",
    defaults: gymBuddiesGalleryImages as SiteImageItem[],
  },
];

// ── Program videos (one per program) ────────────────────────────────────────
// Each program gallery can carry a single YouTube video, managed in Website
// Photos and shown at the top of that program's popup. Stored in its own
// `<galleryKey>.video` group so editing a program's photos never touches its
// video (and vice-versa). The three programs that already had a hardcoded
// video keep it here as a default, so nothing changes until staff edit it.
const PROGRAM_VIDEO_DEFAULTS: Record<string, string> = {
  "programs.excursions": "ogMH05MZFwM",
  "programs.lil-champs": "R6HPefPkv20",
  "programs.banking-boxing": "TsXbq70NB70",
};

// Gallery keys that get a video slot in the manager + a player on the site.
export const PROGRAM_VIDEO_GALLERY_KEYS = [
  "programs.smile-lab",
  "programs.excursions",
  "programs.lil-champs",
  "programs.real-talk",
  "programs.spiritual-development",
  "programs.launch-pad",
  "programs.coaching-boys-into-men",
  "programs.meal-train",
  "programs.banking-boxing",
];

export const videoGroupKey = (galleryKey: string) => `${galleryKey}.video`;
export const supportsVideo = (galleryKey: string) => PROGRAM_VIDEO_GALLERY_KEYS.includes(galleryKey);

const VIDEO_GROUPS: SiteImageGroup[] = PROGRAM_VIDEO_GALLERY_KEYS.map((k) => {
  const def = PROGRAM_VIDEO_DEFAULTS[k];
  return {
    key: videoGroupKey(k),
    label: "Program video",
    section: "Extended Programs",
    kind: "video" as const,
    hidden: true,
    defaults: def ? [{ src: "", alt: "", videoId: def }] : [],
  };
});

export const SITE_IMAGE_GROUPS: SiteImageGroup[] = [...CONTENT_GROUPS, ...VIDEO_GROUPS];

export const SITE_IMAGE_GROUP_BY_KEY: Record<string, SiteImageGroup> = Object.fromEntries(
  SITE_IMAGE_GROUPS.map((g) => [g.key, g])
);

// ── YouTube helpers ──────────────────────────────────────────────────────────
// A video item is stored with url = "youtube:<id>" (no schema change needed).
export const YT_TOKEN_PREFIX = "youtube:";
export const youtubeToken = (id: string) => `${YT_TOKEN_PREFIX}${id}`;
export const isYouTubeToken = (url: string) => typeof url === "string" && url.startsWith(YT_TOKEN_PREFIX);
export const videoIdFromToken = (url: string) => (isYouTubeToken(url) ? url.slice(YT_TOKEN_PREFIX.length) : null);
export const youtubeThumb = (id: string) => `https://img.youtube.com/vi/${id}/hqdefault.jpg`;

// Pull a video ID out of any common YouTube link (watch, youtu.be, embed,
// shorts) or a raw 11-char ID. Returns null if we can't find one.
export function parseYouTubeId(input: string): string | null {
  const s = (input || "").trim();
  if (!s) return null;
  if (/^[a-zA-Z0-9_-]{11}$/.test(s)) return s;
  try {
    const url = new URL(s.startsWith("http") ? s : `https://${s}`);
    const host = url.hostname.replace(/^www\./, "");
    if (host === "youtu.be") {
      const id = url.pathname.slice(1).split("/")[0];
      if (/^[a-zA-Z0-9_-]{11}$/.test(id)) return id;
    }
    if (host.endsWith("youtube.com")) {
      const v = url.searchParams.get("v");
      if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return v;
      const parts = url.pathname.split("/").filter(Boolean);
      const i = parts.findIndex((p) => p === "embed" || p === "shorts" || p === "v");
      if (i >= 0 && /^[a-zA-Z0-9_-]{11}$/.test(parts[i + 1] || "")) return parts[i + 1];
    }
  } catch {
    /* not a URL — fall through */
  }
  const m = s.match(/[a-zA-Z0-9_-]{11}/);
  return m ? m[0] : null;
}

// Stable reference to a bundled default image (survives deploys, unlike the
// build-hashed asset URL). Stored in site_images.url when a default is kept in
// place after a group has been edited.
export const DEFAULT_TOKEN_PREFIX = "default:";
export const defaultToken = (groupKey: string, index: number) =>
  `${DEFAULT_TOKEN_PREFIX}${groupKey}#${index}`;

// Resolve a stored url (real Storage URL or a default-token) to a display item.
export function resolveDefaultToken(url: string): SiteImageItem | null {
  if (!url.startsWith(DEFAULT_TOKEN_PREFIX)) return null;
  const [groupKey, idxStr] = url.slice(DEFAULT_TOKEN_PREFIX.length).split("#");
  const group = SITE_IMAGE_GROUP_BY_KEY[groupKey];
  const idx = Number(idxStr);
  return group?.defaults[idx] ?? null;
}
