import { defineCrmAgentAction } from "../define-action";
import { previewClientExport } from "./client-write-helpers";

export const clientExportSegmentAction = defineCrmAgentAction({
  name: "client.export_segment",
  domain: "clients",
  kind: "export",
  intent: "execute",
  status: "draft_only",
  risk: "high",
  permission: "crm.clients.export",
  confirmation: "always",
  requiredSlots: [],
  optionalSlots: ["query", "tagName", "createdFrom", "createdTo", "format", "take"],
  description: "Экспортировать сегмент клиентов.",
  plannerHints: ["Use client.export_segment only after export filters and destination are clear."],
  preview: previewClientExport,
});
