import { prisma } from "@/lib/prisma";
import { buildActionPreview } from "../action-preview";
import { numberOrNull, optionalBoolean, optionalString, requiredNumber, requiredString, type JsonRecord } from "../action-helpers";
import type { CrmAgentActionContext } from "../types";

export async function previewLegalPayload(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const documentId = numberOrNull(payload.documentId);
  const before = documentId ? await readDocument(ctx.accountId, documentId) : null;
  return buildActionPreview({ before: before ? serializeDocument(before) : null, after: payload });
}

export async function readLegalDocuments(accountId: number, payload: JsonRecord) {
  const documents = await prisma.legalDocument.findMany({
    where: {
      accountId,
      ...(payload.documentId !== undefined ? { id: requiredNumber(payload.documentId, "documentId") } : {}),
      ...(payload.key !== undefined ? { key: requiredString(payload, "key") } : {}),
    },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    include: { versions: { orderBy: [{ isActive: "desc" }, { version: "desc" }] } },
  });
  return { documents: documents.map(serializeDocument) };
}

export async function readLegalAcceptances(accountId: number, payload: JsonRecord) {
  const rows = await prisma.legalAcceptance.findMany({
    where: {
      accountId,
      ...(payload.clientId !== undefined ? { clientId: requiredNumber(payload.clientId, "clientId") } : {}),
      ...(payload.appointmentId !== undefined ? { appointmentId: requiredNumber(payload.appointmentId, "appointmentId") } : {}),
      ...(payload.documentVersionId !== undefined ? { documentVersionId: requiredNumber(payload.documentVersionId, "documentVersionId") } : {}),
    },
    orderBy: { acceptedAt: "desc" },
    take: take(payload.take),
    include: { documentVersion: { include: { document: true } }, client: { select: { id: true, firstName: true, lastName: true, phone: true } } },
  });
  return {
    acceptances: rows.map((row) => ({
      id: row.id,
      documentVersionId: row.documentVersionId,
      documentId: row.documentVersion.documentId,
      documentKey: row.documentVersion.document.key,
      documentTitle: row.documentVersion.document.title,
      version: row.documentVersion.version,
      client: row.client,
      appointmentId: row.appointmentId,
      source: row.source,
      ip: row.ip,
      userAgent: row.userAgent,
      acceptedAt: row.acceptedAt.toISOString(),
    })),
  };
}

export async function readMissingAcceptances(accountId: number, payload: JsonRecord) {
  const appointmentId = numberOrNull(payload.appointmentId);
  const clientId = numberOrNull(payload.clientId) ?? (appointmentId ? await clientIdFromAppointment(accountId, appointmentId) : null);
  const documents = await prisma.legalDocument.findMany({
    where: { accountId, isRequired: true, versions: { some: { isActive: true } } },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    include: { versions: { where: { isActive: true }, orderBy: { version: "desc" }, take: 1 } },
  });
  const versionIds = documents.flatMap((doc) => doc.versions.map((version) => version.id));
  const acceptances = clientId
    ? await prisma.legalAcceptance.findMany({
        where: { accountId, clientId, documentVersionId: { in: versionIds }, ...(appointmentId ? { appointmentId } : {}) },
        select: { documentVersionId: true },
      })
    : [];
  const accepted = new Set(acceptances.map((item) => item.documentVersionId));
  return {
    clientId,
    appointmentId,
    missingAcceptances: documents
      .map((doc) => {
        const version = doc.versions[0];
        return version
          ? {
              documentId: doc.id,
              documentVersionId: version.id,
              key: doc.key,
              title: doc.title,
              version: version.version,
              missing: !accepted.has(version.id),
            }
          : null;
      })
      .filter((item) => item && item.missing),
  };
}

export async function executeLegalCreateDocument(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const document = await prisma.legalDocument.create({
    data: {
      accountId: ctx.accountId,
      key: normalizeKey(requiredString(payload, "key")),
      title: requiredString(payload, "title"),
      description: optionalString(payload, "description"),
      isRequired: optionalBoolean(payload, "isRequired") ?? true,
      sortOrder: numberOrNull(payload.sortOrder) ?? 0,
      versions:
        payload.content !== undefined
          ? { create: { version: 1, content: requiredString(payload, "content"), isActive: optionalBoolean(payload, "publishNow") ?? false } }
          : undefined,
    },
    include: { versions: true },
  });
  return { status: "DONE" as const, data: { documentId: document.id, versionId: document.versions[0]?.id ?? null } };
}

