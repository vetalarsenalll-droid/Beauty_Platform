import { jsonError, jsonOk } from "@/lib/api";
import { applyCrmAccessCookie, requireCrmApiPermission } from "@/lib/crm-api";
import { createPendingAction, createReviewDraft, listReviewDrafts } from "@/lib/crm-agent-persistence";

export async function GET() {
  const auth = await requireCrmApiPermission("crm.reviews.read");
  if ("response" in auth) return auth.response;

  const drafts = await listReviewDrafts({ accountId: auth.session.accountId, take: 50 });
  const response = jsonOk({ drafts });
  return applyCrmAccessCookie(response, auth);
}

export async function POST(request: Request) {
  const auth = await requireCrmApiPermission("crm.reviews.manage");
  if ("response" in auth) return auth.response;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return jsonError("INVALID_BODY", "Invalid request body.", null, 400);
  }

  const reviewId = typeof body.reviewId === "number" ? body.reviewId : null;
  const replyText = typeof body.replyText === "string" ? body.replyText.trim() : "";
  if (!reviewId || !replyText) {
    return jsonError("VALIDATION_FAILED", "reviewId and replyText are required.", null, 400);
  }

  const draft = await createReviewDraft({
    accountId: auth.session.accountId,
    reviewId,
    replyText,
  });
  const pendingAction = await createPendingAction({
    accountId: auth.session.accountId,
    userId: auth.session.userId,
    actionType: "review.reply",
    summary: `Reply to review #${reviewId}`,
    payload: { reviewId, replyText, draftId: draft.id },
    riskLevel: "high",
    permission: "crm.reviews.manage",
  });

  const response = jsonOk({ draft, pendingActionId: pendingAction.id }, 201);
  return applyCrmAccessCookie(response, auth);
}
