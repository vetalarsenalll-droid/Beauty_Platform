import crypto from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "./prisma";

const ACCESS_COOKIE = "bp_access";
const REFRESH_COOKIE = "bp_refresh";
const ACCESS_TTL_MINUTES = 15;
const REFRESH_TTL_DAYS = 30;

type PlatformSession = {
  adminId: number;
  userId: number;
  email: string | null;
  permissions: string[];
};

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function mapSession(session: Awaited<ReturnType<typeof findSessionByAccess>>) {
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

async function findSessionByAccess(tokenHash: string) {
  return prisma.userSession.findFirst({
    where: { accessTokenHash: tokenHash, accessExpiresAt: { gt: new Date() } },
    include: {
      user: {
        include: {
          platformAdmin: {
            include: {
              permissions: { include: { permission: true } },
            },
          },
        },
      },
    },
  });
}

async function findSessionByRefresh(tokenHash: string) {
  return prisma.userSession.findFirst({
    where: { refreshTokenHash: tokenHash, refreshExpiresAt: { gt: new Date() } },
    include: {
      user: {
        include: {
          platformAdmin: {
            include: {
              permissions: { include: { permission: true } },
            },
          },
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

export async function createSession(userId: number) {
  const { token: accessToken, tokenHash: accessTokenHash } = createTokens();
  const { token: refreshToken, tokenHash: refreshTokenHash } = createTokens();
  const accessExpiresAt = new Date(Date.now() + ACCESS_TTL_MINUTES * 60 * 1000);
  const refreshExpiresAt = new Date(
    Date.now() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000
  );

  await prisma.userSession.create({
    data: {
      userId,
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
  const accessToken = cookieStore.get(ACCESS_COOKIE)?.value;
  const refreshToken = cookieStore.get(REFRESH_COOKIE)?.value;

  if (accessToken) {
    const session = await findSessionByAccess(hashToken(accessToken));
    const mapped = mapSession(session);
    if (mapped) return mapped;
  }

  if (refreshToken) {
    const session = await findSessionByRefresh(hashToken(refreshToken));
    return mapSession(session);
  }

  return null;
}

export async function getPlatformSessionByToken(
  token: string
): Promise<PlatformSession | null> {
  if (!token) return null;
  const tokenHash = hashToken(token);
  const session = await findSessionByAccess(tokenHash);
  return mapSession(session);
}

export async function getPlatformSessionByRefreshToken(
  token: string
): Promise<PlatformSession | null> {
  if (!token) return null;
  const tokenHash = hashToken(token);
  const session = await findSessionByRefresh(tokenHash);
  return mapSession(session);
}

export async function refreshSession(refreshToken: string) {
  const tokenHash = hashToken(refreshToken);
  const session = await findSessionByRefresh(tokenHash);
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
  return { ACCESS_COOKIE, REFRESH_COOKIE };
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
