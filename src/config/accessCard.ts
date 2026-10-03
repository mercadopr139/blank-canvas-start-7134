// The Staff Management card, built from the sidebars themselves.
//
// Josh's rule (2026-10-03): "every single option on the side bar should
// appear here." So the card is not a list anyone maintains. It is read
// straight off the three sidebars (src/config/pillarTiles.ts): one checkbox
// per line a person can click, under the same headings, in the same order.
// Add a line to a sidebar and it is on every staff card, unchecked.
//
// Each line's key comes from the master app list (appRegistry.ts).

import { OPERATIONS_TILES, SALES_MARKETING_TILES, FINANCE_TILES, type PillarTile } from "./pillarTiles";
import { keyForMenuHref } from "./appRegistry";

export interface AccessLine {
  /** The permission key this checkbox writes. */
  key: string;
  label: string;
  /**
   * The old one-box-per-section key this line used to live under. Until a
   * line has been set on its own, it shows what the section box granted, so
   * nobody's access moves on the day the card changes.
   */
  legacyKey?: string;
}

export interface AccessSection {
  /** The sidebar heading ("Youth Programs"), or null for a line that stands alone. */
  title: string | null;
  lines: AccessLine[];
}

export interface AccessPillar {
  id: "operations" | "sales_marketing" | "finance";
  title: string;
  sections: AccessSection[];
}

/** Boxes that are a duty rather than a sidebar line; they sit under the section they belong to. */
const EXTRA_LINES: Record<string, AccessLine[]> = {
  "Scripture Coach": [
    { key: "operations_scripture_coach_reviewer", label: "Reviewer (can sign off sessions)" },
  ],
};

const sectionsFromTiles = (tiles: PillarTile[]): AccessSection[] =>
  tiles.map((tile) => {
    const lines: AccessLine[] = [];
    const seen = new Set<string>();
    const add = (label: string, href: string) => {
      const key = keyForMenuHref(href);
      if (!key || seen.has(key)) return;
      seen.add(key);
      lines.push({ key, label, legacyKey: tile.permKey });
    };

    if (tile.children?.length) {
      tile.children.forEach((c) => add(c.title, c.href));
      // A heading that is itself a page (Raffle) is a line too, listed first.
      const own = keyForMenuHref(tile.href);
      if (own && !seen.has(own)) {
        seen.add(own);
        lines.unshift({ key: own, label: tile.title, legacyKey: tile.permKey });
      }
      (EXTRA_LINES[tile.title] ?? []).forEach((l) => lines.push(l));
      return { title: tile.title, lines };
    }

    add(tile.title, tile.href);
    return { title: null, lines };
  });

export const ACCESS_CARD: AccessPillar[] = [
  { id: "operations", title: "Operations", sections: sectionsFromTiles(OPERATIONS_TILES) },
  { id: "sales_marketing", title: "Sales & Marketing", sections: sectionsFromTiles(SALES_MARKETING_TILES) },
  { id: "finance", title: "Finance", sections: sectionsFromTiles(FINANCE_TILES) },
];

/**
 * The Command Center tiles that are not Task Managers. Message Board and the
 * Weekly Agenda were open to every admin before they had boxes, so they read
 * as on until someone sets them.
 */
export const COMMAND_CENTER_LINES: (AccessLine & { defaultOn?: boolean })[] = [
  { key: "app_message_board", label: "Message Board", defaultOn: true },
  { key: "app_agenda", label: "Weekly Agenda", defaultOn: true },
  { key: "manage_website_photos", label: "Website Photos" },
  { key: "app_corner_coach", label: "Corner Coach" },
];

/** Every sidebar line on the card, flat. */
export const allCardLines = (): AccessLine[] =>
  ACCESS_CARD.flatMap((p) => p.sections.flatMap((s) => s.lines));
