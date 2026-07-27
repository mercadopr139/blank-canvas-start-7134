import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  SITE_IMAGE_GROUP_BY_KEY,
  resolveDefaultToken,
  type SiteImageItem,
} from "@/config/siteImages";
import type { Tables } from "@/integrations/supabase/types";

export type SiteImageRow = Tables<"site_images">;

async function fetchSiteImages(): Promise<SiteImageRow[]> {
  const { data, error } = await supabase
    .from("site_images")
    .select("id, group_key, sort_order, url, alt, caption, object_position")
    .order("group_key", { ascending: true })
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []) as SiteImageRow[];
}

// Turn a stored row (real Storage URL, or a default-token pointing at a bundled
// image) into a display item.
export function rowToItem(row: SiteImageRow): SiteImageItem {
  const def = resolveDefaultToken(row.url);
  if (def) {
    return {
      src: def.src,
      alt: row.alt ?? def.alt,
      caption: row.caption ?? def.caption,
      objectPosition: def.objectPosition,
    };
  }
  return {
    src: row.url,
    alt: row.alt ?? "",
    caption: row.caption ?? undefined,
    objectPosition: row.object_position ?? undefined,
  };
}

export function useSiteImages() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["site-images"],
    queryFn: fetchSiteImages,
    staleTime: 5 * 60 * 1000,
  });

  const byGroup = useMemo(() => {
    const map = new Map<string, SiteImageRow[]>();
    for (const row of data ?? []) {
      const list = map.get(row.group_key) ?? [];
      list.push(row);
      map.set(row.group_key, list);
    }
    return map;
  }, [data]);

  // Effective images for a group: the DB override if the group has been edited,
  // otherwise the images bundled in code (SITE_IMAGE_GROUPS defaults).
  const resolveGroup = useMemo(
    () =>
      (groupKey: string): SiteImageItem[] => {
        const rows = byGroup.get(groupKey);
        if (rows && rows.length) return rows.map(rowToItem);
        return SITE_IMAGE_GROUP_BY_KEY[groupKey]?.defaults ?? [];
      },
    [byGroup]
  );

  return { resolveGroup, byGroup, rows: data ?? [], isLoading, refetch };
}
