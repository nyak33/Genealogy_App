import Link from "next/link";
import { notFound } from "next/navigation";
import { RelationshipManager } from "@/components/relationships/relationship-manager";
import {
  getProfileById,
  ProfileNotFoundError
} from "@/lib/services/profile-service";
import { getProfileRelationships } from "@/lib/services/relationship-service";
import { formatDate } from "@/lib/utils/format-date";

export const dynamic = "force-dynamic";

type ProfileDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function ProfileDetailPage({
  params
}: ProfileDetailPageProps) {
  const { id } = await params;
  const profile = await loadProfile(id);
  const relationships = await getProfileRelationships(id);

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 border-b border-line pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link href="/profiles" className="text-sm font-medium text-moss">
            Back to profiles
          </Link>
          <h1 className="mt-3 text-3xl font-semibold text-ink">
            {profile.fullName}
          </h1>
        </div>
        <Link
          href={`/profiles/${profile.id}/edit`}
          className="rounded border border-line px-4 py-2 text-sm font-semibold text-ink transition hover:border-moss hover:text-moss"
        >
          Edit Profile
        </Link>
      </div>

      <section className="space-y-5 rounded border border-line bg-white p-6">
        <div>
          <h2 className="text-xl font-semibold text-ink">Profile Summary</h2>
          <p className="mt-1 text-sm text-neutral-700">
            Core profile details for this family member.
          </p>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase text-neutral-500">
            Full Name
          </p>
          <p className="mt-1 text-2xl font-semibold text-ink">
            {profile.fullName}
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <DetailItem
            label="Date of Birth"
            value={formatDate(profile.dateOfBirth)}
          />
          <DetailItem
            label="Date of Death"
            value={formatDate(profile.dateOfDeath)}
          />
          <DetailItem label="Gender" value={profile.gender ?? "Not recorded"} />
          <DetailItem
            label="Status"
            value={
              profile.isDeceased || profile.dateOfDeath
                ? "Deceased"
                : "No death record"
            }
          />
          <DetailItem label="Created" value={formatDate(profile.createdAt)} />
          <DetailItem label="Updated" value={formatDate(profile.updatedAt)} />
        </div>

        <div className="rounded border border-line bg-paper p-4">
          <h3 className="text-sm font-semibold text-ink">Notes</h3>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-neutral-700">
            {profile.notes || "No notes recorded."}
          </p>
        </div>
      </section>

      <RelationshipManager
        profile={{
          id: profile.id,
          gender: profile.gender
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

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-line bg-white p-4">
      <dt className="text-xs font-semibold uppercase text-neutral-500">{label}</dt>
      <dd className="mt-2 text-sm text-ink">{value}</dd>
    </div>
  );
}
