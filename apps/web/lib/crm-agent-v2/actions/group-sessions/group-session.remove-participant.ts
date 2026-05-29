import { defineCrmAgentAction } from "../define-action";
import { executeGroupSessionAction, previewGroupSessionAction } from "./group-session-helpers";

export const groupSessionRemoveParticipantAction = defineCrmAgentAction({
  name: "group_session.remove_participant",
  domain: "group-sessions",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "high",
  permission: "crm.group_sessions.update",
  confirmation: "always",
  requiredSlots: [],
  optionalSlots: [],
  description: "Убрать участника.",
  plannerHints: ["Use group_session.remove_participant only after required slots are resolved and the user intent matches: Убрать участника."],
  preview: (payload, ctx) => previewGroupSessionAction("group_session.remove_participant", payload, ctx),
  execute: (payload, ctx) => executeGroupSessionAction("group_session.remove_participant", payload, ctx),
});
