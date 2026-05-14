import type { ChatUi } from "@/lib/booking-flow";
import type { LocationLite, ServiceLite } from "@/lib/booking-tools";
import {
  asksCurrentDateTime,
  buildChatOnlyActionUi,
  dedupeQuickReplyOptions,
  isBookingDeclineMessage,
  isGeneralQuestionOutsideBooking,
  isOutOfDomainPrompt,
} from "@/lib/aisha-routing-helpers";

export function applyCtaPolicy(args: {
  reply: string;
  nextUi: ChatUi | null;
  route: string;
  intent: string;
  messageNorm: string;
  explicitOutOfScopeCue: boolean;
  shouldRunBookingFlow: boolean;
  shouldHardReturnToDomain: boolean;
  shouldSoftReturnToBooking: boolean;
  consecutiveNonBookingTurns: number;
  consecutiveToxicTurns: number;
  explicitDateTimeQuery: boolean;
  explicitServiceComplaint: boolean;
  isServiceListUi: (ui: ChatUi | null) => boolean;
  locations: LocationLite[];
  services: ServiceLite[];
  bridgeFocusDate: string | null;
}): { reply: string; nextUi: ChatUi | null } {
  const {
    reply,
    route,
    intent,
    messageNorm,
    explicitOutOfScopeCue,
    shouldRunBookingFlow,
    shouldHardReturnToDomain,
    shouldSoftReturnToBooking,
    consecutiveNonBookingTurns,
    consecutiveToxicTurns,
    explicitDateTimeQuery,
    explicitServiceComplaint,
    isServiceListUi,
    locations,
    services,
    bridgeFocusDate,
  } = args;
  let { nextUi } = args;

  const hasSpecializedUi =
    nextUi?.kind === "date_picker" ||
    nextUi?.kind === "consent" ||
    nextUi?.kind === "complaint_form" ||
    isServiceListUi(nextUi);
  const isMetaIntent =
    intent === "identity" ||
    intent === "capabilities" ||
    asksCurrentDateTime(messageNorm);
  const isSensitiveOutOfScope =
    intent === "out_of_scope" ||
    explicitOutOfScopeCue ||
    isOutOfDomainPrompt(messageNorm) ||
    isGeneralQuestionOutsideBooking(messageNorm);
  const ctaBlocked =
    explicitServiceComplaint ||
    explicitDateTimeQuery ||
    isBookingDeclineMessage(messageNorm) ||
    intent === "abuse_or_toxic" ||
    isMetaIntent ||
    isSensitiveOutOfScope;

  if (ctaBlocked && nextUi?.kind === "quick_replies" && !hasSpecializedUi) {
    nextUi = null;
  }

  if (route === "chat-only") {
    const shouldShowChatCta =
      shouldHardReturnToDomain ||
      (shouldSoftReturnToBooking && consecutiveNonBookingTurns >= 1) ||
      (intent === "abuse_or_toxic" && consecutiveToxicTurns >= 2);
    if (!nextUi && shouldShowChatCta && !ctaBlocked) {
      nextUi = buildChatOnlyActionUi({ locations, services, focusDate: bridgeFocusDate });
    }
    if (nextUi?.kind === "quick_replies") {
      nextUi = { kind: "quick_replies", options: dedupeQuickReplyOptions(nextUi.options) };
    }
  }

  if (
    route === "chat-only" &&
    !shouldRunBookingFlow &&
    !ctaBlocked &&
    !hasSpecializedUi
  ) {
    if (!nextUi) {
      nextUi = buildChatOnlyActionUi({ locations, services, focusDate: bridgeFocusDate });
    }
  }

  if (nextUi?.kind === "quick_replies") {
    nextUi = { kind: "quick_replies", options: dedupeQuickReplyOptions(nextUi.options) };
  }

  return { reply, nextUi };
}
