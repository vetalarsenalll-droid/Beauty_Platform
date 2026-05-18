import { NextResponse } from "next/server";
import { appOrigin, consumeClientOAuthState } from "@/lib/client-oauth";
import { completeClientSocialAuth } from "@/lib/client-social-auth";
import { jsonError } from "@/lib/api";

type MaxProfile = {
  id?: string | number;
  sub?: string;
  email?: string;
  phone?: string;
  first_name?: string;
  last_name?: string;
  name?: string;
  username?: string;
  picture?: string;
  avatar_url?: string;
};

export async function GET(request: Request) {
  const clientId = process.env.MAX_CLIENT_ID;
  const clientSecret = process.env.MAX_CLIENT_SECRET;
  const tokenUrl = process.env.MAX_TOKEN_URL;
  const userinfoUrl = process.env.MAX_USERINFO_URL;
  if (!clientId || !clientSecret || !tokenUrl || !userinfoUrl) {
    return jsonError("SOCIAL_AUTH_NOT_CONFIGURED", "MAX ID не настроен.", null, 503);
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = await consumeClientOAuthState("MAX", url.searchParams.get("state"));
  if (!code || !state) return jsonError("INVALID_OAUTH_STATE", "Не удалось проверить вход через MAX ID.", null, 400);

  const redirectUri = `${appOrigin(request)}/api/v1/auth/client/social/max/callback`;
  const tokenResponse = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
    }),
    cache: "no-store",
  });
  const tokenPayload = await tokenResponse.json().catch(() => null);
  const accessToken = typeof tokenPayload?.access_token === "string" ? tokenPayload.access_token : "";
  if (!tokenResponse.ok || !accessToken) {
    return jsonError("SOCIAL_AUTH_FAILED", "Не удалось получить токен MAX ID.", null, 400);
  }

  const profileResponse = await fetch(userinfoUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  const profile = (await profileResponse.json().catch(() => null)) as MaxProfile | null;
  const providerUserId = profile?.sub ?? (profile?.id != null ? String(profile.id) : "");
  if (!profileResponse.ok || !providerUserId) {
    return jsonError("SOCIAL_AUTH_FAILED", "Не удалось получить профиль MAX ID.", null, 400);
  }

  await completeClientSocialAuth({
    accountSlug: state.accountSlug,
    profile: {
      provider: "MAX",
      providerUserId,
      email: profile?.email ?? null,
      phone: profile?.phone ?? null,
      firstName: profile?.first_name ?? null,
      lastName: profile?.last_name ?? null,
      displayName: profile?.name ?? null,
      username: profile?.username ?? null,
      avatarUrl: profile?.picture ?? profile?.avatar_url ?? null,
      metadataJson: profile,
    },
  });

  return NextResponse.redirect(new URL(state.returnTo, appOrigin(request)));
}

