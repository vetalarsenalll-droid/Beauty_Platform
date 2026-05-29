import { defineCrmAgentAction } from "../define-action";
import { readPermissionMatrix } from "./users-helpers";

export const permissionViewMatrixAction = defineCrmAgentAction({
  name: "permission.view_matrix",
  domain: "users",
  kind: "read",
  intent: "read",
  status: "read_only",
  risk: "medium",
  permission: "crm.roles.read",
  confirmation: "never",
  requiredSlots: [],
  optionalSlots: [],
  description: "Показать матрицу permissions.",
  plannerHints: ["Use permission.view_matrix to inspect available permissions and role assignments."],
  read: async (_payload, ctx) => readPermissionMatrix(ctx.accountId),
});
