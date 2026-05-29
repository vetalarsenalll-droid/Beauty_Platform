import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildActionPreview } from "../action-preview";
import { optionalDate, optionalString, requiredNumber, requiredString, type JsonRecord } from "../action-helpers";
import type { CrmAgentActionContext } from "../types";

type LoyaltyTransactionTypeValue = "EARN" | "SPEND" | "EXPIRE" | "ADJUSTMENT" | "REFUND_REVERSAL";
type GiftCardStatusValue = "ACTIVE" | "REDEEMED" | "EXPIRED" | "CANCELLED";
type MembershipTypeValue = "COUNT" | "PERIOD";

export async function previewLoyaltyPayload(payload: JsonRecord) {
  return buildActionPreview({ after: payload });
}

export async function readWallet(accountId: number, payload: JsonRecord) {
  const clientId = requiredNumber(payload.clientId, "clientId");
  await assertClient(accountId, clientId);
  const wallet = await prisma.loyaltyWallet.findFirst({
    where: { accountId, clientId },
    include: { transactions: { orderBy: { createdAt: "desc" }, take: take(payload.take) } },
  });
  return { wallet: wallet ? serializeWallet(wallet) : null };
}

export async function readTransactions(accountId: number, payload: JsonRecord) {
  const clientId = requiredNumber(payload.clientId, "clientId");
  await assertClient(accountId, clientId);
  const wallet = await prisma.loyaltyWallet.findFirst({
    where: { accountId, clientId },
    include: { transactions: { orderBy: { createdAt: "desc" }, take: take(payload.take) } },
  });
  return { transactions: wallet?.transactions.map(serializeTransaction) ?? [] };
}

export async function executeAdjustBalance(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const clientId = requiredNumber(payload.clientId, "clientId");
  await assertClient(ctx.accountId, clientId);
  const amount = decimal(payload.amount, "amount");
  const wallet = await ensureWallet(ctx.accountId, clientId);
  const nextBalance = new Prisma.Decimal(wallet.balance).plus(amount);
  const updated = await prisma.loyaltyWallet.update({ where: { id: wallet.id }, data: { balance: nextBalance } });
  const transaction = await prisma.loyaltyTransaction.create({
    data: {
      walletId: updated.id,
      type: transactionType(payload.type ?? "ADJUSTMENT"),
      amount,
      reason: optionalString(payload, "reason"),
      sourceType: optionalString(payload, "sourceType") ?? "crm_agent",
      sourceId: optionalString(payload, "sourceId"),
      expiresAt: optionalDate(payload, "expiresAt"),
    },
  });
  return { status: "DONE" as const, data: { walletId: updated.id, transactionId: transaction.id, balance: updated.balance.toString() } };
}

export async function executeCreateRule(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const rule = await prisma.loyaltyRule.create({
    data: {
      accountId: ctx.accountId,
      name: requiredString(payload, "name"),
      type: requiredString(payload, "type"),
      value: decimal(payload.value, "value"),
      isActive: payload.isActive === undefined ? true : Boolean(payload.isActive),
    },
  });
  return { status: "DONE" as const, data: { loyaltyRuleId: rule.id } };
}

export async function executeUpdateRule(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const loyaltyRuleId = requiredNumber(payload.loyaltyRuleId ?? payload.ruleId, "loyaltyRuleId");
  const updated = await prisma.loyaltyRule.updateMany({
    where: { id: loyaltyRuleId, accountId: ctx.accountId },
    data: {
      ...(payload.name !== undefined ? { name: requiredString(payload, "name") } : {}),
      ...(payload.type !== undefined ? { type: requiredString(payload, "type") } : {}),
      ...(payload.value !== undefined ? { value: decimal(payload.value, "value") } : {}),
      ...(payload.isActive !== undefined ? { isActive: Boolean(payload.isActive) } : {}),
    },
  });
  if (!updated.count) throw new Error("Loyalty rule not found.");
  return { status: "DONE" as const, data: { loyaltyRuleId } };
}

export async function executeDisableRule(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const loyaltyRuleId = requiredNumber(payload.loyaltyRuleId ?? payload.ruleId, "loyaltyRuleId");
  const updated = await prisma.loyaltyRule.updateMany({ where: { id: loyaltyRuleId, accountId: ctx.accountId }, data: { isActive: false } });
  if (!updated.count) throw new Error("Loyalty rule not found.");
  return { status: "DONE" as const, data: { loyaltyRuleId, isActive: false } };
}

