// "Back to the lap": a pill that follows Josh and Chrissy when a checklist
// line sent them to another page mid-meeting. It shows anywhere but the
// Lap itself, as long as the flag set on leaving is still there; the Lap
// clears it on arrival. The browser's own Back works too — this is for
// when the visit went two or three pages deep.
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Flag, ArrowLeft } from "lucide-react";
import { clearLapReturn, hasLapReturn } from "@/lib/lap/links";

const LapReturnPill = () => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [show, setShow] = useState(false);
  useEffect(() => { setShow(hasLapReturn() && !pathname.startsWith("/admin/the-lap")); }, [pathname]);
  if (!show) return null;
  return (
    <button
      onClick={() => { clearLapReturn(); navigate("/admin/the-lap"); }}
      className="group fixed bottom-5 left-1/2 -translate-x-1/2 z-[60] inline-flex items-center gap-2 rounded-full border border-[#bf0f3e] bg-neutral-950/95 px-4 py-2 text-sm font-semibold text-white shadow-2xl backdrop-blur hover:bg-[#bf0f3e] transition-colors print:hidden"
      aria-label="Back to the lap"
    >
      <ArrowLeft className="w-4 h-4" />
      Back to the lap
      <Flag className="w-4 h-4 text-[#bf0f3e] group-hover:text-white" />
    </button>
  );
};

export default LapReturnPill;
