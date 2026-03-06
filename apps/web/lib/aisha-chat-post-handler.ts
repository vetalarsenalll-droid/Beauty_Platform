import { jsonOk } from "@/lib/api";
import { buildPublicSlugId } from "@/lib/public-slug";
import { runAishaBookingBridge, runAishaChatAction, runAishaSmallTalkReply } from "@/lib/aisha-orchestrator";
import type { ChatUi } from "@/lib/booking-flow";
import * as aishaRoutingHelpers from "@/lib/aisha-routing-helpers";
import { parseDate } from "@/lib/aisha-chat-parsers";
import { buildTurnContext } from "@/lib/aisha-chat-turn-context";
import { applyDraftMutations } from "@/lib/aisha-draft-mutations";
import { computeBookingDecisions } from "@/lib/aisha-booking-decisions";
import { handleEntityClarificationResolution, handleUnknownServiceResolution } from "@/lib/aisha-fuzzy-resolver";
import { postProcessReply } from "@/lib/aisha-chat-postprocess";
import { createFailSoftHandler, preparePostTurn, saveTurn } from "@/lib/aisha-turn-persistence";
import { handleClientActionsDomain } from "@/lib/aisha-handle-client-actions";
import { handleBookingDomain } from "@/lib/aisha-handle-booking";
import { handleChatOnlyDomain } from "@/lib/aisha-handle-chat-only";
import type { Action } from "@/lib/aisha-chat-types";

const ASSISTANT_NAME = "Аиша";

const {
  locationByText,
  serviceByText,
  isGreetingText,
  filterServicesByCategory,
  filterSpecialistsByLevel,
  specialistLevelTabOptions,
  serviceOptionsWithTabs,
  specialistOptionsWithTabs,
  looksLikeUnknownServiceRequest,
  asksServiceExistence,
  asksGenderSuitability,
  asksGenderedServices,
  mentionsServiceTopic,
  isServiceComplaintMessage,
  isOutOfDomainPrompt,
  isGeneralQuestionOutsideBooking,
  isPauseConversationMessage,
  asksWhyNoAnswer,
  buildOutOfScopeConversationalReply,
  isGenericBookingTemplateReply,
  isBookingOrAccountCue,
  countConsecutiveNonBookingUserTurns,
  countConsecutiveToxicUserTurns,
  asksSpecialistsByShortText,
  asksWhoPerformsServices,
  extractRequestedServicePhrase,
} = aishaRoutingHelpers;


