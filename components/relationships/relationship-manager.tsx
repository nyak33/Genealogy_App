"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AddRelationshipForm } from "@/components/relationships/add-relationship-form";
import type {
  ProfileRelationships,
  RelationshipProfileLink
} from "@/lib/services/relationship-service";
import { formatDate } from "@/lib/utils/format-date";

type RelationshipManagerProps = {
  profile: {
    id: string;
    gender: string | null;
  };
  relationships: ProfileRelationships;
};

export function RelationshipManager({
  profile,
  relationships
}: RelationshipManagerProps) {
  const router = useRouter();
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDelete(relationshipId: string) {
    setDeleteError(null);
    setDeletingId(relationshipId);

    const response = await fetch(`/api/relationships/${relationshipId}`, {
      method: "DELETE"
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setDeleteError(data.error ?? "Unable to delete relationship.");
      setDeletingId(null);
      return;
    }

    setDeletingId(null);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <section className="space-y-6 rounded border border-line bg-white p-6">
        <div>
          <h2 className="text-xl font-semibold text-ink">Immediate Family</h2>
          <p className="mt-2 text-sm leading-6 text-neutral-700">
            Direct family links stored as profile relationships.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <RelationshipGroup
            title="Father"
            emptyMessage="No father linked yet."
            links={relationships.father}
            deletingId={deletingId}
            onDelete={handleDelete}
          />
          <RelationshipGroup
            title="Mother"
            emptyMessage="No mother linked yet."
            links={relationships.mother}
            deletingId={deletingId}
            onDelete={handleDelete}
          />
          <RelationshipGroup
            title="Spouse / Spouses"
            emptyMessage="No spouse linked yet."
            links={relationships.spouses}
            deletingId={deletingId}
            onDelete={handleDelete}
          />
          <RelationshipGroup
            title="Children"
            emptyMessage="No children linked yet."
            links={relationships.children}
            deletingId={deletingId}
            onDelete={handleDelete}
          />
        </div>
      </section>

      <section className="space-y-5 rounded border border-line bg-white p-6">
        <div>
          <h2 className="text-xl font-semibold text-ink">
            Add / Manage Relationships
          </h2>
          <p className="mt-2 text-sm leading-6 text-neutral-700">
            Search for an existing profile, choose the relationship type, and
            save the link. Remove only incorrect relationship links here.
          </p>
        </div>

        {deleteError ? (
          <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {deleteError}
          </div>
        ) : null}

        <div>
          <AddRelationshipForm
            profile={profile}
            onSaved={() => router.refresh()}
          />
        </div>
      </section>
    </div>
  );
}

function RelationshipGroup({
  title,
  emptyMessage,
  links,
  deletingId,
  onDelete
}: {
  title: string;
  emptyMessage: string;
  links: RelationshipProfileLink[];
  deletingId: string | null;
  onDelete: (relationshipId: string) => Promise<void>;
}) {
  return (
    <div className="rounded border border-line bg-paper p-4">
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      {links.length === 0 ? (
        <p className="mt-3 text-sm text-neutral-600">{emptyMessage}</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {links.map((link) => (
            <li
              key={link.relationshipId}
              className="rounded border border-line bg-white px-3 py-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Link
                    href={`/profiles/${link.profile.id}`}
                    className="text-sm font-semibold text-moss hover:text-ink"
                  >
                    {link.profile.fullName}
                  </Link>
                  <RelatedProfileDates link={link} />
                </div>
                <button
                  type="button"
                  onClick={() => onDelete(link.relationshipId)}
                  disabled={deletingId === link.relationshipId}
                  className="rounded border border-line px-2 py-1 text-xs font-medium text-neutral-600 transition hover:border-red-300 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {deletingId === link.relationshipId ? "Removing..." : "Remove"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RelatedProfileDates({ link }: { link: RelationshipProfileLink }) {
  const details = [
    link.profile.dateOfBirth
      ? `Birth: ${formatDate(link.profile.dateOfBirth)}`
      : null,
    link.profile.dateOfDeath
      ? `Death: ${formatDate(link.profile.dateOfDeath)}`
      : null
  ].filter(Boolean);

  if (details.length === 0) {
    return (
      <p className="mt-1 text-xs text-neutral-600">No dates recorded.</p>
    );
  }

  return (
    <p className="mt-1 text-xs text-neutral-600">{details.join(" | ")}</p>
  );
}
