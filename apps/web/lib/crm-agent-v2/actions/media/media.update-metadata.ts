import { defineCrmAgentAction } from "../define-action";

export const mediaUpdateMetadataAction = defineCrmAgentAction({
  name: "media.update_metadata",
  domain: "media",
  kind: "write",
  intent: "update",
  status: "blocked",
  risk: "medium",
  permission: "crm.media.update",
  confirmation: "medium_plus",
  requiredSlots: [],
  optionalSlots: [],
  description: "Изменить metadata.",
  plannerHints: ["Use media.update_metadata only after required slots are resolved and the user intent matches: Изменить metadata.", "Blocked: current Prisma schema has MediaAsset without archive/alt/metadata fields, so this action needs schema support before execution."],
});
