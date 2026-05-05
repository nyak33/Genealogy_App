"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type RemoveRelationshipButtonProps = {
  relationshipId: string;
};

export function RemoveRelationshipButton({
  relationshipId
}: RemoveRelationshipButtonProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);

  async function handleRemove() {
    setError(null);
    setIsRemoving(true);

    const response = await fetch(`/api/relationships/${relationshipId}`, {
      method: "DELETE"
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data.error ?? "Unable to remove relationship.");
      setIsRemoving(false);
      return;
    }

    setIsRemoving(false);
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleRemove}
        disabled={isRemoving}
        className="rounded border border-line px-2 py-1 text-xs font-medium text-neutral-600 transition hover:border-red-300 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isRemoving ? "Removing..." : "Remove link"}
      </button>
      {error ? <p className="text-xs text-red-700">{error}</p> : null}
    </div>
  );
}
