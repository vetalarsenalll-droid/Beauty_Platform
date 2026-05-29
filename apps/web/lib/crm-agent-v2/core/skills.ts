import type { CrmAgentActionName } from "./actions";
import type { CrmAgentToolName } from "./tools";

export type CrmAgentSkillName =
  | "appointment_booking"
  | "client_profile"
  | "service_catalog"
  | "specialist_profile"
  | "schedule_management"
  | "location_management"
  | "promotion_management"
  | "review_management"
  | "client_notifications"
  | "site_content"
  | "agent_memory"
  | "analytics_insights";

export type CrmAgentSkillDefinition = {
  name: CrmAgentSkillName;
  title: string;
  description: string;
  goalTypes: string[];
  tools: CrmAgentToolName[];
  actions: CrmAgentActionName[];
  requiredPermissions: string[];
  plannerHints: string[];
};

export const crmAgentSkills = [
  {
    name: "appointment_booking",
    title: "Appointment booking",
    description: "Create, reschedule and cancel appointments after resolving client, service, specialist, location and time.",
    goalTypes: ["appointment.create", "appointment.reschedule", "appointment.cancel"],
    tools: ["clients.search", "services.search", "specialists.search", "locations.search", "appointments.search", "appointments.findAvailableSlots", "actions.prepare", "actions.preview"],
    actions: ["appointment.create", "appointment.reschedule", "appointment.cancel"],
    requiredPermissions: ["crm.clients.read", "crm.services.read", "crm.specialists.read", "crm.locations.read", "crm.schedule.read", "crm.calendar.read"],
    plannerHints: [
      "Resolve ambiguous clients before preparing appointment actions.",
      "Use appointments.findAvailableSlots before appointment.create or appointment.reschedule.",
      "Never create or cancel an appointment without an explicit preview and confirmation.",
    ],
  },
  {
    name: "client_profile",
    title: "Client profile",
    description: "Find, create and update CRM client profiles.",
    goalTypes: ["client.search", "client.create", "client.update"],
    tools: ["clients.search", "clients.get", "actions.prepare", "actions.preview"],
    actions: ["client.create", "client.update"],
    requiredPermissions: ["crm.clients.read"],
    plannerHints: ["Prefer updating an existing matching client over creating a duplicate."],
  },
  {
    name: "service_catalog",
    title: "Service catalog",
    description: "Inspect and maintain service catalog entries.",
    goalTypes: ["service.search", "service.create", "service.update", "service.archive"],
    tools: ["services.search", "services.get", "actions.prepare", "actions.preview"],
    actions: ["service.create", "service.update", "service.archive"],
    requiredPermissions: ["crm.services.read"],
    plannerHints: ["Archiving a service is high risk and must be confirmed."],
  },
  {
    name: "specialist_profile",
    title: "Specialist profile",
    description: "Inspect, create and update specialist profiles.",
    goalTypes: ["specialist.search", "specialist.create", "specialist.update"],
    tools: ["specialists.search", "specialists.get", "actions.prepare", "actions.preview"],
    actions: ["specialist.create", "specialist.update", "site.specialist.copy.update"],
    requiredPermissions: ["crm.specialists.read"],
    plannerHints: [
      "Use specialist.create when the user asks to add a new staff specialist.",
      "For specialist.create, a full name is enough to prepare a draft; email and phone are optional when unavailable.",
      "Use specialists.search when the user gives only a name or service hint for an existing specialist.",
    ],
  },
  {
    name: "schedule_management",
    title: "Schedule management",
    description: "Inspect available windows and prepare schedule changes.",
    goalTypes: ["schedule.search", "schedule.update"],
    tools: ["specialists.search", "locations.search", "appointments.findAvailableSlots", "actions.prepare", "actions.preview"],
    actions: ["schedule.set_workday", "schedule.set_day_off", "schedule.set_vacation", "schedule.add_break", "schedule.block_slot"],
    requiredPermissions: ["crm.schedule.read"],
    plannerHints: ["Schedule updates affect availability and always require confirmation."],
  },
  {
    name: "location_management",
    title: "Location management",
    description: "Inspect and maintain business locations.",
    goalTypes: ["location.search", "location.create", "location.update"],
    tools: ["locations.search", "actions.prepare", "actions.preview"],
    actions: ["location.create", "location.update"],
    requiredPermissions: ["crm.locations.read"],
    plannerHints: ["Resolve the target location before preparing updates."],
  },
  {
    name: "promotion_management",
    title: "Promotion management",
    description: "Inspect and maintain promotions.",
    goalTypes: ["promo.search", "promo.create", "promo.update", "promo.archive"],
    tools: ["promos.search", "actions.prepare", "actions.preview"],
    actions: ["promo.create", "promo.update", "promo.archive"],
    requiredPermissions: ["crm.promos.read"],
    plannerHints: ["Check active promotions before creating a new overlapping promo."],
  },
  {
    name: "review_management",
    title: "Review management",
    description: "Inspect reviews and prepare public replies.",
    goalTypes: ["review.search", "review.reply"],
    tools: ["reviews.search", "actions.prepare", "actions.preview"],
    actions: ["review.reply"],
    requiredPermissions: ["crm.reviews.read"],
    plannerHints: ["A public review reply must be previewed before confirmation."],
  },
  {
    name: "client_notifications",
    title: "Client notifications",
    description: "Prepare direct and campaign notifications with consent checks.",
    goalTypes: ["notification.send", "notification.campaign.send"],
    tools: ["clients.search", "analytics.retention", "actions.prepare", "actions.preview"],
    actions: ["notification.send_client", "notification.send_segment"],
    requiredPermissions: ["crm.clients.read", "crm.assistant.campaigns.manage"],
    plannerHints: ["Never send marketing notifications without consent-aware execution."],
  },
  {
    name: "site_content",
    title: "Site content",
    description: "Inspect site health and prepare public copy or SEO updates.",
    goalTypes: ["site.health", "site.copy.update", "site.seo.update"],
    tools: ["site.health", "services.search", "specialists.search", "actions.prepare", "actions.preview"],
    actions: ["site.update_service_copy", "site.update_specialist_copy", "site.update_home_copy", "site.update_seo_global", "site.update_seo_page"],
    requiredPermissions: ["crm.settings.read"],
    plannerHints: ["Public copy changes must show before/after preview."],
  },
  {
    name: "agent_memory",
    title: "Agent memory",
    description: "Read and update CRM Agent account memory.",
    goalTypes: ["memory.search", "memory.update"],
    tools: ["memory.search", "actions.prepare", "actions.preview"],
    actions: ["agent.memory.update", "agent.policy.update"],
    requiredPermissions: ["crm.assistant.memory.manage"],
    plannerHints: ["Memory must not override factual CRM data."],
  },
  {
    name: "analytics_insights",
    title: "Analytics insights",
    description: "Analyze workload, retention and CRM improvement opportunities.",
    goalTypes: ["analytics.workload", "analytics.retention", "insight.generate"],
    tools: ["analytics.workload", "analytics.retention", "reviews.search", "site.health"],
    actions: [],
    requiredPermissions: ["crm.assistant.analytics.read"],
    plannerHints: ["Analytics-only goals should not prepare actions unless the user asks for a concrete change."],
  },
] satisfies CrmAgentSkillDefinition[];

const skillsByName = new Map<CrmAgentSkillName, CrmAgentSkillDefinition>(crmAgentSkills.map((skill) => [skill.name, skill]));

export function getCrmAgentSkill(name: string) {
  return skillsByName.get(name as CrmAgentSkillName) ?? null;
}

export function listCrmAgentSkillsForPermissions(permissions: string[]) {
  if (permissions.includes("crm.all")) return crmAgentSkills;
  return crmAgentSkills.filter((skill) =>
    skill.requiredPermissions.every((permission) => permissions.includes(permission) || permissions.includes("crm.all")),
  );
}

export function findCrmAgentSkillForGoal(goalType: string) {
  return crmAgentSkills.find((skill) => skill.goalTypes.includes(goalType)) ?? null;
}
