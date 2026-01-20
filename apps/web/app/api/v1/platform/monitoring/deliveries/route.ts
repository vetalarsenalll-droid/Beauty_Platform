import { prisma } from "@/lib/prisma";
import { jsonOk } from "@/lib/api";
import { applyAccessCookie, requirePlatformApiPermission } from "@/lib/platform-api";

export async function GET() {
  const auth = await requirePlatformApiPermission("platform.monitoring");
  if ("response" in auth) return auth.response;

  const [queued, sent, failed, dead] = await Promise.all([
    prisma.deliveryLog.count({ where: { status: "QUEUED" } }),
    prisma.deliveryLog.count({ where: { status: "SENT" } }),
    prisma.deliveryLog.count({ where: { status: "FAILED" } }),
    prisma.deliveryLog.count({ where: { status: "DEAD" } }),
  ]);

  const recent = await prisma.deliveryLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      id: true,
      channel: true,
      status: true,
      target: true,
      attempt: true,
      createdAt: true,
      errorCode: true,
    },
  });

  const response = jsonOk({
    counts: { queued, sent, failed, dead },
    recent: recent.map((item) => ({
      ...item,
      createdAt: item.createdAt.toISOString(),
    })),
  });
  return applyAccessCookie(response, auth);
}
