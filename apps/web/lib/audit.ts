import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type AuditInput = {
  adminId: number;
  action: string;
  targetType: string;
  targetId?: string | number | null;
  ipAddress?: string | null;
  diffJson?: Record<string, unknown> | null;
};

export async function logPlatformAudit(entry: AuditInput) {
  await prisma.platformAuditLog.create({
    data: {
      adminId: entry.adminId,
      action: entry.action,
      targetType: entry.targetType,
      targetId:
        entry.targetId === undefined || entry.targetId === null
          ? null
          : String(entry.targetId),
      ipAddress: entry.ipAddress ?? null,
      diffJson:
        entry.diffJson === undefined || entry.diffJson === null
          ? Prisma.JsonNull
          : (entry.diffJson as Prisma.InputJsonValue),
    },
  });
}
