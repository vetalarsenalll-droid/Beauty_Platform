import { prisma } from "@/lib/prisma";
import type { ChatUi } from "@/lib/booking-flow";
import type { LocationLite, ServiceLite, SpecialistLite } from "@/lib/booking-tools";
import {
  serviceQuickOption,
  specialistQuickOption,
  mentionsServiceTopic,
  looksLikeUnknownServiceRequest,
  extractRequestedServicePhrase,
  isNluServiceGroundedByText,
  tokenizeForFuzzy,
  levenshteinWithin,
} from "@/lib/aisha-routing-helpers";

const prismaAny = prisma as any;

export function resolveTypoBookingIntent(messageNorm: string) {
  return /(запиг|запини|зпиши|запеши|запеш)/i.test(messageNorm);
}

function norm(v: string) {
  return v
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^\p{L}\p{N}\s:.+\-/]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function scorePhraseToName(phraseNorm: string, candidateNorm: string) {
  const pTokens = tokenizeForFuzzy(phraseNorm);
  const cTokens = tokenizeForFuzzy(candidateNorm);
  if (!pTokens.length || !cTokens.length) return 0;
  let score = 0;
  for (const pt of pTokens) {
    let best = 0;
    for (const ct of cTokens) {
      if (pt === ct) {
        best = Math.max(best, 5);
        continue;
      }
      if (ct.startsWith(pt) || pt.startsWith(ct)) {
        best = Math.max(best, 3);
        continue;
      }
      const maxDist = Math.max(1, Math.floor(Math.max(pt.length, ct.length) / 4));
      if (levenshteinWithin(pt, ct, maxDist) <= maxDist) {
        best = Math.max(best, 2);
      }
    }
    score += best;
  }
  return score;
}

