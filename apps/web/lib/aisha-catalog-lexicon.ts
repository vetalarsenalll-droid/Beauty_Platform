import type { ServiceLite } from "@/lib/booking-tools";

export type CatalogLexicon = {
  itemTokens: Set<string>;
  topicTokens: Set<string>;
  categoryTokens: Set<string>;
  tokenToServiceIds: Map<string, Set<number>>;
};

const STOP_TOKENS = new Set([
  "без",
  "для",
  "или",
  "как",
  "какая",
  "какие",
  "какой",
  "меня",
  "можно",
  "надо",
  "нужна",
  "нужно",
  "очень",
  "под",
  "после",
  "при",
  "про",
  "себя",
  "сейчас",
  "тоже",
  "услуг",
  "услуга",
  "услуги",
  "хочу",
  "цена",
  "что",
  "and",
  "for",
  "the",
]);

export function normalizeCatalogText(value: string) {
  return value
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^\p{L}\p{N}\s.+-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function stemCatalogToken(token: string) {
  return normalizeCatalogText(token)
    .replace(/(иями|ями|ами|ого|ему|ыми|ими|ой|ей|ою|ею|ий|ый|ая|яя|ое|ее|ых|их|ую|юю|ом|ем|ам|ям|ах|ях|а|я|ы|и|е|у|ю)$/u, "")
    .replace(/ь$/u, "")
    .trim();
}

export function tokenizeCatalogText(value: string) {
  return normalizeCatalogText(value)
    .split(/\s+/)
    .map(stemCatalogToken)
    .filter((token) => token.length >= 3 && !STOP_TOKENS.has(token));
}

function addToken(map: Map<string, Set<number>>, token: string, serviceId: number) {
  const current = map.get(token) ?? new Set<number>();
  current.add(serviceId);
  map.set(token, current);
}

export function buildCatalogLexicon(services: ServiceLite[]): CatalogLexicon {
  const itemTokens = new Set<string>();
  const topicTokens = new Set<string>();
  const categoryTokens = new Set<string>();
  const tokenToServiceIds = new Map<string, Set<number>>();

  for (const service of services) {
    for (const token of tokenizeCatalogText(service.name)) {
      itemTokens.add(token);
      topicTokens.add(token);
      addToken(tokenToServiceIds, token, service.id);
    }
    for (const token of tokenizeCatalogText(service.categoryName ?? "")) {
      categoryTokens.add(token);
      topicTokens.add(token);
      addToken(tokenToServiceIds, token, service.id);
    }
    for (const token of tokenizeCatalogText(service.description ?? "")) {
      topicTokens.add(token);
      addToken(tokenToServiceIds, token, service.id);
    }
    for (const token of tokenizeCatalogText(`${service.searchKeywords ?? ""} ${service.synonyms ?? ""}`)) {
      itemTokens.add(token);
      topicTokens.add(token);
      addToken(tokenToServiceIds, token, service.id);
    }
  }

  return { itemTokens, topicTokens, categoryTokens, tokenToServiceIds };
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function levenshtein(a: string, b: string) {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  const curr = Array.from({ length: b.length + 1 }, () => 0);
  for (let i = 1; i <= a.length; i += 1) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j]! + 1, curr[j - 1]! + 1, prev[j - 1]! + cost);
    }
    for (let j = 0; j <= b.length; j += 1) prev[j] = curr[j]!;
  }
  return prev[b.length]!;
}

function bestUniqueByScore<T>(items: Array<{ item: T; score: number }>) {
  const sorted = items.filter((x) => x.score > 0).sort((a, b) => b.score - a.score);
  if (!sorted.length) return null;
  if (sorted.length > 1 && sorted[0]!.score === sorted[1]!.score) return null;
  return sorted[0]!.item;
}

