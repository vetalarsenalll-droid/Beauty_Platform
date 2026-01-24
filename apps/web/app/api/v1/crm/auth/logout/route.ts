import { cookies } from "next/headers";
import { clearSession, getCrmAuthCookies } from "@/lib/auth";

export async function POST() {
  const cookieStore = await cookies();
  const { ACCESS_COOKIE, REFRESH_COOKIE } = getCrmAuthCookies();
  const accessToken = cookieStore.get(ACCESS_COOKIE)?.value;
  const refreshToken = cookieStore.get(REFRESH_COOKIE)?.value;

  if (accessToken) {
    await clearSession(accessToken);
  }
  if (refreshToken) {
    await clearSession(refreshToken);
  }

  cookieStore.set(ACCESS_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  cookieStore.set(REFRESH_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });

  return Response.json({ data: { ok: true } });
}
