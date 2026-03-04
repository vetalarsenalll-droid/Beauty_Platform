import type { ChatUi } from "@/lib/booking-flow";
import type { DraftLike, LocationLite, ServiceLite, SpecialistLite } from "@/lib/booking-tools";
import type { AishaIntent } from "@/lib/dialog-policy";
import type { PublicAiRoute } from "@/lib/aisha-chat-router";
import type { resolvePublicAccount } from "@/lib/public-booking";
import type { getClientSession } from "@/lib/auth";
import type { resolveClientForAccount } from "@/lib/aisha-chat-thread";

export type Body = {
  message?: unknown;
  threadId?: unknown;
  threadKey?: unknown;
  clientTodayYmd?: unknown;
  clientTimeZone?: unknown;
};

export type Action = { type: "open_booking"; bookingUrl: string } | null;

export type PreparedPostTurn = {
  resolved: Awaited<ReturnType<typeof resolvePublicAccount>>;
  body: Body;
  message: string;
  session: Awaited<ReturnType<typeof getClientSession>>;
  client: Awaited<ReturnType<typeof resolveClientForAccount>>;
  thread: { id: number; clientId: number | null };
  draft: any;
  nextThreadKey: string | null;
  turnAction: { id: number };
};

export type TurnContext = {
  recentMessages: Array<{ role: string; content: string }>;
  locations: LocationLite[];
  services: ServiceLite[];
  specialists: SpecialistLite[];
  requiredVersionIds: number[];
  accountProfile: { description: string | null; address: string | null; phone: string | null } | null;
  customPrompt: string | null;
  nowYmd: string;
  nowHm: string;
  clientTimeZone: string | null;
  t: string;
  d: DraftLike;
  nluResult: { nlu?: any; source: string };
  intentContext: any;
};

export type DraftDecision = {
  shouldContinueBookingByContext: boolean;
  shouldEnrichDraftForBooking: boolean;
  shouldRunBookingFlow: boolean;
  bookingMessageNorm: string;
  locationChosenThisTurn: boolean;
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
