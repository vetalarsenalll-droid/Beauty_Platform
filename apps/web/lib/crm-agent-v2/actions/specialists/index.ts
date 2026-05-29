import type { CrmAgentActionDefinition } from "../types";
import { specialistAssignCategoryAction } from "./specialist.assign-category";
import { specialistAssignLocationAction } from "./specialist.assign-location";
import { specialistAssignServiceAction } from "./specialist.assign-service";
import { specialistCreateAction } from "./specialist.create";
import { specialistGenerateBioAction } from "./specialist.generate-bio";
import { specialistHideAction } from "./specialist.hide";
import { specialistRemoveCategoryAction } from "./specialist.remove-category";
import { specialistResolveAction } from "./specialist.resolve";
import { specialistSearchAction } from "./specialist.search";
import { specialistSetLevelAction } from "./specialist.set-level";
import { specialistSetPublicAction } from "./specialist.set-public";
import { specialistUnassignLocationAction } from "./specialist.unassign-location";
import { specialistUnassignServiceAction } from "./specialist.unassign-service";
import { specialistUpdateAction } from "./specialist.update";
import { specialistUpdateAvatarAction } from "./specialist.update-avatar";
import { specialistUpdateBioAction } from "./specialist.update-bio";
import { specialistViewAction } from "./specialist.view";
import { specialistViewEmptySlotsAction } from "./specialist.view-empty-slots";
import { specialistViewRevenueAction } from "./specialist.view-revenue";
import { specialistViewReviewsAction } from "./specialist.view-reviews";
import { specialistViewWorkloadAction } from "./specialist.view-workload";

export const specialistsActions: CrmAgentActionDefinition[] = [
  specialistAssignCategoryAction,
  specialistAssignLocationAction,
  specialistAssignServiceAction,
  specialistCreateAction,
  specialistGenerateBioAction,
  specialistHideAction,
  specialistRemoveCategoryAction,
  specialistResolveAction,
  specialistSearchAction,
  specialistSetLevelAction,
  specialistSetPublicAction,
  specialistUnassignLocationAction,
  specialistUnassignServiceAction,
  specialistUpdateAction,
  specialistUpdateAvatarAction,
  specialistUpdateBioAction,
  specialistViewAction,
  specialistViewEmptySlotsAction,
  specialistViewRevenueAction,
  specialistViewReviewsAction,
  specialistViewWorkloadAction,
];
