// The access rule, checked against the three kinds of people Josh described:
// the Super Admin, an Admin, and a Staff person with one box checked.
import { describe, it, expect } from "vitest";
import { canOpen, canOpenPillar, type Who } from "@/lib/access";
import { allCardLines, COMMAND_CENTER_LINES } from "@/config/accessCard";
import { ownerOfPath, keyForMenuHref } from "@/config/appRegistry";
import { OPERATIONS_TILES } from "@/config/pillarTiles";

const superAdmin: Who = { isSuperAdmin: true, permissions: {} };
const admin: Who = { isSuperAdmin: false, permissions: { access_admin: true, task_manager_ALEX: true } };
// Jaime: invited, every box off, then one checked.
const jaime: Who = { isSuperAdmin: false, permissions: { app_juniors_aftercare: true } };
const nobody: Who = { isSuperAdmin: false, permissions: {} };

/** What the door says for an address. */
const doorOpens = (path: string, who: Who) => {
  const o = ownerOfPath(path);
  if (o.kind === "app") return canOpen(o.app.key, who);
  if (o.kind === "task-manager") return canOpen(o.permKey, who);
  return true;
};

describe("who can open what", () => {
  it("a Super Admin opens every line and every Task Manager", () => {
    allCardLines().forEach((l) => expect(canOpen(l.key, superAdmin)).toBe(true));
    expect(canOpen("task_manager_PD", superAdmin)).toBe(true);
  });

  it("an Admin opens every app, but only the Task Managers checked for her", () => {
    allCardLines()
      .filter((l) => l.key !== "operations_scripture_coach_reviewer")
      .forEach((l) => expect(canOpen(l.key, admin), l.label).toBe(true));
    COMMAND_CENTER_LINES.forEach((l) => expect(canOpen(l.key, admin)).toBe(true));
    expect(canOpen("task_manager_ALEX", admin)).toBe(true);
    expect(canOpen("task_manager_PD", admin)).toBe(false);
    expect(doorOpens("/admin/task-manager/PD", admin)).toBe(false);
    expect(doorOpens("/admin/signals/Budget", admin)).toBe(false); // old PD address
    expect(canOpen("operations_scripture_coach_reviewer", admin)).toBe(false);
  });

  it("Jaime opens Juniors Aftercare and nothing else", () => {
    expect(doorOpens("/admin/operations/smile-lab-attendance", jaime)).toBe(true);
    const open = allCardLines().filter((l) => canOpen(l.key, jaime)).map((l) => l.key);
    expect(open).toEqual(["app_juniors_aftercare"]);
    // Typed addresses bounce.
    ["/admin/operations/attendance", "/admin/operations/registrations", "/admin/finance/billing",
     "/admin/finance/deposits/abc", "/admin/sales-marketing/supporters-database", "/admin/corner-coach",
     "/admin/website-photos", "/admin/task-manager/PD", "/transport/admin/drivers"].forEach((p) =>
      expect(doorOpens(p, jaime), p).toBe(false));
    // Her pillars: Operations shows (one line inside); the other two do not.
    expect(canOpenPillar("operations", jaime)).toBe(true);
    expect(canOpenPillar("sales_marketing", jaime)).toBe(false);
    expect(canOpenPillar("finance", jaime)).toBe(false);
  });

  it("only one Youth Programs line is white in Jaime's sidebar", () => {
    const youth = OPERATIONS_TILES.find((t) => t.title === "Youth Programs")!;
    const open = youth.children!.filter((c) => canOpen(keyForMenuHref(c.href)!, jaime)).map((c) => c.title);
    expect(open).toEqual(["Juniors Aftercare Intelligence"]);
    expect(youth.children!.length).toBe(8);
  });

  it("a person with nothing checked opens nothing", () => {
    expect(allCardLines().filter((l) => canOpen(l.key, nobody))).toEqual([]);
    COMMAND_CENTER_LINES.forEach((l) => expect(canOpen(l.key, nobody), l.label).toBe(false));
  });

  it("a Staff person cannot hold an app the database has not opened to Staff", () => {
    // Even with the box checked, Billing stays locked until it is made ready.
    const eager: Who = { isSuperAdmin: false, permissions: { app_billing: true, app_message_board: true, task_manager_PC: true } };
    expect(canOpen("app_billing", eager)).toBe(false);
    expect(canOpen("app_message_board", eager)).toBe(false);
    expect(canOpen("task_manager_PC", eager)).toBe(false);
    expect(canOpenPillar("finance", eager)).toBe(false);
  });

  it("turning Admin off makes the person Staff: only Staff-ready boxes remain", () => {
    const off: Who = { isSuperAdmin: false, permissions: { access_admin: false, app_billing: true, app_juniors_aftercare: true } };
    expect(canOpen("app_juniors_aftercare", off)).toBe(true);
    expect(canOpen("app_billing", off)).toBe(false);
    expect(canOpen("app_document_vault", off)).toBe(false);
  });
});
