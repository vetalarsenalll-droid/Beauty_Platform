import { prisma } from "@/lib/prisma";
import { jsonOk } from "@/lib/api";
import { requirePlatformApiPermission } from "@/lib/platform-api";

export async function GET() {
  const auth = await requirePlatformApiPermission("platform.monitoring");
  if ("response" in auth) return auth.response;

  const [queued, sent, failed, dead] = await Promise.all([
    prisma.webhookDelivery.count({ where: { status: "QUEUED" } }),
    prisma.webhookDelivery.count({ where: { status: "SENT" } }),
    prisma.webhookDelivery.count({ where: { status: "FAILED" } }),
    prisma.webhookDelivery.count({ where: { status: "DEAD" } }),
  ]);

  const endpoints = await prisma.webhookEndpoint.findMany({
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      id: true,
      url: true,
      status: true,
      errorStreak: true,
      updatedAt: true,
    },
  });

  return jsonOk({
    counts: { queued, sent, failed, dead },
    endpoints: endpoints.map((item) => ({
      ...item,
      updatedAt: item.updatedAt.toISOString(),
    })),
  });
}
