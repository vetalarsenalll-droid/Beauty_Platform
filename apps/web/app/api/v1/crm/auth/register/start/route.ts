import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/api";
import { enforceRateLimit } from "@/lib/rate-limit";
import { sendRegisterOtpEmail } from "@/lib/smtp";
import {
  clearCaptchaRisk,
  shouldRequireCaptcha,
  verifyCaptchaChallenge,
} from "@/lib/captcha";

const PURPOSE = "CRM_REGISTER";

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function hashCode(code: string) {
  return crypto.createHash("sha256").update(code).digest("hex");
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    email?: string;
    password?: string;
    captchaId?: string;
    captchaAnswer?: string;
  } | null;

  const email = normalizeEmail(String(body?.email ?? ""));
  const password = String(body?.password ?? "");
  const captchaId = String(body?.captchaId ?? "").trim();
  const captchaAnswer = String(body?.captchaAnswer ?? "").trim();

  if (!email || !password) {
    return jsonError(
      "VALIDATION_FAILED",
      "Email и пароль обязательны",
      { fields: ["email", "password"] },
      400
    );
  }

  if (!isValidEmail(email)) {
    return jsonError("INVALID_EMAIL", "Укажите корректный email", null, 400);
  }

  if (password.length < 8) {
    return jsonError(
      "WEAK_PASSWORD",
      "Пароль должен содержать минимум 8 символов",
      null,
      400
    );
  }

  const limited = enforceRateLimit({
    request,
    scope: "auth:crm-register-start",
    limit: 8,
    windowMs: 10 * 60 * 1000,
    identity: email,
  });
  if (limited) return limited;

  const requiresCaptcha = shouldRequireCaptcha({
    request,
    scope: "auth:crm-register-start",
    identity: email,
    threshold: 3,
    windowMs: 10 * 60 * 1000,
  });

  if (requiresCaptcha) {
    if (!captchaId || !captchaAnswer) {
      return jsonError(
        "CAPTCHA_REQUIRED",
        "Требуется подтверждение captcha",
        { captchaRequired: true },
        428
      );
    }

    const captchaCheck = verifyCaptchaChallenge({
      request,
      scope: "auth:crm-register-start",
      captchaId,
      answer: captchaAnswer,
    });

    if (!captchaCheck.ok) {
      return jsonError(
        captchaCheck.code,
        "Captcha не пройдена",
        { captchaRequired: true },
        400
      );
    }

    clearCaptchaRisk({
      request,
      scope: "auth:crm-register-start",
      identity: email,
    });
  }

  const existingIdentity = await prisma.userIdentity.findFirst({
    where: { provider: "EMAIL", email },
    select: { id: true },
  });

  if (existingIdentity) {
    return jsonError(
      "EMAIL_ALREADY_REGISTERED",
      "Пользователь с таким email уже зарегистрирован",
      null,
      409
    );
  }

  await prisma.emailVerificationToken.updateMany({
    where: { email, purpose: PURPOSE, consumedAt: null },
    data: { consumedAt: new Date() },
  });

  const code = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

  await prisma.emailVerificationToken.create({
    data: {
      email,
      purpose: PURPOSE,
      codeHash: hashCode(code),
      expiresAt,
    },
  });

  try {
    await sendRegisterOtpEmail({
      to: email,
      code,
      expiresAt,
    });
  } catch (cause) {
    const smtpCode =
      cause && typeof cause === "object" && "code" in cause
        ? String((cause as { code?: string }).code ?? "")
        : "";

    if (smtpCode === "SMTP_NOT_CONFIGURED") {
      return jsonError(
        "SMTP_NOT_CONFIGURED",
        "Не настроена отправка email-кодов подтверждения",
        null,
        500
      );
    }

    return jsonError(
      "OTP_EMAIL_SEND_FAILED",
      "Не удалось отправить код подтверждения на email",
      null,
      502
    );
  }

  return jsonOk({
    email,
    expiresAt: expiresAt.toISOString(),
  });
}
