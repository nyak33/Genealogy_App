import { RelationshipType } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  getDuplicateGroupsFromProfiles,
  getMissingInfoProfilesFromData,
  getRelationshipConflictsFromRows,
  type DataQualityProfile,
  type DataQualityRelationship
} from "@/lib/services/data-quality-service";

const birthDate = new Date("1980-01-01");

function profile(
  id: string,
  fullName: string,
  overrides: Partial<DataQualityProfile> = {}
): DataQualityProfile {
  return {
    id,
    fullName,
    normalizedName: fullName.toLowerCase(),
    dateOfBirth: null,
    dateOfDeath: null,
    gender: null,
    isMerged: false,
    ...overrides
  };
}

function relationship(
  id: string,
  person: DataQualityProfile,
  relatedPerson: DataQualityProfile,
  relationshipType: RelationshipType
): DataQualityRelationship {
  return {
    id,
    personId: person.id,
    relatedPersonId: relatedPerson.id,
    relationshipType,
    person,
    relatedPerson
  };
}

describe("data quality service helpers", () => {
  it("groups possible duplicate profiles by normalizedName", () => {
    const duplicateGroups = getDuplicateGroupsFromProfiles([
      profile("profile-1", "Amin Rahman", { normalizedName: "amin rahman" }),
      profile("profile-2", "AMIN  RAHMAN", { normalizedName: "amin rahman" }),
      profile("profile-3", "Laila Hassan", {
        normalizedName: "laila hassan"
      })
    ]);

    expect(duplicateGroups).toHaveLength(1);
    expect(duplicateGroups[0].normalizedName).toBe("amin rahman");
    expect(duplicateGroups[0].profiles).toHaveLength(2);
  });

  it("excludes merged profiles from duplicate groups", () => {
    const duplicateGroups = getDuplicateGroupsFromProfiles([
      profile("profile-1", "Amin Rahman", { normalizedName: "amin rahman" }),
      profile("profile-2", "Amin Rahman Copy", {
        normalizedName: "amin rahman",
        isMerged: true
      })
    ]);

    expect(duplicateGroups).toEqual([]);
  });

  it("detects same pair linked under multiple relationship types", () => {
    const child = profile("profile-1", "Child");
    const parent = profile("profile-2", "Parent");
    const conflicts = getRelationshipConflictsFromRows([
      relationship("relationship-1", child, parent, RelationshipType.father),
      relationship("relationship-2", child, parent, RelationshipType.spouse)
    ]);

    expect(conflicts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "same_pair_multiple_roles"
        })
      ])
    );
  });

  it("detects profiles with more than one father", () => {
    const child = profile("profile-1", "Child");
    const firstFather = profile("profile-2", "First Father");
    const secondFather = profile("profile-3", "Second Father");
    const conflicts = getRelationshipConflictsFromRows([
      relationship(
        "relationship-1",
        child,
        firstFather,
        RelationshipType.father
      ),
      relationship(
        "relationship-2",
        child,
        secondFather,
        RelationshipType.father
      )
    ]);

    expect(conflicts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "multiple_fathers"
        })
      ])
    );
  });

  it("detects profiles with more than one mother", () => {
    const child = profile("profile-1", "Child");
    const firstMother = profile("profile-2", "First Mother");
    const secondMother = profile("profile-3", "Second Mother");
    const conflicts = getRelationshipConflictsFromRows([
      relationship(
        "relationship-1",
        child,
        firstMother,
        RelationshipType.mother
      ),
      relationship(
        "relationship-2",
        child,
        secondMother,
        RelationshipType.mother
      )
    ]);

    expect(conflicts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "multiple_mothers"
        })
      ])
    );
  });

  it("detects reverse spouse duplicate rows", () => {
    const firstSpouse = profile("profile-1", "First Spouse");
    const secondSpouse = profile("profile-2", "Second Spouse");
    const conflicts = getRelationshipConflictsFromRows([
      relationship(
        "relationship-1",
        firstSpouse,
        secondSpouse,
        RelationshipType.spouse
      ),
      relationship(
        "relationship-2",
        secondSpouse,
        firstSpouse,
        RelationshipType.spouse
      )
    ]);

    expect(conflicts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "reverse_spouse_duplicate"
        })
      ])
    );
  });

  it("detects direct child rows as an old invalid pattern", () => {
    const parent = profile("profile-1", "Parent");
    const child = profile("profile-2", "Child");
    const conflicts = getRelationshipConflictsFromRows([
      relationship("relationship-1", parent, child, RelationshipType.child)
    ]);

    expect(conflicts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "direct_child_link"
        })
      ])
    );
  });

  it("detects father death date conflicts", () => {
    const child = profile("profile-1", "Muhamad Syaqir", {
      dateOfBirth: new Date("1997-12-20")
    });
    const father = profile("profile-2", "Ab Basaar", {
      dateOfDeath: new Date("1960-12-20")
    });
    const conflicts = getRelationshipConflictsFromRows([
      relationship("relationship-1", child, father, RelationshipType.father)
    ]);

    expect(conflicts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "parent_death_date_conflict",
          description:
            "Ab Basaar has a death date that conflicts with being the biological father of Muhamad Syaqir."
        })
      ])
    );
  });

  it("detects mother death date conflicts", () => {
    const child = profile("profile-1", "Muhamad Syaqir", {
      dateOfBirth: new Date("1997-12-20")
    });
    const mother = profile("profile-2", "Nora Aziz", {
      dateOfDeath: new Date("1997-12-19")
    });
    const conflicts = getRelationshipConflictsFromRows([
      relationship("relationship-1", child, mother, RelationshipType.mother)
    ]);

    expect(conflicts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "parent_death_date_conflict",
          description:
            "Nora Aziz has a death date that conflicts with being the biological mother of Muhamad Syaqir."
        })
      ])
    );
  });

  it("reports missing date of birth, gender, father, and mother", () => {
    const completeProfile = profile("profile-1", "Complete Person", {
      dateOfBirth: birthDate,
      gender: "female"
    });
    const incompleteProfile = profile("profile-2", "Incomplete Person");
    const father = profile("profile-3", "Father");
    const mother = profile("profile-4", "Mother");
    const missingInfoProfiles = getMissingInfoProfilesFromData(
      [completeProfile, incompleteProfile],
      [
        relationship(
          "relationship-1",
          completeProfile,
          father,
          RelationshipType.father
        ),
        relationship(
          "relationship-2",
          completeProfile,
          mother,
          RelationshipType.mother
        )
      ]
    );

    expect(missingInfoProfiles).toEqual([
      {
        profile: incompleteProfile,
        missingFields: ["date of birth", "gender", "father", "mother"]
      }
    ]);
  });

  it("excludes merged profiles from missing info reports", () => {
    const mergedProfile = profile("profile-1", "Merged Person", {
      isMerged: true
    });

    const missingInfoProfiles = getMissingInfoProfilesFromData(
      [mergedProfile],
      []
    );

    expect(missingInfoProfiles).toEqual([]);
  });
});
