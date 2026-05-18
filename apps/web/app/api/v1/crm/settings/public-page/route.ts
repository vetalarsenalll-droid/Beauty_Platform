import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCrmPermission } from "@/lib/auth";
import {
  createDefaultDraft,
  DEFAULT_ACCOUNT_NAME,
  normalizeDraft,
  type SiteDraft,
  type SiteEntityPages,
  type SitePages,
  type SitePageKey,
} from "@/lib/site-builder";
import { Prisma } from "@prisma/client";

const parseJson = (value: unknown) => {
  if (!value) return null;
  if (typeof value === "object") return value as object;
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }
  return null;
};

const MAX_PUBLISH_RETRIES = 3;

const isRetryablePublishError = (error: unknown) => {
  if (!error || typeof error !== "object") return false;
  const code = (error as { code?: string }).code;
  return code === "P2002" || code === "P2034";
};

async function ensurePage(accountId: number) {
  const existing = await prisma.publicPage.findFirst({
    where: { accountId },
  });
  if (existing) return existing;
  const account = await prisma.account.findUnique({
    where: { id: accountId },
    select: { name: true },
  });

  return prisma.publicPage.create({
    data: {
      accountId,
      status: "DRAFT",
      draftJson: createDefaultDraft(account?.name?.trim() || DEFAULT_ACCOUNT_NAME) as Prisma.InputJsonValue,
    },
  });
}

async function publishPage(pageId: number, contentJson: object, draftJson: object = contentJson) {
  let lastError: unknown = null;
  const contentJsonInput = contentJson as Prisma.InputJsonValue;
  const draftJsonInput = draftJson as Prisma.InputJsonValue;

  for (let attempt = 0; attempt < MAX_PUBLISH_RETRIES; attempt += 1) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          const lastVersion = await tx.publicPageVersion.findFirst({
            where: { publicPageId: pageId },
            orderBy: { version: "desc" },
          });
          const nextVersion = (lastVersion?.version ?? 0) + 1;
          const version = await tx.publicPageVersion.create({
            data: {
              publicPageId: pageId,
              version: nextVersion,
              contentJson: contentJsonInput,
            },
          });

          return tx.publicPage.update({
            where: { id: pageId },
            data: {
              draftJson: draftJsonInput,
              status: "PUBLISHED",
              publishedVersionId: version.id,
            },
          });
        },
        { isolationLevel: "Serializable" }
      );
    } catch (error) {
      lastError = error;
      if (!isRetryablePublishError(error) || attempt === MAX_PUBLISH_RETRIES - 1) {
        throw error;
      }
    }
  }

  throw (lastError as Error) ?? new Error("Publish failed");
}

const SITE_PAGE_KEYS = new Set<SitePageKey>([
  "home",
  "booking",
  "client",
  "locations",
  "services",
  "specialists",
  "promos",
]);

const ENTITY_PAGE_KEYS = new Set<keyof SiteEntityPages>([
  "locations",
  "services",
  "specialists",
  "promos",
]);

function mergePublishedPageDraft(
  baseDraft: SiteDraft,
  currentDraft: SiteDraft,
  pageKey: SitePageKey,
  entity: { type: keyof SiteEntityPages; id: string } | null
): SiteDraft {
  const next: SiteDraft = JSON.parse(JSON.stringify(baseDraft)) as SiteDraft;

  if (entity && ENTITY_PAGE_KEYS.has(entity.type)) {
    const sourceBlocks =
      currentDraft.entityPages?.[entity.type]?.[entity.id] ??
      currentDraft.pages?.[pageKey] ??
      [];
    next.entityPages = { ...(next.entityPages ?? {}) };
    next.entityPages[entity.type] = {
      ...(next.entityPages[entity.type] ?? {}),
      [entity.id]: sourceBlocks,
    };
  } else {
    const sourceBlocks =
      pageKey === "home"
        ? currentDraft.pages?.home ?? currentDraft.blocks
        : currentDraft.pages?.[pageKey] ?? [];
    const basePages: SitePages = next.pages ?? currentDraft.pages ?? {
      home: next.blocks,
      booking: [],
      client: [],
      legal: [],
      locations: [],
      services: [],
      specialists: [],
      promos: [],
    };
    next.pages = {
      ...basePages,
      [pageKey]: sourceBlocks,
    };
    if (pageKey === "home") {
      next.blocks = sourceBlocks;
    }
  }

  if (currentDraft.pageThemes?.[pageKey]) {
    next.pageThemes = {
      ...(next.pageThemes ?? {}),
      [pageKey]: currentDraft.pageThemes[pageKey],
    };
  }

  return next;
}

