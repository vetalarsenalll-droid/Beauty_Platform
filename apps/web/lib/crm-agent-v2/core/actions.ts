import type { CrmAgentActionDefinition, CrmAgentConfirmationPolicy, CrmAgentRiskLevel } from "./types";

export type CrmAgentActionDomain =
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
  | "memory"
  | "autopilot";

export type CrmAgentActionName =
  | "appointment.create"
  | "appointment.reschedule"
  | "appointment.cancel"
  | "client.create"
  | "client.update"
  | "service.create"
  | "service.update"
  | "service.archive"
  | "specialist.create"
  | "specialist.update"
  | "specialist.schedule.update"
  | "location.create"
  | "location.update"
  | "promo.create"
  | "promo.update"
  | "promo.archive"
  | "review.reply"
  | "notification.send"
  | "notification.campaign.send"
  | "site.service.copy.update"
  | "site.specialist.copy.update"
  | "site.home.copy.update"
  | "site.seo.update"
  | "memory.update"
  | "autopilot.setting.update";

export type CrmAgentRegisteredActionDefinition = CrmAgentActionDefinition & {
  name: CrmAgentActionName;
  domain: CrmAgentActionDomain;
  description: string;
};

const confirmationByRisk: Record<CrmAgentRiskLevel, CrmAgentConfirmationPolicy> = {
  low: "never",
  medium: "medium_plus",
  high: "always",
  critical: "always",
};

function action(
  definition: Omit<CrmAgentRegisteredActionDefinition, "confirmation"> & {
    confirmation?: CrmAgentConfirmationPolicy;
  },
): CrmAgentRegisteredActionDefinition {
  return {
    ...definition,
    confirmation: definition.confirmation ?? confirmationByRisk[definition.risk],
  };
}

