import { RelationshipType, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export class ProfileMergeInputError extends Error {
  status = 400;
}

export class ProfileMergeNotFoundError extends Error {
  status = 404;
}

export class ProfileMergeConflictError extends Error {
  status = 409;
}

const mergeProfileSelect = {
  id: true,
  fullName: true,
  normalizedName: true,
  dateOfBirth: true,
  dateOfDeath: true,
  gender: true,
  notes: true,
  isDeceased: true,
  isMerged: true,
  mergedIntoProfileId: true,
  mergedAt: true
} satisfies Prisma.ProfileSelect;

const mergeRelationshipInclude = {
  person: {
    select: mergeProfileSelect
  },
  relatedPerson: {
    select: mergeProfileSelect
  }
} satisfies Prisma.RelationshipInclude;

export type MergeProfile = Prisma.ProfileGetPayload<{
  select: typeof mergeProfileSelect;
}>;

export type MergeRelationship = Prisma.RelationshipGetPayload<{
  include: typeof mergeRelationshipInclude;
}>;

type MergeFieldName =
  | "fullName"
  | "dateOfBirth"
  | "dateOfDeath"
  | "gender"
  | "notes"
  | "isDeceased";

type MergeDatabaseClient = Pick<Prisma.TransactionClient, "profile" | "relationship">;

type MergeFieldPreview = {
  field: MergeFieldName;
  primaryValue: MergeProfile[MergeFieldName];
  duplicateValue: MergeProfile[MergeFieldName];
};

export type MergeRelationshipReplacement = {
  personId: string;
  relatedPersonId: string;
  relationshipType: RelationshipType;
};

export type MergeRelationshipPreview = {
  relationshipId: string;
  original: MergeRelationshipReplacement;
  replacement: MergeRelationshipReplacement;
};

export type MergeRelationshipSkipReason =
  | "self_relationship"
  | "same_pair_different_role_conflict"
  | "father_conflict"
  | "mother_conflict"
  | "impossible_parent_age";

export type MergeRelationshipSkip = MergeRelationshipPreview & {
  reason: MergeRelationshipSkipReason;
  message: string;
};

export type MergeWarning = {
  code: "PARENT_AGE_WARNING";
  message: string;
  relationshipId: string;
};

export type ProfileMergePreview = {
  primaryProfile: MergeProfile;
  duplicateProfile: MergeProfile;
  fieldsToCopy: MergeFieldPreview[];
  fieldConflicts: MergeFieldPreview[];
  unchangedFields: MergeFieldPreview[];
  relationshipsToMove: MergeRelationshipPreview[];
  relationshipsToDeleteAsRedundant: MergeRelationshipPreview[];
  relationshipsToSkip: MergeRelationshipSkip[];
  warnings: MergeWarning[];
};

export type ProfileMergeResult = {
  primaryProfile: MergeProfile;
  duplicateProfile: MergeProfile;
  fieldsCopied: MergeFieldPreview[];
  fieldConflicts: MergeFieldPreview[];
  relationshipsMoved: MergeRelationshipPreview[];
  relationshipsDeletedAsRedundant: MergeRelationshipPreview[];
  relationshipsSkipped: MergeRelationshipSkip[];
  warnings: MergeWarning[];
};

const mergeFieldNames: MergeFieldName[] = [
  "fullName",
  "dateOfBirth",
  "dateOfDeath",
  "gender",
  "notes",
  "isDeceased"
];

export async function previewProfileMerge(
  primaryId: string,
  duplicateId: string
) {
  return evaluateProfileMerge(primaryId, duplicateId);
}

export async function evaluateProfileMerge(
  primaryId: string,
  duplicateId: string
): Promise<ProfileMergePreview> {
  return evaluateProfileMergeWithClient(prisma, primaryId, duplicateId);
}

export async function mergeProfiles(
  primaryId: string,
  duplicateId: string
): Promise<ProfileMergeResult> {
  return prisma.$transaction(async (tx) => {
    const preview = await evaluateProfileMergeWithClient(
      tx,
      primaryId,
      duplicateId
    );
    const primaryUpdateData = getPrimaryProfileUpdateData(preview);
    const primaryProfile = preview.fieldsToCopy.length
      ? await tx.profile.update({
          where: {
            id: primaryId
          },
          data: primaryUpdateData,
          select: mergeProfileSelect
        })
      : preview.primaryProfile;

    for (const relationship of preview.relationshipsToMove) {
      await tx.relationship.update({
        where: {
          id: relationship.relationshipId
        },
        data: {
          personId: relationship.replacement.personId,
          relatedPersonId: relationship.replacement.relatedPersonId
        }
      });
    }

    for (const relationship of preview.relationshipsToDeleteAsRedundant) {
      await tx.relationship.delete({
        where: {
          id: relationship.relationshipId
        }
      });
    }

    const duplicateProfile = await tx.profile.update({
      where: {
        id: duplicateId
      },
      data: {
        isMerged: true,
        mergedIntoProfileId: primaryId,
        mergedAt: new Date()
      },
      select: mergeProfileSelect
    });

    return {
      primaryProfile,
      duplicateProfile,
      fieldsCopied: preview.fieldsToCopy,
      fieldConflicts: preview.fieldConflicts,
      relationshipsMoved: preview.relationshipsToMove,
      relationshipsDeletedAsRedundant:
        preview.relationshipsToDeleteAsRedundant,
      relationshipsSkipped: preview.relationshipsToSkip,
      warnings: preview.warnings
    };
  });
}

async function evaluateProfileMergeWithClient(
  db: MergeDatabaseClient,
  primaryId: string,
  duplicateId: string
): Promise<ProfileMergePreview> {
  if (primaryId === duplicateId) {
    throw new ProfileMergeInputError(
      "Primary and duplicate profiles must be different."
    );
  }

  const profiles = await db.profile.findMany({
    where: {
      id: {
        in: [primaryId, duplicateId]
      }
    },
    select: mergeProfileSelect
  });

  const primaryProfile = profiles.find((profile) => profile.id === primaryId);
  const duplicateProfile = profiles.find(
    (profile) => profile.id === duplicateId
  );

  if (!primaryProfile) {
    throw new ProfileMergeNotFoundError("Primary profile not found.");
  }

  if (!duplicateProfile) {
    throw new ProfileMergeNotFoundError("Duplicate profile not found.");
  }

  if (primaryProfile.isMerged) {
    throw new ProfileMergeConflictError("Primary profile is already merged.");
  }

  if (duplicateProfile.isMerged) {
    throw new ProfileMergeConflictError("Duplicate profile is already merged.");
  }

  const fieldPreview = evaluateMergeFields(primaryProfile, duplicateProfile);
  const duplicateRelationships = await db.relationship.findMany({
    where: {
      OR: [{ personId: duplicateId }, { relatedPersonId: duplicateId }]
    },
    include: mergeRelationshipInclude,
    orderBy: {
      createdAt: "asc"
    }
  });
  const replacements = duplicateRelationships.map((relationship) => ({
    relationship,
    replacement: getRelationshipReplacement(
      relationship,
      primaryId,
      duplicateId
    )
  }));
  const affectedProfileIds = Array.from(
    new Set(
      replacements.flatMap(({ replacement }) => [
        replacement.personId,
        replacement.relatedPersonId
      ])
    )
  );
  const existingRelationships = affectedProfileIds.length
    ? await db.relationship.findMany({
        where: {
          OR: [
            {
              personId: {
                in: affectedProfileIds
              }
            },
            {
              relatedPersonId: {
                in: affectedProfileIds
              }
            }
          ]
        },
        include: mergeRelationshipInclude,
        orderBy: {
          createdAt: "asc"
        }
      })
    : [];
  const relationshipPreview = evaluateMergeRelationships({
    primaryProfile,
    duplicateProfile,
    replacements,
    existingRelationships
  });

  return {
    primaryProfile,
    duplicateProfile,
    ...fieldPreview,
    ...relationshipPreview
  };
}

function getPrimaryProfileUpdateData(preview: ProfileMergePreview) {
  const data: Prisma.ProfileUpdateInput = {};

  for (const fieldPreview of preview.fieldsToCopy) {
    switch (fieldPreview.field) {
      case "fullName":
        data.fullName = fieldPreview.duplicateValue as string;
        data.normalizedName = preview.duplicateProfile.normalizedName;
        break;
      case "dateOfBirth":
        data.dateOfBirth = fieldPreview.duplicateValue as Date;
        break;
      case "dateOfDeath":
        data.dateOfDeath = fieldPreview.duplicateValue as Date;
        break;
      case "gender":
        data.gender = fieldPreview.duplicateValue as string;
        break;
      case "notes":
        data.notes = fieldPreview.duplicateValue as string;
        break;
      case "isDeceased":
        data.isDeceased = fieldPreview.duplicateValue as boolean;
        break;
    }
  }

  return data;
}

function evaluateMergeFields(
  primaryProfile: MergeProfile,
  duplicateProfile: MergeProfile
) {
  const fieldsToCopy: MergeFieldPreview[] = [];
  const fieldConflicts: MergeFieldPreview[] = [];
  const unchangedFields: MergeFieldPreview[] = [];

  for (const field of mergeFieldNames) {
    const preview = {
      field,
      primaryValue: primaryProfile[field],
      duplicateValue: duplicateProfile[field]
    };

    if (isEmptyMergeValue(primaryProfile[field]) && !isEmptyMergeValue(duplicateProfile[field])) {
      fieldsToCopy.push(preview);
    } else if (
      !isEmptyMergeValue(primaryProfile[field]) &&
      !isEmptyMergeValue(duplicateProfile[field]) &&
      !areMergeValuesEqual(primaryProfile[field], duplicateProfile[field])
    ) {
      fieldConflicts.push(preview);
    } else {
      unchangedFields.push(preview);
    }
  }

  return {
    fieldsToCopy,
    fieldConflicts,
    unchangedFields
  };
}

function evaluateMergeRelationships({
  primaryProfile,
  duplicateProfile,
  replacements,
  existingRelationships
}: {
  primaryProfile: MergeProfile;
  duplicateProfile: MergeProfile;
  replacements: {
    relationship: MergeRelationship;
    replacement: MergeRelationshipReplacement;
  }[];
  existingRelationships: MergeRelationship[];
}) {
  const relationshipsToMove: MergeRelationshipPreview[] = [];
  const relationshipsToDeleteAsRedundant: MergeRelationshipPreview[] = [];
  const relationshipsToSkip: MergeRelationshipSkip[] = [];
  const warnings: MergeWarning[] = [];

  for (const { relationship, replacement } of replacements) {
    const preview = {
      relationshipId: relationship.id,
      original: toRelationshipReplacement(relationship),
      replacement
    };
    const comparableRelationships = existingRelationships.filter(
      (existingRelationship) => existingRelationship.id !== relationship.id
    );

    if (replacement.personId === replacement.relatedPersonId) {
      relationshipsToSkip.push({
        ...preview,
        reason: "self_relationship",
        message: "Moving this relationship would create a self-relationship."
      });
      continue;
    }

    if (
      comparableRelationships.some((existingRelationship) =>
        isExactRelationshipMatch(existingRelationship, replacement)
      )
    ) {
      relationshipsToDeleteAsRedundant.push(preview);
      continue;
    }

    if (
      comparableRelationships.some((existingRelationship) =>
        isSamePairDifferentRole(existingRelationship, replacement)
      )
    ) {
      relationshipsToSkip.push({
        ...preview,
        reason: "same_pair_different_role_conflict",
        message:
          "Moving this relationship would link the same profiles under multiple relationship types."
      });
      continue;
    }

    const parentConflict = getParentConflict(comparableRelationships, replacement);

    if (parentConflict) {
      relationshipsToSkip.push({
        ...preview,
        reason: parentConflict,
        message:
          parentConflict === "father_conflict"
            ? "Moving this relationship would give a profile more than one father."
            : "Moving this relationship would give a profile more than one mother."
      });
      continue;
    }

    const ageResult = evaluateParentAge({
      primaryProfile,
      duplicateProfile,
      relationship,
      replacement
    });

    if (ageResult === "impossible") {
      relationshipsToSkip.push({
        ...preview,
        reason: "impossible_parent_age",
        message: "Moving this relationship would make a parent not older than a child."
      });
      continue;
    }

    if (ageResult === "warning") {
      warnings.push({
        code: "PARENT_AGE_WARNING",
        message:
          "This parent appears unusually young for a biological parent. Please confirm the dates are correct.",
        relationshipId: relationship.id
      });
    }

    relationshipsToMove.push(preview);
  }

  return {
    relationshipsToMove,
    relationshipsToDeleteAsRedundant,
    relationshipsToSkip,
    warnings
  };
}

function getRelationshipReplacement(
  relationship: MergeRelationship,
  primaryId: string,
  duplicateId: string
): MergeRelationshipReplacement {
  return {
    personId:
      relationship.personId === duplicateId ? primaryId : relationship.personId,
    relatedPersonId:
      relationship.relatedPersonId === duplicateId
        ? primaryId
        : relationship.relatedPersonId,
    relationshipType: relationship.relationshipType
  };
}

function toRelationshipReplacement(
  relationship: MergeRelationship
): MergeRelationshipReplacement {
  return {
    personId: relationship.personId,
    relatedPersonId: relationship.relatedPersonId,
    relationshipType: relationship.relationshipType
  };
}

function isEmptyMergeValue(value: unknown) {
  return (
    value === null ||
    value === undefined ||
    (typeof value === "string" && value.trim() === "")
  );
}

function areMergeValuesEqual(firstValue: unknown, secondValue: unknown) {
  if (firstValue instanceof Date && secondValue instanceof Date) {
    return firstValue.getTime() === secondValue.getTime();
  }

  return firstValue === secondValue;
}

function isExactRelationshipMatch(
  relationship: MergeRelationship,
  replacement: MergeRelationshipReplacement
) {
  return (
    relationship.personId === replacement.personId &&
    relationship.relatedPersonId === replacement.relatedPersonId &&
    relationship.relationshipType === replacement.relationshipType
  );
}

function isSamePairDifferentRole(
  relationship: MergeRelationship,
  replacement: MergeRelationshipReplacement
) {
  return (
    getProfilePairKey(relationship.personId, relationship.relatedPersonId) ===
      getProfilePairKey(replacement.personId, replacement.relatedPersonId) &&
    relationship.relationshipType !== replacement.relationshipType
  );
}

function getParentConflict(
  relationships: MergeRelationship[],
  replacement: MergeRelationshipReplacement
): "father_conflict" | "mother_conflict" | null {
  if (
    replacement.relationshipType !== RelationshipType.father &&
    replacement.relationshipType !== RelationshipType.mother
  ) {
    return null;
  }

  const hasExistingParent = relationships.some(
    (relationship) =>
      relationship.personId === replacement.personId &&
      relationship.relationshipType === replacement.relationshipType &&
      relationship.relatedPersonId !== replacement.relatedPersonId
  );

  if (!hasExistingParent) {
    return null;
  }

  return replacement.relationshipType === RelationshipType.father
    ? "father_conflict"
    : "mother_conflict";
}

function evaluateParentAge({
  primaryProfile,
  duplicateProfile,
  relationship,
  replacement
}: {
  primaryProfile: MergeProfile;
  duplicateProfile: MergeProfile;
  relationship: MergeRelationship;
  replacement: MergeRelationshipReplacement;
}) {
  if (
    replacement.relationshipType !== RelationshipType.father &&
    replacement.relationshipType !== RelationshipType.mother
  ) {
    return "ok";
  }

  const child = findProfileForReplacementId({
    id: replacement.personId,
    primaryProfile,
    duplicateProfile,
    relationship
  });
  const parent = findProfileForReplacementId({
    id: replacement.relatedPersonId,
    primaryProfile,
    duplicateProfile,
    relationship
  });

  if (!child?.dateOfBirth || !parent?.dateOfBirth) {
    return "ok";
  }

  if (parent.dateOfBirth >= child.dateOfBirth) {
    return "impossible";
  }

  if (addCalendarYears(parent.dateOfBirth, 12) > child.dateOfBirth) {
    return "warning";
  }

  return "ok";
}

function findProfileForReplacementId({
  id,
  primaryProfile,
  duplicateProfile,
  relationship
}: {
  id: string;
  primaryProfile: MergeProfile;
  duplicateProfile: MergeProfile;
  relationship: MergeRelationship;
}) {
  if (id === primaryProfile.id) {
    return primaryProfile;
  }

  if (id === duplicateProfile.id) {
    return duplicateProfile;
  }

  if (id === relationship.person.id) {
    return relationship.person;
  }

  if (id === relationship.relatedPerson.id) {
    return relationship.relatedPerson;
  }

  return null;
}

function addCalendarYears(date: Date, years: number) {
  const result = new Date(date);
  result.setFullYear(result.getFullYear() + years);
  return result;
}

function getProfilePairKey(firstProfileId: string, secondProfileId: string) {
  return [firstProfileId, secondProfileId].sort().join(":");
}
