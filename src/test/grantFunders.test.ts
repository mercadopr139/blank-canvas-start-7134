// What NLA knows about a funder (2026-11-12): matched to folders by name
// with case and spacing ignored; the history line per grant reads as the
// writer and the row show it.
import { describe, expect, it } from "vitest";
import { funderKey, funderHistory, funderHistoryText, type FunderFolder } from "@/lib/grantCoach/funders";

const base: FunderFolder = {
  id: "x", name: "", funder: "Avalon Lions Charities Foundation", status: "applying", amount_requested: null, amount_awarded: null,
  due_at: null, period_start: null, submitted_at: null, decided_at: null, decline_reason: null,
};
const folders: FunderFolder[] = [
  { ...base, id: "a", name: "Special Grant 2026–27", funder: "Avalon Lions Charities Foundation", amount_requested: 25000, period_start: "2027-01-01" },
  { ...base, id: "b", name: "Annual gift 2025", funder: "  avalon lions  charities foundation ", status: "closed", amount_requested: 5000, amount_awarded: 5000, period_start: "2025-01-01" },
  { ...base, id: "c", name: "Equipment 2024", funder: "Avalon Lions Charities Foundation", status: "declined", decline_reason: "asked for more than the program", amount_requested: 40000, submitted_at: "2024-03-02T15:00:00Z" },
  { ...base, id: "d", name: "CSBG 2027", funder: "O.C.E.A.N., Inc.", amount_requested: 180000, period_start: "2027-01-01" },
];

describe("funder notes", () => {
  it("keys a funder by name with case and spacing ignored, the way the database does", () => {
    expect(funderKey("  Avalon Lions   Charities Foundation ")).toBe("avalon lions charities foundation");
    expect(funderKey("")).toBe("");
  });

  it("lists this funder's grants newest first, leaving out the folder being written and other funders", () => {
    const h = funderHistory(folders, "avalon lions charities foundation", "a");
    expect(h.map((x) => x.id)).toEqual(["b", "c"]);
    expect(h[0].line).toBe("2025 · Annual gift 2025 · asked $5,000 · awarded $5,000");
    expect(h[1].line).toBe("2024 · Equipment 2024 · asked $40,000 · declined — asked for more than the program");
  });

  it("says the status of a grant still in flight, and gives the writer one line each or nothing", () => {
    expect(funderHistory(folders, "Avalon Lions Charities Foundation")[0].line).toBe("2027 · Special Grant 2026–27 · asked $25,000 · applying");
    expect(funderHistoryText(folders, "O.C.E.A.N., Inc.", "d")).toBeNull();
    expect(funderHistoryText(folders, "O.C.E.A.N., Inc.")).toBe("2027 · CSBG 2027 · asked $180,000 · applying");
  });
});
