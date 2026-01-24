import { prisma } from "@/lib/prisma";

type AccountAuditInput = {
  accountId: number;
  userId: number;
  action: string;
  targetType: string;
  targetId?: string | number | null;
  ipAddress?: string | null;
  diffJson?: Record<string, unknown> | null;
};

export async function logAccountAudit(entry: AccountAuditInput) {
  await prisma.accountAuditLog.create({
    data: {
      accountId: entry.accountId,
      userId: entry.userId,
      action: entry.action,
      targetType: entry.targetType,
      targetId:
        entry.targetId === undefined || entry.targetId === null
          ? null
          : String(entry.targetId),
      ipAddress: entry.ipAddress ?? null,
      diffJson: entry.diffJson ?? null,
    },
  });
}