const norm = (v: string) =>
  v
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^\p{L}\p{N}\s:.+\-/]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
const has = (m: string, r: RegExp) => r.test(norm(m));
export async function handlePublicAiChatPost(request: Request) {
  const prepared = await preparePostTurn(request);
  if ("response" in prepared) return prepared.response;
  const { resolved, body, message, client, thread, draft, nextThreadKey, turnAction } = prepared.prepared;
  const failSoft = createFailSoftHandler({
    threadId: thread.id,
    nextThreadKey,
    draft,
    turnActionId: turnAction.id,
    message,
  });

  if (!resolved.account) return failSoft("account_not_found");

  try {
    const turnContext = await buildTurnContext({
      threadId: thread.id,
      message,
      body,
      account: { id: resolved.account.id, slug: resolved.account.slug, timeZone: resolved.account.timeZone },
      draft,
    });

    const {
      recentMessages,
      locations,
      services,
      specialists,
      requiredVersionIds,
      accountProfile,

      nowYmd,
      nowHm,
      clientTimeZone,
      t,
      d,
      nluResult,
      intentContext,
    } = turnContext;

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

      explicitSpecialistDetailsCue,
      hasDraftContextEarly,


      explicitDateTimeQuery,
      explicitBookingDecline,

      previousUserText,


      explicitServicesFollowUp,

      explicitLocationsFollowUp,


      heuristicIntent,
      mappedNluIntent,
      nluConfidence,








      explicitServiceComplaint,



      explicitWorkplaceRoleCue,

      explicitAddressCue,

      explicitOutOfScopeCue,

      explicitNearestAvailability,
      explicitAvailabilityPeriod,
      explicitCalendarCue,

      explicitDateBookingRequest,


      explicitAlternativeSpecialistsInDraft,

      explicitUnknownServiceLike,

      explicitServiceSpecialistQuestion,
      explicitDraftServiceQuestion,
      selectedSpecialistByText,
      explicitAnySpecialistChoice,
      choiceNum,


      hasClientActionCue,
      hasPositiveFeedbackCue,


      explicitBookingText,
      hasDraftContext,
      forceClientActions,
      isConsentStage,
      shouldStayInAssistantStages,
      isConsentStageMessage,
      forceChatOnlyInfoIntent,

      forceBookingOnPromptedLocationChoice,
      forceBookingOnSpecialistQueryInDraft,
      forceBookingOnServiceSelection,
      forceBookingAwaitingService,
      forceBookingOnDateOnlyInDraft,

      routeReason,
      useNluIntent,
    } = intentContext;

    let intent = intentContext.intent;
    let route = intentContext.route;

    const messageNormForRouteGuard = norm(messageForRouting);
    const explicitAppointmentDetailsRequest =
      /#\s*\d{1,8}\b/.test(messageForRouting) &&
      /(\u043f\u043e\u043a\u0430\u0436\u0438|\u0437\u0430\u043f\u0438\u0441|\u0434\u0435\u0442\u0430\u043b|\u043f\u043e\u0434\u0440\u043e\u0431|\u0440\u0430\u0441\u0448\u0438\u0444|booking|record|details?)/i.test(messageNormForRouteGuard);
    if (explicitAppointmentDetailsRequest) {
      route = "client-actions";
      if (intent !== "cancel_my_booking" && intent !== "reschedule_my_booking") intent = "my_bookings";
    }

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

    const decisions = computeBookingDecisions({
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
      confirmPendingClientAction: Boolean(confirmPendingClientAction),
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
      forceClientActions: Boolean(forceClientActions),
      hasPositiveFeedbackCue,
      previousUserText,
      locations,
      services,
      explicitNearestAvailability,
      explicitAvailabilityPeriod,
      explicitCalendarCue,
      d,
      message,
    });
    const shouldEnrichDraftForBooking = decisions.shouldEnrichDraftForBooking;
    const shouldRunBookingFlow = decisions.shouldRunBookingFlow;
    const bookingMessageNorm = decisions.bookingMessageNorm;

    let previouslySelectedSpecialistName: string | null = null;

    const entityClarification = await handleEntityClarificationResolution({
      shouldEnrichDraftForBooking,
      shouldRunBookingFlow,
      messageForRouting,
      t,
      d,
      threadId: thread.id,
      nextThreadKey,
      locations,
      services,
      specialists,
    });
    if (entityClarification.handled && entityClarification.payload) {
      return jsonOk(entityClarification.payload);
    }

    const draftMutation = applyDraftMutations({
      d,
      message,
      t,
      nowYmd,
      nlu,
      client,
      services,
      locations,
      specialists,
      shouldEnrichDraftForBooking,
      shouldRunBookingFlow,
      choiceNum,
      explicitBookingDecline,
      messageForRouting,
    });
    const locationChosenThisTurn = draftMutation.locationChosenThisTurn;

    const unknownService = await handleUnknownServiceResolution({
      shouldEnrichDraftForBooking,
      d,
      t,
      nlu,
      threadId: thread.id,
      nextThreadKey,
      services,
    });
    if (unknownService.handled && unknownService.payload) {
      return jsonOk(unknownService.payload);
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
      !explicitDateBookingRequest &&
      consecutiveNonBookingTurns >= 2;

    const shouldHardReturnToDomain =
      route === "chat-only" &&
      !hasDraftContext &&
      !isBookingOrAccountCue(t) &&
      consecutiveNonBookingTurns >= 8;

    const bridgeFocusServiceName =
      serviceByText(t, services)?.name ??
      (d.serviceId ? services.find((s) => s.id === d.serviceId)?.name ?? null : null);
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

    const bookingDomainResult = await handleBookingDomain({
      directBookingKickoffFallback,
      date: d.date,
      locations,
      explicitDraftServiceQuestion,
      draftServiceName: d.serviceId ? services.find((s) => s.id === d.serviceId)?.name ?? null : null,
      draftLocationName: d.locationId ? locations.find((x) => x.id === d.locationId)?.name ?? null : null,
      runFlowArgs: {
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
        holdOwnerMarker: -thread.id,
      },
      shouldRunBookingFlow,
      currentReply: reply,
      currentStatus: nextStatus,
      currentAction: nextAction,
      currentUi: nextUi,
    });

    if (route === "client-actions") {
      const clientActionsResult = await handleClientActionsDomain({
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
    } else if (bookingDomainResult.handled) {
      reply = bookingDomainResult.reply;
      nextStatus = bookingDomainResult.nextStatus;
      nextAction = bookingDomainResult.nextAction;
      nextUi = bookingDomainResult.nextUi;
    } else {
      const knownClientName = d.clientName?.trim() || [client?.firstName, client?.lastName].filter(Boolean).join(" ").trim();
      const chatOnlyDomain = handleChatOnlyDomain({
        message,
        intent,
        nowYmd,
        buildBasicArgs: {
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
        },
        askSpecialistsArgs: {
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
        },
      });
      if (chatOnlyDomain.handled) {
        reply = chatOnlyDomain.reply;
        nextUi = chatOnlyDomain.ui ?? nextUi;
      } else if (intent === "ask_services") {
        const locationFromMessage = locationByText(t, locations);
        const selectedLocationIdForServices = locationFromMessage?.id ?? d.locationId ?? null;
        if (selectedLocationIdForServices && d.locationId !== selectedLocationIdForServices) d.locationId = selectedLocationIdForServices;
        const selectedLocationForServices = selectedLocationIdForServices ? locations.find((x) => x.id === selectedLocationIdForServices) ?? null : null;
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
    if (!nextUi && route === "chat-only" && !shouldRunBookingFlow && (intent === "ask_services" || intent === "ask_price")) {
      const matchedService = serviceByText(norm(reply), services) ?? serviceByText(t, services);
      if (matchedService) {
        nextUi = {
          kind: "quick_replies",
          options: [
            {
              label: "Записаться на эту услугу",
              value: `запиши меня на ${matchedService.name}`,
            },
            {
              label: "Показать другие услуги",
              value: "какие услуги есть",
            },
          ],
        };
      }
    }

    const postProcessed = await postProcessReply({
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
      accountId: resolved.account.id,
      assistantName: ASSISTANT_NAME,
      accountProfile,
      knownClientName: d.clientName || [client?.firstName, client?.lastName].filter(Boolean).join(" ").trim() || null,
      conversationalReply,
      contextualBookingBridge,
      draft: d,
    });
    reply = postProcessed.reply;
    nextUi = postProcessed.nextUi;
    const guardReason = postProcessed.guardReason;

    await saveTurn({
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