export const crmAgentActionRegistry = [
  action({
    name: "appointment.create",
    domain: "appointments",
    intent: "create",
    description: "Create an appointment after client, service, specialist, location and time are resolved.",
    requiredSlots: ["clientId", "serviceId", "specialistId", "locationId", "startAt"],
    optionalSlots: ["endAt", "priceTotal", "durationTotalMin", "comment"],
    risk: "high",
    permission: "crm.appointments.create",
    skill: "appointment_booking",
  }),
  action({
    name: "appointment.reschedule",
    domain: "appointments",
    intent: "update",
    description: "Move an existing appointment to another time, specialist or location.",
    requiredSlots: ["appointmentId", "startAt"],
    optionalSlots: ["endAt", "specialistId", "locationId", "comment"],
    risk: "high",
    permission: "crm.appointments.reschedule",
    skill: "appointment_booking",
  }),
  action({
    name: "appointment.cancel",
    domain: "appointments",
    intent: "delete",
    description: "Cancel an existing appointment with an optional internal comment.",
    requiredSlots: ["appointmentId"],
    optionalSlots: ["comment"],
    risk: "high",
    permission: "crm.appointments.cancel",
    skill: "appointment_booking",
  }),
  action({
    name: "client.create",
    domain: "clients",
    intent: "create",
    description: "Create a CRM client profile.",
    requiredSlots: [],
    optionalSlots: ["firstName", "lastName", "phone", "email", "birthDate"],
    risk: "medium",
    permission: "crm.clients.create",
    skill: "client_profile",
  }),
  action({
    name: "client.update",
    domain: "clients",
    intent: "update",
    description: "Update an existing CRM client profile.",
    requiredSlots: ["clientId"],
    optionalSlots: ["firstName", "lastName", "phone", "email", "birthDate"],
    risk: "medium",
    permission: "crm.clients.update",
    skill: "client_profile",
  }),
  action({
    name: "service.create",
    domain: "services",
    intent: "create",
    description: "Create a catalog service.",
    requiredSlots: ["name", "baseDurationMin", "basePrice"],
    optionalSlots: ["categoryId", "description", "isActive"],
    risk: "medium",
    permission: "crm.services.create",
    skill: "service_catalog",
  }),
  action({
    name: "service.update",
    domain: "services",
    intent: "update",
    description: "Update a catalog service.",
    requiredSlots: ["serviceId"],
    optionalSlots: ["categoryId", "name", "description", "baseDurationMin", "basePrice", "isActive"],
    risk: "medium",
    permission: "crm.services.update",
    skill: "service_catalog",
  }),
  action({
    name: "service.archive",
    domain: "services",
    intent: "delete",
    description: "Archive a catalog service.",
    requiredSlots: ["serviceId"],
    optionalSlots: [],
    risk: "high",
    permission: "crm.services.delete",
    skill: "service_catalog",
  }),
  action({
    name: "specialist.create",
    domain: "specialists",
    intent: "create",
    description: "Create a staff specialist profile.",
    requiredSlots: ["name"],
    optionalSlots: ["firstName", "lastName", "phone", "email", "bio", "levelId", "categoryIds", "status", "isPublic"],
    risk: "medium",
    permission: "crm.specialists.create",
    skill: "specialist_profile",
  }),
  action({
    name: "specialist.update",
    domain: "specialists",
    intent: "update",
    description: "Update public specialist profile fields.",
    requiredSlots: ["specialistId"],
    optionalSlots: ["bio", "isPublic"],
    risk: "medium",
    permission: "crm.specialists.update",
    skill: "specialist_profile",
  }),
  action({
    name: "specialist.schedule.update",
    domain: "schedule",
    intent: "update",
    description: "Create or update a specialist schedule entry for a date.",
    requiredSlots: ["specialistId", "date"],
    optionalSlots: ["locationId", "type", "startTime", "endTime", "notes"],
    risk: "high",
    permission: "crm.schedule.update",
    skill: "schedule_management",
  }),
  action({
    name: "location.create",
    domain: "locations",
    intent: "create",
    description: "Create a business location.",
    requiredSlots: ["name", "address"],
    optionalSlots: ["description", "phone", "status"],
    risk: "medium",
    permission: "crm.locations.create",
    skill: "location_management",
  }),
  action({
    name: "location.update",
    domain: "locations",
    intent: "update",
    description: "Update a business location.",
    requiredSlots: ["locationId"],
    optionalSlots: ["name", "address", "description", "phone", "status"],
    risk: "medium",
    permission: "crm.locations.update",
    skill: "location_management",
  }),
  action({
    name: "promo.create",
    domain: "promos",
    intent: "create",
    description: "Create a promotion.",
    requiredSlots: ["name", "type", "value"],
    optionalSlots: ["startsAt", "endsAt", "isActive"],
    risk: "medium",
    permission: "crm.promos.create",
    skill: "promotion_management",
  }),
  action({
    name: "promo.update",
    domain: "promos",
    intent: "update",
    description: "Update a promotion.",
    requiredSlots: ["promotionId"],
    optionalSlots: ["name", "type", "value", "startsAt", "endsAt", "isActive"],
    risk: "medium",
    permission: "crm.promos.update",
    skill: "promotion_management",
  }),
  action({
    name: "promo.archive",
    domain: "promos",
    intent: "delete",
    description: "Archive a promotion.",
    requiredSlots: ["promotionId"],
    optionalSlots: [],
    risk: "high",
    permission: "crm.promos.update",
    skill: "promotion_management",
  }),
  action({
    name: "review.reply",
    domain: "reviews",
    intent: "notify",
    description: "Publish a reply to a client review.",
    requiredSlots: ["reviewId", "replyText"],
    optionalSlots: [],
    risk: "medium",
    permission: "crm.reviews.manage",
    skill: "review_management",
  }),
  action({
    name: "notification.send",
    domain: "notifications",
    intent: "notify",
    description: "Send a direct client notification after consent checks.",
    requiredSlots: ["clientId", "channel", "bodyText"],
    optionalSlots: ["title"],
    risk: "high",
    permission: "crm.assistant.campaigns.manage",
    skill: "client_notifications",
  }),
  action({
    name: "notification.campaign.send",
    domain: "notifications",
    intent: "notify",
    description: "Schedule a campaign notification send through the outbox.",
    requiredSlots: ["campaignId"],
    optionalSlots: [],
    risk: "high",
    permission: "crm.assistant.campaigns.manage",
    skill: "client_notifications",
  }),
  action({
    name: "site.service.copy.update",
    domain: "site",
    intent: "update",
    description: "Update service copy that is visible on the public site.",
    requiredSlots: ["serviceId"],
    optionalSlots: ["name", "description"],
    risk: "medium",
    permission: "crm.settings.update",
    skill: "site_content",
  }),
  action({
    name: "site.specialist.copy.update",
    domain: "site",
    intent: "update",
    description: "Update specialist public copy.",
    requiredSlots: ["specialistId"],
    optionalSlots: ["bio", "isPublic"],
    risk: "medium",
    permission: "crm.settings.update",
    skill: "site_content",
  }),
  action({
    name: "site.home.copy.update",
    domain: "site",
    intent: "update",
    description: "Update public home page account copy.",
    requiredSlots: [],
    optionalSlots: ["description", "phone", "email", "address"],
    risk: "medium",
    permission: "crm.settings.update",
    skill: "site_content",
  }),
  action({
    name: "site.seo.update",
    domain: "site",
    intent: "update",
    description: "Update public site SEO settings.",
    requiredSlots: [],
    optionalSlots: ["pageKey", "title", "description", "keywords", "canonicalUrl", "noIndex", "noFollow", "ogImageUrl", "robots"],
    risk: "medium",
    permission: "crm.settings.update",
    skill: "site_content",
  }),
  action({
    name: "memory.update",
    domain: "memory",
    intent: "update",
    description: "Store or update CRM Agent account memory.",
    requiredSlots: ["key", "value"],
    optionalSlots: ["confidence", "source"],
    risk: "medium",
    permission: "crm.assistant.memory.manage",
    skill: "agent_memory",
  }),
  action({
    name: "autopilot.setting.update",
    domain: "autopilot",
    intent: "update",
    description: "Update an autopilot policy or setting.",
    requiredSlots: ["key", "value"],
    optionalSlots: ["confidence", "source"],
    risk: "high",
    permission: "crm.assistant.autopilot.manage",
    skill: "agent_policy",
  }),
] satisfies CrmAgentRegisteredActionDefinition[];

