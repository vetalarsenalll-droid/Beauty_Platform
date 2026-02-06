import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCrmPermission } from "@/lib/auth";

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

async function ensurePage(accountId: number) {
  const existing = await prisma.publicPage.findFirst({
    where: { accountId },
  });
  if (existing) return existing;

  return prisma.publicPage.create({
    data: {
      accountId,
      status: "DRAFT",
      draftJson: {},
    },
  });
}

export async function GET() {
  const session = await requireCrmPermission("crm.settings.read");
  const page = await ensurePage(session.accountId);
  return NextResponse.json({
    data: {
      id: page.id,
      status: page.status,
      draftJson: page.draftJson ?? {},
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
  const draftJson = parseJson(body.draftJson) ?? page.draftJson ?? {};
  const publish = body.publish === true;

  const updated = await prisma.publicPage.update({
    where: { id: page.id },
    data: {
      draftJson,
      status: publish ? "PUBLISHED" : page.status,
    },
  });

  if (publish) {
    const lastVersion = await prisma.publicPageVersion.findFirst({
      where: { publicPageId: page.id },
      orderBy: { version: "desc" },
    });
    const nextVersion = (lastVersion?.version ?? 0) + 1;
    const version = await prisma.publicPageVersion.create({
      data: {
        publicPageId: page.id,
        version: nextVersion,
        contentJson: draftJson,
      },
    });

    await prisma.publicPage.update({
      where: { id: page.id },
      data: { publishedVersionId: version.id, status: "PUBLISHED" },
    });
  }

  return NextResponse.json({
    data: {
      id: updated.id,
      status: updated.status,
      draftJson: updated.draftJson ?? {},
      publishedVersionId: updated.publishedVersionId,
    },
  });
}

