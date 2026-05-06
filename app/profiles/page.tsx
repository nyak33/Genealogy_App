import Link from "next/link";
import { listProfiles } from "@/lib/services/profile-service";
import { formatDate } from "@/lib/utils/format-date";

export const dynamic = "force-dynamic";

export default async function ProfilesPage() {
  let profiles: Awaited<ReturnType<typeof listProfiles>> = [];
  let loadError: string | null = null;

  try {
    profiles = await listProfiles();
  } catch {
    loadError = "Profiles could not be loaded. Check your database connection.";
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 border-b border-line pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-ink">Profiles</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-700">
            Manage family member records before adding search, duplicate
            warnings, and relationship links in later milestones.
          </p>
          <p className="mt-1 text-xs text-neutral-600">
            Merged profiles are hidden from this list.
          </p>
        </div>
        <Link
          href="/profiles/new"
          className="rounded bg-moss px-4 py-2 text-sm font-semibold text-white transition hover:bg-ink"
        >
          Add Profile
        </Link>
      </div>

      {loadError ? (
        <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {loadError}
        </div>
      ) : null}

      {!loadError && profiles.length === 0 ? (
        <div className="rounded border border-line bg-white p-6">
          <p className="text-sm text-neutral-700">No profiles yet.</p>
        </div>
      ) : null}

      {profiles.length > 0 ? (
        <div className="overflow-hidden rounded border border-line bg-white">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-paper text-ink">
              <tr>
                <th className="border-b border-line px-4 py-3 font-semibold">
                  Name
                </th>
                <th className="border-b border-line px-4 py-3 font-semibold">
                  Birth
                </th>
                <th className="border-b border-line px-4 py-3 font-semibold">
                  Death
                </th>
                <th className="border-b border-line px-4 py-3 font-semibold">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((profile) => (
                <tr key={profile.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3">
                    <Link
                      href={`/profiles/${profile.id}`}
                      className="font-medium text-moss hover:text-ink"
                    >
                      {profile.fullName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-neutral-700">
                    {formatDate(profile.dateOfBirth)}
                  </td>
                  <td className="px-4 py-3 text-neutral-700">
                    {formatDate(profile.dateOfDeath)}
                  </td>
                  <td className="px-4 py-3 text-neutral-700">
                    {profile.isDeceased || profile.dateOfDeath
                      ? "Deceased"
                      : "No death record"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
