import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, HandCoins } from "lucide-react";

const AdminSalesMarketing = () => {
  const navigate = useNavigate();
  const goBack = () =>
    window.history.state?.idx > 0 ? navigate(-1) : navigate("/admin/dashboard");

  const folders = [
    {
      title: "Revenue",
      description: "Track all incoming revenue",
      icon: HandCoins,
      href: "/admin/finance/donations",
    },
  ];

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
            <h1 className="text-xl font-bold text-white">Sales & Marketing</h1>
            <p className="text-sm text-white/50">Outreach & Retention</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {folders.map((folder) => (
            <Card
              key={folder.title}
              className="cursor-pointer hover:shadow-md transition-shadow bg-white/5 border-2 border-green-500/50 hover:border-green-500"
              onClick={() => navigate(folder.href)}
            >
              <CardHeader>
                <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-green-500/10 text-green-500 mb-2">
                  <folder.icon className="w-6 h-6" />
                </div>
                <CardTitle className="text-lg text-white">{folder.title}</CardTitle>
                <CardDescription className="text-white/50">{folder.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-green-500">Open →</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
};

export default AdminSalesMarketing;
