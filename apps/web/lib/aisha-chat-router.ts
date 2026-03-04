import { AishaIntent, routeForIntent } from "@/lib/dialog-policy";

export type PublicAiRoute = "chat-only" | "client-actions" | "booking-flow";

export function decidePublicAiRoute(args: {
  intent: AishaIntent;
  explicitDateTimeQuery: boolean;
  forceChatOnlyConversational: boolean;
  forceChatOnlyInfoIntent: boolean;
  forceClientActions: boolean;
  forceBookingByContext: boolean;
  forceBookingOnPromptedLocationChoice: boolean;
  forceBookingOnServiceSelection: boolean;
  forceBookingAwaitingService: boolean;
  forceBookingOnSpecialistQueryInDraft: boolean;
  forceBookingOnDateOnlyInDraft: boolean;
}): { route: PublicAiRoute; routeReason: string } {
  const {
    intent,
    explicitDateTimeQuery,
    forceChatOnlyConversational,
    forceChatOnlyInfoIntent,
    forceClientActions,
    forceBookingByContext,
    forceBookingOnPromptedLocationChoice,
    forceBookingOnServiceSelection,
    forceBookingAwaitingService,
    forceBookingOnSpecialistQueryInDraft,
    forceBookingOnDateOnlyInDraft,
  } = args;

  const forceBooking =
    forceBookingByContext ||
    forceBookingOnPromptedLocationChoice ||
    forceBookingOnServiceSelection ||
    forceBookingAwaitingService ||
    forceBookingOnSpecialistQueryInDraft ||
    forceBookingOnDateOnlyInDraft;

  if (explicitDateTimeQuery || forceChatOnlyConversational || forceChatOnlyInfoIntent) {
    return {
      route: "chat-only",
      routeReason: explicitDateTimeQuery ? "chat_only_datetime" : forceChatOnlyInfoIntent ? "chat_only_info_intent" : "chat_only_conversational",
    };
  }

  if (forceClientActions) {
    return { route: "client-actions", routeReason: "forced_client_actions" };
  }

  if (forceBooking) {
    return { route: "booking-flow", routeReason: "forced_booking_context" };
  }

  const policyRoute = routeForIntent(intent) as PublicAiRoute;
  return { route: policyRoute, routeReason: "policy_matrix" };
}
