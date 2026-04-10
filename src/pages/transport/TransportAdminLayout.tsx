import { Outlet, NavLink, useLocation, Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Users, Baby, Radio, LogOut, AlertTriangle } from "lucide-react";
import { useIncidentCount } from "./TransportIncidents";
import nlaLogo from "@/assets/nla-logo-white.png";

const navItems = [
  { to: "/transport/admin/drivers", label: "Drivers", icon: Users },
  { to: "/transport/admin/youth", label: "Youth", icon: Baby },
  { to: "/transport/admin/runs", label: "Trips & Pay", icon: Radio },
  { to: "/transport/admin/incidents", label: "Incidents", icon: AlertTriangle },
];

export default function TransportAdminLayout() {
  const { user, isAdmin, loading, signOut } = useAuth();
  const location = useLocation();
  const newIncidentCount = useIncidentCount();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" />
      </div>
    );
  }

  if (!user || !isAdmin) {
    return <Navigate to="/transport/admin" replace />;
  }

  // Redirect bare /transport/admin/dashboard to drivers
  if (location.pathname === "/transport/admin/dashboard") {
    return <Navigate to="/transport/admin/drivers" replace />;
  }

  return (
    <div className="min-h-screen bg-black flex flex-col md:flex-row">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-56 border-r border-white/10 p-4 gap-2 shrink-0">
        <div className="flex items-center gap-2 mb-6 px-2">
          <img src={nlaLogo} alt="NLA" className="h-8 w-auto" />
          <div>
            <p className="text-white text-sm font-bold leading-tight">Transport</p>
            <p className="text-white/40 text-[10px] uppercase tracking-wider">Admin Panel</p>
          </div>
        </div>

        <nav className="flex flex-col gap-1 flex-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-[#DC2626]/20 text-[#DC2626]"
                    : "text-white/60 hover:text-white hover:bg-white/5"
                }`
              }
            >
              <item.icon className="w-4 h-4" />
              {item.label}
              {item.label === "Incidents" && newIncidentCount > 0 && (
                <span className="ml-auto bg-red-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {newIncidentCount}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        <button
          onClick={signOut}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-white/40 hover:text-white/70 hover:bg-white/5 transition-colors mt-auto"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-h-screen pb-20 md:pb-0">
        <Outlet />
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-black border-t border-white/10 flex z-50">
        {navItems.map((item) => {
          const isActive = location.pathname.startsWith(item.to);
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={`flex-1 flex flex-col items-center py-2.5 gap-0.5 text-[10px] font-medium transition-colors touch-manipulation relative ${
                isActive ? "text-[#DC2626]" : "text-white/40"
              }`}
            >
              <div className="relative">
                <item.icon className="w-5 h-5" />
                {item.label === "Incidents" && newIncidentCount > 0 && (
                  <span className="absolute -top-1.5 -right-2.5 bg-red-500 text-white text-[8px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                    {newIncidentCount}
                  </span>
                )}
              </div>
              {item.label}
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}
