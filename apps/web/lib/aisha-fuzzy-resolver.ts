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
import { parseDate } from "@/lib/aisha-chat-parsers";

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

function normalizePersonToken(raw: string) {
  return norm(raw)
    .replace(/(иями|ями|ами|ого|ему|ыми|ими|ой|ей|ою|ею|ий|ый|ая|яя|ое|ее|ых|их|ую|юю|ом|ем|ам|ям|ах|ях|а|я|ы|и|е|у|ю)$/u, "")
    .trim();
}

function personLooseKey(v: string) {
  return normalizePersonToken(v)
    .replace(/[ьъ]/g, "")
    .replace(/й/g, "и")
    .replace(/я/g, "а")
    .replace(/ё/g, "е")
    .replace(/[аеёиоуыэю]/g, "")
    .replace(/(.)\1+/g, "$1")
    .trim();
}

function personTokenScore(query: string, name: string) {
  const q = normalizePersonToken(query);
  const n = normalizePersonToken(name);
  if (!q || !n) return 0;
  if (q === n) return 5;
  if (n.startsWith(q) || q.startsWith(n)) return 4;

  const qLoose = personLooseKey(q);
  const nLoose = personLooseKey(n);
  if (qLoose && nLoose) {
    if (qLoose === nLoose || nLoose.startsWith(qLoose) || qLoose.startsWith(nLoose)) return 3;
    const looseMaxDist = Math.max(1, Math.floor(Math.max(qLoose.length, nLoose.length) / 3));
    if (levenshteinWithin(qLoose, nLoose, looseMaxDist) <= looseMaxDist) return 2;
  }

  const maxDist = Math.max(1, Math.floor(Math.max(q.length, n.length) / 3));
  if (levenshteinWithin(q, n, maxDist) <= maxDist) return 2;
  return 0;
}

