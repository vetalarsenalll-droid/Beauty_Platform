import type { Prisma } from "@prisma/client";
import { attachCrmAgentDraftToolHandlers } from "./draft-tools";
import { attachCrmAgentExecuteToolHandlers } from "./execute-tools";
import { attachCrmAgentReadToolHandlers } from "./read-tools";
import type { CrmAgentRiskLevel, CrmAgentToolDefinition, CrmAgentToolMode } from "./types";

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
  | "memory"
  | "actions";

export type CrmAgentToolName =
  | "clients.search"
  | "clients.get"
  | "services.search"
  | "services.get"
  | "specialists.search"
  | "specialists.get"
  | "locations.search"
  | "appointments.search"
  | "appointments.findAvailableSlots"
  | "reviews.search"
  | "promos.search"
  | "analytics.workload"
  | "analytics.retention"
  | "site.health"
  | "memory.search"
  | "actions.prepare"
  | "actions.preview"
  | "actions.confirm"
  | "actions.reject";

export type CrmAgentRegisteredToolDefinition = Omit<CrmAgentToolDefinition, "domain" | "name"> & {
  name: CrmAgentToolName;
  domain: CrmAgentToolDomain;
  description: string;
};

const looseObjectSchema = {
  type: "object",
  additionalProperties: true,
} satisfies Prisma.JsonObject;

const emptyObjectSchema = {
  type: "object",
  additionalProperties: false,
} satisfies Prisma.JsonObject;

function tool(definition: CrmAgentRegisteredToolDefinition) {
  return definition;
}

const crmAgentToolDefinitions = [
  tool({
    name: "clients.search",
    mode: "read",
    domain: "clients",
    description: "Search clients by name, phone, email, tags or visit history. Use args { all: true, take: 50 } to list clients for the current account.",
    permission: "crm.clients.read",
    risk: "low",
    inputSchema: looseObjectSchema,
  }),
  tool({
    name: "clients.get",
    mode: "read",
    domain: "clients",
    description: "Load one client profile with recent visits and relevant CRM facts.",
    permission: "crm.clients.read",
    risk: "low",
    inputSchema: looseObjectSchema,
  }),
  tool({
    name: "services.search",
    mode: "read",
    domain: "services",
    description: "Search services and service categories. Use args { all: true, take: 50 } to list services for the current account.",
    permission: "crm.services.read",
    risk: "low",
    inputSchema: looseObjectSchema,
  }),
  tool({
    name: "services.get",
    mode: "read",
    domain: "services",
    description: "Load one service with pricing, duration, locations and specialist bindings.",
    permission: "crm.services.read",
    risk: "low",
    inputSchema: looseObjectSchema,
  }),
  tool({
    name: "specialists.search",
    mode: "read",
    domain: "specialists",
    description: "Search specialists by name, service, level, location and public status. Use args { all: true, take: 50 } to list specialists for the current account.",
    permission: "crm.specialists.read",
    risk: "low",
    inputSchema: looseObjectSchema,
  }),
  tool({
    name: "specialists.get",
    mode: "read",
    domain: "specialists",
    description: "Load one specialist profile with services, locations and schedule hints.",
    permission: "crm.specialists.read",
    risk: "low",
    inputSchema: looseObjectSchema,
  }),
  tool({
    name: "locations.search",
    mode: "read",
    domain: "locations",
    description: "Search account locations and branch settings. Use args { all: true, take: 50 } to list all branches/locations for the current account.",
    permission: "crm.locations.read",
    risk: "low",
    inputSchema: looseObjectSchema,
  }),
  tool({
    name: "appointments.search",
    mode: "read",
    domain: "appointments",
    description: "Search appointments by date, client, service, specialist, location or status.",
    permission: "crm.calendar.read",
    risk: "low",
    inputSchema: looseObjectSchema,
  }),
  tool({
    name: "appointments.findAvailableSlots",
    mode: "read",
    domain: "schedule",
    description: "Find real available appointment windows for service, specialist, location and dates.",
    permission: "crm.schedule.read",
    risk: "low",
    inputSchema: looseObjectSchema,
  }),
  tool({
    name: "reviews.search",
    mode: "read",
    domain: "reviews",
    description: "Search reviews, negative feedback and repeated service issues.",
    permission: "crm.reviews.read",
    risk: "low",
    inputSchema: looseObjectSchema,
  }),
  tool({
    name: "promos.search",
    mode: "read",
    domain: "promos",
    description: "Search active and historical promotions.",
    permission: "crm.promos.read",
    risk: "low",
    inputSchema: looseObjectSchema,
  }),
  tool({
    name: "analytics.workload",
    mode: "read",
    domain: "analytics",
    description: "Analyze workload by day, hour, specialist and location.",
    permission: "crm.assistant.analytics.read",
    risk: "low",
    inputSchema: looseObjectSchema,
  }),
  tool({
    name: "analytics.retention",
    mode: "read",
    domain: "analytics",
    description: "Find clients who have not returned and opportunities to bring them back.",
    permission: "crm.assistant.analytics.read",
    risk: "low",
    inputSchema: looseObjectSchema,
  }),
  tool({
    name: "site.health",
    mode: "read",
    domain: "site",
    description: "Inspect public site completeness for profile, services, specialists and SEO.",
    permission: "crm.settings.read",
    risk: "low",
    inputSchema: emptyObjectSchema,
  }),
  tool({
    name: "memory.search",
    mode: "read",
    domain: "memory",
    description: "Search CRM Agent account memory and reusable preferences.",
    permission: "crm.assistant.memory.manage",
    risk: "low",
    inputSchema: looseObjectSchema,
  }),
  tool({
    name: "actions.prepare",
    mode: "draft",
    domain: "actions",
    description: "Prepare a pending action from an action registry definition and payload.",
    permission: "crm.assistant.actions.confirm",
    risk: "medium",
    inputSchema: looseObjectSchema,
  }),
  tool({
    name: "actions.preview",
    mode: "draft",
    domain: "actions",
    description: "Build before/after preview and confirmation metadata for a pending action.",
    permission: "crm.assistant.actions.confirm",
    risk: "medium",
    inputSchema: looseObjectSchema,
  }),
  tool({
    name: "actions.confirm",
    mode: "execute",
    domain: "actions",
    description: "Confirm and execute a prepared action after user approval.",
    permission: "crm.assistant.actions.confirm",
    risk: "high",
    inputSchema: looseObjectSchema,
  }),
  tool({
    name: "actions.reject",
    mode: "execute",
    domain: "actions",
    description: "Reject a prepared action and keep an audit trail.",
    permission: "crm.assistant.actions.confirm",
    risk: "medium",
    inputSchema: looseObjectSchema,
  }),
] satisfies CrmAgentRegisteredToolDefinition[];

