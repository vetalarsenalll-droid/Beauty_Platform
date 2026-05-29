import { prisma } from "@/lib/prisma";
import { type JsonRecord } from "../action-helpers";
import { defineCrmAgentAction } from "../define-action";
import { reviewSelect, reviewTake, reviewWhere, serializeReview } from "./review-read-helpers";

export const reviewFindUnansweredAction = defineCrmAgentAction({
  name: "review.find_unanswered",
  domain: "reviews",
  kind: "read",
  intent: "read",
  status: "read_only",
  risk: "low",
  permission: "crm.reviews.read",
  confirmation: "never",
  requiredSlots: [],
  optionalSlots: ["clientId", "appointmentId", "minRating", "maxRating", "status", "dateFrom", "dateTo", "take"],
  description: "Найти отзывы без ответа.",
  plannerHints: ["Use review.find_unanswered when the user asks to inspect: Найти отзывы без ответа."],
  read: async (payload: JsonRecord, ctx) => {
    const rows = await prisma.review.findMany({
      where: { ...reviewWhere(payload, ctx.accountId), OR: [{ replyText: null }, { replyText: "" }] },
      orderBy: { createdAt: "desc" },
      take: reviewTake(payload.take),
      select: reviewSelect,
    });
    return { reviews: rows.map(serializeReview), count: rows.length };
  },
});
