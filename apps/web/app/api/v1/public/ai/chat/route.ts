import { jsonError, jsonOk } from "@/lib/api";
import { getClientSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildPublicSlugId } from "@/lib/public-slug";
import { AishaNluIntent, runAishaBookingBridge, runAishaChatAction, runAishaNaturalizeReply, runAishaNlu, runAishaSmallTalkReply } from "@/lib/aisha-orchestrator";
import { runBookingFlow } from "@/lib/booking-flow";
import type { ChatUi } from "@/lib/booking-flow";
import { LocationLite, ServiceLite, SpecialistLite } from "@/lib/booking-tools";
import { ANTI_HALLUCINATION_RULES, AishaIntent, routeForIntent } from "@/lib/dialog-policy";
import { INTENT_ACTION_MATRIX } from "@/lib/intent-action-matrix";
import { runClientAccountFlow } from "@/lib/client-account-flow";
import { getNowInTimeZone, resolvePublicAccount } from "@/lib/public-booking";
import * as aishaRoutingHelpers from "@/lib/aisha-routing-helpers";
import { asText, asThreadId, asThreadKey, asTimeZone, asYmd, getThread, parseChoiceFromText, resolveAishaSystemPrompt, resolveClientForAccount } from "@/lib/aisha-chat-thread";
import { addDaysYmd, draftView, parseDate, parseName, parsePhone, parseTime, pickSafeNluDate } from "@/lib/aisha-chat-parsers";
import { handlePublicAiChatDelete, handlePublicAiChatGet } from "@/lib/aisha-chat-http-handlers";
import { enforceRateLimit } from "@/lib/rate-limit";

const prismaAny = prisma as any;

type Body = { message?: unknown; threadId?: unknown; threadKey?: unknown; clientTodayYmd?: unknown; clientTimeZone?: unknown };
type Action = { type: "open_booking"; bookingUrl: string } | null;
type AuthLevel = "full" | "thread_only" | "none";

const ASSISTANT_NAME = "Аиша";
const NLU_INTENT_CONFIDENCE_THRESHOLD = 0.38;
const NLU_INTENT_CONFIDENCE_CRITICAL_THRESHOLD = 0.52;

const {
  hasExplicitConsentGrant,
  tokenizeForFuzzy,
  levenshteinWithin,
  hasBookingVerbTypo,
  locationByText,
  serviceByText,
  asksCurrentDate,
  asksCurrentTime,
  asksCurrentDateTime,
  asksDraftServiceQuestion,
  asksClientOwnName,
  asksClientRecognition,
  isGreetingText,
  smalltalkVariant,
  hasAnyPhrase,
  buildSmalltalkReply,
  formatYmdRu,
  sanitizeAssistantReplyText,
  serviceQuickOption,
  specialistQuickOption,
  parseServiceCategoryFilter,
  parseSpecialistLevelFilter,
  uniqueServiceCategories,
  uniqueSpecialistLevels,
  filterServicesByCategory,
  filterSpecialistsByLevel,
  serviceCategoryTabOptions,
  specialistLevelTabOptions,
  serviceOptionsWithTabs,
  specialistOptionsWithTabs,
  hasKnownServiceNameInText,
  looksLikeServiceClaimInReply,
  extractLikelyFullNames,
  hasUnknownPersonNameInReply,
  looksLikeSensitiveLeakReply,
  isServiceInquiryMessage,
  looksLikeUnknownServiceRequest,
  asksServiceExistence,
  asksNearestAvailability,
  asksAvailabilityPeriod,
  asksGenderSuitability,
  asksGenderedServices,
  asksServicesFollowUp,
  hasKnownLocationNameInText,
  looksLikeLocationClaimInReply,
  asksLocationsFollowUp,
  mentionsServiceTopic,
  isServiceComplaintMessage,
  asksAssistantQualification,
  isOutOfDomainPrompt,
  isGeneralQuestionOutsideBooking,
  isPauseConversationMessage,
  asksWhyNoAnswer,
  looksLikeHardBookingPushReply,
  buildOutOfScopeConversationalReply,
  isGenericBookingTemplateReply,
  isBookingOrAccountCue,
  isLikelyNonBookingTurn,
  countConsecutiveNonBookingUserTurns,
  buildBookingBridgeFallback,
  buildBookingReengageUi,
  dedupeQuickReplyOptions,
  buildChatOnlyActionUi,
  applyDraftConsistencyGuard,
  keepReplyShort,
  countConsecutiveToxicUserTurns,
  buildToxicReply,
  asksSpecialistsByShortText,
  asksWhoPerformsServices,
  specialistByText,
  isAnySpecialistChoiceText,
  specialistSupportsSelection,
  isServiceFollowUpText,
  extractRequestedServicePhrase,
  isNluServiceGroundedByText,
  hasLocationCue,
  asksSalonName,
  isBookingCarryMessage,
  isSoftBookingMention,
  isBookingDeclineMessage,
  isBookingChangeMessage,
  isConversationalHeuristicIntent,
  isLooseConfirmation,
  extractPendingClientAction,
  isCriticalIntent,
  isClientActionIntent,
  isBookingDomainIntent,
  isInfoOnlyIntent,
  resolveIntentModelFirst,
  intentFromHeuristics,
  mapNluIntent,
} = aishaRoutingHelpers;


const norm = (v: string) =>
  v
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^\p{L}\p{N}\s:.+\-/]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
const has = (m: string, r: RegExp) => r.test(norm(m));



export async function GET(request: Request) {
  return handlePublicAiChatGet(request);
}

export async function DELETE(request: Request) {
  return handlePublicAiChatDelete(request);
}


