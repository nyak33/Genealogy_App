import { describe, expect, it } from "vitest";
import {
  createProfileSchema,
  duplicateCheckSchema,
  profileSearchQuerySchema,
  updateProfileSchema
} from "@/lib/validators/profile";

describe("profile validators", () => {
  it("cleans fullName spacing while preserving casing", () => {
    const result = createProfileSchema.parse({
      fullName: "  Muhamad   Syaqir  bin Sha'rani  "
    });

    expect(result.fullName).toBe("Muhamad Syaqir bin Sha'rani");
  });

  it("rejects empty fullName", () => {
    const result = createProfileSchema.safeParse({
      fullName: "     "
    });

    expect(result.success).toBe(false);
  });

  it("rejects user-submitted normalizedName", () => {
    const result = createProfileSchema.safeParse({
      fullName: "Amin Rahman",
      normalizedName: "amin rahman"
    });

    expect(result.success).toBe(false);
  });

  it("accepts duplicate-confirmation flag on create only", () => {
    const createResult = createProfileSchema.safeParse({
      fullName: "Amin Rahman",
      confirmCreateDifferentPerson: true
    });
    const updateResult = updateProfileSchema.safeParse({
      confirmCreateDifferentPerson: true
    });

    expect(createResult.success).toBe(true);
    expect(updateResult.success).toBe(false);
  });

  it("validates duplicate-check input", () => {
    const result = duplicateCheckSchema.safeParse({
      fullName: "  Laila   Hassan  ",
      dateOfBirth: "1982-11-05"
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.fullName).toBe("Laila Hassan");
    }
  });

  it("defaults missing search query to an empty string", () => {
    expect(profileSearchQuerySchema.parse({})).toEqual({ q: "" });
  });
});
