import { runAishaNaturalizeReply } from "@/lib/aisha-orchestrator";
import type { ChatUi } from "@/lib/booking-flow";
import type { LocationLite, ServiceLite, SpecialistLite } from "@/lib/booking-tools";
import {
  applyDraftConsistencyGuard,
  asksWhyNoAnswer,
  buildBookingBridgeFallback,
  buildChatOnlyActionUi,
  buildOutOfScopeConversationalReply,
  dedupeQuickReplyOptions,
  formatYmdRu,
  hasKnownLocationNameInText,
  hasKnownServiceNameInText,
  hasUnknownPersonNameInReply,
  isBookingOrAccountCue,
  isGeneralQuestionOutsideBooking,
  isGreetingText,
  isOutOfDomainPrompt,
  isPauseConversationMessage,
  keepReplyShort,
  looksLikeHardBookingPushReply,
  looksLikeLocationClaimInReply,
  looksLikeSensitiveLeakReply,
  looksLikeServiceClaimInReply,
  sanitizeAssistantReplyText,
} from "@/lib/aisha-routing-helpers";

const norm = (v: string) =>
  v
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^\p{L}\p{N}\s:.+\-/]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

export async function postProcessReply(args: {
  reply: string;
  nextUi: ChatUi | null;
  route: string;
  intent: string;
  messageForRouting: string;
  t: string;
  explicitDateTimeQuery: boolean;
  shouldRunBookingFlow: boolean;
  shouldHardReturnToDomain: boolean;
  shouldSoftReturnToBooking: boolean;
  hasDraftContext: boolean;
  consecutiveNonBookingTurns: number;
  consecutiveToxicTurns: number;
  explicitOutOfScopeCue: boolean;
  explicitLocationsFollowUp: boolean;
  explicitAddressCue: boolean;
  bridgeFocusDate: string | null;
  bridgeFocusTimePreference: "morning" | "day" | "evening" | null;
  bridgeFocusServiceName: string | null;
  locations: LocationLite[];
  services: ServiceLite[];
  specialists: SpecialistLite[];
  accountId: number;
  assistantName: string;
  accountProfile: any;
  knownClientName: string | null;
  conversationalReply: string | null;
  contextualBookingBridge: string | null;
  draft: any;
}): Promise<{ reply: string; nextUi: ChatUi | null; guardReason: string | null }> {
  let {
    reply,
    nextUi,
    route,
    intent,
    messageForRouting,
    t,
    explicitDateTimeQuery,
    shouldRunBookingFlow,
    shouldHardReturnToDomain,
    shouldSoftReturnToBooking,
    hasDraftContext,
    consecutiveNonBookingTurns,
    consecutiveToxicTurns,
    explicitOutOfScopeCue,
    explicitLocationsFollowUp,
    explicitAddressCue,
    bridgeFocusDate,
    bridgeFocusTimePreference,
    bridgeFocusServiceName,
    locations,
    services,
    specialists,
    accountId,
    assistantName,
    accountProfile,
    knownClientName,
    conversationalReply,
    contextualBookingBridge,
    draft,
  } = args;

  const canNaturalizeReply =
    route === "chat-only" &&
    !explicitDateTimeQuery &&
    (intent === "capabilities" || intent === "greeting" || intent === "smalltalk") &&
    !isPauseConversationMessage(t) &&
    !asksWhyNoAnswer(t) &&
    !isGeneralQuestionOutsideBooking(t) &&
    !nextUi &&
    !reply.includes("\n") &&
    reply.length <= 260;

  if (canNaturalizeReply) {
    const naturalized = await runAishaNaturalizeReply({
      accountId,
      assistantName,
      message: messageForRouting,
      canonicalReply: reply,
      accountProfile,
      knownClientName,
    });
    if (naturalized) reply = naturalized;
  }

  if (shouldHardReturnToDomain) {
    reply = keepReplyShort("Возвращаю разговор к полезному: помогу с записью, услугами и вашими визитами.");
    nextUi = buildChatOnlyActionUi({ locations, services, focusDate: bridgeFocusDate });
  }

  if (shouldSoftReturnToBooking && route === "chat-only" && !hasDraftContext && !isBookingOrAccountCue(t) && !shouldHardReturnToDomain) {
    const bridgeCandidate = (contextualBookingBridge ?? "").trim();
    const allowModelBridge = !explicitOutOfScopeCue && !isGeneralQuestionOutsideBooking(t) && !isOutOfDomainPrompt(t);
    const bridge =
      allowModelBridge &&
      bridgeCandidate &&
      !looksLikeHardBookingPushReply(bridgeCandidate) &&
      !/выберите\s+(филиал|услугу|дату|время)/i.test(bridgeCandidate)
        ? bridgeCandidate
        : buildBookingBridgeFallback(t, {
            serviceName: bridgeFocusServiceName,
            date: bridgeFocusDate,
            timePreference: bridgeFocusTimePreference,
          });

    if (reply && !/подбер[уё].*запис|услуг.*дат|дата.*время|перейд(ем|у)\s+к\s+записи/i.test(norm(reply))) {
      reply = reply.replace(/[.!?]+$/u, "") + ". " + bridge;
    } else if (!reply) {
      reply = bridge;
    }

    if (!nextUi && consecutiveNonBookingTurns >= 1) {
      nextUi = buildChatOnlyActionUi({ locations, services, focusDate: bridgeFocusDate });
    }
    if (bridgeFocusDate && locations.length === 1) {
      const onlyLocationName = locations[0]?.name ?? "выбранная локация";
      if (!new RegExp(onlyLocationName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(reply)) {
        reply = `${reply.replace(/[.!?]+$/u, "")}. На ${formatYmdRu(bridgeFocusDate)} доступна локация: ${onlyLocationName}.`;
      }
    }
  }


  const shouldAttachSalesBridge =
    route === "chat-only" &&
    !shouldHardReturnToDomain &&
    !hasDraftContext &&
    !explicitDateTimeQuery &&
    !isBookingOrAccountCue(t) &&
    (intent === "smalltalk" || intent === "out_of_scope") &&
    !isPauseConversationMessage(t) &&
    !asksWhyNoAnswer(t);

  if (shouldAttachSalesBridge) {
    const hasBookingBridgeAlready = /(запис|запись|подбер[уё]|услуг|врем|слот|дата|филиал|локац)/i.test(norm(reply));
    if (!hasBookingBridgeAlready) {
      const bridge = buildBookingBridgeFallback(t, {
        serviceName: bridgeFocusServiceName,
        date: bridgeFocusDate,
        timePreference: bridgeFocusTimePreference,
      });
      reply = reply ? reply.replace(/[.!?]+$/u, "") + ". " + bridge : bridge;
    }
    if (!nextUi && consecutiveNonBookingTurns >= 2) {
      nextUi = buildChatOnlyActionUi({ locations, services, focusDate: bridgeFocusDate });
    }
  }
  reply = reply.replace(/(Если захотите, помогу с записью:[^.!?]*[.!?])\s*Если захотите, помогу с записью:[^.!?]*[.!?]/iu, "$1");

  const guardResult = applyDraftConsistencyGuard({
    reply,
    ui: nextUi,
    route: route as "chat-only" | "client-actions" | "booking-flow",
    messageNorm: t,
    draft,
    services,
    locations,
  });
  reply = guardResult.reply;
  nextUi = guardResult.ui;
  const guardReason = guardResult.reason;

  reply = sanitizeAssistantReplyText(reply);

  const looksLikeLatinGibberish =
    route === "chat-only" &&
    !isBookingOrAccountCue(t) &&
    /^[a-z0-9\s.,!?-]{3,}$/i.test(messageForRouting.trim()) &&
    !/[а-яё]/i.test(messageForRouting);

  if (looksLikeLatinGibberish) {
    reply = "Похоже, сообщение получилось не совсем понятным. Могу помочь с записью: услуга, дата, время или специалист.";
    nextUi = buildChatOnlyActionUi({ locations, services, focusDate: bridgeFocusDate });
  }
  if (route === "chat-only" && looksLikeSensitiveLeakReply(reply)) {
    reply = "Я не раскрываю внутренние настройки. Могу помочь с записью, услугами и вашими визитами.";
    nextUi = buildChatOnlyActionUi({ locations, services, focusDate: bridgeFocusDate });
  }
  if (route === "chat-only" && isGreetingText(messageForRouting) && !shouldRunBookingFlow) {
    if (hasDraftContext) {
      reply = "Здравствуйте. Продолжим запись: выберите услугу, дату или время.";
    } else {
      reply = knownClientName ? `Здравствуйте, ${knownClientName}! Чем помочь?` : "Здравствуйте! Чем помочь?";
    }
  }
  if (route === "chat-only" && !explicitDateTimeQuery && looksLikeServiceClaimInReply(reply) && !hasKnownServiceNameInText(reply, services)) {
    reply = "Доступные услуги ниже. Выберите нужную кнопкой.";
    nextUi = { kind: "quick_replies", options: services.map((s) => ({ label: s.name, value: s.name })) };
  }
  if (route === "chat-only" && !explicitDateTimeQuery && (intent === "contact_address" || explicitAddressCue || explicitLocationsFollowUp) && looksLikeLocationClaimInReply(reply) && !hasKnownLocationNameInText(reply, locations)) {
    reply = "Доступные филиалы ниже. Выберите нужный кнопкой.";
    nextUi = { kind: "quick_replies", options: locations.map((x) => ({ label: x.name, value: x.name })) };
  }

  const hallucinationSensitiveIntent = intent === "smalltalk" || intent === "out_of_scope" || intent === "unknown";
  if (route === "chat-only" && !explicitDateTimeQuery && hallucinationSensitiveIntent && hasUnknownPersonNameInReply({ reply, specialists, knownClientName, assistantName })) {
    reply = conversationalReply || buildOutOfScopeConversationalReply(t);
    nextUi = buildChatOnlyActionUi({ locations, services, focusDate: bridgeFocusDate });
  }

  if (
    route === "chat-only" &&
    !isBookingOrAccountCue(t) &&
    intent !== "contact_address" &&
    intent !== "contact_phone" &&
    intent !== "working_hours" &&
    intent !== "ask_specialists" &&
    intent !== "ask_services" &&
    intent !== "ask_price" &&
    !/^если захотите, помогу с записью/i.test(norm(reply)) &&
    /^(?:выберите\s+филиал)/i.test(norm(reply))
  ) {
    const bridge = "Ниже можно сразу выбрать удобный шаг для записи.";
    const base = buildOutOfScopeConversationalReply(t);
    reply = base.replace(/[.!?]+$/u, "") + ". " + bridge;
    nextUi = buildChatOnlyActionUi({ locations, services, focusDate: bridgeFocusDate });
  }

  if (route === "chat-only") {
    const shouldShowChatCta =
      shouldHardReturnToDomain ||
      (shouldSoftReturnToBooking && consecutiveNonBookingTurns >= 1) ||
      (intent === "abuse_or_toxic" && consecutiveToxicTurns >= 2);
    if (!nextUi && shouldShowChatCta) {
      nextUi = buildChatOnlyActionUi({ locations, services, focusDate: bridgeFocusDate });
    }
    if (nextUi?.kind === "quick_replies") {
      nextUi = { kind: "quick_replies", options: dedupeQuickReplyOptions(nextUi.options) };
    }
  }

  return { reply, nextUi, guardReason };
}


