// What a person sees in place of a page they cannot open. The check itself
// is src/hooks/useDoor.ts.
import { useNavigate } from "react-router-dom";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";

export const LockedPanel = ({ label, fullScreen = false }: { label: string; fullScreen?: boolean }) => {
  const navigate = useNavigate();
  return (
    <div className={`${fullScreen ? "min-h-screen" : "flex-1 min-h-[60vh]"} flex items-center justify-center bg-black text-center px-6`}>
      <div>
        <div className="mx-auto mb-4 w-12 h-12 rounded-full border border-white/15 flex items-center justify-center">
          <Lock className="w-5 h-5 text-white/50" />
        </div>
        <h1 className="text-xl font-bold text-white mb-1">{label || "This page"} is locked</h1>
        <p className="text-sm text-white/50">You don't have access to this. Ask Josh if you need it.</p>
        <Button
          variant="outline"
          className="mt-6 border-white/15 text-white bg-transparent hover:bg-white/10"
          onClick={() => navigate("/admin/dashboard")}
        >
          Back to Command Center
        </Button>
      </div>
    </div>
  );
};
