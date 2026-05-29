import { defineCrmAgentAction } from "../define-action";
import { readScheduleRange } from "./schedule-helpers";

export const scheduleViewWeekAction = defineCrmAgentAction({
  name: "schedule.view_week",
  domain: "schedule",
  kind: "read",
  intent: "read",
  status: "read_only",
  risk: "low",
  permission: "crm.schedule.read",
  confirmation: "never",
  requiredSlots: ["dateFrom"],
  optionalSlots: ["dateTo", "specialistId", "locationId", "take"],
  description: "Показать неделю графика.",
  plannerHints: ["Use schedule.view_week when the user asks for a week schedule."],
  read: async (payload, ctx) => ({ schedule: await readScheduleRange(ctx.accountId, payload) }),
});
