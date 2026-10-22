import { describe, it, expect } from "vitest";
import { sharedStrings, sheetToText, slideToText, readsAsText } from "@/lib/grantCoach/readOffice";

describe("reading a funder's Excel and PowerPoint files", () => {
  it("reads a budget sheet's cells, shared strings and numbers", () => {
    const strings = sharedStrings('<sst><si><t>Line item</t></si><si><t>Amount</t></si><si><r><t>Personnel</t></r><r><t> &amp; fringe</t></r></si></sst>');
    expect(strings).toEqual(["Line item", "Amount", "Personnel & fringe"]);
    const sheet = '<sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row><row r="2"><c r="A2" t="s"><v>2</v></c><c r="B2"><v>45000</v></c></row><row r="3"><c r="A3"/></row><row r="4"><c r="A4" t="inlineStr"><is><t>Total</t></is></c><c r="B4"><f>SUM(B2:B3)</f></c></row></sheetData>';
    expect(sheetToText(sheet, strings)).toBe("Line item\tAmount\nPersonnel & fringe\t45000\nTotal\t=SUM(B2:B3)");
  });
  it("reads slide text one paragraph per line", () => {
    expect(slideToText('<p:sld><a:p><a:r><a:t>Scoring</a:t></a:r></a:p><a:p><a:r><a:t>Need: 20 </a:t></a:r><a:r><a:t>points</a:t></a:r></a:p><a:p></a:p></p:sld>')).toBe("Scoring\nNeed: 20 points");
  });
  it("knows which files the browser reads as text", () => {
    expect(readsAsText("OCEAN Budget template.xlsx")).toBe(true);
    expect(readsAsText("session.pptx")).toBe(true);
    expect(readsAsText("RFP.pdf")).toBe(false);
  });
});
