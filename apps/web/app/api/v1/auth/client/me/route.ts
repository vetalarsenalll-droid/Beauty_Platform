import { headers } from "next/headers";
import { getClientSession, getClientSessionByToken } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/api";
import { buildClientMePayload } from "@/lib/client-me";

export async function GET(request: Request) {
  const headerStore = await headers();
  const authHeader =
    headerStore.get("authorization") ?? headerStore.get("Authorization");

  let session = null;
  if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
    const token = authHeader.slice(7).trim();
    session = await getClientSessionByToken(token);
  } else {
    session = await getClientSession();
  }

  if (!session) {
    return jsonError("UNAUTHORIZED", "Сессия не найдена", {}, 401);
  }

  const url = new URL(request.url);
  const accountSlug = url.searchParams.get("account");

  return jsonOk(await buildClientMePayload(session, accountSlug));
}
