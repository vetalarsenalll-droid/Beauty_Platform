import { prisma } from "@/lib/prisma";
import { buildActionPreview } from "../action-preview";
import { numberOrNull, requiredNumber, requiredString, type JsonRecord } from "../action-helpers";
import { defineCrmAgentAction } from "../define-action";

export const reviewReplyAction = defineCrmAgentAction({
  name: "review.reply",
  domain: "reviews",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "medium",
  permission: "crm.reviews.manage",
  confirmation: "medium_plus",
  requiredSlots: ["reviewId", "replyText"],
  optionalSlots: [],
  description: "Ответить на отзыв.",
  plannerHints: ["Use review.reply only after required slots are resolved and the user intent matches: Ответить на отзыв."],
  preview: async (payload: JsonRecord, ctx) => {
    const reviewId = numberOrNull(payload.reviewId);
    const review = reviewId
      ? await prisma.review.findFirst({
          where: { id: reviewId, accountId: ctx.accountId },
          select: { id: true, rating: true, comment: true, replyText: true, repliedAt: true },
        })
      : null;
    const before = review ? { ...review, repliedAt: review.repliedAt?.toISOString() ?? null } : null;
    return buildActionPreview({ before, after: { ...(before ?? {}), ...payload, repliedAt: "on_execute" } });
  },
  execute: async (payload: JsonRecord, ctx) => {
    const reviewId = requiredNumber(payload.reviewId, "reviewId");
    const updated = await prisma.review.updateMany({
      where: { id: reviewId, accountId: ctx.accountId },
      data: { replyText: requiredString(payload, "replyText"), repliedAt: new Date(), repliedByUserId: ctx.userId ?? null },
    });
    if (!updated.count) throw new Error("Review not found.");
    return { status: "DONE", data: { reviewId } };
  },
});
