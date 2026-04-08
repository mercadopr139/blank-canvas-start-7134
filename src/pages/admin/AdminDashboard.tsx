import { useNavigate } from "react-router-dom";
import nlaLogoWhite from "@/assets/nla-logo-white.png";
import { useAuth } from "@/contexts/AuthContext";
import { useStaffPermissions } from "@/hooks/useStaffPermissions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings, LogOut, Briefcase, TrendingUp, DollarSign, ArrowLeft, Signal, Lock, Bus } from "lucide-react";
import UpcomingEventsWidget from "@/components/admin/UpcomingEventsWidget";
import InviteAdminModal from "@/components/admin/InviteAdminModal";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const AdminDashboard = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { hasPermission, loading: permLoading } = useStaffPermissions();

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
      href: "/admin/operations",
      permKey: "operations" as const,
    },
    {
      title: "Sales & Marketing",
      description: "Outreach & Retention",
      icon: TrendingUp,
      color: "bg-green-500/10 text-green-500",
      borderColor: "border-green-500",
      linkColor: "text-green-500",
      href: "/admin/sales-marketing",
      permKey: "sales_marketing" as const,
    },
    {
      title: "Finance",
      description: "Financial Systems & Personnel",
      icon: DollarSign,
      color: "bg-sky-300/10 text-sky-300",
      borderColor: "border-sky-300",
      linkColor: "text-sky-300",
      href: "/admin/finance",
      permKey: "finance" as const,
    },
  ];

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
          <div className="flex items-center gap-2">
            <InviteAdminModal />
            <Button variant="outline" onClick={handleLogout} className="border-white/20 text-white bg-black hover:bg-black hover:text-white">
              <LogOut className="w-4 h-4 mr-2" />
              Log out
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="w-full px-4 py-[30px] max-w-5xl mx-auto overflow-x-hidden">
        {/* Top: Logo centered */}
        <div className="flex justify-center mb-10 sm:mb-16">
          <img src={nlaLogoWhite} alt="No Limits Academy" className="h-32 sm:h-56 w-auto" />
        </div>

        {/* Main pillar tiles */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-8">
          {folders.map((folder) => {
            const allowed = permLoading || hasPermission(folder.permKey);
            return (
              <Tooltip key={folder.title}>
                <TooltipTrigger asChild>
                  <Card
                    className={`min-h-[160px] sm:min-h-[200px] bg-white/5 border-2 ${folder.borderColor} text-white transition-all ${
                      allowed ? "cursor-pointer hover:shadow-lg hover:scale-[1.02]" : "cursor-not-allowed opacity-50"
                    }`}
                    onClick={() => allowed && navigate(folder.href)}
                  >
                    <CardHeader className="pb-3 sm:pb-4">
                      <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center ${folder.color} mb-2 sm:mb-3 relative`}>
                        <folder.icon className="w-6 h-6 sm:w-7 sm:h-7" />
                        {!allowed && <Lock className="w-4 h-4 absolute -top-1 -right-1 text-white/60" />}
                      </div>
                      <CardTitle className="text-lg sm:text-xl text-white">{folder.title}</CardTitle>
                      <CardDescription className="text-sm sm:text-base text-white/50">{folder.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className={`text-sm font-medium ${allowed ? folder.linkColor : "text-white/30"}`}>
                        {allowed ? "Open →" : "🔒 Locked"}
                      </p>
                    </CardContent>
                  </Card>
                </TooltipTrigger>
                {!allowed && (
                  <TooltipContent className="bg-black border-white/20 text-white">
                    Admin access required
                  </TooltipContent>
                )}
              </Tooltip>
            );
          })}
        </div>

        {/* Bottom utility section */}
        <div className="flex flex-col items-center gap-4 sm:gap-6 mt-8 sm:mt-12">
          {/* Driver Check-In card */}
          {(() => {
            const driverAllowed = permLoading || hasPermission("driver_checkin");
            return (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Card
                    className={`w-full max-w-sm bg-white/5 border border-blue-500/40 text-white transition-all ${
                      driverAllowed ? "cursor-pointer hover:opacity-90" : "cursor-not-allowed opacity-50"
                    }`}
                    onClick={() => driverAllowed && navigate("/transport")}
                  >
                    <CardHeader className="p-4 pb-2">
                      <div className="w-10 h-10 rounded-md flex items-center justify-center bg-blue-500/10 text-blue-400 mb-1 relative">
                        <Bus className="w-5 h-5" />
                        {!driverAllowed && <Lock className="w-3 h-3 absolute -top-1 -right-1 text-white/60" />}
                      </div>
                      <CardTitle className="text-sm text-white">Driver Check-In</CardTitle>
                      <CardDescription className="text-xs text-white/40">Transportation PIN login</CardDescription>
                    </CardHeader>
                    <CardContent className="px-4 pb-3 pt-0">
                      <p className={`text-xs font-medium ${driverAllowed ? "text-blue-400" : "text-white/30"}`}>
                        {driverAllowed ? "Open →" : "🔒 Locked"}
                      </p>
                    </CardContent>
                  </Card>
                </TooltipTrigger>
                {!driverAllowed && (
                  <TooltipContent className="bg-black border-white/20 text-white">
                    Admin access required
                  </TooltipContent>
                )}
              </Tooltip>
            );
          })()}

          <div className="w-full max-w-sm">
            <UpcomingEventsWidget />
          </div>

          <div className="grid grid-cols-2 gap-3 sm:gap-4 w-full max-w-sm">
            {/* PD Signals */}
            {(() => {
              const signalsAllowed = permLoading || hasPermission("pd_signals");
              return (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Card
                      className={`bg-white/5 border border-white/20 text-white transition-opacity ${
                        signalsAllowed ? "opacity-60 cursor-pointer hover:opacity-80" : "opacity-30 cursor-not-allowed"
                      }`}
                      onClick={() => signalsAllowed && navigate("/admin/signals")}
                    >
                      <CardHeader className="p-3 sm:p-4 pb-2">
                        <div className="w-8 h-8 rounded-md flex items-center justify-center bg-white/5 text-white/40 mb-1 relative">
                          <Signal className="w-4 h-4" />
                          {!signalsAllowed && <Lock className="w-3 h-3 absolute -top-1 -right-1 text-white/60" />}
                        </div>
                        <CardTitle className="text-xs sm:text-sm text-white">PD – Signals</CardTitle>
                        <CardDescription className="text-[10px] sm:text-xs text-white/40">Executive Focus & Daily Signals</CardDescription>
                      </CardHeader>
                      <CardContent className="px-3 sm:px-4 pb-3 pt-0">
                        <p className={`text-xs font-medium ${signalsAllowed ? "text-white/40" : "text-white/20"}`}>
                          {signalsAllowed ? "Open →" : "🔒 Locked"}
                        </p>
                      </CardContent>
                    </Card>
                  </TooltipTrigger>
                  {!signalsAllowed && (
                    <TooltipContent className="bg-black border-white/20 text-white">
                      Admin access required
                    </TooltipContent>
                  )}
                </Tooltip>
              );
            })()}

            {/* Settings */}
            {(() => {
              const settingsAllowed = permLoading || hasPermission("settings");
              return (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Card
                      className={`bg-white/5 border border-white/20 text-white transition-opacity ${
                        settingsAllowed ? "opacity-60 cursor-pointer hover:opacity-80" : "opacity-30 cursor-not-allowed"
                      }`}
                      onClick={() => settingsAllowed && navigate("/admin/staff")}
                    >
                      <CardHeader className="p-3 sm:p-4 pb-2">
                        <div className="w-8 h-8 rounded-md flex items-center justify-center bg-white/5 text-white/40 mb-1 relative">
                          <Settings className="w-4 h-4" />
                          {!settingsAllowed && <Lock className="w-3 h-3 absolute -top-1 -right-1 text-white/60" />}
                        </div>
                        <CardTitle className="text-xs sm:text-sm text-white">Settings</CardTitle>
                        <CardDescription className="text-[10px] sm:text-xs text-white/40">
                          {settingsAllowed ? "Staff Management" : "Admin access required"}
                        </CardDescription>
                      </CardHeader>
                      {settingsAllowed && (
                        <CardContent className="px-3 sm:px-4 pb-3 pt-0">
                          <p className="text-xs font-medium text-white/40">Open →</p>
                        </CardContent>
                      )}
                    </Card>
                  </TooltipTrigger>
                  {!settingsAllowed && (
                    <TooltipContent className="bg-black border-white/20 text-white">
                      Admin access required
                    </TooltipContent>
                  )}
                </Tooltip>
              );
            })()}
          </div>
        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;
