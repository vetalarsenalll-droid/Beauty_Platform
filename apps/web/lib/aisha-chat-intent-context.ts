import type { AishaIntent } from "@/lib/dialog-policy";
import { parseDate, parseTime } from "@/lib/aisha-chat-parsers";
import { parseChoiceFromText } from "@/lib/aisha-chat-thread";
import { decidePublicAiRoute, type PublicAiRoute } from "@/lib/aisha-chat-router";
import type { DraftLike, LocationLite, ServiceLite, SpecialistLite } from "@/lib/booking-tools";
import type { AishaNluIntent } from "@/lib/aisha-orchestrator";
import * as routing from "@/lib/aisha-routing-helpers";

const NLU_INTENT_CONFIDENCE_THRESHOLD = 0.38;

const norm = (v: string) =>
  v
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^\p{L}\p{N}\s:.+\-/]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

const has = (m: string, r: RegExp) => r.test(norm(m));

export function buildIntentContext(args: {
  message: string;
  t: string;
  d: DraftLike;
  nowYmd: string;
  recentMessages: Array<{ role: string; content: string }>;
  nluResult: { nlu?: any; source: string };
  locations: LocationLite[];
  services: ServiceLite[];
  specialists: SpecialistLite[];
}): {
  nlu: any;
  pendingClientAction: ReturnType<typeof routing.extractPendingClientAction>;
  confirmPendingClientAction: boolean | ReturnType<typeof routing.extractPendingClientAction>;
  continuePendingCancelChoice: boolean;
  messageForRouting: string;
  selectedLocationByMessage: LocationLite | null;
  selectedSpecialistByMessage: SpecialistLite | null;
  selectedServiceCategoryFilter: string | "__all__" | null;
  selectedSpecialistLevelFilter: string | "__all__" | null;
  explicitLocationDetailsCue: boolean;
  explicitSpecialistDetailsCue: boolean;
  hasDraftContextEarly: boolean;
  explicitClientCancelConfirm: boolean;
  explicitClientRescheduleConfirm: boolean;
  explicitDateTimeQuery: boolean;
  explicitBookingDecline: boolean;
  lastAssistantText: string;
  previousUserText: string;
  explicitCapabilitiesPhrase: boolean;
  explicitSmalltalkCue: boolean;
  explicitServicesFollowUp: boolean;
  explicitServiceListRequest: boolean;
  explicitLocationsFollowUp: boolean;
  explicitServiceFollowUp: boolean;
  serviceSelectionFromCatalog: boolean;
  heuristicIntent: AishaIntent;
  mappedNluIntent: AishaIntent;
  nluConfidence: number;
  intent: AishaIntent;
  explicitClientReschedulePhrase: boolean;
  explicitClientRescheduleRequest: boolean;
  explicitClientCancelPhrase: boolean;
  hasClientCancelContext: boolean;
  cancelMeansDraftAbort: boolean;
  explicitWhoDoesServices: boolean;
  explicitSpecialistsListCue: boolean;
  explicitSpecialistsShortCue: boolean;
  explicitServiceComplaint: boolean;
  explicitIdentityCue: boolean;
  explicitAssistantQualification: boolean;
  explicitAssistantRoleCue: boolean;
  explicitWorkplaceRoleCue: boolean;
  explicitAbuseCue: boolean;
  explicitAddressCue: boolean;
  useRegexFallback: boolean;
  explicitOutOfScopeCue: boolean;
  explicitPauseConversation: boolean;
  explicitNearestAvailability: boolean;
  explicitAvailabilityPeriod: boolean;
  explicitCalendarCue: boolean;
  explicitDateOnlyInput: boolean;
  explicitDateBookingRequest: boolean;
  explicitAvailabilityCue: boolean;
  explicitBookingTypoCue: boolean;
  explicitAlternativeSpecialistsInDraft: boolean;
  explicitCalendarAvailability: boolean;
  explicitUnknownServiceLike: boolean;
  serviceRecognizedInMessage: boolean;
  explicitServiceSpecialistQuestion: boolean;
  explicitDraftServiceQuestion: boolean;
  selectedSpecialistByText: SpecialistLite | null;
  explicitAnySpecialistChoice: boolean;
  choiceNum: number | null;
  explicitClientListFollowUp: boolean;
  explicitClientBookingDetailsCue: boolean;
  hasClientActionCue: boolean;
  hasPositiveFeedbackCue: boolean;
  specialistPromptedByAssistant: boolean;
  looksLikeSpecialistChoiceText: boolean;
  explicitBookingText: boolean;
  hasDraftContext: boolean;
  forceClientActions: boolean | ReturnType<typeof routing.extractPendingClientAction>;
  isConsentStage: boolean;
  shouldStayInAssistantStages: boolean;
  isConsentStageMessage: boolean;
  forceChatOnlyInfoIntent: boolean;
  forceBookingByContext: boolean;
  forceBookingOnPromptedLocationChoice: boolean;
  forceBookingOnSpecialistQueryInDraft: boolean;
  forceBookingOnServiceSelection: boolean;
  forceBookingAwaitingService: boolean;
  forceBookingOnDateOnlyInDraft: boolean;
  forceChatOnlyConversational: boolean;
  route: PublicAiRoute;
  routeReason: string;
  useNluIntent: boolean;
} {
  const { message, t, d, nowYmd, recentMessages, nluResult, locations, services, specialists } = args;
  const nlu = nluResult.nlu;

  const pendingClientAction = routing.extractPendingClientAction([...recentMessages].reverse());
  const confirmPendingClientAction = routing.isLooseConfirmation(message) && pendingClientAction;
  const continuePendingCancelChoice =
    pendingClientAction?.type === "cancel_choice" && has(message, /^(последн(юю|яя|ее|ая)|ближайш(ую|ая|ее)|ее|её|эту)$/i);

  const messageForRouting = confirmPendingClientAction
    ? pendingClientAction.type === "cancel"
      ? `подтверждаю отмену #${pendingClientAction.appointmentId}`
      : `подтверждаю перенос #${pendingClientAction.appointmentId} на ${pendingClientAction.date} ${pendingClientAction.hh}:${pendingClientAction.mm}`
    : continuePendingCancelChoice
      ? has(message, /ближайш/i)
        ? "отмени ближайшую запись"
        : "отмени последнюю запись"
      : message;

  const selectedLocationByMessage = routing.locationByText(t, locations);
  const selectedSpecialistByMessage = routing.specialistByText(t, specialists);
  const selectedServiceCategoryFilter = routing.parseServiceCategoryFilter(messageForRouting);
  const selectedSpecialistLevelFilter = routing.parseSpecialistLevelFilter(messageForRouting);
  const explicitLocationDetailsCue =
    Boolean(selectedLocationByMessage) &&
    has(messageForRouting, /(расскажи|подроб|что за|инфо|описан|о филиал|о локац|про|где находится|адрес)/i);
  const explicitSpecialistDetailsCue =
    Boolean(selectedSpecialistByMessage) &&
    has(messageForRouting, /(расскажи|подроб|что за|кто это|био|опыт|стаж|чем занимается|что умеет|какие услуги|что делает)/i);
  const hasDraftContextEarly = Boolean(d.locationId || d.serviceId || d.specialistId || d.date || d.time || d.mode) && d.status !== "COMPLETED";

  const explicitClientCancelConfirm = has(messageForRouting, /подтвержда[\p{L}]*\s+отмен[\p{L}]*/iu);
  const explicitClientRescheduleConfirm = has(messageForRouting, /подтвержда[\p{L}]*\s+перен[\p{L}]*/iu);
  const explicitDateTimeQuery = routing.asksCurrentDateTime(messageForRouting);
  const explicitBookingDecline = routing.isBookingDeclineMessage(norm(messageForRouting)) || has(messageForRouting, /^(не надо|не хочу)$/i);
  const lastAssistantText = recentMessages.find((m) => m.role === "assistant")?.content ?? "";
  const previousUserText = recentMessages.filter((m) => m.role === "user")[1]?.content ?? "";

  const specialistFollowUpLocation = routing.locationByText(t, locations);
  const specialistFollowUpByLocation =
    Boolean(specialistFollowUpLocation) &&
    /(специалисты по филиалам|работают специалисты|специалисты в студии)/i.test(lastAssistantText);
  if (specialistFollowUpByLocation && specialistFollowUpLocation) {
    d.locationId = specialistFollowUpLocation.id;
  }

  const explicitCapabilitiesPhrase = has(messageForRouting, /(что умеешь|чем занимаешься|что ты можешь|а что ты можешь)/i);
  const explicitSmalltalkCue = has(messageForRouting, /(как оно|чем занята|чем занят|расскажи что[-\s]?нибудь|поболтаем|давай поговорим|поговорим|что нового|как дела|как жизнь|че каво|чё каво)/i);
  const explicitServicesFollowUp = routing.asksServicesFollowUp(norm(messageForRouting), lastAssistantText, previousUserText);
  const explicitServiceListRequest = has(messageForRouting, /(?:какие\s+именно\s+есть|что\s+именно\s+есть|какие\s+услуги\s+есть|покажи\s+услуги|список\s+услуг)/i);
  const explicitLocationsFollowUp = routing.asksLocationsFollowUp(norm(messageForRouting), lastAssistantText, previousUserText);
  const explicitServiceFollowUp =
    routing.isServiceFollowUpText(norm(messageForRouting)) &&
    /(услуг|услуга|стоимость|длительность|маник|педик|стриж|гель|peeling|facial)/i.test(lastAssistantText);

  const serviceSelectionFromCatalog =
    Boolean(routing.serviceByText(norm(messageForRouting), services)) &&
    /(доступные услуги ниже|выберите нужную кнопкой|покажи услуги|выберите услугу|какую именно услугу .*записать|на какую именно услугу .*записать)/i.test(lastAssistantText);

  const heuristicIntent = routing.intentFromHeuristics(messageForRouting);
  const mappedNluIntent = routing.mapNluIntent((nlu?.intent ?? "unknown") as AishaNluIntent);
  const nluConfidence = typeof nlu?.confidence === "number" ? nlu.confidence : 0;
  let intent: AishaIntent = routing.resolveIntentModelFirst({ mappedNluIntent, nluConfidence, heuristicIntent });

  if (routing.isGreetingText(messageForRouting)) intent = "greeting";
  if ((intent as string) === "reschedule") intent = "reschedule_my_booking";
  if ((intent as string) === "cancel") intent = "cancel_my_booking";
  if ((intent as string) === "my_booking") intent = "my_bookings";

  const explicitClientReschedulePhrase = has(messageForRouting, /^(перенеси|перенести|перезапиши)\b/i);
  const explicitClientRescheduleRequest = has(messageForRouting, /(перенес(?:и|ти|ть)|перезапиш)/i) && has(messageForRouting, /(мою|свою|моя|своя|запис)/i);
  const explicitClientCancelPhrase = has(messageForRouting, /^(отмени|отменить|отмена)\b/i);
  const hasClientCancelContext = has(messageForRouting, /(мою запись|мои записи|запись #|номер записи|ближайш|последн|визит|подтверждаю отмену)/i);
  const cancelMeansDraftAbort = hasDraftContextEarly && explicitClientCancelPhrase && !hasClientCancelContext;

  const explicitWhoDoesServices = routing.asksWhoPerformsServices(norm(messageForRouting));
  const explicitSpecialistsListCue = /(?:мастер|мастера|масетера|масетер|масетр|спец|специал|специалист|специалич|спицал)(?:а|ы|ов|ты)?/iu.test(messageForRouting);
  const explicitSpecialistsShortCue = routing.asksSpecialistsByShortText(t);
  const specialistNameFollowUpFromContext =
    /(?:мастер|специалист|топ[-\s]?мастер)/iu.test(lastAssistantText) &&
    /^(?:а\s+)?[\p{L}-]{2,}\s+[\p{L}-]{2,}\??$/iu.test(messageForRouting.trim());
  const explicitServiceComplaint = routing.isServiceComplaintMessage(norm(messageForRouting));
  const explicitIdentityCue = has(messageForRouting, /(кто ты|как тебя зовут|твое имя|твоё имя)/i);
  const explicitAssistantQualification = routing.asksAssistantQualification(norm(messageForRouting));
  const explicitAssistantRoleCue = has(messageForRouting, /(кем ты работаешь|кем работаешь|какая у тебя роль|какая должность|ты администратор|ты менеджер|ты ассистент)/i);
  const explicitWorkplaceRoleCue = has(messageForRouting, /(где работаешь|где ты работаешь|в каком салоне работаешь|кем ты работаешь|кем работаешь)/i);
  const explicitAbuseCue = has(messageForRouting, /(сучк|сука|туп|идиот|дебил|нахер|нахуй|говно|херня)/i);
  const explicitAddressCue = has(messageForRouting, /(где находится|где находитесь|где ваш салон|адрес|как добраться|в каком салоне|филиал|локац)/i);
  const useRegexFallback = nluResult.source === "fallback" || nluConfidence < NLU_INTENT_CONFIDENCE_THRESHOLD;
  const explicitOutOfScopeCue = routing.isOutOfDomainPrompt(norm(messageForRouting));
  const explicitPauseConversation = routing.isPauseConversationMessage(norm(messageForRouting));
  const explicitNearestAvailability = routing.asksNearestAvailability(norm(messageForRouting));
  const explicitAvailabilityPeriod = routing.asksAvailabilityPeriod(norm(messageForRouting));
  const explicitCalendarCue =
    /\b(?:\d{4}-\d{2}-\d{2}|\d{1,2}[./]\d{1,2}(?:[./]\d{2,4})?)\b/u.test(messageForRouting) ||
    /(?:январ|феврал|март|апрел|мая|мае|июн|июл|август|сентябр|октябр|ноябр|декабр)/iu.test(messageForRouting);
  const explicitDateOnlyInput = /^\s*(?:\d{4}-\d{2}-\d{2}|\d{1,2}[./]\d{1,2}(?:[./]\d{2,4})?)\s*$/u.test(messageForRouting);
  const explicitBookingStartByDatePhrase =
    has(messageForRouting, /(запиш\p{L}*|записа\p{L}*|запиг\p{L}*|оформи\p{L}*|заброни\p{L}*|хочу)/iu) &&
    explicitCalendarCue;
  const explicitDateBookingRequest =
    explicitBookingStartByDatePhrase ||
    (explicitCalendarCue && has(messageForRouting, /(запиш\p{L}*|записа\p{L}*|запиг\p{L}*|оформи\p{L}*|заброни\p{L}*|хочу)/iu));
  const explicitAvailabilityCue = /(?:свобод|окошк|слот|врем|запис)/iu.test(messageForRouting);
  const explicitBookingTypoCue = routing.hasBookingVerbTypo(norm(messageForRouting));

  const explicitAlternativeSpecialistsInDraft =
    hasDraftContextEarly &&
    Boolean(d.serviceId) &&
    /(?:друг(?:ие|ой)|ещ[её]|кроме|кто\s+делает\s+эту\s+услуг|кто\s+выполняет\s+эту\s+услуг|есть\s+кто\s+делает\s+эту\s+услуг)/iu.test(messageForRouting) &&
    /(?:мастер|масет|спец|специал|кто\s+делает|кто\s+выполняет)/iu.test(messageForRouting);

  const explicitCalendarAvailability = explicitCalendarCue && explicitAvailabilityCue;
  const explicitUnknownServiceLike = Boolean(routing.extractRequestedServicePhrase(norm(messageForRouting)));
  const serviceRecognizedInMessage = Boolean(routing.serviceByText(norm(messageForRouting), services));
  const explicitServiceSpecialistQuestion = routing.asksWhoPerformsServices(norm(messageForRouting));
  const explicitDraftServiceQuestion = routing.asksDraftServiceQuestion(norm(messageForRouting));

  if (explicitClientReschedulePhrase || explicitClientRescheduleRequest) intent = "reschedule_my_booking";
  if (explicitBookingTypoCue && !explicitBookingDecline) intent = "booking_start";
  if (explicitClientCancelPhrase && !cancelMeansDraftAbort && hasClientCancelContext) intent = "cancel_my_booking";
  if (explicitClientCancelConfirm) intent = "cancel_my_booking";
  if (explicitClientRescheduleConfirm) intent = "reschedule_my_booking";
  if (heuristicIntent === "ask_specialists" && intent === "working_hours") intent = "ask_specialists";
  if (explicitServiceSpecialistQuestion) intent = "ask_specialists";
  if (specialistNameFollowUpFromContext) intent = "ask_specialists";
  if ((explicitServiceListRequest || explicitServicesFollowUp) && !explicitAvailabilityPeriod) intent = "ask_services";
  if (serviceSelectionFromCatalog && !explicitServiceComplaint) intent = "booking_start";
  if (hasDraftContextEarly && Boolean(routing.serviceByText(norm(messageForRouting), services)) && !explicitServiceComplaint) intent = "booking_set_service";

  const selectedSpecialistByText = routing.specialistByText(t, specialists);
  const explicitAnySpecialistChoice = routing.isAnySpecialistChoiceText(t);
  const choiceNum = parseChoiceFromText(t);

  const explicitClientListFollowUp =
    /^(?:все|всё|все напиши|всё напиши|все покажи|всё покажи|все записи|все прошедшие|все предстоящие|прошедшие|предстоящие|ближайшие|последние)$/iu.test(messageForRouting.trim()) &&
    /(?:запис|прошедш|предстоящ|ближайш|последн)/i.test(lastAssistantText);
  const explicitClientBookingDetailsCue = has(messageForRouting, /(покажи запись\s*#\s*\d{1,8}|запись\s*#\s*\d{1,8}|запись\s*№\s*\d{1,8}|подробн\p{L}*\s+запис\p{L}*\s*#?\s*\d{1,8})/iu);
  const hasClientActionCue =
    explicitClientListFollowUp ||
    explicitClientBookingDetailsCue ||
    has(messageForRouting, /(какая у меня|моя статист|мои записи|мои данные|покажи мои|ближайш.*запис|предстоящ.*запис|последн.*запис|прошедш.*запис|отмени мою|перенеси мою|перенести мою|перенести свою|хочу .*перенест|личн(ый|ого) кабинет)/i);
  if (explicitClientListFollowUp || explicitClientBookingDetailsCue) intent = "my_bookings";

  const hasPositiveFeedbackCue = has(messageForRouting, /(спасибо|благодар|круто|отлично|здорово|понятно|ок\b|окей|ясно|супер)/i);
  const specialistPromptedByAssistant =
    hasDraftContextEarly &&
    has(lastAssistantText, /(доступны специалисты|выберите специалиста|выберите кнопкой ниже)/i);
  const looksLikeSpecialistChoiceText = /^[\p{L}\s\-]{3,}$/u.test(messageForRouting.trim());

  const explicitBookingText =
    !explicitBookingDecline &&
    !routing.isSoftBookingMention(t) &&
    !explicitDateTimeQuery &&
    !hasClientActionCue &&
    !specialistFollowUpByLocation &&
    has(
      message,
      /(запиш\p{L}*|записа\p{L}*|запис\p{L}*|запиг\p{L}*|окошк|свобод|слот|на сегодня|на завтра|сегодня вечером|сегодня утром|сегодня днем|сегодня днём|вечером|утром|днем|днём|оформи\p{L}*|бронь|заброни\p{L}*|сам|через ассистента|локац|филиал|в центр|в ривер|riverside|beauty salon center|beauty salon riverside)/iu,
    ) ||
    serviceSelectionFromCatalog ||
    Boolean(selectedSpecialistByText) ||
    explicitAnySpecialistChoice ||
    (specialistPromptedByAssistant && looksLikeSpecialistChoiceText);

  const hasDraftContext = hasDraftContextEarly;
  const forceClientActions =
    confirmPendingClientAction ||
    explicitClientCancelConfirm ||
    explicitClientRescheduleConfirm ||
    (explicitClientCancelPhrase && !cancelMeansDraftAbort && hasClientCancelContext) ||
    explicitClientReschedulePhrase ||
    explicitClientRescheduleRequest ||
    hasClientActionCue ||
    routing.isClientActionIntent(intent);

  const isConsentStage = d.status === "WAITING_CONSENT" || d.status === "WAITING_CONFIRMATION";
  const shouldStayInAssistantStages = isConsentStage && d.mode === "ASSISTANT";
  const isConsentStageMessage = has(messageForRouting, /(согласен|согласна|персональн|подтверждаю|подтвердить|да|верно|записаться|оформи через ассистента)/i);
  const forceChatOnlyInfoIntent = intent === "contact_address" || intent === "contact_phone" || intent === "working_hours";

  const forceBookingByContext =
    hasDraftContext &&
    !explicitBookingDecline &&
    (!isConsentStage || isConsentStageMessage || shouldStayInAssistantStages) &&
    !forceClientActions &&
    !forceChatOnlyInfoIntent &&
    (explicitBookingText || explicitAlternativeSpecialistsInDraft || (routing.isBookingDomainIntent(intent) && !routing.isInfoOnlyIntent(intent)) || routing.isBookingCarryMessage(t) || routing.isBookingChangeMessage(t));

  const forceBookingOnPromptedLocationChoice =
    !explicitBookingDecline &&
    !forceClientActions &&
    !explicitDateTimeQuery &&
    !hasClientActionCue &&
    !specialistFollowUpByLocation &&
    intent !== "ask_specialists" &&
    Boolean(routing.locationByText(t, locations)) &&
    has(lastAssistantText, /(продолжу запись)/i);

  const forceBookingOnSpecialistQueryInDraft =
    hasDraftContext &&
    Boolean(d.serviceId) &&
    !explicitBookingDecline &&
    !forceClientActions &&
    !explicitDateTimeQuery &&
    !hasClientActionCue &&
    (intent === "ask_specialists" ||
      explicitAlternativeSpecialistsInDraft ||
      /(?:друг(?:ие|ой)|ещ[её]|кроме|кто\s+делает\s+эту\s+услуг|кто\s+выполняет\s+эту\s+услуг|еще\s+мастер|ещ[её]\s+мастер|другие\s+мастера|другие\s+специалисты)/iu.test(messageForRouting));

  const forceBookingOnServiceSelection =
    hasDraftContext &&
    !explicitBookingDecline &&
    !forceClientActions &&
    !explicitDateTimeQuery &&
    !hasClientActionCue &&
    !explicitServiceComplaint &&
    (Boolean(routing.serviceByText(t, services)) || explicitUnknownServiceLike) &&
    Boolean(d.locationId || routing.locationByText(t, locations));

  const forceBookingAwaitingService =
    hasDraftContext &&
    Boolean(d.locationId) &&
    !d.serviceId &&
    !explicitBookingDecline &&
    !forceClientActions &&
    !explicitDateTimeQuery &&
    !hasClientActionCue &&
    !forceChatOnlyInfoIntent &&
    !routing.isGreetingText(messageForRouting) &&
    (explicitUnknownServiceLike ||
      Boolean(routing.serviceByText(t, services)) ||
      Boolean(routing.locationByText(t, locations)) ||
      Boolean(parseTime(messageForRouting)) ||
      Boolean(parseDate(messageForRouting, nowYmd)) ||
      Boolean(choiceNum) ||
      has(messageForRouting, /(услуг|запиш|заброни|время|слот|окошк|дат[ауеы])/i) ||
      !routing.isConversationalHeuristicIntent(intent));

  const forceBookingOnDateOnlyInDraft =
    hasDraftContext &&
    explicitDateOnlyInput &&
    !explicitBookingDecline &&
    !forceClientActions &&
    !explicitDateTimeQuery;

  if (hasDraftContext && explicitAvailabilityPeriod) {
    intent = "ask_availability";
  }

  const forceChatOnlyConversational =
    !explicitDateBookingRequest &&
    !shouldStayInAssistantStages &&
    !confirmPendingClientAction &&
    !continuePendingCancelChoice &&
    (routing.asksClientOwnName(messageForRouting) ||
      routing.asksClientRecognition(messageForRouting) ||
      intent === "smalltalk" ||
      intent === "greeting" ||
      intent === "identity" ||
      intent === "capabilities" ||
      intent === "out_of_scope" ||
      intent === "abuse_or_toxic" ||
      intent === "post_completion_smalltalk");

  const { route, routeReason } = decidePublicAiRoute({
    intent,
    explicitDateTimeQuery,
    forceChatOnlyConversational,
    forceChatOnlyInfoIntent,
    forceClientActions: Boolean(forceClientActions),
    forceBookingByContext,
    forceBookingOnPromptedLocationChoice,
    forceBookingOnServiceSelection,
    forceBookingAwaitingService,
    forceBookingOnSpecialistQueryInDraft,
    forceBookingOnDateOnlyInDraft,
  });

  const useNluIntent = intent === mappedNluIntent && mappedNluIntent !== "unknown";

  return {
    nlu,
    pendingClientAction,
    confirmPendingClientAction,
    continuePendingCancelChoice,
    messageForRouting,
    selectedLocationByMessage,
    selectedSpecialistByMessage,
    selectedServiceCategoryFilter,
    selectedSpecialistLevelFilter,
    explicitLocationDetailsCue,
    explicitSpecialistDetailsCue,
    hasDraftContextEarly,
    explicitClientCancelConfirm,
    explicitClientRescheduleConfirm,
    explicitDateTimeQuery,
    explicitBookingDecline,
    lastAssistantText,
    previousUserText,
    explicitCapabilitiesPhrase,
    explicitSmalltalkCue,
    explicitServicesFollowUp,
    explicitServiceListRequest,
    explicitLocationsFollowUp,
    explicitServiceFollowUp,
    serviceSelectionFromCatalog,
    heuristicIntent,
    mappedNluIntent,
    nluConfidence,
    intent,
    explicitClientReschedulePhrase,
    explicitClientRescheduleRequest,
    explicitClientCancelPhrase,
    hasClientCancelContext,
    cancelMeansDraftAbort,
    explicitWhoDoesServices,
    explicitSpecialistsListCue,
    explicitSpecialistsShortCue,
    explicitServiceComplaint,
    explicitIdentityCue,
    explicitAssistantQualification,
    explicitAssistantRoleCue,
    explicitWorkplaceRoleCue,
    explicitAbuseCue,
    explicitAddressCue,
    useRegexFallback,
    explicitOutOfScopeCue,
    explicitPauseConversation,
    explicitNearestAvailability,
    explicitAvailabilityPeriod,
    explicitCalendarCue,
    explicitDateOnlyInput,
    explicitDateBookingRequest,
    explicitAvailabilityCue,
    explicitBookingTypoCue,
    explicitAlternativeSpecialistsInDraft,
    explicitCalendarAvailability,
    explicitUnknownServiceLike,
    serviceRecognizedInMessage,
    explicitServiceSpecialistQuestion,
    explicitDraftServiceQuestion,
    selectedSpecialistByText,
    explicitAnySpecialistChoice,
    choiceNum,
    explicitClientListFollowUp,
    explicitClientBookingDetailsCue,
    hasClientActionCue,
    hasPositiveFeedbackCue,
    specialistPromptedByAssistant,
    looksLikeSpecialistChoiceText,
    explicitBookingText,
    hasDraftContext,
    forceClientActions,
    isConsentStage,
    shouldStayInAssistantStages,
    isConsentStageMessage,
    forceChatOnlyInfoIntent,
    forceBookingByContext,
    forceBookingOnPromptedLocationChoice,
    forceBookingOnSpecialistQueryInDraft,
    forceBookingOnServiceSelection,
    forceBookingAwaitingService,
    forceBookingOnDateOnlyInDraft,
    forceChatOnlyConversational,
    route,
    routeReason,
    useNluIntent,
  };
}
