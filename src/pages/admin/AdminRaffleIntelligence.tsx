// Raffle Intelligence Board — the season roll-up and the funder report.
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Ticket } from "lucide-react";
import RaffleIntelligence from "@/components/raffle/RaffleIntelligence";

const AdminRaffleIntelligence = () => {
  const navigate = useNavigate();

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-6xl mx-auto text-white">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold">Raffle Intelligence Board</h2>
          <p className="text-neutral-400 text-sm mt-1">
            What the youth raised, who took part, and how much of it they sold through.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => navigate("/admin/sales-marketing/raffle")}
          className="bg-transparent border-neutral-700 text-neutral-300 hover:text-white"
        >
          <Ticket className="w-4 h-4 mr-1.5" /> Back to campaigns
        </Button>
      </div>

      <RaffleIntelligence />
    </div>
  );
};

export default AdminRaffleIntelligence;
