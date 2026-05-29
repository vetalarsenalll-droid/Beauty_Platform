import { defineCrmAgentAction } from "../define-action";
import { previewClientSegment } from "./client-write-helpers";

export const clientCreateSegmentAction = defineCrmAgentAction({
  name: "client.create_segment",
  domain: "clients",
  kind: "write",
  intent: "create",
  status: "draft_only",
  risk: "medium",
  permission: "crm.clients.segments.manage",
  confirmation: "medium_plus",
  requiredSlots: ["name"],
  optionalSlots: ["query", "tagName", "createdFrom", "createdTo", "take"],
  description: "Создать сегмент клиентов.",
  plannerHints: ["Use client.create_segment to preview a client audience from filters."],
  preview: previewClientSegment,
});
