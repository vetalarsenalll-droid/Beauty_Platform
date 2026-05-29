import { defineCrmAgentAction } from "../define-action";
import { executeGroupSessionAction, previewGroupSessionAction } from "./group-session-helpers";

export const groupSessionUpdateParticipantStatusAction = defineCrmAgentAction({
  name: "group_session.update_participant_status",
  domain: "group-sessions",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "medium",
  permission: "crm.group_sessions.update",
  confirmation: "medium_plus",
  requiredSlots: [],
  optionalSlots: [],
  description: "Изменить статус участника.",
  plannerHints: ["Use group_session.update_participant_status only after required slots are resolved and the user intent matches: Изменить статус участника."],
  preview: (payload, ctx) => previewGroupSessionAction("group_session.update_participant_status", payload, ctx),
  execute: (payload, ctx) => executeGroupSessionAction("group_session.update_participant_status", payload, ctx),
});
