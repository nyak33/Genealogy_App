import { RelationshipType, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

const dataQualityProfileSelect = {
  id: true,
  fullName: true,
  normalizedName: true,
  dateOfBirth: true,
  dateOfDeath: true,
  gender: true,
  isMerged: true
} satisfies Prisma.ProfileSelect;

const dataQualityRelationshipSelect = {
  id: true,
  personId: true,
  relatedPersonId: true,
  relationshipType: true,
  person: {
    select: dataQualityProfileSelect
  },
  relatedPerson: {
    select: dataQualityProfileSelect
  }
} satisfies Prisma.RelationshipSelect;

export type DataQualityProfile = Prisma.ProfileGetPayload<{
  select: typeof dataQualityProfileSelect;
}>;

export type DataQualityRelationship = Prisma.RelationshipGetPayload<{
  select: typeof dataQualityRelationshipSelect;
}>;

export type DuplicateProfileGroup = {
  normalizedName: string;
  profiles: DataQualityProfile[];
};

export type RelationshipConflictType =
  | "same_pair_multiple_roles"
  | "multiple_fathers"
  | "multiple_mothers"
  | "reverse_spouse_duplicate"
  | "self_link"
  | "direct_child_link"
  | "parent_death_date_conflict";

export type RelationshipConflict = {
  id: string;
  type: RelationshipConflictType;
  title: string;
  description: string;
  profiles: DataQualityProfile[];
  relationships: DataQualityRelationship[];
};

export type MissingInfoProfile = {
  profile: DataQualityProfile;
  missingFields: string[];
};

export type DataQualityReport = {
  duplicateGroups: DuplicateProfileGroup[];
  relationshipConflicts: RelationshipConflict[];
  missingInfoProfiles: MissingInfoProfile[];
};

const FATHER_BIRTH_WINDOW_DAYS = 300;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

export async function getDataQualityReport(): Promise<DataQualityReport> {
  const [duplicateGroups, relationshipConflicts, missingInfoProfiles] =
    await Promise.all([
      findPossibleDuplicateGroups(),
      findRelationshipConflicts(),
      findMissingInfoProfiles()
    ]);

  return {
    duplicateGroups,
    relationshipConflicts,
    missingInfoProfiles
  };
}

export async function findPossibleDuplicateGroups() {
  const profiles = await prisma.profile.findMany({
    where: {
      isMerged: false,
      normalizedName: {
        not: null
      }
    },
    orderBy: {
      fullName: "asc"
    },
    select: dataQualityProfileSelect
  });

  return getDuplicateGroupsFromProfiles(profiles);
}

export async function findRelationshipConflicts() {
  const relationships = await prisma.relationship.findMany({
    orderBy: {
      createdAt: "asc"
    },
    select: dataQualityRelationshipSelect
  });

  return getRelationshipConflictsFromRows(relationships);
}

export async function findMissingInfoProfiles() {
  const [profiles, parentRelationships] = await Promise.all([
    prisma.profile.findMany({
      where: {
        isMerged: false
      },
      orderBy: {
        fullName: "asc"
      },
      select: dataQualityProfileSelect
    }),
    prisma.relationship.findMany({
      where: {
        relationshipType: {
          in: [RelationshipType.father, RelationshipType.mother]
        }
      },
      select: {
        id: true,
        personId: true,
        relatedPersonId: true,
        relationshipType: true
      }
    })
  ]);

  return getMissingInfoProfilesFromData(profiles, parentRelationships);
}

export function getDuplicateGroupsFromProfiles(
  profiles: DataQualityProfile[]
): DuplicateProfileGroup[] {
  const groups = new Map<string, DataQualityProfile[]>();

  for (const profile of profiles) {
    if (profile.isMerged) {
      continue;
    }

    const normalizedName = profile.normalizedName?.trim();

    if (!normalizedName) {
      continue;
    }

    const existingGroup = groups.get(normalizedName) ?? [];
    existingGroup.push(profile);
    groups.set(normalizedName, existingGroup);
  }

  return Array.from(groups.entries())
    .filter(([, groupProfiles]) => groupProfiles.length > 1)
    .map(([normalizedName, groupProfiles]) => ({
      normalizedName,
      profiles: groupProfiles.sort((first, second) =>
        first.fullName.localeCompare(second.fullName)
      )
    }))
    .sort((first, second) =>
      first.normalizedName.localeCompare(second.normalizedName)
    );
}

export function getRelationshipConflictsFromRows(
  relationships: DataQualityRelationship[]
): RelationshipConflict[] {
  const conflicts: RelationshipConflict[] = [];
  const relationshipsByPair = new Map<string, DataQualityRelationship[]>();
  const fathersByChild = new Map<string, DataQualityRelationship[]>();
  const mothersByChild = new Map<string, DataQualityRelationship[]>();
  const spouseRowsByPair = new Map<string, DataQualityRelationship[]>();

  for (const relationship of relationships) {
    pushToMap(
      relationshipsByPair,
      getProfilePairKey(relationship.personId, relationship.relatedPersonId),
      relationship
    );

    if (relationship.relationshipType === RelationshipType.father) {
      pushToMap(fathersByChild, relationship.personId, relationship);
    }

    if (relationship.relationshipType === RelationshipType.mother) {
      pushToMap(mothersByChild, relationship.personId, relationship);
    }

    if (relationship.relationshipType === RelationshipType.spouse) {
      pushToMap(
        spouseRowsByPair,
        getProfilePairKey(relationship.personId, relationship.relatedPersonId),
        relationship
      );
    }

    if (relationship.relationshipType === RelationshipType.child) {
      conflicts.push({
        id: `direct-child-link:${relationship.id}`,
        type: "direct_child_link",
        title: "Direct child relationship row",
        description:
          "Children should be derived from reverse father or mother links for the MVP.",
        profiles: getUniqueProfiles([relationship]),
        relationships: [relationship]
      });
    }

    if (relationship.personId === relationship.relatedPersonId) {
      conflicts.push({
        id: `self-link:${relationship.id}`,
        type: "self_link",
        title: "Self-link relationship",
        description: `${relationship.person.fullName} is linked to themselves.`,
        profiles: [relationship.person],
        relationships: [relationship]
      });
    }

    const parentDeathDateConflict =
      getParentDeathDateConflictDescription(relationship);

    if (parentDeathDateConflict) {
      conflicts.push({
        id: `parent-death-date-conflict:${relationship.id}`,
        type: "parent_death_date_conflict",
        title: "Parent death date conflict",
        description: parentDeathDateConflict,
        profiles: getUniqueProfiles([relationship]),
        relationships: [relationship]
      });
    }
  }

  for (const [pairKey, pairRelationships] of relationshipsByPair) {
    const relationshipTypes = new Set(
      pairRelationships.map((relationship) => relationship.relationshipType)
    );

    if (relationshipTypes.size > 1) {
      conflicts.push({
        id: `same-pair-multiple-roles:${pairKey}`,
        type: "same_pair_multiple_roles",
        title: "Same profiles have multiple direct roles",
        description:
          "These two profiles are linked under more than one relationship type.",
        profiles: getUniqueProfiles(pairRelationships),
        relationships: pairRelationships
      });
    }
  }

  addSingleParentConflicts({
    conflicts,
    groupedRelationships: fathersByChild,
    type: "multiple_fathers",
    title: "Multiple fathers linked",
    description: "This profile has more than one father relationship.",
    pairLabel: "father"
  });

  addSingleParentConflicts({
    conflicts,
    groupedRelationships: mothersByChild,
    type: "multiple_mothers",
    title: "Multiple mothers linked",
    description: "This profile has more than one mother relationship.",
    pairLabel: "mother"
  });

  for (const [pairKey, spouseRelationships] of spouseRowsByPair) {
    if (spouseRelationships.length > 1) {
      conflicts.push({
        id: `reverse-spouse-duplicate:${pairKey}`,
        type: "reverse_spouse_duplicate",
        title: "Reverse spouse duplicate",
        description:
          "This spouse pair has more than one stored spouse relationship.",
        profiles: getUniqueProfiles(spouseRelationships),
        relationships: spouseRelationships
      });
    }
  }

  return conflicts;
}

export function getMissingInfoProfilesFromData(
  profiles: DataQualityProfile[],
  parentRelationships: Pick<
    DataQualityRelationship,
    "personId" | "relationshipType"
  >[]
): MissingInfoProfile[] {
  const profilesWithFather = new Set(
    parentRelationships
      .filter(
        (relationship) => relationship.relationshipType === RelationshipType.father
      )
      .map((relationship) => relationship.personId)
  );
  const profilesWithMother = new Set(
    parentRelationships
      .filter(
        (relationship) => relationship.relationshipType === RelationshipType.mother
      )
      .map((relationship) => relationship.personId)
  );

  return profiles
    .filter((profile) => !profile.isMerged)
    .map((profile) => {
      const missingFields = [
        profile.dateOfBirth ? null : "date of birth",
        profile.gender ? null : "gender",
        profilesWithFather.has(profile.id) ? null : "father",
        profilesWithMother.has(profile.id) ? null : "mother"
      ].filter((field): field is string => Boolean(field));

      return {
        profile,
        missingFields
      };
    })
    .filter((item) => item.missingFields.length > 0);
}

function addSingleParentConflicts({
  conflicts,
  groupedRelationships,
  type,
  title,
  description,
  pairLabel
}: {
  conflicts: RelationshipConflict[];
  groupedRelationships: Map<string, DataQualityRelationship[]>;
  type: "multiple_fathers" | "multiple_mothers";
  title: string;
  description: string;
  pairLabel: string;
}) {
  for (const [profileId, relationships] of groupedRelationships) {
    if (relationships.length > 1) {
      conflicts.push({
        id: `${type}:${profileId}`,
        type,
        title,
        description: `${description} ${relationships[0].person.fullName} has ${relationships.length} ${pairLabel} links.`,
        profiles: getUniqueProfiles(relationships),
        relationships
      });
    }
  }
}

function pushToMap<T>(map: Map<string, T[]>, key: string, value: T) {
  const values = map.get(key) ?? [];
  values.push(value);
  map.set(key, values);
}

function getProfilePairKey(firstProfileId: string, secondProfileId: string) {
  return [firstProfileId, secondProfileId].sort().join(":");
}

function getParentDeathDateConflictDescription(
  relationship: DataQualityRelationship
) {
  if (
    relationship.relationshipType !== RelationshipType.father &&
    relationship.relationshipType !== RelationshipType.mother
  ) {
    return null;
  }

  const child = relationship.person;
  const parent = relationship.relatedPerson;

  if (!child.dateOfBirth || !parent.dateOfDeath) {
    return null;
  }

  const hasFatherConflict =
    relationship.relationshipType === RelationshipType.father &&
    parent.dateOfDeath < addDays(child.dateOfBirth, -FATHER_BIRTH_WINDOW_DAYS);
  const hasMotherConflict =
    relationship.relationshipType === RelationshipType.mother &&
    parent.dateOfDeath < child.dateOfBirth;

  if (!hasFatherConflict && !hasMotherConflict) {
    return null;
  }

  return `${parent.fullName} has a death date that conflicts with being the biological ${relationship.relationshipType} of ${child.fullName}.`;
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * MILLISECONDS_PER_DAY);
}

function getUniqueProfiles(relationships: DataQualityRelationship[]) {
  const profiles = new Map<string, DataQualityProfile>();

  for (const relationship of relationships) {
    profiles.set(relationship.person.id, relationship.person);
    profiles.set(relationship.relatedPerson.id, relationship.relatedPerson);
  }

  return Array.from(profiles.values()).sort((first, second) =>
    first.fullName.localeCompare(second.fullName)
  );
}
