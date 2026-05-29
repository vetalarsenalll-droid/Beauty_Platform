import type { CrmAgentActionDefinition } from "../types";
import { serviceActivateAction } from "./service.activate";
import { serviceAddVariantAction } from "./service.add-variant";
import { serviceArchiveAction } from "./service.archive";
import { serviceAssignLocationAction } from "./service.assign-location";
import { serviceAssignSpecialistAction } from "./service.assign-specialist";
import { serviceAttachMediaAction } from "./service.attach-media";
import { serviceCreateAction } from "./service.create";
import { serviceCreateCategoryAction } from "./service.create-category";
import { serviceDeleteCategoryAction } from "./service.delete-category";
import { serviceDeleteIfEmptyAction } from "./service.delete-if-empty";
import { serviceDeleteVariantAction } from "./service.delete-variant";
import { serviceDetachMediaAction } from "./service.detach-media";
import { serviceGenerateDescriptionAction } from "./service.generate-description";
import { serviceMoveToCategoryAction } from "./service.move-to-category";
import { serviceResolveAction } from "./service.resolve";
import { serviceRestoreAction } from "./service.restore";
import { serviceSearchAction } from "./service.search";
import { serviceUnassignLocationAction } from "./service.unassign-location";
import { serviceUnassignSpecialistAction } from "./service.unassign-specialist";
import { serviceUpdateAction } from "./service.update";
import { serviceUpdateBookingTypeAction } from "./service.update-booking-type";
import { serviceUpdateCategoryAction } from "./service.update-category";
import { serviceUpdateDescriptionAction } from "./service.update-description";
import { serviceUpdateDurationAction } from "./service.update-duration";
import { serviceUpdateLevelConfigAction } from "./service.update-level-config";
import { serviceUpdateNameAction } from "./service.update-name";
import { serviceUpdatePriceAction } from "./service.update-price";
import { serviceUpdateVariantAction } from "./service.update-variant";
import { serviceViewAction } from "./service.view";

export const servicesActions: CrmAgentActionDefinition[] = [
  serviceActivateAction,
  serviceAddVariantAction,
  serviceArchiveAction,
  serviceAssignLocationAction,
  serviceAssignSpecialistAction,
  serviceAttachMediaAction,
  serviceCreateAction,
  serviceCreateCategoryAction,
  serviceDeleteCategoryAction,
  serviceDeleteIfEmptyAction,
  serviceDeleteVariantAction,
  serviceDetachMediaAction,
  serviceGenerateDescriptionAction,
  serviceMoveToCategoryAction,
  serviceResolveAction,
  serviceRestoreAction,
  serviceSearchAction,
  serviceUnassignLocationAction,
  serviceUnassignSpecialistAction,
  serviceUpdateAction,
  serviceUpdateBookingTypeAction,
  serviceUpdateCategoryAction,
  serviceUpdateDescriptionAction,
  serviceUpdateDurationAction,
  serviceUpdateLevelConfigAction,
  serviceUpdateNameAction,
  serviceUpdatePriceAction,
  serviceUpdateVariantAction,
  serviceViewAction,
];
