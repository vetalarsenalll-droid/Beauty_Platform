import { NextResponse } from "next/server";
import { appendParams, appOrigin, createClientOAuthState } from "@/lib/client-oauth";
import { jsonError } from "@/lib/api";

export async function GET(request: Request) {
  const clientId = process.env.MAX_CLIENT_ID;
  const authUrl = process.env.MAX_AUTH_URL;
  if (!clientId || !authUrl) return jsonError("SOCIAL_AUTH_NOT_CONFIGURED", "MAX ID не настроен.", null, 503);

  const url = new URL(request.url);
  const accountSlug = url.searchParams.get("account");
  const returnTo = url.searchParams.get("returnTo");
  const state = await createClientOAuthState("MAX", accountSlug, returnTo);
  const redirectUri = `${appOrigin(request)}/api/v1/auth/client/social/max/callback`;

  return NextResponse.redirect(
    appendParams(authUrl, {
      response_type: "code",
      client_id: clientId,
      redirect_uri: redirectUri,
      state: state.state,
      scope: process.env.MAX_SCOPE || "profile email",
    })
  );
}

