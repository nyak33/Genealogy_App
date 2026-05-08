"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { formatDate } from "@/lib/utils/format-date";

type RelationshipType = "father" | "mother" | "spouse" | "child";
type ParentRole = "father" | "mother";

type PossibleDuplicate = {
  id: string;
  fullName: string;
  dateOfBirth: string | null;
  dateOfDeath: string | null;
};

type QuickAddPayload = {
  relationshipType: RelationshipType;
  profile: {
    fullName: string;
    dateOfBirth?: string;
    dateOfDeath?: string;
    gender?: string;
    notes?: string;
    isDeceased: boolean;
  };
  confirmCreateDifferentPerson?: boolean;
  childParentRole?: ParentRole;
  confirmParentAgeWarning?: boolean;
};

type RelationshipPayload = {
  personId: string;
  relatedPersonId: string;
  relationshipType: "father" | "mother" | "spouse";
  confirmParentAgeWarning?: boolean;
};

type PendingAgeConfirmation =
  | {
      type: "quick-add";
      payload: QuickAddPayload;
    }
  | {
      type: "existing-link";
      payload: RelationshipPayload;
    };

type QuickAddRelativeFormProps = {
  currentProfile: {
    id: string;
    fullName: string;
    dateOfBirth: Date | string | null;
    gender: string | null;
  };
  relationshipType: RelationshipType;
  onCancel: () => void;
  onSaved: () => void;
};

