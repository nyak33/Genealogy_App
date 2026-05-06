import { RelationshipType } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  profile: {
    findMany: vi.fn()
  },
  relationship: {
    findMany: vi.fn()
  }
}));

vi.mock("@/lib/db", () => ({
  prisma: mockPrisma
}));

const {
  previewProfileMerge,
  ProfileMergeConflictError,
  ProfileMergeInputError,
  ProfileMergeNotFoundError
} = await import("@/lib/services/profile-merge-service");

const primaryId = "00000000-0000-4000-8000-000000000001";
const duplicateId = "00000000-0000-4000-8000-000000000002";
const fatherId = "00000000-0000-4000-8000-000000000003";
const motherId = "00000000-0000-4000-8000-000000000004";
const childId = "00000000-0000-4000-8000-000000000005";

type TestProfile = {
  id: string;
  fullName: string;
  normalizedName: string;
  dateOfBirth: Date | null;
  dateOfDeath: Date | null;
  gender: string | null;
  notes: string | null;
  isDeceased: boolean;
  isMerged: boolean;
  mergedIntoProfileId: string | null;
  mergedAt: Date | null;
};

function profile(id: string, fullName: string, overrides: Partial<TestProfile> = {}) {
  return {
    id,
    fullName,
    normalizedName: fullName.toLowerCase(),
    dateOfBirth: null,
    dateOfDeath: null,
    gender: null,
    notes: null,
    isDeceased: false,
    isMerged: false,
    mergedIntoProfileId: null,
    mergedAt: null,
    ...overrides
  };
}

function relationship({
  id,
  person,
  relatedPerson,
  relationshipType
}: {
  id: string;
  person: TestProfile;
  relatedPerson: TestProfile;
  relationshipType: RelationshipType;
}) {
  return {
    id,
    personId: person.id,
    relatedPersonId: relatedPerson.id,
    relationshipType,
    notes: null,
    createdAt: new Date("2026-01-01"),
    person,
    relatedPerson
  };
}

function mockProfiles({
  primary = profile(primaryId, "Primary Person"),
  duplicate = profile(duplicateId, "Duplicate Person")
}: {
  primary?: TestProfile;
  duplicate?: TestProfile;
} = {}) {
  mockPrisma.profile.findMany.mockResolvedValueOnce([primary, duplicate]);
}

function mockRelationships({
  duplicateRelationships = [],
  existingRelationships = []
}: {
  duplicateRelationships?: ReturnType<typeof relationship>[];
  existingRelationships?: ReturnType<typeof relationship>[];
} = {}) {
  mockPrisma.relationship.findMany
    .mockResolvedValueOnce(duplicateRelationships)
    .mockResolvedValueOnce(existingRelationships);
}

