// Shared types and helpers for Scripture Coach + Spiritual Coach Intelligence.
// Plan: docs/SCRIPTURE_COACH_PLAN.md
import jsPDF from "jspdf";

export const NLA_RED = "#bf0f3e";

// Crossway requires this notice wherever ESV text is displayed or printed.
export const ESV_COPYRIGHT =
  "Scripture quotations are from the ESV® Bible (The Holy Bible, English Standard Version®), " +
  "copyright © 2001 by Crossway, a publishing ministry of Good News Publishers. Used by permission. " +
  "All rights reserved.";

/**
 * A passage inside a session. Two independent flags, and they mean
 * different things:
 *   kept — is this part of the mentor's working set for this conversation?
 *   used — did the mentor actually walk the youth through it? Only these
 *          reach the printed report.
 */
export interface SessionPassage {
  ref: string;
  esv_text: string;
  context: string;
  kept: boolean;
  used: boolean;
}

export interface ScriptureSession {
  id: string;
  registration_id: string | null;
  youth_name: string;
  coach_id: string | null;
  coach_name: string | null;
  topic: string;
  topic_id: string | null;
  session_date: string;
  passages: SessionPassage[];
  talking_points: string[];
  /** One per talking point, same order — what the mentor could say next. */
  responses: string[];
  prayer_points: string[];
  notes: string | null;
  /** Reviewer's field only — the mentor who ran the session cannot write here. */
  review_comments: string | null;
  review_status: ReviewStatus;
  reviewed_by: string | null;
  reviewed_by_name: string | null;
  reviewed_at: string | null;
  /** null = not answered yet. Distinct from an explicit "No". */
  parents_notified: boolean | null;
  follow_up_needed: boolean | null;
  /** Was Nikki (onsite counselor, Cape Assist) notified? null = not answered. */
  nikki_notified: boolean | null;
  created_at: string;
  updated_at: string;
}

/** Named in full on the printed record so the referral is unambiguous. */
export const COUNSELOR_LINE =
  "Nikki, our professional onsite counselor from the mental health agency " +
  "Cape Assist, was notified.";

export type ReviewStatus = "pending_review" | "changes_requested" | "reviewed";

export const REVIEW_LABELS: Record<ReviewStatus, string> = {
  pending_review: "Pending review",
  changes_requested: "Changes requested",
  reviewed: "Reviewed",
};

/** A signed-off session is locked — only a reviewer can reopen it. */
export const isLocked = (s: Pick<ScriptureSession, "review_status">) =>
  s.review_status === "reviewed";


/** Common openers, so a mentor can start with one tap instead of typing. */
export const QUICK_TOPICS = [
  "Someone said something unkind to me",
  "I'm being bullied",
  "I can't control my anger",
  "My parents are fighting",
  "A parent left / isn't around",
  "I feel anxious all the time",
  "I have a girlfriend / boyfriend",
  "Questions about sex and purity",
  "I don't like who I am",
  "Someone close to me died",
  "I keep lying and getting caught",
  "I don't think God hears me",
];

/**
 * Capitalise the first letter. The prompt asks for this, but a model will
 * occasionally return a lowercase opener and it looks sloppy on screen, so
 * it's enforced at render too.
 */
export const sentenceCase = (s: string): string =>
  s ? s.charAt(0).toUpperCase() + s.slice(1) : s;

export const calculateAge = (dob: string | null | undefined): number | null => {
  if (!dob) return null;
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age -= 1;
  return age;
};

/** Junior/senior only separates the topic cache — it is never asked for. */
export const ageBandFor = (age: number | null): "junior" | "senior" =>
  age !== null && age <= 10 ? "junior" : "senior";

/**
 * youth_registrations.child_headshot_url holds either a full http URL
 * (legacy) or a bare filename in the public youth-photos bucket.
 */
export const resolveHeadshot = (url: string | null | undefined): string | null => {
  if (!url) return null;
  if (url.startsWith("http")) return url;
  return `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/youth-photos/${url}`;
};

export const normalizeTopic = (topic: string) =>
  topic.trim().toLowerCase().replace(/\s+/g, " ");

const yesNo = (v: boolean | null) => (v === null ? "Not answered" : v ? "Yes" : "No");

const hexToRgb = (hex: string): [number, number, number] => {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
};

const fmtDate = (iso: string) => {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString(undefined, {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });
};

/**
 * Build the session report. Printed on white with an NLA red masthead —
 * a dark screen theme makes for a wasteful, hard-to-read printout.
 * Only passages marked `used` appear.
 */
