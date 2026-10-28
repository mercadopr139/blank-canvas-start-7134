import { describe, it, expect } from "vitest";
import { ORG_SECTIONS, ORG_FIELDS, orgFieldValue, orgCompleteness } from "@/lib/grantCoach/orgProfile";
import { ORG_DOCUMENTS, orgDocumentPath } from "@/lib/grantCoach/orgDocuments";
import { SNAPSHOT_SECTIONS } from "@/lib/grantCoach/snapshot";

describe("Grant Coach — the About NLA library", () => {
  it("every field key is unique, so a saved value can never land on two fields", () => {
    const keys = ORG_FIELDS.map((f) => f.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(ORG_SECTIONS.length).toBeGreaterThanOrEqual(5);
  });

  it("one source of truth: each Snapshot paragraph opens exactly one Vault section, in the funder's order", () => {
    const opened = ORG_SECTIONS.map((s) => s.snapshot).filter(Boolean);
    expect(opened).toEqual(SNAPSHOT_SECTIONS.map((s) => s.key));
    // The prose that repeated the Snapshot is gone; the hours stay as a fact.
    expect(ORG_FIELDS.find((f) => f.key === "demographics")).toBeUndefined();
    expect(ORG_FIELDS.find((f) => f.key === "impact")).toBeUndefined();
    expect(ORG_FIELDS.find((f) => f.key === "schedule")?.label).toBe("Hours and Calendar");
    expect(ORG_FIELDS.find((f) => f.key === "program_description")?.label).toBe("Boxing Groups Explained");
    expect(ORG_FIELDS.find((f) => f.key === "boxing_teams_short")?.seed).toMatch(/Battle Team and the Non-Battle Team/);
  });

  it("the website seeds cover what O.C.E.A.N.'s first screens ask for", () => {
    const seed = (k: string) => ORG_FIELDS.find((f) => f.key === k)?.seed ?? "";
    expect(seed("legal_name")).toBe("No Limits Academy Inc.");
    expect(seed("year_established")).toBe("2020");
    expect(seed("website")).toContain("nolimitsboxingacademy.org");
    expect(seed("mission")).toMatch(/year-round/);
    expect(seed("schedule")).not.toMatch(/10-month/);
    expect(seed("programs")).toMatch(/Hawk Squad/);
    expect(seed("awards")).toMatch(/Congressional Proclamation/);
  });

  it("a saved value wins over the seed, and an empty save counts as empty", () => {
    const mission = ORG_FIELDS.find((f) => f.key === "mission")!;
    expect(orgFieldValue(mission, {})).toBe(mission.seed);
    expect(orgFieldValue(mission, { mission: "Our own words." })).toBe("Our own words.");
    expect(orgFieldValue(mission, { mission: null })).toBe("");
  });

  it("completeness counts required fields with text, seeds included", () => {
    const { done, total } = orgCompleteness({});
    const seededRequired = ORG_FIELDS.filter((f) => f.required && f.seed?.trim()).length;
    expect(total).toBe(ORG_FIELDS.filter((f) => f.required).length);
    expect(done).toBe(seededRequired);
    expect(orgCompleteness({ ein: "12-3456789" }).done).toBe(seededRequired + 1);
  });
});

describe("Grant Coach — the organization documents", () => {
  it("has the four O.C.E.A.N. attachments, with unique keys", () => {
    const keys = ORG_DOCUMENTS.map((d) => d.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(ORG_DOCUMENTS.filter((d) => d.ocean).map((d) => d.key)).toEqual(
      expect.arrayContaining(["determination_letter", "form_990", "operating_budget", "audit"])
    );
  });

  it("stores files under the catalog key with a safe name", () => {
    const p = orgDocumentPath("form_990", "NLA 990 (2025) final.pdf");
    expect(p).toMatch(/^org\/form_990\/\d+_NLA_990_2025_final\.pdf$/);
  });
});

import { formatEin } from "@/lib/grantCoach/orgProfile";
describe("EIN format", () => {
  it("writes nine digits as XX-XXXXXXX however they were typed", () => {
    expect(formatEin("84-399-8071")).toBe("84-3998071");
    expect(formatEin("843998071")).toBe("84-3998071");
    expect(formatEin(" 84 3998071 ")).toBe("84-3998071");
  });
  it("leaves anything that is not nine digits for a person to fix", () => {
    expect(formatEin("84-39980")).toBe("84-39980");
  });
});
