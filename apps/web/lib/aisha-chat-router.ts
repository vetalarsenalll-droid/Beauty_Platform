import { AishaIntent, routeForIntent } from "@/lib/dialog-policy";
import { resolveRouteByContract } from "@/lib/aisha-route-contract";

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
  const forceBooking =
    args.forceBookingByContext ||
    args.forceBookingOnPromptedLocationChoice ||
    args.forceBookingOnServiceSelection ||
    args.forceBookingAwaitingService ||
    args.forceBookingOnSpecialistQueryInDraft ||
    args.forceBookingOnDateOnlyInDraft;

  return resolveRouteByContract(
    {
      intent: args.intent,
      explicitDateTimeQuery: args.explicitDateTimeQuery,
      forceChatOnlyConversational: args.forceChatOnlyConversational,
      forceChatOnlyInfoIntent: args.forceChatOnlyInfoIntent,
      forceClientActions: args.forceClientActions,
      forceBooking,
    },
    (intent) => routeForIntent(intent) as PublicAiRoute,
  );
}
