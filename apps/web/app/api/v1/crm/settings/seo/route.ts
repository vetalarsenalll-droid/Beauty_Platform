import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCrmPermission } from "@/lib/auth";

export async function GET() {
  const session = await requireCrmPermission("crm.settings.read");
  const seo = await prisma.seoSetting.findUnique({
    where: { accountId: session.accountId },
  });

  return NextResponse.json({
    data: {
      title: seo?.title ?? "",
      description: seo?.description ?? "",
      ogImageUrl: seo?.ogImageUrl ?? "",
      robots: seo?.robots ?? "",
      sitemapEnabled: seo?.sitemapEnabled ?? true,
      schemaJson: seo?.schemaJson ?? null,
    },
  });
}

export async function PATCH(request: Request) {
  const session = await requireCrmPermission("crm.settings.update");
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) {
    return NextResponse.json({ message: "Invalid request." }, { status: 400 });
  }

  const data = {
    title: typeof body.title === "string" ? body.title : null,
    description: typeof body.description === "string" ? body.description : null,
    ogImageUrl: typeof body.ogImageUrl === "string" ? body.ogImageUrl : null,
    robots: typeof body.robots === "string" ? body.robots : null,
    sitemapEnabled:
      typeof body.sitemapEnabled === "boolean" ? body.sitemapEnabled : true,
    schemaJson:
      typeof body.schemaJson === "object" && body.schemaJson !== null
        ? (body.schemaJson as Prisma.InputJsonValue)
        : Prisma.JsonNull,
  };

  const updated = await prisma.seoSetting.upsert({
    where: { accountId: session.accountId },
    create: { accountId: session.accountId, ...data },
    update: data,
  });

  return NextResponse.json({ data: updated });
}