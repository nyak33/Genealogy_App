import type { SimpleFamilyTree } from "@/lib/services/tree-service";
import { FamilyTreePersonCard } from "@/components/tree/family-tree-person-card";
import { FamilyTreeSection } from "@/components/tree/family-tree-section";

type FamilyTreeViewProps = {
  tree: SimpleFamilyTree;
};

export function FamilyTreeView({ tree }: FamilyTreeViewProps) {
  return (
    <div className="mx-auto max-w-6xl space-y-8 print:max-w-none print:space-y-5">
      <FamilyTreeSection
        title="Parents"
        description="Biological parent links recorded for the current profile."
      >
        <div className="mx-auto grid max-w-4xl gap-4 md:grid-cols-2">
          <FamilyTreePersonCard
            label="Father"
            person={tree.father}
            emptyMessage="No father linked yet."
          />
          <FamilyTreePersonCard
            label="Mother"
            person={tree.mother}
            emptyMessage="No mother linked yet."
          />
        </div>
      </FamilyTreeSection>

      <AccurateConnector label="Parents connect to current profile" />

      <FamilyTreeSection title="Current Profile">
        <div className="mx-auto max-w-md">
          <FamilyTreePersonCard
            label="Current Profile"
            person={tree.profile}
            emptyMessage="Current profile could not be loaded."
            highlight
          />
        </div>
      </FamilyTreeSection>

      <FamilyTreeSection
        title="Spouse / Spouses"
        description="Spouse links are shown separately and are not treated as child parent links unless recorded as father or mother."
      >
        {tree.spouses.length === 0 ? (
          <div className="mx-auto max-w-md">
            <FamilyTreePersonCard
              label="Spouse / Spouses"
              emptyMessage="No spouse linked yet."
            />
          </div>
        ) : (
          <div className="mx-auto grid max-w-4xl gap-4 md:grid-cols-2 xl:grid-cols-3">
            {tree.spouses.map((spouse) => (
              <FamilyTreePersonCard
                key={spouse.id}
                label="Spouse"
                person={spouse}
                emptyMessage="No spouse linked yet."
              />
            ))}
          </div>
        )}
      </FamilyTreeSection>

      <AccurateConnector label="Current profile connects to children" />

      <FamilyTreeSection
        title="Children"
        description="Each child card shows that child's linked biological father and mother."
      >
        {tree.children.length === 0 ? (
          <div className="mx-auto max-w-md">
            <FamilyTreePersonCard
              label="Children"
              emptyMessage="No children linked yet."
            />
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {tree.children.map((child) => (
              <FamilyTreePersonCard
                key={child.profile.id}
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
      </FamilyTreeSection>
    </div>
  );
}

function AccurateConnector({ label }: { label: string }) {
  return (
    <div
      aria-label={label}
      className="hidden h-8 items-center justify-center md:flex print:hidden"
    >
      <div className="h-full w-px bg-line" />
    </div>
  );
}
