import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCrmPermission } from "@/lib/auth";
import { createDefaultDraft, DEFAULT_ACCOUNT_NAME, normalizeDraft, type SiteDraft } from "@/lib/site-builder";
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

async function publishPage(pageId: number, draftJson: object) {
  let lastError: unknown = null;

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
              contentJson: draftJson,
            },
          });

          return tx.publicPage.update({
            where: { id: pageId },
            data: {
              draftJson,
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

  const updated = publish
    ? await publishPage(page.id, draftJson)
    : await prisma.publicPage.update({
        where: { id: page.id },
        data: { draftJson },
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
