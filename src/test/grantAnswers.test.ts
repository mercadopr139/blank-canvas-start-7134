import { describe, it, expect } from "vitest";
import { parseAddress, parseNameTitle, vaultAnswer, documentAnswer, needsFrom, isFactRow, pieceIsEmpty } from "@/lib/grantCoach/answers";
import { docxXmlToText } from "@/lib/grantCoach/readDocx";

const vault = {
  legal_name: "No Limits Academy Inc.",
  ein: "84-399-8071",
  nonprofit_date: "2019-12-17",
  address_mailing: "301 North Vineyard Court, Cape May NJ 08204",
  ed_name: "Josh Mercado, Program Director",
  operating_deficit: "no",
};

describe("Grant Coach facts come from the Vault, exactly", () => {
  it("splits an address the way portals ask for it", () => {
    expect(parseAddress("301 North Vineyard Court, Cape May NJ 08204")).toEqual({ street: "301 North Vineyard Court", street2: "", city: "Cape May", state: "NJ", zip: "08204" });
    expect(parseAddress("1086 Route 47 South, Rio Grande, NJ 08242")).toEqual({ street: "1086 Route 47 South", street2: "", city: "Rio Grande", state: "NJ", zip: "08242" });
    expect(parseAddress("PO Box 12\nSuite 4\nCape May, NJ 08204-1234")).toEqual({ street: "PO Box 12", street2: "Suite 4", city: "Cape May", state: "NJ", zip: "08204-1234" });
    expect(parseAddress("somewhere in town")).toBeNull();
  });
  it("splits a name and title", () => {
    expect(parseNameTitle("Josh Mercado, Program Director")).toEqual({ name: "Josh Mercado", first: "Josh", last: "Mercado", title: "Program Director" });
    expect(parseNameTitle("Chrissy Casiello — Program Coordinator").title).toBe("Program Coordinator");
  });
  it("answers each portal field from the right piece", () => {
    expect(vaultAnswer("legal_name", null, vault)).toBe("No Limits Academy Inc.");
    expect(vaultAnswer("ein", null, vault)).toBe("84-3998071");
    expect(vaultAnswer("nonprofit_date", null, vault)).toBe("12/17/2019");
    expect(vaultAnswer("address_mailing", "street", vault)).toBe("301 North Vineyard Court");
    expect(vaultAnswer("address_mailing", "street2", vault)).toBeNull();
    expect(vaultAnswer("address_mailing", "city", vault)).toBe("Cape May");
    expect(vaultAnswer("address_mailing", "zip", vault)).toBe("08204");
    expect(vaultAnswer("ed_name", "title", vault)).toBe("Program Director");
    expect(vaultAnswer("ed_name", "last", vault)).toBe("Mercado");
    expect(vaultAnswer("operating_deficit", null, vault)).toBe("No");
  });
  it("a second address line the Vault does not have is left blank, not asked for", () => {
    expect(pieceIsEmpty("address_mailing", "street2", vault)).toBe(true);
    expect(pieceIsEmpty("address_mailing", "city", vault)).toBe(false);
    expect(pieceIsEmpty("phone", "street2", {})).toBe(false);
  });
  it("says nothing when the Vault has nothing, and never guesses", () => {
    expect(vaultAnswer("phone", null, {})).toBeNull();
    expect(vaultAnswer("not_a_field", null, vault)).toBeNull();
  });
  it("matches an attachment slot to the documents on file", () => {
    expect(documentAnswer("determination_letter", new Set(["determination_letter"])).answer).toMatch(/on file/);
    expect(documentAnswer("form_990", new Set()).needs).toMatch(/Upload the Most recent IRS Form 990/);
  });
  it("turns the writer's [NEED: …] notes into one line", () => {
    expect(needsFrom("We serve [NEED: number of volunteers] and [NEED: FPL process].")).toBe("Grant Coach needs: number of volunteers; FPL process.");
    expect(needsFrom("All set.")).toBeNull();
  });
  it("keeps short fields compact and narratives as cards", () => {
    expect(isFactRow({ kind: "field" })).toBe(true);
    expect(isFactRow({ kind: "narrative" })).toBe(false);
    expect(isFactRow({ kind: "narrative", vault_key: "mission" })).toBe(true);
  });
  it("reads a Word file's paragraphs", () => {
    expect(docxXmlToText('<w:body><w:p><w:r><w:t>1. Describe the need</w:t></w:r></w:p><w:p><w:r><w:t>Limit 250 words &amp; more</w:t></w:r></w:p></w:body>')).toBe("1. Describe the need\nLimit 250 words & more");
  });
});

