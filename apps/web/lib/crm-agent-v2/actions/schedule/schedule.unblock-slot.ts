import { defineCrmAgentAction } from "../define-action";
import { previewSchedule, unblockSlot } from "./schedule-helpers";

export const scheduleUnblockSlotAction = defineCrmAgentAction({
  name: "schedule.unblock_slot",
  domain: "schedule",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "high",
  permission: "crm.schedule.update",
  confirmation: "always",
  requiredSlots: ["blockedSlotId"],
  optionalSlots: [],
  description: "Разблокировать слот.",
  plannerHints: ["Use schedule.unblock_slot when blockedSlotId is known."],
  preview: previewSchedule,
  execute: unblockSlot,
});
