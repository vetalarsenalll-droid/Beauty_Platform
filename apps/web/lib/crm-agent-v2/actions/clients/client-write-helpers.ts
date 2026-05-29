import { prisma } from "@/lib/prisma";
import { buildActionPreview } from "../action-preview";
import {
  optionalBoolean,
  optionalDate,
  optionalString,
  requiredNumber,
  requiredString,
  type JsonRecord,
} from "../action-helpers";
import type { CrmAgentActionContext, CrmAgentActionPreview } from "../types";

const ARCHIVED_TAG = "archived";

export async function previewClientMutation(payload: JsonRecord, ctx: CrmAgentActionContext): Promise<CrmAgentActionPreview> {
  const before = await loadClientSnapshot(ctx.accountId, numberOrNull(payload.clientId));
  return buildActionPreview({ before, after: { ...(before ?? {}), ...payload } });
}

export async function executeClientArchive(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const clientId = requiredNumber(payload.clientId, "clientId");
  await assertClientBelongsToAccount(ctx.accountId, clientId);
  const tag = await ensureClientTag(ctx.accountId, ARCHIVED_TAG);
  await prisma.clientTagAssignment.upsert({
    where: { clientId_tagId: { clientId, tagId: tag.id } },
    create: { clientId, tagId: tag.id },
    update: {},
  });
  await prisma.clientNote.create({ data: { clientId, note: "Archived by CRM Agent v2." } });
  return { status: "DONE" as const, data: { clientId, archivedTagId: tag.id } };
}

export async function executeClientRestore(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const clientId = requiredNumber(payload.clientId, "clientId");
  await assertClientBelongsToAccount(ctx.accountId, clientId);
  const tag = await prisma.clientTag.findFirst({ where: { accountId: ctx.accountId, name: ARCHIVED_TAG }, select: { id: true } });
  if (tag) await prisma.clientTagAssignment.deleteMany({ where: { clientId, tagId: tag.id } });
  await prisma.clientNote.create({ data: { clientId, note: "Restored by CRM Agent v2." } });
  return { status: "DONE" as const, data: { clientId, archivedTagRemoved: Boolean(tag) } };
}

export async function executeClientContactAdd(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const clientId = requiredNumber(payload.clientId, "clientId");
  await assertClientBelongsToAccount(ctx.accountId, clientId);
  const contact = await prisma.clientContact.create({
    data: {
      clientId,
      type: requiredString(payload, "type"),
      value: requiredString(payload, "value"),
      verifiedAt: optionalDate(payload, "verifiedAt"),
    },
  });
  return { status: "DONE" as const, data: { clientId, contactId: contact.id } };
}

export async function executeClientContactUpdate(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const contactId = requiredNumber(payload.contactId, "contactId");
  const updated = await prisma.clientContact.updateMany({
    where: { id: contactId, client: { accountId: ctx.accountId } },
    data: {
      ...(payload.type !== undefined ? { type: requiredString(payload, "type") } : {}),
      ...(payload.value !== undefined ? { value: requiredString(payload, "value") } : {}),
      ...(payload.verifiedAt !== undefined ? { verifiedAt: optionalDate(payload, "verifiedAt") } : {}),
    },
  });
  if (!updated.count) throw new Error("Client contact not found.");
  return { status: "DONE" as const, data: { contactId } };
}

export async function executeClientContactDelete(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const contactId = requiredNumber(payload.contactId, "contactId");
  const deleted = await prisma.clientContact.deleteMany({ where: { id: contactId, client: { accountId: ctx.accountId } } });
  if (!deleted.count) throw new Error("Client contact not found.");
  return { status: "DONE" as const, data: { contactId } };
}

export async function executeClientNoteAdd(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const clientId = requiredNumber(payload.clientId, "clientId");
  await assertClientBelongsToAccount(ctx.accountId, clientId);
  const note = await prisma.clientNote.create({ data: { clientId, note: requiredString(payload, "note") } });
  return { status: "DONE" as const, data: { clientId, noteId: note.id } };
}