function topSpecialistCandidates(phrase: string, specialists: SpecialistLite[], limit = 5) {
  const stop = new Set([
    "на",
    "в",
    "во",
    "к",
    "ко",
    "запиши",
    "записать",
    "записаться",
    "оформи",
    "оформить",
    "хочу",
    "мне",
    "меня",
    "пожалуйста",
    "плиз",
    "please",
    "сегодня",
    "завтра",
    "послезавтра",
    "утром",
    "днем",
    "днём",
    "вечером",
  ]);
  const qTokens = tokenizeForFuzzy(norm(phrase)).filter((t) => !stop.has(t));
  if (!qTokens.length) return [] as Array<{ entity: SpecialistLite; score: number }>;

  const scored = specialists
    .map((s) => {
      const nTokens = tokenizeForFuzzy(norm(s.name));
      let score = 0;
      for (const q of qTokens) {
        let best = 0;
        for (const n of nTokens) {
          const val = personTokenScore(q, n);
          if (val > best) best = val;
        }
        score += best;
      }
      return { entity: s, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  if (!scored.length) return [];

  const topScore = scored[0]!.score;
  // For single-token person requests (e.g. "к Юле") keep only strong matches when they exist,
  // otherwise unrelated names may pass through with loose phonetic score.
  const strictMin = qTokens.length === 1 ? (topScore >= 4 ? 4 : 3) : qTokens.length * 3;
  const cutoff = Math.max(strictMin, topScore - 1);
  return scored.filter((x) => x.score >= cutoff).slice(0, limit);
}
function extractRequestedSpecialistPhrase(messageNorm: string) {
  const m =
    /(?:^|\s)(?:к|ко)\s+([\p{L}-]{2,}(?:\s+[\p{L}-]{2,}){0,2})(?:\s|$)/iu.exec(messageNorm) ??
    /(?:мастер|специалист)(?:а|у)?\s+([\p{L}-]{2,}(?:\s+[\p{L}-]{2,}){0,2})(?:\s|$)/iu.exec(messageNorm);

  const raw = (m?.[1] ?? "").trim();
  if (!raw) return null;

  const cleaned = raw
    // Keep only specialist phrase and cut trailing intent fragments like "на маникюр", "в 12:00".
    .replace(/\s+(?:на|в|во|по|для)\s+.+$/iu, "")
    .replace(
      /\s+(?:сегодня|завтра|послезавтра|утром|днем|днём|вечером|\d{1,2}[:.]\d{2}|\d{1,2}[.]\d{1,2}(?:[.]\d{2,4})?)$/iu,
      "",
    )
    .replace(/\s+(?:запиш\p{L}*|оформи\p{L}*|пожалуйста|плиз|please)$/iu, "")
    .trim();

  if (!cleaned) return null;

  const stopFirstTokens = new Set([
    "вам",
    "тебе",
    "мне",
    "нам",
    "ему",
    "ей",
    "им",
    "сегодня",
    "завтра",
    "послезавтра",
    "утром",
    "днем",
    "днём",
    "вечером",
    "понедельник",
    "вторник",
    "среда",
    "среду",
    "четверг",
    "пятница",
    "пятницу",
    "суббота",
    "субботу",
    "воскресенье",
  ]);
  const first = tokenizeForFuzzy(cleaned)[0] ?? "";
  if (first && stopFirstTokens.has(first)) return null;
  if (/(запис\p{L}*|оформи\p{L}*|услуг\p{L}*|врем\p{L}*|дат\p{L}*)/iu.test(cleaned)) return null;

  return cleaned;
}
function isSpecialistDirectRequest(messageNorm: string) {
  return /(?:мастер|специалист|\bк\s+[\p{L}-]{2,}\b|\bко\s+[\p{L}-]{2,}\b)/iu.test(messageNorm);
}

function isLocationDirectRequest(messageNorm: string, locations: LocationLite[]) {
  const m = norm(messageNorm);
  if (/(филиал|локац|адрес)/i.test(m)) return true;

  const msgTokens = tokenizeForFuzzy(m);
  if (!msgTokens.length) return false;

  const locationTokens = new Set<string>();
  for (const loc of locations) {
    for (const token of tokenizeForFuzzy(loc.name)) locationTokens.add(token);
    for (const token of tokenizeForFuzzy(loc.address ?? "")) locationTokens.add(token);
  }
  if (!locationTokens.size) return false;

  for (const mt of msgTokens) {
    for (const lt of locationTokens) {
      if (mt === lt || mt.startsWith(lt) || lt.startsWith(mt)) return true;
      const maxDist = Math.max(1, Math.floor(Math.max(mt.length, lt.length) / 4));
      if (levenshteinWithin(mt, lt, maxDist) <= maxDist) return true;
    }
  }
  return false;
}

function looksLikeLocationChoice(messageNorm: string, locations: LocationLite[]) {
  return isLocationDirectRequest(messageNorm, locations) || /(?:^|\s)в\s+[\p{L}-]{3,}/iu.test(messageNorm);
}

function inferGenericServiceCandidates(messageNorm: string, services: ServiceLite[]) {
  const text = norm(messageNorm);
  const stop = new Set([
    "запиши",
    "записать",
    "записаться",
    "хочу",
    "мне",
    "меня",
    "пожалуйста",
    "нужно",
    "надо",
    "на",
    "в",
    "к",
    "сегодня",
    "завтра",
    "послезавтра",
    "утром",
    "вечером",
    "днем",
    "днём",
    "января",
    "февраля",
    "марта",
    "апреля",
    "мая",
    "июня",
    "июля",
    "августа",
    "сентября",
    "октября",
    "ноября",
    "декабря",
  ]);

  const queryTokens = tokenizeForFuzzy(text).filter((t) => !stop.has(t));
  if (!queryTokens.length) return [];

  const stem = (token: string) =>
    token
      .replace(/(иями|ями|ами|ого|ему|ыми|ими|ой|ей|ий|ый|ая|яя|ое|ее|ых|их|ую|юю|ом|ем|ам|ям|ах|ях|а|я|ы|и|е|у|ю)$/u, "")
      .trim();

  const tokenScore = (a: string, b: string) => {
    const aStem = stem(a);
    const bStem = stem(b);
    if (a === b || (aStem && bStem && aStem === bStem)) return 3;
    if (a.startsWith(b) || b.startsWith(a) || (aStem && bStem && (aStem.startsWith(bStem) || bStem.startsWith(aStem)))) return 2;
    const maxDist = Math.max(1, Math.floor(Math.max(a.length, b.length) / 4));
    return levenshteinWithin(a, b, maxDist) <= maxDist ? 1 : 0;
  };

  const scored = services
    .map((service) => {
      const nameTokens = tokenizeForFuzzy(norm(service.name));
      if (!nameTokens.length) return { service, score: 0, matched: 0, strongMatched: 0 };

      let score = 0;
      let matched = 0;
      let strongMatched = 0;
      for (const q of queryTokens) {
        let best = 0;
        for (const n of nameTokens) {
          const sc = tokenScore(q, n);
          if (sc > best) best = sc;
        }
        if (best > 0) matched += 1;
        if (best >= 2) strongMatched += 1;
        score += best;
      }

      return { service, score, matched, strongMatched };
    })
    .filter((x) => {
      if (queryTokens.length === 1) return x.strongMatched >= 1 || x.matched >= 1;
      return x.strongMatched >= Math.min(2, queryTokens.length) || x.score >= queryTokens.length * 2;
    })
    .sort((a, b) => b.score - a.score || b.strongMatched - a.strongMatched || b.matched - a.matched);

  return scored.map((x) => x.service);
}

function findRecentDateHint(nowYmd: string, recentMessages: Array<{ role: string; content: string }>) {
  for (const m of recentMessages.slice(0, 8)) {
    if (m.role !== "user") continue;
    const parsed = parseDate(m.content ?? "", nowYmd);
    if (parsed) return parsed;
  }
  return null;
}
function findRecentServiceHint(messageNorm: string, recentMessages: Array<{ role: string; content: string }>) {
  const candidates = [
    messageNorm,
    ...recentMessages
      .filter((m) => m.role === "user")
      .map((m) => norm(m.content ?? "")),
  ].filter(Boolean);

  for (const text of candidates) {
    const direct = extractRequestedServicePhrase(text);
    if (direct) return direct;
    if (mentionsServiceTopic(text) && looksLikeUnknownServiceRequest(text)) return text;
  }
  return null;
}

function isVagueRequestedServicePhrase(phrase: string | null | undefined) {
  const p = norm(phrase ?? "");
  if (!p) return false;
  if (
    /(какуюнибудь|какойнибудь|какую-нибудь|какой-нибудь|какую нибудь|какой нибудь|любую|любая|какую\s+услуг\p{L}*|какой\s+услуг\p{L}*|классн\p{L}*)/iu.test(
      p,
    )
  ) {
    return true;
  }
  const tokens = tokenizeForFuzzy(p);
  return tokens.length <= 2 && tokens.every((t) => /^(услуг\p{L}*|процедур\p{L}*|классн\p{L}*|лучш\p{L}*|люб\p{L}*)$/iu.test(t));
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
  specialists: SpecialistLite[];
  locations: LocationLite[];
}): Promise<{ handled: boolean; payload?: ResolutionPayload }> {
  const { shouldEnrichDraftForBooking, d, t, nlu, threadId, nextThreadKey, services, specialists, locations } = args;

  const scopedServices = services.filter((x) => (d.locationId ? x.locationIds.includes(d.locationId) : true));
  const serviceTextMatch = scopedServices.find((x) => t.includes(x.name.toLowerCase()));
  const nluServiceValid = Boolean(nlu?.serviceId && scopedServices.some((x) => x.id === nlu.serviceId));
  const nluServiceObj = nlu?.serviceId ? scopedServices.find((x) => x.id === nlu.serviceId) ?? null : null;
  const requestedServicePhrase = extractRequestedServicePhrase(t);
  const vagueRequestedService = isVagueRequestedServicePhrase(requestedServicePhrase);
  const nluServiceGrounded = isNluServiceGroundedByText(t, nluServiceObj);

  const deicticServiceReference = /(?:эту\s+услуг|эту\s+процедур|на\s+неё|на\s+нее|ту\s+же|this\s+service|that\s+service)/iu.test(t);

  const turnNorm = norm(t);
  const isSpecialistSelectionTurn = Boolean(
    turnNorm && specialists.some((s) => {
      const sn = norm(s.name);
      return sn === turnNorm || turnNorm.includes(sn) || sn.includes(turnNorm);
    }),
  );
  const isLocationSelectionTurn = Boolean(
    turnNorm && locations.some((l) => {
      const ln = norm(l.name);
      return ln === turnNorm || turnNorm.includes(ln) || ln.includes(turnNorm);
    }),
  );
  const isDateOrTimeTurn =
    /\b\d{1,2}[:.]\d{2}\b/.test(turnNorm) ||
    /\b\d{4}-\d{2}-\d{2}\b/.test(turnNorm) ||
    /\b\d{1,2}[.]\d{1,2}(?:[.]\d{4})?\b/.test(turnNorm) ||
    /(?:^|\s)(сегодня|завтра|послезавтра|утром|днем|днём|вечером)(?:\s|$)/iu.test(turnNorm);
  const isUiControlTurn =
    /^\s*(?:все\s+категории|категория:|все\s+уровни|уровень:|утро|день|вечер|показать\s+время|показать\s+услуги|показать\s+специалистов)\b/iu.test(turnNorm);
  const hasBookingDraftContext = Boolean(d.locationId || d.date || d.time || d.status === "COLLECTING" || d.status === "CHECKING");
  const bookingContextActive = shouldEnrichDraftForBooking || hasBookingDraftContext;

  const locationScoped = Boolean(d.locationId);
  const looksLikeStandaloneServiceLabel =
    /^[\p{L}\s\-]{4,}$/iu.test(turnNorm) &&
    turnNorm.split(/\s+/).length <= 4 &&
    !/(филиал|локац|адрес|время|слот|окошк|дата|сегодня|завтра|послезавтра|кто|мастер|специалист|до\s+скольки|график|работает|телефон|номер|спасибо|привет|пока|\b(?:да|нет|ок)\b)/iu.test(
      turnNorm,
    );
  const hasServiceLikePhrase = Boolean(requestedServicePhrase) || mentionsServiceTopic(t) || (locationScoped && looksLikeUnknownServiceRequest(t));
  const unknownServiceRequested =
    bookingContextActive &&
    !d.serviceId &&
    !serviceTextMatch &&
    !isSpecialistSelectionTurn &&
    !isLocationSelectionTurn &&
    !isDateOrTimeTurn &&
    !isUiControlTurn &&
    !vagueRequestedService &&
    (hasServiceLikePhrase || (locationScoped && looksLikeStandaloneServiceLabel)) &&
    (looksLikeUnknownServiceRequest(t) ||
      Boolean(requestedServicePhrase) ||
      (!!requestedServicePhrase && nluServiceValid && !nluServiceGrounded));

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
  nowYmd: string;
  t: string;
  d: any;
  threadId: number;
  nextThreadKey: string | null;
  locations: LocationLite[];
  services: ServiceLite[];
  specialists: SpecialistLite[];
  recentMessages?: Array<{ role: string; content: string }>;
}): Promise<{ handled: boolean; payload?: ResolutionPayload }> {
  const { shouldEnrichDraftForBooking, shouldRunBookingFlow, messageForRouting, nowYmd, d, threadId, nextThreadKey, locations, services, specialists, recentMessages = [] } = args;

  const messageNorm = norm(messageForRouting);
  const parsedDate = parseDate(messageForRouting, nowYmd);
  if (parsedDate && !d.date) d.date = parsedDate;
  if (!d.date && (d.specialistId || d.locationId || d.serviceId)) {
    const dateHint = findRecentDateHint(nowYmd, recentMessages);
    if (dateHint) d.date = dateHint;
  }
  const isExactSpecialistButtonChoice = !d.specialistId && specialists.some((s) => norm(s.name) === messageNorm);
  const isExactLocationButtonChoice = !d.locationId && locations.some((l) => norm(l.name) === messageNorm);
  if (!shouldEnrichDraftForBooking && !shouldRunBookingFlow && !isExactSpecialistButtonChoice && !isExactLocationButtonChoice) return { handled: false };
  const bookingLike = /(запиш\p{L}*|хочу|нужн[ао]?|бронь|оформи)/iu.test(messageNorm);
  const modeOrFinalizationCue = /(?:через\s+ассистента|самостоятельно|оформи\s+через\s+ассистента|оформи\s+сам|подтверждаю|согласен|согласна|даю\s+согласие)/iu.test(messageNorm);
  const hasDeepDraftContext = Boolean(
    d.serviceId ||
    d.date ||
    d.time ||
    d.mode ||
    d.status === "WAITING_CONFIRMATION" ||
    d.status === "WAITING_CONSENT",
  );
  const specialistScope = d.locationId ? specialists.filter((s) => s.locationIds.includes(d.locationId)) : specialists;

  if (!d.specialistId && ((bookingLike && isSpecialistDirectRequest(messageNorm)) || isExactSpecialistButtonChoice)) {
    const requestedSpecialist = extractRequestedSpecialistPhrase(messageNorm) ?? (isExactSpecialistButtonChoice ? messageNorm : null);
    if (requestedSpecialist) {
      const candidates = topSpecialistCandidates(requestedSpecialist, specialistScope, 6);
      if (candidates.length) {
        const top = candidates[0]!.entity;
        const topName = top.name;
        const exact = isExactMention(messageNorm, topName);
        const highConfidenceSingle = candidates.length === 1 && (candidates[0]?.score ?? 0) >= 4;
        if (exact || highConfidenceSingle) {
          d.specialistId = top.id;
        } else {
          const options = dedupeOptions(candidates.map((x) => specialistQuickOption(x.entity)));
          const reply = candidates.length > 1
            ? "Нашла несколько подходящих специалистов. Выберите вариант ниже."
            : `Правильно поняла, Вы имели в виду специалиста «${topName}»? Выберите вариант ниже.`;
          const payload = await persistClarificationAndBuildPayload({
            threadId,
            nextThreadKey,
            reply,
            ui: { kind: "quick_replies", options },
            d,
          });
          return { handled: true, payload };
        }
      } else if (specialistScope.length) {
        const shortlist = specialistScope;
        const options = dedupeOptions(shortlist.map((x) => specialistQuickOption(x)));
        const reply = "Не распознала специалиста в запросе. Выберите, пожалуйста, нужного специалиста кнопкой ниже.";
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
      const choosingLocationNow =
        isExactLocationButtonChoice ||
        looksLikeLocationChoice(messageNorm, specialistLocations);

      if (choosingLocationNow) {
        const candidates = topEntityCandidates(messageNorm, specialistLocations, (l) => [l.name, l.address ?? ""], 4);
        if (candidates.length) {
          const top = candidates[0]!.entity;
          const exact = isExactMention(messageNorm, top.name);
          if (exact) {
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

      if (!d.locationId) {
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
  }
  if (d.locationId && bookingLike && !modeOrFinalizationCue && !hasDeepDraftContext) {
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

  if (!d.locationId && ((bookingLike && looksLikeLocationChoice(messageNorm, locations)) || isExactLocationButtonChoice)) {
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
      if (exact) {
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
  if (d.specialistId && d.locationId && !d.serviceId) {
    const serviceHint = findRecentServiceHint(messageNorm, recentMessages);
    if (serviceHint) {
      const hintNorm = norm(serviceHint);
      const genericFromHint = inferGenericServiceCandidates(hintNorm, scopedServices);
      if (genericFromHint.length === 1) {
        d.serviceId = genericFromHint[0]!.id;
      } else if (genericFromHint.length > 1) {
        const payload = await persistClarificationAndBuildPayload({
          threadId,
          nextThreadKey,
          reply: "Уточните, пожалуйста, услугу. По вашему запросу нашла подходящие варианты:",
          ui: { kind: "quick_replies", options: dedupeOptions(genericFromHint.map(serviceQuickOption)) },
          d,
        });
        return { handled: true, payload };
      }
    }
  }

  if (d.serviceId && bookingLike && !modeOrFinalizationCue && !hasDeepDraftContext) {
    const selectedService = services.find((s) => s.id === d.serviceId) ?? null;
    if (selectedService && !isExactMention(messageNorm, selectedService.name)) {
      const exactAnyServiceMention = scopedServices.some((s) => isExactMention(messageNorm, s.name));
      const generic = inferGenericServiceCandidates(messageNorm, scopedServices);
      if (!exactAnyServiceMention && generic.length > 1) {
        d.serviceId = null;
        d.time = null;
        const reply = "Уточните, пожалуйста, какая услуга нужна. Нашла несколько подходящих вариантов:";
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
    const isVagueRequestedService = isVagueRequestedServicePhrase(requested);
    const targetPhrase = requested ? norm(requested) : messageNorm;

    const generic = inferGenericServiceCandidates(targetPhrase, scopedServices);
    if (generic.length > 1) {
      const reply = "Уточните, пожалуйста, какая услуга нужна. Нашла несколько подходящих вариантов:";
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

    if (requested && isVagueRequestedService) {
      const reply = "С удовольствием подберу услугу. Выберите вариант ниже, и продолжу запись.";
      const options = dedupeOptions((scopedServices.length ? scopedServices : services).map(serviceQuickOption));
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

