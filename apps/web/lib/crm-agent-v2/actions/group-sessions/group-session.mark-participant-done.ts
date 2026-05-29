import { defineCrmAgentAction } from "../define-action";
import { executeGroupSessionAction, previewGroupSessionAction } from "./group-session-helpers";

export const groupSessionMarkParticipantDoneAction = defineCrmAgentAction({
  name: "group_session.mark_participant_done",
  domain: "group-sessions",
  kind: "write",
  intent: "execute",
  status: "implemented",
  risk: "medium",
  permission: "crm.group_sessions.update",
  confirmation: "medium_plus",
  requiredSlots: [],
  optionalSlots: [],
  description: "Отметить участника пришедшим/выполненным.",
  plannerHints: ["Use group_session.mark_participant_done only after required slots are resolved and the user intent matches: Отметить участника пришедшим/выполненным."],
  preview: (payload, ctx) => previewGroupSessionAction("group_session.mark_participant_done", payload, ctx),
  execute: (payload, ctx) => executeGroupSessionAction("group_session.mark_participant_done", payload, ctx),
});