export async function executeClientNoteUpdate(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const noteId = requiredNumber(payload.noteId, "noteId");
  const updated = await prisma.clientNote.updateMany({
    where: { id: noteId, client: { accountId: ctx.accountId } },
    data: { note: requiredString(payload, "note") },
  });
  if (!updated.count) throw new Error("Client note not found.");
  return { status: "DONE" as const, data: { noteId } };
}

export async function executeClientNoteDelete(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const noteId = requiredNumber(payload.noteId, "noteId");
  const deleted = await prisma.clientNote.deleteMany({ where: { id: noteId, client: { accountId: ctx.accountId } } });
  if (!deleted.count) throw new Error("Client note not found.");
  return { status: "DONE" as const, data: { noteId } };
}

export async function executeClientTagCreate(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const tag = await ensureClientTag(ctx.accountId, requiredString(payload, "name"));
  return { status: "DONE" as const, data: { tagId: tag.id, name: tag.name } };
}

export async function executeClientTagAdd(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const clientId = requiredNumber(payload.clientId, "clientId");
  await assertClientBelongsToAccount(ctx.accountId, clientId);
  const tag = await resolveClientTag(ctx.accountId, payload);
  if (!tag) throw new Error("Client tag not found.");
  await prisma.clientTagAssignment.upsert({
    where: { clientId_tagId: { clientId, tagId: tag.id } },
    create: { clientId, tagId: tag.id },
    update: {},
  });
  return { status: "DONE" as const, data: { clientId, tagId: tag.id, name: tag.name } };
}

export async function executeClientTagRemove(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const clientId = requiredNumber(payload.clientId, "clientId");
  await assertClientBelongsToAccount(ctx.accountId, clientId);
  const tag = await resolveClientTag(ctx.accountId, payload, false);
  const deleted = tag ? await prisma.clientTagAssignment.deleteMany({ where: { clientId, tagId: tag.id } }) : { count: 0 };
  return { status: "DONE" as const, data: { clientId, tagId: tag?.id ?? null, removed: deleted.count } };
}

export async function executeClientConsentUpdate(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const clientId = requiredNumber(payload.clientId, "clientId");
  await assertClientBelongsToAccount(ctx.accountId, clientId);
  const type = requiredString(payload, "type");
  const granted = optionalBoolean(payload, "granted") ?? true;
  const now = ctx.now;
  const updated = await prisma.clientConsent.updateMany({
    where: { clientId, type },
    data: { grantedAt: granted ? now : null, revokedAt: granted ? null : now },
  });
  if (!updated.count) {
    await prisma.clientConsent.create({ data: { clientId, type, grantedAt: granted ? now : null, revokedAt: granted ? null : now } });
  }
  return { status: "DONE" as const, data: { clientId, type, granted } };
}

export async function previewClientSegment(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const clients = await findSegmentClients(ctx.accountId, payload);
  return buildActionPreview({
    after: {
      name: optionalString(payload, "name"),
      filters: segmentFilters(payload),
      clientCount: clients.length,
      clientIds: clients.map((client) => client.id),
    },
    warnings: ["Client segments are prepared as drafts because there is no persisted segment model in the current schema."],
  });
}

export async function previewClientExport(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const clients = await findSegmentClients(ctx.accountId, payload);
  return buildActionPreview({
    after: {
      format: optionalString(payload, "format") ?? "csv",
      filters: segmentFilters(payload),
      rows: clients.map((client) => ({
        id: client.id,
        firstName: client.firstName,
        lastName: client.lastName,
        phone: client.phone,
        email: client.email,
        tags: client.tags.map((item) => item.tag.name),
      })),
    },
    warnings: ["Export preview contains CRM personal data and must be explicitly confirmed before any external transfer."],
  });
}

export async function previewClientNotify(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const clientId = requiredNumber(payload.clientId, "clientId");
  const before = await loadClientSnapshot(ctx.accountId, clientId);
  if (!before) throw new Error("Client not found.");
  return buildActionPreview({
    before,
    after: {
      clientId,
      channel: optionalString(payload, "channel") ?? "manual",
      subject: optionalString(payload, "subject"),
      bodyText: requiredString(payload, "bodyText"),
    },
    warnings: ["Notification sending is draft-only until delivery channel and consent enforcement are connected."],
  });
}

