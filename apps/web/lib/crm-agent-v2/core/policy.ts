import { getAiAccountAccessByAccountIds } from "@/lib/ai-billing";
import { getCrmAgentAction } from "./actions";
import { getCrmAgentTool } from "./tools";
import type { CrmAgentRiskLevel } from "./types";

export type CrmAgentPolicyDecision = {
  allowed: boolean;
  reason?: string;
  requiresConfirmation: boolean;
  risk: CrmAgentRiskLevel;
};

export type CrmAgentPolicyContext = {
  accountId: number;
  permissions: string[];
  maxAutoRisk?: CrmAgentRiskLevel;
};

const riskRank: Record<CrmAgentRiskLevel, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

export async function checkCrmAgentFeaturePolicy(accountId: number) {
  const accessByAccount = await getAiAccountAccessByAccountIds([accountId]);
  const access = accessByAccount.get(accountId);
  if (!access) return { allowed: true as const };
  if (!access.aiEnabled) return { allowed: false as const, reason: "ai_disabled" };
  if (!access.crmAgentEnabled) return { allowed: false as const, reason: "crm_agent_disabled" };
  return { allowed: true as const };
}

export function checkCrmAgentToolPolicy(ctx: CrmAgentPolicyContext, toolName: string): CrmAgentPolicyDecision {
  const tool = getCrmAgentTool(toolName);
  if (!tool) {
    return { allowed: false, reason: "unknown_tool", requiresConfirmation: false, risk: "low" };
  }
  if (tool.permission && !hasPermission(ctx.permissions, tool.permission)) {
    return { allowed: false, reason: "missing_permission", requiresConfirmation: false, risk: tool.risk };
  }
  const requiresConfirmation = tool.mode === "execute" || exceedsAutoRisk(tool.risk, ctx.maxAutoRisk ?? "medium");
  return { allowed: true, requiresConfirmation, risk: tool.risk };
}

export function checkCrmAgentActionPolicy(ctx: CrmAgentPolicyContext, actionName: string): CrmAgentPolicyDecision {
  const action = getCrmAgentAction(actionName);
  if (!action) {
    return { allowed: false, reason: "unknown_action", requiresConfirmation: false, risk: "low" };
  }
  if (action.permission !== "self" && !hasPermission(ctx.permissions, action.permission)) {
    return { allowed: false, reason: "missing_permission", requiresConfirmation: false, risk: action.risk };
  }
  const requiresConfirmation =
    action.confirmation === "always" ||
    action.confirmation === "medium_plus" ||
    exceedsAutoRisk(action.risk, ctx.maxAutoRisk ?? "medium");
  return { allowed: true, requiresConfirmation, risk: action.risk };
}

export function canAutoExecuteCrmAgentRisk(risk: CrmAgentRiskLevel, maxAutoRisk: CrmAgentRiskLevel = "medium") {
  return !exceedsAutoRisk(risk, maxAutoRisk);
}

export function compareCrmAgentRisk(a: CrmAgentRiskLevel, b: CrmAgentRiskLevel) {
  return riskRank[a] - riskRank[b];
}

function exceedsAutoRisk(risk: CrmAgentRiskLevel, maxAutoRisk: CrmAgentRiskLevel) {
  return riskRank[risk] > riskRank[maxAutoRisk];
}

function hasPermission(permissions: string[], permission: string) {
  return permissions.includes("crm.all") || permissions.includes(permission);
}
