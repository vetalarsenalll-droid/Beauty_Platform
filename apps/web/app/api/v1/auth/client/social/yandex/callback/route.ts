import { NextResponse } from "next/server";
import { appOrigin, consumeClientOAuthState } from "@/lib/client-oauth";
import { completeClientSocialAuth } from "@/lib/client-social-auth";
import { jsonError } from "@/lib/api";

type YandexProfile = {
  id?: string;
  login?: string;
  default_email?: string;
  display_name?: string;
  first_name?: string;
  last_name?: string;
  default_avatar_id?: string;
  is_avatar_empty?: boolean;
};

export async function GET(request: Request) {
  const clientId = process.env.YANDEX_CLIENT_ID;
  const clientSecret = process.env.YANDEX_CLIENT_SECRET;
  if (!clientId || !clientSecret) return jsonError("SOCIAL_AUTH_NOT_CONFIGURED", "Yandex ID не настроен.", null, 503);

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = await consumeClientOAuthState("YANDEX", url.searchParams.get("state"));
  if (!code || !state) return jsonError("INVALID_OAUTH_STATE", "Не удалось проверить вход через Yandex ID.", null, 400);

  const redirectUri = `${appOrigin(request)}/api/v1/auth/client/social/yandex/callback`;
  const tokenResponse = await fetch("https://oauth.yandex.ru/token", {
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
    return jsonError("SOCIAL_AUTH_FAILED", "Не удалось получить токен Yandex ID.", null, 400);
  }

  const profileResponse = await fetch("https://login.yandex.ru/info?format=json", {
    headers: { Authorization: `OAuth ${accessToken}` },
    cache: "no-store",
  });
  const profile = (await profileResponse.json().catch(() => null)) as YandexProfile | null;
  if (!profileResponse.ok || !profile?.id) {
    return jsonError("SOCIAL_AUTH_FAILED", "Не удалось получить профиль Yandex ID.", null, 400);
  }

  const avatarUrl =
    profile.default_avatar_id && !profile.is_avatar_empty
      ? `https://avatars.yandex.net/get-yapic/${profile.default_avatar_id}/islands-200`
      : null;

  await completeClientSocialAuth({
    accountSlug: state.accountSlug,
    profile: {
      provider: "YANDEX",
      providerUserId: String(profile.id),
      email: profile.default_email ?? null,
      firstName: profile.first_name ?? null,
      lastName: profile.last_name ?? null,
      displayName: profile.display_name ?? null,
      username: profile.login ?? null,
      avatarUrl,
      metadataJson: profile,
    },
  });

  return NextResponse.redirect(new URL(state.returnTo, appOrigin(request)));
}

