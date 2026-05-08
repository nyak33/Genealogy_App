"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useState } from "react";
import {
  SearchableProfileSelector,
  type SelectedProfile
} from "@/components/profiles/searchable-profile-selector";
import { formatDate } from "@/lib/utils/format-date";

type MergeProfile = {
  id: string;
  fullName: string;
  dateOfBirth: string | null;
  dateOfDeath: string | null;
  gender: string | null;
  notes: string | null;
  isDeceased: boolean;
};

type FieldPreview = {
  field: string;
  primaryValue: unknown;
  duplicateValue: unknown;
};

type RelationshipPreview = {
  relationshipId: string;
  original: {
    personId: string;
    relatedPersonId: string;
    relationshipType: string;
  };
  replacement: {
    personId: string;
    relatedPersonId: string;
    relationshipType: string;
  };
};

type RelationshipSkip = RelationshipPreview & {
  reason: string;
  message: string;
};

type MergeWarning = {
  code: string;
  message: string;
  relationshipId: string;
};

type MergePreview = {
  primaryProfile: MergeProfile;
  duplicateProfile: MergeProfile;
  fieldsToCopy: FieldPreview[];
  fieldConflicts: FieldPreview[];
  relationshipsToMove: RelationshipPreview[];
  relationshipsToDeleteAsRedundant: RelationshipPreview[];
  relationshipsToSkip: RelationshipSkip[];
  warnings: MergeWarning[];
};

type MergeResult = {
  primaryProfile: MergeProfile;
  duplicateProfile: MergeProfile;
  fieldsCopied: FieldPreview[];
  fieldConflicts: FieldPreview[];
  relationshipsMoved: RelationshipPreview[];
  relationshipsDeletedAsRedundant: RelationshipPreview[];
  relationshipsSkipped: RelationshipSkip[];
  warnings: MergeWarning[];
};

type MergeProfilesFormProps = {
  initialPrimaryProfile: SelectedProfile | null;
  initialDuplicateProfile: SelectedProfile | null;
  prefillWarnings: string[];
};