export async function GET() {
  const session = await requireCrmPermission("crm.settings.read");
  const page = await ensurePage(session.accountId);
  const account = await prisma.account.findUnique({
    where: { id: session.accountId },
    select: { name: true },
  });
  const accountName = account?.name?.trim() || DEFAULT_ACCOUNT_NAME;
  const normalizedDraft = normalizeDraft((page.draftJson ?? {}) as SiteDraft, accountName);
  if (JSON.stringify(normalizedDraft) !== JSON.stringify(page.draftJson ?? {})) {
    await prisma.publicPage.update({
      where: { id: page.id },
      data: { draftJson: normalizedDraft as Prisma.InputJsonValue },
    });
  }
  return NextResponse.json({
    data: {
      id: page.id,
      status: page.status,
      draftJson: normalizedDraft,
      publishedVersionId: page.publishedVersionId,
    },
  });
}

export async function PATCH(request: Request) {
  const session = await requireCrmPermission("crm.settings.update");
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) {
    return NextResponse.json({ message: "Некорректный запрос." }, { status: 400 });
  }

  const page = await ensurePage(session.accountId);
  const account = await prisma.account.findUnique({
    where: { id: session.accountId },
    select: { name: true },
  });
  const accountName = account?.name?.trim() || DEFAULT_ACCOUNT_NAME;
  const rawDraftJson = parseJson(body.draftJson) ?? parseJson(page.draftJson) ?? {};
  const draftJson = normalizeDraft(rawDraftJson as SiteDraft, accountName);
  const publish = body.publish === true;
  const publishPageRaw = typeof body.publishPage === "string" ? body.publishPage : "";
  const publishPageKey = SITE_PAGE_KEYS.has(publishPageRaw as SitePageKey)
    ? (publishPageRaw as SitePageKey)
    : null;
  const publishEntityRaw =
    body.publishEntity && typeof body.publishEntity === "object"
      ? (body.publishEntity as Record<string, unknown>)
      : null;
  const publishEntityType: keyof SiteEntityPages | null =
    publishEntityRaw?.type === "locations" ||
    publishEntityRaw?.type === "services" ||
    publishEntityRaw?.type === "specialists" ||
    publishEntityRaw?.type === "promos"
      ? publishEntityRaw.type
      : null;
  const publishEntityId =
    typeof publishEntityRaw?.id === "string" || typeof publishEntityRaw?.id === "number"
      ? String(publishEntityRaw.id)
      : "";
  const publishEntity =
    publishEntityType && publishEntityId ? { type: publishEntityType, id: publishEntityId } : null;

  let publishedDraftJson = draftJson;
  if (publish && publishPageKey) {
    const publishedVersion = page.publishedVersionId
      ? await prisma.publicPageVersion.findUnique({
          where: { id: page.publishedVersionId },
          select: { contentJson: true },
        })
      : null;
    const baseDraft = normalizeDraft(
      (publishedVersion?.contentJson ?? createDefaultDraft(accountName)) as SiteDraft,
      accountName
    );
    publishedDraftJson = normalizeDraft(
      mergePublishedPageDraft(baseDraft, draftJson, publishPageKey, publishEntity),
      accountName
    );
  }

  const updated = publish
    ? await publishPage(page.id, publishedDraftJson, draftJson)
    : await prisma.publicPage.update({
        where: { id: page.id },
        data: { draftJson: draftJson as Prisma.InputJsonValue },
      });

  return NextResponse.json({
    data: {
      id: updated.id,
      status: updated.status,
      draftJson: updated.draftJson ?? {},
      publishedVersionId: updated.publishedVersionId,
    },
  });
}
