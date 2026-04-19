import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/api";
import { enforceRateLimit } from "@/lib/rate-limit";

const PURPOSE = "CRM_REGISTER";

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function hashCode(code: string) {
  return crypto.createHash("sha256").update(code).digest("hex");
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    email?: string;
    code?: string;
  } | null;

  const email = normalizeEmail(String(body?.email ?? ""));
  const code = String(body?.code ?? "").trim();

  if (!email || !code) {
    return jsonError(
      "VALIDATION_FAILED",
      "Email и код обязательны",
      { fields: ["email", "code"] },
      400
    );
  }

  const limited = enforceRateLimit({
    request,
    scope: "auth:crm-register-verify",
    limit: 12,
    windowMs: 10 * 60 * 1000,
    identity: email,
  });
  if (limited) return limited;

  const token = await prisma.emailVerificationToken.findFirst({
    where: {
      email,
      purpose: PURPOSE,
      consumedAt: null,
    },
    orderBy: { createdAt: "desc" },
  });

  if (!token) {
    return jsonError("TOKEN_NOT_FOUND", "Код подтверждения не найден", null, 404);
  }

  if (token.expiresAt.getTime() <= Date.now()) {
    return jsonError("TOKEN_EXPIRED", "Срок действия кода истек", null, 400);
  }

  if (token.attempts >= 10) {
    return jsonError("TOO_MANY_ATTEMPTS", "Превышено число попыток", null, 429);
  }

  const valid = token.codeHash === hashCode(code);

  if (!valid) {
    await prisma.emailVerificationToken.update({
      where: { id: token.id },
      data: { attempts: { increment: 1 } },
    });
    return jsonError("INVALID_CODE", "Неверный код подтверждения", null, 400);
  }

  await prisma.emailVerificationToken.update({
    where: { id: token.id },
    data: { consumedAt: new Date() },
  });

  return jsonOk({ verified: true, email, verifiedAt: new Date().toISOString() });
}
