"use client";

export function PrintTreeButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded border border-line px-4 py-2 text-sm font-semibold text-ink transition hover:border-moss hover:text-moss print:hidden"
    >
      Print Tree
    </button>
  );
}
