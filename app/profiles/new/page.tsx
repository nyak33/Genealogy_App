import Link from "next/link";
import { ProfileForm } from "@/components/profiles/profile-form";

export default function NewProfilePage() {
  return (
    <section className="mx-auto max-w-2xl space-y-6">
      <div className="border-b border-line pb-5">
        <Link href="/profiles" className="text-sm font-medium text-moss">
          Back to profiles
        </Link>
        <h1 className="mt-3 text-3xl font-semibold text-ink">Add Profile</h1>
      </div>

      <div className="rounded border border-line bg-white p-6">
        <ProfileForm mode="create" />
      </div>
    </section>
  );
}
