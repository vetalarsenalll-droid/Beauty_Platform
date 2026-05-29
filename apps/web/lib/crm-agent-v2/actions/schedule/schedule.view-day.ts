import { defineCrmAgentAction } from "../define-action";
import { readScheduleRange } from "./schedule-helpers";

export const scheduleViewDayAction = defineCrmAgentAction({
  name: "schedule.view_day",
  domain: "schedule",
  kind: "read",
  intent: "read",
  status: "read_only",
  risk: "low",
  permission: "crm.schedule.read",
  confirmation: "never",
  requiredSlots: ["date"],
  optionalSlots: ["specialistId", "locationId", "take"],
  description: "Показать день графика.",
  plannerHints: ["Use schedule.view_day when the user asks for one calendar day."],
  read: async (payload, ctx) => ({ schedule: await readScheduleRange(ctx.accountId, payload) }),
});
