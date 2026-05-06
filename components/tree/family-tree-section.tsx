import type { ReactNode } from "react";

type FamilyTreeSectionProps = {
  title: string;
  children: ReactNode;
};

export function FamilyTreeSection({ title, children }: FamilyTreeSectionProps) {
  return (
    <section className="rounded border border-line bg-paper p-5">
      <h2 className="text-lg font-semibold text-ink">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}
