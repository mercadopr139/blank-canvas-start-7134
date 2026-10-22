import { describe, it, expect } from "vitest";
import { buildAnswersPdf, limitLine, printableItems, answersPdfFileName } from "@/lib/grantCoach/answersPdf";

const folder = { name: "2027 CSBG Partnership Program", funder: "O.C.E.A.N., Inc.", program_name: "Youth Development", due_at: "2026-10-30T21:00:00Z", amount_requested: 75000, period_start: "2027-01-01", period_end: "2027-12-31" };
const items = [
  { section: "Portal · Screen 3", label: "Describe the need in your community.", detail: null, answer: "Cape May County youth face long winters with little to do.\n\nNLA opens every night.", status: "done", limit_kind: "words" as const, limit_value: 250, pasted_at: "2026-10-22T18:00:00Z", source_path: "x" },
  { section: "Portal · Screen 3", label: "How many youth will you serve?", detail: "Unduplicated", answer: null, status: "todo", limit_kind: "characters" as const, limit_value: 500, pasted_at: null, source_path: "x" },
  { section: "Attachments", label: "IRS determination letter", detail: null, answer: null, status: "todo", limit_kind: null, limit_value: null, pasted_at: null, source_path: null },
  { section: "Portal · Screen 4", label: "Skipped", detail: null, answer: null, status: "na", limit_kind: null, limit_value: null, pasted_at: null, source_path: "x" },
];

describe("Grant Coach hardcopy of the online application", () => {
  it("prints the portal questions, not the attachments or N/A rows", () => {
    expect(printableItems(items).map((i) => i.label)).toEqual(["Describe the need in your community.", "How many youth will you serve?"]);
  });
  it("shows what the funder allowed and what was used", () => {
    expect(limitLine(items[0])).toBe("15 / 250 words");
    expect(limitLine(items[1])).toBe("0 / 500 characters");
    expect(limitLine(items[2])).toBeNull();
  });
  it("builds a PDF with every question, its answer, and the unanswered marked", async () => {
    const pdf = await buildAnswersPdf(folder, printableItems(items), new Date("2026-10-28T20:00:00Z"));
    const text = pdf.output();
    expect(text).toContain("Describe the need in your community.");
    expect(text).toContain("NLA opens every night.");
    expect(text).toContain("Not answered.");
    expect(text).toContain("Pasted October 22, 2026");
    expect(text).toContain("SCREEN 3");
    expect(text).toContain("Page 1 of 1");
    if (process.env.PDF_OUT) (await import("fs")).writeFileSync(process.env.PDF_OUT, Buffer.from(pdf.output("arraybuffer")));
  });
  it("names the file for the funder and the day", () => {
    expect(answersPdfFileName(folder, new Date("2026-10-28T20:00:00Z"))).toBe("O_C_E_A_N_Inc_2027_CSBG_Partnership_Program_answers_2026-10-28.pdf");
  });
});
