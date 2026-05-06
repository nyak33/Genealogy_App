import { RelationshipType } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockDb = vi.hoisted(() => {
  const transaction = {
    profile: {
      findMany: vi.fn(),
      update: vi.fn()
    },
    relationship: {
      delete: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn()
    }
  };

  return {
    transaction,
    prisma: {
      $transaction: vi.fn((callback) => callback(transaction)),
      profile: {
        findMany: vi.fn()
      },
      relationship: {
        findMany: vi.fn()
      }
    }
  };
});

const mockPrisma = mockDb.prisma;
const mockTransaction = mockDb.transaction;

vi.mock("@/lib/db", () => ({
  prisma: mockPrisma
}));

const {
  mergeProfiles,
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
    mockPrisma.$transaction.mockImplementation((callback) =>
      callback(mockTransaction)
    );
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

  it("merge blocks self-merge", async () => {
    await expect(mergeProfiles(primaryId, primaryId)).rejects.toThrow(
      ProfileMergeInputError
    );

    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mockTransaction.profile.findMany).not.toHaveBeenCalled();
  });

  it("merge blocks missing primary profile", async () => {
    mockTransaction.profile.findMany.mockResolvedValueOnce([
      profile(duplicateId, "Duplicate Person")
    ]);

    await expect(mergeProfiles(primaryId, duplicateId)).rejects.toThrow(
      ProfileMergeNotFoundError
    );
  });

  it("merge blocks missing duplicate profile", async () => {
    mockTransaction.profile.findMany.mockResolvedValueOnce([
      profile(primaryId, "Primary Person")
    ]);

    await expect(mergeProfiles(primaryId, duplicateId)).rejects.toThrow(
      ProfileMergeNotFoundError
    );
  });

  it("merge blocks an already merged primary profile", async () => {
    mockMergeProfiles({
      primary: profile(primaryId, "Primary Person", {
        isMerged: true,
        mergedIntoProfileId: fatherId,
        mergedAt: new Date("2026-01-01")
      })
    });

    await expect(mergeProfiles(primaryId, duplicateId)).rejects.toThrow(
      ProfileMergeConflictError
    );
  });

  it("merge blocks an already merged duplicate profile", async () => {
    mockMergeProfiles({
      duplicate: profile(duplicateId, "Duplicate Person", {
        isMerged: true,
        mergedIntoProfileId: primaryId,
        mergedAt: new Date("2026-01-01")
      })
    });

    await expect(mergeProfiles(primaryId, duplicateId)).rejects.toThrow(
      ProfileMergeConflictError
    );
  });

  it("merge copies missing primary fields", async () => {
    const primary = profile(primaryId, "Primary Person");
    const duplicate = profile(duplicateId, "Duplicate Person", {
      dateOfBirth: new Date("1980-03-20"),
      gender: "female",
      notes: "Duplicate notes"
    });
    mockMergeProfiles({ primary, duplicate });
    mockMergeRelationships();
    mockProfileUpdates({ primary, duplicate });

    const result = await mergeProfiles(primaryId, duplicateId);

    expect(mockTransaction.profile.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: primaryId },
        data: expect.objectContaining({
          dateOfBirth: new Date("1980-03-20"),
          gender: "female",
          notes: "Duplicate notes"
        })
      })
    );
    expect(result.fieldsCopied).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "dateOfBirth" }),
        expect.objectContaining({ field: "gender" }),
        expect.objectContaining({ field: "notes" })
      ])
    );
  });

  it("merge does not overwrite conflicting fields", async () => {
    const primary = profile(primaryId, "Primary Person", {
      dateOfBirth: new Date("1980-03-20"),
      gender: "male"
    });
    const duplicate = profile(duplicateId, "Duplicate Person", {
      dateOfBirth: new Date("1981-03-20"),
      gender: "female",
      notes: "Copy this note"
    });
    mockMergeProfiles({ primary, duplicate });
    mockMergeRelationships();
    mockProfileUpdates({ primary, duplicate });

    const result = await mergeProfiles(primaryId, duplicateId);
    const primaryUpdateCall = mockTransaction.profile.update.mock.calls.find(
      ([input]) => input.where.id === primaryId
    );

    expect(primaryUpdateCall?.[0].data).toEqual({ notes: "Copy this note" });
    expect(result.fieldConflicts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "dateOfBirth" }),
        expect.objectContaining({ field: "gender" })
      ])
    );
  });

  it("merge updates relationship where duplicate is personId", async () => {
    const primary = profile(primaryId, "Primary Child");
    const duplicate = profile(duplicateId, "Duplicate Child");
    const father = profile(fatherId, "Father");
    const duplicateRelationship = relationship({
      id: "relationship-1",
      person: duplicate,
      relatedPerson: father,
      relationshipType: RelationshipType.father
    });
    mockMergeProfiles({ primary, duplicate });
    mockMergeRelationships({ duplicateRelationships: [duplicateRelationship] });
    mockProfileUpdates({ primary, duplicate });

    const result = await mergeProfiles(primaryId, duplicateId);

    expect(mockTransaction.relationship.update).toHaveBeenCalledWith({
      where: { id: "relationship-1" },
      data: {
        personId: primaryId,
        relatedPersonId: fatherId
      }
    });
    expect(result.relationshipsMoved[0]).toEqual(
      expect.objectContaining({ relationshipId: "relationship-1" })
    );
  });

  it("merge updates relationship where duplicate is relatedPersonId", async () => {
    const primary = profile(primaryId, "Primary Father");
    const duplicate = profile(duplicateId, "Duplicate Father");
    const child = profile(childId, "Child");
    const duplicateRelationship = relationship({
      id: "relationship-1",
      person: child,
      relatedPerson: duplicate,
      relationshipType: RelationshipType.father
    });
    mockMergeProfiles({ primary, duplicate });
    mockMergeRelationships({ duplicateRelationships: [duplicateRelationship] });
    mockProfileUpdates({ primary, duplicate });

    await mergeProfiles(primaryId, duplicateId);

    expect(mockTransaction.relationship.update).toHaveBeenCalledWith({
      where: { id: "relationship-1" },
      data: {
        personId: childId,
        relatedPersonId: primaryId
      }
    });
  });

  it("merge deletes exact redundant duplicate relationship rows", async () => {
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
    mockMergeProfiles({ primary, duplicate });
    mockMergeRelationships({
      duplicateRelationships: [duplicateRelationship],
      existingRelationships: [existingRelationship]
    });
    mockProfileUpdates({ primary, duplicate });

    const result = await mergeProfiles(primaryId, duplicateId);

    expect(mockTransaction.relationship.delete).toHaveBeenCalledWith({
      where: { id: "duplicate-relationship" }
    });
    expect(mockTransaction.relationship.update).not.toHaveBeenCalled();
    expect(result.relationshipsDeletedAsRedundant[0]).toEqual(
      expect.objectContaining({ relationshipId: "duplicate-relationship" })
    );
  });

  it("merge skips self-relationship replacements", async () => {
    const primary = profile(primaryId, "Primary Person");
    const duplicate = profile(duplicateId, "Duplicate Person");
    const duplicateRelationship = relationship({
      id: "self-replacement",
      person: duplicate,
      relatedPerson: primary,
      relationshipType: RelationshipType.spouse
    });
    mockMergeProfiles({ primary, duplicate });
    mockMergeRelationships({ duplicateRelationships: [duplicateRelationship] });
    mockProfileUpdates({ primary, duplicate });

    const result = await mergeProfiles(primaryId, duplicateId);

    expect(mockTransaction.relationship.update).not.toHaveBeenCalled();
    expect(result.relationshipsSkipped[0]).toEqual(
      expect.objectContaining({ reason: "self_relationship" })
    );
  });

  it("merge skips same-pair different-role conflicts", async () => {
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
    mockMergeProfiles({ primary, duplicate });
    mockMergeRelationships({
      duplicateRelationships: [duplicateRelationship],
      existingRelationships: [existingRelationship]
    });
    mockProfileUpdates({ primary, duplicate });

    const result = await mergeProfiles(primaryId, duplicateId);

    expect(mockTransaction.relationship.update).not.toHaveBeenCalled();
    expect(result.relationshipsSkipped[0]).toEqual(
      expect.objectContaining({
        reason: "same_pair_different_role_conflict"
      })
    );
  });

  it("merge skips father or mother conflicts", async () => {
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
    mockMergeProfiles({ primary, duplicate });
    mockMergeRelationships({
      duplicateRelationships: [duplicateRelationship],
      existingRelationships: [existingRelationship]
    });
    mockProfileUpdates({ primary, duplicate });

    const result = await mergeProfiles(primaryId, duplicateId);

    expect(mockTransaction.relationship.update).not.toHaveBeenCalled();
    expect(result.relationshipsSkipped[0]).toEqual(
      expect.objectContaining({ reason: "father_conflict" })
    );
  });

  it("merge skips impossible parent-age moves", async () => {
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
    mockMergeProfiles({ primary, duplicate });
    mockMergeRelationships({ duplicateRelationships: [duplicateRelationship] });
    mockProfileUpdates({ primary, duplicate });

    const result = await mergeProfiles(primaryId, duplicateId);

    expect(mockTransaction.relationship.update).not.toHaveBeenCalled();
    expect(result.relationshipsSkipped[0]).toEqual(
      expect.objectContaining({ reason: "impossible_parent_age" })
    );
  });

  it("merge keeps under-12 parent-age warnings but moves the relationship", async () => {
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
    mockMergeProfiles({ primary, duplicate });
    mockMergeRelationships({ duplicateRelationships: [duplicateRelationship] });
    mockProfileUpdates({ primary, duplicate });

    const result = await mergeProfiles(primaryId, duplicateId);

    expect(mockTransaction.relationship.update).toHaveBeenCalledWith({
      where: { id: "young-father" },
      data: {
        personId: primaryId,
        relatedPersonId: fatherId
      }
    });
    expect(result.warnings[0]).toEqual(
      expect.objectContaining({ code: "PARENT_AGE_WARNING" })
    );
  });

  it("merge marks duplicate profile as merged", async () => {
    const primary = profile(primaryId, "Primary Person");
    const duplicate = profile(duplicateId, "Duplicate Person");
    mockMergeProfiles({ primary, duplicate });
    mockMergeRelationships();
    mockProfileUpdates({ primary, duplicate });

    const result = await mergeProfiles(primaryId, duplicateId);
    const duplicateUpdateCall = mockTransaction.profile.update.mock.calls.find(
      ([input]) => input.where.id === duplicateId
    );

    expect(duplicateUpdateCall?.[0].data).toEqual({
      isMerged: true,
      mergedIntoProfileId: primaryId,
      mergedAt: expect.any(Date)
    });
    expect(result.duplicateProfile).toEqual(
      expect.objectContaining({
        id: duplicateId,
        isMerged: true,
        mergedIntoProfileId: primaryId,
        mergedAt: expect.any(Date)
      })
    );
  });

  it("merge uses a transaction", async () => {
    const primary = profile(primaryId, "Primary Person");
    const duplicate = profile(duplicateId, "Duplicate Person");
    mockMergeProfiles({ primary, duplicate });
    mockMergeRelationships();
    mockProfileUpdates({ primary, duplicate });

    await mergeProfiles(primaryId, duplicateId);

    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
  });
});

function mockMergeProfiles({
  primary = profile(primaryId, "Primary Person"),
  duplicate = profile(duplicateId, "Duplicate Person")
}: {
  primary?: TestProfile;
  duplicate?: TestProfile;
} = {}) {
  mockTransaction.profile.findMany.mockResolvedValueOnce([primary, duplicate]);
}

function mockMergeRelationships({
  duplicateRelationships = [],
  existingRelationships = []
}: {
  duplicateRelationships?: ReturnType<typeof relationship>[];
  existingRelationships?: ReturnType<typeof relationship>[];
} = {}) {
  mockTransaction.relationship.findMany
    .mockResolvedValueOnce(duplicateRelationships)
    .mockResolvedValueOnce(existingRelationships);
}

function mockProfileUpdates({
  primary,
  duplicate
}: {
  primary: TestProfile;
  duplicate: TestProfile;
}) {
  mockTransaction.profile.update.mockImplementation(async ({ where, data }) => {
    if (where.id === primary.id) {
      return {
        ...primary,
        ...data
      };
    }

    return {
      ...duplicate,
      ...data
    };
  });
  mockTransaction.relationship.update.mockResolvedValue({});
  mockTransaction.relationship.delete.mockResolvedValue({});
}
