import type { CrmAgentActionDefinition, CrmAgentActionRisk } from "./types";

const riskRank: Record<CrmAgentActionRisk, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

export function isPlannerVisibleAction(action: CrmAgentActionDefinition) {
  return action.status === "implemented" || action.status === "draft_only" || action.status === "read_only" || action.status === "planned";
}

export function isExecutableAction(action: CrmAgentActionDefinition) {
  return action.status === "implemented" && typeof action.execute === "function";
}

export function isPreviewableAction(action: CrmAgentActionDefinition) {
  return typeof action.preview === "function";
}

export function requiresConfirmationByRisk(action: CrmAgentActionDefinition) {
  return action.confirmation === "always" || action.confirmation === "separate_sensitive_confirm" || riskRank[action.risk] >= riskRank.high;
}
