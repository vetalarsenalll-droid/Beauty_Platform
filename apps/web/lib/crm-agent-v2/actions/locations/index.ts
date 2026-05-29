import type { CrmAgentActionDefinition } from "../types";
import { locationActivateAction } from "./location.activate";
import { locationAddExceptionAction } from "./location.add-exception";
import { locationAssignManagerAction } from "./location.assign-manager";
import { locationAttachMediaAction } from "./location.attach-media";
import { locationCreateAction } from "./location.create";
import { locationDeactivateAction } from "./location.deactivate";
import { locationDetachMediaAction } from "./location.detach-media";
import { locationGenerateDescriptionAction } from "./location.generate-description";
import { locationRemoveExceptionAction } from "./location.remove-exception";
import { locationRemoveManagerAction } from "./location.remove-manager";
import { locationResolveAction } from "./location.resolve";
import { locationSearchAction } from "./location.search";
import { locationUpdateAction } from "./location.update";
import { locationUpdateAddressAction } from "./location.update-address";
import { locationUpdateDescriptionAction } from "./location.update-description";
import { locationUpdateHoursAction } from "./location.update-hours";
import { locationUpdateNameAction } from "./location.update-name";
import { locationUpdatePhoneAction } from "./location.update-phone";
import { locationViewAction } from "./location.view";
import { locationViewScheduleAction } from "./location.view-schedule";
import { locationViewWorkloadAction } from "./location.view-workload";

export const locationsActions: CrmAgentActionDefinition[] = [
  locationActivateAction,
  locationAddExceptionAction,
  locationAssignManagerAction,
  locationAttachMediaAction,
  locationCreateAction,
  locationDeactivateAction,
  locationDetachMediaAction,
  locationGenerateDescriptionAction,
  locationRemoveExceptionAction,
  locationRemoveManagerAction,
  locationResolveAction,
  locationSearchAction,
  locationUpdateAction,
  locationUpdateAddressAction,
  locationUpdateDescriptionAction,
  locationUpdateHoursAction,
  locationUpdateNameAction,
  locationUpdatePhoneAction,
  locationViewAction,
  locationViewScheduleAction,
  locationViewWorkloadAction,
];
