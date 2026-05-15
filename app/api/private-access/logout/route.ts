import { NextResponse } from "next/server";
import {
  ACCESS_COOKIE_NAME,
  getAccessCookieOptions
} from "@/lib/access-control";

export async function POST(request: Request) {
  const response = NextResponse.redirect(
    new URL("/private-access", request.url),
    303
  );

  response.cookies.set(ACCESS_COOKIE_NAME, "", {
    ...getAccessCookieOptions(),
    maxAge: 0
  });

  return response;
}
