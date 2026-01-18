import { cookies } from "next/headers";
import { clearSession } from "@/lib/auth";

export async function POST() {
  const cookieStore = await cookies();
  const token = cookieStore.get("bp_session")?.value;
  if (token) {
    await clearSession(token);
  }

  cookieStore.set("bp_session", "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });

  return Response.json({ data: { ok: true } });
}
