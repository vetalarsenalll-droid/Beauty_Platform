import type { Prisma } from "@prisma/client";
import {
  canUseCrmAgentCatalogAction,
  CrmAgentPolicyError,
  CrmAgentValidationError,
  getCrmAgentCatalogAction,
  type CrmAgentActionContext,
  type CrmAgentActionDefinition,
} from "../actions";
import {
  confirmCrmAgentAction,
  getCrmAgentAction,
  markCrmAgentActionExecuted,
  markCrmAgentActionFailed,
  rejectCrmAgentAction,
  writeCrmAgentAudit,
} from "./persistence";
import type { CrmAgentToolContext, CrmAgentToolDefinition, CrmAgentToolHandler } from "./types";

type JsonRecord = Record<string, unknown>;

const executeToolHandlers: Partial<Record<string, CrmAgentToolHandler<JsonRecord, unknown>>> = {
  "actions.confirm": confirmAndExecuteAction,
  "actions.reject": rejectAction,
};

export function attachCrmAgentExecuteToolHandlers<T extends CrmAgentToolDefinition>(tools: T[]): T[] {
  return tools.map((tool) => {
    const handler = executeToolHandlers[tool.name];
    return handler ? { ...tool, handler } : tool;
  });
}

export function getCrmAgentExecuteToolHandler(name: string) {
  return executeToolHandlers[name] ?? null;
}

async function confirmAndExecuteAction(args: JsonRecord, ctx: CrmAgentToolContext) {
  const actionId = requiredNumber(args.actionId, "actionId");
  const action = await getCrmAgentAction({ accountId: ctx.accountId, actionId });
  if (!action) throw new Error("Action not found.");
  if (action.status === "EXECUTED") return { status: "EXECUTED", result: action.result };
  if (action.status === "REJECTED" || action.status === "FAILED" || action.status === "EXPIRED") {
    throw new Error(`Action cannot be executed from status ${action.status}.`);
  }

  const definition = getExecutableActionDefinition(action.actionType);
  if (!canUseCrmAgentCatalogAction(definition, ctx.permissions)) throw new Error(`Missing permission: ${definition.permission}`);
  if (action.permission && action.permission !== definition.permission && !ctx.permissions.includes("crm.all")) {
    throw new Error(`Persisted action permission mismatch: ${action.permission}.`);
  }

  await confirmCrmAgentAction({ accountId: ctx.accountId, actionId });

  try {
    const payload = jsonObject(action.payload);
    const runtimeContext = actionContext(ctx);
    const preview = definition.preview ? await definition.preview(payload, runtimeContext) : null;
    const result = await definition.execute(payload, runtimeContext);
    await markCrmAgentActionExecuted({
      accountId: ctx.accountId,
      actionId,
      result: result as unknown as Prisma.InputJsonValue,
    });
    await writeCrmAgentAudit({
      accountId: ctx.accountId,
      userId: ctx.userId ?? null,
      sessionId: ctx.sessionId ?? null,
      action: definition.name,
      targetType: "crm_agent_action",
      targetId: String(actionId),
      data: {
        actionName: definition.name,
        actionId,
        risk: definition.risk,
        permission: definition.permission,
        before: preview?.before ?? null,
        after: preview?.after ?? null,
        diff: preview?.diff ?? [],
        warnings: preview?.warnings ?? [],
        result,
      } as Prisma.InputJsonObject,
    });
    return { status: "EXECUTED", result };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Action execution failed.";
    await markCrmAgentActionFailed({ accountId: ctx.accountId, actionId, error: message });
    return { status: "FAILED", error: message };
  }
}

async function rejectAction(args: JsonRecord, ctx: CrmAgentToolContext) {
  const actionId = requiredNumber(args.actionId, "actionId");
  const action = await getCrmAgentAction({ accountId: ctx.accountId, actionId });
  if (!action) throw new Error("Action not found.");
  const definition = getCrmAgentCatalogAction(action.actionType);
  if (definition && !canUseCrmAgentCatalogAction(definition, ctx.permissions)) throw new Error(`Missing permission: ${definition.permission}`);
  const rejected = await rejectCrmAgentAction({
    accountId: ctx.accountId,
    actionId,
    error: typeof args.reason === "string" ? args.reason : null,
  });
  return { status: rejected?.status ?? "REJECTED", actionId };
}

function getExecutableActionDefinition(actionType: string) {
  const definition = getCrmAgentCatalogAction(actionType);
  if (!definition) throw new Error(`Unknown action type: ${actionType}.`);
  assertActionCanExecute(definition);
  return definition as CrmAgentActionDefinition & { execute: NonNullable<CrmAgentActionDefinition["execute"]> };
}

function assertActionCanExecute(definition: CrmAgentActionDefinition): asserts definition is CrmAgentActionDefinition & {
  execute: NonNullable<CrmAgentActionDefinition["execute"]>;
} {
  if (definition.status !== "implemented") {
    throw new CrmAgentPolicyError(`Action ${definition.name} cannot execute from catalog status ${definition.status}.`, {
      actionName: definition.name,
      status: definition.status,
    });
  }
  if (!definition.execute) {
    throw new CrmAgentValidationError(`Action ${definition.name} does not define execute.`, {
      actionName: definition.name,
      status: definition.status,
      kind: definition.kind,
    });
  }
}

function actionContext(ctx: CrmAgentToolContext): CrmAgentActionContext {
  return {
    accountId: ctx.accountId,
    userId: ctx.userId ?? null,
    permissions: ctx.permissions,
    sessionId: ctx.sessionId ?? null,
    now: new Date(),
    timezone: "UTC",
  };
}

function jsonObject(value: unknown): JsonRecord {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) return value as JsonRecord;
  throw new Error("Action payload must be an object.");
}

function requiredNumber(value: unknown, key: string) {
  if (typeof value === "number" && Number.isInteger(value)) return value;
  if (typeof value === "string" && /^\d+$/.test(value)) return Number(value);
  throw new Error(`Action payload ${key} is required.`);
}
