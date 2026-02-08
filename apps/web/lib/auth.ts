import crypto from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "./prisma";

const PLATFORM_ACCESS_COOKIE = "bp_access";
const PLATFORM_REFRESH_COOKIE = "bp_refresh";
const CRM_ACCESS_COOKIE = "bp_crm_access";
const CRM_REFRESH_COOKIE = "bp_crm_refresh";
const CLIENT_ACCESS_COOKIE = "bp_client_access";
const CLIENT_REFRESH_COOKIE = "bp_client_refresh";
const ACCESS_TTL_MINUTES = 15;
const REFRESH_TTL_DAYS = 30;

type SessionType = "PLATFORM" | "CRM" | "CLIENT";

type PlatformSession = {
  adminId: number;
  userId: number;
  email: string | null;
  permissions: string[];
};

type CrmSession = {
  userId: number;
  email: string | null;
  accountId: number;
  role: string;
  permissions: string[];
};

type ClientSession = {
  userId: number;
  email: string | null;
  avatarUrl: string | null;
  clients: Array<{
    clientId: number;
    accountId: number;
    accountSlug: string;
    accountName: string;
    firstName: string | null;
    lastName: string | null;
    phone: string | null;
    email: string | null;
  }>;
};

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function mapPlatformSession(
  session: Awaited<ReturnType<typeof findSessionByAccess>>
) {
  if (!session?.user?.platformAdmin) return null;

  const permissions =
    session.user.platformAdmin.permissions.map(
      (assignment) => assignment.permission.key
    ) ?? [];

  return {
    adminId: session.user.platformAdmin.id,
    userId: session.userId,
    email: session.user.email ?? session.user.platformAdmin.userId,
    permissions,
  };
}

function mapCrmSession(
  session: Awaited<ReturnType<typeof findSessionByAccess>>
): CrmSession | null {
  if (!session?.accountId) return null;

  const assignment = session.user?.roleAssignments.find(
    (item) => item.accountId === session.accountId
  );
  if (!assignment) return null;

  const permissions =
    assignment.role.permissions.map(
      (rolePermission) => rolePermission.permission.key
    ) ?? [];

  return {
    userId: session.userId,
    email: session.user?.email ?? null,
    accountId: session.accountId,
    role: assignment.role.name,
    permissions,
  };
}

function mapClientSession(
  session: Awaited<ReturnType<typeof findSessionByAccess>>
): ClientSession | null {
  if (!session?.user) return null;
  const clients =
    session.user.clientProfiles?.map((client) => ({
      clientId: client.id,
      accountId: client.accountId,
      accountSlug: client.account?.slug ?? "",
      accountName: client.account?.name ?? "",
      firstName: client.firstName ?? null,
      lastName: client.lastName ?? null,
      phone: client.phone ?? null,
      email: client.email ?? null,
    })) ?? [];
  return {
    userId: session.userId,
    email: session.user?.email ?? null,
    avatarUrl: session.user?.profile?.avatarUrl ?? null,
    clients,
  };
}

async function findSessionByAccess(
  tokenHash: string,
  sessionType: SessionType
) {
  return prisma.userSession.findFirst({
    where: {
      accessTokenHash: tokenHash,
      accessExpiresAt: { gt: new Date() },
      sessionType,
    },
    include: {
      user: {
        include: {
          profile: true,
          platformAdmin: {
            include: {
              permissions: { include: { permission: true } },
            },
          },
          roleAssignments: {
            include: {
              role: {
                include: {
                  permissions: { include: { permission: true } },
                },
              },
            },
          },
          clientProfiles: { include: { account: true } },
        },
      },
    },
  });
}

