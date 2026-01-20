import { prisma } from "@/lib/prisma";
import { jsonOk } from "@/lib/api";
import { applyAccessCookie, requirePlatformApiPermission } from "@/lib/platform-api";

export async function GET() {
  const auth = await requirePlatformApiPermission("platform.audit");
  if ("response" in auth) return auth.response;

  const logs = await prisma.platformAuditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      admin: { include: { user: true } },
    },
  });

  const response = jsonOk(
    logs.map((log) => ({
      id: log.id,
      action: log.action,
      targetType: log.targetType,
      targetId: log.targetId,
      ipAddress: log.ipAddress,
      diffJson: log.diffJson,
      createdAt: log.createdAt.toISOString(),
      admin: {
        id: log.adminId,
        email: log.admin.user.email,
      },
    }))
  );
  return applyAccessCookie(response, auth);
}
