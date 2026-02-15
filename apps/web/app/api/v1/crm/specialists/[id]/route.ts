import crypto from "crypto";
import { UserStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/api";
import { applyCrmAccessCookie, requireCrmApiPermission } from "@/lib/crm-api";
import { logAccountAudit } from "@/lib/crm-audit";

type DbSpecialist = {
  id: number;
  accountId: number;
  userId: number;
  bio: string | null;
  createdAt: Date;
  updatedAt: Date;
  level: { id: number; name: string; rank: number } | null;
  categories: Array<{
    category: { id: number; name: string; slug: string };
  }>;
  user: {
    email: string | null;
    phone: string | null;
    status: string;
    profile: { firstName: string | null; lastName: string | null } | null;
  };
};

function mapSpecialist(item: DbSpecialist) {
  return {
    id: item.id,
    userId: item.userId,
    email: item.user.email,
    phone: item.user.phone,
    status: item.user.status,
    firstName: item.user.profile?.firstName ?? null,
    lastName: item.user.profile?.lastName ?? null,
    level: item.level
      ? { id: item.level.id, name: item.level.name, rank: item.level.rank }
      : null,
    categories: item.categories.map((item) => ({
      id: item.category.id,
      name: item.category.name,
      slug: item.category.slug,
    })),
    bio: item.bio,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

function hashPassword(password: string, saltHex: string) {
  const salt = Buffer.from(saltHex, "hex");
  return crypto.scryptSync(password, salt, 32).toString("hex");
}

function isUserStatus(value: string): value is UserStatus {
  return value === "ACTIVE" || value === "INVITED" || value === "DISABLED";
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireCrmApiPermission("crm.specialists.read");
  if ("response" in auth) return auth.response;

  const { id } = await context.params;
  const specialistId = Number(id);
  if (!Number.isInteger(specialistId)) {
    return jsonError(
      "INVALID_ID",
      "Некорректный идентификатор специалиста.",
      null,
      400
    );
  }

  const specialist = await prisma.specialistProfile.findFirst({
    where: { id: specialistId, accountId: auth.session.accountId },
    include: {
      user: { include: { profile: true } },
      level: true,
      categories: {
        include: { category: { select: { id: true, name: true, slug: true } } },
      },
    },
  });

  if (!specialist) {
    return jsonError("NOT_FOUND", "Специалист не найден.", null, 404);
  }

  const response = jsonOk(mapSpecialist(specialist as DbSpecialist));
  return applyCrmAccessCookie(response, auth);
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireCrmApiPermission("crm.specialists.update");
  if ("response" in auth) return auth.response;

  const { id } = await context.params;
  const specialistId = Number(id);
  if (!Number.isInteger(specialistId)) {
    return jsonError(
      "INVALID_ID",
      "Некорректный идентификатор специалиста.",
      null,
      400
    );
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return jsonError("INVALID_BODY", "Некорректное тело запроса.", null, 400);
  }

  const firstName =
    body.firstName !== undefined ? String(body.firstName).trim() : undefined;
  const lastName =
    body.lastName !== undefined ? String(body.lastName).trim() : undefined;
  const email = body.email !== undefined ? String(body.email).trim() : undefined;
  const phone =
    body.phone !== undefined ? String(body.phone).trim() : undefined;
  const bio = body.bio !== undefined ? String(body.bio).trim() : undefined;
  let status: UserStatus | undefined;
  if (body.status !== undefined) {
    const parsedStatus = String(body.status).trim();
    if (!isUserStatus(parsedStatus)) {
      return jsonError(
        "VALIDATION_FAILED",
        "Некорректный статус.",
        { fields: [{ path: "status", issue: "invalid" }] },
        400
      );
    }
    status = parsedStatus;
  }
  const password =
    body.password !== undefined ? String(body.password) : undefined;
  const levelIdRaw =
    body.levelId !== undefined ? String(body.levelId).trim() : undefined;
  const categoryIdsRaw = Array.isArray((body as any).categoryIds)
    ? (body as any).categoryIds
    : undefined;
  const categoryIds =
    categoryIdsRaw !== undefined
      ? Array.from(
          new Set(
            categoryIdsRaw
              .map((item: unknown) => Number(item))
              .filter((item: number) => Number.isInteger(item) && item > 0)
          )
        )
      : undefined;

  const hasChanges =
    firstName !== undefined ||
    lastName !== undefined ||
    email !== undefined ||
    phone !== undefined ||
    bio !== undefined ||
    status !== undefined ||
    levelIdRaw !== undefined ||
    categoryIdsRaw !== undefined ||
    password !== undefined;

  if (!hasChanges) {
    return jsonError(
      "VALIDATION_FAILED",
      "Нет данных для обновления.",
      null,
      400
    );
  }

  if (firstName !== undefined && !firstName) {
    return jsonError(
      "VALIDATION_FAILED",
      "Имя обязательно.",
      { fields: [{ path: "firstName", issue: "required" }] },
      400
    );
  }

  if (email !== undefined && !email) {
    return jsonError(
      "VALIDATION_FAILED",
      "Email обязателен.",
      { fields: [{ path: "email", issue: "required" }] },
      400
    );
  }

  if (password !== undefined && password && password.length < 6) {
    return jsonError(
      "VALIDATION_FAILED",
      "Пароль должен быть не короче 6 символов.",
      { fields: [{ path: "password", issue: "min_length" }] },
      400
    );
  }

  const levelId =
    levelIdRaw !== undefined
      ? levelIdRaw === "" || levelIdRaw === "null"
        ? null
        : Number(levelIdRaw)
      : undefined;

  if (levelId !== undefined && levelId !== null && !Number.isInteger(levelId)) {
    return jsonError(
      "VALIDATION_FAILED",
      "Некорректный уровень.",
      { fields: [{ path: "levelId", issue: "invalid" }] },
      400
    );
  }

  if (levelId !== undefined && levelId !== null) {
    const level = await prisma.specialistLevel.findFirst({
      where: {
        id: levelId,
        OR: [{ accountId: auth.session.accountId }, { accountId: null }],
      },
      select: { id: true },
    });
    if (!level) {
      return jsonError(
        "VALIDATION_FAILED",
        "Уровень не найден.",
        { fields: [{ path: "levelId", issue: "not_found" }] },
        400
      );
    }
  }

  if (categoryIdsRaw !== undefined) {
    if (!categoryIds || categoryIds.length !== categoryIdsRaw.length) {
      return jsonError(
        "VALIDATION_FAILED",
        "Некорректные категории специалиста.",
        { fields: [{ path: "categoryIds", issue: "invalid" }] },
        400
      );
    }

    if (categoryIds.length > 0) {
      const existingCategories = await prisma.specialistCategory.findMany({
        where: { accountId: auth.session.accountId, id: { in: categoryIds } },
        select: { id: true },
      });
      if (existingCategories.length !== categoryIds.length) {
        return jsonError(
          "VALIDATION_FAILED",
          "Одна или несколько категорий не найдены.",
          { fields: [{ path: "categoryIds", issue: "not_found" }] },
          400
        );
      }
    }
  }

  const specialist = await prisma.specialistProfile.findFirst({
    where: { id: specialistId, accountId: auth.session.accountId },
    include: {
      user: { include: { profile: true } },
      level: true,
      categories: { select: { categoryId: true } },
    },
  });

  if (!specialist) {
    return jsonError("NOT_FOUND", "Специалист не найден.", null, 404);
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      if (email !== undefined || phone !== undefined || status !== undefined) {
        await tx.user.update({
          where: { id: specialist.userId },
          data: {
            email,
            phone,
            status,
          },
        });
      }

      if (email !== undefined || password !== undefined) {
        const identity = await tx.userIdentity.findFirst({
          where: { userId: specialist.userId, provider: "EMAIL" },
        });
        if (password) {
          const saltHex = crypto.randomBytes(16).toString("hex");
          const passwordHash = hashPassword(password, saltHex);
          if (identity) {
            await tx.userIdentity.update({
              where: { id: identity.id },
              data: {
                email: email ?? identity.email,
                passwordHash,
                passwordSalt: saltHex,
                passwordAlgo: "scrypt",
                passwordUpdatedAt: new Date(),
              },
            });
          } else {
            await tx.userIdentity.create({
              data: {
                userId: specialist.userId,
                provider: "EMAIL",
                email: email ?? specialist.user.email ?? null,
                passwordHash,
                passwordSalt: saltHex,
                passwordAlgo: "scrypt",
                passwordUpdatedAt: new Date(),
              },
            });
          }
        } else if (identity && email !== undefined && email !== identity.email) {
          await tx.userIdentity.update({
            where: { id: identity.id },
            data: { email },
          });
        }
      }

      if (firstName !== undefined || lastName !== undefined) {
        if (specialist.user.profile) {
          await tx.userProfile.update({
            where: { id: specialist.user.profile.id },
            data: {
              firstName: firstName ?? specialist.user.profile.firstName,
              lastName: lastName ?? specialist.user.profile.lastName,
            },
          });
        } else if (firstName) {
          await tx.userProfile.create({
            data: {
              userId: specialist.userId,
              firstName,
              lastName: lastName ?? null,
            },
          });
        }
      }

      const profileUpdate: { levelId?: number | null; bio?: string | null } = {};
      if (levelId !== undefined) profileUpdate.levelId = levelId;
      if (bio !== undefined) profileUpdate.bio = bio || null;

      if (Object.keys(profileUpdate).length > 0) {
        await tx.specialistProfile.update({
          where: { id: specialistId },
          data: profileUpdate,
        });
      }

      if (categoryIds !== undefined) {
        const currentIds = new Set(specialist.categories.map((item) => item.categoryId));
        const nextIds = new Set(categoryIds);
        const toDelete = Array.from(currentIds).filter((id) => !nextIds.has(id));
        const toCreate = Array.from(nextIds).filter((id) => !currentIds.has(id));

        if (toDelete.length > 0) {
          await tx.specialistCategoryLink.deleteMany({
            where: { specialistId, categoryId: { in: toDelete } },
          });
        }
        if (toCreate.length > 0) {
          await tx.specialistCategoryLink.createMany({
            data: toCreate.map((categoryId) => ({ specialistId, categoryId })),
          });
        }
      }

      return tx.specialistProfile.findFirstOrThrow({
        where: { id: specialistId },
        include: {
          user: { include: { profile: true } },
          level: true,
          categories: {
            include: { category: { select: { id: true, name: true, slug: true } } },
          },
        },
      });
    });

    await logAccountAudit({
      accountId: auth.session.accountId,
      userId: auth.session.userId,
      action: "Обновил специалиста",
      targetType: "specialist",
      targetId: updated.id,
      diffJson: {
        firstName,
        lastName,
        email,
        phone,
        status,
        levelId,
        categoryIds,
        bio,
        passwordUpdated: Boolean(password),
      },
    });

    const response = jsonOk(mapSpecialist(updated as DbSpecialist));
    return applyCrmAccessCookie(response, auth);
  } catch (error: any) {
    if (error?.code === "P2002") {
      return jsonError(
        "DUPLICATE",
        "Email уже используется.",
        { field: "email" },
        409
      );
    }
    return jsonError(
      "SERVER_ERROR",
      "Не удалось обновить специалиста.",
      null,
      500
    );
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireCrmApiPermission("crm.specialists.delete");
  if ("response" in auth) return auth.response;

  const { id } = await context.params;
  const specialistId = Number(id);
  if (!Number.isInteger(specialistId)) {
    return jsonError(
      "INVALID_ID",
      "Некорректный идентификатор специалиста.",
      null,
      400
    );
  }

  const specialist = await prisma.specialistProfile.findFirst({
    where: { id: specialistId, accountId: auth.session.accountId },
    include: { user: true },
  });

  if (!specialist) {
    return jsonError("NOT_FOUND", "Специалист не найден.", null, 404);
  }

  await prisma.user.update({
    where: { id: specialist.userId },
    data: { status: "DISABLED" },
  });

  await logAccountAudit({
    accountId: auth.session.accountId,
    userId: auth.session.userId,
    action: "Переместил специалиста в архив",
    targetType: "specialist",
    targetId: specialist.id,
    diffJson: { status: "DISABLED" },
  });

  const response = jsonOk({ ok: true });
  return applyCrmAccessCookie(response, auth);
}
