import Link from "next/link";
import { notFound } from "next/navigation";
import { FamilyTreeView } from "@/components/tree/family-tree-view";
import { ProfileNotFoundError } from "@/lib/services/profile-service";
import { getSimpleFamilyTree } from "@/lib/services/tree-service";

export const dynamic = "force-dynamic";

type ProfileTreePageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function ProfileTreePage({ params }: ProfileTreePageProps) {
  const { id } = await params;
  const tree = await loadTree(id);

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 border-b border-line pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link
            href={`/profiles/${tree.profile.id}`}
            className="text-sm font-medium text-moss"
          >
            Back to profile
          </Link>
          <h1 className="mt-3 text-3xl font-semibold text-ink">
            Family Tree: {tree.profile.fullName}
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-700">
            A simple view of parents, the current profile, spouses, and
            children based on existing relationship links.
          </p>
        </div>
      </div>

      {tree.isMerged ? (
        <div className="rounded border border-amber-300 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
          {tree.mergedIntoProfile ? (
            <p>
              This profile was merged into{" "}
              <Link
                href={`/profiles/${tree.mergedIntoProfile.id}`}
                className="font-semibold underline"
              >
                {tree.mergedIntoProfile.fullName}
              </Link>
              . Open the primary profile to view the current family tree.
            </p>
          ) : (
            <p>
              This profile was merged into another profile. Open the primary
              profile to view the current family tree.
            </p>
          )}
        </div>
      ) : (
        <FamilyTreeView tree={tree} />
      )}
    </section>
  );
}

async function loadTree(id: string) {
  try {
    return await getSimpleFamilyTree(id);
  } catch (error) {
    if (error instanceof ProfileNotFoundError) {
      notFound();
    }

    throw error;
  }
}
