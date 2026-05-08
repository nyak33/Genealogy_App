import Link from "next/link";
import { RemoveRelationshipButton } from "@/components/data-quality/remove-relationship-button";
import {
  getDataQualityReport,
  type DataQualityProfile,
  type DataQualityRelationship
} from "@/lib/services/data-quality-service";
import { formatDate } from "@/lib/utils/format-date";

export const dynamic = "force-dynamic";

export default async function DataQualityPage() {
  const report = await getDataQualityReport();

  return (
    <section className="space-y-8">
      <div className="border-b border-line pb-5">
        <Link href="/profiles" className="text-sm font-medium text-moss">
          Back to profiles
        </Link>
        <h1 className="mt-3 text-3xl font-semibold text-ink">
          Data Quality
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-700">
          Review duplicate candidates, relationship conflicts, and incomplete
          profile records before building richer family tree views.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard
          label="Duplicate Groups"
          value={report.duplicateGroups.length}
        />
        <SummaryCard
          label="Relationship Conflicts"
          value={report.relationshipConflicts.length}
        />
        <SummaryCard
          label="Incomplete Profiles"
          value={report.missingInfoProfiles.length}
        />
      </div>

      <section className="space-y-4 rounded border border-line bg-white p-6">
        <SectionHeader
          title="Possible Duplicate Profiles"
          description="Profiles grouped by the same normalized name. Review manually before merging in a future phase."
        />

        {report.duplicateGroups.length === 0 ? (
          <EmptyState message="No duplicate profile groups found." />
        ) : (
          <div className="space-y-4">
            {report.duplicateGroups.map((group) => (
              <div
                key={group.normalizedName}
                className="rounded border border-line bg-paper p-4"
              >
                <h3 className="text-sm font-semibold text-ink">
                  {group.normalizedName}
                </h3>
                <Link
                  href={getDuplicateGroupMergeHref(group.profiles)}
                  className="mt-2 inline-block rounded border border-line bg-white px-3 py-2 text-sm font-semibold text-moss transition hover:border-moss hover:text-ink"
                >
                  Review merge
                </Link>
                <ul className="mt-3 space-y-2">
                  {group.profiles.map((profile) => (
                    <li
                      key={profile.id}
                      className="rounded border border-line bg-white px-3 py-3"
                    >
                      <ProfileLink profile={profile} />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4 rounded border border-line bg-white p-6">
        <SectionHeader
          title="Relationship Conflicts"
          description="Old or invalid rows that can confuse family display. Remove only the incorrect relationship link."
        />

        {report.relationshipConflicts.length === 0 ? (
          <EmptyState message="No relationship conflicts found." />
        ) : (
          <div className="space-y-4">
            {report.relationshipConflicts.map((conflict) => (
              <div
                key={conflict.id}
                className="rounded border border-line bg-paper p-4"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-ink">
                      {conflict.title}
                    </h3>
                    <p className="mt-1 text-sm leading-6 text-neutral-700">
                      {conflict.description}
                    </p>
                  </div>
                  <span className="w-fit rounded border border-line bg-white px-2 py-1 text-xs font-medium text-neutral-600">
                    {formatConflictType(conflict.type)}
                  </span>
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  <div>
                    <h4 className="text-xs font-semibold uppercase text-neutral-500">
                      Affected Profiles
                    </h4>
                    <ul className="mt-2 space-y-2">
                      {conflict.profiles.map((profile) => (
                        <li key={profile.id}>
                          <ProfileLink profile={profile} />
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold uppercase text-neutral-500">
                      Relationship Links
                    </h4>
                    <ul className="mt-2 space-y-2">
                      {conflict.relationships.map((relationship) => (
                        <li
                          key={relationship.id}
                          className="rounded border border-line bg-white px-3 py-3"
                        >
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <RelationshipSummary relationship={relationship} />
                            <RemoveRelationshipButton
                              relationshipId={relationship.id}
                            />
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4 rounded border border-line bg-white p-6">
        <SectionHeader
          title="Profiles With Incomplete Family Links"
          description="This report shows profiles that do not yet have father or mother links. This is normal for older generations or when parent details are unknown."
        />

        {report.missingInfoProfiles.length === 0 ? (
          <EmptyState message="No incomplete profiles found." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-line text-xs uppercase text-neutral-500">
                  <th className="py-3 pr-4 font-semibold">Profile</th>
                  <th className="py-3 pr-4 font-semibold">Missing Links</th>
                  <th className="py-3 pr-4 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {report.missingInfoProfiles.map((item) => (
                  <tr key={item.profile.id} className="border-b border-line">
                    <td className="py-3 pr-4">
                      <ProfileLink profile={item.profile} />
                    </td>
                    <td className="py-3 pr-4 text-neutral-700">
                      {item.missingFields.join(", ")}
                    </td>
                    <td className="py-3 pr-4">
                      <Link
                        href={`/profiles/${item.profile.id}/edit`}
                        className="text-sm font-medium text-moss hover:text-ink"
                      >
                        Edit profile
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </section>
  );
}

export function getDuplicateGroupMergeHref(
  profiles: Pick<DataQualityProfile, "id">[]
) {
  if (profiles.length !== 2) {
    return "/profiles/merge";
  }

  const params = new URLSearchParams({
    primaryId: profiles[0].id,
    duplicateId: profiles[1].id
  });

  return `/profiles/merge?${params.toString()}`;
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border border-line bg-white p-5">
      <p className="text-xs font-semibold uppercase text-neutral-500">
        {label}
      </p>
      <p className="mt-3 text-3xl font-semibold text-ink">{value}</p>
    </div>
  );
}

function SectionHeader({
  title,
  description
}: {
  title: string;
  description: string;
}) {
  return (
    <div>
      <h2 className="text-xl font-semibold text-ink">{title}</h2>
      <p className="mt-1 text-sm leading-6 text-neutral-700">{description}</p>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded border border-dashed border-line bg-paper px-4 py-5 text-sm text-neutral-600">
      {message}
    </div>
  );
}

function ProfileLink({ profile }: { profile: DataQualityProfile }) {
  return (
    <div>
      <Link
        href={`/profiles/${profile.id}`}
        className="font-semibold text-moss hover:text-ink"
      >
        {profile.fullName}
      </Link>
      <p className="mt-1 text-xs text-neutral-600">
        {formatProfileDetails(profile)}
      </p>
    </div>
  );
}

function RelationshipSummary({
  relationship
}: {
  relationship: DataQualityRelationship;
}) {
  return (
    <div>
      <p className="text-sm font-semibold text-ink">
        {relationship.person.fullName} - {relationship.relationshipType} -{" "}
        {relationship.relatedPerson.fullName}
      </p>
      <p className="mt-1 text-xs text-neutral-600">
        Relationship ID: {relationship.id}
      </p>
    </div>
  );
}

function formatProfileDetails(profile: DataQualityProfile) {
  return [
    profile.dateOfBirth ? `Birth: ${formatDate(profile.dateOfBirth)}` : null,
    profile.dateOfDeath ? `Death: ${formatDate(profile.dateOfDeath)}` : null,
    profile.gender ? `Gender: ${profile.gender}` : null
  ]
    .filter(Boolean)
    .join(" | ") || "No dates or gender recorded.";
}

function formatConflictType(type: string) {
  return type.replaceAll("_", " ");
}
