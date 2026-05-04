import { describe, expect, it } from "vitest";
import { createRelationshipSchema } from "@/lib/validators/relationship";

const firstProfileId = "00000000-0000-4000-8000-000000000001";
const secondProfileId = "00000000-0000-4000-8000-000000000002";

describe("relationship validators", () => {
  it("accepts a valid father relationship", () => {
    const result = createRelationshipSchema.safeParse({
      personId: firstProfileId,
      relatedPersonId: secondProfileId,
      relationshipType: "father"
    });

    expect(result.success).toBe(true);
  });

  it("rejects self-links", () => {
    const result = createRelationshipSchema.safeParse({
      personId: firstProfileId,
      relatedPersonId: firstProfileId,
      relationshipType: "father"
    });

    expect(result.success).toBe(false);
  });

  it("rejects invalid relationship types", () => {
    const result = createRelationshipSchema.safeParse({
      personId: firstProfileId,
      relatedPersonId: secondProfileId,
      relationshipType: "guardian"
    });

    expect(result.success).toBe(false);
  });
});
