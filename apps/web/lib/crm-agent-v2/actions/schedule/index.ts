import type { CrmAgentActionDefinition } from "../types";
import { scheduleAddBreakAction } from "./schedule.add-break";
import { scheduleApplyTemplateAction } from "./schedule.apply-template";
import { scheduleBlockSlotAction } from "./schedule.block-slot";
import { scheduleCopyDayAction } from "./schedule.copy-day";
import { scheduleCopyWeekAction } from "./schedule.copy-week";
import { scheduleCreateNonWorkingTypeAction } from "./schedule.create-non-working-type";
import { scheduleCreateTemplateAction } from "./schedule.create-template";
import { scheduleDeleteNonWorkingTypeAction } from "./schedule.delete-non-working-type";
import { scheduleDeleteTemplateAction } from "./schedule.delete-template";
import { scheduleFindEmptyWindowsAction } from "./schedule.find-empty-windows";
import { scheduleFindOverlapsAction } from "./schedule.find-overlaps";
import { scheduleRemoveBreakAction } from "./schedule.remove-break";
import { scheduleSearchAction } from "./schedule.search";
import { scheduleSetDayOffAction } from "./schedule.set-day-off";
import { scheduleSetVacationAction } from "./schedule.set-vacation";
import { scheduleSetWorkdayAction } from "./schedule.set-workday";
import { scheduleUnblockSlotAction } from "./schedule.unblock-slot";
import { scheduleUpdateBreakAction } from "./schedule.update-break";
import { scheduleUpdateNonWorkingTypeAction } from "./schedule.update-non-working-type";
import { scheduleUpdateTemplateAction } from "./schedule.update-template";
import { scheduleViewDayAction } from "./schedule.view-day";
import { scheduleViewMonthAction } from "./schedule.view-month";
import { scheduleViewWeekAction } from "./schedule.view-week";

export const scheduleActions: CrmAgentActionDefinition[] = [
  scheduleAddBreakAction,
  scheduleApplyTemplateAction,
  scheduleBlockSlotAction,
  scheduleCopyDayAction,
  scheduleCopyWeekAction,
  scheduleCreateNonWorkingTypeAction,
  scheduleCreateTemplateAction,
  scheduleDeleteNonWorkingTypeAction,
  scheduleDeleteTemplateAction,
  scheduleFindEmptyWindowsAction,
  scheduleFindOverlapsAction,
  scheduleRemoveBreakAction,
  scheduleSearchAction,
  scheduleSetDayOffAction,
  scheduleSetVacationAction,
  scheduleSetWorkdayAction,
  scheduleUnblockSlotAction,
  scheduleUpdateBreakAction,
  scheduleUpdateNonWorkingTypeAction,
  scheduleUpdateTemplateAction,
  scheduleViewDayAction,
  scheduleViewMonthAction,
  scheduleViewWeekAction,
];
