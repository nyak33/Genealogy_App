import { describe, expect, it } from "vitest";
import { getDuplicateGroupMergeHref } from "@/app/data-quality/page";

describe("data quality page helpers", () => {
  it("uses query params for two-profile duplicate merge review links", () => {
    expect(
      getDuplicateGroupMergeHref([
        { id: "00000000-0000-4000-8000-000000000001" },
        { id: "00000000-0000-4000-8000-000000000002" }
      ])
    ).toBe(
      "/profiles/merge?primaryId=00000000-0000-4000-8000-000000000001&duplicateId=00000000-0000-4000-8000-000000000002"
    );
  });

  it("does not prefill merge review links for larger duplicate groups", () => {
    expect(
      getDuplicateGroupMergeHref([
        { id: "00000000-0000-4000-8000-000000000001" },
        { id: "00000000-0000-4000-8000-000000000002" },
        { id: "00000000-0000-4000-8000-000000000003" }
      ])
    ).toBe("/profiles/merge");
  });
});
