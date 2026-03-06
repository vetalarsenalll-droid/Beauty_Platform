import type { ChatUi } from "@/lib/booking-flow";
import { formatServiceQuickLabel, formatSpecialistQuickLabel } from "@/lib/booking-tools";
import type { DraftLike, LocationLite, ServiceLite, SpecialistLite } from "@/lib/booking-tools";
import type { AishaIntent } from "@/lib/dialog-policy";
import type { AishaNluIntent } from "@/lib/aisha-orchestrator";

const norm = (v: string) =>
  v
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^\p{L}\p{N}\s:.+\-/]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
const has = (m: string, r: RegExp) => r.test(norm(m));

const NLU_INTENT_CONFIDENCE_THRESHOLD = 0.38;
const NLU_INTENT_CONFIDENCE_CRITICAL_THRESHOLD = 0.52;

export function hasExplicitConsentGrant(message: string) {
  const t = norm(message);
  if (/(?:\bне\s+соглас|без\s+соглас|не\s+даю\s+соглас)/i.test(t)) return false;
  return /(?:^|\s)(согласен|согласна|даю\s+согласие|согласие\s+на\s+обработку\s+персональных\s+данных)(?:\s|$)/i.test(t);
}

export function tokenizeForFuzzy(v: string) {
  return norm(v)
    .split(/\s+/)
    .map((x) => x.trim())
    .filter((x) => x.length >= 3);
}

export function levenshteinWithin(a: string, b: string, maxDist: number) {
  if (a === b) return 0;
  const al = a.length;
  const bl = b.length;
  if (!al || !bl) return Math.max(al, bl);
  if (Math.abs(al - bl) > maxDist) return maxDist + 1;

  const prev = new Array(bl + 1);
  const curr = new Array(bl + 1);
  for (let j = 0; j <= bl; j += 1) prev[j] = j;

  for (let i = 1; i <= al; i += 1) {
    curr[0] = i;
    let rowMin = curr[0];
    for (let j = 1; j <= bl; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const del = prev[j] + 1;
      const ins = curr[j - 1] + 1;
      const sub = prev[j - 1] + cost;
      const val = Math.min(del, ins, sub);
      curr[j] = val;
      if (val < rowMin) rowMin = val;
    }
    if (rowMin > maxDist) return maxDist + 1;
    for (let j = 0; j <= bl; j += 1) prev[j] = curr[j];
  }
  return prev[bl];
}

export function bestFuzzyEntity<T>(messageNorm: string, entities: T[], valuesForEntity: (entity: T) => string[]) {
  const msgTokens = tokenizeForFuzzy(messageNorm);
  if (!msgTokens.length || !entities.length) return null;

  let best: { entity: T; score: number } | null = null;
  let secondScore = -1;

  for (const entity of entities) {
    const entityValues = valuesForEntity(entity).map((x) => norm(x)).filter(Boolean);
    if (!entityValues.length) continue;

    let score = 0;
    for (const raw of entityValues) {
      if (raw && messageNorm.includes(raw)) score += 4;
      const entityTokens = tokenizeForFuzzy(raw);
      for (const mt of msgTokens) {
        for (const et of entityTokens) {
          if (mt === et) {
            score += 2;
            continue;
          }
          const maxDist = Math.max(1, Math.floor(Math.max(mt.length, et.length) / 5));
          const dist = levenshteinWithin(mt, et, maxDist);
          if (dist <= maxDist) score += 1;
        }
      }
    }

    if (!best || score > best.score) {
      secondScore = best ? best.score : -1;
      best = { entity, score };
    } else if (score > secondScore) {
      secondScore = score;
    }
  }

  if (!best) return null;
  if (best.score < 2) return null;
  if (secondScore >= 0 && best.score - secondScore < 1) return null;
  return best.entity;
}

export function hasBookingVerbTypo(messageNorm: string) {
  const tokens = tokenizeForFuzzy(messageNorm);
  return tokens.some((t) => {
    if (/^запис\p{L}*$/iu.test(t)) return true;
    if (!t.startsWith("зап")) return false;
    const dist = levenshteinWithin(t, "запиши", 2);
    return dist <= 2;
  });
}
export function locationByText(messageNorm: string, locations: LocationLite[]) {
  const matches = locations.filter((x) => {
    const ln = norm(x.name);
    const ad = norm(x.address ?? "");
    return messageNorm.includes(ln) || (ad && messageNorm.includes(ad));
  });
  if (matches.length === 1) return matches[0]!;
  const fuzzy = bestFuzzyEntity(messageNorm, locations, (x) => [x.name, x.address ?? ""]);
  return fuzzy ?? null;
}

export function serviceByText(messageNorm: string, services: ServiceLite[]) {
  const hasMale = /(муж)/i.test(messageNorm);
  const hasFemale = /(жен)/i.test(messageNorm);
  const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const directExact = services.find((x) => {
    const serviceName = norm(x.name);
    return serviceName.length > 0 && messageNorm === serviceName;
  });
  if (directExact) return directExact;
  const byBoundary = services
    .slice()
    .sort((a, b) => norm(b.name).length - norm(a.name).length)
    .find((x) => {
      const serviceName = norm(x.name);
      if (!serviceName) return false;
      return new RegExp(`\\b${escapeRegExp(serviceName)}\\b`, "i").test(messageNorm);
    });
  const direct = byBoundary ?? services.find((x) => messageNorm.includes(norm(x.name)));
  if (direct) return direct;
  if (hasMale || hasFemale) {
    const gendered = services.find((x) => {
      const n = norm(x.name);
      if (hasMale && /(муж)/i.test(n)) return true;
      if (hasFemale && /(жен)/i.test(n)) return true;
      return false;
    });
    if (gendered) return gendered;
    return null;
  }
  if (/гель/.test(messageNorm)) return services.find((x) => /gel polish|гель/.test(norm(x.name))) ?? null;
  if (/(пилинг|peeling)/i.test(messageNorm)) return services.find((x) => /(пилинг|peeling)/i.test(norm(x.name))) ?? null;
  if (/педик/.test(messageNorm)) return services.find((x) => /педик/.test(norm(x.name))) ?? null;
  if (/маник/.test(messageNorm)) return services.find((x) => /маник/.test(norm(x.name))) ?? null;
  if (/(ресниц|lashes|lash)/i.test(messageNorm)) return services.find((x) => /(ресниц|lashes|lash)/i.test(norm(x.name))) ?? null;
  if (/(бров|brow)/i.test(messageNorm)) return services.find((x) => /(бров|brow)/i.test(norm(x.name))) ?? null;
  const fuzzy = bestFuzzyEntity(messageNorm, services, (x) => [x.name, x.categoryName ?? "", x.description ?? ""]);
  return fuzzy ?? null;
}

