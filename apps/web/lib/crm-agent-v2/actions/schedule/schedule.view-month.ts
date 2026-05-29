import { defineCrmAgentAction } from "../define-action";
import { readScheduleRange } from "./schedule-helpers";

export const scheduleViewMonthAction = defineCrmAgentAction({
  name: "schedule.view_month",
  domain: "schedule",
  kind: "read",
  intent: "read",
  status: "read_only",
  risk: "low",
  permission: "crm.schedule.read",
  confirmation: "never",
  requiredSlots: ["dateFrom"],
  optionalSlots: ["dateTo", "specialistId", "locationId", "take"],
  description: "Показать месяц графика.",
  plannerHints: ["Use schedule.view_month when the user asks for a month schedule."],
  read: async (payload, ctx) => ({ schedule: await readScheduleRange(ctx.accountId, payload) }),
});