function topEntityCandidates<T>(
  textNorm: string,
  entities: T[],
  labels: (entity: T) => string[],
  limit = 5,
): Array<{ entity: T; score: number }> {
  const scored = entities
    .map((entity) => {
      const variants = labels(entity).map((x) => norm(x)).filter(Boolean);
      const score = variants.reduce((acc, candidate) => Math.max(acc, scorePhraseToName(textNorm, candidate)), 0);
      return { entity, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}

function extractRequestedSpecialistPhrase(messageNorm: string) {
  const m =
    /(?:^|\s)(?:к|ко)\s+([\p{L}-]{2,}(?:\s+[\p{L}-]{2,}){0,2})(?:\s|$)/iu.exec(messageNorm) ??
    /(?:мастер|специалист)(?:а|у)?\s+([\p{L}-]{2,}(?:\s+[\p{L}-]{2,}){0,2})(?:\s|$)/iu.exec(messageNorm);
  return (m?.[1] ?? "").trim() || null;
}

function isSpecialistDirectRequest(messageNorm: string) {
  return /(?:запиш\p{L}*|хочу|к|ко|мастер|специалист)/iu.test(messageNorm);
}

function isLocationDirectRequest(messageNorm: string) {
  return /(филиал|локац|адрес|центр|петроград|московск|ривер|riverside)/i.test(messageNorm);
}

function buildServiceSuggestionOptions(messageNorm: string, services: ServiceLite[]) {
  const phrase = extractRequestedServicePhrase(messageNorm);
  const pool = phrase
    ? topEntityCandidates(norm(phrase), services, (s) => [s.name, s.categoryName ?? "", s.description ?? ""], 6).map((x) => x.entity)
    : [];
  if (pool.length) return pool.map(serviceQuickOption);
  return services.map(serviceQuickOption);
}

function inferGenericServiceCandidates(messageNorm: string, services: ServiceLite[]) {
  const t = norm(messageNorm);
  return services.filter((s) => {
    const n = norm(s.name);
    if (/маник/.test(t)) return /маник/.test(n);
    if (/педик/.test(t)) return /педик/.test(n);
    if (/(бров|brow)/i.test(t)) return /(бров|brow)/i.test(n);
    if (/(ресниц|lash)/i.test(t)) return /(ресниц|lash)/i.test(n);
    if (/(стриж|haircut)/i.test(t)) return /(стриж|haircut)/i.test(n);
    return false;
  });
}

export async function handleUnknownServiceResolution(args: {
  shouldEnrichDraftForBooking: boolean;
  d: any;
  t: string;
  nlu: any;
  threadId: number;
  nextThreadKey: string | null;
  services: ServiceLite[];
}): Promise<{ handled: boolean; payload?: { threadId: number; threadKey: string | null; reply: string; action: null; ui: ChatUi; draft: any } }> {
  const { shouldEnrichDraftForBooking, d, t, nlu, threadId, nextThreadKey, services } = args;

  const scopedServices = services.filter((x) => (d.locationId ? x.locationIds.includes(d.locationId) : true));
  const serviceTextMatch = scopedServices.find((x) => t.includes(x.name.toLowerCase()));
  const nluServiceValid = Boolean(nlu?.serviceId && scopedServices.some((x) => x.id === nlu.serviceId));
  const nluServiceObj = nlu?.serviceId ? scopedServices.find((x) => x.id === nlu.serviceId) ?? null : null;
  const requestedServicePhrase = extractRequestedServicePhrase(t);
  const nluServiceGrounded = isNluServiceGroundedByText(t, nluServiceObj);

  const deicticServiceReference = /(?:эту\s+услуг|эту\s+процедур|на\s+неё|на\s+нее|ту\s+же|this\s+service|that\s+service)/iu.test(t);

  const unknownServiceRequested =
    shouldEnrichDraftForBooking &&
    !d.serviceId &&
    !serviceTextMatch &&
    mentionsServiceTopic(t) &&
    ((!nluServiceValid && looksLikeUnknownServiceRequest(t)) || (!!requestedServicePhrase && nluServiceValid && !nluServiceGrounded));

  if (!unknownServiceRequested || deicticServiceReference) return { handled: false };

  const requested = requestedServicePhrase ? `Услугу «${requestedServicePhrase}» не нашла.` : "Такой услуги не нашла.";
  const unknownServiceReply = `${requested} Выберите, пожалуйста, из доступных ниже.`;
  const unknownServiceUi: ChatUi = {
    kind: "quick_replies",
    options: buildServiceSuggestionOptions(t, services),
  };

  await prisma.$transaction([
    prisma.aiMessage.create({ data: { threadId, role: "assistant", content: unknownServiceReply } }),
    prismaAny.aiBookingDraft.update({
      where: { threadId },
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

  return {
    handled: true,
    payload: { threadId, threadKey: nextThreadKey, reply: unknownServiceReply, action: null, ui: unknownServiceUi, draft: d },
  };
}

export async function handleEntityClarificationResolution(args: {
  shouldEnrichDraftForBooking: boolean;
  shouldRunBookingFlow: boolean;
  messageForRouting: string;
  t: string;
  d: any;
  threadId: number;
  nextThreadKey: string | null;
  locations: LocationLite[];
  services: ServiceLite[];
  specialists: SpecialistLite[];
}): Promise<{ handled: boolean; payload?: { threadId: number; threadKey: string | null; reply: string; action: null; ui: ChatUi; draft: any } }> {
  const { shouldEnrichDraftForBooking, shouldRunBookingFlow, messageForRouting, d, threadId, nextThreadKey, locations, services, specialists } = args;
  if (!shouldEnrichDraftForBooking && !shouldRunBookingFlow) return { handled: false };

  const messageNorm = norm(messageForRouting);
  const bookingLike = /(запиш\p{L}*|хочу|нужн[ао]?|бронь|оформи)/iu.test(messageNorm);

  if (!d.specialistId && bookingLike && isSpecialistDirectRequest(messageNorm)) {
    const requestedSpecialist = extractRequestedSpecialistPhrase(messageNorm);
    if (requestedSpecialist) {
      const specialistPool = d.locationId ? specialists.filter((s) => s.locationIds.includes(d.locationId)) : specialists;
      const candidates = topEntityCandidates(norm(requestedSpecialist), specialistPool, (s) => [s.name], 5);
      if (candidates.length && candidates[0] && (candidates[0].score >= 7 || candidates.length === 1)) {
        d.specialistId = candidates[0].entity.id;
      } else {
        const options = candidates.map((x) => specialistQuickOption(x.entity));
        if (options.length) {
          const reply = `Не нашла специалиста точно по запросу «${requestedSpecialist}». Выберите, пожалуйста, подходящий вариант ниже.`;
          return { handled: true, payload: { threadId, threadKey: nextThreadKey, reply, action: null, ui: { kind: "quick_replies", options }, draft: d } };
        }
      }
    }
  }

  if (!d.locationId && bookingLike && isLocationDirectRequest(messageNorm)) {
    const candidates = topEntityCandidates(messageNorm, locations, (l) => [l.name, l.address ?? ""], 4);
    if (candidates.length && candidates[0] && candidates[0].score >= 8) {
      d.locationId = candidates[0].entity.id;
    } else if (candidates.length > 1) {
      const reply = "Похоже, есть несколько похожих филиалов. Выберите нужный кнопкой ниже.";
      const options = candidates.map((x) => ({ label: x.entity.name, value: x.entity.name }));
      return { handled: true, payload: { threadId, threadKey: nextThreadKey, reply, action: null, ui: { kind: "quick_replies", options }, draft: d } };
    }
  }

  if (!d.serviceId && bookingLike) {
    const generic = inferGenericServiceCandidates(messageNorm, services);
    if (generic.length > 1 && generic.length <= 8 && !extractRequestedServicePhrase(messageNorm)?.includes(" ")) {
      const reply = "Уточните, пожалуйста, услугу. Нашла несколько подходящих вариантов:";
      const options = generic.map(serviceQuickOption);
      return { handled: true, payload: { threadId, threadKey: nextThreadKey, reply, action: null, ui: { kind: "quick_replies", options }, draft: d } };
    }
  }

  if (d.specialistId && d.serviceId) {
    const specialist = specialists.find((s) => s.id === d.specialistId) ?? null;
    if (specialist?.serviceIds?.length && !specialist.serviceIds.includes(d.serviceId)) {
      const allowedServices = services.filter((s) => specialist.serviceIds.includes(s.id) && (!d.locationId || s.locationIds.includes(d.locationId)));
      if (allowedServices.length) {
        d.serviceId = null;
        d.time = null;
        const reply = `У выбранного специалиста эта услуга недоступна. Выберите услугу, которую выполняет ${specialist.name}.`;
        const options = allowedServices.map(serviceQuickOption);
        return { handled: true, payload: { threadId, threadKey: nextThreadKey, reply, action: null, ui: { kind: "quick_replies", options }, draft: d } };
      }
    }
  }

  return { handled: false };
}
