import { jsonError, jsonOk } from "@/lib/api";
import { getClientSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildPublicSlugId } from "@/lib/public-slug";
import { runAishaBookingBridge, runAishaChatAction, runAishaNaturalizeReply, runAishaNlu, runAishaSmallTalkReply } from "@/lib/aisha-orchestrator";
import type { ChatUi } from "@/lib/booking-flow";
import { ANTI_HALLUCINATION_RULES } from "@/lib/dialog-policy";
import { INTENT_ACTION_MATRIX } from "@/lib/intent-action-matrix";
import { getNowInTimeZone, resolvePublicAccount } from "@/lib/public-booking";
import * as aishaRoutingHelpers from "@/lib/aisha-routing-helpers";
import { asText, asThreadId, asThreadKey, asTimeZone, asYmd, getThread, resolveClientForAccount } from "@/lib/aisha-chat-thread";
import { addDaysYmd, draftView, parseDate, parseName, parsePhone, parseTime, pickSafeNluDate } from "@/lib/aisha-chat-parsers";
import { loadPublicAiChatContext } from "@/lib/aisha-chat-preload";
import { buildBasicChatInfoReply, buildDirectBookingKickoffReply, handleAskSpecialistsBranch, runBookingFlowBranch, runClientActionsBranch } from "@/lib/aisha-chat-reply-builder";
import { buildIntentContext } from "@/lib/aisha-chat-intent-context";
import { enforceRateLimit } from "@/lib/rate-limit";

const prismaAny = prisma as any;

type Body = { message?: unknown; threadId?: unknown; threadKey?: unknown; clientTodayYmd?: unknown; clientTimeZone?: unknown };
type Action = { type: "open_booking"; bookingUrl: string } | null;

const ASSISTANT_NAME = "Аиша";

const {
  hasExplicitConsentGrant,
  locationByText,
  serviceByText,
  asksCurrentDate,
  isGreetingText,
  formatYmdRu,
  sanitizeAssistantReplyText,
  serviceQuickOption,
  filterServicesByCategory,
  filterSpecialistsByLevel,
  specialistLevelTabOptions,
  serviceOptionsWithTabs,
  specialistOptionsWithTabs,
  hasKnownServiceNameInText,
  looksLikeServiceClaimInReply,
  hasUnknownPersonNameInReply,
  looksLikeSensitiveLeakReply,
  isServiceInquiryMessage,
  looksLikeUnknownServiceRequest,
  asksServiceExistence,
  asksGenderSuitability,
  asksGenderedServices,
  hasKnownLocationNameInText,
  looksLikeLocationClaimInReply,
  mentionsServiceTopic,
  isServiceComplaintMessage,
  isOutOfDomainPrompt,
  isGeneralQuestionOutsideBooking,
  isPauseConversationMessage,
  asksWhyNoAnswer,
  looksLikeHardBookingPushReply,
  buildOutOfScopeConversationalReply,
  isGenericBookingTemplateReply,
  isBookingOrAccountCue,
  countConsecutiveNonBookingUserTurns,
  buildBookingBridgeFallback,
  dedupeQuickReplyOptions,
  buildChatOnlyActionUi,
  applyDraftConsistencyGuard,
  keepReplyShort,
  countConsecutiveToxicUserTurns,
  asksSpecialistsByShortText,
  asksWhoPerformsServices,
  specialistSupportsSelection,
  extractRequestedServicePhrase,
  isNluServiceGroundedByText,
  hasLocationCue,
  isBookingCarryMessage,
  isBookingChangeMessage,
  isConversationalHeuristicIntent,
  isLooseConfirmation
} = aishaRoutingHelpers;


