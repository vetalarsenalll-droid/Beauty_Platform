import type { ChatUi } from "@/lib/booking-flow";
import { buildDirectBookingKickoffReply, runBookingFlowBranch } from "@/lib/aisha-chat-reply-builder";
import type { Action } from "@/lib/aisha-chat-types";

export async function handleBookingDomain(args: {
  directBookingKickoffFallback: boolean;
  date: string | null;
  locations: Array<{ name: string }>;
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
    const kickoff = buildDirectBookingKickoffReply({ date: args.date, locations: args.locations as any });
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
    if (bookingBranch.handled) {
      reply = bookingBranch.reply ?? reply;
      nextStatus = bookingBranch.nextStatus ?? nextStatus;
      nextAction = bookingBranch.nextAction ?? nextAction;
      nextUi = bookingBranch.ui ?? null;
      return { handled: true, reply, nextStatus, nextAction, nextUi };
    }
  }

  return { handled: false, reply, nextStatus, nextAction, nextUi };
}
