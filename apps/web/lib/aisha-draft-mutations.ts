import { parseDate, parseName, parsePhone, parseTime, pickSafeNluDate } from "@/lib/aisha-chat-parsers";
import {
  hasLocationCue,
  locationByText,
  serviceByText,
  specialistByText,
  specialistSupportsSelection,
  isServiceInquiryMessage,
  hasExplicitConsentGrant,
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
    d.specialistId = null;
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

  if (
    d.specialistId &&
    !specialistSupportsSelection({ specialistId: d.specialistId, serviceId: d.serviceId, locationId: d.locationId, specialists })
  ) {
    d.specialistId = null;
  }

  const scopedServices = services.filter((x) => (d.locationId ? x.locationIds.includes(d.locationId) : true));
  const serviceTextMatch = serviceByText(t, scopedServices);
  const nluServiceGrounded = Boolean(
    nlu?.serviceId &&
      scopedServices.some((x) => x.id === nlu.serviceId) &&
      t.includes((scopedServices.find((x) => x.id === nlu.serviceId)?.name ?? "").toLowerCase()),
  );

  if (shouldEnrichDraftForBooking || (shouldRunBookingFlow && Boolean(d.locationId))) {
    const serviceInquiry = isServiceInquiryMessage(message, t);
    const explicitServiceChangeRequest = has(message, /(смени|измени|другую услугу|не на|не эту услугу|выбери услугу|по услуге)/i);
    const canUseNumberForServiceSelection = !d.time || !d.serviceId || explicitServiceChangeRequest;

    if (!serviceInquiry && serviceTextMatch && serviceTextMatch.id !== d.serviceId) {
      d.serviceId = serviceTextMatch.id;
    } else if (
      canUseNumberForServiceSelection &&
      !locationChosenThisTurn &&
      choiceNum &&
      choiceNum >= 1 &&
      choiceNum <= scopedServices.length &&
      scopedServices[choiceNum - 1]!.id !== d.serviceId
    ) {
      d.serviceId = scopedServices[choiceNum - 1]!.id;
    } else if (
      nlu?.serviceId &&
      scopedServices.some((x) => x.id === nlu.serviceId) &&
      d.serviceId !== nlu.serviceId &&
      nluServiceGrounded
    ) {
      d.serviceId = nlu.serviceId;
    }

    if (
      d.specialistId &&
      !specialistSupportsSelection({ specialistId: d.specialistId, serviceId: d.serviceId, locationId: d.locationId, specialists })
    ) {
      d.specialistId = null;
    }
  }

  if (shouldEnrichDraftForBooking) {
    const parsedDate = parseDate(message, nowYmd);
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
    d.date = parsedMonthDateFromRaw || parsedDate || pickSafeNluDate(nlu?.date, nowYmd) || d.date;
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

  return { locationChosenThisTurn, scopedServices };
}
