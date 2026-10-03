// The safety check behind "Staff Management always reads my builds".
//
// It reads the real route table (src/App.tsx) and the real menus
// (src/config/pillarTiles.ts) and fails if any admin page is missing from the
// master app list, or if the list names a page that no longer exists. A new
// app cannot ship without a checkbox in Staff Management.
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import {
  APPS, APP_GROUPS, NOT_APPS, TASK_MANAGER_ROUTES, SHARED_PASSWORD_TOOLS, MENU_LINKS,
  ownerOfPath, taskManagerForPath, keyForMenuHref,
} from "@/config/appRegistry";
import { ACCESS_CARD, allCardLines } from "@/config/accessCard";
import { OPERATIONS_TILES, SALES_MARKETING_TILES, FINANCE_TILES } from "@/config/pillarTiles";

/** Every route in App.tsx as a full address, nested ones joined to their parent. */
const allRoutes = (): string[] => {
  const src = readFileSync(resolve(__dirname, "../App.tsx"), "utf8");
  const out: string[] = [];
  let parent = "";
  for (const m of src.matchAll(/\bpath="([^"]+)"/g)) {
    const p = m[1];
    if (p === "*") continue;
    if (p.startsWith("/")) { parent = p; out.push(p); }
    else out.push(`${parent}/${p}`);
  }
  return out;
};

const isAdminSide = (p: string) => p.startsWith("/admin") || p.startsWith("/transport/admin");

describe("the master app list", () => {
  const routes = allRoutes();
  const adminRoutes = routes.filter(isAdminSide);

  it("finds the route table", () => {
    expect(adminRoutes.length).toBeGreaterThan(80);
    expect(adminRoutes).toContain("/admin/operations/smile-lab-attendance");
    expect(adminRoutes).toContain("/admin/finance/deposits/:id");
  });

  it("owns every admin page: nothing can be opened that Staff Management does not list", () => {
    const unowned = adminRoutes.filter((r) => ownerOfPath(r).kind === "unknown");
    expect(unowned, `Add these to src/config/appRegistry.ts:\n${unowned.join("\n")}`).toEqual([]);
  });

  it("names no page that does not exist", () => {
    const listed = [...APPS.flatMap((a) => a.routes), ...TASK_MANAGER_ROUTES, ...NOT_APPS];
    const dead = listed.filter((r) => !routes.includes(r));
    expect(dead, `These are in the app list but not in App.tsx:\n${dead.join("\n")}`).toEqual([]);
  });

  it("gives every app one key and every page one app", () => {
    const keys = APPS.map((a) => a.key);
    expect(new Set(keys).size).toBe(keys.length);
    const pages = APPS.flatMap((a) => a.routes);
    expect(new Set(pages).size).toBe(pages.length);
    APPS.forEach((a) => {
      expect(a.key).toMatch(/^(app_[a-z0-9_]+|manage_website_photos)$/);
      expect(a.routes.length).toBeGreaterThan(0);
      expect(APP_GROUPS).toContain(a.group);
    });
  });

  it("covers every line in the sidebars", () => {
    const menuLinks = [...OPERATIONS_TILES, ...SALES_MARKETING_TILES, ...FINANCE_TILES].flatMap((t) =>
      t.children?.length ? t.children.map((c) => c.href) : [t.href],
    ).filter(isAdminSide);
    const lost = menuLinks.filter((href) => ownerOfPath(href).kind !== "app");
    expect(lost, `Sidebar lines with no app behind them:\n${lost.join("\n")}`).toEqual([]);
  });

  it("gives every sidebar line a checkbox, and every checkbox one line", () => {
    const tiles = [...OPERATIONS_TILES, ...SALES_MARKETING_TILES, ...FINANCE_TILES];
    const hrefs = tiles.flatMap((t) => (t.children?.length ? t.children.map((c) => c.href) : [t.href]));
    const unkeyed = hrefs.filter((h) => !keyForMenuHref(h));
    expect(unkeyed, `Sidebar lines with no checkbox:\n${unkeyed.join("\n")}`).toEqual([]);

    const cardKeys = allCardLines().map((l) => l.key);
    expect(new Set(cardKeys).size, "a key appears twice on the card").toBe(cardKeys.length);
    const missing = hrefs.map((h) => keyForMenuHref(h)!).filter((k) => !cardKeys.includes(k));
    expect(missing, `Sidebar lines missing from the Staff Management card:\n${missing.join("\n")}`).toEqual([]);
    expect(ACCESS_CARD.map((p) => p.title)).toEqual(["Operations", "Sales & Marketing", "Finance"]);
    MENU_LINKS.forEach((l) => expect(routes).toContain(l.href));
  });

  it("lists shared-password tools that really exist", () => {
    const dead = SHARED_PASSWORD_TOOLS.filter((t) => !routes.includes(t.route)).map((t) => t.route);
    expect(dead).toEqual([]);
  });

  it("reads the workbench out of a Task Manager address", () => {
    expect(taskManagerForPath("/admin/task-manager/HC/signals/Budget")).toBe("HC");
    expect(taskManagerForPath("/admin/pc-signals/Budget/archive")).toBe("PC");
    expect(taskManagerForPath("/admin/signals/Budget")).toBe("PD");
    expect(taskManagerForPath("/admin/operations/attendance")).toBeNull();
    const owner = ownerOfPath("/admin/task-manager/PD");
    expect(owner.kind === "task-manager" && owner.permKey).toBe("task_manager_PD");
  });

  it("resolves real addresses, with ids and query strings", () => {
    const a = ownerOfPath("/admin/operations/smile-lab-attendance?tab=journal");
    expect(a.kind === "app" && a.app.key).toBe("app_juniors_aftercare");
    const b = ownerOfPath("/admin/finance/deposits/3f2a");
    expect(b.kind === "app" && b.app.key).toBe("app_billing");
    expect(ownerOfPath("/admin/staff").kind).toBe("app");
    expect(ownerOfPath("/admin/dashboard").kind).toBe("not-app");
    expect(ownerOfPath("/admin/relay-race").kind).toBe("unknown");
  });
});