import { sameValue } from "@/lib/grantCoach/answers";
describe("a portal answer against the Vault", () => {
  it("treats the same value written differently as the same", () => {
    expect(sameValue("180000", "$180,000")).toBe(true);
    expect(sameValue("yes", "Yes")).toBe(true);
    expect(sameValue("NLA Boxing  & Youth Development Program", "nla boxing & youth development program")).toBe(true);
    expect(sameValue("180000", "75000")).toBe(false);
  });
});

import { shouldRemember } from "@/lib/grantCoach/memory";
describe("what Grant Coach remembers for the next grant", () => {
  const base = { id: "1", label: "How many volunteers?", detail: null, kind: "field", answer: "40", status: "done" };
  it("remembers an approved answer from the portal, from you, or from Grant Coach", () => {
    expect(shouldRemember({ ...base, answer_source: "portal" })).toBe(true);
    expect(shouldRemember({ ...base, answer_source: "you" })).toBe(true);
    expect(shouldRemember({ ...base, answer_source: "coach" })).toBe(true);
  });
  it("never remembers what is not final, empty, a blank line, or already a Vault fact", () => {
    expect(shouldRemember({ ...base, status: "in_progress", answer_source: "coach" })).toBe(false);
    expect(shouldRemember({ ...base, answer: "  ", answer_source: "you" })).toBe(false);
    expect(shouldRemember({ ...base, answer: "Leave blank", answer_source: "vault" })).toBe(false);
    expect(shouldRemember({ ...base, answer_source: "vault" })).toBe(false);
  });
});

import { usableStories, type StoryRow } from "@/lib/grantCoach/stories";
describe("the story bank respects consent", () => {
  const row = (id: string, consent: StoryRow["consent"]): StoryRow => ({ id, title: id, story: "s", raw: null, program: null, proves: [], people: null, year: "2026", consent, folder_id: null, updated_at: "" });
  it("never hands the writer a story marked don't use", () => {
    const got = usableStories([row("a", "named"), row("b", "anonymous"), row("c", "private")]);
    expect(got.map((s) => s.id)).toEqual(["a", "b"]);
    expect(got.find((s) => s.id === "b")?.consent).toBe("anonymous");
  });
});

import { preSubmitChecks } from "@/lib/grantCoach/review";
describe("before you submit", () => {
  const q = (id: string, p: Partial<{ required: boolean; status: string; answer: string | null; limit_kind: "words" | "characters" | null; limit_value: number | null; needs: string | null }>) =>
    ({ id, label: id, required: true, status: "done", answer: "ok", limit_kind: null, limit_value: null, needs: null, ...p });
  it("catches blank required questions, answers over the limit, unapproved answers and open needs", () => {
    const c = preSubmitChecks([
      q("fine", {}),
      q("blank", { answer: null, status: "todo" }),
      q("optional blank", { required: false, answer: null, status: "todo" }),
      q("leave blank", { answer: "Leave blank", required: false }),
      q("too long", { answer: "one two three four", limit_kind: "words", limit_value: 3 }),
      q("drafted", { status: "in_progress" }),
      q("needs", { needs: "How is income verified?", status: "in_progress" }),
      q("skipped", { status: "na", answer: null }),
    ]);
    expect(c.blank.map((x) => x.id)).toEqual(["blank"]);
    expect(c.over.map((x) => x.id)).toEqual(["too long"]);
    expect(c.unapproved.map((x) => x.id)).toEqual(["drafted", "needs"]);
    expect(c.needYou.map((x) => x.id)).toEqual(["needs"]);
  });
});
