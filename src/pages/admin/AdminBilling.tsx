import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Mail } from "lucide-react";

const tiles = [
  {
    title: "Invoices",
    description: "Track billing and payments",
    icon: FileText,
    href: "/admin/finance/invoices",
  },
  {
    title: "Invoice Sent History",
    description: "View emailed invoices",
    icon: Mail,
    href: "/admin/finance/invoices?tab=sent",
  },
];

const AdminBilling = () => {
  const navigate = useNavigate();

  return (
    <div className="bg-black text-white">
      <div className="border-b border-white/10 px-4 py-3">
        <h2 className="text-base font-semibold text-white">Billing</h2>
        <p className="text-xs text-white/50">Invoices & payment tracking</p>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {tiles.map((tile) => (
            <Card
              key={tile.title}
              className="cursor-pointer hover:shadow-md transition-shadow bg-white/5 border-2 border-sky-300/50 hover:border-sky-300"
              onClick={() => navigate(tile.href)}
            >
              <CardHeader>
                <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-sky-300/10 text-sky-300 mb-2">
                  <tile.icon className="w-6 h-6" />
                </div>
                <CardTitle className="text-lg text-white">{tile.title}</CardTitle>
                <CardDescription className="text-white/50">{tile.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-sky-300">Manage →</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AdminBilling;
