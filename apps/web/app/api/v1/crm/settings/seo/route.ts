import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCrmPermission } from "@/lib/auth";
import { SEO_PAGE_KEYS, isSeoPageKey } from "@/lib/seo-pages";
import {
  mergeVerificationHtmlFiles,
  normalizeSeoHttpUrl,
  normalizeSeoImageUrl,
} from "@/lib/seo-verification";

type PageSettingsInput = {
  pageKey: string;
  title?: unknown;
  description?: unknown;
  ogImageUrl?: unknown;
  keywords?: unknown;
  canonicalUrl?: unknown;
  noIndex?: unknown;
  noFollow?: unknown;
};

function serializePageSettings(
  items: Array<{
    pageKey: string;
    title: string | null;
    description: string | null;
    ogImageUrl: string | null;
    keywords: string | null;
    canonicalUrl: string | null;
    noIndex: boolean;
    noFollow: boolean;
  }>
) {
  const byKey = new Map(items.map((item) => [item.pageKey, item]));
  return SEO_PAGE_KEYS.map((pageKey) => {
    const item = byKey.get(pageKey);
    return {
      pageKey,
      title: item?.title ?? "",
      description: item?.description ?? "",
      ogImageUrl: item?.ogImageUrl ?? "",
      keywords: item?.keywords ?? "",
      canonicalUrl: item?.canonicalUrl ?? "",
      noIndex: item?.noIndex ?? false,
      noFollow: item?.noFollow ?? false,
    };
  });
}

export async function GET() {
  const session = await requireCrmPermission("crm.settings.read");
  const seo = await prisma.seoSetting.findUnique({
    where: { accountId: session.accountId },
  });
  const pageSettings = await prisma.seoPageSetting.findMany({
    where: { accountId: session.accountId },
    orderBy: { pageKey: "asc" },
  });

  return NextResponse.json({
    data: {
      title: seo?.title ?? "",
      description: seo?.description ?? "",
      ogImageUrl: seo?.ogImageUrl ?? "",
      robots: seo?.robots ?? "",
      sitemapEnabled: seo?.sitemapEnabled ?? true,
      schemaJson: seo?.schemaJson ?? null,
      verificationMetaTags: seo?.verificationMetaTags ?? "",
      verificationHtmlFilename: seo?.verificationHtmlFilename ?? "",
      verificationHtmlContent: seo?.verificationHtmlContent ?? "",
      verificationHtmlFiles: mergeVerificationHtmlFiles(
        seo?.verificationHtmlFiles,
        seo?.verificationHtmlFilename,
        seo?.verificationHtmlContent
      ),
      pageSettings: serializePageSettings(pageSettings),
    },
  });
}

export async function PATCH(request: Request) {
  const session = await requireCrmPermission("crm.settings.update");
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) {
    return NextResponse.json({ message: "Invalid request." }, { status: 400 });
  }

  const pageSettingsInput = Array.isArray(body.pageSettings)
    ? body.pageSettings.filter(
        (item): item is PageSettingsInput =>
          typeof item === "object" &&
          item !== null &&
          typeof item.pageKey === "string" &&
          isSeoPageKey(item.pageKey)
      )
    : [];

  const data = {
    verificationHtmlFiles: mergeVerificationHtmlFiles(
      body.verificationHtmlFiles,
      typeof body.verificationHtmlFilename === "string"
        ? body.verificationHtmlFilename
        : null,
      typeof body.verificationHtmlContent === "string"
        ? body.verificationHtmlContent
        : null
    ) as Prisma.InputJsonValue,
    title: typeof body.title === "string" ? body.title : null,
    description: typeof body.description === "string" ? body.description : null,
    ogImageUrl:
      typeof body.ogImageUrl === "string"
        ? normalizeSeoImageUrl(body.ogImageUrl)
        : null,
    robots: typeof body.robots === "string" ? body.robots : null,
    sitemapEnabled:
      typeof body.sitemapEnabled === "boolean" ? body.sitemapEnabled : true,
    verificationMetaTags:
      typeof body.verificationMetaTags === "string" ? body.verificationMetaTags : null,
    verificationHtmlFilename:
      typeof body.verificationHtmlFilename === "string"
        ? body.verificationHtmlFilename
        : null,
    verificationHtmlContent:
      typeof body.verificationHtmlContent === "string"
        ? body.verificationHtmlContent
        : null,
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

  await prisma.$transaction(
    pageSettingsInput.map((item) =>
      prisma.seoPageSetting.upsert({
        where: {
          accountId_pageKey: {
            accountId: session.accountId,
            pageKey: item.pageKey,
          },
        },
        create: {
          accountId: session.accountId,
          pageKey: item.pageKey,
          title: typeof item.title === "string" ? item.title : null,
          description:
            typeof item.description === "string" ? item.description : null,
          ogImageUrl:
            typeof item.ogImageUrl === "string"
              ? normalizeSeoImageUrl(item.ogImageUrl)
              : null,
          keywords:
            typeof item.keywords === "string" ? item.keywords : null,
          canonicalUrl:
            typeof item.canonicalUrl === "string"
              ? normalizeSeoHttpUrl(item.canonicalUrl)
              : null,
          noIndex: typeof item.noIndex === "boolean" ? item.noIndex : false,
          noFollow: typeof item.noFollow === "boolean" ? item.noFollow : false,
        },
        update: {
          title: typeof item.title === "string" ? item.title : null,
          description:
            typeof item.description === "string" ? item.description : null,
          ogImageUrl:
            typeof item.ogImageUrl === "string"
              ? normalizeSeoImageUrl(item.ogImageUrl)
              : null,
          keywords:
            typeof item.keywords === "string" ? item.keywords : null,
          canonicalUrl:
            typeof item.canonicalUrl === "string"
              ? normalizeSeoHttpUrl(item.canonicalUrl)
              : null,
          noIndex: typeof item.noIndex === "boolean" ? item.noIndex : false,
          noFollow: typeof item.noFollow === "boolean" ? item.noFollow : false,
        },
      })
    )
  );

  const savedPageSettings = await prisma.seoPageSetting.findMany({
    where: { accountId: session.accountId },
    orderBy: { pageKey: "asc" },
  });

  return NextResponse.json({
    data: {
      ...updated,
      verificationHtmlFiles: mergeVerificationHtmlFiles(
        updated.verificationHtmlFiles,
        updated.verificationHtmlFilename,
        updated.verificationHtmlContent
      ),
      pageSettings: serializePageSettings(savedPageSettings),
    },
  });
}
