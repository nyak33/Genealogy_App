import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  profile: {
    findMany: vi.fn()
  },
  relationship: {
    create: vi.fn(),
    delete: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn()
  }
}));

vi.mock("@/lib/db", () => ({
  prisma: mockPrisma
}));

const {
  createRelationship,
  getProfileRelationships,
  getProfileTreeRelationships,
  RelationshipConflictError
} = await import("@/lib/services/relationship-service");

const firstProfileId = "00000000-0000-4000-8000-000000000001";
const secondProfileId = "00000000-0000-4000-8000-000000000002";
const thirdProfileId = "00000000-0000-4000-8000-000000000003";

function mockProfilesExist() {
  mockPrisma.profile.findMany.mockResolvedValue([
    { id: firstProfileId },
    { id: secondProfileId }
  ]);
}

describe("relationship service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("blocks a conflicting relationship between the same two profiles", async () => {
    mockProfilesExist();
    mockPrisma.relationship.findFirst.mockResolvedValueOnce({
      relationshipType: "father"
    });

    try {
      await createRelationship({
        personId: firstProfileId,
        relatedPersonId: secondProfileId,
        relationshipType: "spouse"
      });
      throw new Error("Expected relationship creation to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(RelationshipConflictError);
      expect(error).toHaveProperty(
        "message",
        "This profile is already linked as another family relationship."
      );
    }
  });

  it("blocks a second father for the same child", async () => {
    mockProfilesExist();
    mockPrisma.relationship.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "existing-father" });

    await expect(
      createRelationship({
        personId: firstProfileId,
        relatedPersonId: secondProfileId,
        relationshipType: "father"
      })
    ).rejects.toThrow("This profile already has a father linked.");
  });

  it("blocks a second mother for the same child", async () => {
    mockProfilesExist();
    mockPrisma.relationship.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "existing-mother" });

    await expect(
      createRelationship({
        personId: firstProfileId,
        relatedPersonId: secondProfileId,
        relationshipType: "mother"
      })
    ).rejects.toThrow("This profile already has a mother linked.");
  });

  it("blocks a reverse spouse duplicate", async () => {
    mockProfilesExist();
    mockPrisma.relationship.findFirst.mockResolvedValueOnce({
      relationshipType: "spouse"
    });

    await expect(
      createRelationship({
        personId: firstProfileId,
        relatedPersonId: secondProfileId,
        relationshipType: "spouse"
      })
    ).rejects.toThrow("Relationship already exists");
  });

  it("maps spouse rows bidirectionally and children by reverse parent lookup", async () => {
    mockPrisma.relationship.findMany
      .mockResolvedValueOnce([
        {
          id: "father-link",
          relationshipType: "father",
          relatedPerson: {
            id: secondProfileId,
            fullName: "Amin Rahman",
            dateOfBirth: null,
            dateOfDeath: null
          }
        }
      ])
      .mockResolvedValueOnce([
        {
          id: "spouse-link",
          personId: secondProfileId,
          relatedPersonId: firstProfileId,
          relationshipType: "spouse",
          person: {
            id: secondProfileId,
            fullName: "Amin Rahman",
            dateOfBirth: null,
            dateOfDeath: null
          },
          relatedPerson: {
            id: firstProfileId,
            fullName: "Iman Amin",
            dateOfBirth: null,
            dateOfDeath: null
          }
        }
      ])
      .mockResolvedValueOnce([
        {
          id: "child-link",
          relationshipType: "mother",
          person: {
            id: thirdProfileId,
            fullName: "Nora Aziz",
            dateOfBirth: null,
            dateOfDeath: null
          }
        }
      ]);

    const relationships = await getProfileRelationships(firstProfileId);

    expect(relationships.father[0].profile.id).toBe(secondProfileId);
    expect(relationships.spouses[0].profile.id).toBe(secondProfileId);
    expect(relationships.children[0].profile.id).toBe(thirdProfileId);
  });

  it("enriches tree children with father and missing mother links", async () => {
    mockPrisma.relationship.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: "child-link",
          relationshipType: "father",
          person: {
            id: thirdProfileId,
            fullName: "Iman Amin",
            dateOfBirth: new Date("2012-06-15"),
            dateOfDeath: null
          }
        }
      ])
      .mockResolvedValueOnce([
        {
          id: "father-link",
          relationshipType: "father",
          relatedPerson: {
            id: firstProfileId,
            fullName: "Muhamad Syaqir",
            dateOfBirth: null,
            dateOfDeath: null
          }
        }
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const relationships = await getProfileTreeRelationships(firstProfileId);

    expect(relationships.children[0].profile.fullName).toBe("Iman Amin");
    expect(relationships.children[0].father?.fullName).toBe("Muhamad Syaqir");
    expect(relationships.children[0].mother).toBeNull();
  });

  it("enriches tree children with both biological parents", async () => {
    mockPrisma.relationship.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: "child-link",
          relationshipType: "father",
          person: {
            id: thirdProfileId,
            fullName: "Adam Syaqir",
            dateOfBirth: new Date("2020-01-01"),
            dateOfDeath: null
          }
        }
      ])
      .mockResolvedValueOnce([
        {
          id: "father-link",
          relationshipType: "father",
          relatedPerson: {
            id: firstProfileId,
            fullName: "Muhamad Syaqir",
            dateOfBirth: null,
            dateOfDeath: null
          }
        },
        {
          id: "mother-link",
          relationshipType: "mother",
          relatedPerson: {
            id: secondProfileId,
            fullName: "Nora Aziz",
            dateOfBirth: null,
            dateOfDeath: null
          }
        }
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const relationships = await getProfileTreeRelationships(firstProfileId);

    expect(relationships.children[0].father?.fullName).toBe("Muhamad Syaqir");
    expect(relationships.children[0].mother?.fullName).toBe("Nora Aziz");
  });

  it("does not treat a spouse as a child parent unless linked as father or mother", async () => {
    mockPrisma.relationship.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: "spouse-link",
          personId: firstProfileId,
          relatedPersonId: secondProfileId,
          relationshipType: "spouse",
          person: {
            id: firstProfileId,
            fullName: "Muhamad Syaqir",
            dateOfBirth: null,
            dateOfDeath: null
          },
          relatedPerson: {
            id: secondProfileId,
            fullName: "Nora Aziz",
            dateOfBirth: null,
            dateOfDeath: null
          }
        }
      ])
      .mockResolvedValueOnce([
        {
          id: "child-link",
          relationshipType: "father",
          person: {
            id: thirdProfileId,
            fullName: "Iman Amin",
            dateOfBirth: null,
            dateOfDeath: null
          }
        }
      ])
      .mockResolvedValueOnce([
        {
          id: "father-link",
          relationshipType: "father",
          relatedPerson: {
            id: firstProfileId,
            fullName: "Muhamad Syaqir",
            dateOfBirth: null,
            dateOfDeath: null
          }
        }
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const relationships = await getProfileTreeRelationships(firstProfileId);

    expect(relationships.spouses[0].profile.fullName).toBe("Nora Aziz");
    expect(relationships.children[0].father?.fullName).toBe("Muhamad Syaqir");
    expect(relationships.children[0].mother).toBeNull();
  });

  it("keeps empty child parent links safe for tree display", async () => {
    mockPrisma.relationship.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: "child-link",
          relationshipType: "father",
          person: {
            id: thirdProfileId,
            fullName: "Iman Amin",
            dateOfBirth: null,
            dateOfDeath: null
          }
        }
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const relationships = await getProfileTreeRelationships(firstProfileId);

    expect(relationships.children[0].father).toBeNull();
    expect(relationships.children[0].mother).toBeNull();
  });
});
