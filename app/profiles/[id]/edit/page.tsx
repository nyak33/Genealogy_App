import Link from "next/link";
import { notFound } from "next/navigation";
import { ProfileForm } from "@/components/profiles/profile-form";
import {
  getProfileById,
  ProfileNotFoundError
} from "@/lib/services/profile-service";

export const dynamic = "force-dynamic";

type EditProfilePageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function EditProfilePage({ params }: EditProfilePageProps) {
  const { id } = await params;
  const profile = await loadProfile(id);

  return (
    <section className="mx-auto max-w-2xl space-y-6">
      <div className="border-b border-line pb-5">
        <Link
          href={`/profiles/${profile.id}`}
          className="text-sm font-medium text-moss"
        >
          Back to profile
        </Link>
        <h1 className="mt-3 text-3xl font-semibold text-ink">Edit Profile</h1>
      </div>

      {profile.isMerged ? (
        <div className="rounded border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
          This profile has been merged. Editing merged profiles is disabled.
        </div>
      ) : (
        <div className="rounded border border-line bg-white p-6">
          <ProfileForm
            mode="edit"
            profile={{
              ...profile,
              dateOfBirth: profile.dateOfBirth?.toISOString() ?? null,
              dateOfDeath: profile.dateOfDeath?.toISOString() ?? null
            }}
          />
        </div>
      )}
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
