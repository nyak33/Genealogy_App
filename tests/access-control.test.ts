import { describe, expect, it } from "vitest";
import {
  createAccessToken,
  getAccessPassword,
  getSafeRedirectPath,
  isAccessPasswordConfigured,
  isSubmittedPasswordValid,
  isValidAccessToken,
  shouldRequireAccess
} from "@/lib/access-control";

describe("access control", () => {
  it("requires access in production even when the password is missing", () => {
    expect(shouldRequireAccess({ NODE_ENV: "production" })).toBe(true);
  });

  it("does not require access in local development unless configured", () => {
    expect(shouldRequireAccess({ NODE_ENV: "development" })).toBe(false);
    expect(
      shouldRequireAccess({
        APP_ACCESS_PASSWORD: "family-password",
        NODE_ENV: "development"
      })
    ).toBe(true);
  });

  it("trims configured passwords and treats blank values as missing", () => {
    expect(getAccessPassword({ APP_ACCESS_PASSWORD: "  secret  " })).toBe(
      "secret"
    );
    expect(
      isAccessPasswordConfigured({ APP_ACCESS_PASSWORD: "     " })
    ).toBe(false);
  });

  it("validates signed access tokens", () => {
    const token = createAccessToken("family-password");

    expect(isValidAccessToken(token, "family-password")).toBe(true);
    expect(isValidAccessToken(token, "wrong-password")).toBe(false);
    expect(isValidAccessToken("not-a-token", "family-password")).toBe(false);
  });

  it("compares submitted passwords without accepting partial matches", () => {
    expect(isSubmittedPasswordValid("family-password", "family-password")).toBe(
      true
    );
    expect(isSubmittedPasswordValid("family", "family-password")).toBe(false);
  });

  it("keeps login redirects inside the app", () => {
    expect(getSafeRedirectPath("/profiles")).toBe("/profiles");
    expect(getSafeRedirectPath("//example.com")).toBe("/profiles");
    expect(getSafeRedirectPath("/api/profiles")).toBe("/profiles");
    expect(getSafeRedirectPath("/private-access")).toBe("/profiles");
  });
});
