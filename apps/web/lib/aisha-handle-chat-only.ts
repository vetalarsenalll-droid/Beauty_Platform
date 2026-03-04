import { asksCurrentDate, formatYmdRu } from "@/lib/aisha-routing-helpers";
import { buildBasicChatInfoReply, handleAskSpecialistsBranch } from "@/lib/aisha-chat-reply-builder";
import type { ChatUi } from "@/lib/booking-flow";

export function handleChatOnlyDomain(args: {
  message: string;
  intent: string;
  nowYmd: string;
  buildBasicArgs: Parameters<typeof buildBasicChatInfoReply>[0];
  askSpecialistsArgs: Parameters<typeof handleAskSpecialistsBranch>[0];
}): { handled: boolean; reply: string; ui: ChatUi | null } {
  const basic = buildBasicChatInfoReply(args.buildBasicArgs as any);
  if (basic.handled) return { handled: true, reply: basic.reply, ui: basic.ui ?? null };

  if (args.intent === "ask_specialists") {
    const specialistsBranch = handleAskSpecialistsBranch(args.askSpecialistsArgs as any);
    if (specialistsBranch.handled) return { handled: true, reply: specialistsBranch.reply, ui: specialistsBranch.ui ?? null };
  }

  if (asksCurrentDate(args.message)) {
    return { handled: true, reply: `Сегодня ${formatYmdRu(args.nowYmd)}.`, ui: null };
  }

  return { handled: false, reply: "", ui: null };
}
