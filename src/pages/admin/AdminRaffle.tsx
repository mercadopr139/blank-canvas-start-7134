// Raffle — campaigns, and the ledger inside one.
//
// Two views, not tabs: pick a campaign, work in it, come back. Everything a
// youth is given hangs off a campaign, so there is nothing useful to show
// until one is chosen.
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { BarChart3 } from "lucide-react";
import RaffleCampaigns from "@/components/raffle/RaffleCampaigns";
import RaffleLedger from "@/components/raffle/RaffleLedger";
import { RaffleCampaign } from "@/lib/raffle";

const AdminRaffle = () => {
  const navigate = useNavigate();
  const [open, setOpen] = useState<RaffleCampaign | null>(null);

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-6xl mx-auto text-white">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold">Raffle</h2>
          <p className="text-neutral-400 text-sm mt-1">
            Tickets out, money back. Youth contributing to the cost of their own program.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => navigate("/admin/sales-marketing/raffle-intelligence")}
          className="bg-transparent border-neutral-700 text-neutral-300 hover:text-white"
        >
          <BarChart3 className="w-4 h-4 mr-1.5" /> Intelligence Board
        </Button>
      </div>

      {open ? (
        <RaffleLedger campaign={open} onBack={() => setOpen(null)} />
      ) : (
        <RaffleCampaigns onOpen={setOpen} />
      )}
    </div>
  );
};

export default AdminRaffle;