const norm = (v: string) =>
  v
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^\p{L}\p{N}\s:.+\-/]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
const has = (m: string, r: RegExp) => r.test(norm(m));
type PreparedPostTurn = {
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

async function preparePostTurn(request: Request): Promise<{ response: Response } | { prepared: PreparedPostTurn }> {
  const resolved = await resolvePublicAccount(request);
  if (resolved.response) return { response: resolved.response };

  const limited = enforceRateLimit({
    request,
    scope: `public:ai:chat:post:${resolved.account.id}`,
    limit: 240,
    windowMs: 60 * 1000,
  });
  if (limited) return { response: limited };

  const body = (await request.json().catch(() => null)) as Body | null;
  if (!body || typeof body !== "object") return { response: jsonError("VALIDATION_FAILED", "Invalid JSON body", null, 400) };

  const message = asText(body.message);
  if (!message) return { response: jsonError("VALIDATION_FAILED", "Field 'message' is required", null, 400) };

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

  return {
    prepared: {
      resolved,
      body,
      message,
      session,
      client,
      thread: { id: thread.id, clientId: thread.clientId ?? null },
      draft,
      nextThreadKey,
      turnAction,
    },
  };
}

function createFailSoftHandler(args: {
  threadId: number;
  nextThreadKey: string | null;
  draft: any;
  turnActionId: number;
  message: string;
}) {
  return async (errorText?: string) => {
    const reply = "Сейчас не получилось ответить. Попробуйте еще раз.";
    await prisma.aiMessage.create({ data: { threadId: args.threadId, role: "assistant", content: reply } });
    await prisma.aiAction.update({
      where: { id: args.turnActionId },
      data: { status: "FAILED", payload: { message: args.message, error: errorText ?? "unknown_error" } },
    });
    return jsonOk({ threadId: args.threadId, threadKey: args.nextThreadKey, reply, action: null, ui: null, draft: draftView(args.draft) });
  };
}

async function finalizeSuccessfulTurn(args: {
  threadId: number;
  turnActionId: number;
  message: string;
  reply: string;
  intent: string;
  route: string;
  nluConfidence: number;
  mappedNluIntent: string;
  nluSource: string;
  nluIntent: string | null;
  nextStatus: string;
  nextAction: Action;
  nextUi: ChatUi | null;
  confirmPendingClientAction: boolean;
  pendingClientActionType: string | null;
  routeReason: string | null;
  guardReason: string | null;
  useNluIntent: boolean;
  messageForRouting: string;
  d: any;
}) {
  await prisma.$transaction([
    prisma.aiMessage.create({ data: { threadId: args.threadId, role: "assistant", content: args.reply } }),
    prismaAny.aiBookingDraft.update({
      where: { threadId: args.threadId },
      data: {
        locationId: args.d.locationId,
        serviceId: args.d.serviceId,
        specialistId: args.d.specialistId,
        date: args.d.date,
        time: args.d.time,
        clientName: args.d.clientName,
        clientPhone: args.d.clientPhone,
        mode: args.d.mode,
        status: args.nextStatus,
        consentConfirmedAt: args.d.consentConfirmedAt ? new Date(args.d.consentConfirmedAt) : null,
      },
    }),
    prisma.aiAction.update({
      where: { id: args.turnActionId },
      data: {
        status: "COMPLETED",
        payload: {
          message: args.message,
          reply: args.reply,
          intent: args.intent,
          route: args.route,
          intentConfidence: args.nluConfidence,
          matrix: INTENT_ACTION_MATRIX[args.intent as keyof typeof INTENT_ACTION_MATRIX],
          antiHallucinationRules: ANTI_HALLUCINATION_RULES,
          nextStatus: args.nextStatus,
          nluSource: args.nluSource,
          nluIntent: args.nluIntent,
          mappedNluIntent: args.mappedNluIntent,
          actionType: args.nextAction?.type ?? null,
          uiKind: args.nextUi?.kind ?? null,
          confirmPendingClientAction: args.confirmPendingClientAction,
          pendingClientActionType: args.pendingClientActionType,
          routeReason: args.routeReason,
          guardReason: args.guardReason,
          messageForRouting: args.messageForRouting,
        },
      },
    }),
    prisma.aiLog.create({
      data: {
        actionId: args.turnActionId,
        level: "info",
        message: "assistant_turn_metrics",
        data: {
          intent: args.intent,
          route: args.route,
          intentConfidence: args.nluConfidence,
          usedFallback: args.nluSource === "fallback",
          usedNluIntent: args.useNluIntent,
          routeReason: args.routeReason,
          guardReason: args.guardReason,
          failedAction: false,
          actionType: args.nextAction?.type ?? null,
        },
      },
    }),
  ]);
}




export async function handlePublicAiChatPost(request: Request) {
  const prepared = await preparePostTurn(request);
  if ("response" in prepared) return prepared.response;
  const { resolved, body, message, session, client, thread, draft, nextThreadKey, turnAction } = prepared.prepared;
  const failSoft = createFailSoftHandler({
    threadId: thread.id,
    nextThreadKey,
    draft,
    turnActionId: turnAction.id,
    message,
  });

  if (!resolved.account) return failSoft("account_not_found");

  try {
    const recentMessages = await prisma.aiMessage.findMany({
      where: { threadId: thread.id },
      orderBy: { id: "desc" },
      take: 12,
      select: { role: true, content: true },
    });

    const { locations, services, specialists, requiredVersionIds, accountProfile, customPrompt } = await loadPublicAiChatContext(resolved.account.id);

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
    const intentContext = buildIntentContext({
      message,
      t,
      d,
      nowYmd,
      recentMessages: [...recentMessages].reverse(),
      nluResult,
      locations,
      services,
      specialists,
    });

    const {
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
      routeReason,
      useNluIntent,
    } = intentContext;

    let intent = intentContext.intent;
    let route = intentContext.route;

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
      const kickoff = buildDirectBookingKickoffReply({ date: d.date, locations });
      reply = kickoff.reply;
      nextUi = kickoff.ui;
    } else if (route === "client-actions") {
      const clientActionsResult = await runClientActionsBranch({
        messageForRouting,
        accountId: resolved.account.id,
        accountTimeZone: resolved.account.timeZone,
        accountSlug: resolved.account.slug,
        origin,
        clientId: client?.clientId ?? null,
        threadClientId: thread.clientId ?? null,
      });
      reply = clientActionsResult.reply;
      nextUi = clientActionsResult.ui;
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
      const bookingBranch = await runBookingFlowBranch({
        message,
        messageForRouting,
        bookingMessageNorm,
        shouldRunBookingFlow,
        explicitNearestAvailability,
        explicitAvailabilityPeriod,
        explicitCalendarCue,
        explicitBookingText,
        intent,
        locationChosenThisTurn,
        choiceNum,
        d,
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
      if (bookingBranch.handled) {
        reply = bookingBranch.reply ?? reply;
        nextStatus = bookingBranch.nextStatus ?? nextStatus;
        nextAction = bookingBranch.nextAction ?? nextAction;
        nextUi = bookingBranch.ui ?? null;
      }
    } else {
      const knownClientName = d.clientName?.trim() || [client?.firstName, client?.lastName].filter(Boolean).join(" ").trim();
      const basicChatReply = buildBasicChatInfoReply({
        message,
        messageForRouting,
        intent,
        explicitDateTimeQuery,
        accountTimeZone: resolved.account.timeZone,
        clientTimeZone: clientTimeZone ?? null,
        knownClientName,
        accountName: resolved.account.name?.trim() ?? null,
        assistantName: ASSISTANT_NAME,
        explicitWorkplaceRoleCue,
        conversationalReply,
        explicitServiceComplaint,
        t,
        consecutiveToxicTurns,
        locations,
        services,
        bridgeFocusDate,
        accountPhone: accountProfile?.phone ?? null,
        accountAddress: accountProfile?.address ?? null,
        selectedLocationByMessage,
      });
      if (basicChatReply.handled) {
        reply = basicChatReply.reply;
        nextUi = basicChatReply.ui ?? nextUi;
      } else if (intent === "ask_specialists") {
        const specialistsBranch = handleAskSpecialistsBranch({
          message,
          t,
          nowYmd,
          d,
          locations,
          services,
          specialists,
          selectedSpecialistByMessage,
          explicitSpecialistDetailsCue,
          selectedSpecialistLevelFilter,
        });
        if (specialistsBranch.handled) {
          reply = specialistsBranch.reply;
          nextUi = specialistsBranch.ui ?? nextUi;
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

    await finalizeSuccessfulTurn({
      threadId: thread.id,
      turnActionId: turnAction.id,
      message,
      reply,
      intent,
      route,
      nluConfidence,
      mappedNluIntent,
      nluSource: nluResult.source,
      nluIntent: nlu?.intent ?? null,
      nextStatus,
      nextAction,
      nextUi,
      confirmPendingClientAction: Boolean(confirmPendingClientAction),
      pendingClientActionType: pendingClientAction?.type ?? null,
      routeReason,
      guardReason,
      useNluIntent,
      messageForRouting,
      d,
    });

    return jsonOk({ threadId: thread.id, threadKey: nextThreadKey, reply, action: nextAction, ui: nextUi, draft: d });
  } catch (e) {
    return failSoft(e instanceof Error ? e.message : "unknown_error");
  }
}























































































































