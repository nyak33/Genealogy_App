import "dotenv/config";
import { RelationshipType } from "@prisma/client";
import { normalizeName } from "../lib/utils/normalize-name";
import { prisma } from "../lib/db";

const sampleProfiles = [
  {
    id: "00000000-0000-4000-8000-000000000001",
    fullName: "Iman Amin",
    dateOfBirth: new Date("2012-06-15"),
    gender: "unknown"
  },
  {
    id: "00000000-0000-4000-8000-000000000002",
    fullName: "Amin Rahman",
    dateOfBirth: new Date("1980-03-20"),
    gender: "male"
  },
  {
    id: "00000000-0000-4000-8000-000000000003",
    fullName: "Laila Hassan",
    dateOfBirth: new Date("1982-11-05"),
    gender: "female"
  },
  {
    id: "00000000-0000-4000-8000-000000000004",
    fullName: "Nora Aziz",
    dateOfBirth: new Date("2013-09-02"),
    gender: "unknown"
  }
];

async function main() {
  for (const profile of sampleProfiles) {
    await prisma.profile.upsert({
      where: { id: profile.id },
      update: {},
      create: {
        ...profile,
        normalizedName: normalizeName(profile.fullName)
      }
    });
  }

  await prisma.relationship.upsert({
    where: {
      personId_relatedPersonId_relationshipType: {
        personId: sampleProfiles[0].id,
        relatedPersonId: sampleProfiles[1].id,
        relationshipType: RelationshipType.father
      }
    },
    update: {},
    create: {
      personId: sampleProfiles[0].id,
      relatedPersonId: sampleProfiles[1].id,
      relationshipType: RelationshipType.father
    }
  });

  await prisma.relationship.upsert({
    where: {
      personId_relatedPersonId_relationshipType: {
        personId: sampleProfiles[0].id,
        relatedPersonId: sampleProfiles[2].id,
        relationshipType: RelationshipType.mother
      }
    },
    update: {},
    create: {
      personId: sampleProfiles[0].id,
      relatedPersonId: sampleProfiles[2].id,
      relationshipType: RelationshipType.mother
    }
  });

  await prisma.relationship.upsert({
    where: {
      personId_relatedPersonId_relationshipType: {
        personId: sampleProfiles[0].id,
        relatedPersonId: sampleProfiles[3].id,
        relationshipType: RelationshipType.spouse
      }
    },
    update: {},
    create: {
      personId: sampleProfiles[0].id,
      relatedPersonId: sampleProfiles[3].id,
      relationshipType: RelationshipType.spouse
    }
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
