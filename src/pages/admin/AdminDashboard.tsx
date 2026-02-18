import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings, LogOut, Briefcase, TrendingUp, DollarSign, ArrowLeft } from "lucide-react";

const AdminDashboard = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    navigate("/admin/login", { replace: true });
  };

  const folders = [
    {
      title: "Operations",
      description: "Clients & Service Calendar",
      icon: Briefcase,
       color: "bg-sky-400/10 text-sky-400",
      href: "/admin/operations",
    },
    {
      title: "Sales & Marketing",
      description: "Outreach & Campaigns",
      icon: TrendingUp,
      color: "bg-pink-500/10 text-pink-500",
      href: "/admin/sales-marketing",
    },
    {
      title: "Finance",
      description: "Invoices & Payments",
      icon: DollarSign,
      color: "bg-amber-500/10 text-amber-500",
      href: "/admin/finance",
    },
  ];

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="bg-background border-b border-border">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")} aria-label="Back to site">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold text-foreground">Admin Dashboard</h1>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
            </div>
          </div>
          <Button variant="outline" onClick={handleLogout}>
            <LogOut className="w-4 h-4 mr-2" />
            Log out
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {folders.map((folder) => (
            <Card
              key={folder.title}
              className="cursor-pointer hover:shadow-lg transition-all hover:scale-[1.02] min-h-[200px]"
              onClick={() => navigate(folder.href)}
            >
              <CardHeader className="pb-4">
                <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${folder.color} mb-3`}>
                  <folder.icon className="w-7 h-7" />
                </div>
                <CardTitle className="text-xl">{folder.title}</CardTitle>
                <CardDescription className="text-base">{folder.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-primary font-medium">Open →</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Settings Card */}
        <div className="border-t border-border pt-6">
          <Card className="opacity-75 max-w-xs">
            <CardHeader>
              <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-purple-500/10 text-purple-500 mb-2">
                <Settings className="w-6 h-6" />
              </div>
              <CardTitle className="text-lg">Settings</CardTitle>
              <CardDescription>Configure admin preferences</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Coming soon</p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;
