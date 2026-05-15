import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import {
  ACCESS_COOKIE_NAME,
  isAccessPasswordConfigured,
  isValidAccessToken,
  shouldRequireAccess
} from "@/lib/access-control";
import "./globals.css";

export const metadata: Metadata = {
  title: "Genealogy App",
  description: "Private-first family profile and relationship records"
};

export const dynamic = "force-dynamic";

export default async function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const hasPrivateAccess = await getHasPrivateAccess();

  return (
    <html lang="en">
      <body>
        <header className="border-b border-line bg-paper">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-4">
            <Link href="/profiles" className="text-lg font-semibold text-ink">
              Genealogy
            </Link>
            <nav
              aria-label="Primary navigation"
              className="flex flex-wrap items-center gap-2"
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
              {hasPrivateAccess ? (
                <form action="/api/private-access/logout" method="post">
                  <button
                    type="submit"
                    className="rounded border border-line px-3 py-2 text-sm font-medium text-ink transition hover:border-moss hover:text-moss"
                  >
                    Sign Out
                  </button>
                </form>
              ) : null}
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-5 py-8">{children}</main>
      </body>
    </html>
  );
}

async function getHasPrivateAccess() {
  if (!shouldRequireAccess() || !isAccessPasswordConfigured()) {
    return false;
  }

  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ACCESS_COOKIE_NAME)?.value;

  return isValidAccessToken(accessToken);
}
