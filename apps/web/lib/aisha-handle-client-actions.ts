import type { ChatUi } from "@/lib/booking-flow";
import { runClientActionsBranch } from "@/lib/aisha-chat-reply-builder";

export async function handleClientActionsDomain(args: {
  messageForRouting: string;
  accountId: number;
  accountTimeZone: string;
  accountSlug: string;
  origin: string;
  clientId: number | null;
  threadClientId: number | null;
  pendingClientAction?:
    | { type: "cancel"; appointmentId: number }
    | { type: "reschedule"; appointmentId: number; date: string; hh: string; mm: string }
    | { type: "cancel_choice" }
    | null;
}): Promise<{ reply: string; ui: ChatUi | null }> {
  return runClientActionsBranch(args);
}
