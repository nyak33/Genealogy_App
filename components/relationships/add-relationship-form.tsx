"use client";

import { FormEvent, useState } from "react";
import {
  SearchableProfileSelector,
  type SelectedProfile
} from "@/components/profiles/searchable-profile-selector";

type RelationshipType = "father" | "mother" | "spouse" | "child";
type ParentRole = "father" | "mother";

type AddRelationshipFormProps = {
  profile: {
    id: string;
    gender: string | null;
  };
  onSaved: () => void;
};

export function AddRelationshipForm({ profile, onSaved }: AddRelationshipFormProps) {
  const [relationshipType, setRelationshipType] =
    useState<RelationshipType>("father");
  const [selectedProfile, setSelectedProfile] =
    useState<SelectedProfile | null>(null);
  const [parentRole, setParentRole] = useState<ParentRole | "">("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectorKey, setSelectorKey] = useState(0);

  const needsParentRole =
    relationshipType === "child" &&
    profile.gender !== "male" &&
    profile.gender !== "female";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!selectedProfile) {
      setError("Select a profile first.");
      return;
    }

    if (needsParentRole && !parentRole) {
      setError("Choose whether the current profile is father or mother.");
      return;
    }

    setIsSubmitting(true);

    const payload = buildRelationshipPayload();
    const response = await fetch("/api/relationships", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      setError(data.error ?? "Unable to save relationship.");
      setIsSubmitting(false);
      return;
    }

    setSelectedProfile(null);
    setParentRole("");
    setSelectorKey((value) => value + 1);
    setIsSubmitting(false);
    onSaved();
  }

  function buildRelationshipPayload() {
    if (!selectedProfile) {
      throw new Error("A selected profile is required.");
    }

    if (relationshipType === "child") {
      const resolvedParentRole =
        profile.gender === "male"
          ? "father"
          : profile.gender === "female"
            ? "mother"
            : parentRole;

      return {
        personId: selectedProfile.id,
        relatedPersonId: profile.id,
        relationshipType: resolvedParentRole
      };
    }

    return {
      personId: profile.id,
      relatedPersonId: selectedProfile.id,
      relationshipType
    };
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error ? (
        <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <label className="block">
        <span className="text-sm font-medium text-ink">Relationship Type</span>
        <select
          value={relationshipType}
          onChange={(event) => {
            setRelationshipType(event.target.value as RelationshipType);
            setError(null);
          }}
          className="mt-2 w-full rounded border border-line px-3 py-2 text-sm outline-none transition focus:border-moss"
        >
          <option value="father">Father</option>
          <option value="mother">Mother</option>
          <option value="spouse">Spouse</option>
          <option value="child">Child</option>
        </select>
      </label>

      {needsParentRole ? (
        <label className="block">
          <span className="text-sm font-medium text-ink">
            Current Profile Role
          </span>
          <select
            value={parentRole}
            onChange={(event) => setParentRole(event.target.value as ParentRole)}
            className="mt-2 w-full rounded border border-line px-3 py-2 text-sm outline-none transition focus:border-moss"
          >
            <option value="">Choose role</option>
            <option value="father">Current profile is father</option>
            <option value="mother">Current profile is mother</option>
          </select>
        </label>
      ) : null}

      <SearchableProfileSelector
        key={selectorKey}
        label={relationshipType === "child" ? "Child Profile" : "Related Profile"}
        selectedProfile={selectedProfile}
        onSelect={setSelectedProfile}
      />

      {selectedProfile ? (
        <p className="text-xs text-neutral-600">
          Selected: {selectedProfile.fullName}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded bg-moss px-4 py-2 text-sm font-semibold text-white transition hover:bg-ink disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? "Saving..." : "Save Relationship"}
      </button>
    </form>
  );
}
