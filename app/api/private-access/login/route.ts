import { NextResponse } from "next/server";
import {
  ACCESS_COOKIE_NAME,
  createAccessToken,
  getAccessCookieOptions,
  getAccessPassword,
  getSafeRedirectPath,
  isAccessPasswordConfigured,
  isSubmittedPasswordValid,
  shouldRequireAccess
} from "@/lib/access-control";

export async function POST(request: Request) {
  const formData = await request.formData();
  const nextPath = getSafeRedirectPath(getFormString(formData, "next"));

  if (!shouldRequireAccess()) {
    return NextResponse.redirect(new URL(nextPath, request.url), 303);
  }

  if (!isAccessPasswordConfigured()) {
    return NextResponse.redirect(
      new URL("/private-access?setup=required", request.url),
      303
    );
  }

  const accessPassword = getAccessPassword();

  if (!isSubmittedPasswordValid(formData.get("password"), accessPassword)) {
    const loginUrl = new URL("/private-access", request.url);
    loginUrl.searchParams.set("error", "1");
    loginUrl.searchParams.set("next", nextPath);

    return NextResponse.redirect(loginUrl, 303);
  }

  const response = NextResponse.redirect(new URL(nextPath, request.url), 303);
  response.cookies.set(
    ACCESS_COOKIE_NAME,
    createAccessToken(accessPassword),
    getAccessCookieOptions()
  );

  return response;
}

function getFormString(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value : null;
}
