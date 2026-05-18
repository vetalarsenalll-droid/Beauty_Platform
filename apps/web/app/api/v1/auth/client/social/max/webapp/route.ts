import crypto from "crypto";
import { completeClientSocialAuth, safeClientReturnTo } from "@/lib/client-social-auth";
import { jsonError, jsonOk } from "@/lib/api";

type MaxWebAppUser = {
  id?: number | string;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
};

function decodeStartParam(value: string | null) {
  if (!value) return { accountSlug: null, returnTo: null };
  try {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const padded = `${normalized}${"=".repeat((4 - (normalized.length % 4)) % 4)}`;
    const parsed = JSON.parse(Buffer.from(padded, "base64").toString("utf8")) as {
      accountSlug?: string | null;
      returnTo?: string | null;
    };
    return {
      accountSlug: typeof parsed.accountSlug === "string" ? parsed.accountSlug : null,
      returnTo: typeof parsed.returnTo === "string" ? parsed.returnTo : null,
    };
  } catch {
    return { accountSlug: null, returnTo: null };
  }
}

function verifyMaxWebAppData(initData: string, botToken: string) {
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return null;
  params.delete("hash");

  const dataCheckString = Array.from(params.entries())
    .map(([key, value]) => `${key}=${value}`)
    .sort()
    .join("\n");
  const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  const calculated = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

  try {
    if (!crypto.timingSafeEqual(Buffer.from(calculated, "hex"), Buffer.from(hash, "hex"))) return null;
  } catch {
    return null;
  }

  const authDate = Number(params.get("auth_date"));
  if (!Number.isFinite(authDate) || Date.now() / 1000 - authDate > 24 * 60 * 60) return null;

  const userRaw = params.get("user");
  if (!userRaw) return null;
  try {
    const user = JSON.parse(userRaw) as MaxWebAppUser;
    return { user, startParam: params.get("start_param") };
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const botToken = process.env.MAX_BOT_TOKEN;
  if (!botToken) return jsonError("SOCIAL_AUTH_NOT_CONFIGURED", "MAX ID не настроен.", null, 503);

  const body = (await request.json().catch(() => null)) as { initData?: string } | null;
  const initData = String(body?.initData ?? "");
  if (!initData) return jsonError("VALIDATION_FAILED", "Некорректные данные MAX ID.", null, 400);

  const verified = verifyMaxWebAppData(initData, botToken);
  if (!verified?.user?.id) {
    return jsonError("SOCIAL_AUTH_FAILED", "Не удалось проверить подпись MAX ID.", null, 400);
  }

  const state = decodeStartParam(verified.startParam);
  const result = await completeClientSocialAuth({
    accountSlug: state.accountSlug,
    profile: {
      provider: "MAX",
      providerUserId: String(verified.user.id),
      firstName: verified.user.first_name ?? null,
      lastName: verified.user.last_name ?? null,
      displayName: [verified.user.first_name, verified.user.last_name].filter(Boolean).join(" ") || verified.user.username || null,
      username: verified.user.username ?? null,
      avatarUrl: verified.user.photo_url ?? null,
      metadataJson: verified.user,
    },
  });

  return jsonOk({
    ...result,
    returnTo: safeClientReturnTo(state.returnTo, state.accountSlug),
  });
}

