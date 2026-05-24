import type { Prisma } from "@prisma/client";

export type CrmAgentRiskLevel = "low" | "medium" | "high" | "critical";

export type CrmAgentToolMode = "read" | "draft" | "execute";

export type CrmAgentToolDomain =
  | "appointments"
  | "clients"
  | "services"
  | "specialists"
  | "locations"
  | "schedule"
  | "promos"
  | "reviews"
  | "notifications"
  | "site"
  | "analytics"
  | "finance"
  | "memory"
  | "insights"
  | "campaigns";

export type CrmAgentScope = {
  accountId: number;
  userId: number | null;
  permissions: string[];
  threadId?: number | null;
  runId?: number | null;
};

export type CrmAgentToolHandler<TArgs = Prisma.JsonObject, TResult = Prisma.JsonValue> = (
  args: TArgs,
  scope: CrmAgentScope,
) => Promise<TResult>;

export type CrmAgentToolDefinition<TArgs = Prisma.JsonObject, TResult = Prisma.JsonValue> = {
  name: string;
  domain: CrmAgentToolDomain;
  mode: CrmAgentToolMode;
  description: string;
  inputSchema: Prisma.JsonObject;
  outputSchema?: Prisma.JsonObject;
  requiredPermission?: string;
  riskLevel: CrmAgentRiskLevel;
  handler?: CrmAgentToolHandler<TArgs, TResult>;
};

export type CreatePendingActionInput = {
  accountId: number;
  userId?: number | null;
  threadId?: number | null;
  actionType: string;
  payload: Prisma.InputJsonValue;
  summary: string;
  riskLevel?: CrmAgentRiskLevel;
  permission?: string | null;
  expiresAt?: Date;
};
