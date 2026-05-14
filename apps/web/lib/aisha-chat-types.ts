import type { ChatUi } from "@/lib/booking-flow";
import type { RequiredLegalDocumentLite } from "@/lib/aisha-chat-preload";
import type { DraftLike, LocationLite, ServiceLite, SpecialistLite } from "@/lib/booking-tools";
import type { AishaIntent } from "@/lib/dialog-policy";
import type { PublicAiRoute } from "@/lib/aisha-chat-router";
import type { RouteDecision } from "@/lib/aisha-route-contract";
import type { buildIntentContext } from "@/lib/aisha-chat-intent-context";
import type { draftView } from "@/lib/aisha-chat-parsers";
import type { resolvePublicAccount } from "@/lib/public-booking";
import type { getClientSession } from "@/lib/auth";
import type { resolveClientForAccount } from "@/lib/aisha-chat-thread";

export type Body = {
  message?: unknown;
  threadId?: unknown;
  threadKey?: unknown;
  clientTodayYmd?: unknown;
  clientTimeZone?: unknown;
  clientRequestId?: unknown;
};

export type Action = { type: "open_booking"; bookingUrl: string } | null;

export type PreparedPostTurn = {
  resolved: Awaited<ReturnType<typeof resolvePublicAccount>>;
  body: Body;
  message: string;
  session: Awaited<ReturnType<typeof getClientSession>>;
  client: Awaited<ReturnType<typeof resolveClientForAccount>>;
  thread: { id: number; clientId: number | null };
  draft: Parameters<typeof draftView>[0];
  nextThreadKey: string | null;
  turnAction: { id: number };
  idempotencyRecordId: number | null;
};

export type TurnContext = {
  recentMessages: Array<{ role: string; content: string }>;
  locations: LocationLite[];
  services: ServiceLite[];
  specialists: SpecialistLite[];
  requiredVersionIds: number[];
  requiredLegalDocuments: RequiredLegalDocumentLite[];
  accountProfile: { description: string | null; address: string | null; phone: string | null } | null;
  customPrompt: string | null;
  assistantName: string;
  nowYmd: string;
  nowHm: string;
  clientTimeZone: string | null;
  t: string;
  d: DraftLike;
  nluResult: { nlu?: unknown; source: string };
  intentContext: ReturnType<typeof buildIntentContext>;
};

export type DraftDecision = {
  shouldContinueBookingByContext: boolean;
  shouldEnrichDraftForBooking: boolean;
  shouldRunBookingFlow: boolean;
  bookingMessageNorm: string;
  locationChosenThisTurn: boolean;
};

export type TurnRouteTrace = {
  initialRouteDecision?: RouteDecision;
  finalRouteDecision?: RouteDecision;
  shouldRunBookingFlow?: boolean;
};

export type TurnDebugTrace = {
  rawMessage?: string;
  normalizedMessage?: string;
  nluResult?: unknown;
  draftBefore?: unknown;
  guardResults?: Array<{ reason: string | null }>;
};

export type TurnResult = {
  reply: string;
  nextStatus: string;
  nextAction: Action;
  nextUi: ChatUi | null;
  guardReason: string | null;
  route: PublicAiRoute;
  intent: AishaIntent;
};
