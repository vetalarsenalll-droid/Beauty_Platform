import type { CrmAgentPlannerPlan, CrmAgentPlannerStep } from "./planner";
import { canUseCrmAgentCatalogAction, getCrmAgentCatalogAction, type CrmAgentActionDefinition } from "../actions";
import { canUseCrmAgentTool, getCrmAgentTool, type CrmAgentRegisteredToolDefinition } from "./tools";
import type { CrmAgentRiskLevel } from "./types";

export type CrmAgentInspectionSeverity = "info" | "warning" | "error";

export type CrmAgentInspectionFinding = {
  severity: CrmAgentInspectionSeverity;
  code: string;
  message: string;
  stepOrder?: number;
  toolName?: string | null;
  actionName?: string | null;
};

export type CrmAgentInspectionResult = {
  ok: boolean;
  risk: CrmAgentRiskLevel;
  requiresConfirmation: boolean;
  findings: CrmAgentInspectionFinding[];
  allowedSteps: CrmAgentPlannerStep[];
  blockedSteps: CrmAgentPlannerStep[];
};

type InspectInput = {
  plan: CrmAgentPlannerPlan;
  permissions: string[];
  maxAutoRisk?: CrmAgentRiskLevel;
};

const riskRank: Record<CrmAgentRiskLevel, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

function higherRisk(a: CrmAgentRiskLevel, b: CrmAgentRiskLevel) {
  return riskRank[a] >= riskRank[b] ? a : b;
}

function stepFinding(
  step: CrmAgentPlannerStep,
  severity: CrmAgentInspectionSeverity,
  code: string,
  message: string,
): CrmAgentInspectionFinding {
  return {
    severity,
    code,
    message,
    stepOrder: step.order,
    toolName: step.toolName ?? null,
    actionName: step.actionName ?? null,
  };
}

export function inspectCrmAgentPlan(input: InspectInput): CrmAgentInspectionResult {
  const findings: CrmAgentInspectionFinding[] = [];
  const allowedSteps: CrmAgentPlannerStep[] = [];
  const blockedSteps: CrmAgentPlannerStep[] = [];
  const maxAutoRisk = input.maxAutoRisk ?? "medium";
  let risk: CrmAgentRiskLevel = "low";
  let requiresConfirmation = false;

  if (input.plan.status === "unsupported") {
    findings.push({
      severity: "error",
      code: "unsupported_goal",
      message: "Planner marked the goal as unsupported.",
    });
  }

  if (input.plan.status === "needs_clarification") {
    findings.push({
      severity: "info",
      code: "needs_clarification",
      message: input.plan.clarificationQuestion || "Planner needs more information from the user.",
    });
  }

  for (const step of input.plan.steps) {
    const inspection = inspectCrmAgentPlanStep(step, input.permissions);
    risk = higherRisk(risk, inspection.risk);
    if (inspection.requiresConfirmation) requiresConfirmation = true;
    findings.push(...inspection.findings);

    if (inspection.findings.some((finding) => finding.severity === "error")) {
      blockedSteps.push(step);
    } else {
      allowedSteps.push(step);
    }
  }

  if (riskRank[risk] > riskRank[maxAutoRisk]) {
    requiresConfirmation = true;
    findings.push({
      severity: "info",
      code: "confirmation_required_by_risk",
      message: `Plan risk ${risk} is above automatic execution limit ${maxAutoRisk}.`,
    });
  }

  const ok = !findings.some((finding) => finding.severity === "error");
  return { ok, risk, requiresConfirmation, findings, allowedSteps, blockedSteps };
}

