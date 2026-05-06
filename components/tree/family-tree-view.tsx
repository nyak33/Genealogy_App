import type { SimpleFamilyTree } from "@/lib/services/tree-service";
import { FamilyTreePersonCard } from "@/components/tree/family-tree-person-card";
import { FamilyTreeSection } from "@/components/tree/family-tree-section";

type FamilyTreeViewProps = {
  tree: SimpleFamilyTree;
};

export function FamilyTreeView({ tree }: FamilyTreeViewProps) {
  return (
    <div className="space-y-6">
      <FamilyTreeSection title="Parents">
        <div className="grid gap-4 md:grid-cols-2">
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

      <FamilyTreeSection title="Current Profile">
        <FamilyTreePersonCard
          label="Current Profile"
          person={tree.profile}
          emptyMessage="Current profile could not be loaded."
          highlight
        />
      </FamilyTreeSection>

      <FamilyTreeSection title="Spouse / Spouses">
        {tree.spouses.length === 0 ? (
          <FamilyTreePersonCard
            label="Spouse / Spouses"
            emptyMessage="No spouse linked yet."
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
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

      <FamilyTreeSection title="Children">
        {tree.children.length === 0 ? (
          <FamilyTreePersonCard
            label="Children"
            emptyMessage="No children linked yet."
          />
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
