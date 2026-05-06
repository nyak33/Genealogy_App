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
  RelationshipConflictError,
  RelationshipInputError,
  RelationshipParentAgeWarningError
} = await import("@/lib/services/relationship-service");

const firstProfileId = "00000000-0000-4000-8000-000000000001";
const secondProfileId = "00000000-0000-4000-8000-000000000002";
const thirdProfileId = "00000000-0000-4000-8000-000000000003";

function mockProfilesExist() {
  mockPrisma.profile.findMany.mockResolvedValue([
    { id: firstProfileId, isMerged: false },
    { id: secondProfileId, isMerged: false }
  ]);
}

function mockSuccessfulRelationshipCreate() {
  mockPrisma.relationship.create.mockResolvedValue({
    id: "relationship-created",
    personId: firstProfileId,
    relatedPersonId: secondProfileId,
    relationshipType: "father",
    notes: null,
    createdAt: new Date("2026-01-01")
  });
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

  it("rejects a merged personId", async () => {
    mockPrisma.profile.findMany.mockResolvedValueOnce([
      { id: firstProfileId, isMerged: true },
      { id: secondProfileId, isMerged: false }
    ]);

    await expect(
      createRelationship({
        personId: firstProfileId,
        relatedPersonId: secondProfileId,
        relationshipType: "spouse"
      })
    ).rejects.toThrow(
      "Cannot link merged profiles. Use the primary profile instead."
    );
    expect(mockPrisma.relationship.findFirst).not.toHaveBeenCalled();
  });

  it("rejects a merged relatedPersonId", async () => {
    mockPrisma.profile.findMany.mockResolvedValueOnce([
      { id: firstProfileId, isMerged: false },
      { id: secondProfileId, isMerged: true }
    ]);

    await expect(
      createRelationship({
        personId: firstProfileId,
        relatedPersonId: secondProfileId,
        relationshipType: "father"
      })
    ).rejects.toThrow(
      "Cannot link merged profiles. Use the primary profile instead."
    );
  });

  it("rejects a converted child relationship when the selected child is merged", async () => {
    mockPrisma.profile.findMany.mockResolvedValueOnce([
      { id: firstProfileId, isMerged: true },
      { id: secondProfileId, isMerged: false }
    ]);

    await expect(
      createRelationship({
        personId: firstProfileId,
        relatedPersonId: secondProfileId,
        relationshipType: "father"
      })
    ).rejects.toThrow(
      "Cannot link merged profiles. Use the primary profile instead."
    );
  });

  it("blocks a parent born after the child", async () => {
    mockPrisma.profile.findMany
      .mockResolvedValueOnce([{ id: firstProfileId }, { id: secondProfileId }])
      .mockResolvedValueOnce([
        { id: firstProfileId, dateOfBirth: new Date("2015-01-01") },
        { id: secondProfileId, dateOfBirth: new Date("2016-01-01") }
      ]);
    mockPrisma.relationship.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);

    try {
      await createRelationship({
        personId: firstProfileId,
        relatedPersonId: secondProfileId,
        relationshipType: "father"
      });
      throw new Error("Expected parent age validation to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(RelationshipInputError);
      expect(error).toHaveProperty("message", "Parent must be older than child.");
    }
  });

  it("blocks a parent with the same date of birth as the child", async () => {
    mockPrisma.profile.findMany
      .mockResolvedValueOnce([{ id: firstProfileId }, { id: secondProfileId }])
      .mockResolvedValueOnce([
        { id: firstProfileId, dateOfBirth: new Date("2015-01-01") },
        { id: secondProfileId, dateOfBirth: new Date("2015-01-01") }
      ]);
    mockPrisma.relationship.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);

    await expect(
      createRelationship({
        personId: firstProfileId,
        relatedPersonId: secondProfileId,
        relationshipType: "mother"
      })
    ).rejects.toThrow("Parent must be older than child.");
  });

  it("allows a parent relationship when the child date of birth is missing", async () => {
    mockSuccessfulRelationshipCreate();
    mockPrisma.profile.findMany
      .mockResolvedValueOnce([{ id: firstProfileId }, { id: secondProfileId }])
      .mockResolvedValueOnce([
        { id: firstProfileId, dateOfBirth: null },
        { id: secondProfileId, dateOfBirth: new Date("1990-01-01") }
      ]);
    mockPrisma.relationship.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);

    await expect(
      createRelationship({
        personId: firstProfileId,
        relatedPersonId: secondProfileId,
        relationshipType: "father"
      })
    ).resolves.toEqual(expect.objectContaining({ id: "relationship-created" }));
  });

  it("allows a parent relationship when the parent date of birth is missing", async () => {
    mockSuccessfulRelationshipCreate();
    mockPrisma.profile.findMany
      .mockResolvedValueOnce([{ id: firstProfileId }, { id: secondProfileId }])
      .mockResolvedValueOnce([
        { id: firstProfileId, dateOfBirth: new Date("2015-01-01") },
        { id: secondProfileId, dateOfBirth: null }
      ]);
    mockPrisma.relationship.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);

    await expect(
      createRelationship({
        personId: firstProfileId,
        relatedPersonId: secondProfileId,
        relationshipType: "mother"
      })
    ).resolves.toEqual(expect.objectContaining({ id: "relationship-created" }));
  });

  it("returns a parent age warning when the parent is less than twelve years older", async () => {
    mockPrisma.profile.findMany
      .mockResolvedValueOnce([{ id: firstProfileId }, { id: secondProfileId }])
      .mockResolvedValueOnce([
        { id: firstProfileId, dateOfBirth: new Date("2015-01-01") },
        { id: secondProfileId, dateOfBirth: new Date("2010-01-01") }
      ]);
    mockPrisma.relationship.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);

    try {
      await createRelationship({
        personId: firstProfileId,
        relatedPersonId: secondProfileId,
        relationshipType: "father"
      });
      throw new Error("Expected parent age warning");
    } catch (error) {
      expect(error).toBeInstanceOf(RelationshipParentAgeWarningError);
      expect(error).toHaveProperty("code", "PARENT_AGE_WARNING");
      expect(error).toHaveProperty("requiresConfirmation", true);
    }
  });

  it("allows a confirmed parent age warning relationship", async () => {
    mockSuccessfulRelationshipCreate();
    mockPrisma.profile.findMany
      .mockResolvedValueOnce([{ id: firstProfileId }, { id: secondProfileId }])
      .mockResolvedValueOnce([
        { id: firstProfileId, dateOfBirth: new Date("2015-01-01") },
        { id: secondProfileId, dateOfBirth: new Date("2010-01-01") }
      ]);
    mockPrisma.relationship.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);

    await expect(
      createRelationship({
        personId: firstProfileId,
        relatedPersonId: secondProfileId,
        relationshipType: "father",
        confirmParentAgeWarning: true
      })
    ).resolves.toEqual(expect.objectContaining({ id: "relationship-created" }));
  });

  it("does not run parent age validation for spouse relationships", async () => {
    mockPrisma.profile.findMany.mockResolvedValueOnce([
      { id: firstProfileId },
      { id: secondProfileId }
    ]);
    mockPrisma.relationship.findFirst.mockResolvedValueOnce(null);
    mockPrisma.relationship.create.mockResolvedValueOnce({
      id: "spouse-created",
      personId: firstProfileId,
      relatedPersonId: secondProfileId,
      relationshipType: "spouse",
      notes: null,
      createdAt: new Date("2026-01-01")
    });

    await expect(
      createRelationship({
        personId: firstProfileId,
        relatedPersonId: secondProfileId,
        relationshipType: "spouse"
      })
    ).resolves.toEqual(expect.objectContaining({ id: "spouse-created" }));

    expect(mockPrisma.profile.findMany).toHaveBeenCalledTimes(1);
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
