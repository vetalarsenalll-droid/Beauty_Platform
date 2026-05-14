import type { ChatUi } from "@/lib/booking-flow";
import { buildDirectBookingKickoffReply, runBookingFlowBranch } from "@/lib/aisha-chat-reply-builder";
import type { Action } from "@/lib/aisha-chat-types";
import { formatServiceQuickLabel, type LocationLite } from "@/lib/booking-tools";
import { buildCatalogLexicon, catalogFuzzyCandidates, catalogItemByText } from "@/lib/aisha-catalog-lexicon";

const norm = (v: string) =>
  v
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^\p{L}\p{N}\s:.+\-/]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

function extractExplicitRequestedService(message: string) {
  const messageNorm = norm(message);
  const matches = Array.from(
    messageNorm.matchAll(/(?:^|\s)(?:запиши(?:\s+меня)?(?:\s+на)?|записаться\s+на|хочу\s+на|хочу|нужн[ао]?|заброни(?:ровать)?(?:\s+на)?|на)\s+([\p{L}\-]{4,}(?:\s+[\p{L}\-]{3,}){0,2})/giu),
  );
  for (let i = matches.length - 1; i >= 0; i -= 1) {
    const candidate = (matches[i]?.[1] ?? "")
      .replace(/(?:^|\s)(?:сегодня|завтра|послезавтра|утром|днем|днём|вечером|пожалуйста|плиз)(?:\s|$).*$/iu, "")
      .replace(/\s+/g, " ")
      .trim();
    if (candidate) return candidate;
  }
  return null;
}

export async function handleBookingDomain(args: {
  directBookingKickoffFallback: boolean;
  date: string | null;
  locations: LocationLite[];
  explicitDraftServiceQuestion: boolean;
  draftServiceName: string | null;
  draftLocationName: string | null;
  runFlowArgs: Parameters<typeof runBookingFlowBranch>[0];
  shouldRunBookingFlow: boolean;
  currentReply: string;
  currentStatus: string;
  currentAction: Action;
  currentUi: ChatUi | null;
}): Promise<{ handled: boolean; reply: string; nextStatus: string; nextAction: Action; nextUi: ChatUi | null }> {
  let { currentReply: reply, currentStatus: nextStatus, currentAction: nextAction, currentUi: nextUi } = args;

  if (args.directBookingKickoffFallback) {
    const requestedService = extractExplicitRequestedService(args.runFlowArgs.messageForRouting);
    const matchedService = requestedService
      ? catalogItemByText(requestedService, args.runFlowArgs.services, buildCatalogLexicon(args.runFlowArgs.services))
      : null;
    if (requestedService && !matchedService) {
      const servicePool = args.runFlowArgs.d.locationId
        ? args.runFlowArgs.services.filter((service) => service.locationIds.includes(args.runFlowArgs.d.locationId!))
        : args.runFlowArgs.services;
      const fuzzyCandidates = catalogFuzzyCandidates(requestedService, servicePool);
      args.runFlowArgs.d.serviceId = null;
      args.runFlowArgs.d.serviceIds = [];
      args.runFlowArgs.d.specialistId = null;
      args.runFlowArgs.d.time = null;
      args.runFlowArgs.d.bookingMode = null;
      args.runFlowArgs.d.planJson = [];
      args.runFlowArgs.d.mode = null;
      args.runFlowArgs.d.consentConfirmedAt = null;
      const optionsPool = fuzzyCandidates.length ? fuzzyCandidates : servicePool;
      return {
        handled: true,
        reply: fuzzyCandidates.length
          ? `Услугу «${requestedService}» не нашла. Возможно, Вы имели в виду один из вариантов ниже?`
          : `Услугу «${requestedService}» не нашла. Выберите, пожалуйста, из доступных ниже.`,
        nextStatus: "COLLECTING",
        nextAction,
        nextUi: {
          kind: "quick_replies",
          options: optionsPool.map((service) => ({
            label: formatServiceQuickLabel(service),
            value: `выбрать услугу ${service.name}`,
          })),
        },
      };
    }
    const kickoff = buildDirectBookingKickoffReply({ date: args.date, locations: args.locations });
    return { handled: true, reply: kickoff.reply, nextStatus, nextAction, nextUi: kickoff.ui };
  }

  if (args.explicitDraftServiceQuestion && args.draftServiceName) {
    const locationSuffix = args.draftLocationName ? ` в филиале «${args.draftLocationName}»` : "";
    reply = `Сейчас записываю вас на услугу «${args.draftServiceName}»${locationSuffix}.`;
    nextUi = {
      kind: "quick_replies",
      options: [
        { label: "Показать услуги", value: "какие услуги есть" },
        { label: "Показать время", value: "покажи свободное время" },
      ],
    };
    return { handled: true, reply, nextStatus, nextAction, nextUi };
  }

  if (args.shouldRunBookingFlow) {
    const bookingBranch = await runBookingFlowBranch(args.runFlowArgs);
    const hasOutput =
      bookingBranch.handled ||
      Boolean(bookingBranch.reply) ||
      Boolean(bookingBranch.ui) ||
      Boolean(bookingBranch.nextAction) ||
      Boolean(bookingBranch.nextStatus);
    if (hasOutput) {
      reply = bookingBranch.reply ?? reply;
      nextStatus = bookingBranch.nextStatus ?? nextStatus;
      nextAction = bookingBranch.nextAction ?? nextAction;
      nextUi = bookingBranch.ui ?? nextUi ?? null;
      return { handled: true, reply, nextStatus, nextAction, nextUi };
    }
  }

  return { handled: false, reply, nextStatus, nextAction, nextUi };
}
