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
}): Promise<{ reply: string; ui: ChatUi | null }> {
  return runClientActionsBranch(args);
}