export async function previewClientMerge(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const targetClientId = requiredNumber(payload.targetClientId, "targetClientId");
  const sourceClientId = requiredNumber(payload.sourceClientId, "sourceClientId");
  const [target, source] = await Promise.all([
    loadClientSnapshot(ctx.accountId, targetClientId),
    loadClientSnapshot(ctx.accountId, sourceClientId),
  ]);
  if (!target || !source) throw new Error("Client not found.");
  return buildActionPreview({
    before: source,
    after: { targetClientId, sourceClientId, target, source, mergePlan: "Move child records to target and keep history." },
    warnings: ["Duplicate merge is draft-only until conflict rules for user links, reviews and legal acceptances are finalized."],
  });
}

export async function readClientHistory(accountId: number, payload: JsonRecord) {
  const clientId = requiredNumber(payload.clientId, "clientId");
  await assertClientBelongsToAccount(accountId, clientId);
  const [client, notes, consents, tags] = await Promise.all([
    loadClientSnapshot(accountId, clientId),
    prisma.clientNote.findMany({ where: { clientId }, orderBy: { createdAt: "desc" }, take: take(payload.take) }),
    prisma.clientConsent.findMany({ where: { clientId }, orderBy: { id: "desc" } }),
    prisma.clientTagAssignment.findMany({ where: { clientId }, select: { tag: true } }),
  ]);
  return {
    client,
    notes: notes.map((note) => ({ ...note, createdAt: note.createdAt.toISOString() })),
    consents: consents.map((consent) => ({
      ...consent,
      grantedAt: consent.grantedAt?.toISOString() ?? null,
      revokedAt: consent.revokedAt?.toISOString() ?? null,
    })),
    tags: tags.map((item) => item.tag),
  };
}

export async function readClientVisits(accountId: number, payload: JsonRecord) {
  const clientId = requiredNumber(payload.clientId, "clientId");
  await assertClientBelongsToAccount(accountId, clientId);
  const rows = await prisma.appointment.findMany({
    where: { accountId, clientId, ...dateRange(payload, "startAt") },
    orderBy: { startAt: "desc" },
    take: take(payload.take),
    select: { id: true, startAt: true, endAt: true, status: true, priceTotal: true, durationTotalMin: true, specialistId: true, locationId: true, comment: true },
  });
  return {
    visits: rows.map((row) => ({
      ...row,
      startAt: row.startAt.toISOString(),
      endAt: row.endAt.toISOString(),
      priceTotal: row.priceTotal.toString(),
    })),
  };
}

export async function readClientPayments(accountId: number, payload: JsonRecord) {
  const clientId = requiredNumber(payload.clientId, "clientId");
  await assertClientBelongsToAccount(accountId, clientId);
  const rows = await prisma.paymentIntent.findMany({
    where: { accountId, clientId, ...dateRange(payload, "createdAt") },
    orderBy: { createdAt: "desc" },
    take: take(payload.take),
    select: { id: true, appointmentId: true, amount: true, currency: true, status: true, scenario: true, provider: true, createdAt: true, updatedAt: true },
  });
  return {
    payments: rows.map((row) => ({
      ...row,
      amount: row.amount.toString(),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    })),
  };
}

export async function readClientReviews(accountId: number, payload: JsonRecord) {
  const clientId = requiredNumber(payload.clientId, "clientId");
  await assertClientBelongsToAccount(accountId, clientId);
  const rows = await prisma.review.findMany({
    where: { accountId, clientId, ...dateRange(payload, "createdAt") },
    orderBy: { createdAt: "desc" },
    take: take(payload.take),
    select: { id: true, appointmentId: true, entityType: true, entityId: true, rating: true, comment: true, status: true, replyText: true, createdAt: true, updatedAt: true },
  });
  return { reviews: rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() })) };
}