export const buildSessionPdf = (session: ScriptureSession): jsPDF => {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const [r, g, b] = hexToRgb(NLA_RED);
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 54;
  const contentW = pageW - margin * 2;
  let y = 0;

  // Start a new page when the next block would run off the bottom.
  const room = (needed: number) => {
    if (y + needed > pageH - 72) {
      doc.addPage();
      y = margin;
    }
  };

  const para = (
    text: string,
    size: number,
    style: "normal" | "bold" | "italic",
    color: [number, number, number],
    font: "helvetica" | "times" = "helvetica",
    leading = 1.35
  ) => {
    doc.setFont(font, style);
    doc.setFontSize(size);
    doc.setTextColor(...color);
    const lines = doc.splitTextToSize(text, contentW);
    for (const line of lines) {
      room(size * leading);
      doc.text(line, margin, y);
      y += size * leading;
    }
  };

  // ── Masthead ──
  doc.setFillColor(r, g, b);
  doc.rect(0, 0, pageW, 86, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(255, 255, 255);
  doc.text("No Limits Boxing Academy", margin, 40);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text("Scripture Coach — Session Report", margin, 62);
  y = 122;

  // ── Who / when ──
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.setTextColor(20, 20, 20);
  doc.text(session.youth_name, margin, y);
  y += 22;

  para(fmtDate(session.session_date), 10, "normal", [110, 110, 110]);
  if (session.coach_name) para(`Mentor: ${session.coach_name}`, 10, "normal", [110, 110, 110]);
  y += 10;

  // ── Topic ──
  doc.setDrawColor(r, g, b);
  doc.setLineWidth(2);
  room(30);
  doc.line(margin, y - 10, margin + 40, y - 10);
  y += 8;
  para("WHAT THEY BROUGHT UP", 9, "bold", [r, g, b]);
  y += 2;
  para(session.topic, 12, "normal", [30, 30, 30]);
  y += 16;

  // ── Scripture actually used ──
  const used = (session.passages || []).filter((p) => p.used);
  if (used.length) {
    para("SCRIPTURE WE WALKED THROUGH", 9, "bold", [r, g, b]);
    y += 6;
    for (const p of used) {
      room(60);
      para(p.ref, 12, "bold", [20, 20, 20]);
      y += 2;
      // Serif so it reads like scripture rather than UI copy — upright, not
      // italic, which is hard going over several lines on paper too.
      para(p.esv_text.replace(/\s+/g, " ").trim(), 11.5, "normal", [35, 35, 35], "times", 1.5);
      y += 4;
      if (p.context) para(p.context, 10, "normal", [105, 105, 105]);
      y += 14;
    }
  }

  // ── Prayer ──
  if (session.prayer_points?.length) {
    room(40);
    para("WE PRAYED FOR", 9, "bold", [r, g, b]);
    y += 6;
    for (const pt of session.prayer_points) para(`•  ${sentenceCase(pt)}`, 10, "normal", [45, 45, 45]);
    y += 14;
  }

  // ── Notes ──
  if (session.notes?.trim()) {
    room(50);
    para("MENTOR NOTES", 9, "bold", [r, g, b]);
    y += 6;
    para(session.notes.trim(), 11, "normal", [30, 30, 30]);
    y += 14;
  }

  // ── Supervision ──
  // The review block is on the printed record on purpose: a session report
  // that doesn't show who signed it off isn't evidence of supervision.
  room(60);
  para("REVIEW", 9, "bold", [r, g, b]);
  y += 6;
  para(
    session.review_status === "reviewed"
      ? `Reviewed by ${session.reviewed_by_name || "a reviewer"}` +
          (session.reviewed_at
            ? ` on ${new Date(session.reviewed_at).toLocaleDateString(undefined, {
                year: "numeric", month: "long", day: "numeric",
              })}`
            : "")
      : REVIEW_LABELS[session.review_status],
    10,
    "normal",
    [45, 45, 45]
  );
  if (session.review_comments?.trim()) {
    y += 4;
    para(session.review_comments.trim(), 10, "normal", [70, 70, 70]);
  }
  y += 14;

  // ── Status ──
  room(46);
  para("STATUS", 9, "bold", [r, g, b]);
  y += 6;
  para(
    [
      `Parent / guardian notified: ${yesNo(session.parents_notified)}`,
      `Further discussion needed: ${yesNo(session.follow_up_needed)}`,
      `Onsite counselor notified: ${yesNo(session.nikki_notified)}`,
    ].join("\n"),
    10,
    "normal",
    [45, 45, 45]
  );

  // A referral to a professional is the most consequential thing in this
  // record, so it is stated in full rather than left as a Yes on a checklist.
  if (session.nikki_notified === true) {
    y += 10;
    room(30);
    para(COUNSELOR_LINE, 10.5, "bold", [r, g, b]);
  }

  // ── Footer on every page: confidentiality + required ESV notice ──
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(140, 140, 140);
    const notice = doc.splitTextToSize(
      `Confidential — No Limits Boxing Academy youth record. ${ESV_COPYRIGHT}`,
      contentW
    );
    let fy = pageH - 46;
    for (const line of notice) {
      doc.text(line, margin, fy);
      fy += 9;
    }
    doc.text(`${i} / ${pages}`, pageW - margin, pageH - 24, { align: "right" });
  }

  return doc;
};

export const sessionPdfFilename = (session: ScriptureSession) =>
  `scripture-coach-${session.youth_name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${session.session_date}.pdf`;
