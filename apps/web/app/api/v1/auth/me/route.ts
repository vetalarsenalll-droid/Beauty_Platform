import { getPlatformSession } from "@/lib/auth";

export async function GET() {
  const session = await getPlatformSession();
  if (!session) {
    return Response.json(
      {
        error: {
          code: "UNAUTHORIZED",
          message: "Нет активной сессии",
          details: {},
        },
      },
      { status: 401 }
    );
  }

  return Response.json({
    data: {
      user: {
        id: session.userId,
        email: session.email,
      },
      permissions: session.permissions,
    },
  });
}
