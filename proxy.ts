import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  ACCESS_COOKIE_NAME,
  isAccessPasswordConfigured,
  isValidAccessToken,
  shouldRequireAccess
} from "@/lib/access-control";

const PUBLIC_PATHS = new Set([
  "/private-access",
  "/api/private-access/login",
  "/api/private-access/logout"
]);

export function proxy(request: NextRequest) {
  if (!shouldRequireAccess()) {
    return NextResponse.next();
  }

  const { pathname, search } = request.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const accessToken = request.cookies.get(ACCESS_COOKIE_NAME)?.value;

  if (isValidAccessToken(accessToken)) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      {
        error: isAccessPasswordConfigured()
          ? "Private access required"
          : "APP_ACCESS_PASSWORD must be configured before public use"
      },
      { status: isAccessPasswordConfigured() ? 401 : 503 }
    );
  }

  const loginUrl = new URL("/private-access", request.url);

  if (isAccessPasswordConfigured()) {
    loginUrl.searchParams.set("next", `${pathname}${search}`);
  } else {
    loginUrl.searchParams.set("setup", "required");
  }

  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)"
  ]
};

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.has(pathname);
}
