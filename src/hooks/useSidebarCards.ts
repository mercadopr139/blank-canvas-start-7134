// A pillar's sidebar, with each line marked open or locked for the person
// looking at it. Nothing is hidden: a locked line still shows, shaded, so
// people can see what exists (Josh, 2026-10-03). Opening is decided line by
// line from the Staff Management boxes.
import { useMemo } from "react";
import type { SectionCard } from "@/components/admin/AdminSectionLayout";
import type { PillarTile } from "@/config/pillarTiles";
import { keyForMenuHref } from "@/config/appRegistry";
import { useStaffPermissions } from "@/hooks/useStaffPermissions";

export const useSidebarCards = (tiles: PillarTile[], opts: { flat?: boolean } = {}): SectionCard[] => {
  const flat = opts.flat ?? false;
  const { hasPermission, loading } = useStaffPermissions();
  return useMemo(() => {
    // While the boxes load, show everything as open rather than flash a wall
    // of locks; the door check still guards each page.
    const isLocked = (href: string) => {
      if (loading) return false;
      const key = keyForMenuHref(href);
      return key ? !hasPermission(key) : false;
    };
    return tiles.map((t) => {
      // A flat sidebar lists each tile as one line that opens the tile itself.
      const children = flat ? undefined : t.children?.map((c) => ({ ...c, locked: isLocked(c.href) }));
      return {
        title: t.title,
        description: t.description,
        href: t.href,
        icon: t.icon,
        external: t.external,
        children,
        locked: children?.length ? children.every((c) => c.locked) : isLocked(t.href),
      };
    });
  }, [tiles, flat, hasPermission, loading]);
};
