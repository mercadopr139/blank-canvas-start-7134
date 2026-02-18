import { useNavigate } from "react-router-dom";
import nlaLogoWhite from "@/assets/nla-logo-white.png";
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
    description: "Boxing & Youth Development",
    icon: Briefcase,
    color: "bg-[#bf0f3e]/10 text-[#bf0f3e]",
    borderColor: "border-[#bf0f3e]",
    linkColor: "text-[#bf0f3e]",
    href: "/admin/operations"
  },
  {
    title: "Sales & Marketing",
    description: "Outreach & Retention",
    icon: TrendingUp,
    color: "bg-green-500/10 text-green-500",
    borderColor: "border-green-500",
    linkColor: "text-green-500",
    href: "/admin/sales-marketing"
  },
  {
    title: "Finance",
    description: "Invoices & Payments",
    icon: DollarSign,
    color: "bg-sky-300/10 text-sky-300",
    borderColor: "border-sky-300",
    linkColor: "text-sky-300",
    href: "/admin/finance"
  }];


  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="bg-black border-b border-white/10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")} aria-label="Back to site">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold text-white">Command Center</h1>
              <p className="text-sm text-white/50">{user?.email}</p>
            </div>
          </div>
          <Button variant="outline" onClick={handleLogout} className="border-white/20 text-white bg-black hover:bg-black hover:text-white">
            <LogOut className="w-4 h-4 mr-2" />
            Log out
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-[30px]">
        {/* NLA Logo */}
        <div className="flex justify-center mb-16">
          <img src={nlaLogoWhite} alt="No Limits Academy" className="h-56 w-auto" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {folders.map((folder) =>
          <Card
            key={folder.title}
            className={`cursor-pointer hover:shadow-lg transition-all hover:scale-[1.02] min-h-[200px] bg-white/5 border-2 ${folder.borderColor} text-white`}
            onClick={() => navigate(folder.href)}>

              <CardHeader className="pb-4">
                <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${folder.color} mb-3`}>
                  <folder.icon className="w-7 h-7" />
                </div>
                <CardTitle className="text-xl text-white">{folder.title}</CardTitle>
                <CardDescription className="text-base text-white/50">{folder.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className={`text-sm font-medium ${folder.linkColor}`}>Open →</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Settings Card */}
        <div className="border-t border-white/10 pt-6">
          <Card className="opacity-75 max-w-xs bg-white/5 border-2 border-gray-500 text-white">
            <CardHeader>
              <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-purple-500/10 text-purple-500 mb-2">
                <Settings className="w-6 h-6" />
              </div>
              <CardTitle className="text-lg text-white">Settings</CardTitle>
              <CardDescription className="text-white/50">Configure admin preferences</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-white/30">Coming soon</p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>);

};

export default AdminDashboard;