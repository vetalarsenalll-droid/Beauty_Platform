import type { Prisma } from "@prisma/client";
import type { CrmAgentRiskLevel } from "@/lib/crm-agent-types";

export const CRM_AGENT_AUTOPILOT_MEMORY_KEY = "autopilot.settings";

export type CrmAgentAutopilotLevel = "off" | "suggest" | "draft" | "execute_safe" | "full_confirmed";

export type CrmAgentAutopilotSettings = {
  level: CrmAgentAutopilotLevel;
  safeDomains: string[];
  requireConfirmationFor: string[];
};

export const CRM_AGENT_AUTOPILOT_LEVELS: CrmAgentAutopilotLevel[] = [
  "off",
  "suggest",
  "draft",
  "execute_safe",
  "full_confirmed",
];

export const defaultCrmAgentAutopilotSettings: CrmAgentAutopilotSettings = {
  level: "off",
  safeDomains: ["memory"],
  requireConfirmationFor: ["prices", "mass_notifications", "reviews", "appointment_cancellations", "site_changes"],
};

const riskRank: Record<CrmAgentRiskLevel, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}

function riskLevel(value: unknown): CrmAgentRiskLevel {
  return value === "low" || value === "medium" || value === "high" || value === "critical" ? value : "medium";
}

export function normalizeCrmAgentAutopilotSettings(value: unknown): CrmAgentAutopilotSettings {
  if (!isRecord(value)) return defaultCrmAgentAutopilotSettings;
  const level = CRM_AGENT_AUTOPILOT_LEVELS.includes(value.level as CrmAgentAutopilotLevel)
    ? (value.level as CrmAgentAutopilotLevel)
    : defaultCrmAgentAutopilotSettings.level;
  const safeDomains = stringArray(value.safeDomains);
  const requireConfirmationFor = stringArray(value.requireConfirmationFor);
  return {
    level,
    safeDomains: safeDomains.length ? safeDomains : defaultCrmAgentAutopilotSettings.safeDomains,
    requireConfirmationFor: requireConfirmationFor.length
      ? requireConfirmationFor
      : defaultCrmAgentAutopilotSettings.requireConfirmationFor,
  };
}

export function crmAgentAutopilotSettingsFromMemory(
  memory: Array<{ key: string; value: Prisma.JsonValue }> | null | undefined,
) {
  const item = memory?.find((entry) => entry.key === CRM_AGENT_AUTOPILOT_MEMORY_KEY);
  return normalizeCrmAgentAutopilotSettings(item?.value);
}

export function classifyCrmAgentAction(actionType: string, payload: Prisma.JsonValue) {
  const payloadObject = isRecord(payload) ? payload : {};
  if (actionType.startsWith("appointment.")) {
    return {
      domain: "appointments",
      confirmationReasons: actionType === "appointment.cancel" ? ["appointment_cancellations"] : [],
    };
  }
  if (actionType.startsWith("notification.campaign.")) {
    return { domain: "notifications", confirmationReasons: ["mass_notifications"] };
  }
  if (actionType.startsWith("notification.")) {
    return { domain: "notifications", confirmationReasons: [] };
  }
  if (actionType.startsWith("site.")) {
    return { domain: "site", confirmationReasons: ["site_changes"] };
  }
  if (actionType.startsWith("review.")) {
    return { domain: "reviews", confirmationReasons: ["reviews"] };
  }
  if (actionType.startsWith("service.")) {
    const touchesPrice = payloadObject.basePrice !== undefined || payloadObject.price !== undefined;
    return { domain: "services", confirmationReasons: touchesPrice ? ["prices"] : [] };
  }
  if (actionType.startsWith("promo.")) {
    return { domain: "promos", confirmationReasons: ["prices"] };
  }
  if (actionType.startsWith("specialist.")) {
    return { domain: actionType.includes("schedule") ? "schedule" : "specialists", confirmationReasons: [] };
  }
  if (actionType.startsWith("location.")) {
    return { domain: "locations", confirmationReasons: [] };
  }
  if (actionType === "memory.update" || actionType === "autopilot.setting.update") {
    return { domain: "memory", confirmationReasons: [] };
  }
  return { domain: "other", confirmationReasons: [] };
}

export function canAutopilotExecuteCrmAgentAction(input: {
  settings: CrmAgentAutopilotSettings;
  actionType: string;
  riskLevel: string;
  payload: Prisma.JsonValue;
}) {
  if (input.settings.level !== "execute_safe" && input.settings.level !== "full_confirmed") {
    return { allowed: false, reason: "level_does_not_execute" };
  }

  const classification = classifyCrmAgentAction(input.actionType, input.payload);
  if (!input.settings.safeDomains.includes(classification.domain)) {
    return { allowed: false, reason: "domain_not_safe", domain: classification.domain };
  }

  const blockedReason = classification.confirmationReasons.find((reason) =>
    input.settings.requireConfirmationFor.includes(reason),
  );
  if (blockedReason) {
    return { allowed: false, reason: blockedReason, domain: classification.domain };
  }

  const maxRisk: CrmAgentRiskLevel = input.settings.level === "execute_safe" ? "low" : "medium";
  if (riskRank[riskLevel(input.riskLevel)] > riskRank[maxRisk]) {
    return { allowed: false, reason: "risk_too_high", domain: classification.domain };
  }

  return { allowed: true, reason: "allowed", domain: classification.domain };
}
