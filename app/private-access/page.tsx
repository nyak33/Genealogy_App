import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  ACCESS_COOKIE_NAME,
  getSafeRedirectPath,
  isAccessPasswordConfigured,
  isValidAccessToken,
  shouldRequireAccess
} from "@/lib/access-control";

export const dynamic = "force-dynamic";

type PrivateAccessPageProps = {
  searchParams: Promise<{
    error?: string;
    next?: string;
    setup?: string;
  }>;
};

export default async function PrivateAccessPage({
  searchParams
}: PrivateAccessPageProps) {
  const params = await searchParams;
  const nextPath = getSafeRedirectPath(params.next);

  if (!shouldRequireAccess()) {
    redirect(nextPath);
  }

  const passwordIsConfigured = isAccessPasswordConfigured();
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ACCESS_COOKIE_NAME)?.value;

  if (passwordIsConfigured && isValidAccessToken(accessToken)) {
    redirect(nextPath);
  }

  return (
    <section className="mx-auto max-w-md space-y-5 rounded border border-line bg-white p-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Private Access</h1>
        <p className="mt-2 text-sm leading-6 text-neutral-700">
          Enter the family archive password to continue.
        </p>
      </div>

      {!passwordIsConfigured ? (
        <div className="rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
          Set APP_ACCESS_PASSWORD in the deployment environment before making
          this app public.
        </div>
      ) : null}

      {passwordIsConfigured && params.error ? (
        <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          The password was not correct.
        </div>
      ) : null}

      {passwordIsConfigured ? (
        <form
          action="/api/private-access/login"
          method="post"
          className="space-y-4"
        >
          <input type="hidden" name="next" value={nextPath} />
          <label className="block">
            <span className="text-sm font-semibold text-ink">Password</span>
            <input
              autoComplete="current-password"
              autoFocus
              name="password"
              required
              type="password"
              className="mt-2 w-full rounded border border-line px-3 py-2 text-sm text-ink outline-none transition focus:border-moss"
            />
          </label>
          <button
            type="submit"
            className="w-full rounded bg-moss px-4 py-2 text-sm font-semibold text-white transition hover:bg-ink"
          >
            Continue
          </button>
        </form>
      ) : null}
    </section>
  );
}
