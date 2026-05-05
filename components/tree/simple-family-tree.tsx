import type { ProfileTreeRelationships } from "@/lib/services/relationship-service";
import {
  TreePersonCard,
  type TreePerson
} from "@/components/tree/tree-person-card";

type SimpleFamilyTreeProps = {
  profile: TreePerson;
  relationships: ProfileTreeRelationships;
};

export function SimpleFamilyTree({
  profile,
  relationships
}: SimpleFamilyTreeProps) {
  const father = relationships.father[0]?.profile ?? null;
  const mother = relationships.mother[0]?.profile ?? null;

  return (
    <div className="space-y-6">
      <section className="rounded border border-line bg-paper p-5">
        <SectionHeading title="Parents" />
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <TreePersonCard
            label="Father"
            person={father}
            emptyMessage="No father linked yet."
          />
          <TreePersonCard
            label="Mother"
            person={mother}
            emptyMessage="No mother linked yet."
          />
        </div>
      </section>

      <section className="rounded border border-line bg-paper p-5">
        <SectionHeading title="Current Profile And Spouse" />
        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <TreePersonCard
            label="Current Profile"
            person={profile}
            emptyMessage="Current profile could not be loaded."
            highlight
          />
          <div className="space-y-3">
            {relationships.spouses.length === 0 ? (
              <TreePersonCard
                label="Spouse / Spouses"
                emptyMessage="No spouse linked yet."
              />
            ) : (
              relationships.spouses.map((spouse) => (
                <TreePersonCard
                  key={spouse.relationshipId}
                  label="Spouse"
                  person={spouse.profile}
                  emptyMessage="No spouse linked yet."
                />
              ))
            )}
          </div>
        </div>
      </section>

      <section className="rounded border border-line bg-paper p-5">
        <SectionHeading title="Children" />
        {relationships.children.length === 0 ? (
          <div className="mt-4">
            <TreePersonCard
              label="Children"
              emptyMessage="No children linked yet."
            />
          </div>
        ) : (
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {relationships.children.map((child) => (
              <TreePersonCard
                key={child.relationshipId}
                label="Child"
                person={child.profile}
                emptyMessage="No children linked yet."
                details={[
                  `Father: ${child.father?.fullName ?? "Not linked"}`,
                  `Mother: ${child.mother?.fullName ?? "Not linked"}`
                ]}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function SectionHeading({ title }: { title: string }) {
  return <h2 className="text-lg font-semibold text-ink">{title}</h2>;
}
