import { RelationshipType } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  profile: {
    findUnique: vi.fn()
  },
  relationship: {
    findMany: vi.fn()
  }
}));

vi.mock("@/lib/db", () => ({
  prisma: mockPrisma
}));

const { findCoParentSpouseSuggestions } = await import(
  "@/lib/services/co-parent-suggestion-service"
);

const childId = "00000000-0000-4000-8000-000000000001";
const fatherId = "00000000-0000-4000-8000-000000000002";
const motherId = "00000000-0000-4000-8000-000000000003";

function profile(id: string, fullName: string, isMerged = false) {
  return {
    id,
    fullName,
    dateOfBirth: null,
    dateOfDeath: null,
    isMerged
  };
}

function parentRelationship(
  id: string,
  relationshipType: RelationshipType,
  relatedPerson: ReturnType<typeof profile>,
  child = profile(childId, "Child Person")
) {
  return {
    id,
    personId: child.id,
    relatedPersonId: relatedPerson.id,
    relationshipType,
    person: child,
    relatedPerson
  };
}

function mockSuggestionQueries({
  current = profile(childId, "Child Person"),
  currentParentRows = [],
  currentChildRows = [],
  parentRows = [],
  spouseRows = []
} = {}) {
  mockPrisma.profile.findUnique.mockResolvedValueOnce(current);
  mockPrisma.relationship.findMany
    .mockResolvedValueOnce(currentParentRows)
    .mockResolvedValueOnce(currentChildRows)
    .mockResolvedValueOnce(parentRows);

  if (parentRows.length > 0) {
    mockPrisma.relationship.findMany.mockResolvedValueOnce(spouseRows);
  }
}

describe("co-parent suggestion service", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("detects father and mother of the same child as a suggestion", async () => {
    const father = profile(fatherId, "Father Person");
    const mother = profile(motherId, "Mother Person");
    const parentRows = [
      parentRelationship("father-link", RelationshipType.father, father),
      parentRelationship("mother-link", RelationshipType.mother, mother)
    ];

    mockSuggestionQueries({
      currentParentRows: parentRows,
      parentRows
    });

    const suggestions = await findCoParentSpouseSuggestions(childId);

    expect(suggestions).toEqual([
      {
        child: expect.objectContaining({ id: childId }),
        father: expect.objectContaining({ id: fatherId }),
        mother: expect.objectContaining({ id: motherId })
      }
    ]);
  });

  it("does not suggest when spouse already exists in either direction", async () => {
    const father = profile(fatherId, "Father Person");
    const mother = profile(motherId, "Mother Person");
    const parentRows = [
      parentRelationship("father-link", RelationshipType.father, father),
      parentRelationship("mother-link", RelationshipType.mother, mother)
    ];

    mockSuggestionQueries({
      currentParentRows: parentRows,
      parentRows,
      spouseRows: [{ personId: motherId, relatedPersonId: fatherId }]
    });

    const suggestions = await findCoParentSpouseSuggestions(childId);

    expect(suggestions).toEqual([]);
  });

  it("does not suggest when father is merged", async () => {
    const father = profile(fatherId, "Father Person", true);
    const mother = profile(motherId, "Mother Person");
    const parentRows = [
      parentRelationship("father-link", RelationshipType.father, father),
      parentRelationship("mother-link", RelationshipType.mother, mother)
    ];

    mockSuggestionQueries({
      currentParentRows: parentRows,
      parentRows
    });

    await expect(findCoParentSpouseSuggestions(childId)).resolves.toEqual([]);
  });

  it("does not suggest when mother is merged", async () => {
    const father = profile(fatherId, "Father Person");
    const mother = profile(motherId, "Mother Person", true);
    const parentRows = [
      parentRelationship("father-link", RelationshipType.father, father),
      parentRelationship("mother-link", RelationshipType.mother, mother)
    ];

    mockSuggestionQueries({
      currentParentRows: parentRows,
      parentRows
    });

    await expect(findCoParentSpouseSuggestions(childId)).resolves.toEqual([]);
  });

  it("does not suggest when child is merged", async () => {
    const mergedChild = profile(childId, "Child Person", true);
    const father = profile(fatherId, "Father Person");
    const mother = profile(motherId, "Mother Person");
    const parentRows = [
      parentRelationship(
        "father-link",
        RelationshipType.father,
        father,
        mergedChild
      ),
      parentRelationship(
        "mother-link",
        RelationshipType.mother,
        mother,
        mergedChild
      )
    ];

    mockSuggestionQueries({
      current: mergedChild,
      currentParentRows: parentRows,
      parentRows
    });

    await expect(findCoParentSpouseSuggestions(childId)).resolves.toEqual([]);
  });

  it("includes suggestions when current profile is the child", async () => {
    const father = profile(fatherId, "Father Person");
    const mother = profile(motherId, "Mother Person");
    const parentRows = [
      parentRelationship("father-link", RelationshipType.father, father),
      parentRelationship("mother-link", RelationshipType.mother, mother)
    ];

    mockSuggestionQueries({
      currentParentRows: parentRows,
      parentRows
    });

    const suggestions = await findCoParentSpouseSuggestions(childId);

    expect(suggestions[0].child.id).toBe(childId);
  });

  it("includes suggestions when current profile is a parent through children", async () => {
    const father = profile(fatherId, "Father Person");
    const mother = profile(motherId, "Mother Person");
    const currentChildRows = [
      parentRelationship("father-link", RelationshipType.father, father)
    ];
    const parentRows = [
      ...currentChildRows,
      parentRelationship("mother-link", RelationshipType.mother, mother)
    ];

    mockSuggestionQueries({
      current: father,
      currentChildRows,
      parentRows
    });

    const suggestions = await findCoParentSpouseSuggestions(fatherId);

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].father.id).toBe(fatherId);
    expect(suggestions[0].mother.id).toBe(motherId);
  });

  it("collapses duplicate suggestions", async () => {
    const father = profile(fatherId, "Father Person");
    const mother = profile(motherId, "Mother Person");
    const parentRows = [
      parentRelationship("father-link", RelationshipType.father, father),
      parentRelationship("duplicate-father-link", RelationshipType.father, father),
      parentRelationship("mother-link", RelationshipType.mother, mother)
    ];

    mockSuggestionQueries({
      currentParentRows: parentRows,
      parentRows
    });

    const suggestions = await findCoParentSpouseSuggestions(childId);

    expect(suggestions).toHaveLength(1);
  });
});
