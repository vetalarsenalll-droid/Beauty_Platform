import crypto from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "./prisma";

const SESSION_COOKIE = "bp_session";
const SESSION_TTL_DAYS = 30;

type PlatformSession = {
  userId: string;
  email: string | null;
  permissions: string[];
};

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string) {
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);

  await prisma.userSession.create({
    data: {
      userId,
      refreshTokenHash: tokenHash,
      expiresAt,
    },
  });

  return { token, expiresAt };
}

export async function clearSession(token: string) {
  const tokenHash = hashToken(token);
  await prisma.userSession.deleteMany({
    where: { refreshTokenHash: tokenHash },
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
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const tokenHash = hashToken(token);
  const session = await prisma.userSession.findFirst({
    where: { refreshTokenHash: tokenHash, expiresAt: { gt: new Date() } },
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

  if (!session?.user?.platformAdmin) return null;

  const permissions =
    session.user.platformAdmin.permissions.map(
      (assignment) => assignment.permission.key
    ) ?? [];

  return {
    userId: session.userId,
    email: session.user.email ?? session.user.platformAdmin.userId,
    permissions,
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
