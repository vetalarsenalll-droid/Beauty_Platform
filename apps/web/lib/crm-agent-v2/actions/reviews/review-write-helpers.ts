import { prisma } from "@/lib/prisma";
import { buildActionPreview } from "../action-preview";
import { optionalString, requiredNumber, requiredString, type JsonRecord } from "../action-helpers";
import type { CrmAgentActionContext } from "../types";
import { getReviewById, reviewSelect, reviewTake, reviewWhere, serializeReview } from "./review-read-helpers";

type ReviewStatusValue = "PUBLISHED" | "PENDING" | "HIDDEN";

export async function previewReviewMutation(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const before = await loadReviewBefore(ctx.accountId, numberOrNull(payload.reviewId));
  return buildActionPreview({ before, after: { ...(before ?? {}), ...payload } });
}

export async function previewGeneratedReply(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const reviewId = requiredNumber(payload.reviewId, "reviewId");
  const before = await loadReviewBefore(ctx.accountId, reviewId);
  if (!before) throw new Error("Review not found.");
  const replyText = draftReply(before);
  return buildActionPreview({ before, after: { ...before, replyText, generated: true } });
}

export async function executeReviewReplyUpdate(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const reviewId = requiredNumber(payload.reviewId, "reviewId");
  const updated = await prisma.review.updateMany({
    where: { id: reviewId, accountId: ctx.accountId },
    data: { replyText: requiredString(payload, "replyText"), repliedAt: ctx.now, repliedByUserId: ctx.userId ?? null },
  });
  if (!updated.count) throw new Error("Review not found.");
  return { status: "DONE" as const, data: { reviewId } };
}

export async function executeReviewReplyDelete(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const reviewId = requiredNumber(payload.reviewId, "reviewId");
  const updated = await prisma.review.updateMany({
    where: { id: reviewId, accountId: ctx.accountId },
    data: { replyText: null, repliedAt: null, repliedByUserId: null },
  });
  if (!updated.count) throw new Error("Review not found.");
  return { status: "DONE" as const, data: { reviewId } };
}

export async function executeReviewStatusChange(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const reviewId = requiredNumber(payload.reviewId, "reviewId");
  const status = reviewStatus(payload.status);
  const updated = await prisma.review.updateMany({
    where: { id: reviewId, accountId: ctx.accountId },
    data: {
      status,
      moderationReason: optionalString(payload, "moderationReason"),
      moderatedAt: ctx.now,
      moderatedByUserId: ctx.userId ?? null,
    },
  });
  if (!updated.count) throw new Error("Review not found.");
  return { status: "DONE" as const, data: { reviewId, status } };
}

export async function executeReviewBulkStatusChange(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const reviewIds = numberArray(payload.reviewIds);
  if (!reviewIds.length) throw new Error("Action payload reviewIds is required.");
  const status = reviewStatus(payload.status);
  const updated = await prisma.review.updateMany({
    where: { id: { in: reviewIds }, accountId: ctx.accountId },
    data: {
      status,
      moderationReason: optionalString(payload, "moderationReason"),
      moderatedAt: ctx.now,
      moderatedByUserId: ctx.userId ?? null,
    },
  });
  return { status: "DONE" as const, data: { reviewIds, updated: updated.count, status } };
}

export async function executeReviewReplyMediaAttach(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const reviewId = requiredNumber(payload.reviewId, "reviewId");
  const assetId = requiredNumber(payload.assetId, "assetId");
  await assertReview(ctx.accountId, reviewId);
  await assertMediaAsset(ctx.accountId, assetId);
  const link = await prisma.mediaLink.create({
    data: {
      assetId,
      entityType: "review_reply",
      entityId: String(reviewId),
      sortOrder: numberOrNull(payload.sortOrder) ?? 0,
      isCover: false,
    },
  });
  return { status: "DONE" as const, data: { reviewId, assetId, mediaLinkId: link.id } };
}

export async function executeReviewReplyMediaRemove(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const reviewId = requiredNumber(payload.reviewId, "reviewId");
  const assetId = requiredNumber(payload.assetId, "assetId");
  await assertReview(ctx.accountId, reviewId);
  const deleted = await prisma.mediaLink.deleteMany({ where: { assetId, entityType: "review_reply", entityId: String(reviewId) } });
  return { status: "DONE" as const, data: { reviewId, assetId, removed: deleted.count } };
}

export async function readComplaintAnalysis(accountId: number, payload: JsonRecord) {
  const rows = await prisma.review.findMany({
    where: { ...reviewWhere(payload, accountId), rating: { lte: 3 } },
    orderBy: { createdAt: "desc" },
    take: reviewTake(payload.take, 50, 200),
    select: reviewSelect,
  });
  const reviews = rows.map(serializeReview);
  const themes = summarizeThemes(reviews.map((review) => [review.comment, review.moderationReason].filter(Boolean).join(" ")));
  return {
    count: reviews.length,
    avgRating: reviews.length ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length : null,
    themes,
    reviews,
  };
}

export async function previewProcessFix(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const analysis = await readComplaintAnalysis(ctx.accountId, payload);
  const recommendations = analysis.themes.map((theme) => ({
    theme: theme.term,
    recommendation: `Review operating process around "${theme.term}" and assign an owner for recurring complaints.`,
  }));
  return buildActionPreview({ after: { analysis, recommendations, generated: true } });
}

async function loadReviewBefore(accountId: number, reviewId: number | null) {
  if (!reviewId) return null;
  const review = await getReviewById(accountId, reviewId);
  if (!review) return null;
  const media = await prisma.mediaLink.findMany({
    where: { entityType: "review_reply", entityId: String(reviewId) },
    orderBy: { sortOrder: "asc" },
    select: { id: true, assetId: true, sortOrder: true, asset: { select: { url: true, type: true } } },
  });
  return { ...serializeReview(review), replyMedia: media };
}

async function assertReview(accountId: number, reviewId: number) {
  const review = await prisma.review.findFirst({ where: { id: reviewId, accountId }, select: { id: true } });
  if (!review) throw new Error("Review not found.");
}

async function assertMediaAsset(accountId: number, assetId: number) {
  const asset = await prisma.mediaAsset.findFirst({ where: { id: assetId, OR: [{ accountId }, { accountId: null }] }, select: { id: true } });
  if (!asset) throw new Error("Media asset not found.");
}

function draftReply(review: Record<string, unknown>) {
  const rating = Number(review.rating ?? 0);
  if (rating <= 3) {
    return "Спасибо за обратную связь. Нам жаль, что визит не оправдал ожидания. Мы разберем ситуацию и свяжемся с вами, чтобы предложить решение.";
  }
  return "Спасибо за отзыв. Нам приятно, что вам понравился визит. Будем рады видеть вас снова.";
}

function reviewStatus(value: unknown): ReviewStatusValue {
  if (value === "PUBLISHED" || value === "PENDING" || value === "HIDDEN") return value;
  throw new Error("Action payload status must be PUBLISHED, PENDING or HIDDEN.");
}

function numberArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map(numberOrNull).filter((item): item is number => item != null);
}

function numberOrNull(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && /^\d+$/.test(value)) return Number(value);
  return null;
}

function summarizeThemes(texts: string[]) {
  const words = new Map<string, number>();
  for (const text of texts) {
    for (const word of text.toLocaleLowerCase("ru-RU").split(/[^a-zа-яё0-9]+/iu)) {
      if (word.length < 4) continue;
      words.set(word, (words.get(word) ?? 0) + 1);
    }
  }
  return [...words.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([term, count]) => ({ term, count }));
}
