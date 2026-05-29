import type { Prisma } from "@prisma/client";

export type CrmAgentActionStatus = "implemented" | "draft_only" | "read_only" | "planned" | "blocked" | "unsupported";

export type CrmAgentActionKind = "read" | "write" | "generate" | "export" | "system";

export type CrmAgentActionIntent = "read" | "create" | "update" | "delete" | "analyze" | "notify" | "execute";

export type CrmAgentActionRisk = "low" | "medium" | "high" | "critical";

export type CrmAgentConfirmationPolicy = "never" | "medium_plus" | "always" | "separate_sensitive_confirm";

export type CrmAgentActionContext = {
  accountId: number;
  userId: number | null;
  permissions: string[];
  sessionId: number | null;
  now: Date;
  timezone: string;
};

export type CrmAgentActionDiffItem = {
  field: string;
  before: unknown;
  after: unknown;
};

export type CrmAgentActionPreview = {
  before: Record<string, unknown> | null;
  after: Record<string, unknown>;
  diff: CrmAgentActionDiffItem[];
  warnings: string[];
};

export type CrmAgentActionResult = {
  status: "DONE" | "NEEDS_USER" | "FAILED";
  data: Record<string, unknown>;
  message?: string;
};

export type CrmAgentActionHandler<TPayload extends Record<string, unknown> = Record<string, unknown>> = (
  payload: TPayload,
  ctx: CrmAgentActionContext,
) => Promise<CrmAgentActionResult>;

export type CrmAgentActionPreviewHandler<TPayload extends Record<string, unknown> = Record<string, unknown>> = (
  payload: TPayload,
  ctx: CrmAgentActionContext,
) => Promise<CrmAgentActionPreview>;

export type CrmAgentActionReadHandler<TPayload extends Record<string, unknown> = Record<string, unknown>> = (
  payload: TPayload,
  ctx: CrmAgentActionContext,
) => Promise<Record<string, unknown>>;

export type CrmAgentActionDefinition<TPayload extends Record<string, unknown> = Record<string, unknown>> = {
  name: string;
  domain: string;
  kind: CrmAgentActionKind;
  intent: CrmAgentActionIntent;
  status: CrmAgentActionStatus;
  risk: CrmAgentActionRisk;
  permission: string | "self";
  confirmation: CrmAgentConfirmationPolicy;
  requiredSlots: string[];
  optionalSlots: string[];
  description: string;
  plannerHints: string[];
  inputSchema?: Prisma.JsonObject;
  preview?: CrmAgentActionPreviewHandler<TPayload>;
  execute?: CrmAgentActionHandler<TPayload>;
  read?: CrmAgentActionReadHandler<TPayload>;
};

export type CrmAgentCatalogSummaryAction = Pick<
  CrmAgentActionDefinition,
  | "name"
  | "domain"
  | "kind"
  | "intent"
  | "status"
  | "risk"
  | "permission"
  | "confirmation"
  | "requiredSlots"
  | "optionalSlots"
  | "description"
  | "plannerHints"
>;