async function findSessionByRefresh(
  tokenHash: string,
  sessionType: SessionType
) {
  return prisma.userSession.findFirst({
    where: {
      refreshTokenHash: tokenHash,
      refreshExpiresAt: { gt: new Date() },
      sessionType,
    },
    include: {
      user: {
        include: {
          profile: true,
          platformAdmin: {
            include: {
              permissions: { include: { permission: true } },
            },
          },
          roleAssignments: {
            include: {
              role: {
                include: {
                  permissions: { include: { permission: true } },
                },
              },
            },
          },
          clientProfiles: { include: { account: true } },
        },
      },
    },
  });
}

function createTokens() {
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);
  return { token, tokenHash };
}

export async function createSession(params: {
  userId: number;
  sessionType: SessionType;
  accountId?: number | null;
}) {
  const { userId, sessionType, accountId } = params;
  const { token: accessToken, tokenHash: accessTokenHash } = createTokens();
  const { token: refreshToken, tokenHash: refreshTokenHash } = createTokens();
  const accessExpiresAt = new Date(Date.now() + ACCESS_TTL_MINUTES * 60 * 1000);
  const refreshExpiresAt = new Date(
    Date.now() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000
  );

  await prisma.userSession.create({
    data: {
      userId,
      sessionType,
      accountId: accountId ?? null,
      accessTokenHash,
      accessExpiresAt,
      refreshTokenHash,
      refreshExpiresAt,
    },
  });

  return {
    accessToken,
    refreshToken,
    accessExpiresAt,
    refreshExpiresAt,
  };
}

export async function clearSession(token: string) {
  const tokenHash = hashToken(token);
  await prisma.userSession.deleteMany({
    where: {
      OR: [{ refreshTokenHash: tokenHash }, { accessTokenHash: tokenHash }],
    },
  });
}

export async function verifyPassword(
  password: string,
  saltHex: string,
  hashHex: string
) {
  const salt = Buffer.from(saltHex, "hex");
  const hash = crypto.scryptSync(password, salt, 32).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(hashHex, "hex"), Buffer.from(hash, "hex"));
}

export async function getPlatformSession(): Promise<PlatformSession | null> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(PLATFORM_ACCESS_COOKIE)?.value;
  const refreshToken = cookieStore.get(PLATFORM_REFRESH_COOKIE)?.value;

  if (accessToken) {
    const session = await findSessionByAccess(
      hashToken(accessToken),
      "PLATFORM"
    );
    const mapped = mapPlatformSession(session);
    if (mapped) return mapped;
  }

  if (refreshToken) {
    const session = await findSessionByRefresh(
      hashToken(refreshToken),
      "PLATFORM"
    );
    return mapPlatformSession(session);
  }

  return null;
}

export async function getPlatformSessionByToken(
  token: string
): Promise<PlatformSession | null> {
  if (!token) return null;
  const tokenHash = hashToken(token);
  const session = await findSessionByAccess(tokenHash, "PLATFORM");
  return mapPlatformSession(session);
}

export async function getPlatformSessionByRefreshToken(
  token: string
): Promise<PlatformSession | null> {
  if (!token) return null;
  const tokenHash = hashToken(token);
  const session = await findSessionByRefresh(tokenHash, "PLATFORM");
  return mapPlatformSession(session);
}

export async function getCrmSession(): Promise<CrmSession | null> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(CRM_ACCESS_COOKIE)?.value;
  const refreshToken = cookieStore.get(CRM_REFRESH_COOKIE)?.value;

  if (accessToken) {
    const session = await findSessionByAccess(hashToken(accessToken), "CRM");
    const mapped = mapCrmSession(session);
    if (mapped) return mapped;
  }

  if (refreshToken) {
    const session = await findSessionByRefresh(hashToken(refreshToken), "CRM");
    return mapCrmSession(session);
  }

  return null;
}

export async function getClientSession(): Promise<ClientSession | null> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(CLIENT_ACCESS_COOKIE)?.value;
  const refreshToken = cookieStore.get(CLIENT_REFRESH_COOKIE)?.value;

  if (accessToken) {
    const session = await findSessionByAccess(hashToken(accessToken), "CLIENT");
    const mapped = mapClientSession(session);
    if (mapped) return mapped;
  }

  if (refreshToken) {
    const session = await findSessionByRefresh(hashToken(refreshToken), "CLIENT");
    return mapClientSession(session);
  }

  return null;
}

