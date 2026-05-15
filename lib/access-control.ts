import crypto from "node:crypto";

export const ACCESS_COOKIE_NAME = "genealogy_app_access";
export const ACCESS_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

const ACCESS_TOKEN_MESSAGE = "genealogy-app-private-access-v1";

type AccessEnv = {
  APP_ACCESS_PASSWORD?: string;
  NODE_ENV?: string;
};

export function getAccessPassword(env: AccessEnv = process.env) {
  return env.APP_ACCESS_PASSWORD?.trim() ?? "";
}

export function isAccessPasswordConfigured(env: AccessEnv = process.env) {
  return getAccessPassword(env).length > 0;
}

export function shouldRequireAccess(env: AccessEnv = process.env) {
  return isAccessPasswordConfigured(env) || env.NODE_ENV === "production";
}

export function createAccessToken(password = getAccessPassword()) {
  if (!password) {
    return "";
  }

  return crypto
    .createHmac("sha256", password)
    .update(ACCESS_TOKEN_MESSAGE)
    .digest("hex");
}

export function isValidAccessToken(
  token: string | undefined,
  password = getAccessPassword()
) {
  if (!token || !password) {
    return false;
  }

  const expected = createAccessToken(password);
  const tokenBuffer = Buffer.from(token, "hex");
  const expectedBuffer = Buffer.from(expected, "hex");

  if (tokenBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(tokenBuffer, expectedBuffer);
}

export function isSubmittedPasswordValid(
  submittedPassword: FormDataEntryValue | null,
  password = getAccessPassword()
) {
  if (typeof submittedPassword !== "string" || !password) {
    return false;
  }

  const submittedBuffer = Buffer.from(submittedPassword);
  const passwordBuffer = Buffer.from(password);

  if (submittedBuffer.length !== passwordBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(submittedBuffer, passwordBuffer);
}

export function getAccessCookieOptions() {
  return {
    httpOnly: true,
    maxAge: ACCESS_COOKIE_MAX_AGE_SECONDS,
    path: "/",
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production"
  };
}

export function getSafeRedirectPath(value: string | null | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/profiles";
  }

  if (value.startsWith("/api/") || value.startsWith("/private-access")) {
    return "/profiles";
  }

  return value;
}
