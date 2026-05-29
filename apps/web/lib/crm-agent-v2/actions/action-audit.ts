import { logAccountAudit } from "@/lib/crm-audit";
import type { CrmAgentActionContext, CrmAgentActionDefinition, CrmAgentActionPreview } from "./types";

export type CrmAgentActionAuditInput = {
  action: CrmAgentActionDefinition;
  ctx: CrmAgentActionContext;
  targetType: string;
  targetId?: string | number | null;
  preview?: CrmAgentActionPreview | null;
  result?: Record<string, unknown> | null;
};

export async function logCrmAgentActionAudit(input: CrmAgentActionAuditInput) {
  if (input.ctx.userId == null) return;
  await logAccountAudit({
    accountId: input.ctx.accountId,
    userId: input.ctx.userId,
    action: input.action.name,
    targetType: input.targetType,
    targetId: input.targetId ?? null,
    diffJson: {
      actionName: input.action.name,
      sessionId: input.ctx.sessionId,
      risk: input.action.risk,
      permission: input.action.permission,
      before: input.preview?.before ?? null,
      after: input.preview?.after ?? null,
      diff: input.preview?.diff ?? [],
      warnings: input.preview?.warnings ?? [],
      result: input.result ?? null,
    },
  });
}