export async function getCrmSessionByToken(
  token: string
): Promise<CrmSession | null> {
  if (!token) return null;
  const tokenHash = hashToken(token);
  const session = await findSessionByAccess(tokenHash, "CRM");
  return mapCrmSession(session);
}

export async function getClientSessionByToken(
  token: string
): Promise<ClientSession | null> {
  if (!token) return null;
  const tokenHash = hashToken(token);
  const session = await findSessionByAccess(tokenHash, "CLIENT");
  return mapClientSession(session);
}

export async function getCrmSessionByRefreshToken(
  token: string
): Promise<CrmSession | null> {
  if (!token) return null;
  const tokenHash = hashToken(token);
  const session = await findSessionByRefresh(tokenHash, "CRM");
  return mapCrmSession(session);
}

export async function getClientSessionByRefreshToken(
  token: string
): Promise<ClientSession | null> {
  if (!token) return null;
  const tokenHash = hashToken(token);
  const session = await findSessionByRefresh(tokenHash, "CLIENT");
  return mapClientSession(session);
}

export async function refreshSession(
  refreshToken: string,
  sessionType: SessionType
) {
  const tokenHash = hashToken(refreshToken);
  const session = await findSessionByRefresh(tokenHash, sessionType);
  if (!session) return null;

  const { token: accessToken, tokenHash: accessTokenHash } = createTokens();
  const { token: newRefreshToken, tokenHash: newRefreshTokenHash } = createTokens();
  const accessExpiresAt = new Date(Date.now() + ACCESS_TTL_MINUTES * 60 * 1000);
  const refreshExpiresAt = new Date(
    Date.now() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000
  );

  await prisma.userSession.update({
    where: { id: session.id },
    data: {
      accessTokenHash,
      accessExpiresAt,
      refreshTokenHash: newRefreshTokenHash,
      refreshExpiresAt,
    },
  });

  return {
    accessToken,
    refreshToken: newRefreshToken,
    accessExpiresAt,
    refreshExpiresAt,
    session,
  };
}

export function getAuthCookies() {
  return {
    ACCESS_COOKIE: PLATFORM_ACCESS_COOKIE,
    REFRESH_COOKIE: PLATFORM_REFRESH_COOKIE,
  };
}

export function getCrmAuthCookies() {
  return {
    ACCESS_COOKIE: CRM_ACCESS_COOKIE,
    REFRESH_COOKIE: CRM_REFRESH_COOKIE,
  };
}

export function getClientAuthCookies() {
  return {
    ACCESS_COOKIE: CLIENT_ACCESS_COOKIE,
    REFRESH_COOKIE: CLIENT_REFRESH_COOKIE,
  };
}

export async function requirePlatformSession(): Promise<PlatformSession> {
  const session = await getPlatformSession();
  if (!session) {
    redirect("/platform/login");
  }
  return session;
}

export async function requirePlatformPermission(permission: string) {
  const session = await requirePlatformSession();
  if (
    session.permissions.includes("platform.all") ||
    session.permissions.includes(permission)
  ) {
    return session;
  }
  redirect("/platform/login?error=forbidden");
}

export async function requireCrmSession(): Promise<CrmSession> {
  const session = await getCrmSession();
  if (!session) {
    redirect("/crm/login");
  }
  return session;
}

export async function requireClientSession(): Promise<ClientSession> {
  const session = await getClientSession();
  if (!session) {
    redirect("/c/login");
  }
  return session;
}

export async function requireCrmPermission(permission: string) {
  const session = await requireCrmSession();
  if (
    session.permissions.includes("crm.all") ||
    session.permissions.includes(permission)
  ) {
    return session;
  }
  redirect("/crm/login?error=forbidden");
}
