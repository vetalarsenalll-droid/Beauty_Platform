import { runBookingFlow } from "@/lib/booking-flow";
import type { ChatUi } from "@/lib/booking-flow";
import type { DraftLike, LocationLite, ServiceLite, SpecialistLite } from "@/lib/booking-tools";
import { runClientAccountFlow } from "@/lib/client-account-flow";
import { getNowInTimeZone } from "@/lib/public-booking";
import {
  asksClientOwnName,
  asksClientRecognition,
  asksWhyNoAnswer,
  buildChatOnlyActionUi,
  buildOutOfScopeConversationalReply,
  buildSmalltalkReply,
  buildToxicReply,
  filterSpecialistsByLevel,
  formatYmdRu,
  isGeneralQuestionOutsideBooking,
  isGreetingText,
  isOutOfDomainPrompt,
  isPauseConversationMessage,
  locationByText,
  looksLikeHardBookingPushReply,
  serviceByText,
  specialistLevelTabOptions,
  specialistOptionsWithTabs,
  isToxicNameRequest,
} from "@/lib/aisha-routing-helpers";
import type { AishaIntent } from "@/lib/dialog-policy";
import { parseDate } from "@/lib/aisha-chat-parsers";


export type AuthLevel = "full" | "thread_only" | "none";

const norm = (v: string) =>
  v
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^\p{L}\p{N}\s:.+\-/]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

const has = (m: string, r: RegExp) => r.test(norm(m));
const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function buildDirectBookingKickoffReply(args: {
  date: string | null;
  locations: LocationLite[];
}): { reply: string; ui: ChatUi } {
  const { date, locations } = args;
  const reply = date
    ? `На ${formatYmdRu(date)} выберите филиал (локацию), и продолжу запись.`
    : "Выберите филиал (локацию), и продолжу запись.";
  const ui: ChatUi = { kind: "quick_replies", options: locations.map((x) => ({ label: x.name, value: x.name })) };
  return { reply, ui };
}

export async function runClientActionsBranch(args: {
  messageForRouting: string;
  accountId: number;
  accountTimeZone: string;
  accountSlug: string;
  origin: string;
  clientId: number | null;
  threadClientId: number | null;
}): Promise<{ reply: string; ui: ChatUi | null }> {
  const { messageForRouting, accountId, accountTimeZone, accountSlug, origin, clientId, threadClientId } = args;

  const effectiveClientId = clientId ?? threadClientId ?? null;
  const authLevel: AuthLevel = clientId ? "full" : threadClientId ? "thread_only" : "none";
  const clientFlow = await runClientAccountFlow({
    message: messageForRouting,
    messageNorm: norm(messageForRouting),
    accountId,
    accountTimeZone,
    clientId: effectiveClientId,
    authMode: authLevel === "none" ? "full" : authLevel,
    origin,
    accountSlug,
  });

  if (clientFlow.handled) {
    return { reply: clientFlow.reply ?? "Что показать по вашим записям?", ui: clientFlow.ui ?? null };
  }

  if (authLevel === "none") {
    const accountParam = accountSlug || "";
    const loginUrl = accountParam ? `/c/login?account=${encodeURIComponent(accountParam)}` : "/c/login";
    return {
      reply: "Для персональных данных нужна активная авторизация. Нажмите кнопку ниже, чтобы войти в личный кабинет.",
      ui: {
        kind: "quick_replies",
        options: [{ label: "Войти в личный кабинет", value: "Открыть личный кабинет", href: loginUrl }],
      },
    };
  }

  return {
    reply: "Что показать по вашим записям?",
    ui: {
      kind: "quick_replies",
      options: [
        { label: "Предстоящие записи", value: "предстоящие записи" },
        { label: "Прошедшие записи", value: "прошедшие записи" },
        { label: "Отменить запись", value: "отмени мою ближайшую запись" },
        { label: "Перенести запись", value: "перенеси мою запись" },
        { label: "Статистика", value: "моя статистика" },
      ],
    },
  };
}

