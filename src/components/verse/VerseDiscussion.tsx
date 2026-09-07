// Verse discussion — the pop-up the mentor opens on the board during the team
// meeting. Progressive reveal so the room moves at the mentor's pace:
//   verse  →  [Context]  →  [Question]  →  [Read this out loud].
// The closing script stays hidden until the mentor taps it, so the kids wrestle
// with the question before an answer is on the wall.
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { X, BookOpen, MessageCircle, Megaphone, ChevronDown, User, Eye, EyeOff } from "lucide-react";

export interface DiscussionFigure {
  name: string;
  who: string;
}

export interface DiscussionDay {
  reference: string;
  text: string;
  context: string | null;
  figures: DiscussionFigure[];
  questions: string[];
  answers: string[];
}

const TEAL = "#2dd4bf";

const VerseDiscussion = ({ day, onClose }: { day: DiscussionDay | null; onClose: () => void }) => {
  const [showContext, setShowContext] = useState(false);
  const [showQuestions, setShowQuestions] = useState(false);
  const [openAnswer, setOpenAnswer] = useState<Record<number, boolean>>({});
  const [hiddenQ, setHiddenQ] = useState<Record<number, boolean>>({});

  useEffect(() => {
    // Fresh reveal each time it opens.
    setShowContext(false);
    setShowQuestions(false);
    setOpenAnswer({});
    setHiddenQ({});
  }, [day]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!day) return null;

  const questions = day.questions.filter((q) => q.trim());
  const figures = (day.figures ?? []).filter((f) => f?.name?.trim() && f?.who?.trim());

  // Where the verse gets repeated: between the two questions, so it's on screen
  // whichever one the room is working on. With a single question it goes last.
  const verseAgainAfter = questions.length > 1 ? 0 : questions.length - 1;

  const verseAgain = (
    <div className="rounded-2xl border p-5 md:p-6" style={{ borderColor: `${TEAL}33`, backgroundColor: `${TEAL}0d` }}>
      <p className="text-[11px] uppercase tracking-[0.2em] font-bold mb-2" style={{ color: TEAL, opacity: 0.7 }}>
        The verse
      </p>
      <p className="text-lg md:text-2xl leading-relaxed text-white/85 font-medium">
        &ldquo;{day.text}&rdquo;
      </p>
      <p className="mt-2 text-base font-semibold" style={{ color: TEAL }}>— {day.reference}</p>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-sm flex flex-col animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex items-center justify-between px-6 md:px-10 py-4 border-b border-white/10 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${TEAL}22` }}>
            <BookOpen className="w-5 h-5" style={{ color: TEAL }} />
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] font-bold text-white/40">Verse of the Day</p>
            <h2 className="text-xl md:text-2xl font-black tracking-tight" style={{ color: TEAL }}>{day.reference}</h2>
          </div>
        </div>
        <Button onClick={onClose} variant="ghost" className="text-white/60 hover:text-white hover:bg-white/10 rounded-xl h-11 px-4">
          <X className="w-5 h-5 mr-1.5" /> Done
        </Button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 md:px-16 py-8 max-w-5xl mx-auto w-full">
        {/* The verse */}
        <p className="text-2xl md:text-4xl leading-relaxed text-white font-medium">
          &ldquo;{day.text}&rdquo;
        </p>
        <p className="mt-3 text-lg font-semibold" style={{ color: TEAL }}>— {day.reference}</p>

        {/* Who these people are. A question about David only lands if the room
            knows who David was, and no 14-year-old is going to raise a hand to
            ask in front of eighty people. So it goes on the wall from the start. */}
        {figures.length > 0 && (
          <div className="mt-6 grid gap-2 md:grid-cols-2">
            {figures.map((f) => (
              <div key={f.name} className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ backgroundColor: `${TEAL}1a` }}>
                  <User className="w-4 h-4" style={{ color: TEAL }} />
                </div>
                <div className="min-w-0">
                  <p className="text-base md:text-lg font-bold leading-tight" style={{ color: TEAL }}>{f.name}</p>
                  <p className="text-sm md:text-lg leading-snug text-white/70">{f.who}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Context */}
        <div className="mt-8">
          {!showContext ? (
            <Button
              onClick={() => setShowContext(true)}
              className="h-12 px-6 rounded-xl text-base font-bold text-black"
              style={{ backgroundColor: TEAL }}
            >
              <BookOpen className="w-5 h-5 mr-2" /> Reveal Context
            </Button>
          ) : (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 md:p-6 animate-in fade-in slide-in-from-top-2 duration-300">
              <p className="text-[11px] uppercase tracking-[0.2em] font-bold text-white/40 mb-2">Context</p>
              <p className="text-lg md:text-2xl leading-relaxed text-white/80">{day.context}</p>
            </div>
          )}
        </div>

        {/* Questions */}
        {showContext && (
          <div className="mt-6">
            {!showQuestions ? (
              <Button
                onClick={() => setShowQuestions(true)}
                className="h-12 px-6 rounded-xl text-base font-bold text-black"
                style={{ backgroundColor: TEAL }}
              >
                <MessageCircle className="w-5 h-5 mr-2" /> Show Discussion Questions
              </Button>
            ) : (
              <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                <p className="text-[11px] uppercase tracking-[0.2em] font-bold text-white/40">Talk about it</p>
                {questions.map((q, i) => {
                  const answer = day.answers[i]?.trim();
                  const open = !!openAnswer[i];
                  const hidden = !!hiddenQ[i];

                  // Put away, a question keeps only its number, so the room has
                  // one prompt in front of it and the mentor can bring the other
                  // one back with a tap.
                  if (hidden) {
                    return (
                      <div key={i} className="space-y-4">
                        <button
                          onClick={() => setHiddenQ((p) => ({ ...p, [i]: false }))}
                          className="w-full flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.015] px-5 py-3 text-left text-white/30 hover:text-white/60 hover:border-white/15 transition-colors"
                        >
                          <span className="text-lg font-black" style={{ color: TEAL, opacity: 0.5 }}>{i + 1}</span>
                          <span className="text-sm font-semibold flex-1">Question {i + 1}</span>
                          <Eye className="w-4 h-4" />
                        </button>
                        {i === verseAgainAfter && verseAgain}
                      </div>
                    );
                  }

                  return (
                    <div key={i} className="space-y-4">
                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden">
                      <div className="p-5 md:p-6">
                        <div className="flex items-start gap-4">
                          <span className="text-2xl md:text-3xl font-black" style={{ color: TEAL }}>{i + 1}</span>
                          <p className="text-xl md:text-3xl leading-snug text-white font-medium flex-1">{q}</p>
                          <button
                            onClick={() => setHiddenQ((p) => ({ ...p, [i]: true }))}
                            className="shrink-0 text-white/20 hover:text-white/60 transition-colors p-1 -m-1"
                            title={`Put question ${i + 1} away`}
                          >
                            <EyeOff className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                      {/* The script the mentor reads to the room once the youth
                          have answered. Still behind a tap — the point is that
                          they wrestle with the question before an answer is on
                          the wall — but sized to be read aloud, not skimmed. */}
                      {answer && (
                        <div className="bg-neutral-900/80">
                          <button
                            onClick={() => setOpenAnswer((p) => ({ ...p, [i]: !p[i] }))}
                            className="w-full flex items-center justify-between px-5 md:px-6 py-2.5 border-t border-white/[0.06] text-white/40 hover:text-white/70 transition-colors"
                          >
                            <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider">
                              <Megaphone className="w-3.5 h-3.5" /> {open ? "Hide" : "Read this out loud"}
                            </span>
                            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
                          </button>
                          {open && (
                            <div className="px-5 md:px-6 pb-5 pt-1 animate-in fade-in duration-200">
                              <p className="text-lg md:text-2xl leading-relaxed text-white/80">{answer}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    {/* The verse, repeated mid-list. By question two the
                        original has scrolled off the top, and the answer is
                        supposed to come out of the text — so the text sits
                        between the questions, in reach of both. */}
                    {i === verseAgainAfter && verseAgain}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default VerseDiscussion;
