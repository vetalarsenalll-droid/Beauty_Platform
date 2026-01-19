import { prisma } from "@/lib/prisma";
import { jsonOk } from "@/lib/api";
import { requirePlatformApiPermission } from "@/lib/platform-api";

export async function GET() {
  const auth = await requirePlatformApiPermission("platform.monitoring");
  if ("response" in auth) return auth.response;

  const [pending, processing, done, failed, dead] = await Promise.all([
    prisma.outboxItem.count({ where: { status: "PENDING" } }),
    prisma.outboxItem.count({ where: { status: "PROCESSING" } }),
    prisma.outboxItem.count({ where: { status: "DONE" } }),
    prisma.outboxItem.count({ where: { status: "FAILED" } }),
    prisma.outboxItem.count({ where: { status: "DEAD" } }),
  ]);

  const recent = await prisma.outboxItem.findMany({
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      id: true,
      eventName: true,
      status: true,
      createdAt: true,
      accountId: true,
      scope: true,
    },
  });

  return jsonOk({
    counts: { pending, processing, done, failed, dead },
    recent: recent.map((item) => ({
      ...item,
      createdAt: item.createdAt.toISOString(),
    })),
  });
}
