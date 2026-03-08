import type { AishaIntent } from "@/lib/dialog-policy";
import type { PublicAiRoute } from "@/lib/aisha-chat-router";

export const ROUTE_REASON = {
  CHAT_ONLY_DATETIME: "chat_only_datetime",
  CHAT_ONLY_INFO: "chat_only_info_intent",
  CHAT_ONLY_CONVERSATIONAL: "chat_only_conversational",
  FORCED_CLIENT_ACTIONS: "forced_client_actions",
  FORCED_BOOKING_CONTEXT: "forced_booking_context",
  POLICY_MATRIX: "policy_matrix",
} as const;

export type RouteReason = (typeof ROUTE_REASON)[keyof typeof ROUTE_REASON];

export type RouteContractInput = {
  intent: AishaIntent;
  explicitDateTimeQuery: boolean;
  forceChatOnlyConversational: boolean;
  forceChatOnlyInfoIntent: boolean;
  forceClientActions: boolean;
  forceBooking: boolean;
};

export function resolveRouteByContract(args: RouteContractInput, routeForIntentFn: (intent: AishaIntent) => PublicAiRoute): { route: PublicAiRoute; routeReason: RouteReason } {
  if (args.forceClientActions) return { route: "client-actions", routeReason: ROUTE_REASON.FORCED_CLIENT_ACTIONS };

  // Keep explicit "what date/time now" in chat-only even with draft context.
  if (args.explicitDateTimeQuery) {
    return { route: "chat-only", routeReason: ROUTE_REASON.CHAT_ONLY_DATETIME };
  }

  // Booking context must win over conversational fallbacks (e.g. pure date click from date_picker).
  if (args.forceBooking) return { route: "booking-flow", routeReason: ROUTE_REASON.FORCED_BOOKING_CONTEXT };

  if (args.forceChatOnlyConversational || args.forceChatOnlyInfoIntent) {
    return {
      route: "chat-only",
      routeReason: args.forceChatOnlyInfoIntent
        ? ROUTE_REASON.CHAT_ONLY_INFO
        : ROUTE_REASON.CHAT_ONLY_CONVERSATIONAL,
    };
  }

  return { route: routeForIntentFn(args.intent), routeReason: ROUTE_REASON.POLICY_MATRIX };
}
