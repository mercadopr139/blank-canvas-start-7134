// Verse discussion — the pop-up the mentor opens on the board during the team
// meeting. Progressive reveal so the room moves at the mentor's pace:
//   verse  →  [Context]  →  [Questions]  →  per-question [Guidance] (mentor only).
// The guidance (model answers) stays hidden until the mentor taps it, so the
// kids wrestle with the question before an answer is on the wall.
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { X, BookOpen, MessageCircle, Lock, ChevronDown } from "lucide-react";

export interface DiscussionDay {
  reference: string;
  text: string;
  context: string | null;
  questions: string[];
  answers: string[];
}

const TEAL = "#2dd4bf";

const VerseDiscussion = ({ day, onClose }: { day: DiscussionDay | null; onClose: () => void }) => {
  const [showContext, setShowContext] = useState(false);
  const [showQuestions, setShowQuestions] = useState(false);
  const [openAnswer, setOpenAnswer] = useState<Record<number, boolean>>({});

  useEffect(() => {
    // Fresh reveal each time it opens.
    setShowContext(false);
    setShowQuestions(false);
    setOpenAnswer({});
  }, [day]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!day) return null;

  const questions = day.questions.filter((q) => q.trim());

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
                  return (
                    <div key={i} className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden">
                      <div className="p-5 md:p-6">
                        <div className="flex items-start gap-4">
                          <span className="text-2xl md:text-3xl font-black" style={{ color: TEAL }}>{i + 1}</span>
                          <p className="text-xl md:text-3xl leading-snug text-white font-medium flex-1">{q}</p>
                        </div>
                      </div>
                      {answer && (
                        <>
                          <button
                            onClick={() => setOpenAnswer((p) => ({ ...p, [i]: !p[i] }))}
                            className="w-full flex items-center justify-between px-5 md:px-6 py-2.5 border-t border-white/10 text-white/45 hover:text-white/80 hover:bg-white/[0.03] transition-colors"
                          >
                            <span className="inline-flex items-center gap-2 text-sm font-semibold">
                              <Lock className="w-4 h-4" /> {open ? "Hide" : "Guidance"} <span className="text-white/25 font-normal">(mentor only)</span>
                            </span>
                            <ChevronDown className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`} />
                          </button>
                          {open && (
                            <div className="px-5 md:px-6 pb-5 pt-1 animate-in fade-in duration-200">
                              <p className="text-base md:text-xl leading-relaxed text-white/70">{answer}</p>
                            </div>
                          )}
                        </>
                      )}
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
