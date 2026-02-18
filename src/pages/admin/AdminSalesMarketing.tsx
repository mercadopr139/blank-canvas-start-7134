import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, TrendingUp } from "lucide-react";

const AdminSalesMarketing = () => {
  const navigate = useNavigate();
  const goBack = () => window.history.state?.idx > 0 ? navigate(-1) : navigate("/admin");

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="bg-black border-b border-white/10">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={goBack} className="text-white hover:bg-white/10 hover:text-white">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-white">Sales & Marketing</h1>
            <p className="text-sm text-white/50">Manage outreach and campaigns</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="flex flex-col items-center justify-center py-16">
          <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mb-4">
            <TrendingUp className="w-8 h-8 text-green-500" />
          </div>
          <h2 className="text-lg font-semibold text-white mb-2">Coming Soon</h2>
          <p className="text-sm text-white/50 text-center max-w-md">
            Sales and marketing tools will be available here soon.
          </p>
        </div>
      </main>
    </div>
  );
};

export default AdminSalesMarketing;
