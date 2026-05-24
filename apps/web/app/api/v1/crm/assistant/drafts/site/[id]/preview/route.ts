import { jsonError, jsonOk } from "@/lib/api";
import { applyCrmAccessCookie, requireCrmApiPermission } from "@/lib/crm-api";
import { buildCrmAgentSiteDraftPreview } from "@/lib/crm-agent-site-preview";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireCrmApiPermission("crm.settings.read");
  if ("response" in auth) return auth.response;

  const { id } = await context.params;
  const draftId = Number(id);
  if (!Number.isInteger(draftId) || draftId <= 0) {
    return jsonError("INVALID_DRAFT_ID", "Некорректный номер черновика.", null, 400);
  }

  const preview = await buildCrmAgentSiteDraftPreview({
    accountId: auth.session.accountId,
    draftId,
  });
  if (!preview) return jsonError("NOT_FOUND", "Черновик не найден.", null, 404);

  const response = jsonOk(preview);
  return applyCrmAccessCookie(response, auth);
}
