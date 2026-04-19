import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/api";
import { applyAccessCookie, requirePlatformApiPermission } from "@/lib/platform-api";
import { logPlatformAudit } from "@/lib/audit";

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePlatformApiPermission("platform.accounts");
  if ("response" in auth) return auth.response;
  const session = auth.session;

  const { id } = await params;
  const accountId = Number(id);
  if (!Number.isInteger(accountId)) {
    return jsonError("VALIDATION_FAILED", "Некорректный id аккаунта", null, 400);
  }

  const body = (await request.json().catch(() => null)) as { email?: string } | null;
  const email = normalizeEmail(String(body?.email ?? ""));
  if (!email || !isValidEmail(email)) {
    return jsonError("VALIDATION_FAILED", "Укажите корректный email для приглашения", null, 400);
  }

  const account = await prisma.account.findUnique({
    where: { id: accountId },
    select: { id: true, status: true, onboardingStatus: true, slug: true },
  });
  if (!account) {
    return jsonError("NOT_FOUND", "Аккаунт не найден", null, 404);
  }
  if (account.status === "ARCHIVED") {
    return jsonError("FORBIDDEN", "Нельзя отправить приглашение для архивного аккаунта", null, 403);
  }

  const rawToken = crypto.randomBytes(24).toString("hex");
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await prisma.$transaction(async (tx) => {
    await tx.accountInvite.updateMany({
      where: { accountId, email, acceptedAt: null },
      data: { expiresAt: new Date() },
    });

    await tx.accountInvite.create({
      data: {
        accountId,
        email,
        tokenHash,
        invitedByAdminId: session.adminId,
        expiresAt,
      },
    });

    await tx.account.update({
      where: { id: accountId },
      data: { onboardingStatus: "INVITED" },
    });
  });

  await logPlatformAudit({
    adminId: session.adminId,
    action: "Отправлено приглашение на регистрацию",
    targetType: "account",
    targetId: accountId,
    diffJson: {
      email,
      onboardingStatus: "INVITED",
      expiresAt: expiresAt.toISOString(),
    },
  });

  const inviteUrl = `https://onlais.ru/crm/register?invite=${rawToken}&email=${encodeURIComponent(email)}&account=${account.slug}`;
  const response = jsonOk(
    {
      accountId,
      email,
      onboardingStatus: "INVITED",
      expiresAt: expiresAt.toISOString(),
      inviteUrl,
      ...(process.env.NODE_ENV !== "production" ? { inviteToken: rawToken } : {}),
    },
    201
  );
  return applyAccessCookie(response, auth);
}

