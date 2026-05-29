import { defineCrmAgentAction } from "../define-action";
import { executeGroupSessionAction, previewGroupSessionAction } from "./group-session-helpers";

export const groupSessionAddParticipantAction = defineCrmAgentAction({
  name: "group_session.add_participant",
  domain: "group-sessions",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "medium",
  permission: "crm.group_sessions.update",
  confirmation: "medium_plus",
  requiredSlots: [],
  optionalSlots: [],
  description: "Добавить участника.",
  plannerHints: ["Use group_session.add_participant only after required slots are resolved and the user intent matches: Добавить участника."],
  preview: (payload, ctx) => previewGroupSessionAction("group_session.add_participant", payload, ctx),
  execute: (payload, ctx) => executeGroupSessionAction("group_session.add_participant", payload, ctx),
});
