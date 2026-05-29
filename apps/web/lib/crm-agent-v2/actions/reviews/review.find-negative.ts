import { prisma } from "@/lib/prisma";
import { type JsonRecord } from "../action-helpers";
import { defineCrmAgentAction } from "../define-action";
import { reviewSelect, reviewTake, reviewWhere, serializeReview } from "./review-read-helpers";

export const reviewFindNegativeAction = defineCrmAgentAction({
  name: "review.find_negative",
  domain: "reviews",
  kind: "read",
  intent: "read",
  status: "read_only",
  risk: "low",
  permission: "crm.reviews.read",
  confirmation: "never",
  requiredSlots: [],
  optionalSlots: ["clientId", "appointmentId", "status", "dateFrom", "dateTo", "take"],
  description: "Найти негативные отзывы.",
  plannerHints: ["Use review.find_negative when the user asks to inspect: Найти негативные отзывы."],
  read: async (payload: JsonRecord, ctx) => {
    const rows = await prisma.review.findMany({
      where: { ...reviewWhere(payload, ctx.accountId), rating: { lte: 3 } },
      orderBy: { createdAt: "desc" },
      take: reviewTake(payload.take),
      select: reviewSelect,
    });
    return { reviews: rows.map(serializeReview), count: rows.length };
  },
});
