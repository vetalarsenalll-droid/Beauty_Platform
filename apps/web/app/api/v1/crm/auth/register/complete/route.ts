import crypto from "crypto";
import { cookies } from "next/headers";
import { BusinessType, LegalType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createSession, getCrmAuthCookies } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/api";
import { enforceRateLimit } from "@/lib/rate-limit";
import { createDefaultDraft } from "@/lib/site-builder";
import { normalizeRuPhone } from "@/lib/phone";
import { isBusinessType, isLegalType } from "@/lib/business-catalog";
import { applyBusinessTypeSiteCopy } from "@/lib/business-site-copy";
import { logAccountAudit } from "@/lib/crm-audit";

const PURPOSE = "CRM_REGISTER";
const CONSENT_DOCS = [
  {
    consentKey: "terms",
    key: "user-agreement",
    title: "Пользовательское соглашение (оферта)",
    isRequired: true,
    sortOrder: 1,
    content:
      "Пользовательское соглашение ONLAIS. Полная редакция будет размещена в разделе правовых документов.",
  },
  {
    consentKey: "privacy",
    key: "privacy-policy",
    title: "Политика конфиденциальности",
    isRequired: true,
    sortOrder: 2,
    content:
      "Политика конфиденциальности ONLAIS. Полная редакция будет размещена в разделе правовых документов.",
  },
  {
    consentKey: "pdConsent",
    key: "personal-data-consent",
    title: "Согласие на обработку персональных данных",
    isRequired: true,
    sortOrder: 3,
    content:
      "Согласие на обработку персональных данных. Полная редакция будет размещена в разделе правовых документов.",
  },
  {
    consentKey: "dpa",
    key: "pd-processing-order",
    title: "Поручение на обработку персональных данных",
    isRequired: true,
    sortOrder: 4,
    content:
      "Поручение на обработку персональных данных. Полная редакция будет размещена в разделе правовых документов.",
  },
  {
    consentKey: "marketing",
    key: "marketing-consent",
    title: "Согласие на рекламно-информационные рассылки",
    isRequired: false,
    sortOrder: 5,
    content:
      "Согласие на рекламно-информационные рассылки. Полная редакция будет размещена в разделе правовых документов.",
  },
  {
    consentKey: "cookies",
    key: "cookie-policy",
    title: "Политика использования cookie",
    isRequired: false,
    sortOrder: 6,
    content:
      "Политика использования cookie. Полная редакция будет размещена в разделе правовых документов.",
  },
] as const;

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function hashPassword(password: string, saltHex: string) {
  const salt = Buffer.from(saltHex, "hex");
  return crypto.scryptSync(password, salt, 32).toString("hex");
}

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9а-яё\s-]/gi, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

