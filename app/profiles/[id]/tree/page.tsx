import Link from "next/link";
import { notFound } from "next/navigation";
import { SimpleFamilyTree } from "@/components/tree/simple-family-tree";
import {
  getProfileById,
  ProfileNotFoundError
} from "@/lib/services/profile-service";
import { getProfileTreeRelationships } from "@/lib/services/relationship-service";

export const dynamic = "force-dynamic";

type ProfileTreePageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function ProfileTreePage({ params }: ProfileTreePageProps) {
  const { id } = await params;
  const profile = await loadProfile(id);
  const relationships = await getProfileTreeRelationships(id);

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 border-b border-line pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link
            href={`/profiles/${profile.id}`}
            className="text-sm font-medium text-moss"
          >
            Back to profile
          </Link>
          <h1 className="mt-3 text-3xl font-semibold text-ink">
            Family Tree: {profile.fullName}
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-700">
            A simple view of parents, the current profile, spouses, and
            children based on existing relationship links.
          </p>
        </div>
      </div>

      <SimpleFamilyTree
        profile={{
          id: profile.id,
          fullName: profile.fullName,
          dateOfBirth: profile.dateOfBirth,
          dateOfDeath: profile.dateOfDeath
        }}
        relationships={relationships}
      />
    </section>
  );
}

async function loadProfile(id: string) {
  try {
    return await getProfileById(id);
  } catch (error) {
    if (error instanceof ProfileNotFoundError) {
      notFound();
    }

    throw error;
  }
}
