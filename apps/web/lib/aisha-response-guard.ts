import type { ChatUi } from "@/lib/booking-flow";
import type { DraftLike, LocationLite, ServiceLite, SpecialistLite } from "@/lib/booking-tools";
import {
  applyDraftConsistencyGuard,
  buildChatOnlyActionUi,
  buildOutOfScopeConversationalReply,
  hasKnownLocationNameInText,
  hasKnownServiceNameInText,
  hasUnapprovedClientNameAddressingInReply,
  hasUnknownPersonNameInReply,
  isBookingOrAccountCue,
  isGreetingText,
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

export function applyResponseGuard(args: {
  reply: string;
  nextUi: ChatUi | null;
  route: string;
  intent: string;
  messageForRouting: string;
  t: string;
  explicitDateTimeQuery: boolean;
  explicitServiceComplaint: boolean;
  explicitLocationsFollowUp: boolean;
  explicitAddressCue: boolean;
  shouldRunBookingFlow: boolean;
  hasDraftContext: boolean;
  bridgeFocusDate: string | null;
  locations: LocationLite[];
  services: ServiceLite[];
  specialists: SpecialistLite[];
  assistantName: string;
  knownClientName: string | null;
  conversationalReply: string | null;
  draft: DraftLike;
}): { reply: string; nextUi: ChatUi | null; guardReason: string | null } {
  let { reply, nextUi } = args;
  const {
    route,
    intent,
    messageForRouting,
    t,
    explicitDateTimeQuery,
    explicitServiceComplaint,
    explicitLocationsFollowUp,
    explicitAddressCue,
    shouldRunBookingFlow,
    hasDraftContext,
    bridgeFocusDate,
    locations,
    services,
    specialists,
    assistantName,
    knownClientName,
    conversationalReply,
    draft,
  } = args;

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

  if (route === "chat-only" && intent === "smalltalk" && /жду\s+(?:вашего|твоего)\s+ответа/i.test(norm(reply))) {
    reply = "Я здесь, чтобы помочь: могу рассказать про услуги, специалистов и свободное время, или просто поддержать разговор.";
  }
  if (
    route === "chat-only" &&
    /(мне\s+плохо|мне\s+грустно|грустно|тревожно|нет\s+сил|плохо\s+мне)/i.test(t) &&
    /(рада,\s*что\s+вам\s+понравилось|здорово,\s*рада|супер|отлично,\s*рада)/i.test(norm(reply))
  ) {
    reply = "Понимаю вас. Можем спокойно пообщаться, а если захотите, мягко подберу запись на удобное время.";
  }

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
    reply = "Я виртуальный ассистент записи. Помогаю с услугами, временем, специалистами и оформлением записи.";
    nextUi = buildChatOnlyActionUi({ locations, services, focusDate: bridgeFocusDate });
  }
  if (route !== "client-actions" && isGreetingText(messageForRouting) && !shouldRunBookingFlow) {
    if (hasDraftContext) {
      reply = "Здравствуйте. Продолжим запись: выберите услугу, дату или время.";
    } else {
      reply = knownClientName ? `Здравствуйте, ${knownClientName}! Чем помочь?` : "Здравствуйте! Чем помочь?";
    }
  }
  if (
    route === "chat-only" &&
    !explicitServiceComplaint &&
    hasDraftContext &&
    !shouldRunBookingFlow &&
    (intent === "out_of_scope" || intent === "smalltalk")
  ) {
    reply = "Продолжим запись: выберите услугу, дату или время.";
    if (!nextUi) nextUi = buildChatOnlyActionUi({ locations, services, focusDate: bridgeFocusDate });
  }
  if (route !== "client-actions" && !explicitDateTimeQuery && looksLikeServiceClaimInReply(reply) && !hasKnownServiceNameInText(reply, services)) {
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
    !explicitDateTimeQuery &&
    hasUnapprovedClientNameAddressingInReply({ reply, specialists, knownClientName, assistantName })
  ) {
    reply = knownClientName ? `Здравствуйте, ${knownClientName}! Чем помочь?` : "Здравствуйте! Чем помочь?";
    if (!nextUi) nextUi = buildChatOnlyActionUi({ locations, services, focusDate: bridgeFocusDate });
  }

  if (
    route === "chat-only" &&
    !explicitServiceComplaint &&
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

  return { reply, nextUi, guardReason };
}
