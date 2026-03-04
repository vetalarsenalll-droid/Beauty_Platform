import { parseDate, parseTime } from "@/lib/aisha-chat-parsers";
import {
  isBookingCarryMessage,
  isBookingChangeMessage,
  looksLikeUnknownServiceRequest,
  isConversationalHeuristicIntent,
  isLooseConfirmation,
  locationByText,
  serviceByText,
  isGreetingText,
  asksServiceExistence,
} from "@/lib/aisha-routing-helpers";
import type { AishaIntent } from "@/lib/dialog-policy";
import type { DraftDecision } from "@/lib/aisha-chat-types";
import { LEXICON } from "@/lib/aisha-lexicon";
import type { LocationLite, ServiceLite, SpecialistLite } from "@/lib/booking-tools";

const has = (m: string, r: RegExp) => r.test(m.toLowerCase());
export function computeBookingDecisions(args: {
  route: string;
  intent: AishaIntent;
  t: string;
  nowYmd: string;
  messageForRouting: string;
  explicitDateTimeQuery: boolean;
  explicitBookingDecline: boolean;
  isConsentStage: boolean;
  isConsentStageMessage: boolean;
  shouldStayInAssistantStages: boolean;
  confirmPendingClientAction: boolean;
  continuePendingCancelChoice: boolean;
  forceChatOnlyInfoIntent: boolean;
  hasDraftContext: boolean;
  selectedSpecialistByText: SpecialistLite | null;
  explicitAnySpecialistChoice: boolean;
  choiceNum: number | null;
  explicitUnknownServiceLike: boolean;
  explicitBookingText: boolean;
  explicitAlternativeSpecialistsInDraft: boolean;
  forceBookingOnPromptedLocationChoice: boolean;
  forceBookingOnServiceSelection: boolean;
  forceBookingAwaitingService: boolean;
  forceBookingOnSpecialistQueryInDraft: boolean;
  forceBookingOnDateOnlyInDraft: boolean;
  hasClientActionCue: boolean;
  forceClientActions: boolean;
  hasPositiveFeedbackCue: boolean;
  previousUserText: string;
  locations: LocationLite[];
  services: ServiceLite[];
  explicitNearestAvailability: boolean;
  explicitAvailabilityPeriod: boolean;
  explicitCalendarCue: boolean;
  d: any;
  message: string;
}): DraftDecision {
  const {
    route,
    intent,
    t,
    nowYmd,
    messageForRouting,
    explicitDateTimeQuery,
    explicitBookingDecline,
    isConsentStage,
    isConsentStageMessage,
    shouldStayInAssistantStages,
    confirmPendingClientAction,
    continuePendingCancelChoice,
    forceChatOnlyInfoIntent,
    hasDraftContext,
    selectedSpecialistByText,
    explicitAnySpecialistChoice,
    choiceNum,
    explicitUnknownServiceLike,
    explicitBookingText,
    explicitAlternativeSpecialistsInDraft,
    forceBookingOnPromptedLocationChoice,
    forceBookingOnServiceSelection,
    forceBookingAwaitingService,
    forceBookingOnSpecialistQueryInDraft,
    forceBookingOnDateOnlyInDraft,
    hasClientActionCue,
    forceClientActions,
    hasPositiveFeedbackCue,
    previousUserText,
    locations,
    services,
    explicitNearestAvailability,
    explicitAvailabilityPeriod,
    explicitCalendarCue,
    d,
    message,
  } = args;

  const looksLikeBookingContinuation =
    isBookingCarryMessage(t) ||
    isLooseConfirmation(messageForRouting) ||
    isBookingChangeMessage(t) ||
    looksLikeUnknownServiceRequest(t) ||
    Boolean(parseDate(messageForRouting, nowYmd)) ||
    Boolean(parseTime(messageForRouting)) ||
    Boolean(choiceNum) ||
    Boolean(locationByText(t, locations)) ||
    Boolean(serviceByText(t, services)) ||
    Boolean(selectedSpecialistByText) ||
    explicitAnySpecialistChoice ||
    has(messageForRouting, /(согласен|согласна|персональн|подтвержд|оформи|самостоятельно|через ассистента|время|слот|окошк|сегодня|завтра|локац|филиал)/i);

  const shouldContinueBookingByContext =
    route === "chat-only" &&
    !explicitDateTimeQuery &&
    !explicitBookingDecline &&
    (!isConsentStage || isConsentStageMessage || shouldStayInAssistantStages) &&
    !confirmPendingClientAction &&
    !continuePendingCancelChoice &&
    !forceChatOnlyInfoIntent &&
    hasDraftContext &&
    looksLikeBookingContinuation &&
    (!isConversationalHeuristicIntent(intent) ||
      isLooseConfirmation(messageForRouting) ||
      Boolean(parseTime(messageForRouting)) ||
      Boolean(parseDate(messageForRouting, nowYmd)) ||
      Boolean(choiceNum) ||
      Boolean(locationByText(t, locations)) ||
      Boolean(serviceByText(t, services)) ||
      explicitUnknownServiceLike ||
      Boolean(selectedSpecialistByText));

  const conversationalAssistantStageIntent =
    intent === "greeting" ||
    intent === "smalltalk" ||
    intent === "identity" ||
    intent === "capabilities" ||
    intent === "out_of_scope" ||
    intent === "abuse_or_toxic";

  const forceAssistantStageFlow =
    shouldStayInAssistantStages &&
    hasDraftContext &&
    !conversationalAssistantStageIntent &&
    !explicitBookingDecline &&
    !forceClientActions &&
    !explicitDateTimeQuery;

  const explicitBookingRequestCue =
    has(messageForRouting, LEXICON.BOOKING_VERB) &&
    !explicitBookingDecline &&
    !hasClientActionCue &&
    !forceClientActions &&
    !explicitDateTimeQuery;

  const explicitServiceBookingIntent =
    Boolean(serviceByText(t, services)) &&
    has(messageForRouting, /(хочу|нужн[ао]?|надо|запиш|заброни)/i) &&
    !asksServiceExistence(messageForRouting);

  const shouldEnrichDraftForBooking =
    route === "booking-flow" ||
    explicitBookingRequestCue ||
    explicitBookingText ||
    explicitAlternativeSpecialistsInDraft ||
    shouldContinueBookingByContext ||
    forceAssistantStageFlow ||
    forceBookingOnPromptedLocationChoice ||
    forceBookingOnServiceSelection ||
    forceBookingAwaitingService ||
    forceBookingOnSpecialistQueryInDraft ||
    forceBookingOnDateOnlyInDraft ||
    explicitServiceBookingIntent;

  const shouldRunBookingFlow =
    !forceChatOnlyInfoIntent &&
    (route === "booking-flow" ||
      explicitBookingRequestCue ||
      explicitBookingText ||
      explicitAlternativeSpecialistsInDraft ||
      shouldContinueBookingByContext ||
      forceAssistantStageFlow ||
      forceBookingOnPromptedLocationChoice ||
      forceBookingOnServiceSelection ||
      forceBookingAwaitingService ||
      forceBookingOnSpecialistQueryInDraft ||
      forceBookingOnDateOnlyInDraft ||
      explicitServiceBookingIntent) &&
    intent !== "post_completion_smalltalk" &&
    !isGreetingText(messageForRouting) &&
    !hasPositiveFeedbackCue;

  const hasTimePrefCue = /(утр|утром|днем|днём|после обеда|вечер|вечером)/i.test(t);
  const prevUserNorm = previousUserText.toLowerCase();
  const carryPrevTimePref =
    !hasTimePrefCue &&
    Boolean(locationByText(t, locations)) &&
    /(утр|утром|днем|днём|после обеда|вечер|вечером)/i.test(prevUserNorm)
      ? prevUserNorm
      : "";

  const bookingMessageNorm = carryPrevTimePref ? `${t} ${carryPrevTimePref}` : t;

  return {
    shouldContinueBookingByContext,
    shouldEnrichDraftForBooking,
    shouldRunBookingFlow,
    bookingMessageNorm,
    locationChosenThisTurn: false,
  };
}

