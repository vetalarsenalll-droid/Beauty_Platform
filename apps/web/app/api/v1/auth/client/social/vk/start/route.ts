import { NextResponse } from "next/server";
import { appendParams, appOrigin, createClientOAuthState } from "@/lib/client-oauth";
import { jsonError } from "@/lib/api";

export async function GET(request: Request) {
  const clientId = process.env.VK_CLIENT_ID;
  if (!clientId) return jsonError("SOCIAL_AUTH_NOT_CONFIGURED", "VK ID не настроен.", null, 503);

  const url = new URL(request.url);
  const accountSlug = url.searchParams.get("account");
  const returnTo = url.searchParams.get("returnTo");
  const state = await createClientOAuthState("VK", accountSlug, returnTo);
  const redirectUri = `${appOrigin(request)}/api/v1/auth/client/social/vk/callback`;

  const authUrl = appendParams(process.env.VK_AUTH_URL || "https://oauth.vk.com/authorize", {
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    state: state.state,
    scope: process.env.VK_SCOPE || "email",
    v: process.env.VK_API_VERSION || "5.199",
  });

  return NextResponse.redirect(authUrl);
}

