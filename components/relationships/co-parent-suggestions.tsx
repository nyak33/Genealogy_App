"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { CoParentSuggestion } from "@/lib/services/co-parent-suggestion-service";

type CoParentSuggestionsProps = {
  suggestions: CoParentSuggestion[];
};

export function CoParentSuggestions({
  suggestions
}: CoParentSuggestionsProps) {
  const router = useRouter();
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (suggestions.length === 0) {
    return null;
  }

  async function handleAddSpouseLink(suggestion: CoParentSuggestion) {
    setPendingKey(getSuggestionKey(suggestion));
    setError(null);

    const response = await fetch("/api/relationships", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        personId: suggestion.father.id,
        relatedPersonId: suggestion.mother.id,
        relationshipType: "spouse"
      })
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data.error ?? "Unable to add spouse link.");
      setPendingKey(null);
      return;
    }

    setPendingKey(null);
    router.refresh();
  }

  return (
    <section className="space-y-4 rounded border border-amber-200 bg-amber-50 p-6">
      <div>
        <h2 className="text-xl font-semibold text-ink">
          Possible Co-Parent / Spouse Link
        </h2>
        <p className="mt-2 text-sm leading-6 text-amber-900">
          These suggestions come from shared biological parent links. Add a
          spouse link only if that relationship is correct.
        </p>
      </div>

      {error ? (
        <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <ul className="space-y-3">
        {suggestions.map((suggestion) => {
          const suggestionKey = getSuggestionKey(suggestion);
          const isPending = pendingKey === suggestionKey;

          return (
            <li
              key={suggestionKey}
              className="rounded border border-amber-200 bg-white px-4 py-4"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <p className="text-sm leading-6 text-neutral-800">
                  Possible co-parent/spouse link detected:{" "}
                  <ProfileLink
                    id={suggestion.father.id}
                    fullName={suggestion.father.fullName}
                  />{" "}
                  and{" "}
                  <ProfileLink
                    id={suggestion.mother.id}
                    fullName={suggestion.mother.fullName}
                  />{" "}
                  are both parents of{" "}
                  <ProfileLink
                    id={suggestion.child.id}
                    fullName={suggestion.child.fullName}
                  />
                  .
                </p>
                <button
                  type="button"
                  onClick={() => handleAddSpouseLink(suggestion)}
                  disabled={Boolean(pendingKey)}
                  className="w-fit rounded bg-moss px-4 py-2 text-sm font-semibold text-white transition hover:bg-ink disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isPending ? "Adding..." : "Add spouse link"}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function ProfileLink({ id, fullName }: { id: string; fullName: string }) {
  return (
    <Link href={`/profiles/${id}`} className="font-semibold text-moss">
      {fullName}
    </Link>
  );
}

function getSuggestionKey(suggestion: CoParentSuggestion) {
  return [
    suggestion.child.id,
    suggestion.father.id,
    suggestion.mother.id
  ].join(":");
}
