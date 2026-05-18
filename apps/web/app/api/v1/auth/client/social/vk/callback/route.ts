import { NextResponse } from "next/server";
import { appOrigin, consumeClientOAuthState } from "@/lib/client-oauth";
import { completeClientSocialAuth } from "@/lib/client-social-auth";
import { jsonError } from "@/lib/api";

type VkTokenPayload = {
  access_token?: string;
  user_id?: number | string;
  email?: string;
};

type VkUserPayload = {
  response?: Array<{
    id?: number;
    first_name?: string;
    last_name?: string;
    screen_name?: string;
    photo_200?: string;
  }>;
};

export async function GET(request: Request) {
  const clientId = process.env.VK_CLIENT_ID;
  const clientSecret = process.env.VK_CLIENT_SECRET;
  if (!clientId || !clientSecret) return jsonError("SOCIAL_AUTH_NOT_CONFIGURED", "VK ID не настроен.", null, 503);

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = await consumeClientOAuthState("VK", url.searchParams.get("state"));
  if (!code || !state) return jsonError("INVALID_OAUTH_STATE", "Не удалось проверить вход через VK ID.", null, 400);

  const redirectUri = `${appOrigin(request)}/api/v1/auth/client/social/vk/callback`;
  const tokenUrl = new URL(process.env.VK_TOKEN_URL || "https://oauth.vk.com/access_token");
  tokenUrl.searchParams.set("client_id", clientId);
  tokenUrl.searchParams.set("client_secret", clientSecret);
  tokenUrl.searchParams.set("redirect_uri", redirectUri);
  tokenUrl.searchParams.set("code", code);

  const tokenResponse = await fetch(tokenUrl, { cache: "no-store" });
  const token = (await tokenResponse.json().catch(() => null)) as VkTokenPayload | null;
  const accessToken = typeof token?.access_token === "string" ? token.access_token : "";
  const providerUserId = token?.user_id != null ? String(token.user_id) : "";
  if (!tokenResponse.ok || !accessToken || !providerUserId) {
    return jsonError("SOCIAL_AUTH_FAILED", "Не удалось получить токен VK ID.", null, 400);
  }
  const tokenPayload = token as VkTokenPayload;

  const profileUrl = new URL(process.env.VK_USERINFO_URL || "https://api.vk.com/method/users.get");
  profileUrl.searchParams.set("user_ids", providerUserId);
  profileUrl.searchParams.set("fields", "screen_name,photo_200");
  profileUrl.searchParams.set("access_token", accessToken);
  profileUrl.searchParams.set("v", process.env.VK_API_VERSION || "5.199");

  const profileResponse = await fetch(profileUrl, { cache: "no-store" });
  const profilePayload = (await profileResponse.json().catch(() => null)) as VkUserPayload | null;
  const profile = profilePayload?.response?.[0] ?? null;

  await completeClientSocialAuth({
    accountSlug: state.accountSlug,
    profile: {
      provider: "VK",
      providerUserId,
      email: tokenPayload.email ?? null,
      firstName: profile?.first_name ?? null,
      lastName: profile?.last_name ?? null,
      displayName: [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || null,
      username: profile?.screen_name ?? null,
      avatarUrl: profile?.photo_200 ?? null,
      metadataJson: { tokenUserId: tokenPayload.user_id, profile },
    },
  });

  return NextResponse.redirect(new URL(state.returnTo, appOrigin(request)));
}
