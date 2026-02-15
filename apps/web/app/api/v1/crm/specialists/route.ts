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

function isUserStatus(value: string): value is UserStatus {
  return value === "ACTIVE" || value === "INVITED" || value === "DISABLED";
}

export async function GET() {
  const auth = await requireCrmApiPermission("crm.specialists.read");
  if ("response" in auth) return auth.response;

  const specialists = await prisma.specialistProfile.findMany({
    where: { accountId: auth.session.accountId },
    include: {
      user: { include: { profile: true } },
      level: true,
      categories: {
        include: { category: { select: { id: true, name: true, slug: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const response = jsonOk(
    specialists.map((item) => mapSpecialist(item as DbSpecialist))
  );
  return applyCrmAccessCookie(response, auth);
}

export async function POST(request: Request) {
  const auth = await requireCrmApiPermission("crm.specialists.create");
  if ("response" in auth) return auth.response;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return jsonError("INVALID_BODY", "Некорректное тело запроса.", null, 400);
  }

  const firstName = String(body.firstName ?? "").trim();
  const lastName = String(body.lastName ?? "").trim();
  const email = String(body.email ?? "").trim();
  const phoneInput =
    body.phone !== undefined ? String(body.phone).trim() : undefined;
  const bio = body.bio ? String(body.bio).trim() : null;
  const levelId =
    body.levelId !== undefined && body.levelId !== null && body.levelId !== ""
      ? Number(body.levelId)
      : null;
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
      : [];
  let statusInput: UserStatus | undefined;
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
    statusInput = parsedStatus;
  }

  if (!firstName || !email) {
    return jsonError(
      "VALIDATION_FAILED",
      "Имя и email обязательны.",
      {
        fields: [
          { path: "firstName", issue: firstName ? null : "required" },
          { path: "email", issue: email ? null : "required" },
        ],
      },
      400
    );
  }

  if (levelId !== null && !Number.isInteger(levelId)) {
    return jsonError(
      "VALIDATION_FAILED",
      "Некорректный уровень.",
      { fields: [{ path: "levelId", issue: "invalid" }] },
      400
    );
  }

  if (levelId !== null) {
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

  if (categoryIdsRaw !== undefined && categoryIds.length !== categoryIdsRaw.length) {
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

  try {
    const result = await prisma.$transaction(async (tx) => {
      const existingUser = await tx.user.findUnique({
        where: { email },
        include: { profile: true },
      });

      const user =
        existingUser ??
        (await tx.user.create({
          data: {
            email,
            phone: phoneInput ? phoneInput : null,
            status: statusInput ?? "INVITED",
            type: "STAFF",
          },
          include: { profile: true },
        }));

      if (existingUser) {
        if (user.type !== "STAFF") {
          throw new Error("USER_TYPE");
        }
        const nextStatus = statusInput ?? user.status;
        await tx.user.update({
          where: { id: user.id },
          data: {
            phone: phoneInput !== undefined ? phoneInput : user.phone,
            status: nextStatus,
          },
        });
      }

      if (user.profile) {
        await tx.userProfile.update({
          where: { id: user.profile.id },
          data: { firstName, lastName: lastName || null },
        });
      } else {
        await tx.userProfile.create({
          data: { userId: user.id, firstName, lastName: lastName || null },
        });
      }

      const existingSpecialist = await tx.specialistProfile.findFirst({
        where: { accountId: auth.session.accountId, userId: user.id },
      });

      if (existingSpecialist) {
        throw new Error("SPECIALIST_EXISTS");
      }

      let role = await tx.role.findFirst({
        where: { accountId: auth.session.accountId, name: "SPECIALIST" },
      });

      if (!role) {
        role = await tx.role.create({
          data: { accountId: auth.session.accountId, name: "SPECIALIST" },
        });
      }

      const existingAssignment = await tx.roleAssignment.findFirst({
        where: { accountId: auth.session.accountId, userId: user.id },
      });

      if (!existingAssignment) {
        await tx.roleAssignment.create({
          data: {
            accountId: auth.session.accountId,
            userId: user.id,
            roleId: role.id,
          },
        });
      }

      const created = await tx.specialistProfile.create({
        data: {
          accountId: auth.session.accountId,
          userId: user.id,
          levelId,
          bio,
        },
        include: {
          user: { include: { profile: true } },
          level: true,
          categories: {
            include: { category: { select: { id: true, name: true, slug: true } } },
          },
        },
      });

      if (categoryIds.length > 0) {
        await tx.specialistCategoryLink.createMany({
          data: categoryIds.map((categoryId) => ({
            specialistId: created.id,
            categoryId,
          })),
        });
      }

      return tx.specialistProfile.findFirstOrThrow({
        where: { id: created.id },
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
      action: "Создал специалиста",
      targetType: "specialist",
      targetId: result.id,
      diffJson: {
        firstName,
        lastName,
        email,
        phone: result.user.phone ?? null,
        levelId,
        categoryIds,
        bio,
        status: result.user.status,
      },
    });

    const response = jsonOk(mapSpecialist(result as DbSpecialist), 201);
    return applyCrmAccessCookie(response, auth);
  } catch (error: any) {
    if (error?.message === "SPECIALIST_EXISTS") {
      return jsonError(
        "DUPLICATE",
        "Специалист с таким email уже существует.",
        { field: "email" },
        409
      );
    }
    if (error?.message === "USER_TYPE") {
      return jsonError(
        "VALIDATION_FAILED",
        "Пользователь с таким email не является сотрудником.",
        { field: "email" },
        400
      );
    }
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
      "Не удалось создать специалиста.",
      null,
      500
    );
  }
}
