import { defineCrmAgentAction } from "../define-action";
import { readScheduleRange } from "./schedule-helpers";

export const scheduleSearchAction = defineCrmAgentAction({
  name: "schedule.search",
  domain: "schedule",
  kind: "read",
  intent: "read",
  status: "read_only",
  risk: "low",
  permission: "crm.schedule.read",
  confirmation: "never",
  requiredSlots: [],
  optionalSlots: ["date", "dateFrom", "dateTo", "specialistId", "locationId", "take"],
  description: "Найти графики/записи расписания.",
  plannerHints: ["Use schedule.search to inspect schedule entries by date, specialist or location."],
  read: async (payload, ctx) => ({ schedule: await readScheduleRange(ctx.accountId, payload) }),
});
