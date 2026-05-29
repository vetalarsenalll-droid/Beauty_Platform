import { prisma } from "@/lib/prisma";
import { type JsonRecord } from "../action-helpers";
import { defineCrmAgentAction } from "../define-action";
import { reviewMatchesQuery, reviewQuery, reviewSelect, reviewTake, reviewWhere, serializeReview } from "./review-read-helpers";

export const reviewResolveAction = defineCrmAgentAction({
  name: "review.resolve",
  domain: "reviews",
  kind: "read",
  intent: "read",
  status: "read_only",
  risk: "low",
  permission: "crm.reviews.read",
  confirmation: "never",
  requiredSlots: [],
  optionalSlots: ["query", "reviewId", "clientId", "appointmentId", "minRating", "maxRating", "status", "take"],
  description: "Разрешить неоднозначный отзыв.",
  plannerHints: ["Use review.resolve when the user asks to inspect: Разрешить неоднозначный отзыв."],
  read: async (payload: JsonRecord, ctx) => {
    const query = reviewQuery(payload);
    const rows = await prisma.review.findMany({
      where: reviewWhere(payload, ctx.accountId),
      orderBy: { createdAt: "desc" },
      take: reviewTake(payload.take, 8, 30),
      select: reviewSelect,
    });
    const candidates = rows.map(serializeReview).filter((review) => reviewMatchesQuery(review, query));
    return { resolved: candidates.length === 1 ? candidates[0] : null, candidates, ambiguous: candidates.length !== 1 };
  },
});
