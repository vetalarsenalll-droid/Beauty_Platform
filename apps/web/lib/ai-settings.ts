import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function getGlobalAiSetting(key: string) {
  const row = await prisma.aiSetting.findFirst({
    where: { accountId: null, key },
    orderBy: { id: "desc" },
    select: { value: true },
  });
  return typeof row?.value === "string" && row.value.trim() ? row.value.trim() : null;
}

export async function getAccountAiSetting(accountId: number, key: string) {
  const row = await prisma.aiSetting.findFirst({
    where: { accountId, key },
    orderBy: { id: "desc" },
    select: { value: true },
  });
  return row?.value ?? null;
}

export async function upsertAccountAiSetting(accountId: number, key: string, value: unknown) {
  const jsonValue = value as Prisma.InputJsonValue;
  const existing = await prisma.aiSetting.findFirst({
    where: { accountId, key },
    orderBy: { id: "desc" },
    select: { id: true },
  });
  if (existing) {
    await prisma.aiSetting.update({ where: { id: existing.id }, data: { value: jsonValue } });
  } else {
    await prisma.aiSetting.create({ data: { accountId, key, value: jsonValue } });
  }
}

export async function getGlobalAiNumberSetting(key: string, fallback: number) {
  const value = await getGlobalAiSetting(key);
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export async function getGlobalAiBooleanSetting(key: string, fallback: boolean) {
  const value = await getGlobalAiSetting(key);
  if (!value) return fallback;
  if (["true", "1", "yes", "on"].includes(value.toLowerCase())) return true;
  if (["false", "0", "no", "off"].includes(value.toLowerCase())) return false;
  return fallback;
}
