import { RelationshipType, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ProfileNotFoundError } from "@/lib/services/profile-service";

const treeProfileSelect = {
  id: true,
  fullName: true,
  dateOfBirth: true,
  dateOfDeath: true
} satisfies Prisma.ProfileSelect;

const currentTreeProfileSelect = {
  ...treeProfileSelect,
  isMerged: true,
  mergedIntoProfile: {
    select: {
      id: true,
      fullName: true
    }
  }
} satisfies Prisma.ProfileSelect;

export type TreeProfile = Prisma.ProfileGetPayload<{
  select: typeof treeProfileSelect;
}>;

type CurrentTreeProfile = Prisma.ProfileGetPayload<{
  select: typeof currentTreeProfileSelect;
}>;

export type SimpleFamilyTreeChild = {
  profile: TreeProfile;
  father: TreeProfile | null;
  mother: TreeProfile | null;
};

export type SimpleFamilyTree = {
  profile: TreeProfile;
  isMerged: boolean;
  mergedIntoProfile: CurrentTreeProfile["mergedIntoProfile"];
  father: TreeProfile | null;
  mother: TreeProfile | null;
  spouses: TreeProfile[];
  children: SimpleFamilyTreeChild[];
};

export async function getSimpleFamilyTree(
  profileId: string
): Promise<SimpleFamilyTree> {
  const profile = await prisma.profile.findUnique({
    where: {
      id: profileId
    },
    select: currentTreeProfileSelect
  });

  if (!profile) {
    throw new ProfileNotFoundError("Profile not found");
  }

  if (profile.isMerged) {
    return {
      profile: toTreeProfile(profile),
      isMerged: true,
      mergedIntoProfile: profile.mergedIntoProfile,
      father: null,
      mother: null,
      spouses: [],
      children: []
    };
  }

  const [parentRows, spouseRows, childRows] = await Promise.all([
    prisma.relationship.findMany({
      where: {
        personId: profileId,
        relationshipType: {
          in: [RelationshipType.father, RelationshipType.mother]
        },
        relatedPerson: {
          isMerged: false
        }
      },
      include: {
        relatedPerson: {
          select: treeProfileSelect
        }
      },
      orderBy: {
        createdAt: "asc"
      }
    }),
    prisma.relationship.findMany({
      where: {
        relationshipType: RelationshipType.spouse,
        OR: [
          {
            personId: profileId,
            relatedPerson: {
              isMerged: false
            }
          },
          {
            relatedPersonId: profileId,
            person: {
              isMerged: false
            }
          }
        ]
      },
      include: {
        person: {
          select: treeProfileSelect
        },
        relatedPerson: {
          select: treeProfileSelect
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
        },
        person: {
          isMerged: false
        }
      },
      include: {
        person: {
          select: treeProfileSelect
        }
      },
      orderBy: {
        createdAt: "asc"
      }
    })
  ]);

  const children = childRows.map((relationship) => relationship.person);
  const childParentRows =
    children.length === 0
      ? []
      : await prisma.relationship.findMany({
          where: {
            personId: {
              in: children.map((child) => child.id)
            },
            relationshipType: {
              in: [RelationshipType.father, RelationshipType.mother]
            },
            relatedPerson: {
              isMerged: false
            }
          },
          include: {
            relatedPerson: {
              select: treeProfileSelect
            }
          },
          orderBy: {
            createdAt: "asc"
          }
        });

  return {
    profile: toTreeProfile(profile),
    isMerged: false,
    mergedIntoProfile: null,
    father:
      parentRows.find((row) => row.relationshipType === RelationshipType.father)
        ?.relatedPerson ?? null,
    mother:
      parentRows.find((row) => row.relationshipType === RelationshipType.mother)
        ?.relatedPerson ?? null,
    spouses: spouseRows.map((relationship) =>
      relationship.personId === profileId
        ? relationship.relatedPerson
        : relationship.person
    ),
    children: children.map((child) => ({
      profile: child,
      father:
        childParentRows.find(
          (row) =>
            row.personId === child.id &&
            row.relationshipType === RelationshipType.father
        )?.relatedPerson ?? null,
      mother:
        childParentRows.find(
          (row) =>
            row.personId === child.id &&
            row.relationshipType === RelationshipType.mother
        )?.relatedPerson ?? null
    }))
  };
}

function toTreeProfile(profile: CurrentTreeProfile): TreeProfile {
  return {
    id: profile.id,
    fullName: profile.fullName,
    dateOfBirth: profile.dateOfBirth,
    dateOfDeath: profile.dateOfDeath
  };
}