export function asksCurrentDate(text: string) {
  return has(text, /(какое число|какое сегодня число|какое число сегодня|какая сегодня дата|какой сегодня день|what date is it|today date)/i);
}

export function asksCurrentTime(text: string) {
  return has(text, /(который час|сколько времени|какое сейчас время|current time|what time is it)/i);
}

export function asksCurrentDateTime(text: string) {
  return asksCurrentDate(text) || asksCurrentTime(text) || has(text, /(какое сейчас число и время|date and time)/i);
}

export function asksDraftServiceQuestion(text: string) {
  return has(text, /(на какую услуг|какая у меня услуг|какую услуг.*записыва|что за услуг.*записыва|на что ты меня записываешь)/i);
}

export function asksClientOwnName(text: string) {
  return has(text, /(как меня зовут|меня как зовут|знаешь как меня зовут|мое имя|моё имя|кто я)/i);
}

export function asksClientRecognition(text: string) {
  return has(text, /(меня знаешь|знаешь меня|помнишь меня|узнаешь меня|узнаёшь меня|я у тебя есть|есть ли я в базе)/i);
}

export function isGreetingText(text: string) {
  return has(
    text,
    /^(привет|приветик|приветули|привет-привет|здравствуй|здраствуй|здравствуйте|здорово|здарова|добрый день|добрый вечер|hello|hi|hey|хай)\b/i,
  );
}

export function smalltalkVariant(messageNorm: string, variants: string[]) {
  if (!variants.length) return "";
  let hash = 0;
  for (let i = 0; i < messageNorm.length; i += 1) {
    hash = (hash * 31 + messageNorm.charCodeAt(i)) >>> 0;
  }
  return variants[hash % variants.length] ?? variants[0] ?? "";
}

export function hasAnyPhrase(messageNorm: string, phrases: string[]) {
  return phrases.some((p) => messageNorm.includes(p));
}

export function buildSmalltalkReply(messageNorm: string) {
  if (asksWhyNoAnswer(messageNorm)) {
    return "Не игнорирую вас. Иногда отвечаю слишком коротко, но сейчас в диалоге и готова продолжить.";
  }

  if (isPauseConversationMessage(messageNorm)) {
    return "Хорошо, без проблем. Я на связи, когда захотите продолжить.";
  }
  if (
    hasAnyPhrase(messageNorm, [
      "как у тебя дела",
      "как у вас дела",
      "как дела",
      "как жизнь",
      "как поживаешь",
      "как ты",
    ])
  ) {
    if (/(мысл|цитат|сказк|истори|мудр)/i.test(messageNorm)) {
    return "Если хотите, эту мысль можно продолжить на практике: бережный ритуал ухода и немного времени для себя. Подберу удобный слот, когда Вам комфортно.";
  }
  return smalltalkVariant(messageNorm, [
      "Спасибо, всё хорошо. Я на связи и готова помочь с записью.",
      "Спасибо, отлично. Если хотите, могу сразу подобрать удобное время.",
      "Всё хорошо, спасибо. Помогу с услугами и записью, когда вам удобно.",
    ]);
  }

  if (
    hasAnyPhrase(messageNorm, [
      "чем занимаешься",
      "что делаешь",
      "чем занята",
      "чем ты занимаешься",
    ])
  ) {
    return smalltalkVariant(messageNorm, [
      "Помогаю с записью: подбираю услуги, время, специалиста и оформляю запись.",
      "Я веду запись клиентов: услуги, даты, время, специалисты и подтверждение записи.",
      "Помогаю выбрать услугу, найти свободное окно и довести запись до оформления.",
    ]);
  }

  if (hasAnyPhrase(messageNorm, ["спасибо", "благодарю", "благодарствую"])) {
    return smalltalkVariant(messageNorm, [
      "Пожалуйста. Если нужно, помогу с записью.",
      "Рада помочь. Если хотите, продолжим подбор времени.",
      "Всегда пожалуйста. Могу сразу перейти к выбору даты и времени.",
    ]);
  }

  if (hasAnyPhrase(messageNorm, ["круто", "здорово", "супер", "класс", "отлично", "прекрасно"])) {
    return smalltalkVariant(messageNorm, [
      "Здорово. Если хотите, продолжим и подберем удобное время.",
      "Отлично. Могу предложить ближайшие свободные слоты.",
      "Супер. Если готовы, продолжим оформление записи.",
    ]);
  }

  return smalltalkVariant(messageNorm, [
    "Поняла вас. Могу продолжить разговор и, когда захотите, помочь с записью: услуга, дата, время или специалист.",
    "Я на связи. Могу помочь с услугами, временем и оформлением записи.",
    "Готова помочь с записью. Напишите, что вам удобнее: услуга, дата или время.",
  ]);
}

export function formatYmdRu(ymd: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return ymd;
  return `${m[3]}.${m[2]}.${m[1]}`;
}

