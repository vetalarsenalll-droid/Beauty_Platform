import crypto from "crypto";
import { completeClientSocialAuth, safeClientReturnTo } from "@/lib/client-social-auth";
import { jsonError, jsonOk } from "@/lib/api";

type TelegramLoginPayload = {
  id?: number | string;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date?: number | string;
  hash?: string;
  accountSlug?: string;
  returnTo?: string;
};

function verifyTelegramPayload(payload: TelegramLoginPayload, botToken: string) {
  const hash = String(payload.hash ?? "");
  if (!hash) return false;

  const pairs = Object.entries(payload)
    .filter(([key, value]) => !["hash", "accountSlug", "returnTo"].includes(key) && value != null && value !== "")
    .map(([key, value]) => `${key}=${value}`)
    .sort();
  const dataCheckString = pairs.join("\n");
  const secret = crypto.createHash("sha256").update(botToken).digest();
  const calculated = crypto.createHmac("sha256", secret).update(dataCheckString).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(calculated, "hex"), Buffer.from(hash, "hex"));
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) return jsonError("SOCIAL_AUTH_NOT_CONFIGURED", "Telegram вход не настроен.", null, 503);

  const body = (await request.json().catch(() => null)) as TelegramLoginPayload | null;
  if (!body?.id || !body.auth_date || !body.hash) {
    return jsonError("VALIDATION_FAILED", "Некорректные данные Telegram.", null, 400);
  }

  const authDate = Number(body.auth_date);
  if (!Number.isFinite(authDate) || Date.now() / 1000 - authDate > 24 * 60 * 60) {
    return jsonError("SOCIAL_AUTH_EXPIRED", "Данные Telegram устарели.", null, 400);
  }

  if (!verifyTelegramPayload(body, botToken)) {
    return jsonError("SOCIAL_AUTH_FAILED", "Не удалось проверить подпись Telegram.", null, 400);
  }

  const accountSlug = String(body.accountSlug ?? "").trim() || null;
  const result = await completeClientSocialAuth({
    accountSlug,
    profile: {
      provider: "TELEGRAM",
      providerUserId: String(body.id),
      firstName: body.first_name ?? null,
      lastName: body.last_name ?? null,
      displayName: [body.first_name, body.last_name].filter(Boolean).join(" ") || body.username || null,
      username: body.username ?? null,
      avatarUrl: body.photo_url ?? null,
      metadataJson: body,
    },
  });

  return jsonOk({
    ...result,
    returnTo: safeClientReturnTo(body.returnTo, accountSlug),
  });
}

