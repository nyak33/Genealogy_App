import Link from "next/link";
import { formatDate } from "@/lib/utils/format-date";

export type TreePerson = {
  id: string;
  fullName: string;
  dateOfBirth: Date | null;
  dateOfDeath: Date | null;
};

type TreePersonCardProps = {
  label: string;
  person?: TreePerson | null;
  emptyMessage: string;
  highlight?: boolean;
};

export function TreePersonCard({
  label,
  person,
  emptyMessage,
  highlight = false
}: TreePersonCardProps) {
  return (
    <div
      className={[
        "min-h-32 rounded border p-4",
        highlight
          ? "border-moss bg-white shadow-sm"
          : "border-line bg-white"
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
        </div>
      ) : (
        <p className="mt-3 text-sm leading-6 text-neutral-600">
          {emptyMessage}
        </p>
      )}
    </div>
  );
}

function PersonDates({ person }: { person: TreePerson }) {
  const details = [
    person.dateOfBirth ? `Birth: ${formatDate(person.dateOfBirth)}` : null,
    person.dateOfDeath ? `Death: ${formatDate(person.dateOfDeath)}` : null
  ].filter(Boolean);

  if (details.length === 0) {
    return (
      <p className="mt-2 text-xs text-neutral-600">No dates recorded.</p>
    );
  }

  return (
    <p className="mt-2 text-xs text-neutral-600">{details.join(" | ")}</p>
  );
}