export function MergeProfilesForm({
  initialPrimaryProfile,
  initialDuplicateProfile,
  prefillWarnings
}: MergeProfilesFormProps) {
  const [primaryProfile, setPrimaryProfile] = useState<SelectedProfile | null>(
    initialPrimaryProfile
  );
  const [duplicateProfile, setDuplicateProfile] =
    useState<SelectedProfile | null>(initialDuplicateProfile);
  const [preview, setPreview] = useState<MergePreview | null>(null);
  const [mergeResult, setMergeResult] = useState<MergeResult | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [isMergeLoading, setIsMergeLoading] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handlePrimarySelect(profile: SelectedProfile) {
    setPrimaryProfile(profile);
    clearMergeState();
  }

  function handleDuplicateSelect(profile: SelectedProfile) {
    setDuplicateProfile(profile);
    clearMergeState();
  }

  function clearMergeState() {
    setPreview(null);
    setMergeResult(null);
    setIsConfirmed(false);
    setError(null);
  }

  async function handlePreviewMerge() {
    if (!primaryProfile || !duplicateProfile) {
      return;
    }

    setIsPreviewLoading(true);
    setError(null);
    setPreview(null);
    setMergeResult(null);
    setIsConfirmed(false);

    try {
      const response = await fetch("/api/profiles/merge/preview", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          primaryId: primaryProfile.id,
          duplicateId: duplicateProfile.id
        })
      });
      const payload = await response.json();

      if (!response.ok) {
        setError(payload.error ?? "Unable to preview merge.");
        return;
      }

      setPreview(payload.preview);
    } catch {
      setError("Unable to preview merge.");
    } finally {
      setIsPreviewLoading(false);
    }
  }

  async function handleConfirmMerge() {
    if (!primaryProfile || !duplicateProfile || !preview || !isConfirmed) {
      return;
    }

    setIsMergeLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/profiles/merge", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          primaryId: primaryProfile.id,
          duplicateId: duplicateProfile.id
        })
      });
      const payload = await response.json();

      if (!response.ok) {
        setError(payload.error ?? "Unable to merge profiles.");
        return;
      }

      setMergeResult(payload.mergeResult);
      setPreview(null);
      setIsConfirmed(false);
    } catch {
      setError("Unable to merge profiles.");
    } finally {
      setIsMergeLoading(false);
    }
  }

  const canPreview =
    Boolean(primaryProfile && duplicateProfile) &&
    primaryProfile?.id !== duplicateProfile?.id &&
    !isPreviewLoading;

  return (
    <>
      <section className="space-y-5 rounded border border-line bg-white p-6">
        <StepHeader
          step="Step 1"
          title="Choose profiles"
          description="The profile to keep remains active. The duplicate profile will be marked as merged, not deleted."
        />

        {prefillWarnings.length > 0 ? (
          <div className="space-y-1 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {prefillWarnings.map((warning) => (
              <p key={warning}>{warning}</p>
            ))}
          </div>
        ) : null}

        <div className="grid gap-5 md:grid-cols-2">
          <SearchableProfileSelector
            key={primaryProfile?.id ?? "empty-primary-profile"}
            label="Profile to keep"
            selectedProfile={primaryProfile}
            onSelect={handlePrimarySelect}
          />
          <SearchableProfileSelector
            key={duplicateProfile?.id ?? "empty-duplicate-profile"}
            label="Profile to merge into kept profile"
            selectedProfile={duplicateProfile}
            onSelect={handleDuplicateSelect}
          />
        </div>

        {primaryProfile && duplicateProfile && primaryProfile.id === duplicateProfile.id ? (
          <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            The profile to keep and the profile to merge must be different.
          </p>
        ) : null}

        {error ? (
          <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        <button
          type="button"
          onClick={handlePreviewMerge}
          disabled={!canPreview}
          className="rounded bg-moss px-4 py-2 text-sm font-semibold text-white transition hover:bg-ink disabled:cursor-not-allowed disabled:bg-neutral-300"
        >
          {isPreviewLoading ? "Previewing..." : "Preview merge"}
        </button>
      </section>

      {preview ? (
        <section className="space-y-5 rounded border border-line bg-white p-6">
          <StepHeader
            step="Step 2"
            title="Preview merge"
            description="Review copied fields, conflicts, relationship changes, skipped links, and warnings before confirming."
          />
          <ProfilePairSummary preview={preview} />
          <FieldSection title="Fields to copy" fields={preview.fieldsToCopy} />
          <FieldSection title="Field conflicts" fields={preview.fieldConflicts} />
          <RelationshipSection
            title="Relationships to move"
            relationships={preview.relationshipsToMove}
          />
          <RelationshipSection
            title="Redundant relationships to delete"
            relationships={preview.relationshipsToDeleteAsRedundant}
          />
          <SkippedRelationshipSection relationships={preview.relationshipsToSkip} />
          <WarningSection warnings={preview.warnings} />

          <div className="space-y-3 border-t border-line pt-5">
            <StepHeader
              step="Step 3"
              title="Confirm merge"
              description="Confirm only after the preview looks right."
            />
            <label className="flex items-start gap-2 text-sm text-neutral-700">
              <input
                type="checkbox"
                checked={isConfirmed}
                onChange={(event) => setIsConfirmed(event.target.checked)}
                className="mt-1"
              />
              I understand the duplicate profile will be marked as merged into
              the kept profile.
            </label>
            <button
              type="button"
              onClick={handleConfirmMerge}
              disabled={!isConfirmed || isMergeLoading}
              className="rounded bg-moss px-4 py-2 text-sm font-semibold text-white transition hover:bg-ink disabled:cursor-not-allowed disabled:bg-neutral-300"
            >
              {isMergeLoading ? "Merging..." : "Confirm merge"}
            </button>
          </div>
        </section>
      ) : null}

      {mergeResult ? (
        <section className="rounded border border-green-200 bg-green-50 p-6">
          <h2 className="text-xl font-semibold text-green-900">
            Profile merged successfully
          </h2>
          <p className="mt-2 text-sm text-green-800">
            {mergeResult.duplicateProfile.fullName} was marked as merged into{" "}
            {mergeResult.primaryProfile.fullName}.
          </p>
          <Link
            href={`/profiles/${mergeResult.primaryProfile.id}`}
            className="mt-4 inline-block text-sm font-semibold text-moss hover:text-ink"
          >
            Open kept profile
          </Link>
        </section>
      ) : null}
    </>
  );
}

function StepHeader({
  step,
  title,
  description
}: {
  step: string;
  title: string;
  description: string;
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase text-neutral-500">{step}</p>
      <h2 className="mt-1 text-xl font-semibold text-ink">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-neutral-700">{description}</p>
    </div>
  );
}

function ProfilePairSummary({ preview }: { preview: MergePreview }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <ProfileSummaryCard label="Profile to keep" profile={preview.primaryProfile} />
      <ProfileSummaryCard
        label="Profile to merge"
        profile={preview.duplicateProfile}
      />
    </div>
  );
}

