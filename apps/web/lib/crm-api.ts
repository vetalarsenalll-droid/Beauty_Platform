import {
  getCrmAuthCookies,
  getCrmSessionByToken,
  refreshSession,
} from "@/lib/auth";
import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api";

type CrmSession = NonNullable<
  Awaited<ReturnType<typeof getCrmSessionByToken>>
>;

type CrmAuthResult =
  | { session: CrmSession; accessToken?: string; accessExpiresAt?: Date }
  | { response: NextResponse };

export async function requireCrmApiPermission(
  permission?: string
): Promise<CrmAuthResult> {
  const headerStore = await headers();
  const authHeader =
    headerStore.get("authorization") ?? headerStore.get("Authorization");

  let session: CrmSession | null = null;

  if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
    const token = authHeader.slice(7).trim();
    session = await getCrmSessionByToken(token);
    if (!session) {
      return {
        response: jsonError("UNAUTHENTICATED", "Auth required", null, 401),
      };
    }
  } else {
    const cookieStore = await cookies();
    const { ACCESS_COOKIE, REFRESH_COOKIE } = getCrmAuthCookies();
    const accessToken = cookieStore.get(ACCESS_COOKIE)?.value;
    const refreshToken = cookieStore.get(REFRESH_COOKIE)?.value;

    if (accessToken) {
      session = await getCrmSessionByToken(accessToken);
    }

    if (!session && refreshToken) {
      const refreshed = await refreshSession(refreshToken, "CRM");
      if (refreshed) {
        session = await getCrmSessionByToken(refreshed.accessToken);
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
    !session.permissions.includes(permission) &&
    !session.permissions.includes("crm.all")
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

export function applyCrmAccessCookie(
  response: NextResponse,
  auth: { accessToken?: string; accessExpiresAt?: Date }
) {
  if (!auth.accessToken || !auth.accessExpiresAt) return response;
  const { ACCESS_COOKIE } = getCrmAuthCookies();
  response.cookies.set(ACCESS_COOKIE, auth.accessToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: auth.accessExpiresAt,
  });
  return response;
}
