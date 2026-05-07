import { RelationshipType, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

const suggestionProfileSelect = {
  id: true,
  fullName: true,
  dateOfBirth: true,
  dateOfDeath: true,
  isMerged: true
} satisfies Prisma.ProfileSelect;

export type CoParentSuggestionProfile = Omit<
  Prisma.ProfileGetPayload<{
    select: typeof suggestionProfileSelect;
  }>,
  "isMerged"
>;

export type CoParentSuggestion = {
  child: CoParentSuggestionProfile;
  father: CoParentSuggestionProfile;
  mother: CoParentSuggestionProfile;
};

type SuggestionProfileWithMerge = Prisma.ProfileGetPayload<{
  select: typeof suggestionProfileSelect;
}>;

type ParentRelationshipRow = {
  personId: string;
  relationshipType: RelationshipType;
  person: SuggestionProfileWithMerge;
  relatedPerson: SuggestionProfileWithMerge;
};

export async function findCoParentSpouseSuggestions(profileId: string) {
  const currentProfile = await prisma.profile.findUnique({
    where: {
      id: profileId
    },
    select: suggestionProfileSelect
  });

  if (!currentProfile || currentProfile.isMerged) {
    return [];
  }

  const [currentParentRows, currentChildRows] = await Promise.all([
    prisma.relationship.findMany({
      where: {
        personId: profileId,
        relationshipType: {
          in: [RelationshipType.father, RelationshipType.mother]
        },
        person: {
          isMerged: false
        },
        relatedPerson: {
          isMerged: false
        }
      },
      include: {
        person: {
          select: suggestionProfileSelect
        },
        relatedPerson: {
          select: suggestionProfileSelect
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
        },
        relatedPerson: {
          isMerged: false
        }
      },
      include: {
        person: {
          select: suggestionProfileSelect
        },
        relatedPerson: {
          select: suggestionProfileSelect
        }
      },
      orderBy: {
        createdAt: "asc"
      }
    })
  ]);

  const childIds = new Set<string>();

  if (currentParentRows.length > 0) {
    childIds.add(profileId);
  }

  for (const relationship of currentChildRows) {
    childIds.add(relationship.personId);
  }

  if (childIds.size === 0) {
    return [];
  }

  const parentRows = await prisma.relationship.findMany({
    where: {
      personId: {
        in: Array.from(childIds)
      },
      relationshipType: {
        in: [RelationshipType.father, RelationshipType.mother]
      },
      person: {
        isMerged: false
      },
      relatedPerson: {
        isMerged: false
      }
    },
    include: {
      person: {
        select: suggestionProfileSelect
      },
      relatedPerson: {
        select: suggestionProfileSelect
      }
    },
    orderBy: {
      createdAt: "asc"
    }
  });

  const candidates = getSuggestionCandidates(parentRows);
  const spousePairKeys = await getExistingSpousePairKeys(candidates);

  return candidates.filter(
    (suggestion) =>
      !spousePairKeys.has(
        getPairKey(suggestion.father.id, suggestion.mother.id)
      )
  );
}

function getSuggestionCandidates(parentRows: ParentRelationshipRow[]) {
  const parentsByChild = new Map<
    string,
    {
      child: SuggestionProfileWithMerge;
      father: SuggestionProfileWithMerge | null;
      mother: SuggestionProfileWithMerge | null;
    }
  >();

  for (const relationship of parentRows) {
    const existing = parentsByChild.get(relationship.personId) ?? {
      child: relationship.person,
      father: null,
      mother: null
    };

    if (relationship.relationshipType === RelationshipType.father) {
      existing.father = relationship.relatedPerson;
    }

    if (relationship.relationshipType === RelationshipType.mother) {
      existing.mother = relationship.relatedPerson;
    }

    parentsByChild.set(relationship.personId, existing);
  }

  const suggestions = new Map<string, CoParentSuggestion>();

  for (const parents of parentsByChild.values()) {
    if (!parents.father || !parents.mother) {
      continue;
    }

    if (
      parents.child.isMerged ||
      parents.father.isMerged ||
      parents.mother.isMerged
    ) {
      continue;
    }

    const suggestion = {
      child: withoutMergeFlag(parents.child),
      father: withoutMergeFlag(parents.father),
      mother: withoutMergeFlag(parents.mother)
    } satisfies CoParentSuggestion;
    suggestions.set(getSuggestionKey(suggestion), suggestion);
  }

  return Array.from(suggestions.values());
}

async function getExistingSpousePairKeys(suggestions: CoParentSuggestion[]) {
  if (suggestions.length === 0) {
    return new Set<string>();
  }

  const spouseRows = await prisma.relationship.findMany({
    where: {
      relationshipType: RelationshipType.spouse,
      OR: suggestions.flatMap((suggestion) => [
        {
          personId: suggestion.father.id,
          relatedPersonId: suggestion.mother.id
        },
        {
          personId: suggestion.mother.id,
          relatedPersonId: suggestion.father.id
        }
      ])
    },
    select: {
      personId: true,
      relatedPersonId: true
    }
  });

  return new Set(
    spouseRows.map((relationship) =>
      getPairKey(relationship.personId, relationship.relatedPersonId)
    )
  );
}

function withoutMergeFlag(
  profile: SuggestionProfileWithMerge
): CoParentSuggestionProfile {
  return {
    id: profile.id,
    fullName: profile.fullName,
    dateOfBirth: profile.dateOfBirth,
    dateOfDeath: profile.dateOfDeath
  };
}

function getSuggestionKey(suggestion: CoParentSuggestion) {
  return [
    suggestion.child.id,
    suggestion.father.id,
    suggestion.mother.id
  ].join(":");
}

function getPairKey(firstProfileId: string, secondProfileId: string) {
  return [firstProfileId, secondProfileId].sort().join(":");
}
