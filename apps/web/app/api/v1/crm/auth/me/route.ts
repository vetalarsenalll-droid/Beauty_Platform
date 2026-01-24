import { headers } from "next/headers";
import { getCrmSession, getCrmSessionByToken } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/api";

export async function GET() {
  const headerStore = await headers();
  const authHeader =
    headerStore.get("authorization") ?? headerStore.get("Authorization");

  let session = null;
  if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
    const token = authHeader.slice(7).trim();
    session = await getCrmSessionByToken(token);
  } else {
    session = await getCrmSession();
  }

  if (!session) {
    return jsonError("UNAUTHORIZED", "Не удалось проверить сессию", {}, 401);
  }

  return jsonOk({
    user: {
      id: session.userId,
      email: session.email,
    },
    accountId: session.accountId,
    role: session.role,
    permissions: session.permissions,
  });
}
