import { getAuthCookies, getPlatformSessionByToken, refreshSession } from "@/lib/auth";
import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api";

type PlatformSession = NonNullable<
  Awaited<ReturnType<typeof getPlatformSessionByToken>>
>;

type PlatformAuthResult =
  | { session: PlatformSession; accessToken?: string; accessExpiresAt?: Date }
  | { response: NextResponse };

export async function requirePlatformApiPermission(
  permission?: string
): Promise<PlatformAuthResult> {
  const headerStore = await headers();
  const authHeader =
    headerStore.get("authorization") ?? headerStore.get("Authorization");

  let session: PlatformSession | null = null;

  if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
    const token = authHeader.slice(7).trim();
    session = await getPlatformSessionByToken(token);
    if (!session) {
      return {
        response: jsonError("UNAUTHENTICATED", "Auth required", null, 401),
      };
    }
  } else {
    const cookieStore = await cookies();
    const { ACCESS_COOKIE, REFRESH_COOKIE } = getAuthCookies();
    const accessToken = cookieStore.get(ACCESS_COOKIE)?.value;
    const refreshToken = cookieStore.get(REFRESH_COOKIE)?.value;

    if (accessToken) {
      session = await getPlatformSessionByToken(accessToken);
    }

    if (!session && refreshToken) {
      const refreshed = await refreshSession(refreshToken);
      if (refreshed) {
        session = await getPlatformSessionByToken(refreshed.accessToken);
        if (session) {
          return {
            session,
            accessToken: refreshed.accessToken,
            accessExpiresAt: refreshed.accessExpiresAt,
          };
        }
      }
    }
  }

  if (!session) {
    return {
      response: jsonError("UNAUTHENTICATED", "Auth required", null, 401),
    };
  }

  if (
    permission &&
    !session.permissions.includes("platform.all") &&
    !session.permissions.includes(permission)
  ) {
    return {
      response: jsonError(
        "FORBIDDEN",
        "Insufficient permissions",
        { permission },
        403
      ),
    };
  }

  return { session };
}

export function applyAccessCookie(
  response: NextResponse,
  auth: { accessToken?: string; accessExpiresAt?: Date }
) {
  if (!auth.accessToken || !auth.accessExpiresAt) return response;
  const { ACCESS_COOKIE } = getAuthCookies();
  response.cookies.set(ACCESS_COOKIE, auth.accessToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: auth.accessExpiresAt,
  });
  return response;
}
