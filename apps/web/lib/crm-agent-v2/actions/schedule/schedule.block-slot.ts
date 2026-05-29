import { defineCrmAgentAction } from "../define-action";
import { blockSlot, previewSchedule } from "./schedule-helpers";

export const scheduleBlockSlotAction = defineCrmAgentAction({
  name: "schedule.block_slot",
  domain: "schedule",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "high",
  permission: "crm.schedule.update",
  confirmation: "always",
  requiredSlots: ["startAt", "endAt"],
  optionalSlots: ["specialistId", "locationId", "reason"],
  description: "Заблокировать слот.",
  plannerHints: ["Use schedule.block_slot to block a concrete time interval."],
  preview: previewSchedule,
  execute: blockSlot,
});
