import type { Prisma } from "@prisma/client";
import {
  canUseCrmAgentCatalogAction,
  CrmAgentPolicyError,
  CrmAgentValidationError,
  getCrmAgentCatalogAction,
  type CrmAgentActionContext,
  type CrmAgentActionDefinition,
} from "../actions";
import { createCrmAgentAction, getCrmAgentAction as getPersistedCrmAgentAction } from "./persistence";
import type { CrmAgentToolContext, CrmAgentToolDefinition, CrmAgentToolHandler } from "./types";

type JsonRecord = Record<string, unknown>;

const draftToolHandlers: Partial<Record<string, CrmAgentToolHandler<JsonRecord, unknown>>> = {
  "actions.prepare": prepareAction,
  "actions.preview": previewAction,
};

export function attachCrmAgentDraftToolHandlers<T extends CrmAgentToolDefinition>(tools: T[]): T[] {
  return tools.map((tool) => {
    const handler = draftToolHandlers[tool.name];
    return handler ? { ...tool, handler } : tool;
  });
}

export function getCrmAgentDraftToolHandler(name: string) {
  return draftToolHandlers[name] ?? null;
}

export async function buildCrmAgentActionPreview(actionType: string, payload: JsonRecord, ctx: CrmAgentToolContext) {
  const definition = getPreviewableActionDefinition(actionType);
  return definition.preview(payload, actionContext(ctx));
}

async function prepareAction(args: JsonRecord, ctx: CrmAgentToolContext) {
  const actionType = stringArg(args.actionType);
  if (!actionType) throw new Error("actions.prepare requires actionType.");

  const definition = getCrmAgentCatalogAction(actionType);
  if (!definition) throw new Error(`Unknown action type: ${actionType}.`);
  assertDraftActionCanPreview(definition);
  if (!canUseCrmAgentCatalogAction(definition, ctx.permissions)) {
    throw new Error(`Missing permission: ${definition.permission}`);
  }

  const payload = recordArg(args.payload) ?? {};
  const missingSlots = getMissingCrmAgentCatalogActionSlots(definition, payload);
  if (missingSlots.length) {
    return {
      status: "NEEDS_SLOTS",
      actionType: definition.name,
      missingSlots,
      requiredSlots: definition.requiredSlots,
      optionalSlots: definition.optionalSlots,
    };
  }

  const action = await createCrmAgentAction({
    accountId: ctx.accountId,
    userId: ctx.userId ?? null,
    sessionId: ctx.sessionId ?? null,
    actionType: definition.name,
    summary: stringArg(args.summary) || definition.description,
    payload: payload as Prisma.InputJsonValue,
    riskLevel: definition.risk,
    permission: definition.permission,
    expiresAt: dateArg(args.expiresAt),
  });
  const preview = await definition.preview(payload, actionContext(ctx));

  return {
    status: action.status,
    actionId: action.id,
    actionType: action.actionType,
    summary: action.summary,
    riskLevel: action.riskLevel,
    permission: action.permission,
    confirmation: definition.confirmation,
    payload: action.payload,
    preview,
  };
}

async function previewAction(args: JsonRecord, ctx: CrmAgentToolContext) {
  const actionId = numberArg(args.actionId);
  const action = actionId ? await getPersistedCrmAgentAction({ accountId: ctx.accountId, actionId }) : null;

  if (action) {
    const payload = recordArg(action.payload) ?? {};
    const definition = getPreviewableActionDefinition(action.actionType);
    const preview = await definition.preview(payload, actionContext(ctx));
    return {
      actionId: action.id,
      actionType: definition.name,
      summary: action.summary,
      riskLevel: action.riskLevel,
      permission: action.permission,
      status: action.status,
      preview,
    };
  }

  const actionType = stringArg(args.actionType);
  if (!actionType) throw new Error("actions.preview requires actionId or actionType.");
  const definition = getCrmAgentCatalogAction(actionType);
  if (!definition) throw new Error(`Unknown action type: ${actionType}.`);
  assertDraftActionCanPreview(definition);
  const payload = recordArg(args.payload) ?? {};
  const preview = await definition.preview(payload, actionContext(ctx));
  return {
    actionType: definition.name,
    summary: stringArg(args.summary) || definition.description,
    riskLevel: definition.risk,
    permission: definition.permission,
    status: "DRAFT",
    preview,
  };
}

function getPreviewableActionDefinition(actionType: string) {
  const definition = getCrmAgentCatalogAction(actionType);
  if (!definition) throw new Error(`Unknown action type: ${actionType}.`);
  assertDraftActionCanPreview(definition);
  return definition as CrmAgentActionDefinition & { preview: NonNullable<CrmAgentActionDefinition["preview"]> };
}

function assertDraftActionCanPreview(definition: CrmAgentActionDefinition): asserts definition is CrmAgentActionDefinition & {
  preview: NonNullable<CrmAgentActionDefinition["preview"]>;
} {
  if (definition.status === "planned" || definition.status === "blocked" || definition.status === "unsupported") {
    throw new CrmAgentPolicyError(`Action is not available for preview: ${definition.name}.`, {
      actionName: definition.name,
      status: definition.status,
    });
  }
  if (!definition.preview) {
    throw new CrmAgentValidationError(`Action ${definition.name} does not define preview.`, {
      actionName: definition.name,
      status: definition.status,
      kind: definition.kind,
    });
  }
}

function getMissingCrmAgentCatalogActionSlots(definition: CrmAgentActionDefinition, slots: Record<string, unknown>) {
  return definition.requiredSlots.filter((slot) => slots[slot] === undefined || slots[slot] === null || slots[slot] === "");
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

function stringArg(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numberArg(value: unknown) {
  if (typeof value === "number" && Number.isInteger(value)) return value;
  if (typeof value === "string" && /^\d+$/.test(value)) return Number(value);
  return null;
}

function dateArg(value: unknown) {
  const raw = stringArg(value);
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function recordArg(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}
