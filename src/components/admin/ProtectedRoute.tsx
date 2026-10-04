import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { LockedPanel } from "@/components/admin/AppDoor";
import { useDoor } from "@/hooks/useDoor";

// Pages inside a pillar are checked by the pillar's own layout, which keeps
// the sidebar on screen and locks only the page area.
const PILLAR_PAGE = /^\/admin\/(operations|sales-marketing|finance)\/.+/;

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
}

const ProtectedRoute = ({ children, requireAdmin = false }: ProtectedRouteProps) => {
  const { user, loading, isAdmin } = useAuth();
  const { pathname } = useLocation();
  const door = useDoor();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/admin/login" replace />;
  }

  if (requireAdmin && !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-2">Access Denied</h1>
          <p className="text-muted-foreground">This login does not have access to the back end. Ask Josh if you need it.</p>
        </div>
      </div>
    );
  }

  // The door: may this person open the app this address belongs to?
  if (requireAdmin && !PILLAR_PAGE.test(pathname)) {
    if (door.loading) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      );
    }
    if (!door.allowed) return <LockedPanel label={door.label} fullScreen />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
