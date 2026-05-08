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

export class RelationshipParentAgeWarningError extends Error {
  status = 409;
  code = "PARENT_AGE_WARNING";
  requiresConfirmation = true;
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

const FATHER_BIRTH_WINDOW_DAYS = 300;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

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

export type TreeChildProfileLink = RelationshipProfileLink & {
  father: RelationshipProfileLink["profile"] | null;
  mother: RelationshipProfileLink["profile"] | null;
};

export type ProfileTreeRelationships = Omit<ProfileRelationships, "children"> & {
  children: TreeChildProfileLink[];
};

type RelationshipDbClient = Pick<typeof prisma, "profile" | "relationship">;

async function ensureProfilesExist(
  personId: string,
  relatedPersonId: string,
  client: RelationshipDbClient
) {
  const profiles = await client.profile.findMany({
    where: {
      id: {
        in: [personId, relatedPersonId]
      }
    },
    select: {
      id: true,
      isMerged: true
    }
  });

  if (profiles.length !== 2) {
    throw new RelationshipInputError("Both profiles must exist");
  }

  if (profiles.some((profile) => profile.isMerged)) {
    throw new RelationshipInputError(
      "Cannot link merged profiles. Use the primary profile instead."
    );
  }
}

async function ensureNoDuplicateRelationship(
  input: CreateRelationshipInput,
  client: RelationshipDbClient
) {
  const existingDirectRelationship = await client.relationship.findFirst({
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

async function ensureSingleParentRelationship(
  input: CreateRelationshipInput,
  client: RelationshipDbClient
) {
  if (
    input.relationshipType !== RelationshipType.father &&
    input.relationshipType !== RelationshipType.mother
  ) {
    return;
  }

  const existingParent = await client.relationship.findFirst({
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

async function ensureParentAgeIsReasonable(
  input: CreateRelationshipInput,
  client: RelationshipDbClient
) {
  if (
    input.relationshipType !== RelationshipType.father &&
    input.relationshipType !== RelationshipType.mother
  ) {
    return;
  }

  const profiles = await client.profile.findMany({
    where: {
      id: {
        in: [input.personId, input.relatedPersonId]
      }
    },
    select: {
      id: true,
      dateOfBirth: true,
      dateOfDeath: true
    }
  });

  const child = profiles.find((profile) => profile.id === input.personId);
  const parent = profiles.find(
    (profile) => profile.id === input.relatedPersonId
  );

  if (!child || !parent) {
    return;
  }

  if (!child.dateOfBirth || !parent.dateOfBirth) {
    ensureParentDeathDateCanFitRelationship(input, child, parent);
    return;
  }

  if (parent.dateOfBirth >= child.dateOfBirth) {
    throw new RelationshipInputError("Parent must be born before the child.");
  }

  ensureParentDeathDateCanFitRelationship(input, child, parent);

  if (
    !input.confirmParentAgeWarning &&
    addCalendarYears(parent.dateOfBirth, 12) > child.dateOfBirth
  ) {
    throw new RelationshipParentAgeWarningError(
      "This parent appears unusually young for a biological parent. Please confirm the dates are correct."
    );
  }
}

function ensureParentDeathDateCanFitRelationship(
  input: CreateRelationshipInput,
  child: { dateOfBirth: Date | null },
  parent: { dateOfDeath: Date | null }
) {
  if (!child.dateOfBirth || !parent.dateOfDeath) {
    return;
  }

  if (input.relationshipType === RelationshipType.father) {
    const earliestAllowedFatherDeath = addDays(
      child.dateOfBirth,
      -FATHER_BIRTH_WINDOW_DAYS
    );

    if (parent.dateOfDeath < earliestAllowedFatherDeath) {
      throw new RelationshipInputError(
        "Father death date is too early to be the biological father of this child."
      );
    }
  }

  if (
    input.relationshipType === RelationshipType.mother &&
    parent.dateOfDeath < child.dateOfBirth
  ) {
    throw new RelationshipInputError(
      "Mother death date cannot be before the child birth date."
    );
  }
}

function addCalendarYears(date: Date, years: number) {
  const result = new Date(date);
  result.setFullYear(result.getFullYear() + years);
  return result;
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * MILLISECONDS_PER_DAY);
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

export async function getProfileTreeRelationships(profileId: string) {
  const relationships = await getProfileRelationships(profileId);

  const children = await Promise.all(
    relationships.children.map(async (child) => {
      const childRelationships = await getProfileRelationships(child.profile.id);

      return {
        ...child,
        father: childRelationships.father[0]?.profile ?? null,
        mother: childRelationships.mother[0]?.profile ?? null
      };
    })
  );

  return {
    ...relationships,
    children
  } satisfies ProfileTreeRelationships;
}

export async function createRelationship(
  input: CreateRelationshipInput,
  client: RelationshipDbClient = prisma
) {
  if (input.personId === input.relatedPersonId) {
    throw new RelationshipInputError("A profile cannot be related to itself");
  }

  await ensureProfilesExist(input.personId, input.relatedPersonId, client);
  await ensureNoDuplicateRelationship(input, client);
  await ensureSingleParentRelationship(input, client);
  await ensureParentAgeIsReasonable(input, client);

  try {
    return await client.relationship.create({
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
