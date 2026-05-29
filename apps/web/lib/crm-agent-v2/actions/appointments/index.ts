import type { CrmAgentActionDefinition } from "../types";
import { appointmentAddCommentAction } from "./appointment.add-comment";
import { appointmentCancelAction } from "./appointment.cancel";
import { appointmentChangeClientAction } from "./appointment.change-client";
import { appointmentChangeDurationAction } from "./appointment.change-duration";
import { appointmentChangeLocationAction } from "./appointment.change-location";
import { appointmentChangePriceAction } from "./appointment.change-price";
import { appointmentChangeServiceAction } from "./appointment.change-service";
import { appointmentChangeSpecialistAction } from "./appointment.change-specialist";
import { appointmentChangeTimeAction } from "./appointment.change-time";
import { appointmentConfirmAction } from "./appointment.confirm";
import { appointmentCreateAction } from "./appointment.create";
import { appointmentFindSlotsAction } from "./appointment.find-slots";
import { appointmentHoldSlotAction } from "./appointment.hold-slot";
import { appointmentMarkDoneAction } from "./appointment.mark-done";
import { appointmentMarkNoShowAction } from "./appointment.mark-no-show";
import { appointmentReleaseHoldAction } from "./appointment.release-hold";
import { appointmentRescheduleAction } from "./appointment.reschedule";
import { appointmentResolveAction } from "./appointment.resolve";
import { appointmentSearchAction } from "./appointment.search";
import { appointmentUpdateCommentAction } from "./appointment.update-comment";
import { appointmentViewAction } from "./appointment.view";
import { appointmentViewConflictsAction } from "./appointment.view-conflicts";
import { appointmentViewHistoryAction } from "./appointment.view-history";

export const appointmentsActions: CrmAgentActionDefinition[] = [
  appointmentAddCommentAction,
  appointmentCancelAction,
  appointmentChangeClientAction,
  appointmentChangeDurationAction,
  appointmentChangeLocationAction,
  appointmentChangePriceAction,
  appointmentChangeServiceAction,
  appointmentChangeSpecialistAction,
  appointmentChangeTimeAction,
  appointmentConfirmAction,
  appointmentCreateAction,
  appointmentFindSlotsAction,
  appointmentHoldSlotAction,
  appointmentMarkDoneAction,
  appointmentMarkNoShowAction,
  appointmentReleaseHoldAction,
  appointmentRescheduleAction,
  appointmentResolveAction,
  appointmentSearchAction,
  appointmentUpdateCommentAction,
  appointmentViewAction,
  appointmentViewConflictsAction,
  appointmentViewHistoryAction,
];
