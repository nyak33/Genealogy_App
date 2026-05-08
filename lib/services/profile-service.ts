import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { normalizeName } from "@/lib/utils/normalize-name";
import type {
  CreateProfileInput,
  DuplicateCheckInput,
  UpdateProfileInput
} from "@/lib/validators/profile";

export class ProfileInputError extends Error {
  status = 400;
}

export class ProfileNotFoundError extends Error {
  status = 404;
}

const profileSelect = {
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
  mergedAt: true,
  mergedIntoProfile: {
    select: {
      id: true,
      fullName: true
    }
  },
  createdAt: true,
  updatedAt: true
} satisfies Prisma.ProfileSelect;

export type ProfileRecord = Prisma.ProfileGetPayload<{
  select: typeof profileSelect;
}>;

const profileSearchSelect = {
  id: true,
  fullName: true,
  dateOfBirth: true,
  dateOfDeath: true
} satisfies Prisma.ProfileSelect;

export type ProfileSearchRecord = Prisma.ProfileGetPayload<{
  select: typeof profileSearchSelect;
}>;

type ProfileDbClient = Pick<typeof prisma, "profile">;

function parseOptionalDate(value: string | null | undefined): Date | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new ProfileInputError("Date must be valid");
  }

  return date;
}

function ensureDateOrder(dateOfBirth: Date | null, dateOfDeath: Date | null) {
  if (dateOfBirth && dateOfDeath && dateOfDeath < dateOfBirth) {
    throw new ProfileInputError(
      "Date of death cannot be earlier than date of birth"
    );
  }
}

export async function listProfiles() {
  return prisma.profile.findMany({
    where: {
      isMerged: false
    },
    orderBy: {
      createdAt: "desc"
    },
    select: {
      id: true,
      fullName: true,
      dateOfBirth: true,
      dateOfDeath: true,
      gender: true,
      isDeceased: true,
      createdAt: true,
      updatedAt: true
    }
  });
}

export async function getProfileById(id: string) {
  const profile = await prisma.profile.findUnique({
    where: { id },
    select: profileSelect
  });

  if (!profile) {
    throw new ProfileNotFoundError("Profile not found");
  }

  return profile;
}

export async function searchProfiles(query: string) {
  const trimmedQuery = query.trim();

  if (trimmedQuery.length < 2) {
    return [];
  }

  const normalizedQuery = normalizeName(trimmedQuery);

  return prisma.profile.findMany({
    where: {
      isMerged: false,
      OR: [
        {
          fullName: {
            contains: trimmedQuery,
            mode: "insensitive"
          }
        },
        {
          normalizedName: {
            contains: normalizedQuery,
            mode: "insensitive"
          }
        }
      ]
    },
    orderBy: {
      fullName: "asc"
    },
    take: 20,
    select: profileSearchSelect
  });
}

export async function findPossibleDuplicateProfiles(
  input: DuplicateCheckInput,
  client: ProfileDbClient = prisma
) {
  const normalizedQuery = normalizeName(input.fullName);
  const dateOfBirth = parseOptionalDate(input.dateOfBirth);
  const dateOfDeath = parseOptionalDate(input.dateOfDeath);
  const duplicateChecks: Prisma.ProfileWhereInput[] = [
    {
      normalizedName: normalizedQuery
    },
    {
      normalizedName: {
        contains: normalizedQuery,
        mode: "insensitive"
      }
    },
    {
      fullName: {
        contains: input.fullName,
        mode: "insensitive"
      }
    }
  ];

  if (dateOfBirth) {
    duplicateChecks.push({ dateOfBirth });
  }

  if (dateOfDeath) {
    duplicateChecks.push({ dateOfDeath });
  }

  return client.profile.findMany({
    where: {
      isMerged: false,
      OR: duplicateChecks
    },
    orderBy: {
      fullName: "asc"
    },
    take: 10,
    select: profileSearchSelect
  });
}

export async function createProfile(
  input: CreateProfileInput,
  client: ProfileDbClient = prisma
) {
  const dateOfBirth = parseOptionalDate(input.dateOfBirth);
  const dateOfDeath = parseOptionalDate(input.dateOfDeath);

  ensureDateOrder(dateOfBirth, dateOfDeath);

  return client.profile.create({
    data: {
      fullName: input.fullName,
      normalizedName: normalizeName(input.fullName),
      dateOfBirth,
      dateOfDeath,
      gender: input.gender ?? null,
      notes: input.notes ?? null,
      isDeceased: dateOfDeath ? true : (input.isDeceased ?? false)
    },
    select: profileSelect
  });
}

export async function updateProfile(id: string, input: UpdateProfileInput) {
  const existing = await getProfileById(id);
  const data: Prisma.ProfileUpdateInput = {};

  if (input.fullName !== undefined) {
    data.fullName = input.fullName;
    data.normalizedName = normalizeName(input.fullName);
  }

  const dateOfBirth =
    input.dateOfBirth !== undefined
      ? parseOptionalDate(input.dateOfBirth)
      : existing.dateOfBirth;
  const dateOfDeath =
    input.dateOfDeath !== undefined
      ? parseOptionalDate(input.dateOfDeath)
      : existing.dateOfDeath;

  ensureDateOrder(dateOfBirth, dateOfDeath);

  if (input.dateOfBirth !== undefined) {
    data.dateOfBirth = dateOfBirth;
  }

  if (input.dateOfDeath !== undefined) {
    data.dateOfDeath = dateOfDeath;
  }

  if (input.gender !== undefined) {
    data.gender = input.gender ?? null;
  }

  if (input.notes !== undefined) {
    data.notes = input.notes ?? null;
  }

  if (input.isDeceased !== undefined) {
    data.isDeceased = input.isDeceased;
  }

  if (dateOfDeath) {
    data.isDeceased = true;
  }

  return prisma.profile.update({
    where: { id },
    data,
    select: profileSelect
  });
}
