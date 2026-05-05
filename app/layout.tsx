import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Genealogy App",
  description: "Private-first family profile and relationship records"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <header className="border-b border-line bg-paper">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
            <Link href="/profiles" className="text-lg font-semibold text-ink">
              Genealogy
            </Link>
            <nav
              aria-label="Primary navigation"
              className="flex items-center gap-2"
            >
              <Link
                href="/profiles"
                className="rounded border border-line px-3 py-2 text-sm font-medium text-ink transition hover:border-moss hover:text-moss"
              >
                Profiles
              </Link>
              <Link
                href="/data-quality"
                className="rounded border border-line px-3 py-2 text-sm font-medium text-ink transition hover:border-moss hover:text-moss"
              >
                Data Quality
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-5 py-8">{children}</main>
      </body>
    </html>
  );
}
