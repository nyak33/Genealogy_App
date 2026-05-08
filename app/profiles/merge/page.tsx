import Link from "next/link";
import { MergeProfilesForm } from "@/app/profiles/merge/merge-profiles-form";
import {
  getProfileById,
  ProfileNotFoundError
} from "@/lib/services/profile-service";

export const dynamic = "force-dynamic";

type MergeProfilesPageProps = {
  searchParams: Promise<{
    primaryId?: string;
    duplicateId?: string;
  }>;
};

type PrefilledProfile = {
  id: string;
  fullName: string;
};

export default async function MergeProfilesPage({
  searchParams
}: MergeProfilesPageProps) {
  const { primaryId, duplicateId } = await searchParams;
  const [primaryPrefill, duplicatePrefill] = await Promise.all([
    loadPrefilledProfile(primaryId, "Profile to keep"),
    loadPrefilledProfile(duplicateId, "Profile to merge")
  ]);

  const prefillWarnings = [
    primaryPrefill.warning,
    duplicatePrefill.warning
  ].filter((warning): warning is string => Boolean(warning));

  return (
    <section className="space-y-8">
      <div className="border-b border-line pb-5">
        <Link href="/profiles" className="text-sm font-medium text-moss">
          Back to profiles
        </Link>
        <h1 className="mt-3 text-3xl font-semibold text-ink">
          Merge Duplicate Profiles
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-700">
          Merging is permanent for now. The duplicate profile will be marked as
          merged, not deleted.
        </p>
      </div>

      <MergeProfilesForm
        initialPrimaryProfile={primaryPrefill.profile}
        initialDuplicateProfile={duplicatePrefill.profile}
        prefillWarnings={prefillWarnings}
      />
    </section>
  );
}

async function loadPrefilledProfile(
  profileId: string | undefined,
  label: string
): Promise<{
  profile: PrefilledProfile | null;
  warning: string | null;
}> {
  if (!profileId) {
    return {
      profile: null,
      warning: null
    };
  }

  try {
    const profile = await getProfileById(profileId);

    if (profile.isMerged) {
      return {
        profile: null,
        warning: `${label} was already merged. Choose another profile.`
      };
    }

    return {
      profile: {
        id: profile.id,
        fullName: profile.fullName
      },
      warning: null
    };
  } catch (error) {
    if (error instanceof ProfileNotFoundError) {
      return {
        profile: null,
        warning: `${label} could not be found. Choose another profile.`
      };
    }

    return {
      profile: null,
      warning: `${label} could not be loaded. Choose another profile.`
    };
  }
}
