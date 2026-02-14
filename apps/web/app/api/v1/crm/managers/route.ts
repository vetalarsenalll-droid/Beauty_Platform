import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/api";
import { applyCrmAccessCookie, requireCrmApiPermission } from "@/lib/crm-api";
import { logAccountAudit } from "@/lib/crm-audit";
import { UserStatus } from "@prisma/client";

type DbManager = {
  userId: number;
  roleId: number;
  createdAt: Date;
  user: {
    email: string | null;
    phone: string | null;
    status: string;
    profile: { firstName: string | null; lastName: string | null } | null;
  };
  role: { name: string };
};

function mapManager(item: DbManager) {
  return {
    id: item.userId,
    email: item.user.email,
    phone: item.user.phone,
    status: item.user.status,
    firstName: item.user.profile?.firstName ?? null,
    lastName: item.user.profile?.lastName ?? null,
    role: item.role.name,
    createdAt: item.createdAt.toISOString(),
  };
}

function isUserStatus(value: string): value is UserStatus {
  return value === "ACTIVE" || value === "INVITED" || value === "DISABLED";
}

export async function GET() {
  const auth = await requireCrmApiPermission("crm.specialists.read");
  if ("response" in auth) return auth.response;

  const managers = await prisma.roleAssignment.findMany({
    where: {
      accountId: auth.session.accountId,
      role: { name: "MANAGER" },
    },
    include: { user: { include: { profile: true } }, role: true },
    orderBy: { createdAt: "desc" },
  });

  const response = jsonOk(managers.map((item) => mapManager(item as DbManager)));
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

      const existingAssignment = await tx.roleAssignment.findFirst({
        where: { accountId: auth.session.accountId, userId: user.id },
        include: { role: true },
      });

      if (existingAssignment) {
        throw new Error("MANAGER_EXISTS");
      }

      let role = await tx.role.findFirst({
        where: { accountId: auth.session.accountId, name: "MANAGER" },
      });

      if (!role) {
        role = await tx.role.create({
          data: { accountId: auth.session.accountId, name: "MANAGER" },
        });
      }

      const assignment = await tx.roleAssignment.create({
        data: {
          accountId: auth.session.accountId,
          userId: user.id,
          roleId: role.id,
        },
        include: { user: { include: { profile: true } }, role: true },
      });

      return assignment;
    });

    await logAccountAudit({
      accountId: auth.session.accountId,
      userId: auth.session.userId,
      action: "Создал менеджера",
      targetType: "manager",
      targetId: result.userId,
      diffJson: {
        firstName,
        lastName,
        email,
        phone: result.user.phone ?? null,
        status: result.user.status,
      },
    });

    const response = jsonOk(mapManager(result as DbManager), 201);
    return applyCrmAccessCookie(response, auth);
  } catch (error: any) {
    if (error?.message === "MANAGER_EXISTS") {
      return jsonError(
        "DUPLICATE",
        "Пользователь уже назначен в аккаунте.",
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
      "Не удалось создать менеджера.",
      null,
      500
    );
  }
}
