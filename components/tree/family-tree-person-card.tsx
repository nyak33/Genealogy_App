import Link from "next/link";
import { formatDate } from "@/lib/utils/format-date";
import type { TreeProfile } from "@/lib/services/tree-service";

type FamilyTreePersonCardProps = {
  label: string;
  person?: TreeProfile | null;
  emptyMessage: string;
  highlight?: boolean;
  details?: string[];
};

export function FamilyTreePersonCard({
  label,
  person,
  emptyMessage,
  highlight = false,
  details = []
}: FamilyTreePersonCardProps) {
  return (
    <div
      className={[
        "min-h-32 rounded border bg-white p-4",
        highlight ? "border-moss shadow-sm" : "border-line"
      ].join(" ")}
    >
      <p className="text-xs font-semibold uppercase text-neutral-500">
        {label}
      </p>
      {person ? (
        <div className="mt-3">
          <Link
            href={`/profiles/${person.id}`}
            className="text-base font-semibold text-moss hover:text-ink"
          >
            {person.fullName}
          </Link>
          <PersonDates person={person} />
          {details.length > 0 ? (
            <div className="mt-3 space-y-1 text-xs text-neutral-700">
              {details.map((detail) => (
                <p key={detail}>{detail}</p>
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <p className="mt-3 text-sm leading-6 text-neutral-600">
          {emptyMessage}
        </p>
      )}
    </div>
  );
}

function PersonDates({ person }: { person: TreeProfile }) {
  const details = [
    person.dateOfBirth ? `Birth: ${formatDate(person.dateOfBirth)}` : null,
    person.dateOfDeath ? `Death: ${formatDate(person.dateOfDeath)}` : null
  ].filter(Boolean);

  if (details.length === 0) {
    return <p className="mt-2 text-xs text-neutral-600">No dates recorded.</p>;
  }

  return <p className="mt-2 text-xs text-neutral-600">{details.join(" | ")}</p>;
}
