import { RelationshipType } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  createProfile,
  findPossibleDuplicateProfiles,
  ProfileInputError,
  ProfileNotFoundError,
  type ProfileSearchRecord
} from "@/lib/services/profile-service";
import { createRelationship } from "@/lib/services/relationship-service";
import type { QuickAddRelativeInput } from "@/lib/validators/quick-add-relative";

export class QuickAddDuplicateWarningError extends Error {
  status = 409;

  constructor(public possibleDuplicates: ProfileSearchRecord[]) {
    super("Possible duplicate profiles found");
  }
}

export async function quickAddRelative(
  currentProfileId: string,
  input: QuickAddRelativeInput
) {
  const currentProfile = await prisma.profile.findUnique({
    where: {
      id: currentProfileId
    },
    select: {
      id: true,
      gender: true,
      isMerged: true
    }
  });

  if (!currentProfile) {
    throw new ProfileNotFoundError("Profile not found");
  }

  if (currentProfile.isMerged) {
    throw new ProfileInputError(
      "Cannot quick-add relatives to a merged profile."
    );
  }

  if (!input.confirmCreateDifferentPerson) {
    const possibleDuplicates = await findPossibleDuplicateProfiles({
      fullName: input.profile.fullName,
      dateOfBirth: input.profile.dateOfBirth,
      dateOfDeath: input.profile.dateOfDeath
    });

    if (possibleDuplicates.length > 0) {
      throw new QuickAddDuplicateWarningError(possibleDuplicates);
    }
  }

  return prisma.$transaction(async (tx) => {
    const transactionCurrentProfile = await tx.profile.findUnique({
      where: {
        id: currentProfileId
      },
      select: {
        id: true,
        gender: true,
        isMerged: true
      }
    });

    if (!transactionCurrentProfile) {
      throw new ProfileNotFoundError("Profile not found");
    }

    if (transactionCurrentProfile.isMerged) {
      throw new ProfileInputError(
        "Cannot quick-add relatives to a merged profile."
      );
    }

    const profile = await createProfile(input.profile, tx);
    const relationship = await createRelationship(
      resolveRelationshipPayload({
        currentProfileId,
        currentProfileGender: transactionCurrentProfile.gender,
        newProfileId: profile.id,
        input
      }),
      tx
    );

    return {
      profile,
      relationship
    };
  });
}

function resolveRelationshipPayload({
  currentProfileId,
  currentProfileGender,
  newProfileId,
  input
}: {
  currentProfileId: string;
  currentProfileGender: string | null;
  newProfileId: string;
  input: QuickAddRelativeInput;
}) {
  if (input.relationshipType === RelationshipType.father) {
    return {
      personId: currentProfileId,
      relatedPersonId: newProfileId,
      relationshipType: RelationshipType.father,
      confirmParentAgeWarning: input.confirmParentAgeWarning
    };
  }

  if (input.relationshipType === RelationshipType.mother) {
    return {
      personId: currentProfileId,
      relatedPersonId: newProfileId,
      relationshipType: RelationshipType.mother,
      confirmParentAgeWarning: input.confirmParentAgeWarning
    };
  }

  if (input.relationshipType === RelationshipType.spouse) {
    return {
      personId: currentProfileId,
      relatedPersonId: newProfileId,
      relationshipType: RelationshipType.spouse
    };
  }

  const resolvedParentRole =
    currentProfileGender === "male"
      ? RelationshipType.father
      : currentProfileGender === "female"
        ? RelationshipType.mother
        : input.childParentRole;

  if (
    resolvedParentRole !== RelationshipType.father &&
    resolvedParentRole !== RelationshipType.mother
  ) {
    throw new ProfileInputError(
      "Choose whether the current profile is father or mother."
    );
  }

  return {
    personId: newProfileId,
    relatedPersonId: currentProfileId,
    relationshipType: resolvedParentRole,
    confirmParentAgeWarning: input.confirmParentAgeWarning
  };
}