export function QuickAddRelativeForm({
  currentProfile,
  relationshipType,
  onCancel,
  onSaved
}: QuickAddRelativeFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [possibleDuplicates, setPossibleDuplicates] = useState<
    PossibleDuplicate[]
  >([]);
  const [pendingQuickAddPayload, setPendingQuickAddPayload] =
    useState<QuickAddPayload | null>(null);
  const [pendingAgeConfirmation, setPendingAgeConfirmation] =
    useState<PendingAgeConfirmation | null>(null);
  const [childParentRole, setChildParentRole] = useState<ParentRole | "">("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const needsChildParentRole =
    relationshipType === "child" &&
    currentProfile.gender !== "male" &&
    currentProfile.gender !== "female";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPossibleDuplicates([]);
    setPendingAgeConfirmation(null);

    if (needsChildParentRole && !childParentRole) {
      setError("Choose whether the current profile is father or mother.");
      return;
    }

    const formData = new FormData(event.currentTarget);
    const payload: QuickAddPayload = {
      relationshipType,
      profile: {
        fullName: String(formData.get("fullName") ?? ""),
        dateOfBirth: String(formData.get("dateOfBirth") ?? "") || undefined,
        dateOfDeath: String(formData.get("dateOfDeath") ?? "") || undefined,
        gender: String(formData.get("gender") ?? "") || undefined,
        notes: String(formData.get("notes") ?? "") || undefined,
        isDeceased: formData.get("isDeceased") === "on"
      },
      childParentRole: needsChildParentRole
        ? (childParentRole as ParentRole)
        : undefined
    };

    await submitQuickAdd(payload);
  }

  async function submitQuickAdd(payload: QuickAddPayload) {
    setIsSubmitting(true);
    setError(null);

    const response = await fetch(
      `/api/profiles/${currentProfile.id}/quick-add-relative`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      }
    );
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      if (
        data.code === "PARENT_AGE_WARNING" &&
        data.requiresConfirmation === true
      ) {
        setPendingAgeConfirmation({
          type: "quick-add",
          payload
        });
      setError(
        getContextualErrorMessage(
          data.error ?? "Please confirm the parent and child dates.",
          relationshipType,
          currentProfile.fullName
        )
      );
        setIsSubmitting(false);
        return;
      }

      if (Array.isArray(data.possibleDuplicates)) {
        setPossibleDuplicates(data.possibleDuplicates);
        setPendingQuickAddPayload(payload);
        setError(null);
        setIsSubmitting(false);
        return;
      }

      setError(
        getContextualErrorMessage(
          data.error ?? "Unable to quick-add relative.",
          relationshipType,
          currentProfile.fullName
        )
      );
      setIsSubmitting(false);
      return;
    }

    setIsSubmitting(false);
    onSaved();
  }

  async function submitExistingRelationship(payload: RelationshipPayload) {
    setIsSubmitting(true);
    setError(null);

    const response = await fetch("/api/relationships", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      if (
        data.code === "PARENT_AGE_WARNING" &&
        data.requiresConfirmation === true
      ) {
        setPendingAgeConfirmation({
          type: "existing-link",
          payload
        });
        setError(
          getContextualErrorMessage(
            data.error ?? "Please confirm the parent and child dates.",
            relationshipType,
            currentProfile.fullName
          )
        );
        setIsSubmitting(false);
        return;
      }

      setError(
        getContextualErrorMessage(
          data.error ?? "Unable to link existing profile.",
          relationshipType,
          currentProfile.fullName
        )
      );
      setIsSubmitting(false);
      return;
    }

    setIsSubmitting(false);
    onSaved();
  }

  async function handleCreateDifferentPerson() {
    if (!pendingQuickAddPayload) {
      return;
    }

    await submitQuickAdd({
      ...pendingQuickAddPayload,
      confirmCreateDifferentPerson: true
    });
  }

  async function handleConfirmParentAgeWarning() {
    if (!pendingAgeConfirmation) {
      return;
    }

    if (pendingAgeConfirmation.type === "quick-add") {
      await submitQuickAdd({
        ...pendingAgeConfirmation.payload,
        confirmParentAgeWarning: true
      });
      return;
    }

    await submitExistingRelationship({
      ...pendingAgeConfirmation.payload,
      confirmParentAgeWarning: true
    });
  }

  function handleLinkExistingProfile(duplicate: PossibleDuplicate) {
    try {
      const payload = buildExistingRelationshipPayload(duplicate.id);
      void submitExistingRelationship(payload);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to link profile.");
    }
  }

  function buildExistingRelationshipPayload(
    selectedProfileId: string
  ): RelationshipPayload {
    if (relationshipType === "father") {
      return {
        personId: currentProfile.id,
        relatedPersonId: selectedProfileId,
        relationshipType: "father"
      };
    }

    if (relationshipType === "mother") {
      return {
        personId: currentProfile.id,
        relatedPersonId: selectedProfileId,
        relationshipType: "mother"
      };
    }

    if (relationshipType === "spouse") {
      return {
        personId: currentProfile.id,
        relatedPersonId: selectedProfileId,
        relationshipType: "spouse"
      };
    }

    const resolvedParentRole =
      currentProfile.gender === "male"
        ? "father"
        : currentProfile.gender === "female"
          ? "mother"
          : childParentRole;

    if (resolvedParentRole !== "father" && resolvedParentRole !== "mother") {
      throw new Error("Choose whether the current profile is father or mother.");
    }

    return {
      personId: selectedProfileId,
      relatedPersonId: currentProfile.id,
      relationshipType: resolvedParentRole
    };
  }

  const relationshipName = relationshipLabel(relationshipType);
  const title = `Add ${relationshipName} for ${currentProfile.fullName}`;
  const defaultGender = getDefaultGender({
    relationshipType,
    currentProfileGender: currentProfile.gender
  });

  return (
    <section className="space-y-4 rounded border border-moss/30 bg-white p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-base font-semibold text-ink">{title}</h3>
          <p className="mt-1 text-sm leading-6 text-neutral-700">
            {relationshipDescription(relationshipType, currentProfile.fullName)}
          </p>
          <p className="mt-2 text-xs font-medium text-neutral-600">
            Current profile birth date: {formatDate(currentProfile.dateOfBirth)}
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="w-fit rounded border border-line px-3 py-1 text-sm font-medium text-neutral-700 transition hover:border-moss hover:text-moss"
        >
          Cancel
        </button>
      </div>

      {error ? (
        <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {possibleDuplicates.length > 0 ? (
        <div className="space-y-4 rounded border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
          <div>
            <p className="font-semibold">Possible duplicate profiles found.</p>
            <p className="mt-1 text-amber-900">
              Link an existing profile, or continue only if this is a different
              person.
            </p>
          </div>
          <ul className="divide-y divide-amber-200 rounded border border-amber-200 bg-white">
            {possibleDuplicates.map((duplicate) => (
              <li key={duplicate.id} className="p-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <Link
                      href={`/profiles/${duplicate.id}`}
                      className="font-medium text-moss hover:text-ink"
                    >
                      {duplicate.fullName}
                    </Link>
                    <p className="mt-1 text-xs text-neutral-700">
                      Birth: {formatDate(duplicate.dateOfBirth)} | Death:{" "}
                      {formatDate(duplicate.dateOfDeath)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleLinkExistingProfile(duplicate)}
                    disabled={isSubmitting}
                    className="w-fit rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900 transition hover:border-amber-500 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Link this existing profile
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={handleCreateDifferentPerson}
            disabled={isSubmitting}
            className="rounded bg-ink px-4 py-2 text-sm font-semibold text-white transition hover:bg-moss disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Creating..." : "Create as different person"}
          </button>
        </div>
      ) : null}

      {pendingAgeConfirmation ? (
        <button
          type="button"
          onClick={handleConfirmParentAgeWarning}
          disabled={isSubmitting}
          className="rounded border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-900 transition hover:border-amber-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? "Saving..." : "Confirm and save"}
        </button>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block">
          <span className="text-sm font-medium text-ink">Full Name</span>
          <input
            name="fullName"
            required
            className="mt-2 w-full rounded border border-line px-3 py-2 text-sm outline-none transition focus:border-moss"
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium text-ink">Date of Birth</span>
            <input
              name="dateOfBirth"
              type="date"
              className="mt-2 w-full rounded border border-line px-3 py-2 text-sm outline-none transition focus:border-moss"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-ink">Date of Death</span>
            <input
              name="dateOfDeath"
              type="date"
              className="mt-2 w-full rounded border border-line px-3 py-2 text-sm outline-none transition focus:border-moss"
            />
          </label>
        </div>

        <label className="block">
          <span className="text-sm font-medium text-ink">Gender</span>
          <select
            name="gender"
            defaultValue={defaultGender}
            className="mt-2 w-full rounded border border-line px-3 py-2 text-sm outline-none transition focus:border-moss"
          >
            <option value="">Not recorded</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="unknown">Unknown</option>
            <option value="other">Other</option>
          </select>
        </label>

        {needsChildParentRole ? (
          <label className="block">
            <span className="text-sm font-medium text-ink">
              Current Profile Role
            </span>
            <select
              value={childParentRole}
              onChange={(event) =>
                setChildParentRole(event.target.value as ParentRole | "")
              }
              className="mt-2 w-full rounded border border-line px-3 py-2 text-sm outline-none transition focus:border-moss"
            >
              <option value="">Choose role</option>
              <option value="father">Current profile is father</option>
              <option value="mother">Current profile is mother</option>
            </select>
          </label>
        ) : null}

        <label className="block">
          <span className="text-sm font-medium text-ink">Notes</span>
          <textarea
            name="notes"
            rows={4}
            className="mt-2 w-full rounded border border-line px-3 py-2 text-sm outline-none transition focus:border-moss"
          />
        </label>

        <label className="flex items-center gap-3 text-sm text-ink">
          <input
            name="isDeceased"
            type="checkbox"
            className="h-4 w-4 rounded border-line"
          />
          Mark as deceased
        </label>

        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded bg-moss px-4 py-2 text-sm font-semibold text-white transition hover:bg-ink disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting
              ? "Saving..."
              : `Create and Link ${relationshipName}`}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded border border-line px-4 py-2 text-sm font-semibold text-ink transition hover:border-moss hover:text-moss"
          >
            Cancel
          </button>
        </div>
      </form>
    </section>
  );
}

function relationshipDescription(
  relationshipType: RelationshipType,
  profileName: string
) {
  const descriptions = {
    father: `Create a new profile and link it as the biological father of ${profileName}.`,
    mother: `Create a new profile and link it as the biological mother of ${profileName}.`,
    spouse: `Create a new profile and link it as a spouse of ${profileName}.`,
    child: `Create a new profile and link it as a child of ${profileName}.`
  } satisfies Record<RelationshipType, string>;

  return descriptions[relationshipType];
}

function relationshipLabel(relationshipType: RelationshipType) {
  const labels = {
    father: "Father",
    mother: "Mother",
    spouse: "Spouse",
    child: "Child"
  } satisfies Record<RelationshipType, string>;

  return labels[relationshipType];
}

function getDefaultGender({
  relationshipType,
  currentProfileGender
}: {
  relationshipType: RelationshipType;
  currentProfileGender: string | null;
}) {
  if (relationshipType === "father") {
    return "male";
  }

  if (relationshipType === "mother") {
    return "female";
  }

  if (relationshipType === "spouse") {
    if (currentProfileGender === "male") {
      return "female";
    }

    if (currentProfileGender === "female") {
      return "male";
    }
  }

  return "";
}

function getContextualErrorMessage(
  message: string,
  relationshipType: RelationshipType,
  profileName: string
) {
  if (
    message === "Parent must be born before the child." &&
    (relationshipType === "father" || relationshipType === "mother")
  ) {
    return `${message} You are adding a ${relationshipType} for ${profileName}.`;
  }

  return message;
}
