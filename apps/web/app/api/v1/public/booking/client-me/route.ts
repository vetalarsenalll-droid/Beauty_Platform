import { getClientSession } from "@/lib/auth";
import { jsonOk } from "@/lib/api";
import { buildClientMePayload, emptyClientMePayload } from "@/lib/client-me";

export async function GET(request: Request) {
  const session = await getClientSession();

  if (!session) {
    return jsonOk(emptyClientMePayload());
  }

  const url = new URL(request.url);
  const accountSlug = url.searchParams.get("account");

  return jsonOk(await buildClientMePayload(session, accountSlug));
}
