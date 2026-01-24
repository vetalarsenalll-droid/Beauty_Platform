import { cookies, headers } from "next/headers";
import { jsonError, jsonOk } from "@/lib/api";
import { getAuthCookies, refreshSession } from "@/lib/auth";

export async function POST() {
  const headerStore = await headers();
  const authHeader =
    headerStore.get("authorization") ?? headerStore.get("Authorization");

  let refreshToken: string | null = null;

  if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
    refreshToken = authHeader.slice(7).trim();
  } else {
    const cookieStore = await cookies();
    const { REFRESH_COOKIE } = getAuthCookies();
    refreshToken = cookieStore.get(REFRESH_COOKIE)?.value ?? null;
  }

  if (!refreshToken) {
    return jsonError("UNAUTHENTICATED", "Refresh token missing", null, 401);
  }

  const refreshed = await refreshSession(refreshToken, "PLATFORM");
  if (!refreshed) {
    return jsonError("UNAUTHENTICATED", "Refresh token invalid", null, 401);
  }

  const { ACCESS_COOKIE, REFRESH_COOKIE } = getAuthCookies();
  const cookieStore = await cookies();
  cookieStore.set(ACCESS_COOKIE, refreshed.accessToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: refreshed.accessExpiresAt,
  });
  cookieStore.set(REFRESH_COOKIE, refreshed.refreshToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: refreshed.refreshExpiresAt,
  });

  return jsonOk({
    accessToken: refreshed.accessToken,
    refreshToken: refreshed.refreshToken,
    accessExpiresAt: refreshed.accessExpiresAt.toISOString(),
    refreshExpiresAt: refreshed.refreshExpiresAt.toISOString(),
  });
}
