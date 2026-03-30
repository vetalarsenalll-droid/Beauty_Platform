import { parseDate, parseEmail, parseName, parsePhone, parseTime, pickSafeNluDate } from "@/lib/aisha-chat-parsers";
import {
  hasLocationCue,
  locationByText,
  serviceByText,
  findServiceMatchesInText,
  specialistByText,
  specialistSupportsSelection,
  isServiceInquiryMessage,
  hasExplicitConsentGrant,
  isToxicDisplayName,
} from "@/lib/aisha-routing-helpers";
import type { LocationLite, ServiceLite, SpecialistLite } from "@/lib/booking-tools";

const has = (m: string, r: RegExp) => r.test(m.toLowerCase());

export function applyDraftMutations(args: {
  d: any;
  message: string;
  t: string;
  nowYmd: string;
  nlu: any;
  client: any;
  services: ServiceLite[];
  locations: LocationLite[];
  specialists: SpecialistLite[];
  shouldEnrichDraftForBooking: boolean;
  shouldRunBookingFlow: boolean;
  choiceNum: number | null;
  explicitBookingDecline: boolean;
  messageForRouting: string;
}): { locationChosenThisTurn: boolean; scopedServices: ServiceLite[] } {
  const {
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
  } = args;

  if (explicitBookingDecline) {
    d.locationId = null;
    d.serviceId = null;
    d.serviceIds = [];
    d.specialistId = null;
    d.bookingMode = null;
    d.planJson = [];
    d.date = null;
    d.time = null;
    d.mode = null;
    d.consentConfirmedAt = null;
    d.status = "COLLECTING";
  }

  const hadLocationBefore = Boolean(d.locationId);
  if (!d.locationId && shouldEnrichDraftForBooking) {
    const byName = locationByText(t, locations);
    if (byName) d.locationId = byName.id;
    else if (choiceNum && choiceNum >= 1 && choiceNum <= locations.length) d.locationId = locations[choiceNum - 1]!.id;
    else if (hasLocationCue(t) && nlu?.locationId && locations.some((x) => x.id === nlu.locationId)) d.locationId = nlu.locationId;
  }
  const locationChosenThisTurn = !hadLocationBefore && Boolean(d.locationId);

  const selectedServiceIdsBefore = Array.from(
    new Set<number>([
      ...(Array.isArray(d.serviceIds) ? d.serviceIds : []),
      ...(d.serviceId ? [Number(d.serviceId)] : []),
    ]),
  ).filter((id) => Number.isInteger(id) && id > 0);
  const primaryServiceIdBefore = selectedServiceIdsBefore[0] ?? null;

  if (
    d.specialistId &&
    !specialistSupportsSelection({
      specialistId: d.specialistId,
      serviceId: primaryServiceIdBefore,
      locationId: d.locationId,
      specialists,
    })
  ) {
    d.specialistId = null;
  }

  const scopedServices = services.filter((x) => (d.locationId ? x.locationIds.includes(d.locationId) : true));
  const serviceTextMatch = serviceByText(t, scopedServices);
  const multiServiceHint = /(\sи\s|\s&\s|,|;|\s\+\s|\sплюс\s)/iu.test(t);
  const multiServiceMatches = multiServiceHint ? findServiceMatchesInText(t, scopedServices) : [];
  const nluServiceGrounded = Boolean(
    nlu?.serviceId &&
      scopedServices.some((x) => x.id === nlu.serviceId) &&
      t.includes((scopedServices.find((x) => x.id === nlu.serviceId)?.name ?? "").toLowerCase()),
  );

  if (shouldEnrichDraftForBooking || (shouldRunBookingFlow && Boolean(d.locationId))) {
    const serviceInquiry = isServiceInquiryMessage(message, t);
    const explicitServiceChangeRequest = has(message, /(смени|измени|другую услугу|не на|не эту услугу|выбери услугу|по услуге)/i);
    const canUseNumberForServiceSelection = !d.time || !d.serviceId || explicitServiceChangeRequest;
    const addServiceRequest = has(
      message,
      /(добав(ь|ить)|еще|ещ[eё]|плюс|и еще|и ещё|втор(ую|ая)\s+услуг|треть(ю|я)\s+услуг)/i,
    );

    const currentSelectedServiceIds = Array.from(
      new Set<number>([
        ...(Array.isArray(d.serviceIds) ? d.serviceIds : []),
        ...(d.serviceId ? [Number(d.serviceId)] : []),
      ]),
    ).filter((id) => Number.isInteger(id) && id > 0);

    const clearServicesRequest = has(message, /(очистить услуги|сбросить услуги|удалить все услуги|начать заново по услугам)/i);
    if (clearServicesRequest) {
      d.serviceIds = [];
      d.serviceId = null;
      d.specialistId = null;
      d.bookingMode = null;
      d.planJson = [];
    }

    const removeMatch = /удал(?:и|ить)\s+(?:услуг[ауи]\s*)?(.+)$/iu.exec(message);
    const hasServiceControlCommand = clearServicesRequest || Boolean(removeMatch?.[1]);
    if (removeMatch?.[1]) {
      const targetText = removeMatch[1].trim();
      const targetService = serviceByText(targetText.toLowerCase(), scopedServices);
      if (targetService && currentSelectedServiceIds.includes(targetService.id)) {
        const nextIds = currentSelectedServiceIds.filter((id) => id !== targetService.id);
        d.serviceIds = nextIds;
        d.serviceId = nextIds[0] ?? null;
        d.bookingMode = null;
        d.planJson = [];
        if (
          d.specialistId &&
          d.serviceId &&
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

    const assignServiceSelection = (nextServiceId: number, append: boolean) => {
      const nextService = scopedServices.find((x) => x.id === nextServiceId) ?? null;
      if (!nextService) return;

      if (!append) {
        d.serviceIds = [nextServiceId];
        d.serviceId = nextServiceId;
        d.specialistId = null;
        d.bookingMode = null;
        d.planJson = [];
        return;
      }

      const currentServices = currentSelectedServiceIds
        .map((id) => scopedServices.find((x) => x.id === id) ?? null)
        .filter((x): x is ServiceLite => Boolean(x));
      const canAppend =
        nextService.allowMultiServiceBooking !== false &&
        currentServices.every((service) => service.allowMultiServiceBooking !== false);
      if (!canAppend) {
        d.serviceIds = [nextServiceId];
        d.serviceId = nextServiceId;
        d.specialistId = null;
        d.bookingMode = null;
        d.planJson = [];
        return;
      }
      const merged = Array.from(new Set([...currentSelectedServiceIds, nextServiceId]));
      d.serviceIds = merged;
      d.serviceId = merged[0] ?? null;
      d.specialistId = null;
      d.bookingMode = null;
      d.planJson = [];
    };

    let multiServiceApplied = false;
    if (!hasServiceControlCommand && multiServiceMatches.length >= 2) {
      const uniqueMatches = Array.from(new Set(multiServiceMatches.map((s) => s.id)))
        .map((id) => scopedServices.find((s) => s.id === id) ?? null)
        .filter((s): s is ServiceLite => Boolean(s));
      if (uniqueMatches.length >= 2) {
        const allAllowMulti = uniqueMatches.every((svc) => svc.allowMultiServiceBooking !== false);
        if (allAllowMulti) {
          const ids = uniqueMatches.map((svc) => svc.id);
          d.serviceIds = ids;
          d.serviceId = ids[0] ?? null;
          d.specialistId = null;
          d.bookingMode = null;
          d.planJson = [];
          multiServiceApplied = true;
        } else {
          const first = uniqueMatches[0]!;
          d.serviceIds = [first.id];
          d.serviceId = first.id;
          d.specialistId = null;
          d.bookingMode = null;
          d.planJson = [];
          multiServiceApplied = true;
        }
      }
    }

    if (!multiServiceApplied && !hasServiceControlCommand && !serviceInquiry && serviceTextMatch && serviceTextMatch.id !== d.serviceId) {
      assignServiceSelection(serviceTextMatch.id, addServiceRequest);
    } else if (
      !multiServiceApplied &&
      !hasServiceControlCommand &&
      canUseNumberForServiceSelection &&
      !locationChosenThisTurn &&
      choiceNum &&
      choiceNum >= 1 &&
      choiceNum <= scopedServices.length &&
      scopedServices[choiceNum - 1]!.id !== d.serviceId
    ) {
      assignServiceSelection(scopedServices[choiceNum - 1]!.id, addServiceRequest);
    } else if (
      !multiServiceApplied &&
      !hasServiceControlCommand &&
      nlu?.serviceId &&
      scopedServices.some((x) => x.id === nlu.serviceId) &&
      d.serviceId !== nlu.serviceId &&
      nluServiceGrounded
    ) {
      assignServiceSelection(nlu.serviceId, addServiceRequest);
    }

    if (
      d.specialistId &&
      !specialistSupportsSelection({ specialistId: d.specialistId, serviceId: d.serviceId, locationId: d.locationId, specialists })
    ) {
      d.specialistId = null;
    }
  }

  if (shouldEnrichDraftForBooking) {
    const parsedDate = parseDate(messageForRouting, nowYmd);
    const parsedMonthDateFromRaw = (() => {
      const raw = messageForRouting.toLowerCase();
      const monthMatch = raw.match(/(?:^|\s)(?:в|на)?\s*(январе|феврале|марте|апреле|мае|июне|июле|августе|сентябре|октябре|ноябре|декабре)(?:\s|$)/u);
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
    d.date = parsedMonthDateFromRaw || parsedDate || d.date || pickSafeNluDate(nlu?.date, nowYmd);
    d.time = parsedTime || d.time;

    const selectedSpecialistByText = specialistByText(t, specialists);
    if (selectedSpecialistByText) d.specialistId = selectedSpecialistByText.id;

    const wantsSelfMode = has(message, /(сам|самостоятельно|в форме|онлайн)/i);
    const wantsAssistantMode = has(message, /(оформи|через ассистента|оформи ты|оформи ты)/i);
    if (wantsSelfMode) d.mode = "SELF";
    if (wantsAssistantMode) {
      d.mode = "ASSISTANT";
      d.consentConfirmedAt = null;
    }
    if (!d.mode && d.specialistId && choiceNum === 1) d.mode = "SELF";
    if (!d.mode && d.specialistId && choiceNum === 2) {
      d.mode = "ASSISTANT";
      d.consentConfirmedAt = null;
    }
  }

  const selectedSpecialistByText = specialistByText(t, specialists);
  if (
    selectedSpecialistByText &&
    (shouldEnrichDraftForBooking || shouldRunBookingFlow || d.locationId || d.serviceId || d.date || d.time)
  ) {
    d.specialistId = selectedSpecialistByText.id;
  }

  const parsedNluPhone = typeof nlu?.clientPhone === "string" ? parsePhone(nlu.clientPhone) : null;
  const parsedDraftPhone = d.clientPhone ? parsePhone(d.clientPhone) : null;
  const parsedClientPhone = client?.phone ? parsePhone(client.phone) : null;
  const parsedMessagePhone = parsePhone(message);
  d.clientPhone = parsedMessagePhone || parsedNluPhone || parsedDraftPhone || parsedClientPhone || null;

  const parsedNluEmail = typeof nlu?.clientEmail === "string" ? parseEmail(nlu.clientEmail) : null;
  const parsedDraftEmail = d.clientEmail ? parseEmail(d.clientEmail) : null;
  const parsedClientEmail = client?.email ? parseEmail(client.email) : null;
  const parsedMessageEmail = parseEmail(message);
  d.clientEmail = parsedMessageEmail || parsedNluEmail || parsedDraftEmail || parsedClientEmail || null;

  const explicitNameCue = has(message, /(меня\s+зовут|имя\s+клиента|клиент[:\s]|мое\s+имя|моё\s+имя)/i);
  const parsedMessageName = parseName(message);
  const looksLikeStandaloneName =
    /^[\p{L}'-]{2,}(?:\s+[\p{L}'-]{2,}){0,2}$/u.test(message.trim()) &&
    !/[0-9]/.test(message) &&
    !/[?!.]/.test(message) &&
    !/^(?:как|кто|что|где|почему|зачем|привет|здравствуйте|спасибо|ок|окей|ладно|хорошо|знаешь)$/i.test(message.trim());
  let parsedMessageNameSafe = explicitNameCue || looksLikeStandaloneName ? parsedMessageName : null;
  if (parsedMessageNameSafe && isToxicDisplayName(parsedMessageNameSafe)) {
    parsedMessageNameSafe = null;
  }
  const shouldCaptureClientName =
    d.mode === "ASSISTANT" ||
    d.status === "WAITING_CONSENT" ||
    d.status === "WAITING_CONFIRMATION" ||
    Boolean(parsedMessagePhone) ||
    explicitNameCue;

  if (shouldCaptureClientName) {
    d.clientName =
      parsedMessageNameSafe ||
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

  const normalizedServiceIds = Array.from(
    new Set<number>([
      ...(Array.isArray(d.serviceIds) ? d.serviceIds : []),
      ...(d.serviceId ? [Number(d.serviceId)] : []),
    ]),
  ).filter((id) => Number.isInteger(id) && id > 0);
  d.serviceIds = normalizedServiceIds;
  d.serviceId = normalizedServiceIds[0] ?? null;

  return { locationChosenThisTurn, scopedServices };
}
