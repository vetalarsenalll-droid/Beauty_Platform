import { prisma } from "@/lib/prisma";
import { buildActionPreview } from "../action-preview";
import { optionalDate, optionalString, requiredNumber, requiredString, type JsonRecord } from "../action-helpers";
import type { CrmAgentActionContext } from "../types";

type PromotionTypeValue = "PERCENT" | "FIXED" | "BUNDLE";

export async function previewPromo(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const before = await loadPromo(ctx.accountId, numberOrNull(payload.promoId ?? payload.promotionId));
  return buildActionPreview({ before, after: { ...(before ?? {}), ...payload } });
}

export async function readPromos(accountId: number, payload: JsonRecord) {
  const query = optionalString(payload, "query");
  const rows = await prisma.promotion.findMany({
    where: {
      accountId,
      ...(query ? { OR: [{ name: { contains: query, mode: "insensitive" } }, { promoCodes: { some: { code: { contains: query, mode: "insensitive" } } } }] } : {}),
      ...(payload.isActive !== undefined ? { isActive: Boolean(payload.isActive) } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: take(payload.take),
    include: { promoCodes: { take: 10, orderBy: { createdAt: "desc" } } },
  });
  return { promos: rows.map(serializePromo) };
}

export async function readPromo(accountId: number, payload: JsonRecord) {
  const promoId = requiredNumber(payload.promoId ?? payload.promotionId, "promoId");
  const promo = await loadPromo(accountId, promoId);
  if (!promo) throw new Error("Promotion not found.");
  return { promo };
}

export async function resolvePromo(accountId: number, payload: JsonRecord) {
  const result = await readPromos(accountId, { ...payload, take: 10 });
  return { candidates: result.promos, resolved: result.promos.length === 1 ? result.promos[0] : null };
}

export async function executePromoCreate(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const promo = await prisma.promotion.create({
    data: {
      accountId: ctx.accountId,
      name: requiredString(payload, "name"),
      type: promotionType(payload.type),
      value: requiredString(payload, "value"),
      startsAt: optionalDate(payload, "startsAt"),
      endsAt: optionalDate(payload, "endsAt"),
      isActive: payload.isActive === undefined ? true : Boolean(payload.isActive),
    },
  });
  return { status: "DONE" as const, data: { promoId: promo.id } };
}

export async function executePromoUpdate(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const promoId = requiredNumber(payload.promoId ?? payload.promotionId, "promoId");
  const updated = await prisma.promotion.updateMany({
    where: { id: promoId, accountId: ctx.accountId },
    data: {
      ...(payload.name !== undefined ? { name: requiredString(payload, "name") } : {}),
      ...(payload.type !== undefined ? { type: promotionType(payload.type) } : {}),
      ...(payload.value !== undefined ? { value: requiredString(payload, "value") } : {}),
      ...(payload.startsAt !== undefined ? { startsAt: optionalDate(payload, "startsAt") } : {}),
      ...(payload.endsAt !== undefined ? { endsAt: optionalDate(payload, "endsAt") } : {}),
      ...(payload.isActive !== undefined ? { isActive: Boolean(payload.isActive) } : {}),
    },
  });
  if (!updated.count) throw new Error("Promotion not found.");
  return { status: "DONE" as const, data: { promoId } };
}

export async function executePromoActive(payload: JsonRecord, ctx: CrmAgentActionContext, isActive: boolean) {
  const promoId = requiredNumber(payload.promoId ?? payload.promotionId, "promoId");
  const updated = await prisma.promotion.updateMany({ where: { id: promoId, accountId: ctx.accountId }, data: { isActive } });
  if (!updated.count) throw new Error("Promotion not found.");
  return { status: "DONE" as const, data: { promoId, isActive } };
}

export async function executePromoCodeCreate(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const promotionId = requiredNumber(payload.promoId ?? payload.promotionId, "promoId");
  await assertPromo(ctx.accountId, promotionId);
  const code = await prisma.promoCode.create({
    data: {
      accountId: ctx.accountId,
      promotionId,
      code: requiredString(payload, "code"),
      startsAt: optionalDate(payload, "startsAt"),
      endsAt: optionalDate(payload, "endsAt"),
      maxUses: numberOrNull(payload.maxUses),
      maxUsesPerClient: numberOrNull(payload.maxUsesPerClient),
    },
  });
  return { status: "DONE" as const, data: { promoCodeId: code.id } };
}

export async function executePromoCodeUpdate(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const promoCodeId = requiredNumber(payload.promoCodeId, "promoCodeId");
  const updated = await prisma.promoCode.updateMany({
    where: { id: promoCodeId, accountId: ctx.accountId },
    data: {
      ...(payload.code !== undefined ? { code: requiredString(payload, "code") } : {}),
      ...(payload.startsAt !== undefined ? { startsAt: optionalDate(payload, "startsAt") } : {}),
      ...(payload.endsAt !== undefined ? { endsAt: optionalDate(payload, "endsAt") } : {}),
      ...(payload.maxUses !== undefined ? { maxUses: numberOrNull(payload.maxUses) } : {}),
      ...(payload.maxUsesPerClient !== undefined ? { maxUsesPerClient: numberOrNull(payload.maxUsesPerClient) } : {}),
    },
  });
  if (!updated.count) throw new Error("Promo code not found.");
  return { status: "DONE" as const, data: { promoCodeId } };
}

export async function executePromoCodeDisable(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const promoCodeId = requiredNumber(payload.promoCodeId, "promoCodeId");
  const updated = await prisma.promoCode.updateMany({ where: { id: promoCodeId, accountId: ctx.accountId }, data: { endsAt: ctx.now } });
  if (!updated.count) throw new Error("Promo code not found.");
  return { status: "DONE" as const, data: { promoCodeId, endsAt: ctx.now.toISOString() } };
}

export async function readPromoRedemptions(accountId: number, payload: JsonRecord) {
  const promoCodeId = numberOrNull(payload.promoCodeId);
  const promotionId = numberOrNull(payload.promoId ?? payload.promotionId);
  const rows = await prisma.promoRedemption.findMany({
    where: {
      ...(promoCodeId ? { promoCodeId } : {}),
      promoCode: { accountId, ...(promotionId ? { promotionId } : {}) },
    },
    orderBy: { createdAt: "desc" },
    take: take(payload.take),
    include: { promoCode: { select: { id: true, code: true, promotionId: true } }, client: { select: { id: true, firstName: true, lastName: true, phone: true } } },
  });
  return {
    redemptions: rows.map((row) => ({
      ...row,
      redeemedAt: row.redeemedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    })),
  };
}

export async function previewPromoSuggestion(payload: JsonRecord, kind: "retention" | "empty_slots" | "birthday") {
  const defaults = {
    retention: { name: "Retention comeback offer", type: "PERCENT", value: "10", audience: "clients without recent visits" },
    empty_slots: { name: "Empty slots fill offer", type: "PERCENT", value: "15", audience: "clients available during low-load windows" },
    birthday: { name: "Birthday client offer", type: "PERCENT", value: "10", audience: "clients with upcoming birthdays" },
  }[kind];
  return buildActionPreview({ after: { ...defaults, filters: payload, generated: true } });
}

async function loadPromo(accountId: number, promoId: number | null) {
  if (!promoId) return null;
  const promo = await prisma.promotion.findFirst({ where: { id: promoId, accountId }, include: { promoCodes: { orderBy: { createdAt: "desc" } } } });
  return promo ? serializePromo(promo) : null;
}

async function assertPromo(accountId: number, promoId: number) {
  const promo = await prisma.promotion.findFirst({ where: { id: promoId, accountId }, select: { id: true } });
  if (!promo) throw new Error("Promotion not found.");
}

function serializePromo(promo: {
  id: number;
  accountId: number;
  name: string;
  type: unknown;
  value: { toString(): string };
  startsAt: Date | null;
  endsAt: Date | null;
  isActive: boolean;
  createdAt: Date;
  promoCodes: Array<{ id: number; code: string; startsAt: Date | null; endsAt: Date | null; maxUses: number | null; maxUsesPerClient: number | null; createdAt: Date }>;
}) {
  return {
    ...promo,
    value: promo.value.toString(),
    startsAt: promo.startsAt?.toISOString() ?? null,
    endsAt: promo.endsAt?.toISOString() ?? null,
    createdAt: promo.createdAt.toISOString(),
    promoCodes: promo.promoCodes.map((code) => ({
      ...code,
      startsAt: code.startsAt?.toISOString() ?? null,
      endsAt: code.endsAt?.toISOString() ?? null,
      createdAt: code.createdAt.toISOString(),
    })),
  };
}

function promotionType(value: unknown): PromotionTypeValue {
  if (value === "PERCENT" || value === "FIXED" || value === "BUNDLE") return value;
  throw new Error("Action payload type must be PERCENT, FIXED or BUNDLE.");
}

function take(value: unknown, fallback = 20, max = 100) {
  const parsed = numberOrNull(value) ?? fallback;
  return Math.min(Math.max(Math.trunc(parsed), 1), max);
}

function numberOrNull(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && /^\d+$/.test(value)) return Number(value);
  return null;
}
