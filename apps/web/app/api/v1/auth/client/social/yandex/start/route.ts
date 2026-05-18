import { NextResponse } from "next/server";
import { appendParams, appOrigin, createClientOAuthState } from "@/lib/client-oauth";
import { jsonError } from "@/lib/api";

export async function GET(request: Request) {
  const clientId = process.env.YANDEX_CLIENT_ID;
  if (!clientId) return jsonError("SOCIAL_AUTH_NOT_CONFIGURED", "Yandex ID не настроен.", null, 503);

  const url = new URL(request.url);
  const accountSlug = url.searchParams.get("account");
  const returnTo = url.searchParams.get("returnTo");
  const state = await createClientOAuthState("YANDEX", accountSlug, returnTo);
  const redirectUri = `${appOrigin(request)}/api/v1/auth/client/social/yandex/callback`;

  const authUrl = appendParams("https://oauth.yandex.ru/authorize", {
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    state: state.state,
  });

  return NextResponse.redirect(authUrl);
}

