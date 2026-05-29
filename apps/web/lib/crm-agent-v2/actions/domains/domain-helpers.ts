import { prisma } from "@/lib/prisma";
import { buildActionPreview } from "../action-preview";
import { requiredNumber, requiredString, type JsonRecord } from "../action-helpers";
import type { CrmAgentActionContext } from "../types";

export async function previewDomainAction(actionName: string, payload: JsonRecord, ctx: CrmAgentActionContext) {
  return buildActionPreview({ before: await listDomains(ctx.accountId), after: { actionName, ...payload } });
}

export async function readDomainAction(actionName: string, payload: JsonRecord, ctx: CrmAgentActionContext) {
  if (actionName === "domain.search") return listDomains(ctx.accountId);
  const domain = domainString(payload);
  const existing = await prisma.accountDomain.findFirst({ where: { accountId: ctx.accountId, domain } });
  return { domain, exists: Boolean(existing), record: existing ? serializeDomain(existing) : null, expectedDns: expectedDns(domain) };
}

export async function executeDomainAction(actionName: string, payload: JsonRecord, ctx: CrmAgentActionContext) {
  if (actionName === "domain.add") {
    const domain = await prisma.accountDomain.create({ data: { accountId: ctx.accountId, domain: domainString(payload) } });
    return { status: "DONE" as const, data: { domain: serializeDomain(domain) } };
  }
  if (actionName === "domain.remove") {
    const domainId = requiredNumber(payload.domainId ?? payload.id, "domainId");
    await prisma.accountDomain.deleteMany({ where: { id: domainId, accountId: ctx.accountId } });
    return { status: "DONE" as const, data: { domainId } };
  }
  if (actionName === "domain.set_primary") {
    const domainId = requiredNumber(payload.domainId ?? payload.id, "domainId");
    await prisma.accountDomain.updateMany({ where: { accountId: ctx.accountId }, data: { isPrimary: false } });
    const updated = await prisma.accountDomain.updateMany({ where: { id: domainId, accountId: ctx.accountId }, data: { isPrimary: true } });
    if (!updated.count) throw new Error("Domain not found.");
    return { status: "DONE" as const, data: { domainId, isPrimary: true } };
  }
  throw new Error(`Unsupported domain action: ${actionName}.`);
}

async function listDomains(accountId: number) {
  const domains = await prisma.accountDomain.findMany({ where: { accountId }, orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] });
  return { domains: domains.map(serializeDomain) };
}

function domainString(payload: JsonRecord) {
  return requiredString(payload, "domain").toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
}

function expectedDns(domain: string) {
  return { type: "CNAME", host: domain, value: "sites.onl.ai" };
}

function serializeDomain(domain: { id: number; domain: string; isPrimary: boolean; status: string; sslStatus: string; verifiedAt: Date | null; lastCheckedAt: Date | null; lastError: string | null; createdAt: Date; updatedAt: Date }) {
  return {
    ...domain,
    verifiedAt: domain.verifiedAt?.toISOString() ?? null,
    lastCheckedAt: domain.lastCheckedAt?.toISOString() ?? null,
    createdAt: domain.createdAt.toISOString(),
    updatedAt: domain.updatedAt.toISOString(),
  };
}