export async function runBookingFlowBranch(args: {
  message: string;
  messageForRouting: string;
  bookingMessageNorm: string;
  shouldRunBookingFlow: boolean;
  explicitNearestAvailability: boolean;
  explicitAvailabilityPeriod: boolean;
  explicitCalendarCue: boolean;
  explicitBookingText: boolean;
  intent: string;
  locationChosenThisTurn: boolean;
  choiceNum: number | null;
  d: any;
  origin: string;
  account: { id: number; slug: string; timeZone: string };
  locations: LocationLite[];
  services: ServiceLite[];
  specialists: SpecialistLite[];
  previouslySelectedSpecialistName: string | null;
  requiredVersionIds: number[];
  request: Request;
  publicSlug: string;
  todayYmd: string;
  preferredClientId: number | null;
  holdOwnerMarker?: number | null;
}): Promise<{ handled: boolean; reply?: string; nextStatus?: string; nextAction?: { type: "open_booking"; bookingUrl: string } | null; ui?: ChatUi | null }> {
  const {
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
    account,
    locations,
    services,
    specialists,
    previouslySelectedSpecialistName,
    requiredVersionIds,
    request,
    publicSlug,
    todayYmd,
    preferredClientId,
    holdOwnerMarker = null,
  } = args;

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
    (intent === "ask_availability" ||
      explicitNearestAvailability ||
      explicitAvailabilityPeriod ||
      has(message, /(окошк|свобод|время|слот|обед|после обеда|утр|вечер|днем|днём)/i) ||
      (explicitCalendarCue && Boolean(d.locationId) && !d.time) ||
      (locationChosenThisTurn && Boolean(d.date) && !d.serviceId && !d.time));

  const flowResult = await runBookingFlow({
    messageNorm: bookingMessageNorm,
    bookingIntent: shouldRunBookingFlow,
    asksAvailability: asksAvailabilityNow,
    choice: choiceNum,
    d,
    currentStatus: d.status,
    origin,
    account,
    locations,
    services,
    specialists,
    previouslySelectedSpecialistName,
    requiredVersionIds,
    request,
    publicSlug,
    todayYmd,
    preferredClientId,
    holdOwnerMarker,
  });

  return {
    handled: flowResult.handled,
    reply: flowResult.reply ?? undefined,
    nextStatus: flowResult.nextStatus ?? undefined,
    nextAction: flowResult.nextAction ?? null,
    ui: flowResult.ui ?? null,
  };
}