function ProfileSummaryCard({
  label,
  profile
}: {
  label: string;
  profile: MergeProfile;
}) {
  return (
    <div className="rounded border border-line bg-paper p-4">
      <p className="text-xs font-semibold uppercase text-neutral-500">{label}</p>
      <Link
        href={`/profiles/${profile.id}`}
        className="mt-2 block font-semibold text-moss hover:text-ink"
      >
        {profile.fullName}
      </Link>
      <p className="mt-1 text-xs text-neutral-600">
        Birth: {formatDate(profile.dateOfBirth)} | Death:{" "}
        {formatDate(profile.dateOfDeath)}
      </p>
    </div>
  );
}

function FieldSection({
  title,
  fields
}: {
  title: string;
  fields: FieldPreview[];
}) {
  return (
    <PreviewSection title={title} emptyMessage="None.">
      {fields.length ? (
        <ul className="space-y-2">
          {fields.map((field) => (
            <li
              key={field.field}
              className="rounded border border-line bg-paper px-3 py-2 text-sm"
            >
              <span className="font-semibold text-ink">
                {formatFieldName(field.field)}
              </span>
              : kept profile {formatValue(field.primaryValue)} | duplicate{" "}
              {formatValue(field.duplicateValue)}
            </li>
          ))}
        </ul>
      ) : null}
    </PreviewSection>
  );
}

function RelationshipSection({
  title,
  relationships
}: {
  title: string;
  relationships: RelationshipPreview[];
}) {
  return (
    <PreviewSection title={title} emptyMessage="None.">
      {relationships.length ? (
        <ul className="space-y-2">
          {relationships.map((relationship) => (
            <li
              key={relationship.relationshipId}
              className="rounded border border-line bg-paper px-3 py-2 text-sm"
            >
              <RelationshipLine relationship={relationship} />
            </li>
          ))}
        </ul>
      ) : null}
    </PreviewSection>
  );
}

function SkippedRelationshipSection({
  relationships
}: {
  relationships: RelationshipSkip[];
}) {
  return (
    <PreviewSection title="Relationships skipped" emptyMessage="None.">
      {relationships.length ? (
        <ul className="space-y-2">
          {relationships.map((relationship) => (
            <li
              key={relationship.relationshipId}
              className="rounded border border-line bg-paper px-3 py-2 text-sm"
            >
              <RelationshipLine relationship={relationship} />
              <p className="mt-1 text-xs text-neutral-600">
                {relationship.message}
              </p>
            </li>
          ))}
        </ul>
      ) : null}
    </PreviewSection>
  );
}

function WarningSection({ warnings }: { warnings: MergeWarning[] }) {
  return (
    <PreviewSection title="Warnings" emptyMessage="None.">
      {warnings.length ? (
        <ul className="space-y-2">
          {warnings.map((warning) => (
            <li
              key={`${warning.code}-${warning.relationshipId}`}
              className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
            >
              {warning.message}
            </li>
          ))}
        </ul>
      ) : null}
    </PreviewSection>
  );
}

function PreviewSection({
  title,
  emptyMessage,
  children
}: {
  title: string;
  emptyMessage: string;
  children: ReactNode;
}) {
  const hasContent =
    children !== null &&
    children !== undefined &&
    !(Array.isArray(children) && children.length === 0);

  return (
    <section>
      <h3 className="text-sm font-semibold uppercase text-neutral-500">
        {title}
      </h3>
      <div className="mt-2">
        {hasContent ? (
          children
        ) : (
          <p className="rounded border border-dashed border-line bg-paper px-3 py-2 text-sm text-neutral-600">
            {emptyMessage}
          </p>
        )}
      </div>
    </section>
  );
}

function RelationshipLine({
  relationship
}: {
  relationship: RelationshipPreview;
}) {
  return (
    <div>
      <p className="font-semibold text-ink">
        {relationship.original.personId} -{" "}
        {relationship.original.relationshipType} -{" "}
        {relationship.original.relatedPersonId}
      </p>
      <p className="mt-1 text-xs text-neutral-600">
        becomes {relationship.replacement.personId} -{" "}
        {relationship.replacement.relationshipType} -{" "}
        {relationship.replacement.relatedPersonId}
      </p>
    </div>
  );
}

function formatFieldName(field: string) {
  return field.replace(/([A-Z])/g, " $1").toLowerCase();
}

function formatValue(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "empty";
  }

  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return formatDate(value);
  }

  return String(value);
}