export async function readGiftCards(accountId: number, payload: JsonRecord) {
  const query = optionalString(payload, "query");
  const rows = await prisma.giftCard.findMany({
    where: {
      accountId,
      ...(query ? { code: { contains: query, mode: "insensitive" } } : {}),
      ...(payload.status !== undefined ? { status: giftCardStatus(payload.status) } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: take(payload.take),
  });
  return { giftCards: rows.map(serializeGiftCard) };
}

export async function executeGiftCardCreate(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const amount = decimal(payload.amount, "amount");
  const card = await prisma.giftCard.create({
    data: {
      accountId: ctx.accountId,
      code: requiredString(payload, "code"),
      amount,
      balance: payload.balance !== undefined ? decimal(payload.balance, "balance") : amount,
      status: payload.status === undefined ? "ACTIVE" : giftCardStatus(payload.status),
      expiresAt: optionalDate(payload, "expiresAt"),
    },
  });
  return { status: "DONE" as const, data: { giftCardId: card.id } };
}

export async function executeGiftCardUpdate(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const giftCardId = requiredNumber(payload.giftCardId, "giftCardId");
  const updated = await prisma.giftCard.updateMany({
    where: { id: giftCardId, accountId: ctx.accountId },
    data: {
      ...(payload.code !== undefined ? { code: requiredString(payload, "code") } : {}),
      ...(payload.amount !== undefined ? { amount: decimal(payload.amount, "amount") } : {}),
      ...(payload.balance !== undefined ? { balance: decimal(payload.balance, "balance") } : {}),
      ...(payload.status !== undefined ? { status: giftCardStatus(payload.status) } : {}),
      ...(payload.expiresAt !== undefined ? { expiresAt: optionalDate(payload, "expiresAt") } : {}),
    },
  });
  if (!updated.count) throw new Error("Gift card not found.");
  return { status: "DONE" as const, data: { giftCardId } };
}

export async function executeGiftCardStatus(payload: JsonRecord, ctx: CrmAgentActionContext, status: GiftCardStatusValue) {
  const giftCardId = requiredNumber(payload.giftCardId, "giftCardId");
  const updated = await prisma.giftCard.updateMany({ where: { id: giftCardId, accountId: ctx.accountId }, data: { status } });
  if (!updated.count) throw new Error("Gift card not found.");
  return { status: "DONE" as const, data: { giftCardId, status } };
}

export async function readMemberships(accountId: number, payload: JsonRecord) {
  const query = optionalString(payload, "query");
  const rows = await prisma.membership.findMany({
    where: { accountId, ...(query ? { name: { contains: query, mode: "insensitive" } } : {}) },
    orderBy: { createdAt: "desc" },
    take: take(payload.take),
    include: { redemptions: { orderBy: { createdAt: "desc" }, take: 10 } },
  });
  return { memberships: rows.map(serializeMembership) };
}

export async function executeMembershipCreate(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const membership = await prisma.membership.create({
    data: {
      accountId: ctx.accountId,
      name: requiredString(payload, "name"),
      type: membershipType(payload.type),
      totalUses: numberOrNull(payload.totalUses),
      validFrom: optionalDate(payload, "validFrom"),
      validTo: optionalDate(payload, "validTo"),
    },
  });
  return { status: "DONE" as const, data: { membershipId: membership.id } };
}

export async function executeMembershipUpdate(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const membershipId = requiredNumber(payload.membershipId, "membershipId");
  const updated = await prisma.membership.updateMany({
    where: { id: membershipId, accountId: ctx.accountId },
    data: {
      ...(payload.name !== undefined ? { name: requiredString(payload, "name") } : {}),
      ...(payload.type !== undefined ? { type: membershipType(payload.type) } : {}),
      ...(payload.totalUses !== undefined ? { totalUses: numberOrNull(payload.totalUses) } : {}),
      ...(payload.validFrom !== undefined ? { validFrom: optionalDate(payload, "validFrom") } : {}),
      ...(payload.validTo !== undefined ? { validTo: optionalDate(payload, "validTo") } : {}),
    },
  });
  if (!updated.count) throw new Error("Membership not found.");
  return { status: "DONE" as const, data: { membershipId } };
}

export async function executeMembershipActivate(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const membershipId = requiredNumber(payload.membershipId, "membershipId");
  const updated = await prisma.membership.updateMany({
    where: { id: membershipId, accountId: ctx.accountId },
    data: { validFrom: optionalDate(payload, "validFrom") ?? ctx.now, validTo: null },
  });
  if (!updated.count) throw new Error("Membership not found.");
  return { status: "DONE" as const, data: { membershipId, active: true } };
}

export async function executeMembershipCancel(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const membershipId = requiredNumber(payload.membershipId, "membershipId");
  const updated = await prisma.membership.updateMany({ where: { id: membershipId, accountId: ctx.accountId }, data: { validTo: ctx.now } });
  if (!updated.count) throw new Error("Membership not found.");
  return { status: "DONE" as const, data: { membershipId, validTo: ctx.now.toISOString() } };
}

export async function executeMembershipRedeem(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const membershipId = requiredNumber(payload.membershipId, "membershipId");
  const clientId = requiredNumber(payload.clientId, "clientId");
  await assertClient(ctx.accountId, clientId);
  const membership = await prisma.membership.findFirst({ where: { id: membershipId, accountId: ctx.accountId }, include: { redemptions: true } });
  if (!membership) throw new Error("Membership not found.");
  if (membership.totalUses != null && membership.redemptions.filter((item) => item.usedAt).length >= membership.totalUses) throw new Error("Membership has no remaining uses.");
  const redemption = await prisma.membershipRedemption.create({
    data: { membershipId, clientId, usedAt: payload.usedAt === undefined ? ctx.now : optionalDate(payload, "usedAt") },
  });
  return { status: "DONE" as const, data: { membershipRedemptionId: redemption.id } };
}

async function assertClient(accountId: number, clientId: number) {
  const client = await prisma.client.findFirst({ where: { id: clientId, accountId }, select: { id: true } });
  if (!client) throw new Error("Client not found.");
}

async function ensureWallet(accountId: number, clientId: number) {
  const wallet = await prisma.loyaltyWallet.findFirst({ where: { accountId, clientId } });
  if (wallet) return wallet;
  return prisma.loyaltyWallet.create({ data: { accountId, clientId, balance: new Prisma.Decimal(0) } });
}

function serializeWallet(wallet: { id: number; accountId: number; clientId: number; balance: { toString(): string }; createdAt: Date; updatedAt: Date; transactions: Array<LoyaltyTransactionRow> }) {
  return {
    ...wallet,
    balance: wallet.balance.toString(),
    createdAt: wallet.createdAt.toISOString(),
    updatedAt: wallet.updatedAt.toISOString(),
    transactions: wallet.transactions.map(serializeTransaction),
  };
}

type LoyaltyTransactionRow = { id: number; walletId: number; type: unknown; amount: { toString(): string }; reason: string | null; sourceType: string | null; sourceId: string | null; expiresAt: Date | null; createdAt: Date };

function serializeTransaction(transaction: LoyaltyTransactionRow) {
  return {
    ...transaction,
    amount: transaction.amount.toString(),
    expiresAt: transaction.expiresAt?.toISOString() ?? null,
    createdAt: transaction.createdAt.toISOString(),
  };
}

function serializeGiftCard(card: { id: number; accountId: number; code: string; amount: { toString(): string }; balance: { toString(): string }; status: unknown; expiresAt: Date | null; createdAt: Date }) {
  return {
    ...card,
    amount: card.amount.toString(),
    balance: card.balance.toString(),
    expiresAt: card.expiresAt?.toISOString() ?? null,
    createdAt: card.createdAt.toISOString(),
  };
}

function serializeMembership(membership: {
  id: number;
  accountId: number;
  name: string;
  type: unknown;
  totalUses: number | null;
  validFrom: Date | null;
  validTo: Date | null;
  createdAt: Date;
  redemptions: Array<{ id: number; membershipId: number; clientId: number; usedAt: Date | null; createdAt: Date }>;
}) {
  return {
    ...membership,
    validFrom: membership.validFrom?.toISOString() ?? null,
    validTo: membership.validTo?.toISOString() ?? null,
    createdAt: membership.createdAt.toISOString(),
    redemptions: membership.redemptions.map((item) => ({ ...item, usedAt: item.usedAt?.toISOString() ?? null, createdAt: item.createdAt.toISOString() })),
  };
}

function transactionType(value: unknown): LoyaltyTransactionTypeValue {
  if (value === "EARN" || value === "SPEND" || value === "EXPIRE" || value === "ADJUSTMENT" || value === "REFUND_REVERSAL") return value;
  throw new Error("Action payload type is invalid.");
}

function giftCardStatus(value: unknown): GiftCardStatusValue {
  if (value === "ACTIVE" || value === "REDEEMED" || value === "EXPIRED" || value === "CANCELLED") return value;
  throw new Error("Action payload status is invalid.");
}

function membershipType(value: unknown): MembershipTypeValue {
  if (value === "COUNT" || value === "PERIOD") return value;
  throw new Error("Action payload type must be COUNT or PERIOD.");
}

function decimal(value: unknown, key: string) {
  if (value instanceof Prisma.Decimal) return value;
  if (typeof value === "number" && Number.isFinite(value)) return new Prisma.Decimal(value);
  if (typeof value === "string" && value.trim() && !Number.isNaN(Number(value))) return new Prisma.Decimal(value.trim());
  throw new Error(`Action payload ${key} is required.`);
}

function numberOrNull(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === "string" && /^\d+$/.test(value)) return Number(value);
  return null;
}

function take(value: unknown, fallback = 30, max = 100) {
  return Math.min(Math.max(numberOrNull(value) ?? fallback, 1), max);
}
