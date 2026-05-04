import { RelationshipType, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { CreateRelationshipInput } from "@/lib/validators/relationship";

export class RelationshipInputError extends Error {
  status = 400;
}

export class RelationshipNotFoundError extends Error {
  status = 404;
}

export class RelationshipConflictError extends Error {
  status = 409;
}

const relationshipProfileSelect = {
  id: true,
  fullName: true,
  dateOfBirth: true,
  dateOfDeath: true
} satisfies Prisma.ProfileSelect;

const relationshipSelect = {
  id: true,
  personId: true,
  relatedPersonId: true,
  relationshipType: true,
  notes: true,
  createdAt: true
} satisfies Prisma.RelationshipSelect;

export type RelationshipProfileLink = {
  relationshipId: string;
  relationshipType: RelationshipType;
  profile: {
    id: string;
    fullName: string;
    dateOfBirth: Date | null;
    dateOfDeath: Date | null;
  };
};

export type ProfileRelationships = {
  father: RelationshipProfileLink[];
  mother: RelationshipProfileLink[];
  spouses: RelationshipProfileLink[];
  children: RelationshipProfileLink[];
};

async function ensureProfilesExist(personId: string, relatedPersonId: string) {
  const profiles = await prisma.profile.findMany({
    where: {
      id: {
        in: [personId, relatedPersonId]
      }
    },
    select: {
      id: true
    }
  });

  if (profiles.length !== 2) {
    throw new RelationshipInputError("Both profiles must exist");
  }
}

async function ensureNoDuplicateRelationship(input: CreateRelationshipInput) {
  const existingDirectRelationship = await prisma.relationship.findFirst({
    where: {
      OR: [
        {
          personId: input.personId,
          relatedPersonId: input.relatedPersonId
        },
        {
          personId: input.relatedPersonId,
          relatedPersonId: input.personId
        }
      ]
    },
    select: {
      relationshipType: true
    }
  });

  if (existingDirectRelationship?.relationshipType === input.relationshipType) {
    throw new RelationshipConflictError("Relationship already exists");
  }

  if (existingDirectRelationship) {
    throw new RelationshipConflictError(
      "This profile is already linked as another family relationship."
    );
  }
}

async function ensureSingleParentRelationship(input: CreateRelationshipInput) {
  if (
    input.relationshipType !== RelationshipType.father &&
    input.relationshipType !== RelationshipType.mother
  ) {
    return;
  }

  const existingParent = await prisma.relationship.findFirst({
    where: {
      personId: input.personId,
      relationshipType: input.relationshipType
    },
    select: {
      id: true
    }
  });

  if (existingParent && input.relationshipType === RelationshipType.father) {
    throw new RelationshipConflictError("This profile already has a father linked.");
  }

  if (existingParent && input.relationshipType === RelationshipType.mother) {
    throw new RelationshipConflictError("This profile already has a mother linked.");
  }
}

export async function getProfileRelationships(profileId: string) {
  const [parentRows, spouseRows, childRows] = await Promise.all([
    prisma.relationship.findMany({
      where: {
        personId: profileId,
        relationshipType: {
          in: [RelationshipType.father, RelationshipType.mother]
        }
      },
      include: {
        relatedPerson: {
          select: relationshipProfileSelect
        }
      },
      orderBy: {
        createdAt: "asc"
      }
    }),
    prisma.relationship.findMany({
      where: {
        relationshipType: RelationshipType.spouse,
        OR: [{ personId: profileId }, { relatedPersonId: profileId }]
      },
      include: {
        person: {
          select: relationshipProfileSelect
        },
        relatedPerson: {
          select: relationshipProfileSelect
        }
      },
      orderBy: {
        createdAt: "asc"
      }
    }),
    prisma.relationship.findMany({
      where: {
        relatedPersonId: profileId,
        relationshipType: {
          in: [RelationshipType.father, RelationshipType.mother]
        }
      },
      include: {
        person: {
          select: relationshipProfileSelect
        }
      },
      orderBy: {
        createdAt: "asc"
      }
    })
  ]);

  return {
    father: parentRows
      .filter((relationship) => relationship.relationshipType === "father")
      .map((relationship) => ({
        relationshipId: relationship.id,
        relationshipType: relationship.relationshipType,
        profile: relationship.relatedPerson
      })),
    mother: parentRows
      .filter((relationship) => relationship.relationshipType === "mother")
      .map((relationship) => ({
        relationshipId: relationship.id,
        relationshipType: relationship.relationshipType,
        profile: relationship.relatedPerson
      })),
    spouses: spouseRows.map((relationship) => ({
      relationshipId: relationship.id,
      relationshipType: relationship.relationshipType,
      profile:
        relationship.personId === profileId
          ? relationship.relatedPerson
          : relationship.person
    })),
    children: childRows.map((relationship) => ({
      relationshipId: relationship.id,
      relationshipType: relationship.relationshipType,
      profile: relationship.person
    }))
  } satisfies ProfileRelationships;
}

export async function createRelationship(input: CreateRelationshipInput) {
  if (input.personId === input.relatedPersonId) {
    throw new RelationshipInputError("A profile cannot be related to itself");
  }

  await ensureProfilesExist(input.personId, input.relatedPersonId);
  await ensureNoDuplicateRelationship(input);
  await ensureSingleParentRelationship(input);

  try {
    return await prisma.relationship.create({
      data: {
        personId: input.personId,
        relatedPersonId: input.relatedPersonId,
        relationshipType: input.relationshipType,
        notes: input.notes ?? null
      },
      select: relationshipSelect
    });
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "P2002"
    ) {
      throw new RelationshipConflictError("Relationship already exists");
    }

    throw error;
  }
}

export async function deleteRelationship(id: string) {
  const relationship = await prisma.relationship.findUnique({
    where: {
      id
    },
    select: {
      id: true
    }
  });

  if (!relationship) {
    throw new RelationshipNotFoundError("Relationship not found");
  }

  await prisma.relationship.delete({
    where: {
      id
    }
  });
}
