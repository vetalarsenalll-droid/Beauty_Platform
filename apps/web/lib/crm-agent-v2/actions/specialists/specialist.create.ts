import { UserStatus } from "@prisma/client";
import { normalizeRuPhone } from "@/lib/phone";
import { prisma } from "@/lib/prisma";
import { buildActionPreview } from "../action-preview";
import { defineCrmAgentAction } from "../define-action";

type SpecialistCreatePayload = Record<string, unknown>;

export const specialistCreateAction = defineCrmAgentAction({
  name: "specialist.create",
  domain: "specialists",
  kind: "write",
  intent: "create",
  status: "implemented",
  risk: "medium",
  permission: "crm.specialists.create",
  confirmation: "medium_plus",
  requiredSlots: ["name"],
  optionalSlots: ["firstName", "lastName", "phone", "email", "bio", "levelId", "categoryIds", "status", "isPublic"],
  description: "Зарегистрировать специалиста в CRM. Минимум: ФИО/имя. График и услуги не обязательны.",
  plannerHints: [
    "Use specialist.create only after required slots are resolved and the user intent matches: Зарегистрировать специалиста в CRM. Минимум: ФИО/имя. График и услуги не обязательны.",
  ],
  preview: async (payload: SpecialistCreatePayload) => {
    const nameParts = splitSpecialistName(payload);
    return buildActionPreview({
      after: {
        ...payload,
        firstName: optionalString(payload, "firstName") ?? nameParts.firstName,
        lastName: optionalString(payload, "lastName") ?? nameParts.lastName,
        status: optionalString(payload, "status") ?? "INVITED",
        isPublic: typeof payload.isPublic === "boolean" ? payload.isPublic : true,
      },
    });
  },
  execute: async (payload: SpecialistCreatePayload, ctx) => {
    const nameParts = splitSpecialistName(payload);
    const firstName = requiredResolvedString(nameParts.firstName, "firstName");
    const lastName = nameParts.lastName;
    const email = optionalString(payload, "email");
    const phoneRaw = optionalString(payload, "phone");
    const phone = phoneRaw ? normalizeRuPhone(phoneRaw) : null;
    if (phoneRaw && !phone) throw new Error("Action payload phone must be a valid Russian phone.");
    const levelId = numberOrNull(payload.levelId);
    const categoryIds = numberArray(payload.categoryIds);
    const status = optionalUserStatus(payload, "status") ?? UserStatus.INVITED;

    if (levelId != null) await assertSpecialistLevelBelongsToAccount(ctx.accountId, levelId);
    if (categoryIds.length) await assertSpecialistCategoriesBelongToAccount(ctx.accountId, categoryIds);

    const specialist = await prisma.$transaction(async (tx) => {
      const existingUser =
        email || phone
          ? await tx.user.findFirst({
              where: {
                OR: [email ? { email } : null, phone ? { phone } : null].filter(
                  (item): item is { email: string } | { phone: string } => Boolean(item),
                ),
              },
              include: { profile: true },
            })
          : null;

      const user =
        existingUser ??
        (await tx.user.create({
          data: {
            email,
            phone,
            status,
            type: "STAFF",
          },
        }));

      if (existingUser) {
        if (user.type !== "STAFF") throw new Error("User is not a staff member.");
        await tx.user.update({
          where: { id: user.id },
          data: {
            ...(email ? { email } : {}),
            ...(phone ? { phone } : {}),
            ...(payload.status !== undefined ? { status } : {}),
          },
        });
      }

      const profile = await tx.userProfile.findUnique({ where: { userId: user.id } });
      if (profile) {
        await tx.userProfile.update({
          where: { id: profile.id },
          data: { firstName, lastName },
        });
      } else {
        await tx.userProfile.create({ data: { userId: user.id, firstName, lastName } });
      }

      const existingSpecialist = await tx.specialistProfile.findFirst({
        where: { accountId: ctx.accountId, userId: user.id },
        select: { id: true },
      });
      if (existingSpecialist) throw new Error("Specialist already exists.");

      let role = await tx.role.findFirst({ where: { accountId: ctx.accountId, name: "SPECIALIST" } });
      if (!role) {
        role = await tx.role.create({ data: { accountId: ctx.accountId, name: "SPECIALIST" } });
      }

      const existingAssignment = await tx.roleAssignment.findFirst({
        where: { accountId: ctx.accountId, userId: user.id },
        select: { id: true },
      });
      if (!existingAssignment) {
        await tx.roleAssignment.create({ data: { accountId: ctx.accountId, userId: user.id, roleId: role.id } });
      }

      const created = await tx.specialistProfile.create({
        data: {
          accountId: ctx.accountId,
          userId: user.id,
          levelId,
          bio: optionalString(payload, "bio"),
          isPublic: optionalBoolean(payload, "isPublic") ?? true,
        },
      });

      if (categoryIds.length) {
        await tx.specialistCategoryLink.createMany({
          data: categoryIds.map((categoryId) => ({ specialistId: created.id, categoryId })),
        });
      }

      return created;
    });

    return { status: "DONE", data: { specialistId: specialist.id } };
  },
});

async function assertSpecialistLevelBelongsToAccount(accountId: number, levelId: number) {
  const level = await prisma.specialistLevel.findFirst({
    where: { id: levelId, OR: [{ accountId }, { accountId: null }] },
    select: { id: true },
  });
  if (!level) throw new Error("Specialist level not found.");
}

async function assertSpecialistCategoriesBelongToAccount(accountId: number, categoryIds: number[]) {
  const categories = await prisma.specialistCategory.findMany({
    where: { accountId, id: { in: categoryIds } },
    select: { id: true },
  });
  if (categories.length !== categoryIds.length) throw new Error("Specialist category not found.");
}

function requiredResolvedString(value: unknown, key: string) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`Action payload ${key} is required.`);
  return value.trim();
}

function optionalString(payload: SpecialistCreatePayload, key: string) {
  const value = payload[key];
  return typeof value === "string" ? value.trim() : null;
}

function numberOrNull(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function numberArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.filter((item): item is number => typeof item === "number" && Number.isInteger(item) && item > 0)));
}

function optionalBoolean(payload: SpecialistCreatePayload, key: string) {
  const value = payload[key];
  return typeof value === "boolean" ? value : null;
}

function optionalUserStatus(payload: SpecialistCreatePayload, key: string) {
  const value = optionalString(payload, key);
  if (!value) return null;
  if (value === UserStatus.ACTIVE || value === UserStatus.INVITED || value === UserStatus.DISABLED) return value;
  throw new Error(`Action payload ${key} must be ACTIVE, INVITED or DISABLED.`);
}

function splitSpecialistName(payload: SpecialistCreatePayload) {
  const explicitFirstName = optionalString(payload, "firstName");
  const explicitLastName = optionalString(payload, "lastName");
  const fullName = optionalString(payload, "name") ?? [explicitLastName, explicitFirstName].filter(Boolean).join(" ");
  const parts = fullName.split(/\s+/).filter(Boolean);
  return {
    firstName: explicitFirstName ?? parts[1] ?? parts[0] ?? "",
    lastName: explicitLastName ?? (parts.length > 1 ? parts[0] : null),
  };
}