export function buildBasicChatInfoReply(args: {
  message: string;
  messageForRouting: string;
  intent: AishaIntent;
  explicitDateTimeQuery: boolean;
  accountTimeZone: string;
  clientTimeZone: string | null;
  knownClientName: string;
  knownClientEmail: string | null;
  knownClientPhone: string | null;
  accountName: string | null;
  assistantName: string;
  accountDescription: string | null;
  explicitWorkplaceRoleCue: boolean;
  conversationalReply: string | null;
  explicitServiceComplaint: boolean;
  t: string;
  consecutiveToxicTurns: number;
  locations: LocationLite[];
  services: ServiceLite[];
  bridgeFocusDate: string | null;
  accountPhone: string | null;
  accountAddress: string | null;
  selectedLocationByMessage: LocationLite | null;
}): { handled: boolean; reply: string; ui: ChatUi | null } {
  const {
    message,
    messageForRouting,
    intent,
    explicitDateTimeQuery,
    accountTimeZone,
    clientTimeZone,
    knownClientName,
    knownClientEmail,
    knownClientPhone,
    accountName,
    assistantName,
    accountDescription,
    explicitWorkplaceRoleCue,
    conversationalReply,
    explicitServiceComplaint,
    t,
    consecutiveToxicTurns,
    locations,
    services,
    bridgeFocusDate,
    accountPhone,
    accountAddress,
    selectedLocationByMessage,
  } = args;

  let reply = "";
  let ui: ChatUi | null = null;

  if (explicitServiceComplaint) {
    reply =
      "Сожалею, что так вышло. Опишите, пожалуйста, что именно не устроило: услуга, мастер, дата/время. Я передам информацию руководителю.";
    return { handled: true, reply, ui };
  }

  if (explicitDateTimeQuery) {
    const nowInClientTz = getNowInTimeZone(clientTimeZone ?? accountTimeZone);
    const hh = String(Math.floor(nowInClientTz.minutes / 60)).padStart(2, "0");
    const mm = String(nowInClientTz.minutes % 60).padStart(2, "0");
    reply = `Сейчас ${formatYmdRu(nowInClientTz.ymd)}, ${hh}:${mm}.`;
    return { handled: true, reply, ui };
  }

  if (isToxicNameRequest(messageForRouting)) {
    reply = "Я не могу так обращаться. Могу помочь с записью или подсказать по услугам.";
    return { handled: true, reply, ui };
  }

  if (asksClientOwnName(message)) {
    if (knownClientName) {
      reply = `Да, вас зовут ${knownClientName}.`;
    } else if (knownClientEmail || knownClientPhone) {
      reply = "Имя не указано. Напишите, пожалуйста, как к вам обращаться.";
    } else {
      reply = "Пока не вижу вашего имени в профиле. Могу обращаться по имени, если напишете его.";
    }
    return { handled: true, reply, ui };
  }

  if (asksClientRecognition(message)) {
    if (knownClientName) {
      reply = `Да, вижу вас в профиле: ${knownClientName}.`;
    } else if (knownClientEmail || knownClientPhone) {
      reply = "Вижу ваш профиль, но имени нет. Напишите, пожалуйста, как к вам обращаться.";
    } else {
      reply = "Пока не вижу вас в авторизованном профиле. Могу продолжить запись как гостя или после входа в личный кабинет.";
    }
    return { handled: true, reply, ui };
  }

  if (has(messageForRouting, /(как салон называется|как называется салон|как ваш салон называется|как называется ваш салон|название салона)/i)) {
    reply = accountName ? `Наш салон называется «${accountName}».` : "Название салона сейчас недоступно.";
    return { handled: true, reply, ui };
  }

  if (
    has(
      messageForRouting,
      /(стерилиз|стерилизац|дезинф|обработк[ауи]\s+инструмент|инструмент[ао]в?.*(обрабаты|стерилиз)|автоклав|ультразв|ультразвуков[а-я]*\s+мойк)/iu,
    )
  ) {
    const profileNorm = norm(accountDescription ?? "");
    const hasUltrasonicInProfile = /(ультразв|ультразвуков[а-я]*\s+мойк)/iu.test(profileNorm);
    const hasAutoclaveInProfile = /(автоклав)/iu.test(profileNorm);

    if (hasUltrasonicInProfile && hasAutoclaveInProfile) {
      reply =
        "Инструменты обрабатываем поэтапно: сначала очистка и дезинфекция (в том числе ультразвуковая мойка), затем стерилизация в автоклаве. Могу подобрать удобное время для записи.";
    } else if (hasUltrasonicInProfile) {
      reply =
        "Используем ультразвуковую мойку для этапа очистки инструментов, после чего выполняем обязательную стерилизацию по регламенту. Могу подобрать удобное время для записи.";
    } else if (hasAutoclaveInProfile) {
      reply =
        "Основной этап стерилизации — автоклав. Перед стерилизацией инструменты проходят обязательную очистку и дезинфекцию по регламенту. Могу подобрать удобное время для записи.";
    } else {
      reply =
        "Инструменты обрабатываем по санитарному регламенту: очистка, дезинфекция и стерилизация. По вашему филиалу могу уточнить детали и сразу помочь с записью.";
    }
    return { handled: true, reply, ui };
  }

  if (intent === "greeting") {
    reply = knownClientName ? `Здравствуйте, ${knownClientName}! Чем помочь?` : "Здравствуйте! Чем помочь?";
    return { handled: true, reply, ui };
  }

  if (intent === "identity") {
    if (explicitWorkplaceRoleCue) {
      const salonName = accountName || "нашем салоне";
      reply = `Я ${assistantName}, виртуальный ассистент записи в «${salonName}». Помогаю с выбором услуг, специалистов и оформлением записи.`;
    } else {
      const fallback = `Я ${assistantName}, ассистент записи. Помогу с услугами, временем, записью и вашими данными клиента.`;
      const assistantNameNorm = norm(assistantName);
      const assistantNamePattern = assistantNameNorm ? new RegExp(`\\b${escapeRegExp(assistantNameNorm)}\\b`, "i") : null;
      const hasIdentityCue = conversationalReply
        ? /ассистент/i.test(norm(conversationalReply)) ||
          (assistantNamePattern ? assistantNamePattern.test(norm(conversationalReply)) : false)
        : false;
      reply = conversationalReply && hasIdentityCue ? conversationalReply : fallback;
    }
    return { handled: true, reply, ui };
  }

  if (intent === "capabilities") {
    reply = "Помогаю с записью, подбором свободных окон, контактами, а также могу показать ваши записи и статистику.";
    if (!/(запис|услуг|время|специалист)/i.test(norm(reply))) reply = reply.replace(/[.!?]+$/u, "") + ". Помогу с услугами и записью.";
    return { handled: true, reply, ui };
  }

  if (intent === "out_of_scope") {
    const conv = conversationalReply ?? "";
    const hasBookingCue = /(запис|услуг|помочь|салон|домен)/i.test(norm(conv));
    reply = conv && hasBookingCue && !/ассистент\s+записи.*чем\s+помочь|чем\s+помочь.*ассистент\s+записи/i.test(norm(conv))
      ? conv
      : buildOutOfScopeConversationalReply(norm(messageForRouting));
    return { handled: true, reply, ui };
  }

  if (intent === "abuse_or_toxic") {
    reply = buildToxicReply(consecutiveToxicTurns, t);
    if (consecutiveToxicTurns >= 2) ui = buildChatOnlyActionUi({ locations, services, focusDate: bridgeFocusDate });
    return { handled: true, reply, ui };
  }

  if (intent === "post_completion_smalltalk") {
    if (conversationalReply && !looksLikeHardBookingPushReply(conversationalReply)) {
      reply = conversationalReply;
    } else if (isOutOfDomainPrompt(t)) {
      reply = buildOutOfScopeConversationalReply(t);
    } else {
      reply = buildSmalltalkReply(t || norm(messageForRouting));
    }
    return { handled: true, reply, ui };
  }

  if (intent === "smalltalk") {
    if (isGreetingText(messageForRouting)) {
      reply = "Здравствуйте! Чем помочь?";
    } else if (asksWhyNoAnswer(t) || isPauseConversationMessage(t)) {
      reply = buildSmalltalkReply(t);
    } else if (explicitServiceComplaint) {
      reply =
        "Сожалею, что так вышло. Спасибо, что написали об этом. Опишите, пожалуйста, что именно не устроило, и я передам обращение руководителю и помогу подобрать корректную запись к другому мастеру.";
    } else if (conversationalReply) {
      reply = conversationalReply;
    } else if (isOutOfDomainPrompt(t)) {
      reply = buildOutOfScopeConversationalReply(t);
    } else {
      reply = buildSmalltalkReply(norm(messageForRouting));
    }
    return { handled: true, reply, ui };
  }

  if (intent === "contact_phone") {
    const phoneReply = accountPhone ? `Номер студии: ${accountPhone}.` : "Сейчас номер телефона недоступен.";
    reply = locations.length ? `${phoneReply} Локации доступны кнопками ниже.` : phoneReply;
    if (locations.length) {
      ui = { kind: "quick_replies", options: locations.map((x) => ({ label: x.name, value: x.name })) };
    }
    return { handled: true, reply, ui };
  }

  if (intent === "contact_address") {
    const selectedLocation = selectedLocationByMessage;
    if (selectedLocation) {
      const desc = (selectedLocation.description ?? "").trim();
      const addr = selectedLocation.address ? selectedLocation.address : "адрес уточняется";
      reply = selectedLocation.name + ": " + addr + (desc ? " Описание: " + desc : "") + " Если хотите, подберу запись именно в этом филиале.";
      ui = {
        kind: "quick_replies",
        options: [
          { label: "Записаться в этот филиал", value: "запиши меня в " + selectedLocation.name },
          { label: "Показать специалистов", value: "какие специалисты в " + selectedLocation.name },
          { label: "Показать услуги", value: "какие услуги в " + selectedLocation.name },
        ],
      };
    } else if (locations.length) {
      reply = "Выберите филиал кнопкой ниже, и покажу адрес и детали по нему.";
      ui = { kind: "quick_replies", options: locations.map((x) => ({ label: x.name, value: x.name })) };
    } else {
      reply = accountAddress ? `Адрес: ${accountAddress}` : "Адрес пока не указан. Могу помочь с записью по удобной локации.";
    }
    return { handled: true, reply, ui };
  }

  if (intent === "working_hours") {
    reply = "График может отличаться по филиалам и датам. Выберите локацию, и я подскажу точное время работы.";
    return { handled: true, reply, ui };
  }

  return { handled: false, reply: "", ui: null };
}


