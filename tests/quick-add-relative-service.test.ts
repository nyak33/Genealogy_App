import { RelationshipType } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockDb = vi.hoisted(() => {
  const transaction = {
    profile: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn()
    },
    relationship: {
      create: vi.fn(),
      findFirst: vi.fn()
    }
  };

  return {
    transaction,
    prisma: {
      $transaction: vi.fn((callback) => callback(transaction)),
      profile: {
        create: vi.fn(),
        findMany: vi.fn(),
        findUnique: vi.fn()
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
  quickAddRelative,
  QuickAddDuplicateWarningError
} = await import("@/lib/services/quick-add-relative-service");
const { ProfileInputError } = await import("@/lib/services/profile-service");
const { RelationshipParentAgeWarningError } = await import(
  "@/lib/services/relationship-service"
);

const currentProfileId = "00000000-0000-4000-8000-000000000001";
const newProfileId = "00000000-0000-4000-8000-000000000002";

function currentProfile(gender: string | null = "male", isMerged = false) {
  return {
    id: currentProfileId,
    gender,
    isMerged
  };
}

function createdProfile(fullName = "New Relative") {
  return {
    id: newProfileId,
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
    mergedIntoProfile: null,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01")
  };
}

function relationship(relationshipType: RelationshipType) {
  return {
    id: "relationship-created",
    personId: currentProfileId,
    relatedPersonId: newProfileId,
    relationshipType,
    notes: null,
    createdAt: new Date("2026-01-01")
  };
}

function quickAddInput(
  relationshipType: "father" | "mother" | "spouse" | "child",
  overrides = {}
) {
  return {
    relationshipType,
    profile: {
      fullName: "New Relative"
    },
    ...overrides
  };
}

function mockCurrentProfile(gender: string | null = "male", isMerged = false) {
  mockPrisma.profile.findUnique.mockResolvedValueOnce(
    currentProfile(gender, isMerged)
  );
  mockTransaction.profile.findUnique.mockResolvedValueOnce(
    currentProfile(gender, isMerged)
  );
}

function mockNoDuplicates() {
  mockPrisma.profile.findMany.mockResolvedValueOnce([]);
}

function mockSuccessfulCreate({
  gender = "male",
  relationshipType = RelationshipType.father,
  profileRows = [
    { id: currentProfileId, isMerged: false },
    { id: newProfileId, isMerged: false }
  ],
  ageRows = [
    { id: currentProfileId, dateOfBirth: null },
    { id: newProfileId, dateOfBirth: null }
  ]
}: {
  gender?: string | null;
  relationshipType?: RelationshipType;
  profileRows?: unknown[];
  ageRows?: unknown[];
} = {}) {
  mockCurrentProfile(gender);
  mockNoDuplicates();
  mockTransaction.profile.create.mockResolvedValueOnce(createdProfile());
  mockTransaction.profile.findMany
    .mockResolvedValueOnce(profileRows)
    .mockResolvedValueOnce(ageRows);
  mockTransaction.relationship.findFirst.mockResolvedValue(null);
  mockTransaction.relationship.create.mockResolvedValueOnce(
    relationship(relationshipType)
  );
}

describe("quick add relative service", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockPrisma.$transaction.mockImplementation((callback) =>
      callback(mockTransaction)
    );
  });

  it("quick add father creates profile and father relationship", async () => {
    mockSuccessfulCreate({ relationshipType: RelationshipType.father });

    const result = await quickAddRelative(
      currentProfileId,
      quickAddInput("father")
    );

    expect(mockTransaction.profile.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          fullName: "New Relative"
        })
      })
    );
    expect(mockTransaction.relationship.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          personId: currentProfileId,
          relatedPersonId: newProfileId,
          relationshipType: RelationshipType.father
        })
      })
    );
    expect(result.profile.id).toBe(newProfileId);
  });

  it("quick add mother creates profile and mother relationship", async () => {
    mockSuccessfulCreate({ relationshipType: RelationshipType.mother });

    await quickAddRelative(currentProfileId, quickAddInput("mother"));

    expect(mockTransaction.relationship.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          personId: currentProfileId,
          relatedPersonId: newProfileId,
          relationshipType: RelationshipType.mother
        })
      })
    );
  });

  it("quick add spouse creates profile and spouse relationship", async () => {
    mockSuccessfulCreate({ relationshipType: RelationshipType.spouse });

    await quickAddRelative(currentProfileId, quickAddInput("spouse"));

    expect(mockTransaction.relationship.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          personId: currentProfileId,
          relatedPersonId: newProfileId,
          relationshipType: RelationshipType.spouse
        })
      })
    );
  });

  it("quick add child from male profile creates child to father relationship", async () => {
    mockSuccessfulCreate({
      gender: "male",
      relationshipType: RelationshipType.father
    });

    await quickAddRelative(currentProfileId, quickAddInput("child"));

    expect(mockTransaction.relationship.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          personId: newProfileId,
          relatedPersonId: currentProfileId,
          relationshipType: RelationshipType.father
        })
      })
    );
  });

  it("quick add child from female profile creates child to mother relationship", async () => {
    mockSuccessfulCreate({
      gender: "female",
      relationshipType: RelationshipType.mother
    });

    await quickAddRelative(currentProfileId, quickAddInput("child"));

    expect(mockTransaction.relationship.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          personId: newProfileId,
          relatedPersonId: currentProfileId,
          relationshipType: RelationshipType.mother
        })
      })
    );
  });

  it("quick add child conversion applies parent death date validation", async () => {
    mockSuccessfulCreate({
      gender: "male",
      relationshipType: RelationshipType.father,
      ageRows: [
        {
          id: newProfileId,
          dateOfBirth: new Date("2015-01-01"),
          dateOfDeath: null
        },
        {
          id: currentProfileId,
          dateOfBirth: new Date("1960-01-01"),
          dateOfDeath: new Date("1960-12-20")
        }
      ]
    });

    await expect(
      quickAddRelative(currentProfileId, quickAddInput("child"))
    ).rejects.toThrow(
      "Father death date is too early to be the biological father of this child."
    );

    expect(mockTransaction.relationship.create).not.toHaveBeenCalled();
  });

  it("unknown gender child quick add requires childParentRole", async () => {
    mockCurrentProfile("unknown");
    mockNoDuplicates();
    mockTransaction.profile.create.mockResolvedValueOnce(createdProfile());

    await expect(
      quickAddRelative(currentProfileId, quickAddInput("child"))
    ).rejects.toBeInstanceOf(ProfileInputError);

    expect(mockTransaction.relationship.create).not.toHaveBeenCalled();
  });

  it("duplicate warning returns before profile creation", async () => {
    mockPrisma.profile.findUnique.mockResolvedValueOnce(currentProfile());
    mockPrisma.profile.findMany.mockResolvedValueOnce([
      {
        id: "duplicate-profile",
        fullName: "New Relative",
        dateOfBirth: null,
        dateOfDeath: null
      }
    ]);

    await expect(
      quickAddRelative(currentProfileId, quickAddInput("father"))
    ).rejects.toBeInstanceOf(QuickAddDuplicateWarningError);

    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    expect(mockTransaction.profile.create).not.toHaveBeenCalled();
  });

  it("confirmed duplicate creation proceeds", async () => {
    mockCurrentProfile();
    mockTransaction.profile.create.mockResolvedValueOnce(createdProfile());
    mockTransaction.profile.findMany
      .mockResolvedValueOnce([
        { id: currentProfileId, isMerged: false },
        { id: newProfileId, isMerged: false }
      ])
      .mockResolvedValueOnce([
        { id: currentProfileId, dateOfBirth: null },
        { id: newProfileId, dateOfBirth: null }
      ]);
    mockTransaction.relationship.findFirst.mockResolvedValue(null);
    mockTransaction.relationship.create.mockResolvedValueOnce(
      relationship(RelationshipType.father)
    );

    await quickAddRelative(
      currentProfileId,
      quickAddInput("father", {
        confirmCreateDifferentPerson: true
      })
    );

    expect(mockPrisma.profile.findMany).not.toHaveBeenCalled();
    expect(mockTransaction.profile.create).toHaveBeenCalled();
  });

  it("relationship failure rolls back profile creation through transaction", async () => {
    mockCurrentProfile();
    mockNoDuplicates();
    mockTransaction.profile.create.mockResolvedValueOnce(createdProfile());
    mockTransaction.profile.findMany.mockResolvedValueOnce([
      { id: currentProfileId, isMerged: false },
      { id: newProfileId, isMerged: false }
    ]);
    mockTransaction.relationship.findFirst.mockResolvedValue(null);
    mockTransaction.relationship.create.mockRejectedValueOnce(
      new Error("relationship create failed")
    );

    await expect(
      quickAddRelative(currentProfileId, quickAddInput("spouse"))
    ).rejects.toThrow("relationship create failed");

    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mockTransaction.profile.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.profile.create).not.toHaveBeenCalled();
  });

  it("parent-child age warning is preserved", async () => {
    mockSuccessfulCreate({
      relationshipType: RelationshipType.father,
      ageRows: [
        { id: currentProfileId, dateOfBirth: new Date("2015-01-01") },
        { id: newProfileId, dateOfBirth: new Date("2010-01-01") }
      ]
    });

    await expect(
      quickAddRelative(currentProfileId, quickAddInput("father"))
    ).rejects.toBeInstanceOf(RelationshipParentAgeWarningError);
  });

  it("merged current profile is rejected", async () => {
    mockPrisma.profile.findUnique.mockResolvedValueOnce(
      currentProfile("male", true)
    );

    await expect(
      quickAddRelative(currentProfileId, quickAddInput("father"))
    ).rejects.toBeInstanceOf(ProfileInputError);

    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });
});
