import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Star, LogIn, UtensilsCrossed, MapPin } from "lucide-react";
import AdminSectionLayout, { SectionCard } from "@/components/admin/AdminSectionLayout";
import { Button } from "@/components/ui/button";
import { useStaffPermissions } from "@/hooks/useStaffPermissions";
import { OPERATIONS_TILES } from "@/config/pillarTiles";

// Blank index – main panel is empty until a sidebar item is selected
export const AdminOperationsIndex = () => null;

const AdminOperations = () => {
  const navigate = useNavigate();
  const { hasPermission, loading: permLoading } = useStaffPermissions();

  // Hide sidebar tiles whose permission key the user doesn't have. While
  // permissions are loading, render everything so there's no flash of
  // empty UI; once loaded, the actual gate kicks in.
  const sidebarCards = useMemo<SectionCard[]>(
    () =>
      OPERATIONS_TILES
        .filter((t) => permLoading || !t.permKey || hasPermission(t.permKey))
        .map((t) => ({
          title: t.title,
          description: t.description,
          href: t.href,
          icon: t.icon,
          external: t.external,
          children: t.children,
        })),
    [permLoading, hasPermission]
  );

  const checkInActions = (
    <div className="flex flex-col gap-2 w-full">
      <Button
        size="sm"
        className="w-full bg-[#bf0f3e] hover:bg-[#bf0f3e]/80 text-white text-sm font-medium"
        onClick={() => navigate("/check-in")}
      >
        <LogIn className="w-4 h-4 mr-1.5" />
        NLA Check-In
      </Button>
      <Button
        size="sm"
        className="w-full bg-sky-500 hover:bg-sky-400 text-white text-sm font-medium"
        onClick={() => navigate("/check-in/lil-champs-corner")}
      >
        <Star className="w-4 h-4 mr-1.5" />
        Lil Champs Check-In
      </Button>
      <Button
        size="sm"
        className="w-full bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium"
        onClick={() => navigate("/meal-check-in")}
      >
        <UtensilsCrossed className="w-4 h-4 mr-1.5" />
        Meal Check-In
      </Button>
      <Button
        size="sm"
        className="w-full bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium"
        onClick={() => navigate("/excursion-check-in")}
      >
        <MapPin className="w-4 h-4 mr-1.5" />
        Excursion Check-In
      </Button>
    </div>
  );

  return (
    <AdminSectionLayout
      section="operations"
      title="Operations"
      subtitle="Boxing & Youth Development"
      accent="red"
      accentHex="#bf0f3e"
      cards={sidebarCards}
      backHref="/admin/dashboard"
      storageKey="nla_ops_custom_cards"
      sidebarAction={checkInActions}
    />
  );
};

export default AdminOperations;
