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

const { getSimpleFamilyTree } = await import("@/lib/services/tree-service");

const currentProfileId = "00000000-0000-4000-8000-000000000001";
const fatherProfileId = "00000000-0000-4000-8000-000000000002";
const motherProfileId = "00000000-0000-4000-8000-000000000003";
const spouseProfileId = "00000000-0000-4000-8000-000000000004";
const childProfileId = "00000000-0000-4000-8000-000000000005";

function profile(id: string, fullName: string) {
  return {
    id,
    fullName,
    dateOfBirth: null,
    dateOfDeath: null
  };
}

function currentProfile(overrides = {}) {
  return {
    ...profile(currentProfileId, "Current Person"),
    isMerged: false,
    mergedIntoProfile: null,
    ...overrides
  };
}

function mockBaseRelationships({
  parents = [],
  spouses = [],
  children = [],
  childParents = []
} = {}) {
  mockPrisma.relationship.findMany
    .mockResolvedValueOnce(parents)
    .mockResolvedValueOnce(spouses)
    .mockResolvedValueOnce(children);

  if (children.length > 0) {
    mockPrisma.relationship.findMany.mockResolvedValueOnce(childParents);
  }
}

describe("tree service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.profile.findUnique.mockResolvedValue(currentProfile());
  });

  it("loads father correctly", async () => {
    mockBaseRelationships({
      parents: [
        {
          personId: currentProfileId,
          relatedPersonId: fatherProfileId,
          relationshipType: RelationshipType.father,
          relatedPerson: profile(fatherProfileId, "Father Person")
        }
      ]
    });

    const tree = await getSimpleFamilyTree(currentProfileId);

    expect(tree.father?.fullName).toBe("Father Person");
    expect(tree.mother).toBeNull();
  });

  it("loads mother correctly", async () => {
    mockBaseRelationships({
      parents: [
        {
          personId: currentProfileId,
          relatedPersonId: motherProfileId,
          relationshipType: RelationshipType.mother,
          relatedPerson: profile(motherProfileId, "Mother Person")
        }
      ]
    });

    const tree = await getSimpleFamilyTree(currentProfileId);

    expect(tree.mother?.fullName).toBe("Mother Person");
    expect(tree.father).toBeNull();
  });

  it("loads spouse bidirectionally", async () => {
    mockBaseRelationships({
      spouses: [
        {
          personId: spouseProfileId,
          relatedPersonId: currentProfileId,
          relationshipType: RelationshipType.spouse,
          person: profile(spouseProfileId, "Spouse Person"),
          relatedPerson: profile(currentProfileId, "Current Person")
        }
      ]
    });

    const tree = await getSimpleFamilyTree(currentProfileId);

    expect(tree.spouses).toEqual([
      expect.objectContaining({
        id: spouseProfileId,
        fullName: "Spouse Person"
      })
    ]);
  });

  it("loads children from reverse father and mother lookup", async () => {
    mockBaseRelationships({
      children: [
        {
          personId: childProfileId,
          relatedPersonId: currentProfileId,
          relationshipType: RelationshipType.father,
          person: profile(childProfileId, "Child Person")
        }
      ],
      childParents: []
    });

    const tree = await getSimpleFamilyTree(currentProfileId);

    expect(tree.children[0].profile.fullName).toBe("Child Person");
  });

  it("shows child father and mother from the child's own biological links", async () => {
    mockBaseRelationships({
      children: [
        {
          personId: childProfileId,
          relatedPersonId: currentProfileId,
          relationshipType: RelationshipType.father,
          person: profile(childProfileId, "Child Person")
        }
      ],
      childParents: [
        {
          personId: childProfileId,
          relatedPersonId: fatherProfileId,
          relationshipType: RelationshipType.father,
          relatedPerson: profile(fatherProfileId, "Father Person")
        },
        {
          personId: childProfileId,
          relatedPersonId: motherProfileId,
          relationshipType: RelationshipType.mother,
          relatedPerson: profile(motherProfileId, "Mother Person")
        }
      ]
    });

    const tree = await getSimpleFamilyTree(currentProfileId);

    expect(tree.children[0].father?.fullName).toBe("Father Person");
    expect(tree.children[0].mother?.fullName).toBe("Mother Person");
  });

  it("does not treat a spouse as a child parent unless linked as father or mother", async () => {
    mockBaseRelationships({
      spouses: [
        {
          personId: currentProfileId,
          relatedPersonId: spouseProfileId,
          relationshipType: RelationshipType.spouse,
          person: profile(currentProfileId, "Current Person"),
          relatedPerson: profile(spouseProfileId, "Spouse Person")
        }
      ],
      children: [
        {
          personId: childProfileId,
          relatedPersonId: currentProfileId,
          relationshipType: RelationshipType.father,
          person: profile(childProfileId, "Child Person")
        }
      ],
      childParents: [
        {
          personId: childProfileId,
          relatedPersonId: currentProfileId,
          relationshipType: RelationshipType.father,
          relatedPerson: profile(currentProfileId, "Current Person")
        }
      ]
    });

    const tree = await getSimpleFamilyTree(currentProfileId);

    expect(tree.spouses[0].fullName).toBe("Spouse Person");
    expect(tree.children[0].father?.fullName).toBe("Current Person");
    expect(tree.children[0].mother).toBeNull();
  });

  it("returns safe empty values when links are missing", async () => {
    mockBaseRelationships();

    const tree = await getSimpleFamilyTree(currentProfileId);

    expect(tree.father).toBeNull();
    expect(tree.mother).toBeNull();
    expect(tree.spouses).toEqual([]);
    expect(tree.children).toEqual([]);
  });

  it("excludes merged relatives from normal tree queries", async () => {
    mockBaseRelationships({
      children: [
        {
          personId: childProfileId,
          relatedPersonId: currentProfileId,
          relationshipType: RelationshipType.father,
          person: profile(childProfileId, "Child Person")
        }
      ],
      childParents: []
    });

    await getSimpleFamilyTree(currentProfileId);

    expect(mockPrisma.relationship.findMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({
          relatedPerson: {
            isMerged: false
          }
        })
      })
    );
    expect(mockPrisma.relationship.findMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            expect.objectContaining({
              relatedPerson: {
                isMerged: false
              }
            }),
            expect.objectContaining({
              person: {
                isMerged: false
              }
            })
          ])
        })
      })
    );
    expect(mockPrisma.relationship.findMany).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        where: expect.objectContaining({
          person: {
            isMerged: false
          }
        })
      })
    );
    expect(mockPrisma.relationship.findMany).toHaveBeenNthCalledWith(
      4,
      expect.objectContaining({
        where: expect.objectContaining({
          relatedPerson: {
            isMerged: false
          }
        })
      })
    );
  });

  it("returns merged current profile metadata without loading relationships", async () => {
    mockPrisma.profile.findUnique.mockResolvedValueOnce(
      currentProfile({
        isMerged: true,
        mergedIntoProfile: {
          id: fatherProfileId,
          fullName: "Primary Person"
        }
      })
    );

    const tree = await getSimpleFamilyTree(currentProfileId);

    expect(tree.isMerged).toBe(true);
    expect(tree.mergedIntoProfile?.fullName).toBe("Primary Person");
    expect(tree.children).toEqual([]);
    expect(mockPrisma.relationship.findMany).not.toHaveBeenCalled();
  });
});
