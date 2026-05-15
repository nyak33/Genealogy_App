import { describe, expect, it } from "vitest";
import { normalizeName } from "@/lib/utils/normalize-name";

describe("normalizeName", () => {
  it("trims, lowercases, and collapses whitespace", () => {
    expect(normalizeName("  Alex   Carter  ")).toBe("alex carter");
  });
});