const crmAgentActionsByName = new Map<CrmAgentActionName, CrmAgentRegisteredActionDefinition>(
  crmAgentActionRegistry.map((definition) => [definition.name, definition]),
);

const executableActionNames = new Set<CrmAgentActionName>([
  "appointment.create",
  "appointment.cancel",
  "client.create",
  "client.update",
  "service.create",
  "service.update",
  "service.archive",
  "specialist.create",
  "location.create",
  "location.update",
  "review.reply",
  "site.service.copy.update",
  "memory.update",
  "autopilot.setting.update",
]);

export function isCrmAgentActionName(value: string): value is CrmAgentActionName {
  return crmAgentActionsByName.has(value as CrmAgentActionName);
}

export function isCrmAgentExecutableAction(name: string): name is CrmAgentActionName {
  return isCrmAgentActionName(name) && executableActionNames.has(name);
}

export function getCrmAgentAction(name: string) {
  return isCrmAgentActionName(name) ? crmAgentActionsByName.get(name) ?? null : null;
}

export function getCrmAgentExecutableAction(name: string) {
  return isCrmAgentExecutableAction(name) ? getCrmAgentAction(name) : null;
}

export function listCrmAgentActionsByDomain(domain: CrmAgentActionDomain) {
  return crmAgentActionRegistry.filter((definition) => definition.domain === domain && executableActionNames.has(definition.name));
}

export function listCrmAgentActionsForPermissions(permissions: string[]) {
  const executable = crmAgentActionRegistry.filter((definition) => executableActionNames.has(definition.name));
  if (permissions.includes("crm.all")) return executable;
  return executable.filter((definition) => permissions.includes(definition.permission));
}

export function canUseCrmAgentAction(name: string, permissions: string[]) {
  const definition = getCrmAgentAction(name);
  if (!definition) return false;
  if (!executableActionNames.has(definition.name)) return false;
  return permissions.includes("crm.all") || permissions.includes(definition.permission);
}

export function getMissingCrmAgentActionSlots(name: string, slots: Record<string, unknown>) {
  const definition = getCrmAgentAction(name);
  if (!definition) return [];
  return definition.requiredSlots.filter((slot) => slots[slot] === undefined || slots[slot] === null || slots[slot] === "");
}
