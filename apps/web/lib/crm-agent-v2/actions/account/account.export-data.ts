import { defineCrmAgentAction } from "../define-action";
import { executeAccountAction, previewAccountAction } from "./account-helpers";

export const accountExportDataAction = defineCrmAgentAction({
  name: "account.export_data",
  domain: "account",
  kind: "export",
  intent: "execute",
  status: "implemented",
  risk: "high",
  permission: "crm.settings.export",
  confirmation: "always",
  requiredSlots: [],
  optionalSlots: [],
  description: "Экспортировать данные аккаунта.",
  plannerHints: ["Use account.export_data only after required slots are resolved and the user intent matches: Экспортировать данные аккаунта."],
  preview: (payload, ctx) => previewAccountAction("account.export_data", payload, ctx),
  execute: (payload, ctx) => executeAccountAction("account.export_data", payload, ctx),
});
