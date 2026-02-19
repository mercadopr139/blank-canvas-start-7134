import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plus } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const columns = [
  "Batch Name",
  "Bank Account",
  "Status",
  "Deposit Date",
  "Total Amount",
  "Donations",
  "Created By",
];

const AdminDeposits = () => {
  const navigate = useNavigate();
  const goBack = () => navigate("/admin/dashboard");

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="bg-black border-b border-white/10">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={goBack}
            className="text-white hover:bg-white/10 hover:text-white"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-white">Deposit Batches</h1>
            <p className="text-sm text-white/50">
              Group donations into bank deposits and mark them as deposited.
            </p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="flex justify-end mb-6">
          <Button className="bg-white text-black hover:bg-white/90">
            <Plus className="w-4 h-4 mr-2" />
            New Batch
          </Button>
        </div>

        <div className="rounded-lg border border-white/10 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-white/10 hover:bg-transparent">
                {columns.map((col) => (
                  <TableHead key={col} className="text-white/70">
                    {col}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow className="border-white/10 hover:bg-transparent">
                <TableCell
                  colSpan={columns.length}
                  className="text-center py-12 text-white/50"
                >
                  No deposit batches yet. Click 'New Batch' to start a deposit.
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </main>
    </div>
  );
};

export default AdminDeposits;