export async function executeLegalUpdateDocument(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const documentId = requiredNumber(payload.documentId, "documentId");
  await assertDocument(ctx.accountId, documentId);
  const document = await prisma.legalDocument.update({
    where: { id: documentId },
    data: {
      ...(payload.key !== undefined ? { key: normalizeKey(requiredString(payload, "key")) } : {}),
      ...(payload.title !== undefined ? { title: requiredString(payload, "title") } : {}),
      ...(payload.description !== undefined ? { description: optionalString(payload, "description") } : {}),
      ...(payload.isRequired !== undefined ? { isRequired: optionalBoolean(payload, "isRequired") ?? true } : {}),
      ...(payload.sortOrder !== undefined ? { sortOrder: numberOrNull(payload.sortOrder) ?? 0 } : {}),
    },
  });
  let versionId: number | null = null;
  if (payload.content !== undefined) {
    const last = await prisma.legalDocumentVersion.findFirst({ where: { documentId }, orderBy: { version: "desc" } });
    const version = await prisma.legalDocumentVersion.create({
      data: { documentId, version: (last?.version ?? 0) + 1, content: requiredString(payload, "content"), isActive: false },
    });
    versionId = version.id;
  }
  return { status: "DONE" as const, data: { documentId: document.id, versionId } };
}

export async function executeLegalPublishVersion(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const versionId = requiredNumber(payload.versionId ?? payload.documentVersionId, "versionId");
  const version = await prisma.legalDocumentVersion.findFirst({ where: { id: versionId, document: { accountId: ctx.accountId } } });
  if (!version) throw new Error("Legal document version not found.");
  await prisma.$transaction([
    prisma.legalDocumentVersion.updateMany({ where: { documentId: version.documentId, isActive: true }, data: { isActive: false } }),
    prisma.legalDocumentVersion.update({ where: { id: version.id }, data: { isActive: true, publishedAt: ctx.now } }),
  ]);
  return { status: "DONE" as const, data: { documentId: version.documentId, versionId: version.id, published: true } };
}

export async function executeLegalArchiveDocument(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const documentId = requiredNumber(payload.documentId, "documentId");
  await assertDocument(ctx.accountId, documentId);
  await prisma.$transaction([
    prisma.legalDocument.update({ where: { id: documentId }, data: { isRequired: false, sortOrder: numberOrNull(payload.sortOrder) ?? 9999 } }),
    prisma.legalDocumentVersion.updateMany({ where: { documentId, isActive: true }, data: { isActive: false } }),
  ]);
  return { status: "DONE" as const, data: { documentId, archived: true } };
}

async function readDocument(accountId: number, documentId: number) {
  return prisma.legalDocument.findFirst({
    where: { id: documentId, accountId },
    include: { versions: { orderBy: [{ isActive: "desc" }, { version: "desc" }] } },
  });
}

async function assertDocument(accountId: number, documentId: number) {
  const document = await prisma.legalDocument.findFirst({ where: { id: documentId, accountId }, select: { id: true } });
  if (!document) throw new Error("Legal document not found.");
}

async function clientIdFromAppointment(accountId: number, appointmentId: number) {
  const appointment = await prisma.appointment.findFirst({ where: { id: appointmentId, accountId }, select: { clientId: true } });
  if (!appointment) throw new Error("Appointment not found.");
  return appointment.clientId;
}

function serializeDocument(document: {
  id: number;
  key: string;
  title: string;
  description: string | null;
  isRequired: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
  versions: { id: number; version: number; content: string; publishedAt: Date; isActive: boolean; createdAt: Date }[];
}) {
  return {
    id: document.id,
    key: document.key,
    title: document.title,
    description: document.description,
    isRequired: document.isRequired,
    sortOrder: document.sortOrder,
    createdAt: document.createdAt.toISOString(),
    updatedAt: document.updatedAt.toISOString(),
    versions: document.versions.map((version) => ({
      id: version.id,
      version: version.version,
      content: version.content,
      publishedAt: version.publishedAt.toISOString(),
      isActive: version.isActive,
      createdAt: version.createdAt.toISOString(),
    })),
  };
}

function normalizeKey(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

function take(value: unknown) {
  return Math.min(Math.max(Math.trunc(numberOrNull(value) ?? 50), 1), 100);
}
