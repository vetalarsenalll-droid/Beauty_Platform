import { prisma } from "@/lib/prisma";
import type { ChatUi } from "@/lib/booking-flow";
import type { LocationLite, ServiceLite, SpecialistLite } from "@/lib/booking-tools";
import {
  serviceQuickOption,
  specialistQuickOption,
  tokenizeForFuzzy,
  levenshteinWithin,
  extractRequestedServicePhrase,
  mentionsServiceTopic,
  looksLikeUnknownServiceRequest,
  isNluServiceGroundedByText,
} from "@/lib/aisha-routing-helpers";

const prismaAny = prisma as any;

type ResolutionPayload = {
  threadId: number;
  threadKey: string | null;
  reply: string;
  action: null;
  ui: ChatUi;
  draft: any;
};

function norm(v: string) {
  return v
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^\p{L}\p{N}\s:.+\-/]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isExactMention(messageNorm: string, entityName: string) {
  const m = norm(messageNorm);
  const n = norm(entityName);
  return !!n && m.includes(n);
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

function looksLikeLocationChoice(messageNorm: string) {
  return isLocationDirectRequest(messageNorm) || /(?:^|\s)в\s+[\p{L}-]{3,}/iu.test(messageNorm);
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

function dedupeOptions(options: Array<{ label: string; value: string }>) {
  const seen = new Set<string>();
  const out: Array<{ label: string; value: string }> = [];
  for (const o of options) {
    const key = `${o.label}|${o.value}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(o);
  }
  return out;
}

async function persistClarificationAndBuildPayload(args: {
  threadId: number;
  nextThreadKey: string | null;
  reply: string;
  ui: ChatUi;
  d: any;
}) {
  const { threadId, nextThreadKey, reply, ui, d } = args;
  await prisma.$transaction([
    prisma.aiMessage.create({ data: { threadId, role: "assistant", content: reply } }),
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
    threadId,
    threadKey: nextThreadKey,
    reply,
    action: null,
    ui,
    draft: d,
  } satisfies ResolutionPayload;
}

export function resolveTypoBookingIntent(messageNorm: string) {
  return /(запиг|запини|зпиши|запеши|запеш)/i.test(messageNorm);
}

export async function handleUnknownServiceResolution(args: {
  shouldEnrichDraftForBooking: boolean;
  d: any;
  t: string;
  nlu: any;
  threadId: number;
  nextThreadKey: string | null;
  services: ServiceLite[];
}): Promise<{ handled: boolean; payload?: ResolutionPayload }> {
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
  const reply = `${requested} Выберите, пожалуйста, из доступных ниже.`;
  const phraseNorm = norm(requestedServicePhrase ?? t);
  const suggestions = topEntityCandidates(phraseNorm, scopedServices.length ? scopedServices : services, (s) => [s.name, s.categoryName ?? "", s.description ?? ""], 6).map((x) => x.entity);
  const pool = suggestions.length ? suggestions : (scopedServices.length ? scopedServices : services);
  const ui: ChatUi = { kind: "quick_replies", options: dedupeOptions(pool.map(serviceQuickOption)) };

  const payload = await persistClarificationAndBuildPayload({ threadId, nextThreadKey, reply, ui, d });
  return { handled: true, payload };
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
}): Promise<{ handled: boolean; payload?: ResolutionPayload }> {
  const { shouldEnrichDraftForBooking, shouldRunBookingFlow, messageForRouting, d, threadId, nextThreadKey, locations, services, specialists } = args;
  if (!shouldEnrichDraftForBooking && !shouldRunBookingFlow) return { handled: false };

  const messageNorm = norm(messageForRouting);
  const bookingLike = /(запиш\p{L}*|хочу|нужн[ао]?|бронь|оформи)/iu.test(messageNorm);
  const specialistScope = d.locationId ? specialists.filter((s) => s.locationIds.includes(d.locationId)) : specialists;

  if (!d.specialistId && bookingLike && isSpecialistDirectRequest(messageNorm)) {
    const requestedSpecialist = extractRequestedSpecialistPhrase(messageNorm);
    if (requestedSpecialist) {
      const candidates = topEntityCandidates(norm(requestedSpecialist), specialistScope, (s) => [s.name], 5);
      if (candidates.length) {
        const top = candidates[0]!.entity;
        const topName = top.name;
        const exact = isExactMention(messageNorm, topName);
        if (exact && candidates[0]!.score >= 7) {
          d.specialistId = top.id;
        } else {
          const options = dedupeOptions(candidates.map((x) => specialistQuickOption(x.entity)));
          const reply = `Правильно поняла, Вы имели в виду специалиста «${topName}»? Выберите вариант ниже.`;
          const payload = await persistClarificationAndBuildPayload({
            threadId,
            nextThreadKey,
            reply,
            ui: { kind: "quick_replies", options },
            d,
          });
          return { handled: true, payload };
        }
      }
    }
  }

  if (d.specialistId) {
    const selected = specialists.find((s) => s.id === d.specialistId) ?? null;
    if (selected && bookingLike && isSpecialistDirectRequest(messageNorm) && !isExactMention(messageNorm, selected.name)) {
      const options = dedupeOptions([specialistQuickOption(selected)]);
      const reply = `Правильно поняла, Вы имели в виду специалиста «${selected.name}»? Подтвердите выбор кнопкой ниже.`;
      const payload = await persistClarificationAndBuildPayload({
        threadId,
        nextThreadKey,
        reply,
        ui: { kind: "quick_replies", options },
        d,
      });
      return { handled: true, payload };
    }
  }

  if (d.specialistId && !d.locationId) {
    const selected = specialists.find((s) => s.id === d.specialistId) ?? null;
    const specialistLocations = selected ? locations.filter((l) => selected.locationIds.includes(l.id)) : [];
    if (specialistLocations.length === 1) {
      d.locationId = specialistLocations[0]!.id;
    } else if (specialistLocations.length > 1) {
      const reply = `Для специалиста «${selected?.name ?? "выбранного специалиста"}» выберите филиал, и продолжу запись.`;
      const options = specialistLocations.map((l) => ({ label: l.name, value: l.name }));
      const payload = await persistClarificationAndBuildPayload({
        threadId,
        nextThreadKey,
        reply,
        ui: { kind: "quick_replies", options },
        d,
      });
      return { handled: true, payload };
    }
  }

  if (d.locationId && bookingLike) {
    const selectedLocation = locations.find((l) => l.id === d.locationId) ?? null;
    if (selectedLocation && !isExactMention(messageNorm, selectedLocation.name)) {
      const options = dedupeOptions([{ label: selectedLocation.name, value: selectedLocation.name }]);
      const reply = `Проверю запись в филиале «${selectedLocation.name}». Подтвердите, пожалуйста, выбор кнопкой ниже.`;
      const payload = await persistClarificationAndBuildPayload({
        threadId,
        nextThreadKey,
        reply,
        ui: { kind: "quick_replies", options },
        d,
      });
      return { handled: true, payload };
    }
  }

  if (!d.locationId && bookingLike && looksLikeLocationChoice(messageNorm)) {
    const locationPool = d.specialistId
      ? locations.filter((l) => {
          const sp = specialists.find((s) => s.id === d.specialistId);
          return sp ? sp.locationIds.includes(l.id) : true;
        })
      : locations;
    const candidates = topEntityCandidates(messageNorm, locationPool, (l) => [l.name, l.address ?? ""], 4);
    if (candidates.length) {
      const top = candidates[0]!.entity;
      const exact = isExactMention(messageNorm, top.name);
      if (exact && candidates[0]!.score >= 7) {
        d.locationId = top.id;
      } else {
        const reply = `Похоже, Вы имели в виду филиал «${top.name}». Подтвердите выбор кнопкой ниже.`;
        const options = dedupeOptions(candidates.map((x) => ({ label: x.entity.name, value: x.entity.name })));
        const payload = await persistClarificationAndBuildPayload({
          threadId,
          nextThreadKey,
          reply,
          ui: { kind: "quick_replies", options },
          d,
        });
        return { handled: true, payload };
      }
    }
  }

  const scopedServices = services
    .filter((s) => (!d.locationId ? true : s.locationIds.includes(d.locationId)))
    .filter((s) => {
      if (!d.specialistId) return true;
      const sp = specialists.find((x) => x.id === d.specialistId);
      if (!sp) return true;
      return sp.serviceIds?.length ? sp.serviceIds.includes(s.id) : true;
    });

  if (d.serviceId && bookingLike) {
    const selectedService = services.find((s) => s.id === d.serviceId) ?? null;
    if (selectedService && !isExactMention(messageNorm, selectedService.name)) {
      const exactAnyServiceMention = scopedServices.some((s) => isExactMention(messageNorm, s.name));
      const generic = inferGenericServiceCandidates(messageNorm, scopedServices);
      if (!exactAnyServiceMention && generic.length > 1) {
        d.serviceId = null;
        d.time = null;
        const reply = "Уточните, пожалуйста, услугу. Нашла несколько подходящих вариантов:";
        const options = dedupeOptions(generic.map(serviceQuickOption));
        const payload = await persistClarificationAndBuildPayload({
          threadId,
          nextThreadKey,
          reply,
          ui: { kind: "quick_replies", options },
          d,
        });
        return { handled: true, payload };
      }

      const options = dedupeOptions([serviceQuickOption(selectedService)]);
      const reply = `Правильно поняла, Вы имели в виду услугу «${selectedService.name}»? Подтвердите выбор кнопкой ниже.`;
      const payload = await persistClarificationAndBuildPayload({
        threadId,
        nextThreadKey,
        reply,
        ui: { kind: "quick_replies", options },
        d,
      });
      return { handled: true, payload };
    }
  }

  if (!d.serviceId && bookingLike) {

    const requested = extractRequestedServicePhrase(messageNorm);
    const targetPhrase = requested ? norm(requested) : messageNorm;

    const generic = inferGenericServiceCandidates(targetPhrase, scopedServices);
    if (generic.length > 1) {
      const reply = "Уточните, пожалуйста, услугу. Нашла несколько подходящих вариантов:";
      const options = dedupeOptions(generic.map(serviceQuickOption));
      const payload = await persistClarificationAndBuildPayload({
        threadId,
        nextThreadKey,
        reply,
        ui: { kind: "quick_replies", options },
        d,
      });
      return { handled: true, payload };
    }

    if (requested) {
      const candidates = topEntityCandidates(targetPhrase, scopedServices, (s) => [s.name, s.categoryName ?? "", s.description ?? ""], 5);
      if (candidates.length) {
        const top = candidates[0]!.entity;
        const exact = isExactMention(messageNorm, top.name);
        if (!exact) {
          const reply = `Правильно поняла, Вы имели в виду услугу «${top.name}»? Выберите вариант ниже.`;
          const options = dedupeOptions(candidates.map((x) => serviceQuickOption(x.entity)));
          const payload = await persistClarificationAndBuildPayload({
            threadId,
            nextThreadKey,
            reply,
            ui: { kind: "quick_replies", options },
            d,
          });
          return { handled: true, payload };
        }
      }
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
        const options = dedupeOptions(allowedServices.map(serviceQuickOption));
        const payload = await persistClarificationAndBuildPayload({
          threadId,
          nextThreadKey,
          reply,
          ui: { kind: "quick_replies", options },
          d,
        });
        return { handled: true, payload };
      }
    }
  }

  return { handled: false };
}
