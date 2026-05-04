import { describe, expect, it } from "vitest";
import { normalizeName } from "@/lib/utils/normalize-name";

describe("normalizeName", () => {
  it("trims, lowercases, and collapses whitespace", () => {
    expect(normalizeName("  Muhamad   Syaqir  bin   Sha'rani  ")).toBe(
      "muhamad syaqir bin sha'rani"
    );
  });
});
