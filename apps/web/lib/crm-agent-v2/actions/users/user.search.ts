import { prisma } from "@/lib/prisma";
import { numberOrNull, optionalString, type JsonRecord } from "../action-helpers";
import { defineCrmAgentAction } from "../define-action";

export const userSearchAction = defineCrmAgentAction({
  name: "user.search",
  domain: "users",
  kind: "read",
  intent: "read",
  status: "read_only",
  risk: "low",
  permission: "crm.users.read",
  confirmation: "never",
  requiredSlots: [],
  optionalSlots: ["query", "take"],
  description: "Найти пользователей аккаунта.",
  plannerHints: ["Use user.search when the user asks to inspect: Найти пользователей аккаунта."],
  read: async (payload: JsonRecord, ctx) => {
    const query = optionalString(payload, "query");
    const take = clampTake(payload.take, 20, 50);
    const assignments = await prisma.roleAssignment.findMany({
      where: {
        accountId: ctx.accountId,
        ...(query
          ? {
              user: {
                OR: [
                  { email: { contains: query, mode: "insensitive" } },
                  { phone: { contains: query } },
                  { profile: { firstName: { contains: query, mode: "insensitive" } } },
                  { profile: { lastName: { contains: query, mode: "insensitive" } } },
                ],
              },
            }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      take,
      select: {
        user: { select: { id: true, email: true, phone: true, status: true, type: true, createdAt: true, profile: true } },
        role: { select: { id: true, name: true } },
      },
    });
    return {
      users: assignments.map(({ user, role }) => ({
        ...serializeUser(user),
        role,
      })),
    };
  },
});

export function serializeUser(user: {
  id: number;
  email: string | null;
  phone: string | null;
  status: unknown;
  type: unknown;
  createdAt: Date;
  profile: { firstName: string | null; lastName: string | null; avatarUrl: string | null } | null;
}) {
  return {
    id: user.id,
    email: user.email,
    phone: user.phone,
    status: user.status,
    type: user.type,
    createdAt: user.createdAt.toISOString(),
    profile: user.profile,
    displayName: [user.profile?.firstName, user.profile?.lastName].filter(Boolean).join(" ").trim() || null,
  };
}

function clampTake(value: unknown, fallback: number, max: number) {
  const take = numberOrNull(value) ?? fallback;
  return Math.min(Math.max(Math.trunc(take), 1), max);
}
