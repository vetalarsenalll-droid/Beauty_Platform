import { getPlatformSession, getPlatformSessionByToken } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api";

type PlatformSession = NonNullable<Awaited<ReturnType<typeof getPlatformSession>>>;

type PlatformAuthResult =
  | { session: PlatformSession }
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
    session = await getPlatformSession();
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
