import crypto from "crypto";
import { cookies } from "next/headers";
import type { IdentityProvider, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createSession, getClientAuthCookies } from "@/lib/auth";

export type ClientSocialProvider = Extract<IdentityProvider, "TELEGRAM" | "VK" | "YANDEX" | "MAX">;

export type ClientSocialProfile = {
  provider: ClientSocialProvider;
  providerUserId: string;
  email?: string | null;
  phone?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  displayName?: string | null;
  username?: string | null;
  avatarUrl?: string | null;
  metadataJson?: Prisma.InputJsonValue | null;
};

export type CompleteClientSocialAuthParams = {
  profile: ClientSocialProfile;
  accountSlug?: string | null;
};

function normalizeEmail(value?: string | null) {
  const email = String(value ?? "").trim().toLowerCase();
  return email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

function normalizeText(value?: string | null) {
  const text = String(value ?? "").trim();
  return text || null;
}

function splitDisplayName(displayName?: string | null) {
  const parts = normalizeText(displayName)?.split(/\s+/).filter(Boolean) ?? [];
  return {
    firstName: parts[0] ?? null,
    lastName: parts.length > 1 ? parts.slice(1).join(" ") : null,
  };
}

function profileNames(profile: ClientSocialProfile) {
  const split = splitDisplayName(profile.displayName);
  return {
    firstName: normalizeText(profile.firstName) ?? split.firstName,
    lastName: normalizeText(profile.lastName) ?? split.lastName,
  };
}

export function randomOAuthState() {
  return crypto.randomBytes(24).toString("base64url");
}

export function safeClientReturnTo(value?: string | null, accountSlug?: string | null) {
  const fallback = accountSlug ? `/c?account=${encodeURIComponent(accountSlug)}` : "/c";
  if (!value) return fallback;
  try {
    const url = new URL(value, "http://local");
    if (url.origin !== "http://local") return fallback;
    if (url.pathname.startsWith("/api/")) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}

export async function completeClientSocialAuth(params: CompleteClientSocialAuthParams) {
  const provider = params.profile.provider;
  const providerUserId = normalizeText(params.profile.providerUserId);
  if (!providerUserId) {
    throw new Error("Provider user id is required.");
  }

  const email = normalizeEmail(params.profile.email);
  const phone = normalizeText(params.profile.phone);
  const displayName = normalizeText(params.profile.displayName);
  const username = normalizeText(params.profile.username);
  const avatarUrl = normalizeText(params.profile.avatarUrl);
  const { firstName, lastName } = profileNames(params.profile);

  const account = params.accountSlug
    ? await prisma.account.findUnique({
        where: { slug: params.accountSlug },
        select: { id: true, name: true, slug: true },
      })
    : null;

  if (params.accountSlug && !account) {
    throw new Error("Account not found.");
  }

  const identity = await prisma.userIdentity.findUnique({
    where: { provider_providerUserId: { provider, providerUserId } },
    include: { user: { include: { profile: true } } },
  });

  let userId = identity?.userId ?? null;
  let userEmail = identity?.user?.email ?? email;

  if (!userId && email) {
    const existingUser = await prisma.user.findUnique({ where: { email }, select: { id: true, email: true } });
    if (existingUser) {
      userId = existingUser.id;
      userEmail = existingUser.email;
    }
  }

  if (!userId) {
    const user = await prisma.user.create({
      data: {
        email,
        phone,
        type: "CLIENT",
        profile:
          firstName || lastName || avatarUrl
            ? {
                create: {
                  firstName,
                  lastName,
                  avatarUrl,
                },
              }
            : undefined,
        identities: {
          create: {
            provider,
            providerUserId,
            email,
            phone,
            displayName,
            username,
            avatarUrl,
            metadataJson: params.profile.metadataJson ?? undefined,
          },
        },
      },
    });
    userId = user.id;
    userEmail = user.email;
  } else if (!identity) {
    await prisma.userIdentity.create({
      data: {
        userId,
        provider,
        providerUserId,
        email,
        phone,
        displayName,
        username,
        avatarUrl,
        metadataJson: params.profile.metadataJson ?? undefined,
      },
    });
  } else {
    await prisma.userIdentity.update({
      where: { id: identity.id },
      data: {
        email: email ?? identity.email,
        phone: phone ?? identity.phone,
        displayName: displayName ?? identity.displayName,
        username: username ?? identity.username,
        avatarUrl: avatarUrl ?? identity.avatarUrl,
        metadataJson: params.profile.metadataJson ?? identity.metadataJson ?? undefined,
      },
    });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { profile: true },
  });
  if (!user || user.status !== "ACTIVE" || user.type !== "CLIENT") {
    throw new Error("Client user is not active.");
  }

  if (!user.profile && (firstName || lastName || avatarUrl)) {
    await prisma.userProfile.create({
      data: { userId, firstName, lastName, avatarUrl },
    });
  } else if (user.profile) {
    await prisma.userProfile.update({
      where: { userId },
      data: {
        firstName: user.profile.firstName ?? firstName,
        lastName: user.profile.lastName ?? lastName,
        avatarUrl: user.profile.avatarUrl ?? avatarUrl,
      },
    });
  }

  let client = null;
  if (account) {
    client = await prisma.client.findFirst({ where: { accountId: account.id, userId } });
    if (!client) {
      client = await prisma.client.create({
        data: {
          accountId: account.id,
          userId,
          firstName: firstName ?? user.profile?.firstName ?? null,
          lastName: lastName ?? user.profile?.lastName ?? null,
          email: email ?? user.email ?? null,
          phone: phone ?? user.phone ?? null,
        },
      });
    }
  }

  await prisma.userSession.deleteMany({
    where: { userId, sessionType: "CLIENT" },
  });

  const session = await createSession({ userId, sessionType: "CLIENT", accountId: null });
  const cookieStore = await cookies();
  const { ACCESS_COOKIE, REFRESH_COOKIE } = getClientAuthCookies();

  cookieStore.set(ACCESS_COOKIE, session.accessToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: session.accessExpiresAt,
  });
  cookieStore.set(REFRESH_COOKIE, session.refreshToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: session.refreshExpiresAt,
  });

  return {
    user: { id: userId, email: userEmail },
    account,
    client,
    accessExpiresAt: session.accessExpiresAt,
    refreshExpiresAt: session.refreshExpiresAt,
  };
}
