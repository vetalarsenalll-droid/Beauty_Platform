import { prisma } from "@/lib/prisma";
import { requiredNumber, type JsonRecord } from "../action-helpers";
import { defineCrmAgentAction } from "../define-action";
import { serializeUser } from "./user.search";

export const userViewAction = defineCrmAgentAction({
  name: "user.view",
  domain: "users",
  kind: "read",
  intent: "read",
  status: "read_only",
  risk: "low",
  permission: "crm.users.read",
  confirmation: "never",
  requiredSlots: ["userId"],
  optionalSlots: [],
  description: "Показать пользователя, профиль, роли, статус.",
  plannerHints: ["Use user.view when the user asks to inspect: Показать пользователя, профиль, роли, статус."],
  read: async (payload: JsonRecord, ctx) => {
    const userId = requiredNumber(payload.userId, "userId");
    const assignment = await prisma.roleAssignment.findFirst({
      where: { accountId: ctx.accountId, userId },
      select: {
        user: {
          select: {
            id: true,
            email: true,
            phone: true,
            status: true,
            type: true,
            createdAt: true,
            updatedAt: true,
            profile: true,
            specialistProfiles: {
              where: { accountId: ctx.accountId },
              select: { id: true, isPublic: true, bio: true, levelId: true },
            },
          },
        },
        role: { select: { id: true, name: true, permissions: { select: { permission: { select: { key: true } } } } } },
      },
    });
    if (!assignment) throw new Error("User not found.");
    return {
      user: {
        ...serializeUser(assignment.user),
        updatedAt: assignment.user.updatedAt.toISOString(),
        role: {
          id: assignment.role.id,
          name: assignment.role.name,
          permissions: assignment.role.permissions.map((item) => item.permission.key),
        },
        specialistProfiles: assignment.user.specialistProfiles,
      },
    };
  },
});
