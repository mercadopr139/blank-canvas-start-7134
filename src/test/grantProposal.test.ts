// A grant delivered as a written proposal (2026-11-12): the cost estimate is
// read as lines the page adds up, the attachment check catches the wrong
// file, and the rows become sections under the funder's headings.
import { describe, expect, it } from "vitest";
import { attachmentMismatch, costCheck, costProse, costTableText, defaultSetup, isCostItem, parseCostLines, proposalSections } from "@/lib/grantCoach/proposal";

const estimate = `NLA requests $20,000 from the Avalon Lions Charities Foundation's FY 2026–2027 Special Grants Program.

Equipment purchase — $8,000
- Youth Boxing Equipment & Safety Gear (gloves, wraps, headgear) — $3,500
- Strength & Conditioning Equipment — $2,500
- Mouthguards & Oral Protection — $1,200
- Eyewear & Vision Protection — $800

Program expense, meals — $8,000
- Meal Train, self-funded dinners on nights without a donor — $6,000
- Program Beverages and Snacks — $1,500
- Disposable Cutlery & Food Service Supplies — $500

Program expense, transportation — $4,000
- Fuel and tolls, standing routes to Woodbine and Wildwood — $4,000

Total request: $8,000 + $8,000 + $4,000 = $20,000.`;

describe("the cost estimate", () => {
  it("reads headings and priced lines, ignores the prose and the total line, and adds it up", () => {
    const t = parseCostLines(estimate);
    expect(t.groups.map((g) => g.heading)).toEqual(["Equipment purchase", "Program expense, meals", "Program expense, transportation"]);
    expect(t.groups[0].lines[0]).toEqual({ item: "Youth Boxing Equipment & Safety Gear (gloves, wraps, headgear)", amount: 3500 });
    expect(t.lineCount).toBe(8);
    expect(t.total).toBe(20000);
    expect(t.unpriced).toEqual([]);
  });

  it("checks the lines against the request", () => {
    expect(costCheck(estimate, 20000)).toBeNull();
    expect(costCheck(estimate, 25000)).toBe("The lines add up to $20,000; the request is $25,000.");
    expect(costCheck("Equipment purchase — $8,000\n- Youth Boxing Equipment & Safety Gear\n- Mouthguards", 8000)).toMatch(/^2 lines have no dollar figure/);
    expect(costCheck("We will buy gloves and food.", 8000)).toMatch(/^Not itemized yet/);
  });

  it("writes the table back as text with group subtotals and the total", () => {
    const text = costTableText(parseCostLines("Gear\n- Gloves — $1,000\n- Wraps — $250.50"));
    expect(text).toBe("Gear — $1,250.5\n- Gloves — $1,000\n- Wraps — $250.5\n\nTotal — $1,250.5".replace(/\$1,250\.5/g, "$1,250.50").replace("$250.5", "$250.50"));
  });

  it("splits the prose around the table into before and after", () => {
    const p = costProse(estimate);
    expect(p.before).toEqual(["NLA requests $20,000 from the Avalon Lions Charities Foundation's FY 2026–2027 Special Grants Program."]);
    expect(p.after).toEqual([]);
    expect(costProse("Intro sentence about the budget here.\n- Gloves — $100\nThe balance is met by other revenue.")).toEqual({ before: ["Intro sentence about the budget here."], after: ["The balance is met by other revenue."] });
  });

  it("knows which rows are the estimate", () => {
    expect(isCostItem("Detailed Cost Estimate")).toBe(true);
    expect(isCostItem("Project Budget")).toBe(true);
    expect(isCostItem("Description of Need and Expected Impact")).toBe(false);
  });
});

describe("the attachment check", () => {
  it("catches the determination letter attached where the 990 was asked for", () => {
    expect(attachmentMismatch("Financial Documentation — a copy of the organization's most recent Form 990 or 990-EZ", { title: "Confirmation Letter of Non-Profit Status", file_name: "Confirmation Letter of Non-Profit Status (6).pdf", read_text: "Department of the Treasury … exempt from federal income tax under IRC Section 501(c)(3)" }))
      .toBe("This asks for Form 990 or 990-EZ; the attached file looks like the IRS determination letter.");
    expect(attachmentMismatch("Most recent Form 990", { title: "2025 Form 990", file_name: "NLA_990_2025.pdf" })).toBeNull();
    expect(attachmentMismatch("Most recent Form 990", { title: "Annual report", file_name: "report.pdf", read_text: "Return of Organization Exempt From Income Tax" })).toBeNull();
    expect(attachmentMismatch("Most recent Form 990", { title: "Photo", file_name: "gym.pdf", read_text: "" })).toMatch(/does not look like one/);
  });
  it("says nothing for a row it has no rule for, or with nothing attached", () => {
    expect(attachmentMismatch("Letters of support", { title: "990", file_name: "990.pdf" })).toBeNull();
    expect(attachmentMismatch("Most recent Form 990", null)).toBeNull();
  });
});

describe("the proposal's sections", () => {
  it("turns the rows into sections under the funder's headings, uploads into enclosures, blanks into missing", () => {
    const { sections, enclosures, missing } = proposalSections([
      { label: "1. Description of Need and Expected Impact", detail: null, kind: "narrative", answer: "NLA is…", status: "done" },
      { label: "2. Detailed Cost Estimate", detail: null, kind: "narrative", answer: estimate, status: "done" },
      { label: "3. Contact Information", detail: null, kind: "field", answer: "Josh Mercado, Program Director · 609-602-0126", status: "done" },
      { label: "4. Financial Documentation", detail: null, kind: "upload", answer: "Attached: NLA_990_2025.pdf", status: "done", attachment: { title: "2025 Form 990", file_name: "NLA_990_2025.pdf" } },
      { label: "5. Letters of support", detail: null, kind: "upload", answer: null, status: "todo", attachment: null },
      { label: "6. Anything else", detail: null, kind: "narrative", answer: "", status: "todo" },
    ]);
    expect(sections.map((s) => [s.heading, s.kind])).toEqual([["Description of Need and Expected Impact", "prose"], ["Detailed Cost Estimate", "cost"], ["Contact Information", "contact"]]);
    expect(sections[1].cost?.total).toBe(20000);
    expect(enclosures).toEqual(["Financial Documentation: NLA_990_2025.pdf"]);
    expect(missing).toEqual(["Letters of support", "Anything else"]);
  });

  it("fills the setup's blanks from the folder and the Vault, keeping what was saved", () => {
    const s = defaultSetup({ to_name: "Jim Lutz", subject: "" }, { name: "Special Grant FY 2026–27", funder: "Avalon Lions Charities Foundation", amount_requested: 20000, program_name: null }, "Josh Mercado, President");
    expect(s.to_name).toBe("Jim Lutz");
    expect(s.to_org).toBe("Avalon Lions Charities Foundation");
    expect(s.subject).toBe("Special Grant FY 2026–27 — request for $20,000");
    expect(s.signer).toBe("Josh Mercado, President");
  });
});
