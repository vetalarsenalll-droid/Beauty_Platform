import type { Prisma } from "@prisma/client";

export type CrmAgentIntent = "read" | "create" | "update" | "delete" | "analyze" | "notify" | "execute";

export type CrmAgentRiskLevel = "low" | "medium" | "high" | "critical";

export type CrmAgentConfirmationPolicy = "never" | "medium_plus" | "always";

export type CrmAgentToolMode = "read" | "draft" | "execute";

export type CrmAgentPlanStepType =
  | "read"
  | "resolve"
  | "draft"
  | "execute"
  | "inspect"
  | "clarify"
  | "generate"
  | "preview";

export type CrmAgentGoal = {
  type: string;
  intent: CrmAgentIntent;
  confidence: number;
  slots: Record<string, unknown>;
  userFacingSummary: string;
};

export type CrmAgentTaskStatus =
  | "collecting"
  | "resolving"
  | "needs_clarification"
  | "ready_to_plan"
  | "ready_for_confirmation"
  | "completed"
  | "failed";

export type CrmAgentTaskState = {
  sessionId: number;
  accountId: number;
  goalType: string;
  status: CrmAgentTaskStatus;
  slots: Record<string, CrmAgentSlot>;
  candidates: Record<string, CrmAgentCandidate[]>;
  selected: Record<string, number | string>;
  missing: string[];
};

export type CrmAgentSlotStatus = "empty" | "resolving" | "ambiguous" | "resolved" | "not_found";

export type CrmAgentSlot = {
  query?: string;
  value?: unknown;
  selectedId?: number | string | null;
  candidates?: CrmAgentCandidate[];
  status?: CrmAgentSlotStatus;
};

export type CrmAgentCandidate = {
  type: string;
  id: number | string;
  title: string;
  subtitle?: string | null;
  data?: unknown;
};

export type CrmAgentCardType =
  | "client"
  | "service"
  | "specialist"
  | "location"
  | "appointment"
  | "slot"
  | "review"
  | "promo"
  | "action"
  | "preview"
  | "form"
  | "report";

export type CrmAgentCard = {
  type: CrmAgentCardType;
  id?: number | string;
  title: string;
  subtitle?: string | null;
  data?: Record<string, unknown>;
  actions?: CrmAgentUiCommand[];
};

export type CrmAgentWorkspaceMode = "empty" | "conversation" | "select" | "form" | "preview" | "confirm" | "report" | "table";

export type CrmAgentUiWorkspace = {
  mode: CrmAgentWorkspaceMode;
  title?: string;
  tabs?: CrmAgentUiTab[];
  activeTabId?: string;
  cards?: CrmAgentCard[];
  form?: CrmAgentUiForm;
  preview?: CrmAgentUiPreview;
  commands?: CrmAgentUiCommand[];
};

export type CrmAgentUiTab = {
  id: string;
  title: string;
  badge?: number | string;
  cards?: CrmAgentCard[];
  table?: CrmAgentUiTable;
};

export type CrmAgentUiForm = {
  id: string;
  entityType: string;
  entityId?: number | string;
  fields: CrmAgentUiField[];
  submitCommand: string;
};

export type CrmAgentUiFieldType =
  | "text"
  | "textarea"
  | "number"
  | "date"
  | "datetime"
  | "select"
  | "multiselect"
  | "toggle";

export type CrmAgentUiField = {
  name: string;
  label: string;
  type: CrmAgentUiFieldType;
  value?: unknown;
  required?: boolean;
  readonly?: boolean;
  helpText?: string;
  options?: Array<{ label: string; value: string | number | boolean }>;
};

export type CrmAgentUiTable = {
  columns: Array<{ key: string; title: string; type?: "text" | "number" | "date" | "money" | "status" }>;
  rows: Array<Record<string, unknown>>;
  selectedRowIds?: Array<number | string>;
  rowCommands?: CrmAgentUiCommand[];
};

export type CrmAgentUiPreview = {
  before?: Record<string, unknown>;
  after: Record<string, unknown>;
  diff?: Array<{ field: string; before: unknown; after: unknown }>;
};

export type CrmAgentUiCommandKind = "select" | "edit" | "save_draft" | "confirm" | "reject" | "run_tool" | "open";

export type CrmAgentUiCommand = {
  id: string;
  label: string;
  kind: CrmAgentUiCommandKind;
  payload?: Record<string, unknown>;
  risk?: CrmAgentRiskLevel;
};

export type CrmAgentActionDefinition = {
  name: string;
  domain: string;
  intent: CrmAgentIntent;
  requiredSlots: string[];
  optionalSlots: string[];
  risk: CrmAgentRiskLevel;
  permission: string;
  skill: string;
  confirmation: CrmAgentConfirmationPolicy;
};

export type CrmAgentToolContext = {
  accountId: number;
  userId?: number | null;
  sessionId?: number | null;
  permissions: string[];
};

export type CrmAgentToolHandler<TArgs extends Record<string, unknown> = Record<string, unknown>, TResult = unknown> = (
  args: TArgs,
  ctx: CrmAgentToolContext,
) => Promise<TResult>;

export type CrmAgentToolDefinition<
  TArgs extends Record<string, unknown> = Record<string, unknown>,
  TResult = unknown,
> = {
  name: string;
  mode: CrmAgentToolMode;
  domain: string;
  permission?: string;
  risk: CrmAgentRiskLevel;
  inputSchema: Prisma.JsonObject;
  handler?: CrmAgentToolHandler<TArgs, TResult>;
};

export type CrmAgentInteractionRequest = {
  sessionId: number;
  commandId: string;
  payload?: Record<string, unknown>;
};

export type CrmAgentChatResponse = {
  answer: string;
  sessionId: number;
  state: CrmAgentTaskState;
  cards: CrmAgentCard[];
  workspace: CrmAgentUiWorkspace;
  clarification?: {
    question: string;
    options: CrmAgentCard[];
  };
  actionPreview?: {
    id: number;
    actionType: string;
    summary: string;
    payload: unknown;
    riskLevel: CrmAgentRiskLevel;
    permission?: string | null;
  };
  planTrace: CrmAgentPlanTraceStep[];
};

export type CrmAgentPlanTraceStep = {
  id?: number;
  order: number;
  type: CrmAgentPlanStepType;
  toolName?: string | null;
  status: "pending" | "running" | "done" | "failed" | "skipped";
  args?: unknown;
  result?: unknown;
  error?: string | null;
};