async function generateUniqueSlug(name: string) {
  const base = slugify(name) || "business";
  let slug = base;
  let counter = 2;

  while (true) {
    const exists = await prisma.account.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!exists) return slug;
    slug = `${base}-${counter}`;
    counter += 1;
  }
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    email?: string;
    password?: string;
    businessName?: string;
    legalType?: LegalType;
    businessType?: BusinessType;
    phone?: string;
    timeZone?: string;
    inviteToken?: string;
    consents?: {
      terms?: boolean;
      privacy?: boolean;
      pdConsent?: boolean;
      dpa?: boolean;
      marketing?: boolean;
    };
  } | null;

  const email = normalizeEmail(String(body?.email ?? ""));
  const password = String(body?.password ?? "");
  const businessName = String(body?.businessName ?? "").trim();
  const legalTypeRaw = String(body?.legalType ?? "").trim();
  const businessTypeRaw = String(body?.businessType ?? "").trim();
  const rawPhone = String(body?.phone ?? "").trim();
  const phone = normalizeRuPhone(rawPhone);
  const timeZone = String(body?.timeZone ?? "Europe/Moscow").trim() || "Europe/Moscow";
  const inviteToken = String(body?.inviteToken ?? "").trim();
  const legalType = isLegalType(legalTypeRaw) ? legalTypeRaw : null;
  const businessType = isBusinessType(businessTypeRaw) ? businessTypeRaw : null;
  const ip = request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip") ?? null;
  const userAgent = request.headers.get("user-agent") ?? null;

  if (!email || !password || !businessName || !legalType || !businessType || !rawPhone) {
    return jsonError(
      "VALIDATION_FAILED",
      "Заполните обязательные поля регистрации",
      {
        fields: ["email", "password", "businessName", "legalType", "businessType", "phone"],
      },
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

  if (!phone) {
    return jsonError("INVALID_PHONE", "Укажите корректный номер телефона", null, 400);
  }

  if (!legalType) {
    return jsonError(
      "INVALID_LEGAL_TYPE",
      "Укажите корректную организационно-правовую форму",
      null,
      400
    );
  }

  if (!businessType) {
    return jsonError(
      "INVALID_BUSINESS_TYPE",
      "Укажите корректное направление деятельности",
      null,
      400
    );
  }

  const requiredConsents = body?.consents;
  if (
    !requiredConsents?.terms ||
    !requiredConsents?.privacy ||
    !requiredConsents?.pdConsent ||
    !requiredConsents?.dpa
  ) {
    return jsonError(
      "CONSENTS_REQUIRED",
      "Необходимо принять обязательные документы",
      {
        required: ["terms", "privacy", "pdConsent", "dpa"],
      },
      400
    );
  }

  const limited = enforceRateLimit({
    request,
    scope: "auth:crm-register-complete",
    limit: 6,
    windowMs: 10 * 60 * 1000,
    identity: email,
  });
  if (limited) return limited;

  const verification = await prisma.emailVerificationToken.findFirst({
    where: {
      email,
      purpose: PURPOSE,
      consumedAt: { not: null },
      expiresAt: { gt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
    orderBy: { consumedAt: "desc" },
  });

  if (!verification) {
    return jsonError(
      "EMAIL_NOT_VERIFIED",
      "Сначала подтвердите email кодом",
      null,
      400
    );
  }

  const invite = inviteToken
    ? await prisma.accountInvite.findFirst({
        where: {
          tokenHash: hashToken(inviteToken),
          acceptedAt: null,
          expiresAt: { gt: new Date() },
        },
        select: { id: true, email: true, accountId: true },
      })
    : null;

  if (inviteToken && !invite) {
    return jsonError("INVITE_INVALID", "Приглашение недействительно или истекло", null, 400);
  }

  if (invite && invite.email !== email) {
    return jsonError("INVITE_EMAIL_MISMATCH", "Email не совпадает с приглашением", null, 400);
  }

  const existingByEmail = await prisma.userIdentity.findFirst({
    where: { provider: "EMAIL", email },
    select: { id: true },
  });
  if (existingByEmail) {
    return jsonError(
      "EMAIL_ALREADY_REGISTERED",
      "Пользователь с таким email уже зарегистрирован",
      null,
      409
    );
  }

  const existingByPhone = await prisma.user.findFirst({
    where: { phone },
    select: { id: true },
  });
  if (existingByPhone) {
    return jsonError(
      "PHONE_ALREADY_REGISTERED",
      "Пользователь с таким номером телефона уже зарегистрирован",
      null,
      409
    );
  }

  const slug = invite ? null : await generateUniqueSlug(businessName);
  const saltHex = crypto.randomBytes(16).toString("hex");
  const passwordHash = hashPassword(password, saltHex);

  try {
    const created = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          phone,
          type: "STAFF",
          status: "ACTIVE",
          identities: {
            create: {
              provider: "EMAIL",
              email,
              passwordHash,
              passwordSalt: saltHex,
              passwordAlgo: "scrypt",
            },
          },
        },
      });

      const account = invite
        ? await tx.account.update({
            where: { id: invite.accountId },
            data: {
              name: businessName,
              timeZone,
              legalType,
              businessType,
              onboardingCompletedAt: new Date(),
              onboardingStatus: "ACTIVE",
              status: "ACTIVE",
              profile: {
                upsert: {
                  create: { phone, email },
                  update: { phone, email },
                },
              },
            },
          })
        : await tx.account.create({
            data: {
              name: businessName,
              slug: slug!,
              timeZone,
              legalType,
              businessType,
              onboardingCompletedAt: new Date(),
              onboardingStatus: "ACTIVE",
              profile: {
                create: {
                  phone,
                  email,
                },
              },
            },
          });

      const ownerRole =
        (await tx.role.findFirst({
          where: {
            accountId: account.id,
            name: "OWNER",
          },
        })) ??
        (await tx.role.create({
          data: {
            accountId: account.id,
            name: "OWNER",
          },
        }));

      const crmAllPermission = await tx.permission.upsert({
        where: { key: "crm.all" },
        update: {},
        create: {
          key: "crm.all",
          description: "Полный доступ в CRM",
        },
      });

      await tx.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: ownerRole.id,
            permissionId: crmAllPermission.id,
          },
        },
        update: {},
        create: {
          roleId: ownerRole.id,
          permissionId: crmAllPermission.id,
        },
      });

      await tx.roleAssignment.create({
        data: {
          userId: user.id,
          accountId: account.id,
          roleId: ownerRole.id,
        },
      });

      const starterDraft = applyBusinessTypeSiteCopy(
        createDefaultDraft(businessName),
        businessType
      );

      const existingPublicPage = await tx.publicPage.findFirst({
        where: { accountId: account.id },
        select: { id: true },
      });
      if (existingPublicPage) {
        await tx.publicPage.update({
          where: { id: existingPublicPage.id },
          data: {
            status: "DRAFT",
            draftJson: starterDraft as Prisma.InputJsonValue,
          },
        });
      } else {
        await tx.publicPage.create({
          data: {
            accountId: account.id,
            status: "DRAFT",
            draftJson: starterDraft as Prisma.InputJsonValue,
          },
        });
      }

      const acceptedConsentKeys = new Set<string>([
        "terms",
        "privacy",
        "pdConsent",
        "dpa",
        ...(body?.consents?.marketing ? ["marketing"] : []),
      ]);

      const acceptedLegalDocs: Array<{ key: string; versionId: number }> = [];

      for (const item of CONSENT_DOCS) {
        const document = await tx.legalDocument.upsert({
          where: {
            accountId_key: {
              accountId: account.id,
              key: item.key,
            },
          },
          create: {
            accountId: account.id,
            key: item.key,
            title: item.title,
            isRequired: item.isRequired,
            sortOrder: item.sortOrder,
          },
          update: {
            title: item.title,
            isRequired: item.isRequired,
            sortOrder: item.sortOrder,
          },
        });

        let version = await tx.legalDocumentVersion.findFirst({
          where: { documentId: document.id, isActive: true },
          orderBy: { version: "desc" },
        });
        if (!version) {
          version = await tx.legalDocumentVersion.create({
            data: {
              documentId: document.id,
              version: 1,
              content: item.content,
              isActive: true,
            },
          });
        }

        if (acceptedConsentKeys.has(item.consentKey)) {
          const acceptance = await tx.legalAcceptance.create({
            data: {
              accountId: account.id,
              documentVersionId: version.id,
              source: "crm_register",
              ip,
              userAgent,
            },
          });

          if (acceptance.id > 0) {
            acceptedLegalDocs.push({ key: item.key, versionId: version.id });
          }
        }
      }

      if (invite) {
        await tx.accountInvite.update({
          where: { id: invite.id },
          data: { acceptedAt: new Date(), acceptedByUserId: user.id },
        });
      }

      return { user, account, role: ownerRole, acceptedLegalDocs };
    });

    await prisma.userSession.deleteMany({
      where: {
        userId: created.user.id,
        sessionType: "CRM",
        accountId: created.account.id,
      },
    });

    const { accessToken, refreshToken, accessExpiresAt, refreshExpiresAt } =
      await createSession({
        userId: created.user.id,
        sessionType: "CRM",
        accountId: created.account.id,
      });

    const cookieStore = await cookies();
    const { ACCESS_COOKIE, REFRESH_COOKIE } = getCrmAuthCookies();

    cookieStore.set(ACCESS_COOKIE, accessToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      expires: accessExpiresAt,
    });
    cookieStore.set(REFRESH_COOKIE, refreshToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      expires: refreshExpiresAt,
    });

    await logAccountAudit({
      accountId: created.account.id,
      userId: created.user.id,
      action: "auth.register.complete",
      targetType: "account",
      targetId: created.account.id,
      ipAddress: ip,
      diffJson: {
        legalType: created.account.legalType,
        businessType: created.account.businessType,
        acceptedDocuments: created.acceptedLegalDocs,
      },
    });

    return jsonOk(
      {
        user: { id: created.user.id, email: created.user.email },
        account: {
          id: created.account.id,
          name: created.account.name,
          slug: created.account.slug,
          timeZone: created.account.timeZone,
          legalType: created.account.legalType,
          businessType: created.account.businessType,
        },
        role: created.role.name,
        permissions: ["crm.all"],
        accessExpiresAt: accessExpiresAt.toISOString(),
        refreshExpiresAt: refreshExpiresAt.toISOString(),
      },
      201
    );
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        const target = Array.isArray(error.meta?.target)
          ? error.meta.target.join(",")
          : String(error.meta?.target ?? "");
        if (target.includes("email")) {
          return jsonError(
            "EMAIL_ALREADY_REGISTERED",
            "Пользователь с таким email уже зарегистрирован",
            null,
            409
          );
        }
        if (target.includes("phone")) {
          return jsonError(
            "PHONE_ALREADY_REGISTERED",
            "Пользователь с таким номером телефона уже зарегистрирован",
            null,
            409
          );
        }
        if (target.includes("slug")) {
          return jsonError("SLUG_CONFLICT", "Публичная ссылка уже занята", null, 409);
        }
      }
    }

    return jsonError(
      "REGISTRATION_FAILED",
      "Не удалось завершить регистрацию. Попробуйте позже",
      null,
      500
    );
  }
}