export function handleAskSpecialistsBranch(args: {
  message: string;
  t: string;
  nowYmd: string;
  d: DraftLike;
  locations: LocationLite[];
  services: ServiceLite[];
  specialists: SpecialistLite[];
  selectedSpecialistByMessage: SpecialistLite | null;
  explicitSpecialistDetailsCue: boolean;
  selectedSpecialistLevelFilter: string | "__all__" | null;
}): { handled: boolean; reply: string; ui: ChatUi | null } {
  const {
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
  } = args;

  const dateForSpecialists = parseDate(message, nowYmd) || d.date;
  const locationFromMessage = locationByText(t, locations);
  const selectedLocationId = locationFromMessage?.id ?? d.locationId ?? null;
  const specialistFromMessage = selectedSpecialistByMessage;
  const selectedServiceForSpecialists = serviceByText(t, services) ?? (d.serviceId ? services.find((x) => x.id === d.serviceId) ?? null : null);
  const asksNamedSpecialist = /^(?:а\s+)?[\p{L}-]{2,}\s+[\p{L}-]{2,}\??$/iu.test(message.trim());
  const asksTopSpecialists = /(?:топ[-\s]?мастер|топ[-\s]?мастера|лучшие\s+мастера|ведущие\s+мастера|сильные\s+мастера)/iu.test(t);
  const asksAllSpecialists = /^(?:все|всё|всех|все\s+напиши|всё\s+напиши|перечисли\s+всех|все\s+покажи|всё\s+покажи)$/iu.test(t.trim());
  if (selectedServiceForSpecialists && d.serviceId !== selectedServiceForSpecialists.id) d.serviceId = selectedServiceForSpecialists.id;

  if (specialistFromMessage && (explicitSpecialistDetailsCue || asksNamedSpecialist)) {
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
    const reply =
      specialistFromMessage.name +
      ": " +
      (bio ? bio + " " : "") +
      "Работает в: " +
      locText +
      ". Выполняет услуги: " +
      srvText +
      ". Если хотите, подберу ближайшее время к этому специалисту.";
    const ui: ChatUi = {
      kind: "quick_replies",
      options: [
        { label: "Записаться к этому специалисту", value: "запиши меня к " + specialistFromMessage.name },
        { label: "Показать его услуги", value: "какие услуги делает " + specialistFromMessage.name },
      ],
    };
    return { handled: true, reply, ui };
  }

  if (!specialistFromMessage && asksNamedSpecialist) {
    const reply = "Не нашла специалиста с таким именем. Могу показать всех доступных специалистов или топ-мастеров.";
    const ui: ChatUi = {
      kind: "quick_replies",
      options: [
        { label: "Показать всех специалистов", value: "покажи всех специалистов" },
        { label: "Показать топ-мастеров", value: "кто у вас топ мастера" },
      ],
    };
    return { handled: true, reply, ui };
  }

  if (asksTopSpecialists || asksAllSpecialists) {
    let scoped = specialists.slice();
    if (selectedLocationId) scoped = scoped.filter((s) => s.locationIds.includes(selectedLocationId));
    if (selectedServiceForSpecialists) {
      scoped = scoped.filter((s) => (s.serviceIds?.length ? s.serviceIds.includes(selectedServiceForSpecialists.id) : true));
    }

    const topByLevel = scoped.filter((s) => /(топ|ведущ|эксперт|senior|старш)/i.test((s.levelName ?? "").toLowerCase()));
    const target = asksTopSpecialists ? (topByLevel.length ? topByLevel : scoped) : scoped;

    if (target.length) {
      const names = target.map((s) => s.name).join(", ");
      const topPrefix = asksTopSpecialists && topByLevel.length ? "Топ-мастера" : "Специалисты";
      const reply = topPrefix + ": " + names + ".";
      const ui: ChatUi = { kind: "quick_replies", options: target.map((s) => ({ label: s.name, value: s.name })) };
      return { handled: true, reply, ui };
    }

    return { handled: true, reply: "Сейчас не нашла специалистов по этому запросу. Могу проверить по другой локации или услуге.", ui: null };
  }

  if (selectedLocationId) {
    d.locationId = selectedLocationId;
    const selectedLocation = locations.find((x) => x.id === selectedLocationId) ?? null;
    const scoped = specialists
      .filter((s) => s.locationIds.includes(selectedLocationId))
      .filter((s) => !selectedServiceForSpecialists || (s.serviceIds?.length ? s.serviceIds.includes(selectedServiceForSpecialists.id) : true));
    const scopedByLevel = filterSpecialistsByLevel(scoped, selectedSpecialistLevelFilter);
    if (scoped.length) {
      const locationDetails = selectedLocation?.address ? ` Адрес: ${selectedLocation.address}.` : "";
      const levelPrefix =
        selectedSpecialistLevelFilter && selectedSpecialistLevelFilter !== "__all__" ? `Уровень: ${selectedSpecialistLevelFilter}. ` : "";
      if (scopedByLevel.length) {
        const reply = `${dateForSpecialists ? `На ${formatYmdRu(dateForSpecialists)} ` : ""}в ${selectedLocation?.name ?? "выбранной локации"} доступны специалисты${selectedServiceForSpecialists ? ` по услуге «${selectedServiceForSpecialists.name}»` : ""}.${locationDetails} ${levelPrefix}Выберите специалиста кнопкой ниже.`;
        const ui: ChatUi = { kind: "quick_replies", options: specialistOptionsWithTabs(scoped, scopedByLevel) };
        return { handled: true, reply, ui };
      }
      const reply = `${dateForSpecialists ? `На ${formatYmdRu(dateForSpecialists)} ` : ""}в ${selectedLocation?.name ?? "выбранной локации"} нет специалистов с уровнем «${selectedSpecialistLevelFilter}»${selectedServiceForSpecialists ? ` по услуге «${selectedServiceForSpecialists.name}»` : ""}. Выберите другой уровень кнопкой ниже.`;
      const ui: ChatUi = { kind: "quick_replies", options: specialistLevelTabOptions(scoped) };
      return { handled: true, reply, ui };
    }
    const reply = `${dateForSpecialists ? `На ${formatYmdRu(dateForSpecialists)} ` : ""}по этой локации не нашла специалистов${selectedServiceForSpecialists ? ` для услуги «${selectedServiceForSpecialists.name}»` : ""} в расписании.`;
    return { handled: true, reply, ui: null };
  }

  const byLocation = locations
    .map((loc) => ({
      loc,
      items: specialists
        .filter((s) => s.locationIds.includes(loc.id))
        .filter((s) => !selectedServiceForSpecialists || (s.serviceIds?.length ? s.serviceIds.includes(selectedServiceForSpecialists.id) : true)),
    }))
    .filter((x) => x.items.length > 0);
  if (byLocation.length) {
    const reply = `${dateForSpecialists ? `На ${formatYmdRu(dateForSpecialists)} ` : ""}доступны специалисты по филиалам${selectedServiceForSpecialists ? ` для услуги «${selectedServiceForSpecialists.name}»` : ""}. Выберите филиал кнопкой ниже.`;
    const ui: ChatUi = { kind: "quick_replies", options: byLocation.map((x) => ({ label: x.loc.name, value: x.loc.name })) };
    return { handled: true, reply, ui };
  }

  return { handled: true, reply: "Сейчас не нашла специалистов в расписании. Могу проверить по конкретной локации и дате.", ui: null };
}

