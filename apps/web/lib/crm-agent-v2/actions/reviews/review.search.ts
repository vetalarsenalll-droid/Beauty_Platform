import { prisma } from "@/lib/prisma";
import { type JsonRecord } from "../action-helpers";
import { defineCrmAgentAction } from "../define-action";
import { reviewMatchesQuery, reviewQuery, reviewSelect, reviewTake, reviewWhere, serializeReview } from "./review-read-helpers";

export const reviewSearchAction = defineCrmAgentAction({
  name: "review.search",
  domain: "reviews",
  kind: "read",
  intent: "read",
  status: "read_only",
  risk: "low",
  permission: "crm.reviews.read",
  confirmation: "never",
  requiredSlots: [],
  optionalSlots: ["query", "reviewId", "clientId", "appointmentId", "minRating", "maxRating", "status", "dateFrom", "dateTo", "take"],
  description: "Найти отзывы.",
  plannerHints: ["Use review.search when the user asks to inspect: Найти отзывы."],
  read: async (payload: JsonRecord, ctx) => {
    const query = reviewQuery(payload);
    const rows = await prisma.review.findMany({
      where: reviewWhere(payload, ctx.accountId),
      orderBy: { createdAt: "desc" },
      take: reviewTake(payload.take),
      select: reviewSelect,
    });
    return { reviews: rows.map(serializeReview).filter((review) => reviewMatchesQuery(review, query)) };
  },
});
