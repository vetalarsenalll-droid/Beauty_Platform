import { getClientSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createHmac, timingSafeEqual } from "crypto";

const prismaAny = prisma as any;

export type ClientMembership = {
  clientId: number | null;
  accountId: number;
  accountSlug: string;
  accountName: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  email: string | null;
};

export type ClientSessionValue = Awaited<ReturnType<typeof getClientSession>>;

export const asText = (v: unknown) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, 1200) : "");
export const asYmd = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v.trim()) ? v.trim() : null);
export const asTimeZone = (v: unknown) => (typeof v === "string" && v.trim().length >= 3 && v.trim().length <= 80 ? v.trim() : null);
export const asThreadId = (v: unknown) => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
};
export const asThreadKey = (v: unknown) => (typeof v === "string" && v.trim().length >= 16 ? v.trim().slice(0, 256) : null);

const THREAD_KEY_SECRET = (process.env.AI_THREAD_SECRET ?? process.env.NEXTAUTH_SECRET ?? "").trim();

export function buildThreadKey(accountId: number, threadId: number) {
  if (!THREAD_KEY_SECRET) return null;
  return createHmac("sha256", THREAD_KEY_SECRET).update(`${accountId}:${threadId}`).digest("base64url");
}

function isValidThreadKey(accountId: number, threadId: number, threadKey: string | null) {
  if (!THREAD_KEY_SECRET || !threadKey) return false;
  const expected = buildThreadKey(accountId, threadId);
  if (!expected) return false;
  const left = Buffer.from(expected);
  const right = Buffer.from(threadKey);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function parseChoiceFromText(messageNorm: string): number | null {
  const direct = Number(messageNorm.match(/^\s*(?:№|номер\s*)?(\d{1,2})\s*$/i)?.[1] ?? NaN);
  if (Number.isFinite(direct)) return direct;
  const map: Array<[RegExp, number]> = [
    [/^\s*(один|первый|первая|first)\s*$/i, 1],
    [/^\s*(два|второй|вторая|second)\s*$/i, 2],
    [/^\s*(три|третий|третья|third)\s*$/i, 3],
    [/^\s*(четыре|четвертый|четвёртый|четвертая|четвёртая|fourth)\s*$/i, 4],
    [/^\s*(пять|пятый|пятая|fifth)\s*$/i, 5],
  ];
  for (const [re, n] of map) if (re.test(messageNorm)) return n;
  return null;
}

function parseAiSettingString(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    const candidate = record.systemPrompt ?? record.prompt ?? record.instructions;
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
  }
  return null;
}

export async function resolveAishaSystemPrompt(accountId: number): Promise<string | null> {
  const keys = ["aisha.systemPrompt", "public.ai.systemPrompt"];
  const accountSetting = await prisma.aiSetting.findFirst({
    where: { accountId, key: { in: keys } },
    orderBy: { id: "desc" },
    select: { value: true },
  });
  const accountPrompt = parseAiSettingString(accountSetting?.value);
  if (accountPrompt) return accountPrompt;
  const globalSetting = await prisma.aiSetting.findFirst({
    where: { accountId: null, key: { in: keys } },
    orderBy: { id: "desc" },
    select: { value: true },
  });
  return parseAiSettingString(globalSetting?.value);
}

export function canAccessThread(args: {
  accountId: number;
  thread: { id: number; accountId: number | null; clientId: number | null; userId: number | null };
  threadKey: string | null;
  clientId: number | null;
  userId: number | null;
}) {
  const { accountId, thread, threadKey, clientId, userId } = args;
  if (thread.accountId !== accountId) return false;
  if (clientId && thread.clientId === clientId) return true;
  if (userId && thread.userId === userId) return true;
  if (thread.clientId == null && thread.userId == null) {
    if (!THREAD_KEY_SECRET) return false;
    if (isValidThreadKey(accountId, thread.id, threadKey)) return true;
  }
  return false;
}

export function isThreadSecretConfigured() {
  return Boolean(THREAD_KEY_SECRET);
}

