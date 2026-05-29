import { prisma } from "@/lib/prisma";
import { buildActionPreview } from "../action-preview";
import { inputJson, requiredNumber, requiredString, type JsonRecord } from "../action-helpers";
import type { CrmAgentActionContext } from "../types";

export async function previewMediaAction(actionName: string, payload: JsonRecord, ctx: CrmAgentActionContext) {
  return buildActionPreview({ before: await readMediaAction("media.search", { take: 10 }, ctx), after: { actionName, ...payload } });
}

export async function readMediaAction(_actionName: string, payload: JsonRecord, ctx: CrmAgentActionContext) {
  const take = Math.min(Math.max(numberOrDefault(payload.take, 50), 1), 100);
  const includeArchived = Boolean(payload.includeArchived);
  const assets = await prisma.mediaAsset.findMany({
    where: { OR: [{ accountId: ctx.accountId }, { accountId: null }], ...(includeArchived ? {} : { archivedAt: null }) },
    orderBy: { createdAt: "desc" },
    take,
    include: { links: true },
  });
  const collections = await prisma.mediaCollection.findMany({ where: { accountId: ctx.accountId }, orderBy: { createdAt: "desc" }, take });
  return { assets: assets.map(serializeAsset), collections: collections.map(serializeCollection) };
}

export async function executeMediaAction(actionName: string, payload: JsonRecord, ctx: CrmAgentActionContext) {
  if (actionName === "media.upload") {
    const asset = await prisma.mediaAsset.create({
      data: {
        accountId: ctx.accountId,
        url: requiredString(payload, "url"),
        type: requiredString(payload, "type"),
        width: numberOrNull(payload.width),
        height: numberOrNull(payload.height),
        size: numberOrNull(payload.size),
        altText: optionalString(payload.altText),
        metadata: payload.metadata === undefined ? undefined : inputJson(payload.metadata),
      },
    });
    return { status: "DONE" as const, data: { mediaAssetId: asset.id } };
  }
  if (actionName === "media.update_alt") {
    const assetId = requiredNumber(payload.assetId ?? payload.mediaAssetId ?? payload.id, "assetId");
    const updated = await prisma.mediaAsset.updateMany({
      where: { id: assetId, accountId: ctx.accountId, archivedAt: null },
      data: { altText: requiredString(payload, "altText") },
    });
    if (!updated.count) throw new Error("Media asset not found.");
    return { status: "DONE" as const, data: { mediaAssetId: assetId } };
  }
  if (actionName === "media.update_metadata") {
    const assetId = requiredNumber(payload.assetId ?? payload.mediaAssetId ?? payload.id, "assetId");
    const updated = await prisma.mediaAsset.updateMany({
      where: { id: assetId, accountId: ctx.accountId, archivedAt: null },
      data: { metadata: inputJson(payload.metadata ?? {}) },
    });
    if (!updated.count) throw new Error("Media asset not found.");
    return { status: "DONE" as const, data: { mediaAssetId: assetId } };
  }
  if (actionName === "media.archive") {
    const assetId = requiredNumber(payload.assetId ?? payload.mediaAssetId ?? payload.id, "assetId");
    const updated = await prisma.mediaAsset.updateMany({
      where: { id: assetId, accountId: ctx.accountId, archivedAt: null },
      data: { archivedAt: ctx.now },
    });
    if (!updated.count) throw new Error("Media asset not found.");
    return { status: "DONE" as const, data: { mediaAssetId: assetId, archivedAt: ctx.now.toISOString() } };
  }
  if (actionName === "media.create_collection") {
    const collection = await prisma.mediaCollection.create({ data: { accountId: ctx.accountId, name: requiredString(payload, "name") } });
    return { status: "DONE" as const, data: { mediaCollectionId: collection.id } };
  }
  if (actionName === "media.update_collection") {
    const collectionId = requiredNumber(payload.collectionId ?? payload.id, "collectionId");
    await prisma.mediaCollection.updateMany({ where: { id: collectionId, accountId: ctx.accountId }, data: { name: requiredString(payload, "name") } });
    return { status: "DONE" as const, data: { mediaCollectionId: collectionId } };
  }
  if (actionName === "media.delete_collection") {
    const collectionId = requiredNumber(payload.collectionId ?? payload.id, "collectionId");
    await prisma.mediaLink.updateMany({ where: { collectionId, collection: { accountId: ctx.accountId } }, data: { collectionId: null } });
    await prisma.mediaCollection.deleteMany({ where: { id: collectionId, accountId: ctx.accountId } });
    return { status: "DONE" as const, data: { mediaCollectionId: collectionId } };
  }
  if (actionName.startsWith("media.link_to_")) {
    const assetId = requiredNumber(payload.assetId, "assetId");
    await assertAsset(ctx.accountId, assetId);
    const link = await prisma.mediaLink.create({
      data: {
        assetId,
        collectionId: numberOrNull(payload.collectionId),
        entityType: entityTypeForAction(actionName),
        entityId: String(payload.entityId ?? payload.accountId ?? ctx.accountId),
        sortOrder: numberOrDefault(payload.sortOrder, 0),
        isCover: Boolean(payload.isCover),
      },
    });
    return { status: "DONE" as const, data: { mediaLinkId: link.id } };
  }
  if (actionName === "media.unlink") {
    const mediaLinkId = requiredNumber(payload.mediaLinkId ?? payload.linkId ?? payload.id, "mediaLinkId");
    await prisma.mediaLink.deleteMany({ where: { id: mediaLinkId, asset: { OR: [{ accountId: ctx.accountId }, { accountId: null }] } } });
    return { status: "DONE" as const, data: { mediaLinkId } };
  }
  throw new Error(`Unsupported media action: ${actionName}.`);
}

async function assertAsset(accountId: number, assetId: number) {
  const asset = await prisma.mediaAsset.findFirst({ where: { id: assetId, OR: [{ accountId }, { accountId: null }] }, select: { id: true } });
  if (!asset) throw new Error("Media asset not found.");
}

function entityTypeForAction(actionName: string) {
  if (actionName === "media.link_to_location") return "location";
  if (actionName === "media.link_to_service") return "service";
  if (actionName === "media.link_to_specialist") return "specialist";
  return "account";
}

function serializeAsset(asset: { id: number; accountId: number | null; url: string; type: string; width: number | null; height: number | null; size: number | null; altText: string | null; metadata: unknown; archivedAt: Date | null; createdAt: Date; links: Array<{ id: number; entityType: string; entityId: string; collectionId: number | null; sortOrder: number; isCover: boolean; createdAt: Date }> }) {
  return {
    ...asset,
    archivedAt: asset.archivedAt?.toISOString() ?? null,
    createdAt: asset.createdAt.toISOString(),
    links: asset.links.map((link) => ({ ...link, createdAt: link.createdAt.toISOString() })),
  };
}

function serializeCollection(collection: { id: number; accountId: number; name: string; createdAt: Date }) {
  return { ...collection, createdAt: collection.createdAt.toISOString() };
}

function numberOrDefault(value: unknown, fallback: number) {
  return numberOrNull(value) ?? fallback;
}

function numberOrNull(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === "string" && /^\d+$/.test(value)) return Number(value);
  return null;
}

function optionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