export function catalogItemByText(message: string, services: ServiceLite[], lexicon = buildCatalogLexicon(services)) {
  const messageNorm = normalizeCatalogText(message);
  if (!messageNorm || /^\s*категория:\s*.+$/iu.test(messageNorm)) return null;

  const exact = services.filter((service) => normalizeCatalogText(service.name) === messageNorm);
  if (exact.length === 1) return exact[0]!;
  if (exact.length > 1) return null;

  const byBoundary = services.filter((service) => {
    const name = normalizeCatalogText(service.name);
    return Boolean(name && new RegExp(`(?:^|\\s)${escapeRegExp(name)}(?:\\s|$)`, "iu").test(messageNorm));
  });
  if (byBoundary.length === 1) return byBoundary[0]!;
  if (byBoundary.length > 1) {
    byBoundary.sort((a, b) => normalizeCatalogText(b.name).length - normalizeCatalogText(a.name).length);
    const bestLen = normalizeCatalogText(byBoundary[0]!.name).length;
    const tied = byBoundary.filter((x) => normalizeCatalogText(x.name).length === bestLen);
    return tied.length === 1 ? tied[0]! : null;
  }

  const messageTokens = tokenizeCatalogText(messageNorm);
  const messageTokenSet = new Set(messageTokens);
  const scored = services.map((service) => {
    const nameTokens = tokenizeCatalogText(service.name);
    if (!nameTokens.length) return { item: service, score: 0 };
    const matched = nameTokens.filter((token) => messageTokenSet.has(token)).length;
    return { item: service, score: matched === nameTokens.length ? matched * 4 : matched };
  });
  const tokenMatch = bestUniqueByScore(scored);
  if (tokenMatch) return tokenMatch;

  const fuzzyScored = services.map((service) => {
    const nameTokens = tokenizeCatalogText(service.name);
    let score = 0;
    for (const itemToken of nameTokens) {
      for (const messageToken of messageTokens) {
        const distance = levenshtein(itemToken, messageToken);
        const threshold = itemToken.length >= 6 ? 2 : 1;
        if (distance <= threshold) score += Math.max(1, itemToken.length - distance);
      }
    }
    return { item: service, score };
  });
  const fuzzy = bestUniqueByScore(fuzzyScored);
  if (!fuzzy) return null;

  const fuzzyTokens = tokenizeCatalogText(fuzzy.name);
  if (!fuzzyTokens.some((token) => lexicon.itemTokens.has(token))) return null;
  return fuzzy;
}

export function mentionsCatalogTopic(message: string, lexicon: CatalogLexicon) {
  return tokenizeCatalogText(message).some((token) => lexicon.topicTokens.has(token));
}

export function asksCatalogItemExistence(message: string, lexicon: CatalogLexicon) {
  const messageNorm = normalizeCatalogText(message);
  const asks = /(есть|имеется|делаете|делаешь|можно|доступн|проводите|принимаете|можем|сдать|сдаете|оказываете)/iu.test(messageNorm);
  return asks && mentionsCatalogTopic(messageNorm, lexicon);
}

export function isCatalogInquiryMessage(rawMessage: string, messageNorm: string, lexicon: CatalogLexicon) {
  const normalized = normalizeCatalogText(messageNorm);
  if (!mentionsCatalogTopic(normalized, lexicon)) return false;
  const asks = /(есть|нет|имеется|доступн|а .* нет|делаете|можно|проводите|сдать|сдаете|оказываете)/iu.test(normalized);
  return asks || rawMessage.includes("?");
}

export function catalogTopicMatches(message: string, services: ServiceLite[], lexicon: CatalogLexicon) {
  const tokens = tokenizeCatalogText(message).filter((token) => lexicon.topicTokens.has(token));
  if (!tokens.length) return [];
  const matchedIds = new Set<number>();
  for (const token of tokens) lexicon.tokenToServiceIds.get(token)?.forEach((id) => matchedIds.add(id));
  return services.filter((service) => matchedIds.has(service.id));
}

export function looksLikeUnknownCatalogItemRequest(message: string, lexicon: CatalogLexicon) {
  const messageNorm = normalizeCatalogText(message);
  if (/(филиал|локац|центр|riverside|beauty salon|\d{1,2}[:.]\d{2})/iu.test(messageNorm)) return false;
  if (/(какие услуги|что по услугам|прайс|каталог|список услуг)/iu.test(messageNorm)) return false;
  if (/[?]/.test(messageNorm)) return false;
  if (/^(это|а это|что это|как это|почему|зачем|кто|где|когда|я спросил|я спросила|расскажи|объясни|обьясни|можешь)\b/iu.test(messageNorm))
    return false;
  if (/(?:^|\s)(хочу|нужн[ао]?|запиши|записаться|на)\s+[\p{L}\s-]{4,}/iu.test(messageNorm)) {
    return mentionsCatalogTopic(messageNorm, lexicon);
  }
  if (/^[\p{L}\s-]{4,}$/iu.test(messageNorm) && messageNorm.split(/\s+/).length <= 4) {
    if (!mentionsCatalogTopic(messageNorm, lexicon)) return false;
    if (/(привет|здравств|спасибо|пока|да|нет|ок|оке|окей|дальше|проверь|почему)/iu.test(messageNorm)) return false;
    return true;
  }
  return false;
}
