"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { formatDate, toDateInputValue } from "@/lib/utils/format-date";

type PossibleDuplicate = {
  id: string;
  fullName: string;
  dateOfBirth: string | null;
  dateOfDeath: string | null;
};

type ProfilePayload = {
  fullName: string;
  dateOfBirth?: string;
  dateOfDeath?: string;
  gender?: string;
  notes?: string;
  isDeceased: boolean;
  confirmCreateDifferentPerson?: boolean;
};

type ProfileFormValues = {
  id?: string;
  fullName?: string;
  dateOfBirth?: Date | string | null;
  dateOfDeath?: Date | string | null;
  gender?: string | null;
  notes?: string | null;
  isDeceased?: boolean;
};

type ProfileFormProps = {
  mode: "create" | "edit";
  profile?: ProfileFormValues;
};

export function ProfileForm({ mode, profile }: ProfileFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [possibleDuplicates, setPossibleDuplicates] = useState<
    PossibleDuplicate[]
  >([]);
  const [pendingPayload, setPendingPayload] = useState<ProfilePayload | null>(
    null
  );

  async function submitProfile(payload: ProfilePayload) {
    setError(null);
    setIsSubmitting(true);

    const endpoint =
      mode === "create" ? "/api/profiles" : `/api/profiles/${profile?.id}`;
    const response = await fetch(endpoint, {
      method: mode === "create" ? "POST" : "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (response.status === 409 && mode === "create") {
      setPossibleDuplicates(data.possibleDuplicates ?? []);
      setPendingPayload(payload);
      setError(null);
      setIsSubmitting(false);
      return;
    }

    if (!response.ok) {
      setError(data.error ?? "Unable to save profile");
      setIsSubmitting(false);
      return;
    }

    router.push(`/profiles/${data.profile.id}`);
    router.refresh();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPossibleDuplicates([]);
    setPendingPayload(null);

    const formData = new FormData(event.currentTarget);

    await submitProfile({
      fullName: String(formData.get("fullName") ?? ""),
      dateOfBirth: String(formData.get("dateOfBirth") ?? "") || undefined,
      dateOfDeath: String(formData.get("dateOfDeath") ?? "") || undefined,
      gender: String(formData.get("gender") ?? "") || undefined,
      notes: String(formData.get("notes") ?? "") || undefined,
      isDeceased: formData.get("isDeceased") === "on"
    });
  }

  async function handleConfirmDifferentPerson() {
    if (!pendingPayload) {
      return;
    }

    await submitProfile({
      ...pendingPayload,
      confirmCreateDifferentPerson: true
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error ? (
        <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {possibleDuplicates.length > 0 ? (
        <div className="space-y-4 rounded border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
          <div>
            <p className="font-semibold">Possible duplicate profiles found.</p>
            <p className="mt-1 text-amber-900">
              Open an existing profile, or continue only if this is a different
              person.
            </p>
          </div>
          <ul className="divide-y divide-amber-200 rounded border border-amber-200 bg-white">
            {possibleDuplicates.map((duplicate) => (
              <li key={duplicate.id} className="p-3">
                <Link
                  href={`/profiles/${duplicate.id}`}
                  className="font-medium text-moss hover:text-ink"
                >
                  {duplicate.fullName}
                </Link>
                <p className="mt-1 text-xs text-neutral-700">
                  Birth: {formatDate(duplicate.dateOfBirth)} · Death:{" "}
                  {formatDate(duplicate.dateOfDeath)}
                </p>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={handleConfirmDifferentPerson}
            disabled={isSubmitting}
            className="rounded bg-ink px-4 py-2 text-sm font-semibold text-white transition hover:bg-moss disabled:cursor-not-allowed disabled:opacity-60"
          >
            Create as different person
          </button>
        </div>
      ) : null}

      <label className="block">
        <span className="text-sm font-medium text-ink">Full Name</span>
        <input
          name="fullName"
          required
          defaultValue={profile?.fullName ?? ""}
          className="mt-2 w-full rounded border border-line px-3 py-2 text-sm outline-none transition focus:border-moss"
        />
      </label>

      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-medium text-ink">Date of Birth</span>
          <input
            name="dateOfBirth"
            type="date"
            defaultValue={toDateInputValue(profile?.dateOfBirth)}
            className="mt-2 w-full rounded border border-line px-3 py-2 text-sm outline-none transition focus:border-moss"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-ink">Date of Death</span>
          <input
            name="dateOfDeath"
            type="date"
            defaultValue={toDateInputValue(profile?.dateOfDeath)}
            className="mt-2 w-full rounded border border-line px-3 py-2 text-sm outline-none transition focus:border-moss"
          />
        </label>
      </div>

      <label className="block">
        <span className="text-sm font-medium text-ink">Gender</span>
        <select
          name="gender"
          defaultValue={profile?.gender ?? ""}
          className="mt-2 w-full rounded border border-line px-3 py-2 text-sm outline-none transition focus:border-moss"
        >
          <option value="">Not recorded</option>
          <option value="male">Male</option>
          <option value="female">Female</option>
          <option value="unknown">Unknown</option>
          <option value="other">Other</option>
        </select>
      </label>

      <label className="block">
        <span className="text-sm font-medium text-ink">Notes</span>
        <textarea
          name="notes"
          rows={5}
          defaultValue={profile?.notes ?? ""}
          className="mt-2 w-full rounded border border-line px-3 py-2 text-sm outline-none transition focus:border-moss"
        />
      </label>

      <label className="flex items-center gap-3 text-sm text-ink">
        <input
          name="isDeceased"
          type="checkbox"
          defaultChecked={profile?.isDeceased ?? false}
          className="h-4 w-4 rounded border-line"
        />
        Mark as deceased
      </label>

      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded bg-moss px-4 py-2 text-sm font-semibold text-white transition hover:bg-ink disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? "Saving..." : "Save Profile"}
      </button>
    </form>
  );
}
