// The bar that stays on screen while the access manager is previewing the
// back end as someone else, with the way out.
import { useNavigate } from "react-router-dom";
import { Eye } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { isAccessManagerEmail } from "@/lib/superAdmins";
import { useViewAs, setViewAs } from "@/lib/viewAs";

const ViewAsBanner = () => {
  const { user } = useAuth();
  const viewAs = useViewAs();
  const navigate = useNavigate();
  if (!viewAs || !isAccessManagerEmail(user?.email)) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 rounded-full border border-amber-400/50 bg-black/95 px-4 py-2 shadow-[0_0_24px_rgba(251,191,36,0.25)]">
      <Eye className="w-4 h-4 text-amber-300 flex-shrink-0" />
      <p className="text-sm text-white whitespace-nowrap">
        Viewing as <span className="font-bold text-amber-300">{viewAs.name}</span>
        <span className="hidden sm:inline text-white/45"> · menus and locks are theirs, the data is yours</span>
      </p>
      <button
        type="button"
        onClick={() => { setViewAs(null); navigate("/admin/staff"); }}
        className="rounded-full bg-amber-400 px-3 py-1 text-xs font-bold text-black hover:bg-amber-300"
      >
        Exit preview
      </button>
    </div>
  );
};

export default ViewAsBanner;
