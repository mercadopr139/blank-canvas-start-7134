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

  it("a person with nothing checked gets the team tools and no apps", () => {
    expect(allCardLines().filter((l) => canOpen(l.key, nobody))).toEqual([]);
    // Message Board and the Agenda were open to all before they had boxes.
    expect(canOpen("app_message_board", nobody)).toBe(true);
    expect(canOpen("app_agenda", nobody)).toBe(true);
    expect(canOpen("app_corner_coach", nobody)).toBe(false);
    expect(canOpen("manage_website_photos", nobody)).toBe(false);
  });

  it("an explicit box beats the old section box, both ways", () => {
    // The old one-box-per-section grant still carries its lines...
    const old: Who = { isSuperAdmin: false, permissions: { operations_attendance: true } };
    expect(canOpen("app_callouts", old)).toBe(true);
    expect(canOpen("app_registrations", old)).toBe(false);
    // ...until a line is set on its own.
    const trimmed: Who = { isSuperAdmin: false, permissions: { operations_attendance: true, app_callouts: false } };
    expect(canOpen("app_callouts", trimmed)).toBe(false);
    expect(canOpen("app_attendance_intelligence", trimmed)).toBe(true);
    // Unchecking Message Board takes it away.
    expect(canOpen("app_message_board", { isSuperAdmin: false, permissions: { app_message_board: false } })).toBe(false);
  });

  it("turning Admin off falls back to the hand-checked boxes", () => {
    const off: Who = { isSuperAdmin: false, permissions: { access_admin: false, app_billing: true } };
    expect(canOpen("app_billing", off)).toBe(true);
    expect(canOpen("app_document_vault", off)).toBe(false);
  });
});
