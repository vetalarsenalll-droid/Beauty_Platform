import { handlePublicAiChatDelete, handlePublicAiChatGet } from "@/lib/aisha-chat-http-handlers";
import { handlePublicAiChatPost } from "@/lib/aisha-chat-post-handler";

export async function GET(request: Request) {
  return handlePublicAiChatGet(request);
}

export async function DELETE(request: Request) {
  return handlePublicAiChatDelete(request);
}

export async function POST(request: Request) {
  return handlePublicAiChatPost(request);
}