export async function POST(request: Request) {
  const resolved = await resolvePublicAccount(request);
  if (resolved.response) return resolved.response;
  const limited = enforceRateLimit({
    request,
    scope: `public:ai:chat:post:${resolved.account.id}`,
    limit: 240,
    windowMs: 60 * 1000,
  });
  if (limited) return limited;

  const body = (await request.json().catch(() => null)) as Body | null;
  if (!body || typeof body !== "object") return jsonError("VALIDATION_FAILED", "Invalid JSON body", null, 400);
  const message = asText(body.message);
  if (!message) return jsonError("VALIDATION_FAILED", "Field 'message' is required", null, 400);
  const bodyThreadKey = asThreadKey(body.threadKey);

  const session = await getClientSession();
  const client = await resolveClientForAccount(session, resolved.account);
  const { thread, draft, threadKey: nextThreadKey } = await getThread({
    accountId: resolved.account.id,
    threadId: asThreadId(body.threadId),
    threadKey: bodyThreadKey,
    clientId: client?.clientId ?? null,
    userId: session?.userId ?? null,
  });

  await prisma.aiMessage.create({ data: { threadId: thread.id, role: "user", content: message } });
  const turnAction = await prisma.aiAction.create({
    data: { threadId: thread.id, actionType: "public_ai_turn", payload: { message }, status: "STARTED" },
    select: { id: true },
  });

  const failSoft = async (errorText?: string) => {
    const reply = "Сейчас не получилось ответить. Попробуйте еще раз.";
    await prisma.aiMessage.create({ data: { threadId: thread.id, role: "assistant", content: reply } });
    await prisma.aiAction.update({
      where: { id: turnAction.id },
      data: { status: "FAILED", payload: { message, error: errorText ?? "unknown_error" } },
    });
    return jsonOk({ threadId: thread.id, threadKey: nextThreadKey, reply, action: null, ui: null, draft: draftView(draft) });
  };

  try {
    const recentMessages = await prisma.aiMessage.findMany({
      where: { threadId: thread.id },
      orderBy: { id: "desc" },
      take: 12,
      select: { role: true, content: true },
    });

    const [locationsRaw, servicesRaw, specialistsRaw, requiredDocs, accountProfile, customPrompt] = await Promise.all([
      prismaAny.location.findMany({
        where: { accountId: resolved.account.id, status: "ACTIVE" },
        select: { id: true, name: true, address: true, description: true },
        orderBy: { createdAt: "asc" },
      }),
      prisma.service.findMany({
        where: { accountId: resolved.account.id, isActive: true },
        select: {
          id: true,
          name: true,
          description: true,
          category: { select: { name: true } },
          baseDurationMin: true,
          basePrice: true,
          levelConfigs: { select: { levelId: true, durationMin: true, price: true } },
          specialists: { select: { specialistId: true, durationOverrideMin: true, priceOverride: true } },
          locations: { select: { locationId: true } },
        },
        orderBy: { createdAt: "asc" },
      }),
      prisma.specialistProfile.findMany({
        where: { accountId: resolved.account.id },
        select: {
          id: true,
          levelId: true,
          bio: true,
          level: { select: { name: true } },
          user: { select: { email: true, profile: { select: { firstName: true, lastName: true } } } },
          locations: { select: { locationId: true } },
          services: { select: { serviceId: true } },
        },
        orderBy: { createdAt: "asc" },
      }),
      prisma.legalDocument.findMany({
        where: { accountId: resolved.account.id },
        select: {
          isRequired: true,
          versions: { where: { isActive: true }, orderBy: { version: "desc" }, take: 1, select: { id: true } },
        },
      }),
      prisma.accountProfile.findUnique({ where: { accountId: resolved.account.id }, select: { description: true, address: true, phone: true } }),
      resolveAishaSystemPrompt(resolved.account.id),
    ]);

    const locations: LocationLite[] = locationsRaw;
    const services: ServiceLite[] = servicesRaw.map((s) => ({
      id: s.id,
      name: s.name,
      baseDurationMin: s.baseDurationMin,
      description: s.description ?? null,
      categoryName: s.category?.name ?? null,
      basePrice: Number(s.basePrice),
      levelConfigs: s.levelConfigs.map((x) => ({
        levelId: x.levelId,
        durationMin: x.durationMin ?? null,
        price: x.price == null ? null : Number(x.price),
      })),
      specialistConfigs: s.specialists.map((x) => ({
        specialistId: x.specialistId,
        durationOverrideMin: x.durationOverrideMin ?? null,
        priceOverride: x.priceOverride == null ? null : Number(x.priceOverride),
      })),
      locationIds: s.locations.map((x) => x.locationId),
    }));
    const specialists: SpecialistLite[] = specialistsRaw.map((s) => {
      const fullName = [s.user.profile?.firstName, s.user.profile?.lastName].filter(Boolean).join(" ").trim();
      return {
        id: s.id,
        name: fullName || s.user.email || `Специалист #${s.id}`,
        levelId: s.levelId ?? null,
        levelName: s.level?.name ?? null,
        bio: s.bio ?? null,
        locationIds: s.locations.map((x) => x.locationId),
        serviceIds: s.services.map((x) => x.serviceId),
      };
    });
    const requiredVersionIds = (() => {
      const required = requiredDocs
        .filter((d) => d.isRequired)
        .map((d) => d.versions[0]?.id)
        .filter((x): x is number => Number.isInteger(x));
      if (required.length) return required;
      return requiredDocs.map((d) => d.versions[0]?.id).filter((x): x is number => Number.isInteger(x));
    })();

    const serverNowYmd = getNowInTimeZone(resolved.account.timeZone).ymd;
    const clientTodayYmd = asYmd(body.clientTodayYmd);
    const clientTimeZone = asTimeZone(body.clientTimeZone);
    // Prefer client local date for natural phrases like "сегодня/завтра",
    // but only when it's close to server/account date (anti-spoof sanity window).
    const nowYmd =
      clientTodayYmd &&
      clientTodayYmd >= addDaysYmd(serverNowYmd, -2) &&
      clientTodayYmd <= addDaysYmd(serverNowYmd, 2)
        ? clientTodayYmd
        : serverNowYmd;
    const nowInDialogTz = getNowInTimeZone(clientTimeZone ?? resolved.account.timeZone);
    const nowHm = `${String(Math.floor(nowInDialogTz.minutes / 60)).padStart(2, "0")}:${String(nowInDialogTz.minutes % 60).padStart(2, "0")}`;
    const d = draftView(draft);
    const t = norm(message);

    const nluResult = await runAishaNlu({
      message,
      nowYmd,
      draft: d,
      account: { id: resolved.account.id, slug: resolved.account.slug, timeZone: resolved.account.timeZone },
      clientTimeZone: clientTimeZone ?? null,
      accountProfile,
      locations,
      services,
      specialists,
      recentMessages: [...recentMessages].reverse(),
      systemPrompt: customPrompt,
    });
    const nlu = nluResult.nlu;
    const pendingClientAction = extractPendingClientAction([...recentMessages].reverse());
    const confirmPendingClientAction = isLooseConfirmation(message) && pendingClientAction;
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
    const selectedLocationByMessage = locationByText(t, locations);
    const selectedSpecialistByMessage = specialistByText(t, specialists);
    const selectedServiceCategoryFilter = parseServiceCategoryFilter(messageForRouting);
    const selectedSpecialistLevelFilter = parseSpecialistLevelFilter(messageForRouting);
    const explicitLocationDetailsCue =
      Boolean(selectedLocationByMessage) &&
      has(messageForRouting, /(расскажи|подроб|что за|инфо|описан|о филиал|о локац|про|где находится|адрес)/i);
    const explicitSpecialistDetailsCue =
      Boolean(selectedSpecialistByMessage) &&
      has(messageForRouting, /(расскажи|подроб|что за|кто это|био|опыт|стаж|чем занимается|что умеет|какие услуги|что делает)/i);
    const hasDraftContextEarly = Boolean(d.locationId || d.serviceId || d.specialistId || d.date || d.time || d.mode) && d.status !== "COMPLETED";

    const explicitClientCancelConfirm = has(messageForRouting, /подтвержда[\p{L}]*\s+отмен[\p{L}]*/iu);
    const explicitClientRescheduleConfirm = has(messageForRouting, /подтвержда[\p{L}]*\s+перен[\p{L}]*/iu);
    const explicitDateTimeQuery = asksCurrentDateTime(messageForRouting);
    let explicitBookingDecline = isBookingDeclineMessage(norm(messageForRouting)) || has(messageForRouting, /^(не надо|не хочу)$/i);
    const lastAssistantText = recentMessages.find((m) => m.role === "assistant")?.content ?? "";
    const previousUserText = recentMessages.filter((m) => m.role === "user")[1]?.content ?? "";
    const specialistFollowUpLocation = locationByText(t, locations);
    const specialistFollowUpByLocation =
      Boolean(specialistFollowUpLocation) &&
      /(специалисты по филиалам|работают специалисты|специалисты в студии)/i.test(lastAssistantText);
    if (specialistFollowUpByLocation && specialistFollowUpLocation) {
      d.locationId = specialistFollowUpLocation.id;
    }
    const explicitCapabilitiesPhrase = has(messageForRouting, /(что умеешь|чем занимаешься|что ты можешь|а что ты можешь)/i);
    const explicitSmalltalkCue = has(messageForRouting, /(как оно|чем занята|чем занят|расскажи что[-\s]?нибудь|поболтаем|давай поговорим|поговорим|что нового|как дела|как жизнь|че каво|чё каво)/i);
    const explicitServicesFollowUp = asksServicesFollowUp(norm(messageForRouting), lastAssistantText, previousUserText);
    const explicitServiceListRequest = has(messageForRouting, /(?:какие\s+именно\s+есть|что\s+именно\s+есть|какие\s+услуги\s+есть|покажи\s+услуги|список\s+услуг)/i);
    const explicitLocationsFollowUp = asksLocationsFollowUp(norm(messageForRouting), lastAssistantText, previousUserText);
    const explicitServiceFollowUp =
      isServiceFollowUpText(norm(messageForRouting)) &&
      /(услуг|услуга|стоимость|длительность|маник|педик|стриж|гель|peeling|facial)/i.test(lastAssistantText);
    const serviceSelectionFromCatalog =
      Boolean(serviceByText(norm(messageForRouting), services)) &&
      /(доступные услуги ниже|выберите нужную кнопкой|покажи услуги|выберите услугу|какую именно услугу .*записать|на какую именно услугу .*записать)/i.test(lastAssistantText);
    const heuristicIntent = intentFromHeuristics(messageForRouting);
    const mappedNluIntent = mapNluIntent((nlu?.intent ?? "unknown") as AishaNluIntent);
    const nluConfidence = typeof nlu?.confidence === "number" ? nlu.confidence : 0;
    let intent: AishaIntent = resolveIntentModelFirst({
      mappedNluIntent,
      nluConfidence,
      heuristicIntent,
    });
    if (isGreetingText(messageForRouting)) intent = "greeting";
    if ((intent as string) === "reschedule") intent = "reschedule_my_booking";
    if ((intent as string) === "cancel") intent = "cancel_my_booking";
    if ((intent as string) === "my_booking") intent = "my_bookings";
    const explicitClientReschedulePhrase = has(messageForRouting, /^(перенеси|перенести|перезапиши)\b/i);
    const explicitClientRescheduleRequest = has(messageForRouting, /(перенес(?:и|ти|ть)|перезапиш)/i) && has(messageForRouting, /(мою|свою|моя|своя|запис)/i);
    const explicitClientCancelPhrase = has(messageForRouting, /^(отмени|отменить|отмена)\b/i);
    const hasClientCancelContext = has(messageForRouting, /(мою запись|мои записи|запись #|номер записи|ближайш|последн|визит|подтверждаю отмену)/i);
    const cancelMeansDraftAbort = hasDraftContextEarly && explicitClientCancelPhrase && !hasClientCancelContext;
    const explicitWhoDoesServices = asksWhoPerformsServices(norm(messageForRouting));
    const explicitSpecialistsListCue = /(?:мастер|мастера|масетера|масетер|масетр|спец|специал|специалист|специалич|спицал)(?:а|ы|ов|ты)?/iu.test(messageForRouting);
    const explicitSpecialistsShortCue = asksSpecialistsByShortText(t);
    const explicitServiceComplaint = isServiceComplaintMessage(norm(messageForRouting));
    const explicitIdentityCue = has(messageForRouting, /(кто ты|как тебя зовут|твое имя|твоё имя)/i);
    const explicitAssistantQualification = asksAssistantQualification(norm(messageForRouting));
    const explicitAssistantRoleCue = has(messageForRouting, /(кем ты работаешь|кем работаешь|какая у тебя роль|какая должность|ты администратор|ты менеджер|ты ассистент)/i);
    const explicitWorkplaceRoleCue = has(messageForRouting, /(где работаешь|где ты работаешь|в каком салоне работаешь|кем ты работаешь|кем работаешь)/i);
    const explicitAbuseCue = has(messageForRouting, /(сучк|сука|туп|идиот|дебил|нахер|нахуй|говно|херня)/i);
    const explicitAddressCue = has(messageForRouting, /(где находится|где находитесь|где ваш салон|адрес|как добраться|в каком салоне|филиал|локац)/i);
    const useRegexFallback = nluResult.source === "fallback" || nluConfidence < NLU_INTENT_CONFIDENCE_THRESHOLD;
    const explicitOutOfScopeCue = isOutOfDomainPrompt(norm(messageForRouting));
    const explicitPauseConversation = isPauseConversationMessage(norm(messageForRouting));
    const explicitNearestAvailability = asksNearestAvailability(norm(messageForRouting));
    const explicitAvailabilityPeriod = asksAvailabilityPeriod(norm(messageForRouting));
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
    const explicitBookingTypoCue = hasBookingVerbTypo(norm(messageForRouting));
    const explicitAlternativeSpecialistsInDraft =
      hasDraftContextEarly &&
      Boolean(d.serviceId) &&
      /(?:друг(?:ие|ой)|ещ[её]|кроме|кто\s+делает\s+эту\s+услуг|кто\s+выполняет\s+эту\s+услуг|есть\s+кто\s+делает\s+эту\s+услуг)/iu.test(
        messageForRouting,
      ) &&
      /(?:мастер|масет|спец|специал|кто\s+делает|кто\s+выполняет)/iu.test(messageForRouting);
    const explicitCalendarAvailability = explicitCalendarCue && explicitAvailabilityCue;
    const explicitUnknownServiceLike = Boolean(extractRequestedServicePhrase(norm(messageForRouting)));
    const serviceRecognizedInMessage = Boolean(serviceByText(norm(messageForRouting), services));
    const explicitServiceSpecialistQuestion = asksWhoPerformsServices(norm(messageForRouting));
    const explicitDraftServiceQuestion = asksDraftServiceQuestion(norm(messageForRouting));
    if (explicitClientReschedulePhrase || explicitClientRescheduleRequest) intent = "reschedule_my_booking";
    if (explicitBookingTypoCue && !explicitBookingDecline) intent = "booking_start";
    if (explicitClientCancelPhrase && !cancelMeansDraftAbort && hasClientCancelContext) intent = "cancel_my_booking";
    if (explicitClientCancelConfirm) intent = "cancel_my_booking";
    if (explicitClientRescheduleConfirm) intent = "reschedule_my_booking";
    if (heuristicIntent === "ask_specialists" && intent === "working_hours") intent = "ask_specialists";
    if (explicitServiceSpecialistQuestion) intent = "ask_specialists";
    if ((explicitServiceListRequest || explicitServicesFollowUp) && !explicitAvailabilityPeriod) intent = "ask_services";
// If user clicked/typed a concrete service right after catalog, continue booking flow.
    if (serviceSelectionFromCatalog && !explicitServiceComplaint) {
      intent = "booking_start";
    }
    // Strong override: inside active booking context, explicit service choice must continue booking,
    // not service-info chat branch.
    if (hasDraftContextEarly && Boolean(serviceByText(norm(messageForRouting), services)) && !explicitServiceComplaint) {
      intent = "booking_set_service";
    }
    const selectedSpecialistByText = specialistByText(t, specialists);
    const explicitAnySpecialistChoice = isAnySpecialistChoiceText(t);
    const choiceNum = parseChoiceFromText(t);
    const explicitClientListFollowUp =
      /^(?:все|всё|все напиши|всё напиши|все покажи|всё покажи|все записи|все прошедшие|все предстоящие|прошедшие|предстоящие|ближайшие|последние)$/iu.test(
        messageForRouting.trim(),
      ) && /(?:запис|прошедш|предстоящ|ближайш|последн)/i.test(lastAssistantText);
    const explicitClientBookingDetailsCue = has(messageForRouting, /(покажи запись\s*#\s*\d{1,8}|запись\s*#\s*\d{1,8}|запись\s*№\s*\d{1,8}|подробн\p{L}*\s+запис\p{L}*\s*#?\s*\d{1,8})/iu);
    const hasClientActionCue = explicitClientListFollowUp || explicitClientBookingDetailsCue || has(messageForRouting, /(какая у меня|моя статист|мои записи|мои данные|покажи мои|ближайш.*запис|предстоящ.*запис|последн.*запис|прошедш.*запис|отмени мою|перенеси мою|перенести мою|перенести свою|хочу .*перенест|личн(ый|ого) кабинет)/i);
    if (explicitClientListFollowUp || explicitClientBookingDetailsCue) intent = "my_bookings";
    const hasPositiveFeedbackCue = has(messageForRouting, /(спасибо|благодар|круто|отлично|здорово|понятно|ок\b|окей|ясно|супер)/i);
    const specialistPromptedByAssistant =
      hasDraftContextEarly &&
      has(lastAssistantText, /(доступны специалисты|выберите специалиста|выберите кнопкой ниже)/i);
    const looksLikeSpecialistChoiceText = /^[\p{L}\s\-]{3,}$/u.test(messageForRouting.trim());

    const explicitBookingText =
      !explicitBookingDecline &&
      !isSoftBookingMention(t) &&
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
      explicitClientRescheduleRequest;
    const isConsentStage = d.status === "WAITING_CONSENT" || d.status === "WAITING_CONFIRMATION";
    const shouldStayInAssistantStages = isConsentStage && d.mode === "ASSISTANT";
    const isConsentStageMessage = has(
      messageForRouting,
      /(согласен|согласна|персональн|подтверждаю|подтвердить|да|верно|записаться|оформи через ассистента)/i,
    );
    const forceChatOnlyInfoIntent = intent === "contact_address" || intent === "contact_phone" || intent === "working_hours";
    const forceBookingByContext =
      hasDraftContext &&
      !explicitBookingDecline &&
      (!isConsentStage || isConsentStageMessage || shouldStayInAssistantStages) &&
      !forceClientActions &&
      !forceChatOnlyInfoIntent &&
      (explicitBookingText || explicitAlternativeSpecialistsInDraft || (isBookingDomainIntent(intent) && !isInfoOnlyIntent(intent)) || isBookingCarryMessage(t) || isBookingChangeMessage(t));
    const forceBookingOnPromptedLocationChoice =
      !explicitBookingDecline &&
      !forceClientActions &&
      !explicitDateTimeQuery &&
      !hasClientActionCue &&
      !specialistFollowUpByLocation &&
      intent !== "ask_specialists" &&
      Boolean(locationByText(t, locations)) &&
      has(lastAssistantText, /(продолжу запись)/i);
    const forceBookingOnSpecialistQueryInDraft =
      hasDraftContext &&
      Boolean(d.serviceId) &&
      !explicitBookingDecline &&
      !forceClientActions &&
      !explicitDateTimeQuery &&
      !hasClientActionCue &&
      (
        intent === "ask_specialists" ||
        explicitAlternativeSpecialistsInDraft ||
        /(?:друг(?:ие|ой)|ещ[её]|кроме|кто\s+делает\s+эту\s+услуг|кто\s+выполняет\s+эту\s+услуг|еще\s+мастер|ещ[её]\s+мастер|другие\s+мастера|другие\s+специалисты)/iu.test(messageForRouting)
      );
    const forceBookingOnServiceSelection =
      hasDraftContext &&
      !explicitBookingDecline &&
      !forceClientActions &&
      !explicitDateTimeQuery &&
      !hasClientActionCue &&
      !explicitServiceComplaint &&
      (Boolean(serviceByText(t, services)) || explicitUnknownServiceLike) &&
      Boolean(d.locationId || locationByText(t, locations));
    const forceBookingAwaitingService =
      hasDraftContext &&
      Boolean(d.locationId) &&
      !d.serviceId &&
      !explicitBookingDecline &&
      !forceClientActions &&
      !explicitDateTimeQuery &&
      !hasClientActionCue &&
      !forceChatOnlyInfoIntent &&
      !isGreetingText(messageForRouting) &&
      (
        explicitUnknownServiceLike ||
        Boolean(serviceByText(t, services)) ||
        Boolean(locationByText(t, locations)) ||
        Boolean(parseTime(messageForRouting)) ||
        Boolean(parseDate(messageForRouting, nowYmd)) ||
        Boolean(choiceNum) ||
        has(messageForRouting, /(услуг|запиш|заброни|время|слот|окошк|дат[ауеы])/i) ||
        !isConversationalHeuristicIntent(intent)
      );
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
      (asksClientOwnName(messageForRouting) ||
        asksClientRecognition(messageForRouting) ||
        intent === "smalltalk" ||
        intent === "greeting" ||
        intent === "identity" ||
        intent === "capabilities" ||
        intent === "out_of_scope" ||
        intent === "abuse_or_toxic" ||
        intent === "post_completion_smalltalk");
    let route = explicitDateTimeQuery || forceChatOnlyConversational || forceChatOnlyInfoIntent
      ? "chat-only"
      : forceClientActions
      ? "client-actions"
      : forceBookingByContext || forceBookingOnPromptedLocationChoice || forceBookingOnServiceSelection || forceBookingAwaitingService || forceBookingOnSpecialistQueryInDraft || forceBookingOnDateOnlyInDraft
      ? "booking-flow"
      : routeForIntent(intent);
    const routeReason = explicitDateTimeQuery || forceChatOnlyConversational || forceChatOnlyInfoIntent
      ? (explicitDateTimeQuery ? "chat_only_datetime" : forceChatOnlyInfoIntent ? "chat_only_info_intent" : "chat_only_conversational")
      : forceClientActions
      ? "forced_client_actions"
      : forceBookingByContext || forceBookingOnPromptedLocationChoice || forceBookingOnServiceSelection || forceBookingAwaitingService || forceBookingOnSpecialistQueryInDraft || forceBookingOnDateOnlyInDraft
      ? "forced_booking_context"
      : "policy_matrix";
    const useNluIntent = intent === mappedNluIntent && mappedNluIntent !== "unknown";

    const chatActionResult =
      route === "chat-only" &&
      !explicitDateTimeQuery &&
      !forceClientActions
        ? await runAishaChatAction({
            accountId: resolved.account.id,
            message: messageForRouting,
            assistantName: ASSISTANT_NAME,
            recentMessages: [...recentMessages].reverse(),
            accountProfile,
            locations,
            services,
            specialists: specialists.map((x) => ({ id: x.id, name: x.name, levelName: x.levelName ?? null })),
          })
        : null;

    const llmActionReply =
      chatActionResult?.source === "llm" && chatActionResult.reply && !isGenericBookingTemplateReply(chatActionResult.reply)
        ? chatActionResult.reply
        : null;

    const chatActionConflictsWithSpecialists =
      (chatActionResult?.action === "show_working_hours" ||
        chatActionResult?.action === "show_contact_address" ||
        chatActionResult?.action === "show_services") &&
      (heuristicIntent === "ask_specialists" ||
        asksWhoPerformsServices(norm(messageForRouting)) ||
        asksSpecialistsByShortText(norm(messageForRouting)) ||
        /мастер|специалист|кто\s+.*(?:делает|выполняет|оказывает)/i.test(norm(messageForRouting)));

    if (chatActionResult?.source === "llm" && chatActionResult.confidence >= 0.45 && !chatActionConflictsWithSpecialists && !explicitServiceSpecialistQuestion) {
      if (chatActionResult.action === "show_locations" || chatActionResult.action === "show_contact_address") intent = "contact_address";
      if (chatActionResult.action === "show_services") intent = "ask_services";
      if (chatActionResult.action === "show_specialists") intent = "ask_specialists";
      if (chatActionResult.action === "show_contact_phone") intent = "contact_phone";
      if (chatActionResult.action === "show_working_hours") intent = "working_hours";
      if (chatActionResult.action === "start_booking" && !explicitBookingDecline) {
        intent = "booking_start";
        route = "booking-flow";
      }
    }

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
      has(
        messageForRouting,
        /(согласен|согласна|персональн|подтвержд|оформи|самостоятельно|через ассистента|время|слот|окошк|сегодня|завтра|локац|филиал)/i,
      );
    const shouldContinueBookingByContext =
      route === "chat-only" && !explicitDateTimeQuery &&
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
    // In assistant completion stages, every follow-up must be processed by deterministic booking-flow
    // to enforce phone validation, consent, and explicit final confirmation.
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
      has(messageForRouting, /(запиш\p{L}*|записа\p{L}*|запиг\p{L}*|хочу|оформи\p{L}*|заброни\p{L}*|бронь)/iu) &&
      !explicitBookingDecline &&
      !hasClientActionCue &&
      !forceClientActions &&
      !explicitDateTimeQuery;
    const explicitServiceBookingIntent =
      Boolean(serviceByText(t, services)) &&
      has(messageForRouting, /(хочу|нужн[ао]?|надо|запиш|заброни)/i) &&
      !asksServiceExistence(messageForRouting);
    const shouldEnrichDraftForBooking =
      route === "booking-flow" || explicitBookingRequestCue || explicitBookingText || explicitAlternativeSpecialistsInDraft || shouldContinueBookingByContext || forceAssistantStageFlow || forceBookingOnPromptedLocationChoice || forceBookingOnServiceSelection || forceBookingAwaitingService || forceBookingOnSpecialistQueryInDraft || forceBookingOnDateOnlyInDraft || explicitServiceBookingIntent;
    const shouldRunBookingFlow =
      !forceChatOnlyInfoIntent &&
      (route === "booking-flow" || explicitBookingRequestCue || explicitBookingText || explicitAlternativeSpecialistsInDraft || shouldContinueBookingByContext || forceAssistantStageFlow || forceBookingOnPromptedLocationChoice || forceBookingOnServiceSelection || forceBookingAwaitingService || forceBookingOnSpecialistQueryInDraft || forceBookingOnDateOnlyInDraft || explicitServiceBookingIntent) &&
      intent !== "post_completion_smalltalk" &&
      !isGreetingText(messageForRouting) &&
      !hasPositiveFeedbackCue;
    const hasTimePrefCue = /(утр|утром|днем|днём|после обеда|вечер|вечером)/i.test(t);
    const prevUserNorm = norm(previousUserText);
    const carryPrevTimePref =
      !hasTimePrefCue &&
      Boolean(locationByText(t, locations)) &&
      /(утр|утром|днем|днём|после обеда|вечер|вечером)/i.test(prevUserNorm)
        ? prevUserNorm
        : "";
    const bookingMessageNorm = carryPrevTimePref ? `${t} ${carryPrevTimePref}` : t;
    let previouslySelectedSpecialistName: string | null = null;

    if (explicitBookingDecline) {
      d.locationId = null;
      d.serviceId = null;
      d.specialistId = null;
      d.date = null;
      d.time = null;
      d.mode = null;
      d.consentConfirmedAt = null;
      d.status = "COLLECTING";
    }

    // Fill draft opportunistically; booking-flow validates deterministically.
    const hadLocationBefore = Boolean(d.locationId);
    if (!d.locationId && shouldEnrichDraftForBooking) {
      const byName = locationByText(t, locations);
      if (byName) d.locationId = byName.id;
      else if (choiceNum && choiceNum >= 1 && choiceNum <= locations.length) d.locationId = locations[choiceNum - 1]!.id;
      else if (hasLocationCue(t) && nlu?.locationId && locations.some((x) => x.id === nlu.locationId)) d.locationId = nlu.locationId;
    }
    const locationChosenThisTurn = !hadLocationBefore && Boolean(d.locationId);
    if (
      d.specialistId &&
      !specialistSupportsSelection({
        specialistId: d.specialistId,
        serviceId: d.serviceId,
        locationId: d.locationId,
        specialists,
      })
    ) {
      d.specialistId = null;
    }
    const scopedServices = services.filter((x) => (d.locationId ? x.locationIds.includes(d.locationId) : true));
    const serviceTextMatch = serviceByText(t, scopedServices);
    const nluServiceValid = Boolean(nlu?.serviceId && scopedServices.some((x) => x.id === nlu.serviceId));
    const nluServiceObj = nlu?.serviceId ? scopedServices.find((x) => x.id === nlu.serviceId) ?? null : null;
    const requestedServicePhrase = extractRequestedServicePhrase(t);
    const nluServiceGrounded = isNluServiceGroundedByText(t, nluServiceObj);
    const unknownServiceRequested =
      shouldEnrichDraftForBooking &&
      !d.serviceId &&
      !serviceTextMatch &&
      mentionsServiceTopic(t) &&
      ((!nluServiceValid && looksLikeUnknownServiceRequest(t)) || (!!requestedServicePhrase && nluServiceValid && !nluServiceGrounded));

    if (unknownServiceRequested) {
      const requested = requestedServicePhrase ? `Услугу «${requestedServicePhrase}» не нашла.` : "Такой услуги не нашла.";
      const unknownServiceReply = `${requested} Выберите, пожалуйста, из доступных ниже.`;
      const unknownServiceUi: ChatUi = {
        kind: "quick_replies",
        options: services.map(serviceQuickOption),
      };
    await prisma.$transaction([
        prisma.aiMessage.create({ data: { threadId: thread.id, role: "assistant", content: unknownServiceReply } }),
        prismaAny.aiBookingDraft.update({
          where: { threadId: thread.id },
          data: {
            locationId: d.locationId,
            serviceId: d.serviceId,
            specialistId: d.specialistId,
            date: d.date,
            time: d.time,
            clientName: d.clientName,
            clientPhone: d.clientPhone,
            mode: d.mode,
            status: "COLLECTING",
            consentConfirmedAt: d.consentConfirmedAt ? new Date(d.consentConfirmedAt) : null,
          },
        }),
      ]);
      return jsonOk({ threadId: thread.id, threadKey: nextThreadKey, reply: unknownServiceReply, action: null, ui: unknownServiceUi, draft: d });
    }

    if (shouldEnrichDraftForBooking || (shouldRunBookingFlow && Boolean(d.locationId))) {
      const byText = serviceTextMatch;
      const serviceInquiry = isServiceInquiryMessage(message, t);
      const explicitServiceChangeRequest = has(message, /(смени|измени|другую услугу|не на|не эту услугу|выбери услугу|по услуге)/i);
      const canUseNumberForServiceSelection =
        !d.time || !d.serviceId || explicitServiceChangeRequest;
      if (!serviceInquiry && byText && byText.id !== d.serviceId) {
        d.serviceId = byText.id;
        if (
          d.specialistId &&
          !specialistSupportsSelection({
            specialistId: d.specialistId,
            serviceId: d.serviceId,
            locationId: d.locationId,
            specialists,
          })
        ) {
          d.specialistId = null;
        }
      } else if (
        canUseNumberForServiceSelection &&
        !locationChosenThisTurn &&
        choiceNum &&
        choiceNum >= 1 &&
        choiceNum <= scopedServices.length &&
        scopedServices[choiceNum - 1]!.id !== d.serviceId
      ) {
        d.serviceId = scopedServices[choiceNum - 1]!.id;
        if (
          d.specialistId &&
          !specialistSupportsSelection({
            specialistId: d.specialistId,
            serviceId: d.serviceId,
            locationId: d.locationId,
            specialists,
          })
        ) {
          d.specialistId = null;
        }
      } else if (
        nlu?.serviceId &&
        scopedServices.some((x) => x.id === nlu.serviceId) &&
        d.serviceId !== nlu.serviceId &&
        nluServiceGrounded
      ) {
        d.serviceId = nlu.serviceId;
        if (
          d.specialistId &&
          !specialistSupportsSelection({
            specialistId: d.specialistId,
            serviceId: d.serviceId,
            locationId: d.locationId,
            specialists,
          })
        ) {
          d.specialistId = null;
        }
      }
    }

    if (shouldEnrichDraftForBooking) {
      const parsedDate = parseDate(message, nowYmd);
      const parsedMonthDateFromRaw = (() => {
        const raw = messageForRouting.toLowerCase();
        const monthMatch = raw.match(
          /(?:^|\s)(?:в|на)?\s*(январе|феврале|марте|апреле|мае|июне|июле|августе|сентябре|октябре|ноябре|декабре)(?:\s|$)/u,
        );
        if (!monthMatch) return null;
        const monthMap: Record<string, string> = {
          "январе": "01",
          "феврале": "02",
          "марте": "03",
          "апреле": "04",
          "мае": "05",
          "июне": "06",
          "июле": "07",
          "августе": "08",
          "сентябре": "09",
          "октябре": "10",
          "ноябре": "11",
          "декабре": "12",
        };
        const month = monthMap[monthMatch[1] ?? ""];
        if (!month) return null;
        let year = Number(nowYmd.slice(0, 4));
        let candidate = `${year}-${month}-01`;
        if (candidate < nowYmd) {
          year += 1;
          candidate = `${year}-${month}-01`;
        }
        return candidate;
      })();
      const parsedTime = parseTime(message);
      d.date = parsedMonthDateFromRaw || parsedDate || pickSafeNluDate(nlu?.date, nowYmd) || d.date;
      // Time must come from explicit user text (or previously selected slot), not LLM guess.
      d.time = parsedTime || d.time;
      if (selectedSpecialistByText) d.specialistId = selectedSpecialistByText.id;
      const wantsSelfMode = has(message, /(сам|самостоятельно|в форме|онлайн)/i);
      const wantsAssistantMode = has(message, /(оформи|через ассистента|оформи ты|оформи ты)/i);
      if (wantsSelfMode) d.mode = "SELF";
      if (wantsAssistantMode) {
        d.mode = "ASSISTANT";
        // Always require fresh consent for assistant flow in current booking context.
        d.consentConfirmedAt = null;
      }
      if (!d.mode && d.specialistId && choiceNum === 1) d.mode = "SELF";
      if (!d.mode && d.specialistId && choiceNum === 2) {
        d.mode = "ASSISTANT";
        d.consentConfirmedAt = null;
      }
    }

    const parsedNluPhone = typeof nlu?.clientPhone === "string" ? parsePhone(nlu.clientPhone) : null;
    const parsedDraftPhone = d.clientPhone ? parsePhone(d.clientPhone) : null;
    const parsedClientPhone = client?.phone ? parsePhone(client.phone) : null;
    const parsedMessagePhone = parsePhone(message);
    d.clientPhone = parsedMessagePhone || parsedNluPhone || parsedDraftPhone || parsedClientPhone || null;

    const explicitNameCue = has(message, /(меня\s+зовут|имя\s+клиента|клиент[:\s]|мое\s+имя|моё\s+имя)/i);
    const parsedMessageName = parseName(message);
    const shouldCaptureClientName =
      d.mode === "ASSISTANT" ||
      d.status === "WAITING_CONSENT" ||
      d.status === "WAITING_CONFIRMATION" ||
      Boolean(parsedMessagePhone) ||
      explicitNameCue;
    if (shouldCaptureClientName) {
      d.clientName =
        parsedMessageName ||
        (explicitNameCue ? nlu?.clientName ?? null : null) ||
        d.clientName ||
        [client?.firstName, client?.lastName].filter(Boolean).join(" ").trim() ||
        null;
    }
    const explicitConsentText =
      d.mode === "ASSISTANT" &&
      (d.status === "WAITING_CONSENT" || d.status === "WAITING_CONFIRMATION") &&
      hasExplicitConsentGrant(message);
    if (explicitConsentText) {
      d.consentConfirmedAt = new Date().toISOString();
    }

    const origin = new URL(request.url).origin;
    const publicSlug = buildPublicSlugId(resolved.account.slug, resolved.account.id);

    let reply = `Я ${ASSISTANT_NAME}, помогу с записью. Что нужно?`;
    let nextStatus = d.status;
    let nextAction: Action = null;
    let nextUi: ChatUi | null = null;
    const shouldGenerateSmalltalk =
      route === "chat-only" &&
      !explicitDateTimeQuery &&
      !shouldRunBookingFlow &&
      !explicitServiceComplaint &&
      (intent === "smalltalk" || intent === "out_of_scope" || intent === "abuse_or_toxic" || intent === "identity" || intent === "capabilities" || (intent === "unknown" && !isBookingOrAccountCue(t)));
    const generatedSmalltalk = shouldGenerateSmalltalk
      ? await runAishaSmallTalkReply({
          accountId: resolved.account.id,
          message: messageForRouting,
          assistantName: ASSISTANT_NAME,
          recentMessages: [...recentMessages].reverse(),
          accountProfile,
          locations,
          services,
          knownClientName: d.clientName,
          specialists: specialists.map((s) => ({ id: s.id, name: s.name })),
          todayYmd: nowYmd,
          nowHm,
          accountTimeZone: resolved.account.timeZone,
          clientTimeZone: clientTimeZone ?? null,
          draftDate: d.date,
          draftTime: d.time,
        })
      : null;

    const conversationalReply = llmActionReply ?? generatedSmalltalk;

    const consecutiveNonBookingTurns = countConsecutiveNonBookingUserTurns(recentMessages);
    const consecutiveToxicTurns = countConsecutiveToxicUserTurns(recentMessages);
    const hasBookingVerbCue = has(messageForRouting, /(запиш\p{L}*|записа\p{L}*|запиг\p{L}*|хочу|сделать|оформи\p{L}*|заброни\p{L}*|бронь)/iu);
    const hasServiceTopicCue = mentionsServiceTopic(t) || Boolean(serviceByText(t, services));

    const shouldSoftReturnToBooking =
      route === "chat-only" &&
      (intent === "smalltalk" || intent === "out_of_scope") &&
      !explicitDateTimeQuery &&
      !hasDraftContext &&
      !isBookingOrAccountCue(t) &&
      !hasBookingVerbCue &&
      !hasServiceTopicCue &&
      !isGreetingText(messageForRouting) &&
      !isPauseConversationMessage(t) &&
      !asksWhyNoAnswer(t) &&
      !explicitDateBookingRequest;

    const shouldHardReturnToDomain =
      route === "chat-only" &&
      !hasDraftContext &&
      !isBookingOrAccountCue(t) &&
      consecutiveNonBookingTurns >= 4;

    const bridgeFocusServiceName =
      serviceByText(t, services)?.name ??
      (d.serviceId ? services.find((s) => s.id === d.serviceId)?.name ?? null : null);
    const bridgeFocusLocationName =
      d.locationId ? locations.find((x) => x.id === d.locationId)?.name ?? null : null;
    const bridgeFocusDate = parseDate(messageForRouting, nowYmd) || d.date || null;
    const bridgeFocusTimePreference: "morning" | "day" | "evening" | null =
      /(утр|утром)/i.test(t) ? "morning" : /(вечер|вечером)/i.test(t) ? "evening" : /(днем|днём|после обеда)/i.test(t) ? "day" : null;

    const directBookingKickoffFallback =
      !hasDraftContextEarly &&
      !explicitDateTimeQuery &&
      locations.length > 1 &&
      has(messageForRouting, /(запиш\p{L}*|записа\p{L}*|запиг\p{L}*|оформи\p{L}*|заброни\p{L}*|хочу)/iu) &&
      !has(messageForRouting, /(мои записи|мою запись|статист|профил|кабинет|отмени|перенеси)/i);
    const contextualBookingBridge = shouldSoftReturnToBooking
      ? await runAishaBookingBridge({
          accountId: resolved.account.id,
          assistantName: ASSISTANT_NAME,
          message: messageForRouting,
          baseReply: reply,
          accountProfile,
          locations,
          services,
          todayYmd: nowYmd,
          nowHm,
          accountTimeZone: resolved.account.timeZone,
          clientTimeZone: clientTimeZone ?? null,
          draftDate: d.date,
          draftTime: d.time,
        })
      : null;

    if (directBookingKickoffFallback) {
      reply = d.date
        ? `На ${formatYmdRu(d.date)} выберите филиал (локацию), и продолжу запись.` 
        : "Выберите филиал (локацию), и продолжу запись.";
      nextUi = { kind: "quick_replies", options: locations.map((x) => ({ label: x.name, value: x.name })) };
    } else if (route === "client-actions") {
      const effectiveClientId = client?.clientId ?? thread.clientId ?? null;
      const authLevel: AuthLevel = client?.clientId ? "full" : thread.clientId ? "thread_only" : "none";
      const clientFlow = await runClientAccountFlow({
        message: messageForRouting,
        messageNorm: norm(messageForRouting),
        accountId: resolved.account.id,
        accountTimeZone: resolved.account.timeZone,
        clientId: effectiveClientId,
        authMode: authLevel === "none" ? "full" : authLevel,
        origin,
        accountSlug: resolved.account.slug,
      });
      if (clientFlow.handled) {
        reply = clientFlow.reply ?? reply;
        nextUi = clientFlow.ui ?? nextUi;
      } else if (authLevel === "none") {
        const accountParam = resolved.account.slug || "";
        const loginUrl = accountParam ? `/c/login?account=${encodeURIComponent(accountParam)}` : "/c/login";
        reply = "Для персональных данных нужна активная авторизация. Нажмите кнопку ниже, чтобы войти в личный кабинет.";
        nextUi = {
          kind: "quick_replies",
          options: [{ label: "Войти в личный кабинет", value: "Открыть личный кабинет", href: loginUrl }],
        };
      } else {
        reply = "Что показать по вашим записям?";
        nextUi = {
          kind: "quick_replies",
          options: [
            { label: "Предстоящие записи", value: "предстоящие записи" },
            { label: "Прошедшие записи", value: "прошедшие записи" },
            { label: "Отменить запись", value: "отмени мою ближайшую запись" },
            { label: "Перенести запись", value: "перенеси мою запись" },
            { label: "Статистика", value: "моя статистика" },
          ],
        };
      }
    } else if (explicitDraftServiceQuestion && d.serviceId) {
      const selectedDraftService = services.find((s) => s.id === d.serviceId) ?? null;
      const selectedDraftLocation = d.locationId ? locations.find((x) => x.id === d.locationId) ?? null : null;
      if (selectedDraftService) {
        const locationSuffix = selectedDraftLocation ? ` в филиале «${selectedDraftLocation.name}»` : "";
        reply = `Сейчас записываю вас на услугу «${selectedDraftService.name}»${locationSuffix}.`;
      } else {
        reply = "Пока услуга в записи не выбрана. Могу показать доступные услуги и продолжить запись.";
      }
      nextUi = {
        kind: "quick_replies",
        options: [
          { label: "Показать услуги", value: "какие услуги есть" },
          { label: "Показать время", value: "покажи свободное время" },
        ],
      };
    } else if (shouldRunBookingFlow) {
      const hasBookingVerb = has(messageForRouting, /(запиш\p{L}*|записа\p{L}*|запиг\p{L}*|хочу|оформи\p{L}*|заброни\p{L}*|бронь)/iu);
      const hasExplicitAvailabilityQuery =
        (explicitNearestAvailability ||
          explicitAvailabilityPeriod ||
          has(message, /(окошк|свобод|время|слот|обед|после обеда|утр|вечер|днем|днём)/i)) &&
        !hasBookingVerb;
      const hasInitialBookingSkeleton =
        !d.locationId &&
        !d.serviceId &&
        !d.time &&
        !hasExplicitAvailabilityQuery &&
        (explicitBookingText || intent === "booking_start" || hasBookingVerb);
      const asksAvailabilityNow =
        !hasInitialBookingSkeleton &&
        (
          intent === "ask_availability" ||
          explicitNearestAvailability ||
          explicitAvailabilityPeriod ||
          has(message, /(окошк|свобод|время|слот|обед|после обеда|утр|вечер|днем|днём)/i) ||
          (explicitCalendarCue && Boolean(d.locationId) && !d.time) ||
          // If user just selected location while discussing windows/date, keep showing times first.
          (locationChosenThisTurn && Boolean(d.date) && !d.serviceId && !d.time)
        );
      const flowResult = await runBookingFlow({
        messageNorm: bookingMessageNorm,
        bookingIntent: shouldRunBookingFlow,
        asksAvailability: asksAvailabilityNow,
        choice: choiceNum,
        d,
        currentStatus: d.status,
        origin,
        account: { id: resolved.account.id, slug: resolved.account.slug, timeZone: resolved.account.timeZone },
        locations,
        services,
        specialists,
        previouslySelectedSpecialistName,
        requiredVersionIds,
        request,
        publicSlug,
        todayYmd: nowYmd,
        preferredClientId: client?.clientId ?? thread.clientId ?? null,
      });
      if (flowResult.handled) {
        reply = flowResult.reply ?? reply;
        nextStatus = flowResult.nextStatus ?? nextStatus;
        nextAction = flowResult.nextAction ?? nextAction;
        nextUi = flowResult.ui ?? null;
      }
    } else {
      if (explicitDateTimeQuery) {
        const nowInClientTz = getNowInTimeZone(clientTimeZone ?? resolved.account.timeZone);
        const hh = String(Math.floor(nowInClientTz.minutes / 60)).padStart(2, "0");
        const mm = String(nowInClientTz.minutes % 60).padStart(2, "0");
        reply = `Сейчас ${formatYmdRu(nowInClientTz.ymd)}, ${hh}:${mm}.`;
      } else if (asksClientOwnName(message)) {
        const knownName = d.clientName?.trim() || [client?.firstName, client?.lastName].filter(Boolean).join(" ").trim();
        reply = knownName
          ? `Да, вас зовут ${knownName}.`
          : "Пока не вижу вашего имени в профиле. Могу обращаться по имени, если напишете его.";
            } else if (asksClientRecognition(message)) {
        const knownName = d.clientName?.trim() || [client?.firstName, client?.lastName].filter(Boolean).join(" ").trim();
        reply = knownName
          ? `Да, вижу вас в профиле: ${knownName}.`
          : "Пока не вижу вас в авторизованном профиле. Могу продолжить запись как гостя или после входа в личный кабинет.";
      } else if (has(messageForRouting, /(как салон называется|как называется салон|как ваш салон называется|как называется ваш салон|название салона)/i)) {
        const accountName = resolved.account.name?.trim();
        reply = accountName ? `Наш салон называется «${accountName}».` : "Название салона сейчас недоступно.";
      } else if (intent === "greeting") {
        const knownName = d.clientName?.trim() || [client?.firstName, client?.lastName].filter(Boolean).join(" ").trim();
        reply = knownName ? `Здравствуйте, ${knownName}! Чем помочь?` : "Здравствуйте! Чем помочь?";
      } else if (intent === "identity") {
        if (explicitWorkplaceRoleCue) {
          const salonName = resolved.account.name?.trim() || "нашем салоне";
          reply = `Я ${ASSISTANT_NAME}, виртуальный ассистент записи в «${salonName}». Помогаю с выбором услуг, специалистов и оформлением записи.`;
        } else {
          reply = conversationalReply ?? `Я ${ASSISTANT_NAME}, ассистент записи. Помогу с услугами, временем, записью и вашими данными клиента.`;
        }
      } else if (intent === "capabilities") {
        reply = conversationalReply ?? "Помогаю с записью, подбором свободных окон, контактами, а также могу показать ваши записи и статистику.";
        if (!/(запис|услуг|время|специалист)/i.test(norm(reply))) reply = reply.replace(/[.!?]+$/u, "") + ". Помогу с услугами и записью.";
      } else if (intent === "out_of_scope") {
        if (conversationalReply && !isGenericBookingTemplateReply(conversationalReply)) {
          reply = conversationalReply;
        } else {
          reply = buildOutOfScopeConversationalReply(norm(messageForRouting));
        }
      } else if (intent === "abuse_or_toxic") {
        reply = conversationalReply && !looksLikeHardBookingPushReply(conversationalReply) ? conversationalReply : buildToxicReply(consecutiveToxicTurns, t);
        if (consecutiveToxicTurns >= 2) nextUi = buildChatOnlyActionUi({ locations, services, focusDate: bridgeFocusDate });
      } else if (intent === "post_completion_smalltalk") {
        reply = "Здорово, рада, что вам понравилось. Если нужно, помогу с записью.";
      } else if (intent === "smalltalk") {
        if (isGreetingText(messageForRouting)) {
          reply = "Здравствуйте! Чем помочь?";
        } else if (asksWhyNoAnswer(t) || isPauseConversationMessage(t)) {
          reply = buildSmalltalkReply(t);
        } else if (explicitServiceComplaint) {
          reply =
            "Сожалею, что так вышло. Спасибо, что написали об этом. Опишите, пожалуйста, что именно не устроило, и я передам обращение администратору и помогу подобрать корректную запись к другому мастеру.";
        } else if (conversationalReply) {
          reply = conversationalReply;
        } else if (isOutOfDomainPrompt(t)) {
          reply = buildOutOfScopeConversationalReply(t);
        } else {
          reply = buildSmalltalkReply(norm(messageForRouting));
        }
      } else if (intent === "contact_phone") {
        const phoneReply = accountProfile?.phone ? `Номер студии: ${accountProfile.phone}.` : "Сейчас номер телефона недоступен.";
        reply = locations.length ? `${phoneReply} Локации доступны кнопками ниже.` : phoneReply;
        if (locations.length) {
          nextUi = { kind: "quick_replies", options: locations.map((x) => ({ label: x.name, value: x.name })) };
        }
      } else if (intent === "contact_address") {
        const selectedLocation = selectedLocationByMessage;
        if (selectedLocation) {
          const desc = (selectedLocation.description ?? "").trim();
          const addr = selectedLocation.address ? selectedLocation.address : "адрес уточняется";
          reply = selectedLocation.name + ": " + addr + (desc ? " Описание: " + desc : "") + " Если хотите, подберу запись именно в этом филиале.";
          nextUi = {
            kind: "quick_replies",
            options: [
              { label: "Записаться в этот филиал", value: "запиши меня в " + selectedLocation.name },
              { label: "Показать специалистов", value: "какие специалисты в " + selectedLocation.name },
              { label: "Показать услуги", value: "какие услуги в " + selectedLocation.name },
            ],
          };
        } else if (locations.length) {
          reply = "Выберите филиал кнопкой ниже, и покажу адрес и детали по нему.";
          nextUi = { kind: "quick_replies", options: locations.map((x) => ({ label: x.name, value: x.name })) };
        } else {
          reply = accountProfile?.address
            ? `Адрес: ${accountProfile.address}`
            : "Адрес пока не указан. Могу помочь с записью по удобной локации.";
        }
      } else if (intent === "working_hours") {
        reply = "Обычно работаем ежедневно с 09:00 до 21:00. Если нужно, проверю точный график по конкретной локации и дате.";
      } else if (intent === "ask_specialists") {
        const dateForSpecialists = parseDate(message, nowYmd) || d.date;
        const locationFromMessage = locationByText(t, locations);
        const selectedLocationId = locationFromMessage?.id ?? d.locationId ?? null;
        const specialistFromMessage = selectedSpecialistByMessage;
        const selectedServiceForSpecialists = serviceByText(t, services) ?? (d.serviceId ? services.find((x) => x.id === d.serviceId) ?? null : null);
        if (selectedServiceForSpecialists && d.serviceId !== selectedServiceForSpecialists.id) d.serviceId = selectedServiceForSpecialists.id;

        if (specialistFromMessage && explicitSpecialistDetailsCue) {
          const specialistLocations = locations
            .filter((loc) => specialistFromMessage.locationIds.includes(loc.id))
            .map((loc) => loc.name);
          const specialistServices = services
            .filter((srv) => specialistFromMessage.serviceIds.includes(srv.id))
            .filter((srv) => !selectedServiceForSpecialists || srv.id === selectedServiceForSpecialists.id)
            .map((srv) => srv.name);
          const bio = (specialistFromMessage.bio ?? "").trim();
          const locText = specialistLocations.length ? specialistLocations.join(", ") : "локация уточняется";
          const srvText = specialistServices.length ? specialistServices.join(", ") : "услуги уточняются";
          reply = specialistFromMessage.name + ": " + (bio ? bio + " " : "") + "Работает в: " + locText + ". Выполняет услуги: " + srvText + ". Если хотите, подберу ближайшее время к этому специалисту.";
          nextUi = {
            kind: "quick_replies",
            options: [
              { label: "Записаться к этому специалисту", value: "запиши меня к " + specialistFromMessage.name },
              { label: "Показать его услуги", value: "какие услуги делает " + specialistFromMessage.name },
            ],
          };
                } else if (selectedLocationId) {
          d.locationId = selectedLocationId;
          const selectedLocation = locations.find((x) => x.id === selectedLocationId) ?? null;
          const scoped = specialists
            .filter((s) => s.locationIds.includes(selectedLocationId))
            .filter((s) => !selectedServiceForSpecialists || (s.serviceIds?.length ? s.serviceIds.includes(selectedServiceForSpecialists.id) : true));
          const scopedByLevel = filterSpecialistsByLevel(scoped, selectedSpecialistLevelFilter);
          if (scoped.length) {
            const locationDetails = selectedLocation?.address ? ` Адрес: ${selectedLocation.address}.` : "";
            const levelPrefix =
              selectedSpecialistLevelFilter && selectedSpecialistLevelFilter !== "__all__"
                ? `Уровень: ${selectedSpecialistLevelFilter}. `
                : "";
            if (scopedByLevel.length) {
              reply = `${dateForSpecialists ? `На ${formatYmdRu(dateForSpecialists)} ` : ""}в ${selectedLocation?.name ?? "выбранной локации"} доступны специалисты${selectedServiceForSpecialists ? ` по услуге «${selectedServiceForSpecialists.name}»` : ""}.${locationDetails} ${levelPrefix}Выберите специалиста кнопкой ниже.`;
              nextUi = { kind: "quick_replies", options: specialistOptionsWithTabs(scoped, scopedByLevel) };
            } else {
              reply = `${dateForSpecialists ? `На ${formatYmdRu(dateForSpecialists)} ` : ""}в ${selectedLocation?.name ?? "выбранной локации"} нет специалистов с уровнем «${selectedSpecialistLevelFilter}»${selectedServiceForSpecialists ? ` по услуге «${selectedServiceForSpecialists.name}»` : ""}. Выберите другой уровень кнопкой ниже.`;
              nextUi = { kind: "quick_replies", options: specialistLevelTabOptions(scoped) };
            }
          } else {
            reply = `${dateForSpecialists ? `На ${formatYmdRu(dateForSpecialists)} ` : ""}по этой локации не нашла специалистов${selectedServiceForSpecialists ? ` для услуги «${selectedServiceForSpecialists.name}»` : ""} в расписании.`;
          }
        } else {
          const byLocation = locations
            .map((loc) => ({
              loc,
              items: specialists
                .filter((s) => s.locationIds.includes(loc.id))
                .filter((s) => !selectedServiceForSpecialists || (s.serviceIds?.length ? s.serviceIds.includes(selectedServiceForSpecialists.id) : true)),
            }))
            .filter((x) => x.items.length > 0);
          if (byLocation.length) {
            reply = `${dateForSpecialists ? `На ${formatYmdRu(dateForSpecialists)} ` : ""}доступны специалисты по филиалам${selectedServiceForSpecialists ? ` для услуги «${selectedServiceForSpecialists.name}»` : ""}. Выберите филиал кнопкой ниже.`;
            nextUi = { kind: "quick_replies", options: byLocation.map((x) => ({ label: x.loc.name, value: x.loc.name })) };
          } else {
            reply = "Сейчас не нашла специалистов в расписании. Могу проверить по конкретной локации и дате.";
          }
        }
      } else if (asksCurrentDate(message)) {
        reply = `Сегодня ${formatYmdRu(nowYmd)}.`;
      } else if (intent === "ask_services") {
        const locationFromMessage = locationByText(t, locations);
        const selectedLocationIdForServices = locationFromMessage?.id ?? d.locationId ?? null;
        if (selectedLocationIdForServices && d.locationId !== selectedLocationIdForServices) d.locationId = selectedLocationIdForServices;
        const selectedLocationForServices = selectedLocationIdForServices
          ? locations.find((x) => x.id === selectedLocationIdForServices) ?? null
          : null;
        const servicesScopedByLocation = selectedLocationIdForServices
          ? services.filter((x) => x.locationIds.includes(selectedLocationIdForServices))
          : services;
        const servicesByCategory = filterServicesByCategory(servicesScopedByLocation, selectedServiceCategoryFilter);
        const categoryPrefix =
          selectedServiceCategoryFilter && selectedServiceCategoryFilter !== "__all__"
            ? `Категория «${selectedServiceCategoryFilter}». `
            : "";
        const locationPrefix = selectedLocationForServices ? `В филиале «${selectedLocationForServices.name}». ` : "";

        const specialistQuestionInsideServices = asksWhoPerformsServices(t) || /(мастер|специалист)/i.test(t);
        const serviceForSpecialistQuestion =
          serviceByText(t, servicesByCategory) ??
          (d.serviceId ? servicesByCategory.find((s) => s.id === d.serviceId) ?? null : null);

        if (selectedLocationIdForServices && !servicesScopedByLocation.length) {
          reply = `В филиале «${selectedLocationForServices?.name ?? "выбранной локации"}» пока нет активных услуг. Выберите другой филиал.`;
          nextUi = { kind: "quick_replies", options: locations.map((x) => ({ label: x.name, value: x.name })) };
        } else if (specialistQuestionInsideServices && serviceForSpecialistQuestion) {
          d.serviceId = serviceForSpecialistQuestion.id;
          const locationFromMessage = locationByText(t, locations);
          const selectedLocationId = locationFromMessage?.id ?? d.locationId ?? null;
          if (selectedLocationId) {
            d.locationId = selectedLocationId;
            const selectedLocation = locations.find((x) => x.id === selectedLocationId) ?? null;
            const scoped = specialists
              .filter((s) => s.locationIds.includes(selectedLocationId))
              .filter((s) => (s.serviceIds?.length ? s.serviceIds.includes(serviceForSpecialistQuestion.id) : true));
            const scopedByLevel = filterSpecialistsByLevel(scoped, selectedSpecialistLevelFilter);
            if (scoped.length) {
              const locationDetails = selectedLocation?.address ? ` Адрес: ${selectedLocation.address}.` : "";
              const levelPrefix =
                selectedSpecialistLevelFilter && selectedSpecialistLevelFilter !== "__all__"
                  ? `Уровень: ${selectedSpecialistLevelFilter}. `
                  : "";
              if (scopedByLevel.length) {
                reply = `В ${selectedLocation?.name ?? "выбранной локации"} услугу «${serviceForSpecialistQuestion.name}» выполняют специалисты.${locationDetails} ${levelPrefix}Выберите специалиста кнопкой ниже.`;
                nextUi = { kind: "quick_replies", options: specialistOptionsWithTabs(scoped, scopedByLevel) };
              } else {
                reply = `В ${selectedLocation?.name ?? "выбранной локации"} нет специалистов с уровнем «${selectedSpecialistLevelFilter}» для услуги «${serviceForSpecialistQuestion.name}». Выберите другой уровень кнопкой ниже.`;
                nextUi = { kind: "quick_replies", options: specialistLevelTabOptions(scoped) };
              }
            } else {
              reply = `В ${selectedLocation?.name ?? "выбранной локации"} нет специалистов для услуги «${serviceForSpecialistQuestion.name}». Могу проверить другой филиал или дату.`;
            }
          } else {
            const byLocation = locations
              .map((loc) => ({
                loc,
                items: specialists
                  .filter((s) => s.locationIds.includes(loc.id))
                  .filter((s) => (s.serviceIds?.length ? s.serviceIds.includes(serviceForSpecialistQuestion.id) : true)),
              }))
              .filter((x) => x.items.length > 0);
            if (byLocation.length) {
              reply = `Услугу «${serviceForSpecialistQuestion.name}» выполняют специалисты в филиалах. Выберите филиал кнопкой ниже.`;
              nextUi = { kind: "quick_replies", options: byLocation.map((x) => ({ label: x.loc.name, value: x.loc.name })) };
            } else {
              reply = `Сейчас не нашла специалистов для услуги «${serviceForSpecialistQuestion.name}». Могу проверить другую дату или услугу.`;
            }
          }
        } else if (isServiceComplaintMessage(t)) {
          reply =
            "Сожалею, что так вышло. Пожалуйста, опишите, что именно не устроило, и я передам обращение администратору. Также могу подобрать запись к другому мастеру.";
        } else if (explicitServicesFollowUp || selectedServiceCategoryFilter) {
          reply = `${locationPrefix}${categoryPrefix}Доступные услуги ниже. Выберите нужную кнопкой.`;
          nextUi = { kind: "quick_replies", options: serviceOptionsWithTabs(servicesScopedByLocation, servicesByCategory) };
        } else {
          const selectedByText = serviceByText(t, servicesByCategory);
          const maleContext = asksGenderedServices(t) || /(мужск|для мужчин|для парня)/i.test(t) || /(мужск|для мужчин|для парня)/i.test(previousUserText);
          const femaleContext = /(женск|для женщин|для девушки)/i.test(t) || /(женск|для женщин|для девушки)/i.test(previousUserText);
          const handsContext = /(для\s+рук|рук|кист|ладон|ногт)/i.test(t);
          const handsServices = servicesByCategory.filter((x) => /(маник|ногт|рук|spa)/i.test(norm(x.name)));

          if (selectedByText) {
            const n = norm(selectedByText.name);
            const description = (selectedByText.description ?? "").trim();
            if (asksGenderSuitability(t) && /(жен)/i.test(n)) {
              const maleAlt = servicesByCategory.find((x) => /(муж)/i.test(norm(x.name)))?.name;
              reply = maleAlt
                ? `«${selectedByText.name}» обычно выбирают для женщин. Для мужчин могу предложить «${maleAlt}». Если нужно, сразу подберу время.`
                : `«${selectedByText.name}» обычно выбирают для женщин. Если нужно, подберу подходящую мужскую услугу и время.`;
            } else if (asksGenderSuitability(t) && /(муж)/i.test(n)) {
              const femaleAlt = servicesByCategory.find((x) => /(жен)/i.test(norm(x.name)))?.name;
              reply = femaleAlt
                ? `«${selectedByText.name}» обычно выбирают для мужчин. Для женщин могу предложить «${femaleAlt}». Если нужно, сразу подберу время.`
                : `«${selectedByText.name}» обычно выбирают для мужчин. Если нужно, подберу подходящую женскую услугу и время.`;
            } else {
              reply = `Да, услуга «${selectedByText.name}» есть. Стоимость ${Math.round(selectedByText.basePrice)} ₽, длительность ${selectedByText.baseDurationMin} мин.${description ? ` Описание: ${description}` : ""} Если хотите, запишу вас на неё.`;
              nextUi = {
                kind: "quick_replies",
                options: [
                  { label: "Записаться на эту услугу", value: `запиши меня на ${selectedByText.name}` },
                  { label: "Показать другие услуги", value: "какие услуги есть" },
                ],
              };
            }
          } else if (handsContext) {
            const handsOptions = handsServices.length ? handsServices : servicesByCategory;
            reply = `${locationPrefix}${categoryPrefix}Для рук подойдут услуги ниже. Выберите нужную кнопкой.`;
            nextUi = { kind: "quick_replies", options: serviceOptionsWithTabs(servicesScopedByLocation, handsOptions) };
          } else if (maleContext || femaleContext) {
            const gendered = servicesByCategory.filter((x) => {
              const n = norm(x.name);
              if (maleContext && /(муж)/i.test(n)) return true;
              if (femaleContext && /(жен)/i.test(n)) return true;
              return false;
            });
            if (gendered.length) {
              reply = "Подходящие услуги ниже. Выберите кнопкой.";
              nextUi = { kind: "quick_replies", options: serviceOptionsWithTabs(servicesScopedByLocation, gendered) };
            } else {
              const suggested = servicesByCategory.filter((x) => /(стриж|маник|педик)/i.test(norm(x.name)));
              reply = `${categoryPrefix}Из доступных сейчас могу предложить варианты ниже. Выберите кнопкой.`;
              const optionsSource = suggested.length ? suggested : servicesByCategory;
              nextUi = { kind: "quick_replies", options: serviceOptionsWithTabs(servicesScopedByLocation, optionsSource) };
            }
          } else if (asksGenderSuitability(t)) {
            const genderExamplesText = servicesByCategory
              .filter((x) => /(муж|жен)/i.test(norm(x.name)))
              .slice(0, 4)
              .map((x) => `«${x.name}»`)
              .join(", ");
            reply = genderExamplesText
              ? `Есть услуги для мужчин и для женщин, например: ${genderExamplesText}. Напишите, что именно нужно, и я подберу вариант.`
              : "Есть услуги для мужчин и для женщин. Напишите, что именно нужно, и я подберу вариант.";
            const genderExamples = servicesByCategory.filter((x) => /(муж|жен)/i.test(norm(x.name)));
            if (genderExamples.length) nextUi = { kind: "quick_replies", options: serviceOptionsWithTabs(servicesScopedByLocation, genderExamples) };
          } else if (asksServiceExistence(t) || looksLikeUnknownServiceRequest(t)) {
            const requested = extractRequestedServicePhrase(t);
            reply = `${requested ? `Услугу «${requested}» не нашла.` : "Такой услуги не нашла."} ${locationPrefix}${categoryPrefix}Выберите, пожалуйста, из доступных ниже.`;
            nextUi = { kind: "quick_replies", options: serviceOptionsWithTabs(servicesScopedByLocation, servicesByCategory) };
          } else {
            reply = `${locationPrefix}${categoryPrefix}Доступные услуги ниже. Выберите нужную кнопкой.`;
            nextUi = { kind: "quick_replies", options: serviceOptionsWithTabs(servicesScopedByLocation, servicesByCategory) };
          }
        }
      } else if (intent === "ask_price") {
        const locationFromMessage = locationByText(t, locations);
        const selectedLocationIdForServices = locationFromMessage?.id ?? d.locationId ?? null;
        if (selectedLocationIdForServices && d.locationId !== selectedLocationIdForServices) d.locationId = selectedLocationIdForServices;
        const selectedLocationForServices = selectedLocationIdForServices
          ? locations.find((x) => x.id === selectedLocationIdForServices) ?? null
          : null;
        const servicesScopedByLocation = selectedLocationIdForServices
          ? services.filter((x) => x.locationIds.includes(selectedLocationIdForServices))
          : services;
        const servicesByCategory = filterServicesByCategory(servicesScopedByLocation, selectedServiceCategoryFilter);
        const selectedByText = serviceByText(t, servicesByCategory);
        if (selectedByText) {
          const description = (selectedByText.description ?? "").trim();
          reply = `Да, услуга «${selectedByText.name}» есть. Стоимость ${Math.round(selectedByText.basePrice)} ₽, длительность ${selectedByText.baseDurationMin} мин.${description ? ` Описание: ${description}` : ""} Если хотите, запишу вас на неё.`;
          nextUi = {
            kind: "quick_replies",
            options: [
              { label: "Записаться на эту услугу", value: `запиши меня на ${selectedByText.name}` },
              { label: "Показать другие услуги", value: "какие услуги есть" },
            ],
          };
                } else {
          const sample = servicesByCategory
            .slice(0, 3)
            .map((x) => x.name + " — от " + Math.round(x.basePrice) + " ₽, от " + x.baseDurationMin + " мин")
            .join("; ");
          reply = sample
            ? "Точное совпадение не нашла. По стоимости могу сориентировать так: " + sample + ". Выберите услугу кнопкой ниже."
            : "Ориентиры по стоимости в кнопках ниже. Выберите услугу.";
          nextUi = { kind: "quick_replies", options: serviceOptionsWithTabs(servicesScopedByLocation, servicesByCategory) };
        }
      } else if (mentionsServiceTopic(t)) {
        const locationFromMessage = locationByText(t, locations);
        const selectedLocationIdForServices = locationFromMessage?.id ?? d.locationId ?? null;
        if (selectedLocationIdForServices && d.locationId !== selectedLocationIdForServices) d.locationId = selectedLocationIdForServices;
        const selectedLocationForServices = selectedLocationIdForServices
          ? locations.find((x) => x.id === selectedLocationIdForServices) ?? null
          : null;
        const servicesScopedByLocation = selectedLocationIdForServices
          ? services.filter((x) => x.locationIds.includes(selectedLocationIdForServices))
          : services;
        const servicesByCategory = filterServicesByCategory(servicesScopedByLocation, selectedServiceCategoryFilter);
        const selectedByText = serviceByText(t, servicesByCategory);
        if (selectedByText) {
          const description = (selectedByText.description ?? "").trim();
          reply = `Да, услуга «${selectedByText.name}» есть. Стоимость ${Math.round(selectedByText.basePrice)} ₽, длительность ${selectedByText.baseDurationMin} мин.${description ? ` Описание: ${description}` : ""} Если хотите, запишу вас на неё.`;
          nextUi = {
            kind: "quick_replies",
            options: [
              { label: "Записаться на эту услугу", value: `запиши меня на ${selectedByText.name}` },
              { label: "Показать другие услуги", value: "какие услуги есть" },
            ],
          };
        } else {
          const requested = extractRequestedServicePhrase(t);
          reply = `${requested ? `Услугу «${requested}» не нашла.` : "Такой услуги не нашла."} Выберите, пожалуйста, из доступных ниже.`;
          nextUi = { kind: "quick_replies", options: serviceOptionsWithTabs(servicesScopedByLocation, servicesByCategory) };
        }
      } else {
        if (isOutOfDomainPrompt(t) || isGeneralQuestionOutsideBooking(t)) {
          reply = buildOutOfScopeConversationalReply(t);
        } else {
          reply = conversationalReply ?? buildOutOfScopeConversationalReply(t);
        }
      }
    }
    const canNaturalizeReply =
      route === "chat-only" && !explicitDateTimeQuery &&
      (intent === "capabilities" || intent === "greeting" || intent === "smalltalk") &&
      !isPauseConversationMessage(t) &&
      !asksWhyNoAnswer(t) &&
      !isGeneralQuestionOutsideBooking(t) &&
      !nextUi &&
      !reply.includes("\n") &&
      reply.length <= 260;
    if (canNaturalizeReply) {
      const naturalized = await runAishaNaturalizeReply({
        accountId: resolved.account.id,
        assistantName: ASSISTANT_NAME,
        message: messageForRouting,
        canonicalReply: reply,
        accountProfile,
        knownClientName: d.clientName,
      });
      if (naturalized) reply = naturalized;
    }
    if (shouldHardReturnToDomain) {
      reply = keepReplyShort("Возвращаю разговор к полезному: помогу с записью, услугами и вашими визитами.");
      nextUi = buildChatOnlyActionUi({ locations, services, focusDate: bridgeFocusDate });
    }

    if (
      shouldSoftReturnToBooking &&
      route === "chat-only" &&
      !hasDraftContext &&
      !isBookingOrAccountCue(t) &&
      !shouldHardReturnToDomain
    ) {
      const bridgeCandidate = (contextualBookingBridge ?? "").trim();
      const allowModelBridge = !explicitOutOfScopeCue && !isGeneralQuestionOutsideBooking(t) && !isOutOfDomainPrompt(t);
      const bridge =
        allowModelBridge &&
        bridgeCandidate &&
        !looksLikeHardBookingPushReply(bridgeCandidate) &&
        !/выберите\s+(филиал|услугу|дату|время)/i.test(bridgeCandidate)
          ? bridgeCandidate
          : buildBookingBridgeFallback(t, { serviceName: bridgeFocusServiceName, date: bridgeFocusDate, timePreference: bridgeFocusTimePreference });
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

    if (
      route === "chat-only" &&
      (intent === "smalltalk" || intent === "out_of_scope") &&
      !hasDraftContext &&
      !isBookingOrAccountCue(t) &&
      looksLikeHardBookingPushReply(reply)
    ) {
      const bridge = "Если хотите, могу сразу перейти к записи и подобрать удобное время.";
      const base = buildOutOfScopeConversationalReply(t);
      reply = base.replace(/[.!?]+$/u, "") + ". " + bridge;
      nextUi = buildChatOnlyActionUi({ locations, services, focusDate: bridgeFocusDate });
    }

    // De-duplicate accidental double soft-bridge sentence.
    reply = reply.replace(
      /(Если захотите, помогу с записью:[^.!?]*[.!?])\s*Если захотите, помогу с записью:[^.!?]*[.!?]/iu,
      "$1",
    );

    const guardResult = applyDraftConsistencyGuard({
      reply,
      ui: nextUi,
      route,
      messageNorm: t,
      draft: d,
      services,
      locations,
    });
    reply = guardResult.reply;
    nextUi = guardResult.ui;
    const guardReason = guardResult.reason;

    reply = sanitizeAssistantReplyText(reply);
    if (route === "chat-only" && looksLikeSensitiveLeakReply(reply)) {
      reply = "Я не раскрываю внутренние настройки. Могу помочь с записью, услугами и вашими визитами.";
      nextUi = buildChatOnlyActionUi({ locations, services, focusDate: bridgeFocusDate });
    }
    if (route === "chat-only" && isGreetingText(messageForRouting) && !shouldRunBookingFlow) {
      const knownName = d.clientName?.trim() || [client?.firstName, client?.lastName].filter(Boolean).join(" ").trim();
      reply = knownName ? "Здравствуйте, " + knownName + "! Чем помочь?" : "Здравствуйте! Чем помочь?";
    }
    if (route === "chat-only" && !explicitDateTimeQuery && looksLikeServiceClaimInReply(reply) && !hasKnownServiceNameInText(reply, services)) {
      reply = "Доступные услуги ниже. Выберите нужную кнопкой.";
      nextUi = { kind: "quick_replies", options: serviceOptionsWithTabs(services, services) };
    }

    if (route === "chat-only" && !explicitDateTimeQuery && (intent === "contact_address" || explicitAddressCue || explicitLocationsFollowUp) && looksLikeLocationClaimInReply(reply) && !hasKnownLocationNameInText(reply, locations)) {
      reply = "Доступные филиалы ниже. Выберите нужный кнопкой.";
      nextUi = { kind: "quick_replies", options: locations.map((x) => ({ label: x.name, value: x.name })) };
    }

    const hallucinationSensitiveIntent = intent === "smalltalk" || intent === "out_of_scope" || intent === "unknown";
    if (
      route === "chat-only" && !explicitDateTimeQuery &&
      hallucinationSensitiveIntent &&
      hasUnknownPersonNameInReply({
        reply,
        specialists,
        knownClientName: d.clientName || [client?.firstName, client?.lastName].filter(Boolean).join(" ").trim() || null,
        assistantName: ASSISTANT_NAME,
      })
    ) {
      reply = conversationalReply && !isGenericBookingTemplateReply(conversationalReply) ? conversationalReply : buildOutOfScopeConversationalReply(t);
      nextUi = buildChatOnlyActionUi({ locations, services, focusDate: bridgeFocusDate });
    }

    if (route === "chat-only" && !isBookingOrAccountCue(t) && intent !== "contact_address" && intent !== "contact_phone" && intent !== "working_hours" && intent !== "ask_specialists" && intent !== "ask_services" && intent !== "ask_price" && !/^если захотите, помогу с записью/i.test(norm(reply)) && /^(?:выберите\s+филиал)/i.test(norm(reply))) {
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

    await prisma.$transaction([
      prisma.aiMessage.create({ data: { threadId: thread.id, role: "assistant", content: reply } }),
      prismaAny.aiBookingDraft.update({
        where: { threadId: thread.id },
        data: {
          locationId: d.locationId,
          serviceId: d.serviceId,
          specialistId: d.specialistId,
          date: d.date,
          time: d.time,
          clientName: d.clientName,
          clientPhone: d.clientPhone,
          mode: d.mode,
          status: nextStatus,
          consentConfirmedAt: d.consentConfirmedAt ? new Date(d.consentConfirmedAt) : null,
        },
      }),
      prisma.aiAction.update({
        where: { id: turnAction.id },
        data: {
          status: "COMPLETED",
          payload: {
            message,
            reply,
            intent,
            route,
            intentConfidence: nluConfidence,
            matrix: INTENT_ACTION_MATRIX[intent],
            antiHallucinationRules: ANTI_HALLUCINATION_RULES,
            nextStatus,
            nluSource: nluResult.source,
            nluIntent: nlu?.intent ?? null,
            mappedNluIntent,
            actionType: nextAction?.type ?? null,
            uiKind: nextUi?.kind ?? null,
            confirmPendingClientAction,
            pendingClientActionType: pendingClientAction?.type ?? null,
            routeReason,
            guardReason,
            messageForRouting,
          },
        },
      }),
      prisma.aiLog.create({
        data: {
          actionId: turnAction.id,
          level: "info",
          message: "assistant_turn_metrics",
          data: {
            intent,
            route,
            intentConfidence: nluConfidence,
            usedFallback: nluResult.source === "fallback",
            usedNluIntent: useNluIntent,
            routeReason,
            guardReason,
            failedAction: false,
            actionType: nextAction?.type ?? null,
          },
        },
      }),
    ]);

    return jsonOk({ threadId: thread.id, threadKey: nextThreadKey, reply, action: nextAction, ui: nextUi, draft: d });
  } catch (e) {
    return failSoft(e instanceof Error ? e.message : "unknown_error");
  }
}






























































