export const crmAgentToolRegistry = attachCrmAgentExecuteToolHandlers(
  attachCrmAgentDraftToolHandlers(attachCrmAgentReadToolHandlers(crmAgentToolDefinitions)),
);

const crmAgentToolsByName = new Map<CrmAgentToolName, CrmAgentRegisteredToolDefinition>(
  crmAgentToolRegistry.map((definition) => [definition.name, definition]),
);

export function isCrmAgentToolName(value: string): value is CrmAgentToolName {
  return crmAgentToolsByName.has(value as CrmAgentToolName);
}

export function getCrmAgentTool(name: string) {
  return isCrmAgentToolName(name) ? crmAgentToolsByName.get(name) ?? null : null;
}

export function listCrmAgentToolsByDomain(domain: CrmAgentToolDomain) {
  return crmAgentToolRegistry.filter((definition) => definition.domain === domain);
}

export function listCrmAgentToolsByMode(mode: CrmAgentToolMode) {
  return crmAgentToolRegistry.filter((definition) => definition.mode === mode);
}

export function listCrmAgentToolsForPermissions(permissions: string[]) {
  if (permissions.includes("crm.all")) return crmAgentToolRegistry;
  return crmAgentToolRegistry.filter((definition) => !definition.permission || permissions.includes(definition.permission));
}

export function canUseCrmAgentTool(name: string, permissions: string[], maxRisk?: CrmAgentRiskLevel) {
  const definition = getCrmAgentTool(name);
  if (!definition) return false;
  if (definition.permission && !permissions.includes("crm.all") && !permissions.includes(definition.permission)) return false;
  if (!maxRisk) return true;
  return riskRank(definition.risk) <= riskRank(maxRisk);
}

function riskRank(risk: CrmAgentRiskLevel) {
  if (risk === "low") return 1;
  if (risk === "medium") return 2;
  if (risk === "high") return 3;
  return 4;
}
