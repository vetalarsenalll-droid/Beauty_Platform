import type { CrmAgentActionDefinition } from "../types";
import { groupSessionAddParticipantAction } from "./group-session.add-participant";
import { groupSessionCancelAction } from "./group-session.cancel";
import { groupSessionChangeCapacityAction } from "./group-session.change-capacity";
import { groupSessionChangePriceAction } from "./group-session.change-price";
import { groupSessionCreateAction } from "./group-session.create";
import { groupSessionMarkParticipantDoneAction } from "./group-session.mark-participant-done";
import { groupSessionMarkParticipantNoShowAction } from "./group-session.mark-participant-no-show";
import { groupSessionRemoveParticipantAction } from "./group-session.remove-participant";
import { groupSessionSearchAction } from "./group-session.search";
import { groupSessionUpdateAction } from "./group-session.update";
import { groupSessionUpdateParticipantStatusAction } from "./group-session.update-participant-status";
import { groupSessionViewAction } from "./group-session.view";

export const groupSessionsActions: CrmAgentActionDefinition[] = [
  groupSessionAddParticipantAction,
  groupSessionCancelAction,
  groupSessionChangeCapacityAction,
  groupSessionChangePriceAction,
  groupSessionCreateAction,
  groupSessionMarkParticipantDoneAction,
  groupSessionMarkParticipantNoShowAction,
  groupSessionRemoveParticipantAction,
  groupSessionSearchAction,
  groupSessionUpdateAction,
  groupSessionUpdateParticipantStatusAction,
  groupSessionViewAction,
];