describe("profile merge service", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("blocks self-merge", async () => {
    await expect(previewProfileMerge(primaryId, primaryId)).rejects.toThrow(
      ProfileMergeInputError
    );

    expect(mockPrisma.profile.findMany).not.toHaveBeenCalled();
  });

  it("blocks missing primary profile", async () => {
    mockPrisma.profile.findMany.mockResolvedValueOnce([
      profile(duplicateId, "Duplicate Person")
    ]);

    await expect(previewProfileMerge(primaryId, duplicateId)).rejects.toThrow(
      ProfileMergeNotFoundError
    );
  });

  it("blocks missing duplicate profile", async () => {
    mockPrisma.profile.findMany.mockResolvedValueOnce([
      profile(primaryId, "Primary Person")
    ]);

    await expect(previewProfileMerge(primaryId, duplicateId)).rejects.toThrow(
      ProfileMergeNotFoundError
    );
  });

  it("blocks an already merged primary profile", async () => {
    mockProfiles({
      primary: profile(primaryId, "Primary Person", {
        isMerged: true,
        mergedIntoProfileId: fatherId,
        mergedAt: new Date("2026-01-01")
      })
    });

    await expect(previewProfileMerge(primaryId, duplicateId)).rejects.toThrow(
      ProfileMergeConflictError
    );
  });

  it("blocks an already merged duplicate profile", async () => {
    mockProfiles({
      duplicate: profile(duplicateId, "Duplicate Person", {
        isMerged: true,
        mergedIntoProfileId: primaryId,
        mergedAt: new Date("2026-01-01")
      })
    });

    await expect(previewProfileMerge(primaryId, duplicateId)).rejects.toThrow(
      ProfileMergeConflictError
    );
  });

  it("lists missing primary fields in fieldsToCopy", async () => {
    mockProfiles({
      primary: profile(primaryId, "Primary Person"),
      duplicate: profile(duplicateId, "Duplicate Person", {
        dateOfBirth: new Date("1980-03-20"),
        gender: "female",
        notes: "Duplicate notes"
      })
    });
    mockRelationships();

    const preview = await previewProfileMerge(primaryId, duplicateId);

    expect(preview.fieldsToCopy).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "dateOfBirth" }),
        expect.objectContaining({ field: "gender" }),
        expect.objectContaining({ field: "notes" })
      ])
    );
  });

  it("lists conflicting fields in fieldConflicts", async () => {
    mockProfiles({
      primary: profile(primaryId, "Primary Person", {
        dateOfBirth: new Date("1980-03-20"),
        gender: "male"
      }),
      duplicate: profile(duplicateId, "Duplicate Person", {
        dateOfBirth: new Date("1981-03-20"),
        gender: "female"
      })
    });
    mockRelationships();

    const preview = await previewProfileMerge(primaryId, duplicateId);

    expect(preview.fieldConflicts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "fullName" }),
        expect.objectContaining({ field: "dateOfBirth" }),
        expect.objectContaining({ field: "gender" })
      ])
    );
  });

  it("lists a relationship where duplicate is personId as safe to move", async () => {
    const primary = profile(primaryId, "Primary Child");
    const duplicate = profile(duplicateId, "Duplicate Child");
    const father = profile(fatherId, "Father");
    const duplicateRelationship = relationship({
      id: "relationship-1",
      person: duplicate,
      relatedPerson: father,
      relationshipType: RelationshipType.father
    });
    mockProfiles({ primary, duplicate });
    mockRelationships({ duplicateRelationships: [duplicateRelationship] });

    const preview = await previewProfileMerge(primaryId, duplicateId);

    expect(preview.relationshipsToMove[0]).toEqual(
      expect.objectContaining({
        relationshipId: "relationship-1",
        replacement: {
          personId: primaryId,
          relatedPersonId: fatherId,
          relationshipType: RelationshipType.father
        }
      })
    );
  });

  it("lists a relationship where duplicate is relatedPersonId as safe to move", async () => {
    const primary = profile(primaryId, "Primary Father");
    const duplicate = profile(duplicateId, "Duplicate Father");
    const child = profile(childId, "Child");
    const duplicateRelationship = relationship({
      id: "relationship-1",
      person: child,
      relatedPerson: duplicate,
      relationshipType: RelationshipType.father
    });
    mockProfiles({ primary, duplicate });
    mockRelationships({ duplicateRelationships: [duplicateRelationship] });

    const preview = await previewProfileMerge(primaryId, duplicateId);

    expect(preview.relationshipsToMove[0]).toEqual(
      expect.objectContaining({
        relationshipId: "relationship-1",
        replacement: {
          personId: childId,
          relatedPersonId: primaryId,
          relationshipType: RelationshipType.father
        }
      })
    );
  });

  it("lists exact duplicate replacement relationships as redundant deletes", async () => {
    const primary = profile(primaryId, "Primary Child");
    const duplicate = profile(duplicateId, "Duplicate Child");
    const father = profile(fatherId, "Father");
    const duplicateRelationship = relationship({
      id: "duplicate-relationship",
      person: duplicate,
      relatedPerson: father,
      relationshipType: RelationshipType.father
    });
    const existingRelationship = relationship({
      id: "existing-relationship",
      person: primary,
      relatedPerson: father,
      relationshipType: RelationshipType.father
    });
    mockProfiles({ primary, duplicate });
    mockRelationships({
      duplicateRelationships: [duplicateRelationship],
      existingRelationships: [existingRelationship]
    });

    const preview = await previewProfileMerge(primaryId, duplicateId);

    expect(preview.relationshipsToDeleteAsRedundant[0]).toEqual(
      expect.objectContaining({ relationshipId: "duplicate-relationship" })
    );
    expect(preview.relationshipsToMove).toEqual([]);
  });

  it("skips relationship moves that would create a self-relationship", async () => {
    const primary = profile(primaryId, "Primary Person");
    const duplicate = profile(duplicateId, "Duplicate Person");
    const duplicateRelationship = relationship({
      id: "self-replacement",
      person: duplicate,
      relatedPerson: primary,
      relationshipType: RelationshipType.spouse
    });
    mockProfiles({ primary, duplicate });
    mockRelationships({ duplicateRelationships: [duplicateRelationship] });

    const preview = await previewProfileMerge(primaryId, duplicateId);

    expect(preview.relationshipsToSkip[0]).toEqual(
      expect.objectContaining({
        relationshipId: "self-replacement",
        reason: "self_relationship"
      })
    );
  });

  it("skips same-pair different-role conflicts", async () => {
    const primary = profile(primaryId, "Primary Person");
    const duplicate = profile(duplicateId, "Duplicate Person");
    const father = profile(fatherId, "Father");
    const duplicateRelationship = relationship({
      id: "duplicate-father",
      person: duplicate,
      relatedPerson: father,
      relationshipType: RelationshipType.father
    });
    const existingRelationship = relationship({
      id: "existing-spouse",
      person: primary,
      relatedPerson: father,
      relationshipType: RelationshipType.spouse
    });
    mockProfiles({ primary, duplicate });
    mockRelationships({
      duplicateRelationships: [duplicateRelationship],
      existingRelationships: [existingRelationship]
    });

    const preview = await previewProfileMerge(primaryId, duplicateId);

    expect(preview.relationshipsToSkip[0]).toEqual(
      expect.objectContaining({
        relationshipId: "duplicate-father",
        reason: "same_pair_different_role_conflict"
      })
    );
  });

  it("skips father or mother conflicts", async () => {
    const primary = profile(primaryId, "Primary Child");
    const duplicate = profile(duplicateId, "Duplicate Child");
    const father = profile(fatherId, "Father");
    const otherFather = profile(motherId, "Other Father");
    const duplicateRelationship = relationship({
      id: "duplicate-father",
      person: duplicate,
      relatedPerson: father,
      relationshipType: RelationshipType.father
    });
    const existingRelationship = relationship({
      id: "existing-father",
      person: primary,
      relatedPerson: otherFather,
      relationshipType: RelationshipType.father
    });
    mockProfiles({ primary, duplicate });
    mockRelationships({
      duplicateRelationships: [duplicateRelationship],
      existingRelationships: [existingRelationship]
    });

    const preview = await previewProfileMerge(primaryId, duplicateId);

    expect(preview.relationshipsToSkip[0]).toEqual(
      expect.objectContaining({
        relationshipId: "duplicate-father",
        reason: "father_conflict"
      })
    );
  });

  it("skips impossible parent-age moves", async () => {
    const primary = profile(primaryId, "Primary Child", {
      dateOfBirth: new Date("2015-01-01")
    });
    const duplicate = profile(duplicateId, "Duplicate Child");
    const father = profile(fatherId, "Father", {
      dateOfBirth: new Date("2016-01-01")
    });
    const duplicateRelationship = relationship({
      id: "bad-age-father",
      person: duplicate,
      relatedPerson: father,
      relationshipType: RelationshipType.father
    });
    mockProfiles({ primary, duplicate });
    mockRelationships({ duplicateRelationships: [duplicateRelationship] });

    const preview = await previewProfileMerge(primaryId, duplicateId);

    expect(preview.relationshipsToSkip[0]).toEqual(
      expect.objectContaining({
        relationshipId: "bad-age-father",
        reason: "impossible_parent_age"
      })
    );
  });

  it("warns, but does not skip, under-12 parent-age moves", async () => {
    const primary = profile(primaryId, "Primary Child", {
      dateOfBirth: new Date("2015-01-01")
    });
    const duplicate = profile(duplicateId, "Duplicate Child");
    const father = profile(fatherId, "Young Father", {
      dateOfBirth: new Date("2010-01-01")
    });
    const duplicateRelationship = relationship({
      id: "young-father",
      person: duplicate,
      relatedPerson: father,
      relationshipType: RelationshipType.father
    });
    mockProfiles({ primary, duplicate });
    mockRelationships({ duplicateRelationships: [duplicateRelationship] });

    const preview = await previewProfileMerge(primaryId, duplicateId);

    expect(preview.relationshipsToMove[0]).toEqual(
      expect.objectContaining({ relationshipId: "young-father" })
    );
    expect(preview.warnings[0]).toEqual(
      expect.objectContaining({
        relationshipId: "young-father",
        code: "PARENT_AGE_WARNING"
      })
    );
  });
});
