import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Smile } from "lucide-react";
import SmileLabSessionEditor, { todayNY } from "@/components/smilelab/SmileLabSessionEditor";

// Smile Lab Board — the coaches' journaling screen, opened on the gym board with
// no login. Thin wrapper: branding header + the shared session editor.

const TEAL = "#2dd4bf";

const SmileLabBoard = () => {
  const navigate = useNavigate();
  const [date, setDate] = useState<string>(todayNY());
  const goBack = () => { if (window.history.length > 1) navigate(-1); else navigate("/"); };

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-4xl mx-auto px-4 py-6 sm:py-8">
        <button onClick={goBack} className="inline-flex items-center gap-1.5 text-sm text-white/50 hover:text-white mb-4">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="h-11 w-11 rounded-xl grid place-items-center" style={{ background: TEAL }}>
            <Smile className="h-6 w-6 text-black" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Smile Lab Board</h1>
            <p className="text-sm">
              <span style={{ color: TEAL }}>Healthy Smiles</span>
              <span className="text-white/30"> · </span>
              <span className="text-yellow-400">Healthy Habits</span>
              <span className="text-white/30"> · </span>
              <span style={{ color: TEAL }}>Happy Kids</span>
            </p>
          </div>
        </div>

        <SmileLabSessionEditor date={date} onDateChange={setDate} showDateNav />
      </div>
    </div>
  );
};

export default SmileLabBoard;
