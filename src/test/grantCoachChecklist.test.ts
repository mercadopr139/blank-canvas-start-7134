import { describe, it, expect } from "vitest";
import { OCEAN_2027, FOLDER_TEMPLATES, checklistProgress } from "@/lib/grantCoach/oceanChecklist";

describe("Grant Coach — the O.C.E.A.N. 2027 checklist (the acceptance test for step 2)", () => {
  const sections = [...new Set(OCEAN_2027.items.map((i) => i.section))];

  it("is the first template, due Oct 30 2026 at 5 PM Eastern, max $75,000, Jan–Dec 2027", () => {
    expect(FOLDER_TEMPLATES[0].key).toBe("ocean-2027");
    expect(OCEAN_2027.dueAt).toBe("2026-10-30T21:00:00.000Z");
    expect(OCEAN_2027.amountMax).toBe(75000);
    expect(OCEAN_2027.periodStart).toBe("2027-01-01");
    expect(OCEAN_2027.periodEnd).toBe("2027-12-31");
  });

  it("covers eligibility first, then every one of the form's twelve screens, in order", () => {
    expect(sections[0]).toBe("Eligibility");
    const screens = sections.slice(1).map((s) => Number(s.split(" · ")[0]));
    expect(screens).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it("has the seven narrative items in the funder's order plus the upload, and the six acknowledgments", () => {
    const narrative = OCEAN_2027.items.filter((i) => i.section.startsWith("8 ·"));
    expect(narrative.map((i) => i.label.slice(0, 2))).toEqual(["1.", "2.", "3.", "4.", "5.", "6.", "7.", "Up"]);
    expect(narrative[3].label).toMatch(/Staff roles/);
    const acks = OCEAN_2027.items.filter((i) => i.section.startsWith("11 ·"));
    expect(acks).toHaveLength(6);
    expect(acks.every((i) => i.kind === "acknowledgment")).toBe(true);
  });

  it("lists the attachments screen 10 asks for, required ones marked", () => {
    const uploads = OCEAN_2027.items.filter((i) => i.section.startsWith("10 ·"));
    expect(uploads.filter((i) => i.required).map((i) => i.label)).toEqual([
      expect.stringMatching(/budget workbook/),
      expect.stringMatching(/nonprofit/),
      expect.stringMatching(/Budget narrative/),
      expect.stringMatching(/operating budget/),
      expect.stringMatching(/Form 990/),
    ]);
    expect(uploads.filter((i) => !i.required)).toHaveLength(2);
  });

  it("progress counts required items not marked N/A", () => {
    expect(checklistProgress([
      { required: true, status: "done" },
      { required: true, status: "todo" },
      { required: true, status: "na" },
      { required: false, status: "done" },
    ])).toEqual({ done: 1, total: 2 });
  });
});
