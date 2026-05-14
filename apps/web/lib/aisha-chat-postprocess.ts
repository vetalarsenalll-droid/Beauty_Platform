import { runAishaNaturalizeReply } from "@/lib/aisha-orchestrator";
import type { ChatUi } from "@/lib/booking-flow";
import type { LocationLite, ServiceLite, SpecialistLite } from "@/lib/booking-tools";
import { applyCtaPolicy } from "@/lib/aisha-cta-policy";
import { applyResponseGuard } from "@/lib/aisha-response-guard";
import {
  asksWhyNoAnswer,
  buildChatOnlyActionUi,
  dedupeQuickReplyOptions,
  formatYmdRu,
  isGeneralQuestionOutsideBooking,
  isPauseConversationMessage,
  keepReplyShort,
  looksLikeHardBookingPushReply,
} from "@/lib/aisha-routing-helpers";
import type { DraftLike } from "@/lib/booking-tools";

const norm = (v: string) =>
  v
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^\p{L}\p{N}\s:.+\-/]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

export async function postProcessReply(args: {
  reply: string;
  nextUi: ChatUi | null;
  route: string;
  intent: string;
  messageForRouting: string;
  t: string;
  explicitDateTimeQuery: boolean;
  shouldRunBookingFlow: boolean;
  shouldHardReturnToDomain: boolean;
  shouldSoftReturnToBooking: boolean;
  hasDraftContext: boolean;
  consecutiveNonBookingTurns: number;
  consecutiveToxicTurns: number;
  explicitOutOfScopeCue: boolean;
  explicitServiceComplaint: boolean;
  explicitLocationsFollowUp: boolean;
  explicitAddressCue: boolean;
  bridgeFocusDate: string | null;
  bridgeFocusTimePreference: "morning" | "day" | "evening" | null;
  bridgeFocusServiceName: string | null;
  locations: LocationLite[];
  services: ServiceLite[];
  specialists: SpecialistLite[];
  accountId: number;
  assistantName: string;
  accountProfile: { description: string | null; address: string | null; phone: string | null } | null;
  knownClientName: string | null;
  conversationalReply: string | null;
  contextualBookingBridge: string | null;
  draft: DraftLike;
}): Promise<{ reply: string; nextUi: ChatUi | null; guardReason: string | null }> {
  let { reply, nextUi } = args;
  const {
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
    explicitServiceComplaint,
    explicitLocationsFollowUp,
    explicitAddressCue,
    bridgeFocusDate,
    locations,
    services,
    specialists,
    accountId,
    assistantName,
    accountProfile,
    knownClientName,
    conversationalReply,
    contextualBookingBridge,
    draft,
  } = args;
  const isServiceListUi = (ui: ChatUi | null) =>
    ui?.kind === "quick_replies" &&
    ui.options.length > 0 &&
    ui.options.some((o) => {
      const label = norm(o.label ?? "");
      const value = norm(o.value ?? "");
      if (!label && !value) return false;
      if (label === "все категории" || value === "все категории") return true;
      return services.some((s) => {
        const n = norm(s.name);
        return n.length > 0 && (label === n || value === n);
      });
    });

  if (shouldHardReturnToDomain) {
    reply = keepReplyShort("Возвращаю разговор к полезному: помогу с записью, услугами и вашими визитами.");
    nextUi = buildChatOnlyActionUi({ locations, services, focusDate: bridgeFocusDate });
  }

  if (
    route === "chat-only" &&
    !shouldRunBookingFlow &&
    !explicitServiceComplaint &&
    !isServiceListUi(nextUi)
  ) {
    const bridgeCandidate = (contextualBookingBridge ?? "").trim();
    const bridge =
      bridgeCandidate &&
      !looksLikeHardBookingPushReply(bridgeCandidate) &&
      !/выберите\s+(филиал|услугу|дату|время)/i.test(bridgeCandidate)
        ? bridgeCandidate
        : "";

    const hasBookingBridgeAlready = /(запис|запись|подбер[уё]|услуг|врем|слот|дата|филиал|локац)/i.test(norm(reply));
    if (bridge && !hasBookingBridgeAlready) {
      reply = reply ? reply.replace(/[.!?]+$/u, "") + ". " + bridge : bridge;
    } else if (!bridge && process.env.GIGACHAT_DEBUG_BRIDGE === "true") {
      const reason = contextualBookingBridge ? "filtered_bridge" : "missing_bridge";
      console.debug("[aisha] bridge skipped", {
        reason,
        explicitDateTimeQuery,
        route,
        intent,
      });
    }

    if (!nextUi && consecutiveNonBookingTurns >= 1) {
      nextUi = buildChatOnlyActionUi({ locations, services, focusDate: bridgeFocusDate });
    }
    if (bridgeFocusDate && locations.length === 1) {
      const onlyLocationName = locations[0]?.name ?? "выбранная локация";
      if (!new RegExp(onlyLocationName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(reply)) {
        reply = `${reply.replace(/[.!?]+$/u, "")}. На ${formatYmdRu(bridgeFocusDate)} доступна локация: ${onlyLocationName}.`;
      }
    }
  }


  // Sales bridge handled above for all chat-only replies.
  reply = reply.replace(/(Если захотите, помогу с записью:[^.!?]*[.!?])\s*Если захотите, помогу с записью:[^.!?]*[.!?]/iu, "$1");

  const responseGuard = applyResponseGuard({
    reply,
    nextUi,
    route,
    intent,
    messageForRouting,
    t,
    explicitDateTimeQuery,
    explicitServiceComplaint,
    explicitLocationsFollowUp,
    explicitAddressCue,
    shouldRunBookingFlow,
    hasDraftContext,
    bridgeFocusDate,
    locations,
    services,
    specialists,
    assistantName,
    knownClientName,
    conversationalReply,
    draft,
  });
  reply = responseGuard.reply;
  nextUi = responseGuard.nextUi;
  const guardReason = responseGuard.guardReason;

  const canNaturalizeReply =
    route === "chat-only" &&
    !explicitDateTimeQuery &&
    (intent === "capabilities" || intent === "greeting" || intent === "smalltalk") &&
    !isPauseConversationMessage(t) &&
    !asksWhyNoAnswer(t) &&
    !isGeneralQuestionOutsideBooking(t) &&
    !nextUi &&
    !reply.includes("\n") &&
    reply.length <= 260;

  if (canNaturalizeReply) {
    const naturalized = await runAishaNaturalizeReply({
      accountId,
      assistantName,
      message: messageForRouting,
      canonicalReply: reply,
      accountProfile,
      knownClientName,
    });
    if (naturalized) reply = naturalized;
  }

  const ctaPolicy = applyCtaPolicy({
    reply,
    nextUi,
    route,
    intent,
    messageNorm: t,
    explicitOutOfScopeCue,
    shouldRunBookingFlow,
    shouldHardReturnToDomain,
    shouldSoftReturnToBooking,
    consecutiveNonBookingTurns,
    consecutiveToxicTurns,
    explicitDateTimeQuery,
    explicitServiceComplaint,
    isServiceListUi,
    locations,
    services,
    bridgeFocusDate,
  });
  reply = ctaPolicy.reply;
  nextUi = ctaPolicy.nextUi;

  const looksLikeServiceListUi = isServiceListUi(nextUi);
  if (
    looksLikeServiceListUi &&
    /(могу отвечать кратко по теме|ниже можно сразу выбрать удобный шаг для записи|я на связи\.\s*если хотите,\s*продолжим разговор или перейдем к записи)/i.test(
      norm(reply),
    )
  ) {
    reply = "Доступные услуги ниже. Выберите нужную кнопкой.";
  }
  if (nextUi?.kind === "quick_replies") {
    nextUi = { kind: "quick_replies", options: dedupeQuickReplyOptions(nextUi.options) };
  }

  return { reply, nextUi, guardReason };
}