export async function readClientLoyalty(accountId: number, payload: JsonRecord) {
  const clientId = requiredNumber(payload.clientId, "clientId");
  await assertClientBelongsToAccount(accountId, clientId);
  const wallet = await prisma.loyaltyWallet.findFirst({
    where: { accountId, clientId },
    select: {
      id: true,
      balance: true,
      createdAt: true,
      updatedAt: true,
      transactions: { orderBy: { createdAt: "desc" }, take: take(payload.take), select: { id: true, type: true, amount: true, reason: true, sourceType: true, sourceId: true, expiresAt: true, createdAt: true } },
    },
  });
  return {
    loyalty: wallet
      ? {
          ...wallet,
          balance: wallet.balance.toString(),
          createdAt: wallet.createdAt.toISOString(),
          updatedAt: wallet.updatedAt.toISOString(),
          transactions: wallet.transactions.map((row) => ({
            ...row,
            amount: row.amount.toString(),
            expiresAt: row.expiresAt?.toISOString() ?? null,
            createdAt: row.createdAt.toISOString(),
          })),
        }
      : null,
  };
}

async function loadClientSnapshot(accountId: number, clientId: number | null) {
  if (!clientId) return null;
  const client = await prisma.client.findFirst({
    where: { id: clientId, accountId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phone: true,
      email: true,
      birthDate: true,
      createdAt: true,
      updatedAt: true,
      tags: { select: { tag: { select: { id: true, name: true } } } },
    },
  });
  return client
    ? {
        ...client,
        birthDate: client.birthDate?.toISOString() ?? null,
        createdAt: client.createdAt.toISOString(),
        updatedAt: client.updatedAt.toISOString(),
        tags: client.tags.map((item) => item.tag),
      }
    : null;
}

async function assertClientBelongsToAccount(accountId: number, clientId: number) {
  const client = await prisma.client.findFirst({ where: { id: clientId, accountId }, select: { id: true } });
  if (!client) throw new Error("Client not found.");
}

async function ensureClientTag(accountId: number, name: string) {
  const trimmed = name.trim();
  const existing = await prisma.clientTag.findFirst({ where: { accountId, name: trimmed }, select: { id: true, name: true } });
  return existing ?? prisma.clientTag.create({ data: { accountId, name: trimmed }, select: { id: true, name: true } });
}

async function resolveClientTag(accountId: number, payload: JsonRecord, createIfMissing = true) {
  const tagId = numberOrNull(payload.tagId);
  if (tagId) {
    const tag = await prisma.clientTag.findFirst({ where: { id: tagId, accountId }, select: { id: true, name: true } });
    if (!tag) throw new Error("Client tag not found.");
    return tag;
  }
  const name = requiredString(payload, "name");
  if (createIfMissing) return ensureClientTag(accountId, name);
  return prisma.clientTag.findFirst({ where: { accountId, name }, select: { id: true, name: true } });
}

async function findSegmentClients(accountId: number, payload: JsonRecord) {
  const query = optionalString(payload, "query");
  const tagName = optionalString(payload, "tagName");
  const createdFrom = optionalDate(payload, "createdFrom");
  const createdTo = optionalDate(payload, "createdTo");
  return prisma.client.findMany({
    where: {
      accountId,
      ...(query
        ? {
            OR: [
              { firstName: { contains: query, mode: "insensitive" } },
              { lastName: { contains: query, mode: "insensitive" } },
              { phone: { contains: query } },
              { email: { contains: query, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(tagName ? { tags: { some: { tag: { name: tagName, accountId } } } } : {}),
      ...(createdFrom || createdTo ? { createdAt: { ...(createdFrom ? { gte: createdFrom } : {}), ...(createdTo ? { lte: createdTo } : {}) } } : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: take(payload.take, 100, 500),
    select: { id: true, firstName: true, lastName: true, phone: true, email: true, tags: { select: { tag: { select: { name: true } } } } },
  });
}

function segmentFilters(payload: JsonRecord) {
  return {
    query: optionalString(payload, "query"),
    tagName: optionalString(payload, "tagName"),
    createdFrom: optionalString(payload, "createdFrom"),
    createdTo: optionalString(payload, "createdTo"),
  };
}

function dateRange(payload: JsonRecord, field: "createdAt" | "startAt") {
  const dateFrom = optionalDate(payload, "dateFrom");
  const dateTo = optionalDate(payload, "dateTo");
  return dateFrom || dateTo ? { [field]: { ...(dateFrom ? { gte: dateFrom } : {}), ...(dateTo ? { lte: dateTo } : {}) } } : {};
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