export async function getThread(args: {
  accountId: number;
  threadId: number | null;
  threadKey: string | null;
  clientId: number | null;
  userId: number | null;
}) {
  const { accountId, threadId, threadKey, clientId, userId } = args;
  let thread = threadId != null ? await prisma.aiThread.findFirst({ where: { id: threadId, accountId } }) : null;
  if (thread && !canAccessThread({ accountId, thread, threadKey, clientId, userId })) {
    thread = null;
  }
  if (!thread) {
    thread = await prisma.aiThread.create({
      data: {
        accountId,
        clientId: clientId ?? null,
        userId: userId ?? null,
      },
    });
  }
  if (clientId && !thread.clientId) {
    thread = await prisma.aiThread.update({ where: { id: thread.id }, data: { clientId } });
  }
  if (userId && !thread.userId) {
    thread = await prisma.aiThread.update({ where: { id: thread.id }, data: { userId } });
  }
  const ensuredThread = thread;
  const draft = await prismaAny.aiBookingDraft.upsert({
    where: { threadId: ensuredThread.id },
    create: { threadId: ensuredThread.id, status: "COLLECTING", serviceIds: [], planJson: [] },
    update: {},
  });
  return { thread: ensuredThread, draft, threadKey: buildThreadKey(accountId, ensuredThread.id) };
}

export async function resolveClientForAccount(
  session: ClientSessionValue,
  account: { id: number; slug: string; name: string },
  options: { createIfMissing?: boolean } = {},
) {
  if (!session) return null;
  const createIfMissing = options.createIfMissing ?? false;
  const fromSession =
    (session.clients.find((c) => c.accountId === account.id) as ClientMembership | undefined) ??
    (session.clients.find((c) => c.accountSlug === account.slug) as ClientMembership | undefined);
  if (fromSession) return fromSession;

  const existing = await prisma.client.findFirst({
    where: { userId: session.userId, accountId: account.id },
    include: { account: true },
  });
  if (existing) {
    const needsUpdate =
      (!existing.firstName && session.userId) ||
      (!existing.lastName && session.userId) ||
      (!existing.phone && session.userId) ||
      (!existing.email && session.userId);
    if (needsUpdate) {
      const user = await prisma.user.findUnique({
        where: { id: session.userId },
        include: { profile: true },
      });
      if (user) {
        await prisma.client.update({
          where: { id: existing.id },
          data: {
            firstName: existing.firstName ?? user.profile?.firstName ?? null,
            lastName: existing.lastName ?? user.profile?.lastName ?? null,
            phone: existing.phone ?? user.phone ?? null,
            email: existing.email ?? user.email ?? session.email ?? null,
          },
        });
        existing.firstName = existing.firstName ?? user.profile?.firstName ?? null;
        existing.lastName = existing.lastName ?? user.profile?.lastName ?? null;
        existing.phone = existing.phone ?? user.phone ?? null;
        existing.email = existing.email ?? user.email ?? session.email ?? null;
      }
    }
    return {
      clientId: existing.id,
      accountId: existing.accountId,
      accountSlug: existing.account?.slug ?? account.slug,
      accountName: existing.account?.name ?? account.name,
      firstName: existing.firstName ?? null,
      lastName: existing.lastName ?? null,
      phone: existing.phone ?? null,
      email: existing.email ?? null,
    } satisfies ClientMembership;
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    include: { profile: true },
  });
  if (!createIfMissing) {
    if (!user) return null;
    return {
      clientId: null,
      accountId: account.id,
      accountSlug: account.slug,
      accountName: account.name,
      firstName: user.profile?.firstName ?? null,
      lastName: user.profile?.lastName ?? null,
      phone: user.phone ?? null,
      email: user.email ?? session.email ?? null,
    } satisfies ClientMembership;
  }
  const created = await prisma.client.create({
    data: {
      accountId: account.id,
      userId: session.userId,
      firstName: user?.profile?.firstName ?? null,
      lastName: user?.profile?.lastName ?? null,
      phone: user?.phone ?? null,
      email: user?.email ?? session.email ?? null,
    },
    include: { account: true },
  });
  return {
    clientId: created.id,
    accountId: created.accountId,
    accountSlug: created.account?.slug ?? account.slug,
    accountName: created.account?.name ?? account.name,
    firstName: created.firstName ?? null,
    lastName: created.lastName ?? null,
    phone: created.phone ?? null,
    email: created.email ?? null,
  } satisfies ClientMembership;
}


