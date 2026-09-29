import { describe, it, expect } from "vitest";
import { problemFieldKey } from "@/lib/validationFocus";

const fields = [
  { field_key: "has_asthma", label: "Does the student have asthma?", field_type: "yes_no" },
  { field_key: "asthma_inhaler_info", label: "Name of the inhaler the student takes prior to strenuous exercise", field_type: "long_text" },
  { field_key: "asthma_inhaler_ack", label: "I understand that, for my student's safety, I must provide an inhaler that stays at No Limits Academy during all program hours.", field_type: "checkbox" },
  { field_key: "child_headshot", label: "Picture of participant", field_type: "file_upload" },
  { field_key: "child_primary_address", label: "Home address", field_type: "address" },
];
const waivers = [
  { field_key: "hawk_transportation", title: "Transportation Waiver" },
  { field_key: "hawk_dismissal", title: "Dismissal Waiver" },
];

describe("problemFieldKey", () => {
  it("finds the field a 'Please fill in' message names", () => {
    expect(problemFieldKey("Please fill in: Name of the inhaler the student takes prior to strenuous exercise", fields, waivers)).toBe("asthma_inhaler_info");
  });
  it("finds a checkbox field by its label", () => {
    expect(problemFieldKey(`Please check the box: ${fields[2].label}`, fields, waivers)).toBe("asthma_inhaler_ack");
  });
  it("finds a waiver by its title", () => {
    expect(problemFieldKey("Please sign all waivers. Missing: Dismissal Waiver", fields, waivers)).toBe("hawk_dismissal");
    expect(problemFieldKey("Please check the box to acknowledge the waiver: Transportation Waiver", fields, waivers)).toBe("hawk_transportation");
  });
  it("knows the fixed messages", () => {
    expect(problemFieldKey("Please upload a picture of your participant.", fields, waivers)).toBe("child_headshot");
    expect(problemFieldKey("Please enter a valid 10-digit parent/guardian phone number.", fields, waivers)).toBe("parent_phone");
    expect(problemFieldKey("Please enter a valid email address.", fields, waivers)).toBe("parent_email");
    expect(problemFieldKey("Please type your name in the final confirmation box.", fields, waivers)).toBe("final_signature_name");
    expect(problemFieldKey("Please pick the address from the suggestions so we can find the house.", fields, waivers)).toBe("child_primary_address");
  });
  it("returns null for a general message", () => {
    expect(problemFieldKey("Invalid submission. Please try again.", fields, waivers)).toBeNull();
  });
});
