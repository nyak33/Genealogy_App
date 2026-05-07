import type { ReactNode } from "react";

type FamilyTreeSectionProps = {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
};

export function FamilyTreeSection({
  title,
  description,
  children,
  className = ""
}: FamilyTreeSectionProps) {
  return (
    <section className={["space-y-4", className].filter(Boolean).join(" ")}>
      <div className="text-center">
        <h2 className="text-lg font-semibold text-ink print:text-black">
          {title}
        </h2>
        {description ? (
          <p className="mx-auto mt-1 max-w-2xl text-sm leading-6 text-neutral-600 print:text-neutral-700">
            {description}
          </p>
        ) : null}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}
