import crypto from "crypto";
import { IdentityProvider, RoleName, UserStatus, UserType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { normalizeRuPhone } from "@/lib/phone";
import { buildActionPreview } from "../action-preview";
import { inputJson, numberOrNull, optionalString, requiredNumber, requiredString, type JsonRecord } from "../action-helpers";
import type { CrmAgentActionContext } from "../types";
import { serializeUser } from "./user.search";

type UserForPreview = {
  id: number;
  email: string | null;
  phone: string | null;
  status: UserStatus;
  type: UserType;
  createdAt: Date;
  profile: { firstName: string | null; lastName: string | null; avatarUrl: string | null } | null;
  roleAssignments: { role: { id: number; name: RoleName } }[];
  identities?: { id: number; provider: IdentityProvider; providerUserId: string | null; email: string | null; phone: string | null }[];
};

const ROLE_NAMES: RoleName[] = ["OWNER", "MANAGER", "SPECIALIST", "READONLY"];
const IDENTITY_PROVIDERS: IdentityProvider[] = ["EMAIL", "PHONE", "TELEGRAM", "MAX", "VK", "YANDEX"];

export async function previewUserPayload(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const userId = numberOrNull(payload.userId);
  const before = userId ? await findAccountUser(ctx.accountId, userId) : null;
  return buildActionPreview({ before: before ? serializeAccountUser(before) : null, after: payload });
}

export async function previewRolePayload(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const roleId = numberOrNull(payload.roleId);
  const before = roleId ? await findRole(ctx.accountId, roleId) : null;
  return buildActionPreview({ before: before ? serializeRole(before) : null, after: payload });
}

export async function readRoles(accountId: number) {
  const roles = await prisma.role.findMany({
    where: { accountId },
    orderBy: { name: "asc" },
    include: { permissions: { include: { permission: true }, orderBy: { permission: { key: "asc" } } }, _count: { select: { assignments: true } } },
  });
  return { roles: roles.map(serializeRole) };
}

export async function readPermissionMatrix(accountId: number) {
  const [roles, permissions] = await Promise.all([
    prisma.role.findMany({
      where: { accountId },
      orderBy: { name: "asc" },
      include: { permissions: { include: { permission: true }, orderBy: { permission: { key: "asc" } } }, _count: { select: { assignments: true } } },
    }),
    prisma.permission.findMany({ orderBy: { key: "asc" } }),
  ]);
  return {
    roles: roles.map(serializeRole),
    permissions: permissions.map((permission) => ({ id: permission.id, key: permission.key, description: permission.description })),
  };
}

export async function executeRoleCreate(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const role = await prisma.role.create({ data: { accountId: ctx.accountId, name: roleName(payload.name ?? payload.roleName) } });
  return { status: "DONE" as const, data: { roleId: role.id, name: role.name } };
}

export async function executeRoleUpdate(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const roleId = requiredNumber(payload.roleId, "roleId");
  await assertRole(ctx.accountId, roleId);
  const role = await prisma.role.update({ where: { id: roleId }, data: { name: roleName(payload.name ?? payload.roleName) } });
  return { status: "DONE" as const, data: { roleId: role.id, name: role.name } };
}

export async function executeRoleDelete(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const roleId = requiredNumber(payload.roleId, "roleId");
  const role = await prisma.role.findFirst({ where: { id: roleId, accountId: ctx.accountId }, include: { _count: { select: { assignments: true } } } });
  if (!role) throw new Error("Role not found.");
  if (role.name === "OWNER") throw new Error("Owner role cannot be deleted.");
  if (role._count.assignments > 0) throw new Error("Role has assigned users.");
  await prisma.role.delete({ where: { id: roleId } });
  return { status: "DONE" as const, data: { roleId, deleted: true } };
}

export async function executePermissionAssign(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const roleId = await resolveRoleId(ctx.accountId, payload);
  const permissionId = await resolvePermissionId(payload);
  await prisma.rolePermission.upsert({
    where: { roleId_permissionId: { roleId, permissionId } },
    update: {},
    create: { roleId, permissionId },
  });
  return { status: "DONE" as const, data: { roleId, permissionId, assigned: true } };
}

export async function executePermissionRevoke(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const roleId = await resolveRoleId(ctx.accountId, payload);
  const permissionId = await resolvePermissionId(payload);
  const deleted = await prisma.rolePermission.deleteMany({ where: { roleId, permissionId } });
  return { status: "DONE" as const, data: { roleId, permissionId, revoked: deleted.count > 0 } };
}

export async function executeUserCreate(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const user = await createOrAssignUser(payload, ctx, "ACTIVE");
  return { status: "DONE" as const, data: { userId: user.id, roleId: user.roleId } };
}

export async function executeUserInvite(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const user = await createOrAssignUser(payload, ctx, "INVITED");
  const outbox = await prisma.outboxItem.create({
    data: {
      scope: "ACCOUNT",
      accountId: ctx.accountId,
      userId: user.id,
      eventName: "user.invite",
      payload: inputJson({ userId: user.id, email: user.email, roleId: user.roleId }),
      status: "PENDING",
      dedupeKey: `crm-agent-v2:${ctx.accountId}:user.invite:${user.id}:${Date.now()}`,
      availableAt: ctx.now,
    },
  });
  return { status: "DONE" as const, data: { userId: user.id, roleId: user.roleId, outboxItemId: outbox.id } };
}

export async function executeUserUpdateProfile(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const userId = requiredNumber(payload.userId, "userId");
  await assertAccountUser(ctx.accountId, userId);
  const profile = await prisma.userProfile.upsert({
    where: { userId },
    update: profileData(payload),
    create: { userId, ...profileData(payload) },
  });
  return { status: "DONE" as const, data: { userId, profileId: profile.id } };
}

export async function executeUserUpdateEmail(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const userId = requiredNumber(payload.userId, "userId");
  await assertAccountUser(ctx.accountId, userId);
  const email = requiredString(payload, "email").toLowerCase();
  const updated = await prisma.user.update({ where: { id: userId }, data: { email } });
  await prisma.userIdentity.upsert({
    where: { provider_email: { provider: "EMAIL", email } },
    update: { userId },
    create: { userId, provider: "EMAIL", email },
  });
  return { status: "DONE" as const, data: { userId: updated.id, email: updated.email } };
}

export async function executeUserUpdatePhone(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const userId = requiredNumber(payload.userId, "userId");
  await assertAccountUser(ctx.accountId, userId);
  const phone = normalizePhone(requiredString(payload, "phone"));
  const updated = await prisma.user.update({ where: { id: userId }, data: { phone } });
  return { status: "DONE" as const, data: { userId: updated.id, phone: updated.phone } };
}

export async function executeUserChangeRole(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const userId = requiredNumber(payload.userId, "userId");
  await assertAccountUser(ctx.accountId, userId);
  const roleId = await roleIdFromPayload(ctx.accountId, payload);
  await prisma.roleAssignment.upsert({
    where: { userId_accountId: { userId, accountId: ctx.accountId } },
    update: { roleId },
    create: { userId, accountId: ctx.accountId, roleId },
  });
  return { status: "DONE" as const, data: { userId, roleId } };
}

export async function executeUserStatus(payload: JsonRecord, ctx: CrmAgentActionContext, status: UserStatus) {
  const userId = requiredNumber(payload.userId, "userId");
  await assertAccountUser(ctx.accountId, userId);
  const updated = await prisma.user.update({ where: { id: userId }, data: { status } });
  return { status: "DONE" as const, data: { userId: updated.id, status: updated.status } };
}

export async function executeUserResetPassword(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const userId = requiredNumber(payload.userId, "userId");
  await assertAccountUser(ctx.accountId, userId);
  const token = await prisma.emailVerificationToken.create({
    data: {
      email: requiredString(payload, "email"),
      codeHash: randomHash(),
      purpose: "crm_agent_password_reset",
      expiresAt: new Date(ctx.now.getTime() + 60 * 60 * 1000),
    },
  });
  const outbox = await prisma.outboxItem.create({
    data: {
      scope: "ACCOUNT",
      accountId: ctx.accountId,
      userId,
      eventName: "user.reset_password",
      payload: inputJson({ userId, tokenId: token.id }),
      status: "PENDING",
      dedupeKey: `crm-agent-v2:${ctx.accountId}:user.reset_password:${userId}:${Date.now()}`,
      availableAt: ctx.now,
    },
  });
  return { status: "DONE" as const, data: { userId, tokenId: token.id, outboxItemId: outbox.id } };
}

export async function executeUserChangeOwnPassword(payload: JsonRecord, ctx: CrmAgentActionContext) {
  if (!ctx.userId) throw new Error("Current user is required.");
  await assertAccountUser(ctx.accountId, ctx.userId);
  const password = requiredString(payload, "newPassword");
  const salt = crypto.randomBytes(16).toString("hex");
  const passwordHash = hashPassword(password, salt);
  await prisma.userIdentity.upsert({
    where: { provider_email: { provider: "EMAIL", email: requiredString(payload, "email").toLowerCase() } },
    update: { passwordHash, passwordSalt: salt, passwordAlgo: "scrypt", passwordUpdatedAt: ctx.now },
    create: {
      userId: ctx.userId,
      provider: "EMAIL",
      email: requiredString(payload, "email").toLowerCase(),
      passwordHash,
      passwordSalt: salt,
      passwordAlgo: "scrypt",
      passwordUpdatedAt: ctx.now,
    },
  });
  return { status: "DONE" as const, data: { userId: ctx.userId, passwordUpdatedAt: ctx.now.toISOString() } };
}

export async function executeUserRevokeSessions(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const userId = requiredNumber(payload.userId, "userId");
  await assertAccountUser(ctx.accountId, userId);
  const deleted = await prisma.userSession.deleteMany({ where: { userId, accountId: ctx.accountId } });
  return { status: "DONE" as const, data: { userId, revokedSessions: deleted.count } };
}

export async function executeUserLinkIdentity(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const userId = requiredNumber(payload.userId, "userId");
  await assertAccountUser(ctx.accountId, userId);
  const identity = await prisma.userIdentity.create({
    data: {
      userId,
      provider: identityProvider(payload.provider),
      providerUserId: optionalString(payload, "providerUserId"),
      email: optionalString(payload, "email"),
      phone: optionalString(payload, "phone"),
      displayName: optionalString(payload, "displayName"),
      username: optionalString(payload, "username"),
      avatarUrl: optionalString(payload, "avatarUrl"),
      metadataJson: payload.metadataJson === undefined ? undefined : inputJson(payload.metadataJson),
    },
  });
  return { status: "DONE" as const, data: { userId, identityId: identity.id, provider: identity.provider } };
}

export async function executeUserUnlinkIdentity(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const userId = requiredNumber(payload.userId, "userId");
  await assertAccountUser(ctx.accountId, userId);
  const identityId = requiredNumber(payload.identityId, "identityId");
  const deleted = await prisma.userIdentity.deleteMany({ where: { id: identityId, userId } });
  if (!deleted.count) throw new Error("Identity not found.");
  return { status: "DONE" as const, data: { userId, identityId, unlinked: true } };
}

async function createOrAssignUser(payload: JsonRecord, ctx: CrmAgentActionContext, defaultStatus: UserStatus) {
  const email = requiredString(payload, "email").toLowerCase();
  const roleId = await roleIdFromPayload(ctx.accountId, payload);
  const phone = payload.phone === undefined ? null : normalizePhone(requiredString(payload, "phone"));
  const user = await prisma.$transaction(async (tx) => {
    const existing = await tx.user.findUnique({ where: { email }, include: { profile: true } });
    const row =
      existing ??
      (await tx.user.create({
        data: { email, phone, status: userStatus(payload.status ?? defaultStatus), type: "STAFF" },
        include: { profile: true },
      }));
    if (row.type !== "STAFF") throw new Error("User is not a staff user.");
    if (existing) {
      await tx.user.update({
        where: { id: row.id },
        data: { phone: payload.phone === undefined ? row.phone : phone, status: payload.status === undefined ? row.status : userStatus(payload.status) },
      });
    }
    const data = profileData(payload);
    if (Object.keys(data).length) {
      await tx.userProfile.upsert({ where: { userId: row.id }, update: data, create: { userId: row.id, ...data } });
    }
    await tx.roleAssignment.create({ data: { accountId: ctx.accountId, userId: row.id, roleId } });
    return { id: row.id, email, roleId };
  });
  return user;
}

async function roleIdFromPayload(accountId: number, payload: JsonRecord) {
  const roleId = numberOrNull(payload.roleId);
  if (roleId) {
    await assertRole(accountId, roleId);
    return roleId;
  }
  const name = roleName(payload.roleName ?? payload.name ?? "READONLY");
  const role = await prisma.role.upsert({
    where: { accountId_name: { accountId, name } },
    update: {},
    create: { accountId, name },
  });
  return role.id;
}

async function resolveRoleId(accountId: number, payload: JsonRecord) {
  const userId = numberOrNull(payload.userId);
  if (userId) {
    const assignment = await prisma.roleAssignment.findFirst({ where: { accountId, userId }, select: { roleId: true } });
    if (!assignment) throw new Error("User not found.");
    return assignment.roleId;
  }
  return roleIdFromPayload(accountId, payload);
}

async function resolvePermissionId(payload: JsonRecord) {
  const permissionId = numberOrNull(payload.permissionId);
  if (permissionId) return permissionId;
  const key = requiredString(payload, "permissionKey");
  const permission = await prisma.permission.upsert({ where: { key }, update: {}, create: { key } });
  return permission.id;
}

async function assertAccountUser(accountId: number, userId: number) {
  const assignment = await prisma.roleAssignment.findFirst({ where: { accountId, userId }, select: { userId: true } });
  if (!assignment) throw new Error("User not found.");
}

async function assertRole(accountId: number, roleId: number) {
  const role = await prisma.role.findFirst({ where: { id: roleId, accountId }, select: { id: true } });
  if (!role) throw new Error("Role not found.");
}

async function findAccountUser(accountId: number, userId: number) {
  return prisma.user.findFirst({
    where: { id: userId, roleAssignments: { some: { accountId } } },
    include: { profile: true, identities: true, roleAssignments: { where: { accountId }, include: { role: true } } },
  });
}

async function findRole(accountId: number, roleId: number) {
  return prisma.role.findFirst({
    where: { id: roleId, accountId },
    include: { permissions: { include: { permission: true } }, _count: { select: { assignments: true } } },
  });
}

function serializeAccountUser(user: UserForPreview) {
  return {
    ...serializeUser(user),
    roles: user.roleAssignments.map((assignment) => ({ id: assignment.role.id, name: assignment.role.name })),
    identities: user.identities?.map((identity) => ({
      id: identity.id,
      provider: identity.provider,
      providerUserId: identity.providerUserId,
      email: identity.email,
      phone: identity.phone,
    })),
  };
}

function serializeRole(role: {
  id: number;
  name: RoleName;
  permissions: { permission: { id: number; key: string; description: string | null } }[];
  _count?: { assignments: number };
}) {
  return {
    id: role.id,
    name: role.name,
    assignmentsCount: role._count?.assignments ?? null,
    permissions: role.permissions.map((item) => ({
      id: item.permission.id,
      key: item.permission.key,
      description: item.permission.description,
    })),
  };
}

function profileData(payload: JsonRecord) {
  return {
    ...(payload.firstName !== undefined ? { firstName: optionalString(payload, "firstName") } : {}),
    ...(payload.lastName !== undefined ? { lastName: optionalString(payload, "lastName") } : {}),
    ...(payload.avatarUrl !== undefined ? { avatarUrl: optionalString(payload, "avatarUrl") } : {}),
  };
}

function roleName(value: unknown): RoleName {
  const parsed = String(value ?? "").trim().toUpperCase() as RoleName;
  if (!ROLE_NAMES.includes(parsed)) throw new Error(`Role name must be one of: ${ROLE_NAMES.join(", ")}.`);
  return parsed;
}

function userStatus(value: unknown): UserStatus {
  const parsed = String(value ?? "").trim().toUpperCase() as UserStatus;
  if (!["ACTIVE", "INVITED", "DISABLED"].includes(parsed)) throw new Error("Invalid user status.");
  return parsed;
}

function identityProvider(value: unknown): IdentityProvider {
  const parsed = String(value ?? "").trim().toUpperCase() as IdentityProvider;
  if (!IDENTITY_PROVIDERS.includes(parsed)) throw new Error(`Identity provider must be one of: ${IDENTITY_PROVIDERS.join(", ")}.`);
  return parsed;
}

function normalizePhone(value: string) {
  return normalizeRuPhone(value) ?? value;
}

function hashPassword(password: string, saltHex: string) {
  return crypto.scryptSync(password, saltHex, 32).toString("hex");
}

function randomHash() {
  return crypto.createHash("sha256").update(crypto.randomBytes(32)).digest("hex");
}