export function sanitizeAssistantReplyText(reply: string) {
  return reply
    .replace(/подсобить/gi, "помочь")
    .replace(/подсоблю/gi, "помогу")
    .replace(/подсобишь/gi, "поможешь")
    .replace(/подсобите/gi, "помогу")
    .replace(/для тебя/gi, "для вас")
    .replace(/\bты\b/gi, "вы")
    .replace(/\bтебе\b/gi, "вам")
    .replace(/\bтебя\b/gi, "вас")
    .replace(/\bтобой\b/gi, "вами")
    .replace(/\bтвой\b/gi, "ваш")
    .replace(/\bтвоя\b/gi, "ваша")
    .replace(/\bтвое\b/gi, "ваше")
    .replace(/\bтвои\b/gi, "ваши")
    .replace(/\bтвоего\b/gi, "вашего")
    .replace(/\bтвоей\b/gi, "вашей")
    .replace(/\bтвою\b/gi, "вашу")
    .replace(/\bтвоим\b/gi, "вашим")
    .replace(/\bтвоими\b/gi, "вашими")
    .replace(/\bтвоем\b/gi, "вашем")
    .replace(/выбирай/gi, "выберите")
    .replace(/выбери/gi, "выберите")
    .replace(/выберитете/gi, "выберите")
    .replace(/спрашивай/gi, "спрашивайте")
    .replace(/задавай/gi, "задавайте")
    .replace(/напиши/gi, "напишите")
    .replace(/пиши/gi, "пишите")
    .replace(/смотри/gi, "смотрите")
    .replace(/переходи/gi, "переходите")
    .replace(/обращайся/gi, "обращайтесь")
    .replace(/подберем/gi, "подберу")
    .replace(/какую именно услугу вам нужно записать/gi, "на какую именно услугу вас нужно записать")
    .replace(/какую услугу вам нужно записать/gi, "на какую услугу вас нужно записать")
    .replace(/Как могу помочь\./g, "Как могу помочь?")
    .replace(/\p{Extended_Pictographic}/gu, "")
    .replace(/\s+([,.;!?])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function serviceQuickOption(service: ServiceLite) {
  return {
    label: formatServiceQuickLabel(service),
    value: service.name,
  };
}

export function specialistQuickOption(specialist: SpecialistLite) {
  return {
    label: formatSpecialistQuickLabel(specialist),
    value: specialist.name,
  };
}

export function parseServiceCategoryFilter(message: string): string | "__all__" | null {
  const m = /^\s*категория:\s*(.+?)\s*$/iu.exec(message);
  if (!m?.[1]) return null;
  const value = m[1].trim();
  if (!value || /^(все|все категории)$/iu.test(value)) return "__all__";
  return value;
}

export function parseSpecialistLevelFilter(message: string): string | "__all__" | null {
  const m = /^\s*уровень:\s*(.+?)\s*$/iu.exec(message);
  if (!m?.[1]) return null;
  const value = m[1].trim();
  if (!value || /^(все|все уровни)$/iu.test(value)) return "__all__";
  return value;
}

export function uniqueServiceCategories(services: ServiceLite[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of services) {
    const raw = (s.categoryName ?? "").trim();
    if (!raw) continue;
    const key = norm(raw);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(raw);
  }
  return out;
}

export function uniqueSpecialistLevels(specialists: SpecialistLite[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of specialists) {
    const raw = (s.levelName ?? "").trim();
    if (!raw) continue;
    const key = norm(raw);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(raw);
  }
  return out;
}

export function filterServicesByCategory(services: ServiceLite[], selected: string | "__all__" | null) {
  if (!selected || selected === "__all__") return services;
  const selectedNorm = norm(selected);
  return services.filter((s) => norm((s.categoryName ?? "").trim()) === selectedNorm);
}

export function filterSpecialistsByLevel(specialists: SpecialistLite[], selected: string | "__all__" | null) {
  if (!selected || selected === "__all__") return specialists;
  const selectedNorm = norm(selected);
  return specialists.filter((s) => norm((s.levelName ?? "").trim()) === selectedNorm);
}

export function serviceCategoryTabOptions(services: ServiceLite[]) {
  const categories = uniqueServiceCategories(services);
  return [
    { label: "Все категории", value: "категория: Все категории" },
    ...categories.map((cat) => ({ label: cat, value: `категория: ${cat}` })),
  ];
}

export function specialistLevelTabOptions(specialists: SpecialistLite[]) {
  const levels = uniqueSpecialistLevels(specialists);
  return [
    { label: "Все уровни", value: "уровень: Все уровни" },
    ...levels.map((lvl) => ({ label: lvl, value: `уровень: ${lvl}` })),
  ];
}

export function serviceOptionsWithTabs(servicesAll: ServiceLite[], servicesShown: ServiceLite[]) {
  return [...serviceCategoryTabOptions(servicesAll), ...servicesShown.map(serviceQuickOption)];
}

export function specialistOptionsWithTabs(specialistsAll: SpecialistLite[], specialistsShown: SpecialistLite[]) {
  return [...specialistLevelTabOptions(specialistsAll), ...specialistsShown.map(specialistQuickOption)];
}

export function hasKnownServiceNameInText(text: string, services: ServiceLite[]) {
  const replyNorm = norm(text);
  return services.some((s) => {
    const serviceNorm = norm(s.name);
    if (!serviceNorm) return false;
    if (replyNorm.includes(serviceNorm)) return true;
    const tokens = serviceNorm.split(/\s+/).filter((t) => t.length >= 4);
    return tokens.some((t) => replyNorm.includes(t));
  });
}

export function looksLikeServiceClaimInReply(text: string) {
  const replyNorm = norm(text);
  return (
    /(у нас (есть|доступн)|можем записать|можем сделать|доступные услуги|вот наши услуги|предлагаем услуги|услуги:|вас интересует процедура|могу подобрать мастера)/i.test(replyNorm) &&
    /(маник|педик|стриж|гель|окраш|тату|татуир|массаж|макияж|визаж|укладк|чистк|депиля|эпиля|лиц|бров)/i.test(replyNorm)
  );
}

export function extractLikelyFullNames(text: string) {
  const matches = text.match(/\b\p{Lu}\p{Ll}{2,}\s+\p{Lu}\p{Ll}{2,}\b/gu) ?? [];
  return [...new Set(matches.map((x) => x.trim()))];
}

export function hasUnknownPersonNameInReply(args: {
  reply: string;
  specialists: SpecialistLite[];
  knownClientName?: string | null;
  assistantName: string;
}) {
  const { reply, specialists, knownClientName, assistantName } = args;
  const blockedWords = new Set(["beauty", "salon", "center", "riverside", "studio", "crm", "aisha"]);
  const knownNames = new Set(
    [
      ...specialists.map((s) => norm(s.name)),
      knownClientName ? norm(knownClientName) : null,
      norm(assistantName),
    ].filter((x): x is string => Boolean(x && x.trim())),
  );
  for (const candidate of extractLikelyFullNames(reply)) {
    const candidateNorm = norm(candidate);
    if (!candidateNorm) continue;
    if (knownNames.has(candidateNorm)) continue;
    const words = candidateNorm.split(/\s+/).filter(Boolean);
    if (words.some((w) => blockedWords.has(w))) continue;
    return true;
  }
  return false;
}

export function looksLikeSensitiveLeakReply(text: string) {
  const t = norm(text);
  return /(system prompt|internal prompt|hidden instruction|internal instruction|api key|token|access key|secret|password|ignore.*instruction|jailbreak)/i.test(t);
}

export function isServiceInquiryMessage(rawMessage: string, messageNorm: string) {
  const hasServiceWord = /(маник|педик|стриж|гель|окраш|facial|peeling|haircut)/i.test(messageNorm);
  if (!hasServiceWord) return false;
  const asks = /(есть|нет|имеется|доступн|а .* нет)/i.test(messageNorm);
  const questionMark = rawMessage.includes("?");
  return asks || questionMark;
}

export function looksLikeUnknownServiceRequest(messageNorm: string) {
  if (/(филиал|локац|центр|riverside|beauty salon|\d{1,2}[:.]\d{2})/i.test(messageNorm)) return false;
  if (/(какие услуги|что по услугам|прайс|каталог|список услуг)/i.test(messageNorm)) return false;
  if (/[?]/.test(messageNorm)) return false;
  if (/^(это|а это|что это|как это|почему|зачем|кто|где|когда|я спросил|я спросила|расскажи|объясни|обьясни|можешь)\b/i.test(messageNorm)) return false;
  if (/(хочу|нужн[ао]?|запиши|записаться|на)\s+[\p{L}\s\-]{4,}/iu.test(messageNorm)) return true;
  // Plain phrase like "удаление зуба" during booking step should still be treated as a service request.
  if (/^[\p{L}\s\-]{4,}$/iu.test(messageNorm) && messageNorm.split(/\s+/).length <= 4) {
    if (!mentionsServiceTopic(messageNorm)) return false;
    if (/(привет|здравств|спасибо|пока|да|нет|ок|оке|окей|дальше|проверь|почему)/i.test(messageNorm)) return false;
    return true;
  }
  return false;
}

export function asksServiceExistence(messageNorm: string) {
  const hasBeautyToken =
    /(маник|педик|гель|стриж|окраш|ресниц|бров|эпил|депил|депел|лазер|массаж|чистк|пилинг|макияж|визаж|лиц|уход\s+за\s+лиц|тату|татуир|peeling|facial|haircut|coloring|tattoo|бикин|консультац|мужск|женск|мужчин|женщин|бород|ус[ао]м)/i.test(
      messageNorm,
    );
  const asks = /(есть|имеется|делаете|делаешь|можно|доступн)/i.test(messageNorm);
  return hasBeautyToken && asks;
}

export function asksNearestAvailability(messageNorm: string) {
  return /((ближайш|свобод).*(окошк|окно|слот|время)|(окошк|окно|слот|время).*(ближайш|свобод)|когда.*(ближайш|свобод))/i.test(
    messageNorm,
  );
}

export function asksAvailabilityPeriod(messageNorm: string) {
  return /(?:после\s+\d{1,2}\s+(?:января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)|весь\s+месяц|до\s+конца\s+месяца|в\s+этом\s+месяце|в\s+течение\s+месяца|по\s+месяцу)/i.test(
    messageNorm,
  );
}

export function asksGenderSuitability(messageNorm: string) {
  const asks = /(подход|для парн|для мужчин|для мужик|для девуш|для женщин|и женск|и мужск|тоже подход)/i.test(messageNorm);
  return asks;
}

export function asksGenderedServices(messageNorm: string) {
  return /(мужские услуги|женские услуги|услуги для мужчин|услуги для женщин|для мужчин что есть|для парня что есть|для девушки что есть)/i.test(
    messageNorm,
  );
}

export function asksServicesFollowUp(messageNorm: string, lastAssistantText: string, previousUserText: string) {
  const asks = /(какие именно есть|какие именно|что именно есть|а какие есть|и какие есть|что есть|пришли список|покажи список|скинь список|список услуг)/i.test(
    messageNorm,
  );
  if (!asks) return false;
  const context = `${lastAssistantText} ${previousUserText}`.toLowerCase();
  const serviceContext = /(услуг|услуга|каталог|прайс|маник|педик|стриж|гель|окраш|пилинг|тату)/i.test(context);
  const capabilitiesContext = /(что умеешь|чем занимаешься|что ты можешь|а что ты можешь)/i.test(previousUserText);
  return serviceContext || capabilitiesContext;
}

export function hasKnownLocationNameInText(text: string, locations: LocationLite[]) {
  const replyNorm = norm(text);
  return locations.some((loc) => {
    const locNorm = norm(loc.name);
    return !!locNorm && replyNorm.includes(locNorm);
  });
}

export function looksLikeLocationClaimInReply(text: string) {
  const replyNorm = norm(text);
  return /(салон|филиал|локац|адрес|на невск|на московск|на петроград|на каменноостров)/i.test(replyNorm);
}

export function asksLocationsFollowUp(messageNorm: string, lastAssistantText: string, previousUserText: string) {
  const asks = /(а какие есть|какие есть|какие именно|покажи|список)/i.test(messageNorm);
  if (!asks) return false;
  const context = `${lastAssistantText} ${previousUserText}`.toLowerCase();
  return /(салон|филиал|локац|адрес|где находит)/i.test(context);
}

export function mentionsServiceTopic(messageNorm: string) {
  return /(услуг|услуга|маник|педик|гель|стриж|окраш|макияж|визаж|лиц|уход\s+за\s+лиц|тату|татуир|ресниц|бров|эпил|депил|депел|лазер|массаж|пилинг|консультац|бород|ус[ао]м)/i.test(
    messageNorm,
  );
}

export function isServiceComplaintMessage(messageNorm: string) {
  const hasComplaint =
    /(не понрав|не устро|плох|плах|ужас|недовол|испорти|сделал[аи]?\s+плох|сделал[аи]?\s+плах|жалоб|претензи|обслуживание.*не понрав|криво|больно)/i.test(
      messageNorm,
    );
  const hasServiceOrSpecialist =
    mentionsServiceTopic(messageNorm) ||
    /(мастер|специалист|сотрудник|ольг|ирин|анн|мария|павел|дмитрий|сергей|елена)/i.test(messageNorm);
  return hasComplaint && hasServiceOrSpecialist;
}

export function asksAssistantQualification(messageNorm: string) {
  return /(ты\s+квалифицированный\s+сотрудник|ты\s+сотрудник|ты\s+человек|реальный\s+человек|живой\s+человек)/i.test(
    messageNorm,
  );
}

export function isOutOfDomainPrompt(messageNorm: string) {
  return /(анекдот|шутк|космос|политик|футбол|баскетбол|курс валют|биткоин|погода в|новости мира|кеннед|кеннеди|кенеди|пушкин|пушкина)/i.test(
    messageNorm,
  );
}

export function isGeneralQuestionOutsideBooking(messageNorm: string) {
  const hasQuestionCue =
    messageNorm.includes("?") ||
    /^(кто|что|почему|зачем|как|сколько|где|когда|какой|какая|какие|какую)\b/i.test(messageNorm);
  if (!hasQuestionCue) return false;

  const bookingOrAccountCue =
    /(запис|бронь|слот|окошк|время|дата|услуг|мастер|специалист|филиал|локац|адрес|телефон|номер|мой|мои|статист|отмени|перенеси|профил|кабинет|консультац)/i.test(
      messageNorm,
    );
  return !bookingOrAccountCue;
}

export function isPauseConversationMessage(messageNorm: string) {
  return /(пока ничего|ничего не хочу|пока не хочу|не хочу сейчас|потом|позже|не сейчас|ладно потом)/i.test(messageNorm);
}

export function asksWhyNoAnswer(messageNorm: string) {
  return /(почему не ответил|почему не ответила|почему ты не ответил|почему ты не ответила|а на вопрос почему не ответила)/i.test(messageNorm);
}

export function looksLikeHardBookingPushReply(replyText: string) {
  const r = norm(replyText);
  return /(выберите\s+(филиал|локац|услуг|дат|врем)|продолжу\s+запис|подберу\s+время|запишу\s+вас)/i.test(r);
}

export function buildOutOfScopeConversationalReply(messageNorm: string) {
  if (asksWhyNoAnswer(messageNorm)) {
    return "Я не игнорирую вас. По темам вне записи отвечаю коротко и без выдумок. Можем продолжить разговор или перейти к записи.";
  }
  if (/(кто убил кеннед|убил кенеди|убийств.*кеннед)/i.test(messageNorm)) {
    return "По официальной версии Ли Харви Освальд. Если хотите, коротко расскажу и альтернативные версии без споров.";
  }
  if (/(кто убил пушкин|убил пушкина|гибел[ьи].*пушкин)/i.test(messageNorm)) {
    return "Александр Пушкин был смертельно ранен на дуэли с Жоржем Дантесом в 1837 году.";
  }
  if (/(сам(ая|ый).*(больш|крупн).*(планет)|какая.*сам.*больш.*планет|какая.*больш.*из\s+них)/i.test(messageNorm)) {
    return "Самая большая планета Солнечной системы — Юпитер.";
  }
  if (isPauseConversationMessage(messageNorm)) {
    return "Хорошо, без проблем. Я на связи, когда будете готовы продолжить.";
  }
  return smalltalkVariant(messageNorm, [
    "Поняла вас. Давайте продолжим разговор: отвечу по теме и, если захотите, мягко перейдем к записи.",
    "Я на связи. Если хотите, продолжим разговор или перейдем к записи.",
    "Могу отвечать кратко по теме и, если нужно, помочь с записью.",
  ]);
}

export function isGenericBookingTemplateReply(text: string) {
  const t = norm(text);
  return /(ассистент\s+записи.*чем\s+помочь|чем\s+помочь.*ассистент\s+записи)/i.test(t);
}

export function isBookingOrAccountCue(messageNorm: string) {
  if (hasBookingVerbTypo(messageNorm)) return true;
  return /(запис|запиг|бронь|слот|окошк|время|дата|услуг|мастер|спец|специал|специалист|филиал|локац|адрес|телефон|номер|мой|мои|статист|отмени|перенеси|профил|кабинет|консультац|цена|прайс|стоим)/i.test(
    messageNorm,
  );
}

export function isLikelyNonBookingTurn(messageNorm: string) {
  if (!messageNorm) return false;
  if (isBookingOrAccountCue(messageNorm)) return false;
  if (isOutOfDomainPrompt(messageNorm) || isGeneralQuestionOutsideBooking(messageNorm)) return true;
  if (isPauseConversationMessage(messageNorm) || asksWhyNoAnswer(messageNorm)) return true;
  if (/^(да|ага|угу|ок|окей|ладно|понятно|ясно|еще|ещё|и что|продолжай|ну)$/i.test(messageNorm)) return true;
  if (/\b(давай|расскажи|подробнее|объясни|обьясни)\b/i.test(messageNorm)) return true;
  if (/\b(а\s+)?какие\s+есть\b/i.test(messageNorm)) return true;
  if (/^(что дальше|и дальше|ещё подробнее|еще подробнее)$/i.test(messageNorm)) return true;
  return false;
}

export function countConsecutiveNonBookingUserTurns(recentMessages: Array<{ role: string; content: string }>) {
  let count = 0;
  for (const m of recentMessages) {
    if (m.role !== "user") continue;
    const messageNorm = norm(m.content ?? "");
    if (isLikelyNonBookingTurn(messageNorm)) {
      count += 1;
      continue;
    }
    break;
  }
  return count;
}

export function buildBookingBridgeFallback(
  messageNorm: string,
  hints?: { serviceName?: string | null; date?: string | null; timePreference?: "morning" | "day" | "evening" | null },
) {
  if (hints?.serviceName) {
    return `Если хотите, подберу запись на «${hints.serviceName}» в удобное для вас время.`;
  }
  if (hints?.date) {
    return `Если хотите, могу подобрать удобную запись на ${formatYmdRu(hints.date)}.`;
  }
  if (hints?.timePreference === "morning") {
    return "Если хотите, подберу удобные утренние слоты для записи.";
  }
  if (hints?.timePreference === "evening") {
    return "Если хотите, подберу удобные вечерние слоты для записи.";
  }
  if (hints?.timePreference === "day") {
    return "Если хотите, подберу удобные дневные слоты для записи.";
  }
  return smalltalkVariant(messageNorm, [
    "Если хотите, могу сразу подобрать удобную запись: услугу, дату и время.",
    "Если удобно, перейдем к записи и найдем подходящее время.",
    "Могу помочь сразу оформить запись на удобный день и время.",
  ]);
}

export function buildBookingReengageUi(args: { locations: LocationLite[]; services: ServiceLite[]; focusDate?: string | null }): ChatUi {
  const dateLabel = args.focusDate ? formatYmdRu(args.focusDate) : null;
  const options: Array<{ label: string; value: string }> = [];

  if (dateLabel) {
    options.push({ label: `Показать время на ${dateLabel}`, value: `покажи время на ${dateLabel}` });
    options.push({ label: `Показать услуги на ${dateLabel}`, value: `какие услуги доступны на ${dateLabel}` });
    options.push({ label: `Показать специалистов на ${dateLabel}`, value: `какие специалисты доступны на ${dateLabel}` });
  } else {
    options.push({ label: "Записаться сегодня", value: "запиши меня сегодня" });
    options.push({ label: "Показать время", value: "покажи свободное время" });
    options.push({ label: "Показать услуги", value: "какие у вас есть услуги" });
    options.push({ label: "Показать специалистов", value: "какие специалисты у вас есть" });
  }

  if (args.locations.length > 1) {
    options.push({ label: "Показать локации", value: "покажи филиалы" });
  }

  return { kind: "quick_replies", options };
}

export function dedupeQuickReplyOptions(options: Array<{ label: string; value: string; href?: string }>) {
  const seen = new Set<string>();
  const out: Array<{ label: string; value: string; href?: string }> = [];
  for (const option of options) {
    const key = (option.label + "|" + option.value + "|" + (option.href ?? "")).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(option);
  }
  return out;
}

export function buildChatOnlyActionUi(args: { locations: LocationLite[]; services: ServiceLite[]; focusDate?: string | null; includeMyBookings?: boolean }): ChatUi {
  const base = buildBookingReengageUi({ locations: args.locations, services: args.services, focusDate: args.focusDate ?? null });
  if (base.kind !== "quick_replies") return base;
  const options = [...base.options];
  if (args.includeMyBookings !== false) {
    options.splice(1, 0, { label: "Мои записи", value: "какие у меня записи" });
  }
  return { kind: "quick_replies", options: dedupeQuickReplyOptions(options) };
}

export function applyDraftConsistencyGuard(args: {
  reply: string;
  ui: ChatUi | null;
  route: "chat-only" | "booking-flow" | "client-actions";
  messageNorm: string;
  draft: DraftLike;
  services: ServiceLite[];
  locations: LocationLite[];
}): { reply: string; ui: ChatUi | null; reason: string | null } {
  let { reply, ui } = args;
  const { route, messageNorm, draft, services, locations } = args;
  let reason: string | null = null;

  if (route === "chat-only" && draft.serviceId && /(?:доступные\s+услуги\s+ниже|выберите\s+услугу)/iu.test(reply)) {
    const explicitCatalogRequest = /(?:какие\s+услуги|покажи\s+услуги|список\s+услуг|категория:)/iu.test(messageNorm);
    if (!explicitCatalogRequest) {
      const serviceName = services.find((s) => s.id === draft.serviceId)?.name ?? "выбранную услугу";
      const locationName = draft.locationId ? locations.find((x) => x.id === draft.locationId)?.name ?? null : null;
      const locationSuffix = locationName ? ` в «${locationName}»` : "";
      reply = `Сейчас выбрана услуга «${serviceName}»${locationSuffix}. Уточните дату или время, и продолжу запись.`;
      ui = {
        kind: "quick_replies",
        options: [
          { label: "Показать время", value: "покажи свободное время" },
          { label: "Выбрать дату", value: "выбрать дату" },
          { label: "Сменить услугу", value: "покажи услуги" },
        ],
      };
      reason = "guard_keep_selected_service";
    }
  }

  if (route === "chat-only" && draft.locationId && /(?:выберите\s+филиал|выберите\s+локац)/iu.test(reply)) {
    const explicitLocationRequest = /(?:филиал|локац|адрес|покажи\s+филиалы)/iu.test(messageNorm);
    if (!explicitLocationRequest) {
      const locationName = locations.find((x) => x.id === draft.locationId)?.name;
      if (locationName) {
        reply = `Сейчас выбрана локация «${locationName}». Уточните услугу, дату или время, и продолжу запись.`;
        reason = reason ?? "guard_keep_selected_location";
      }
    }
  }

  return { reply, ui, reason };
}
export function keepReplyShort(text: string, maxSentences = 2) {
  const clean = text.replace(/s+/g, " ").trim();
  if (!clean) return clean;
  const parts = clean.match(/[^.!?]+[.!?]?/g) ?? [clean];
  return parts.slice(0, maxSentences).join(" ").trim();
}

export function countConsecutiveToxicUserTurns(recentMessages: Array<{ role: string; content: string }>) {
  let count = 0;
  for (const m of recentMessages) {
    if (m.role !== "user") continue;
    const t = norm(m.content ?? "");
    if (/(сучк|сука|туп|идиот|дебил|нахер|нахуй|говно|херня|отстань|пошел|пошёл)/i.test(t)) {
      count += 1;
      continue;
    }
    break;
  }
  return count;
}

export function buildToxicReply(level: number, messageNorm: string) {
  if (level <= 1) {
    return smalltalkVariant(messageNorm, [
      "Понимаю, тема чувствительная. Могу говорить только в уважительном и безопасном формате.",
      "Давайте оставим разговор в корректном тоне. Я помогу по записи и услугам.",
      "Я на связи и могу помочь по услугам и записи. Давайте без грубости.",
    ]);
  }
  if (level === 2) {
    return smalltalkVariant(messageNorm, [
      "Продолжу в спокойном тоне. Если хотите, помогу выбрать услугу и время.",
      "Остаюсь в уважительном формате. Могу сразу перейти к записи.",
      "Давайте общаться корректно, и я быстро помогу с записью.",
    ]);
  }
  return smalltalkVariant(messageNorm, [
    "Сохраню вежливый формат диалога. Когда будете готовы, продолжим по записи.",
    "Я отвечаю только в корректном формате. Могу помочь с услугами и визитами.",
    "Продолжу в уважительном тоне. Готова помочь с выбором услуги, даты и времени.",
  ]);
}

export function asksSpecialistsByShortText(messageNorm: string) {
  return /^(?:а\s+)?(?:спец|специал|специалист|специалисты|специаличты|спецы|мастер|мастера)\??$/iu.test(messageNorm);
}

export function asksWhoPerformsServices(messageNorm: string) {
  return /(?:кто\s+(?:у\s+вас\s+)?(?:делает|выполняет|оказывает|из\s+мастеров)|кто\s+у\s+вас\s+.*(?:мастер|специалист)|кто\s+.*(?:делает|выполняет|оказывает)|какие\s+мастера|какой\s+мастер|какие\s+специалисты|у\s+каких\s+мастеров|кто\s+из\s+мастеров|кто\s+завтра\s+из\s+мастеров\s+работает|кто\s+работает|кто\s+завтра\s+работает|какие\s+мастера\s+у\s+вас\s+есть|какие\s+специалисты\s+у\s+вас\s+есть|какие\s+мастера\s+есть|топ[-\s]?мастер|топ[-\s]?мастера|лучшие\s+мастера|ведущие\s+мастера)/iu.test(messageNorm);
}

export function specialistByText(messageNorm: string, specialists: SpecialistLite[]) {
  const t = norm(messageNorm);
  if (!t) return null;
  const direct = specialists.find((s) => t.includes(norm(s.name)));
  if (direct) return direct;
  const byToken = specialists.find((s) => {
    const parts = norm(s.name).split(" ").filter(Boolean);
    return parts.some((p) => p.length >= 3 && new RegExp("\\b" + p + "\\b", "i").test(t));
  });
  if (byToken) return byToken;
  const fuzzy = bestFuzzyEntity(t, specialists, (s) => [s.name]);
  return fuzzy ?? null;
}

export function isAnySpecialistChoiceText(messageNorm: string) {
  return /\b(любой|кто угодно|не важно|неважно)\b/i.test(messageNorm);
}

export function specialistSupportsSelection(args: {
  specialistId: number | null | undefined;
  serviceId: number | null | undefined;
  locationId: number | null | undefined;
  specialists: SpecialistLite[];
}) {
  const { specialistId, serviceId, locationId, specialists } = args;
  if (!specialistId) return false;
  const specialist = specialists.find((s) => s.id === specialistId);
  if (!specialist) return false;
  if (locationId && !specialist.locationIds.includes(locationId)) return false;
  if (serviceId && specialist.serviceIds?.length && !specialist.serviceIds.includes(serviceId)) return false;
  return true;
}

export function isServiceFollowUpText(messageNorm: string) {
  return /^(и все|и всё|а еще|а ещё|что еще|что ещё|еще есть|ещё есть)$/i.test(messageNorm);
}

export function extractRequestedServicePhrase(messageNorm: string) {
  const stop = new Set([
    "сегодня",
    "завтра",
    "послезавтра",
    "утро",
    "день",
    "вечер",
    "час",
    "время",
    "дата",
    "филиал",
    "локация",
    "центр",
    "риверсайд",
    "riverside",
  ]);
  const matches = Array.from(
    messageNorm.matchAll(/(?:на|хочу|нужн[ао]?|запиши(?: меня)?(?: на)?|записаться на)\s+([\p{L}\-]{4,}(?:\s+[\p{L}\-]{3,}){0,2})/giu),
  );
  for (let i = matches.length - 1; i >= 0; i -= 1) {
    let candidate = (matches[i]?.[1] ?? "").trim();
    if (!candidate) continue;
    candidate = candidate
      .replace(/\b(хочу|записаться|записать|запиши|пожалуйста|плиз|please)\b$/iu, "")
      .replace(/\s+/g, " ")
      .trim();
    if (!candidate) continue;
    const token = candidate.split(/\s+/)[0] ?? "";
    if (stop.has(token)) continue;
    return candidate;
  }
  return null;
}

export function isNluServiceGroundedByText(messageNorm: string, service: ServiceLite | null | undefined) {
  if (!service) return false;
  const serviceNorm = norm(service.name);
  if (!serviceNorm) return false;
  if (messageNorm.includes(serviceNorm)) return true;
  const meaningful = serviceNorm.split(/\s+/).filter((t) => t.length >= 4);
  return meaningful.some((t) => messageNorm.includes(t));
}

export function hasLocationCue(messageNorm: string) {
  return /(локац|филиал|адрес|центр|ривер|riverside|beauty salon|кутуз|тверск|любой филиал)/i.test(messageNorm);
}

export function asksSalonName(messageNorm: string) {
  return /(?:как\s+салон\s+называ(?:ется|ют)|как\s+ваш\s+салон\s+называ(?:ется|ют)|как\s+называется\s+салон|как\s+называется\s+ваш\s+салон|названи[ея]\s+(?:салон|студи|клиник))/i.test(
    messageNorm,
  );
}

export function isBookingCarryMessage(messageNorm: string) {
  return /^(почему|а почему|проверь|проверяй|дальше|далее|а дальше|что дальше|давай|да|ок|оке|окей|угу|ага)$/i.test(
    messageNorm,
  );
}

export function isSoftBookingMention(messageNorm: string) {
  return /(может|если|вдруг|потом).*(запишусь|записалась|запишемся|записаться)/i.test(messageNorm);
}

export function isBookingDeclineMessage(messageNorm: string) {
  return /(?:не\s+просил[а-я]*.*(?:локац|филиал|запис|запись)|не\s+предлагай.*(?:локац|филиал|запис|запись)|не\s+хочу\s+записываться|не\s+надо\s+записывать|не\s+предлагай\s+запись)/i.test(
    messageNorm,
  );
}

export function isBookingChangeMessage(messageNorm: string) {
  return /(?:не то|неверно|измени|другое|другую|не на|перенеси|другой)/iu.test(messageNorm);
}

export function isConversationalHeuristicIntent(intent: AishaIntent) {
  return intent === "greeting" || intent === "smalltalk" || intent === "identity";
}

export function isLooseConfirmation(text: string) {
  return has(text, /^(да|ок|оке|окей|подтверждаю|потверждаю|верно|согласен|согласна)(?:\s|$)/i);
}

export function extractPendingClientAction(recentMessages: Array<{ role: string; content: string }>) {
  const assistantLast = [...recentMessages].reverse().find((m) => m.role === "assistant")?.content ?? "";
  const reschedule = assistantLast.match(
    /подтвержда[\p{L}]*\s+перен[\p{L}]*\s*#?\s*(\d{1,8})\s+на\s+(\d{4}-\d{2}-\d{2})\s+([01]?\d|2[0-3])[:.]([0-5]\d)/iu,
  );
  if (reschedule) {
    return {
      type: "reschedule" as const,
      appointmentId: Number(reschedule[1]),
      date: reschedule[2]!,
      hh: String(Number(reschedule[3])).padStart(2, "0"),
      mm: reschedule[4]!,
    };
  }
  const cancelId =
    assistantLast.match(/подтвержда[\p{L}]*\s+отмен[\p{L}]*\s*#?\s*(\d{1,8})/iu)?.[1] ??
    (/(для\s+подтверждени[\p{L}]*.*отмен[\p{L}]*|подтверд[\p{L}]*\s+отмен[\p{L}]*)/iu.test(assistantLast)
      ? assistantLast.match(/#\s*(\d{1,8})\b/)?.[1]
      : null);
  if (cancelId) return { type: "cancel" as const, appointmentId: Number(cancelId) };
  const asksCancelChoice = /какую именно запись вы хотите отменить|уточните, какую запись отменить|какую запись отменить/i.test(
    assistantLast,
  );
  if (asksCancelChoice) return { type: "cancel_choice" as const };
  return null;
}

export function isCriticalIntent(intent: AishaIntent) {
  return (
    intent === "cancel_my_booking" ||
    intent === "reschedule_my_booking" ||
    intent === "client_profile" ||
    intent === "booking_mode_assistant" ||
    intent === "confirm" ||
    intent === "consent"
  );
}

export function isClientActionIntent(intent: AishaIntent) {
  return (
    intent === "my_bookings" ||
    intent === "my_stats" ||
    intent === "cancel_my_booking" ||
    intent === "reschedule_my_booking" ||
    intent === "repeat_booking" ||
    intent === "client_profile"
  );
}

export function isBookingDomainIntent(intent: AishaIntent) {
  return (
    intent.startsWith("booking_") ||
    intent === "ask_availability" ||
    intent === "ask_services" ||
    intent === "ask_price" ||
    intent === "ask_specialists" ||
    intent === "contact_phone" ||
    intent === "contact_address" ||
    intent === "working_hours"
  );
}

export function isInfoOnlyIntent(intent: AishaIntent) {
  return (
    intent === "ask_services" ||
    intent === "ask_price" ||
    intent === "ask_specialists" ||
    intent === "contact_phone" ||
    intent === "contact_address" ||
    intent === "working_hours"
  );
}

export function resolveIntentModelFirst(args: {
  mappedNluIntent: AishaIntent;
  nluConfidence: number;
  heuristicIntent: AishaIntent;
}): AishaIntent {
  const { mappedNluIntent, nluConfidence, heuristicIntent } = args;
  if (mappedNluIntent === "unknown") return heuristicIntent;
  const heuristicSpecific = heuristicIntent !== "unknown" && !isConversationalHeuristicIntent(heuristicIntent);
  if (heuristicSpecific && isConversationalHeuristicIntent(mappedNluIntent)) return heuristicIntent;
  if (isClientActionIntent(heuristicIntent) && !isClientActionIntent(mappedNluIntent)) return heuristicIntent;
  if (
    isBookingDomainIntent(heuristicIntent) &&
    isConversationalHeuristicIntent(mappedNluIntent) &&
    nluConfidence < NLU_INTENT_CONFIDENCE_CRITICAL_THRESHOLD
  ) {
    return heuristicIntent;
  }
  if (isConversationalHeuristicIntent(mappedNluIntent)) return mappedNluIntent;
  if (isCriticalIntent(mappedNluIntent)) {
    return nluConfidence >= NLU_INTENT_CONFIDENCE_CRITICAL_THRESHOLD ? mappedNluIntent : heuristicIntent;
  }
  return nluConfidence >= NLU_INTENT_CONFIDENCE_THRESHOLD ? mappedNluIntent : heuristicIntent;
}

export function intentFromHeuristics(message: string): AishaIntent {
  if (asksCurrentDateTime(message)) return "smalltalk";
  if (asksWhyNoAnswer(norm(message))) return "smalltalk";
  if (isPauseConversationMessage(norm(message))) return "smalltalk";
  if (asksAssistantQualification(norm(message))) return "identity";
  if (isOutOfDomainPrompt(norm(message))) return "out_of_scope";
  if (isGeneralQuestionOutsideBooking(norm(message))) return "out_of_scope";
  if (asksWhoPerformsServices(message)) return "ask_specialists";
  if (asksSpecialistsByShortText(message)) return "ask_specialists";
  if (asksGenderedServices(message)) return "ask_services";
  const hasServiceMention = has(message, /(маник|педик|стриж|гель|окраш|тату|татуир)/i);
  const hasBookingCue = has(message, /(хочу|запиши|записаться|давай|нужно|нужна|нужен|сделать|хотела|хотел)/i) || hasBookingVerbTypo(message);
  if (hasServiceMention && hasBookingCue) return "booking_start";
  if (has(message, /подтвержда[\p{L}]*\s+перен[\p{L}]*\s*#?\s*\d*/iu)) return "reschedule_my_booking";
  if (has(message, /подтвержда[\p{L}]*\s+отмен[\p{L}]*\s*#?\s*\d*/iu)) return "cancel_my_booking";
  if (has(message, /(мои записи|моя запись|покажи мои записи|последн(яя|юю|ие|их)|предстоящ(ая|ую|ие|их)|ближайш(ая|ую|ие|их)|какая у меня.*запись|прошедш(ая|ую|ие|их)|последнюю покажи|покажи запись\s*#\s*\d{1,8}|запись\s*#\s*\d{1,8}|запись\s*№\s*\d{1,8})/i))
    return "my_bookings";
  if (has(message, /(моя статистика|статистика|сколько раз)/i)) return "my_stats";
  if (has(message, /^(перенеси|перезапиши)\b/i)) return "reschedule_my_booking";
  if (has(message, /(перенеси запись|перезапиши|перенести #|reschedule|перенеси.*запись|перенеси(ть)? (ее|её|эту)|можешь.*перенести)/i))
    return "reschedule_my_booking";
  if (has(message, /^(отмени|отменить|отмена)\b/i)) return "cancel_my_booking";
  if (has(message, /(отмени запись|отменить #|cancel booking|отмени.*запись|отмена.*записи|отмени(ть)? (ее|её|эту)|можешь.*отменить)/i))
    return "cancel_my_booking";
  if (has(message, /(повтори прошлую запись|повтори запись)/i)) return "repeat_booking";
  if (has(message, /(мои данные|мой профиль|смени телефон|обнови телефон)/i)) return "client_profile";
  if (has(message, /(дай номер|какой у вас номер|какой номер|номер студии|номер филиала|номер локации|телефон)/i)) return "contact_phone";
  if (has(message, /(где находится|где находитесь|где ваш салон|адрес|как добраться)/i)) return "contact_address";
  if (has(message, /(как салон называется|как называется салон|как ваш салон называется|как называется ваш салон|название салона)/i)) return "identity";
  if (has(message, /(до скольки|график|часы работы|работает)/i)) return "working_hours";
  if (asksServiceExistence(message)) return "ask_services";
  if (has(message, /(консультац)/i)) return "ask_services";
  if (has(message, /(какие услуги|что по услугам|прайс|каталог услуг|список услуг|пришли список|покажи список|скинь список)/i))
    return "ask_services";
  if (has(message, /(какая цена|сколько стоит|цена|стоим|стоимость|по стоимости|по прайсу|ценник|деньги)/i)) return "ask_price";
  if (mentionsServiceTopic(message)) return "ask_services";
  if (has(message, /(окошк|свобод|слот|на сегодня|на завтра|на вечер|сегодня вечером|сегодня утром|сегодня днем|сегодня днём|вечером|утром|днем|днём)/i))
    return "ask_availability";
  if (has(message, /(кто ты|как тебя зовут|твое имя|твоё имя)/i)) return "identity";
  if (has(message, /(что умеешь|чем занимаешься|что ты можешь)/i)) return "capabilities";
  if (isGreetingText(message)) return "greeting";
  if (has(message, /(как дела|как жизнь|что нового|че каво|чё каво)/i)) return "smalltalk";
  if (has(message, /(запиш\p{L}*|записа\p{L}*|запис\p{L}*|запиг\p{L}*|оформи\p{L}*|заброни\p{L}*)/iu)) return "booking_start";
  if (hasBookingVerbTypo(message)) return "booking_start";
  return "unknown";
}

export function mapNluIntent(intent: AishaNluIntent): AishaIntent {
  const raw = intent as string;
  switch (intent) {
    case "booking":
      return "booking_start";
    case "update_booking":
      return "reject_or_change";
    case "mode_self":
      return "booking_mode_self";
    case "mode_assistant":
      return "booking_mode_assistant";
    case "ask_status":
      return "status_check";
    case "gratitude":
      return "post_completion_smalltalk";
    default:
      if (raw === "reschedule") return "reschedule_my_booking";
      if (raw === "reschedule_booking") return "reschedule_my_booking";
      if (raw === "cancel") return "cancel_my_booking";
      if (raw === "cancel_booking") return "cancel_my_booking";
      if (raw === "my_booking") return "my_bookings";
      return intent as AishaIntent;
  }
}
