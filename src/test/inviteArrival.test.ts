import { describe, it, expect } from "vitest";
import { isInviteHash } from "@/lib/inviteArrival";

describe("arriving from an invite email", () => {
  it("recognises the invite link", () => {
    expect(isInviteHash("#access_token=abc&expires_in=3600&refresh_token=def&token_type=bearer&type=invite")).toBe(true);
    expect(isInviteHash("#type=invite&access_token=abc")).toBe(true);
  });
  it("is not fooled by other links", () => {
    expect(isInviteHash("")).toBe(false);
    expect(isInviteHash("#attendance")).toBe(false);
    expect(isInviteHash("#access_token=abc&type=recovery")).toBe(false);
    expect(isInviteHash("#error=access_denied&error_code=otp_expired")).toBe(false);
    expect(isInviteHash("#access_token=abc&type=invited")).toBe(false);
  });
});
