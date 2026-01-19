import { headers } from "next/headers";
import { getPlatformSession, getPlatformSessionByToken } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/api";

export async function GET() {
  const headerStore = await headers();
  const authHeader =
    headerStore.get("authorization") ?? headerStore.get("Authorization");

  let session = null;
  if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
    const token = authHeader.slice(7).trim();
    session = await getPlatformSessionByToken(token);
  } else {
    session = await getPlatformSession();
  }

  if (!session) {
    return jsonError("UNAUTHORIZED", "Не удалось проверить сессию", {}, 401);
  }

  return jsonOk({
    user: {
      id: session.userId,
      email: session.email,
    },
    permissions: session.permissions,
  });
}
