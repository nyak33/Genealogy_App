"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AddRelationshipForm } from "@/components/relationships/add-relationship-form";
import type {
  ProfileRelationships,
  RelationshipProfileLink
} from "@/lib/services/relationship-service";

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
    <section className="space-y-6 rounded border border-line bg-white p-6">
      <div>
        <h2 className="text-lg font-semibold text-ink">Family Links</h2>
        <p className="mt-2 text-sm leading-6 text-neutral-700">
          Link existing profiles as immediate family members.
        </p>
      </div>

      {deleteError ? (
        <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {deleteError}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <RelationshipGroup
          title="Father"
          emptyMessage="No father linked."
          links={relationships.father}
          deletingId={deletingId}
          onDelete={handleDelete}
        />
        <RelationshipGroup
          title="Mother"
          emptyMessage="No mother linked."
          links={relationships.mother}
          deletingId={deletingId}
          onDelete={handleDelete}
        />
        <RelationshipGroup
          title="Spouses"
          emptyMessage="No spouse linked."
          links={relationships.spouses}
          deletingId={deletingId}
          onDelete={handleDelete}
        />
        <RelationshipGroup
          title="Children"
          emptyMessage="No children linked."
          links={relationships.children}
          deletingId={deletingId}
          onDelete={handleDelete}
        />
      </div>

      <div className="border-t border-line pt-5">
        <h3 className="text-base font-semibold text-ink">Add Relationship</h3>
        <div className="mt-4">
          <AddRelationshipForm
            profile={profile}
            onSaved={() => router.refresh()}
          />
        </div>
      </div>
    </section>
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
    <div className="rounded border border-line p-4">
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      {links.length === 0 ? (
        <p className="mt-3 text-sm text-neutral-600">{emptyMessage}</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {links.map((link) => (
            <li
              key={link.relationshipId}
              className="flex items-center justify-between gap-3 rounded bg-paper px-3 py-2"
            >
              <Link
                href={`/profiles/${link.profile.id}`}
                className="text-sm font-medium text-moss hover:text-ink"
              >
                {link.profile.fullName}
              </Link>
              <button
                type="button"
                onClick={() => onDelete(link.relationshipId)}
                disabled={deletingId === link.relationshipId}
                className="text-xs font-semibold text-red-700 hover:text-red-900 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {deletingId === link.relationshipId ? "Removing..." : "Remove"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