function inspectCrmAgentPlanStep(step: CrmAgentPlannerStep, permissions: string[]) {
  const findings: CrmAgentInspectionFinding[] = [];
  let risk: CrmAgentRiskLevel = "low";
  let requiresConfirmation = false;

  const tool = step.toolName ? getCrmAgentTool(step.toolName) : null;
  const action = step.actionName ? getCrmAgentCatalogAction(step.actionName) : null;

  if (step.toolName && !tool) {
    findings.push(stepFinding(step, "error", "unknown_tool", `Unknown tool: ${step.toolName}.`));
  }
  if (step.actionName && !action) {
    findings.push(stepFinding(step, "error", "unknown_action", `Unknown action: ${step.actionName}.`));
  }

  if (tool) {
    const toolInspection = inspectTool(step, tool, permissions);
    findings.push(...toolInspection.findings);
    risk = higherRisk(risk, toolInspection.risk);
    if (toolInspection.requiresConfirmation) requiresConfirmation = true;
  }

  if (action) {
    const actionInspection = inspectAction(step, action, permissions);
    findings.push(...actionInspection.findings);
    risk = higherRisk(risk, actionInspection.risk);
    if (actionInspection.requiresConfirmation) requiresConfirmation = true;
  }

  if ((step.type === "execute" || step.type === "draft" || step.type === "preview") && !tool && !action) {
    findings.push(stepFinding(step, "error", "missing_target", "Mutation-like step must reference a tool or action."));
  }

  return { findings, risk, requiresConfirmation };
}

function inspectTool(step: CrmAgentPlannerStep, tool: CrmAgentRegisteredToolDefinition, permissions: string[]) {
  const findings: CrmAgentInspectionFinding[] = [];
  const canUse = canUseCrmAgentTool(tool.name, permissions);
  if (!canUse) {
    findings.push(stepFinding(step, "error", "missing_tool_permission", `Missing permission for tool ${tool.name}.`));
  }
  if (step.type === "execute" && tool.mode !== "execute") {
    findings.push(stepFinding(step, "error", "tool_mode_mismatch", `Tool ${tool.name} cannot be used as execute step.`));
  }
  if (step.type === "read" && tool.mode !== "read") {
    findings.push(stepFinding(step, "warning", "tool_mode_mismatch", `Tool ${tool.name} is not a read tool.`));
  }
  return {
    findings,
    risk: tool.risk,
    requiresConfirmation: tool.mode === "execute" || riskRank[tool.risk] >= riskRank.high,
  };
}

function inspectAction(step: CrmAgentPlannerStep, action: CrmAgentActionDefinition, permissions: string[]) {
  const findings: CrmAgentInspectionFinding[] = [];
  if (!canUseCrmAgentCatalogAction(action, permissions)) {
    findings.push(stepFinding(step, "error", "missing_action_permission", `Missing permission for action ${action.name}.`));
  }

  if (action.status === "planned" || action.status === "blocked" || action.status === "unsupported") {
    findings.push(
      stepFinding(
        step,
        "error",
        "action_not_available",
        `Action ${action.name} is ${action.status} in the catalog and is not connected to runtime execution yet.`,
      ),
    );
  }

  if (action.status === "read_only" && (step.type === "draft" || step.type === "preview" || step.type === "execute")) {
    findings.push(stepFinding(step, "error", "read_only_action_cannot_mutate", `Action ${action.name} is read-only.`));
  }

  if (action.status === "draft_only" && step.type === "execute") {
    findings.push(stepFinding(step, "error", "draft_only_action_cannot_execute", `Action ${action.name} can prepare a draft but cannot execute.`));
  }

  const actionArgs = step.args ?? {};
  const actionSlots =
    typeof actionArgs.payload === "object" && actionArgs.payload !== null && !Array.isArray(actionArgs.payload)
      ? (actionArgs.payload as Record<string, unknown>)
      : actionArgs;
  const missingSlots = getMissingCrmAgentCatalogActionSlots(action, actionSlots);
  if (missingSlots.length) {
    findings.push(
      stepFinding(step, "error", "missing_action_slots", `Action ${action.name} is missing slots: ${missingSlots.join(", ")}.`),
    );
  }

  if (step.type === "execute") {
    findings.push(stepFinding(step, "warning", "execute_step_requires_confirmed_action", "Execute steps must use a confirmed action."));
  }

  return {
    findings,
    risk: action.risk,
    requiresConfirmation:
      action.confirmation === "always" || action.confirmation === "separate_sensitive_confirm" || riskRank[action.risk] >= riskRank.high,
  };
}

function getMissingCrmAgentCatalogActionSlots(action: CrmAgentActionDefinition, slots: Record<string, unknown>) {
  return action.requiredSlots.filter((slot) => slots[slot] === undefined || slots[slot] === null || slots[slot] === "");
}
